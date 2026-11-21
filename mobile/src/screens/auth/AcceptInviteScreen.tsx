import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import StatusBanner from '../../components/StatusBanner';

import { supabase } from '../../config/supabase';
import { getCurrentSession } from '../../services/authService';
import {
  acceptGroupInvitation,
  getPendingInvitation,
  getUnclaimedMembers,
  UnclaimedMember,
} from '../../services/memberService';
import { findAutoMatchPlaceholder } from '../../utils/memberOnboarding';

type Status = {
  type: 'error' | 'info';
  message: string;
} | null;

export default function AcceptInviteScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const [groupId, setGroupId] = useState<string | null>(route.params?.groupId || null);
  const [groupName, setGroupName] = useState('Group invitation');
  const groupNameRef = useRef('Group invitation');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [unclaimedMembers, setUnclaimedMembers] = useState<UnclaimedMember[]>([]);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [isAlreadyMember, setIsAlreadyMember] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      const { data: sessionData, error: sessionError } = await getCurrentSession();
      const session = sessionData?.session;

      if (sessionError) {
        if (active) {
          setStatus({
            type: 'error',
            message: sessionError.message,
          });
          setLoading(false);
        }
        return;
      }

      let webGroupId: string | null = null;
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
        const searchParams = new URLSearchParams(window.location.search);
        webGroupId = searchParams.get('group') || searchParams.get('groupId');
      }

      const metadataGroupId = session?.user.user_metadata?.invited_group_id;
      const resolvedGroupId = groupId || route.params?.groupId || webGroupId || metadataGroupId;

      if (!session?.user) {
        if (active) {
          setStatus({
            type: 'info',
            message: 'Sign in or create your FairShare account to continue with this invitation.',
          });
          setLoading(false);
        }
        return;
      }

      if (!resolvedGroupId) {
        if (active) {
          setStatus({
            type: 'error',
            message: 'The invitation does not contain a valid group.',
          });
          setLoading(false);
        }
        return;
      }

      if (!active) return;

      setGroupId(resolvedGroupId);

      const existingName =
        typeof session.user.user_metadata?.full_name === 'string'
          ? session.user.user_metadata.full_name
          : '';

      setFullName(existingName);

      const [pendingResult, unclaimedResult] = await Promise.all([
        getPendingInvitation(resolvedGroupId),
        getUnclaimedMembers(resolvedGroupId),
      ]);

      if (!active) return;

      if (pendingResult.data?.group_name) {
        setGroupName(pendingResult.data.group_name);
        groupNameRef.current = pendingResult.data.group_name;
        if (pendingResult.data.status === 'active') {
          setIsAlreadyMember(true);
        }
      } else if (pendingResult.error) {
        setStatus({
          type: 'error',
          message: pendingResult.error.message,
        });
      }

      if (unclaimedResult.data && unclaimedResult.data.length > 0) {
        setUnclaimedMembers(unclaimedResult.data);
        const userEmail = session.user.email?.toLowerCase().trim();
        const userName = (session.user.user_metadata?.full_name || '').toLowerCase().trim();

        // Smart Auto-Match: match by email or display name
        const matched = findAutoMatchPlaceholder(unclaimedResult.data, userEmail, userName);

        if (matched) {
          setSelectedClaimId(matched.id);
          if (!existingName) {
            setFullName(matched.display_name);
          }
        }
      }

      setLoading(false);
    };

    void load();

    return () => {
      active = false;
    };
  }, [groupId]);

  const continueInvitation = async () => {
    if (!groupId) return;

    setStatus(null);

    const name = fullName.trim();

    if (!name) {
      setStatus({ type: 'error', message: 'Enter your full name.' });
      return;
    }

    if (password && password.length < 8) {
      setStatus({
        type: 'error',
        message: 'Password must contain at least 8 characters.',
      });
      return;
    }

    setSaving(true);

    const { error: authError } = await supabase.auth.updateUser({
      ...(password ? { password } : {}),
      data: { full_name: name },
    });

    if (authError) {
      setSaving(false);
      setStatus({
        type: 'error',
        message: authError.message,
      });
      return;
    }

    const result = await acceptGroupInvitation(groupId, name, selectedClaimId);

    setSaving(false);

    if (result.error) {
      setStatus({
        type: 'error',
        message: result.error.message,
      });
      return;
    }

    navigation.reset({
      index: 1,
      routes: [
        { name: 'Home' },
        {
          name: 'GroupDetails',
          params: {
            groupId,
            groupName: groupNameRef.current,
          },
        },
      ],
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#06090F" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#00E5FF" />
          <Text style={styles.loadingText}>Preparing invitation…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!groupId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#06090F" />
        <View style={styles.container}>
          <View style={styles.icon}>
            <Ionicons name="link-outline" size={28} color="#00E5FF" />
          </View>
          <Text style={styles.title}>Invitation</Text>
          <Text style={styles.subtitle}>
            {status?.message || 'This invitation cannot be opened.'}
          </Text>

          <Pressable
            style={styles.button}
            onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] })}
          >
            <Text style={styles.buttonText}>Go to FairShare</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (status?.type === 'info') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#06090F" />
        <View style={styles.container}>
          <View style={styles.icon}>
            <Ionicons name="people-outline" size={28} color="#00E5FF" />
          </View>

          <Text style={styles.title}>Join a FairShare group</Text>
          <Text style={styles.subtitle}>{status.message}</Text>

          <Pressable
            style={styles.button}
            onPress={() =>
              navigation.navigate('Login', {
                inviteGroupId: groupId,
              })
            }
          >
            <Text style={styles.buttonText}>Sign In</Text>
          </Pressable>

          <Pressable
            style={styles.secondaryButton}
            onPress={() =>
              navigation.navigate('SignUp', {
                inviteGroupId: groupId,
              })
            }
          >
            <Text style={styles.secondaryButtonText}>Create Account</Text>
          </Pressable>

          <Pressable
            style={styles.cancel}
            onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] })}
          >
            <Text style={styles.cancelText}>Not now</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (isAlreadyMember) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#06090F" />
        <View style={styles.container}>
          <View style={styles.icon}>
            <Ionicons name="checkmark-circle-outline" size={28} color="#00E5FF" />
          </View>

          <Text style={styles.title}>Already a member</Text>
          <Text style={styles.subtitle}>
            You are already an active member of {groupName}.
          </Text>

          <Pressable
            style={styles.button}
            onPress={() =>
              navigation.reset({
                index: 1,
                routes: [
                  { name: 'Home' },
                  {
                    name: 'GroupDetails',
                    params: {
                      groupId,
                      groupName: groupNameRef.current,
                    },
                  },
                ],
              })
            }
          >
            <Text style={styles.buttonText}>Open Group</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#06090F" />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.container}>
          <View style={styles.icon}>
            <Ionicons name="people-outline" size={28} color="#00E5FF" />
          </View>

          <Text style={styles.title}>Join {groupName}</Text>
          <Text style={styles.subtitle}>
            Complete your profile to join this FairShare group.
          </Text>

          {unclaimedMembers.length > 0 ? (
            <View style={styles.claimSection}>
              <View style={styles.claimHeader}>
                <Ionicons name="sparkles" size={14} color="#00E5FF" style={{ marginRight: 6 }} />
                <Text style={styles.claimTitle}>WHICH MEMBER ARE YOU?</Text>
              </View>
              <Text style={styles.claimSubtitle}>
                The organizer added placeholder members. Select your name to automatically link past expenses:
              </Text>
              <View style={styles.claimChips}>
                {unclaimedMembers.map((m) => {
                  const selected = selectedClaimId === m.id;
                  return (
                    <Pressable
                      key={m.id}
                      style={[styles.claimChip, selected && styles.claimChipSelected]}
                      onPress={() => {
                        if (selected) {
                          setSelectedClaimId(null);
                        } else {
                          setSelectedClaimId(m.id);
                          setFullName(m.display_name);
                        }
                      }}
                    >
                      <Ionicons
                        name={selected ? "checkmark-circle" : "person-outline"}
                        size={15}
                        color={selected ? "#00E5FF" : "#94A3B8"}
                        style={{ marginRight: 5 }}
                      />
                      <Text style={[styles.claimChipText, selected && styles.claimChipTextSelected]}>
                        {m.display_name}
                      </Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  style={[styles.claimChip, selectedClaimId === null && styles.claimChipSelected]}
                  onPress={() => setSelectedClaimId(null)}
                >
                  <Ionicons
                    name="person-add-outline"
                    size={15}
                    color={selectedClaimId === null ? "#00E5FF" : "#94A3B8"}
                    style={{ marginRight: 5 }}
                  />
                  <Text style={[styles.claimChipText, selectedClaimId === null && styles.claimChipTextSelected]}>
                    Join as new member
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <Text style={styles.label}>Full name</Text>
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            placeholder="Your name"
            placeholderTextColor="#64748B"
            style={styles.input}
            autoCapitalize="words"
            editable={!saving}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Set a password (optional if already set)"
            placeholderTextColor="#64748B"
            style={styles.input}
            secureTextEntry
            editable={!saving}
          />

          <StatusBanner
            type={status?.type}
            message={status?.message}
            onDismiss={() => setStatus(null)}
          />

          <Pressable
            style={[styles.button, saving && styles.disabled]}
            onPress={continueInvitation}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#06090F" />
            ) : (
              <Text style={styles.buttonText}>Join Group</Text>
            )}
          </Pressable>

          <Pressable
            style={styles.cancel}
            onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Home' }] })}
            disabled={saving}
          >
            <Text style={styles.cancelText}>Not now</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#06090F',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 20,
  },
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  claimSection: {
    backgroundColor: '#0E1524',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.25)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  claimHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  claimTitle: {
    color: '#00E5FF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  claimSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  claimChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  claimChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  claimChipSelected: {
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    borderColor: '#00E5FF',
  },
  claimChipText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  claimChipTextSelected: {
    color: '#00E5FF',
    fontWeight: '700',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: '#0E1524',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 18,
  },
  title: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 29,
    fontWeight: '900',
  },
  subtitle: {
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 8,
    marginBottom: 26,
  },
  label: {
    color: '#CBD5E1',
    fontWeight: '800',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#0E1524',
    color: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 14,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#00E5FF',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  secondaryButton: {
    backgroundColor: '#0E1524',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  secondaryButtonText: {
    color: '#CBD5E1',
    fontWeight: '900',
  },
  disabled: {
    opacity: 0.6,
  },
  cancel: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  cancelText: {
    color: '#94A3B8',
    fontWeight: '700',
  },
  loadingText: {
    color: '#94A3B8',
    marginTop: 12,
  },
  statusBox: {
    backgroundColor: '#3B1720',
    borderWidth: 1,
    borderColor: '#7F1D1D',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  statusText: {
    color: '#FCA5A5',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
});
