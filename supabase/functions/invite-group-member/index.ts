import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function getKey(
  pluralEnv: string,
  legacyEnv: string
): string | null {
  const plural = Deno.env.get(pluralEnv);

  if (plural) {
    try {
      const parsed = JSON.parse(plural);
      if (parsed?.default) {
        return parsed.default;
      }
    } catch {
      // Fall back to the legacy variable below.
    }
  }

  return Deno.env.get(legacyEnv) || null;
}

function isAllowedRedirect(redirectTo: string) {
  return (
    redirectTo.startsWith('fairshare://accept-invite') ||
    /^exp:\/\/[^/]+(?::\d+)?\/--\/accept-invite(?:\?.*)?$/.test(
      redirectTo
    )
  );
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function findUserByEmail(
  admin: ReturnType<typeof createClient>,
  email: string
) {
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } =
      await admin.auth.admin.listUsers({
        page,
        perPage,
      });

    if (error) {
      throw new Error(
        `Unable to look up user: ${error.message}`
      );
    }

    const users = data?.users || [];

    const match = users.find(
      (user) =>
        user.email?.trim().toLowerCase() === email
    );

    if (match) {
      return match;
    }

    if (users.length < perPage) {
      return null;
    }

    page += 1;
  }
}

export default {
  async fetch(req: Request) {
    if (req.method === 'OPTIONS') {
      return new Response('ok', {
        headers: corsHeaders,
      });
    }

    if (req.method !== 'POST') {
      return json(
        {
          ok: false,
          error: 'Method not allowed.',
        },
        405
      );
    }

    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const publishableKey = getKey(
        'SUPABASE_PUBLISHABLE_KEYS',
        'SUPABASE_ANON_KEY'
      );
      const secretKey = getKey(
        'SUPABASE_SECRET_KEYS',
        'SUPABASE_SERVICE_ROLE_KEY'
      );

      if (!supabaseUrl || !publishableKey || !secretKey) {
        console.error('Missing Supabase function credentials.');
        return json(
          {
            ok: false,
            error: 'Server configuration is incomplete.',
          },
          500
        );
      }

      const authorization = req.headers.get(
        'Authorization'
      );

      if (!authorization?.startsWith('Bearer ')) {
        return json(
          {
            ok: false,
            error: 'Authentication required.',
          },
          401
        );
      }

      const accessToken = authorization.slice(7).trim();

      const userClient = createClient(
        supabaseUrl,
        publishableKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false,
          },
        }
      );

      const {
        data: { user: caller },
        error: authError,
      } = await userClient.auth.getUser(accessToken);

      if (authError || !caller) {
        return json(
          {
            ok: false,
            error: 'Authentication required.',
          },
          401
        );
      }

      const admin = createClient(
        supabaseUrl,
        secretKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
            detectSessionInUrl: false,
          },
        }
      );

      let body: {
        groupId?: string;
        email?: string;
        redirectTo?: string;
      };

      try {
        body = await req.json();
      } catch {
        return json(
          {
            ok: false,
            error: 'Invalid JSON body.',
          },
          400
        );
      }

      const groupId = body.groupId?.trim();
      const email = body.email
        ? normalizeEmail(body.email)
        : '';
      const redirectTo = body.redirectTo?.trim();

      if (!groupId || !email || !redirectTo) {
        return json(
          {
            ok: false,
            error:
              'groupId, email and redirectTo are required.',
          },
          400
        );
      }

      if (!/^\S+@\S+\.\S+$/.test(email)) {
        return json(
          {
            ok: false,
            error: 'Invalid email address.',
          },
          400
        );
      }

      if (!isAllowedRedirect(redirectTo)) {
        return json(
          {
            ok: false,
            error: 'Invalid invitation redirect URL.',
          },
          400
        );
      }

      const { data: group, error: groupError } =
        await admin
          .from('groups')
          .select('id,name,owner_id')
          .eq('id', groupId)
          .single();

      if (groupError || !group) {
        return json(
          {
            ok: false,
            error: 'Group not found.',
          },
          404
        );
      }

      let callerCanManageMembers = group.owner_id === caller.id;

      if (!callerCanManageMembers) {
        const { data: callerMembership, error: callerMembershipError } =
          await admin
            .from('group_members')
            .select('role,status')
            .eq('group_id', groupId)
            .eq('user_id', caller.id)
            .maybeSingle();

        if (callerMembershipError) {
          return json(
            {
              ok: false,
              error: `Unable to verify group permissions: ${callerMembershipError.message}`,
            },
            500
          );
        }

        callerCanManageMembers =
          callerMembership?.status === 'active' &&
          callerMembership?.role === 'admin';
      }

      if (!callerCanManageMembers) {
        return json(
          {
            ok: false,
            error: 'You do not have permission to add members to this group.',
          },
          403
        );
      }

      if (email === caller.email?.toLowerCase()) {
        return json(
          {
            ok: false,
            error: 'You are already the group owner.',
          },
          400
        );
      }

      const { data: existingMember, error: memberError } =
        await admin
          .from('group_members')
          .select('id,status,user_id,email,role')
          .eq('group_id', groupId)
          .ilike('email', email)
          .maybeSingle();

      if (memberError) {
        return json(
          {
            ok: false,
            error: `Unable to check group membership: ${memberError.message}`,
          },
          500
        );
      }

      // Make the operation idempotent. Re-adding an existing
      // member should not look like a failed Edge Function.
      if (existingMember) {
        return json({
          ok: true,
          status: existingMember.status,
          member: existingMember,
          message:
            existingMember.status === 'pending'
              ? 'An invitation is already pending for this email.'
              : 'This person is already a member of the group.',
        });
      }

      const existingUser =
        await findUserByEmail(admin, email);

      // Existing, verified FairShare user.
      if (
        existingUser?.id &&
        existingUser.email_confirmed_at
      ) {
        const { data: member, error } =
          await admin
            .from('group_members')
            .insert({
              group_id: groupId,
              user_id: existingUser.id,
              email,
              role: 'member',
              status: 'active',
            })
            .select('*')
            .single();

        if (error) {
          return json(
            {
              ok: false,
              error: `Unable to add member: ${error.message}`,
            },
            500
          );
        }

        return json({
          ok: true,
          status: 'active',
          member,
          message: 'Member added.',
        });
      }

      // An existing but unverified account should finish email
      // verification first rather than silently becoming a member.
      if (existingUser?.id) {
        return json(
          {
            ok: false,
            error:
              'This email already has a FairShare account that has not been verified. Ask them to verify their email first, then add them again.',
          },
          400
        );
      }

      // Brand-new email: create the invited auth user and send
      // the standard Supabase invitation email.
      const { data: invited, error: inviteError } =
        await admin.auth.admin.inviteUserByEmail(
          email,
          {
            redirectTo,
            data: {
              invited_group_id: groupId,
            },
          }
        );

      if (inviteError || !invited?.user?.id) {
        return json(
          {
            ok: false,
            error:
              inviteError?.message ||
              'Unable to send invitation email.',
          },
          400
        );
      }

      const invitedUserId = invited.user.id;

      const { data: member, error: insertError } =
        await admin
          .from('group_members')
          .insert({
            group_id: groupId,
            user_id: invitedUserId,
            email,
            role: 'member',
            status: 'pending',
          })
          .select('*')
          .single();

      if (insertError) {
        await admin.auth.admin.deleteUser(
          invitedUserId
        );

        return json(
          {
            ok: false,
            error:
              `Invitation was created but the group membership could not be saved: ${insertError.message}`,
          },
          500
        );
      }

      return json({
        ok: true,
        status: 'pending',
        member,
        message: 'Invitation sent.',
      });
    } catch (error) {
      console.error('invite-group-member error:', error);

      return json(
        {
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : 'Unexpected server error.',
        },
        500
      );
    }
  },
};