import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Pressable,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import {
  SafeAreaView,
} from 'react-native-safe-area-context';
import {
  useNavigation,
} from '@react-navigation/native';

import { supabase } from '../../config/supabase';
import PasswordInput from '../../components/PasswordInput';

export default function AcceptInviteScreen() {
  const navigation = useNavigation<any>();

  const [groupId, setGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState('');
  const [email, setEmail] = useState('');

  const [sessionReady, setSessionReady] =
    useState(false);
  const [loadingInvite, setLoadingInvite] =
    useState(true);
  const [saving, setSaving] =
    useState(false);

  const [fullName, setFullName] =
    useState('');
  const [password, setPassword] =
    useState('');
  const [confirmPassword, setConfirmPassword] =
    useState('');

  const loadInvitation = useCallback(
    async () => {
      setLoadingInvite(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setSessionReady(false);
        setLoadingInvite(false);
        return;
      }

      const user = session.user;

      const invitedGroupId =
        user.user_metadata?.invited_group_id;

      setEmail(user.email || '');
      setSessionReady(true);

      if (!invitedGroupId) {
        setLoadingInvite(false);
        return;
      }

      const {
        data: membership,
        error: membershipError,
      } = await supabase
        .from('group_members')
        .select(
          'id,group_id,status,email'
        )
        .eq(
          'group_id',
          invitedGroupId
        )
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .maybeSingle();

      if (
        membershipError ||
        !membership
      ) {
        setGroupId(null);
        setLoadingInvite(false);
        return;
      }

      const { data: group } =
        await supabase
          .from('groups')
          .select('id,name')
          .eq('id', invitedGroupId)
          .single();

      setGroupId(
        membership.group_id
      );

      setGroupName(
        group?.name || 'Group'
      );

      setLoadingInvite(false);
    },
    []
  );

  useEffect(() => {
    loadInvitation();

    const {
      data: { subscription },
    } =
      supabase.auth.onAuthStateChange(
        async () => {
          await loadInvitation();
        }
      );

    return () =>
      subscription.unsubscribe();
  }, [loadInvitation]);

  const acceptInvitation =
    async () => {
      if (!groupId) {
        return Alert.alert(
          'Invitation unavailable',
          'This invitation is no longer pending for this account.'
        );
      }

      if (!fullName.trim()) {
        return Alert.alert(
          'Missing name',
          'Please enter your full name.'
        );
      }

      if (password.length < 8) {
        return Alert.alert(
          'Weak password',
          'Password must be at least 8 characters.'
        );
      }

      if (
        password !==
        confirmPassword
      ) {
        return Alert.alert(
          'Passwords do not match',
          'Enter the same password in both fields.'
        );
      }

      setSaving(true);

      const {
        error: userError,
      } =
        await supabase.auth.updateUser({
          password,
          data: {
            full_name:
              fullName.trim(),
            invited_group_id: null,
          },
        });

      if (userError) {
        setSaving(false);

        return Alert.alert(
          'Account setup failed',
          userError.message
        );
      }

      const {
        data: userData,
      } =
        await supabase.auth.getUser();

      const userId =
        userData.user?.id;

      if (!userId) {
        setSaving(false);

        return Alert.alert(
          'Authentication error',
          'Please reopen the invitation and try again.'
        );
      }

      const {
        error: profileError,
      } =
        await supabase
          .from('profiles')
          .upsert({
            id: userId,
            full_name:
              fullName.trim(),
          });

      if (profileError) {
        setSaving(false);

        return Alert.alert(
          'Profile setup failed',
          profileError.message
        );
      }

      const {
        error: acceptError,
      } =
        await supabase.rpc(
          'accept_group_invitation',
          {
            p_group_id: groupId,
          }
        );

      setSaving(false);

      if (acceptError) {
        return Alert.alert(
          'Invitation failed',
          acceptError.message
        );
      }

      Alert.alert(
        'Welcome to the group',
        `You joined ${
          groupName || 'the group'
        }.`,
        [
          {
            text: 'Continue',
            onPress: () =>
              navigation.reset({
                index: 1,
                routes: [
                  {
                    name: 'Home',
                  },
                  {
                    name:
                      'GroupDetails',
                    params: {
                      groupId,
                      groupName,
                    },
                  },
                ],
              }),
          },
        ]
      );
    };

  if (
    loadingInvite ||
    !sessionReady
  ) {
    return (
      <SafeAreaView
        style={styles.safeArea}
        edges={[
          'top',
          'bottom',
          'left',
          'right',
        ]}
      >
        <View
          style={
            styles.centerContent
          }
        >
          <ActivityIndicator
            size="large"
            color="#0EA5A4"
          />

          <Text
            style={
              styles.loadingText
            }
          >
            Opening invitation…
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!groupId) {
    return (
      <SafeAreaView
        style={styles.safeArea}
        edges={[
          'top',
          'bottom',
          'left',
          'right',
        ]}
      >
        <View
          style={
            styles.centerContent
          }
        >
          <Text style={styles.icon}>
            ✉
          </Text>

          <Text style={styles.title}>
            Invitation unavailable
          </Text>

          <Text
            style={
              styles.subtitle
            }
          >
            This invitation could not
            be linked to your FairShare
            account. Make sure you are
            using the email address that
            received the invitation.
          </Text>

          <Pressable
            style={styles.button}
            onPress={() =>
              navigation.reset({
                index: 0,
                routes: [
                  {
                    name: 'Home',
                  },
                ],
              })
            }
          >
            <Text
              style={
                styles.buttonText
              }
            >
              Go to FairShare
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={[
        'top',
        'bottom',
        'left',
        'right',
      ]}
    >
      <View
        style={styles.container}
      >
        <View style={styles.card}>
          <Text style={styles.eyebrow}>
            GROUP INVITATION
          </Text>

          <Text style={styles.title}>
            Join{' '}
            {groupName ||
              'this group'}
          </Text>

          <Text
            style={
              styles.subtitle
            }
          >
            Finish setting up your
            FairShare account to join
            the group.
          </Text>

          <Text
            style={
              styles.emailLabel
            }
          >
            Invited email
          </Text>

          <View
            style={
              styles.emailBox
            }
          >
            <Text
              style={
                styles.emailText
              }
              numberOfLines={1}
            >
              {email}
            </Text>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Full name"
            placeholderTextColor="#64748B"
            value={fullName}
            onChangeText={setFullName}
          />

          <PasswordInput
            placeholder="Create password"
            value={password}
            onChangeText={setPassword}
          />

          <PasswordInput
            placeholder="Confirm password"
            value={confirmPassword}
            onChangeText={
              setConfirmPassword
            }
          />

          <Pressable
            style={[
              styles.button,
              saving &&
                styles.disabled,
            ]}
            onPress={
              acceptInvitation
            }
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator
                color="#FFFFFF"
              />
            ) : (
              <Text
                style={
                  styles.buttonText
                }
              >
                Join Group
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },

  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  centerContent: {
    flex: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },

  card: {
    backgroundColor: '#1E293B',
    borderRadius: 26,
    padding: 24,
  },

  eyebrow: {
    color: '#0EA5A4',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 10,
  },

  icon: {
    fontSize: 42,
    color: '#0EA5A4',
    marginBottom: 16,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 29,
    fontWeight: '700',
    textAlign: 'center',
  },

  subtitle: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 9,
    marginBottom: 22,
    textAlign: 'center',
  },

  emailLabel: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },

  emailBox: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    marginBottom: 16,
  },

  emailText: {
    color: '#94A3B8',
    fontSize: 14,
  },

  input: {
    backgroundColor: '#0F172A',
    color: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    marginBottom: 16,
  },

  button: {
    backgroundColor: '#0EA5A4',
    minHeight: 54,
    borderRadius: 15,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  disabled: {
    opacity: 0.7,
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  loadingText: {
    color: '#94A3B8',
    marginTop: 14,
    fontSize: 14,
  },
});