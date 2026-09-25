import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data: sessionData, error: sessionError } = await getCurrentSession();
      const session = sessionData?.session;
      if (sessionError || !session?.user) {
        if (active) setLoading(false);
        Alert.alert('Sign in required', 'Please finish the invitation flow after the invited account is signed in.');
        return;
      }

      const metadataGroupId = session.user.user_metadata?.invited_group_id;
      const resolvedGroupId = groupId || metadataGroupId;
      if (!resolvedGroupId) {
        if (active) setLoading(false);
        Alert.alert('Invitation unavailable', 'The invitation does not contain a valid group.');
        return;
      }

      if (!active) return;
      setGroupId(resolvedGroupId);
      const existingName = typeof session.user.user_metadata?.full_name === 'string'
        ? session.user.user_metadata.full_name
        : '';
      setFullName(existingName);

      const result = await getPendingInvitation(resolvedGroupId);
      if (!active) return;
      if (result.data?.group_name) {
        setGroupName(result.data.group_name);
        groupNameRef.current = result.data.group_name;
      } else if (result.error) {
        Alert.alert('Unable to load invitation', result.error.message);
      }
      setLoading(false);
    };
    load();
    return () => { active = false; };
  }, [groupId]);

  const continueInvitation = async () => {
    if (!groupId) return;
    const name = fullName.trim();
    if (!name) return Alert.alert('Name required', 'Enter your full name.');
    if (password && password.length < 8) {
      return Alert.alert('Password too short', 'Password must contain at least 8 characters.');
    }

    setSaving(true);
    const { error: authError } = await supabase.auth.updateUser({
      ...(password ? { password } : {}),
      data: { full_name: name },
    });
    if (authError) {
      setSaving(false);
      Alert.alert('Unable to update account', authError.message);
      return;
    }

    const result = await acceptGroupInvitation(groupId, name);
    setSaving(false);
    if (result.error) {
      Alert.alert('Unable to accept invitation', result.error.message);
      return;
    }

    navigation.reset({
      index: 1,
      routes: [
        { name: 'Home' },
        { name: 'GroupDetails', params: { groupId, groupName: groupNameRef.current } },
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      <View style={styles.container}>
        <View style={styles.icon}>
          <Ionicons name="people-outline" size={28} color="#0EA5A4" />
        </View>
        <Text style={styles.title}>Join {groupName}</Text>
        <Text style={styles.subtitle}>Complete your profile to join this FairShare group.</Text>
        <Text style={styles.label}>Full name</Text>
        <TextInput value={fullName} onChangeText={setFullName} placeholder="Your name" placeholderTextColor="#64748B" style={styles.input} autoCapitalize="words" />
        <Text style={styles.label}>Password</Text>
        <TextInput value={password} onChangeText={setPassword} placeholder="Set a password (optional if already set)" placeholderTextColor="#64748B" style={styles.input} secureTextEntry />
        <Pressable style={[styles.button, saving && styles.disabled]} onPress={continueInvitation} disabled={saving}>
          {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Join Group</Text>}
        </Pressable>
        <Pressable style={styles.cancel} onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Home' }] })}>
          <Text style={styles.cancelText}>Not now</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F172A' },
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  icon: { width: 58, height: 58, borderRadius: 18, backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 18 },
  title: { color: '#FFFFFF', textAlign: 'center', fontSize: 29, fontWeight: '900' },
  subtitle: { color: '#94A3B8', textAlign: 'center', lineHeight: 21, marginTop: 8, marginBottom: 26 },
  label: { color: '#CBD5E1', fontWeight: '800', marginBottom: 8 },
  input: { backgroundColor: '#1E293B', color: '#FFFFFF', borderRadius: 14, paddingHorizontal: 15, paddingVertical: 14, marginBottom: 16 },
  button: { backgroundColor: '#0EA5A4', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  buttonText: { color: '#FFFFFF', fontWeight: '900' },
  disabled: { opacity: 0.6 },
  cancel: { alignItems: 'center', paddingVertical: 16 },
  cancelText: { color: '#94A3B8', fontWeight: '700' },
  loadingText: { color: '#94A3B8', marginTop: 12 },
});
