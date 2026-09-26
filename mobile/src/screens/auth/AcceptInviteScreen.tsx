import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

import { supabase } from '../../config/supabase';
import { getCurrentSession } from '../../services/authService';
import { acceptGroupInvitation, getPendingInvitation } from '../../services/memberService';

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status>(null);

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

      const metadataGroupId = session?.user.user_metadata?.invited_group_id;
      const resolvedGroupId = groupId || metadataGroupId;

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

      const result = await getPendingInvitation(resolvedGroupId);

      if (!active) return;

      if (result.data?.group_name) {
        setGroupName(result.data.group_name);
        groupNameRef.current = result.data.group_name;
      } else if (result.error) {
        setStatus({
          type: 'error',
          message: result.error.message,
        });
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

    const result = await acceptGroupInvitation(groupId, name);

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
        <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0EA5A4" />
          <Text style={styles.loadingText}>Preparing invitation…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!groupId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
        <View style={styles.container}>
          <View style={styles.icon}>
            <Ionicons name="link-outline" size={28} color="#0EA5A4" />
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
        <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
        <View style={styles.container}>
          <View style={styles.icon}>
            <Ionicons name="people-outline" size={28} color="#0EA5A4" />
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      <View style={styles.container}>
        <View style={styles.icon}>
          <Ionicons name="people-outline" size={28} color="#0EA5A4" />
        </View>

        <Text style={styles.title}>Join {groupName}</Text>
        <Text style={styles.subtitle}>
          Complete your profile to join this FairShare group.
        </Text>

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

        {status?.type === 'error' ? (
          <View style={styles.statusBox}>
            <Text style={styles.statusText}>{status.message}</Text>
          </View>
        ) : null}

        <Pressable
          style={[styles.button, saving && styles.disabled]}
          onPress={continueInvitation}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
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
    padding: 24,
    justifyContent: 'center',
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
    backgroundColor: '#1E293B',
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
    backgroundColor: '#1E293B',
    color: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 14,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#0EA5A4',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  secondaryButton: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#334155',
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
