import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
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
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import {
  changePassword,
  getUserProfile,
  signOutAccount,
  updateUserProfile,
  UserProfile,
} from '../../services/profileService';

function initials(profile: UserProfile | null) {
  const name = profile?.full_name?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return parts[0][0].toUpperCase();
  }

  const email = profile?.email?.trim();
  return email ? email[0].toUpperCase() : '?';
}

function formatMemberSince(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export default function ProfileScreen() {
  const navigation = useNavigation<any>();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  const [passwordVisible, setPasswordVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    const result = await getUserProfile();

    if (result.error || !result.data) {
      setLoading(false);
      Alert.alert(
        'Unable to load profile',
        result.error?.message || 'Your profile could not be loaded.',
      );
      return;
    }

    setProfile(result.data);
    setFullName(result.data.full_name);
    setPhoneNumber(result.data.phone_number);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile]),
  );

  const avatarText = useMemo(() => initials(profile), [profile]);

  const startEditing = () => {
    setFullName(profile?.full_name || '');
    setPhoneNumber(profile?.phone_number || '');
    setEditing(true);
  };

  const cancelEditing = () => {
    if (saving) return;
    setFullName(profile?.full_name || '');
    setPhoneNumber(profile?.phone_number || '');
    setEditing(false);
  };

  const saveProfile = async () => {
    const normalizedName = fullName.trim();
    const normalizedPhone = phoneNumber.trim();

    if (!normalizedName) {
      Alert.alert('Name required', 'Please enter your full name.');
      return;
    }

    if (normalizedName.length > 120) {
      Alert.alert('Name too long', 'Keep your name within 120 characters.');
      return;
    }

    if (normalizedPhone.length > 30) {
      Alert.alert('Phone number too long', 'Keep your phone number within 30 characters.');
      return;
    }

    setSaving(true);
    const result = await updateUserProfile({
      fullName: normalizedName,
      phoneNumber: normalizedPhone,
    });
    setSaving(false);

    if (result.error || !result.data) {
      Alert.alert(
        'Unable to save profile',
        result.error?.message || 'Your profile could not be updated.',
      );
      return;
    }

    setProfile(result.data);
    setFullName(result.data.full_name);
    setPhoneNumber(result.data.phone_number);
    setEditing(false);
  };

  const openPasswordChange = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordVisible(true);
  };

  const savePassword = async () => {
    const email = profile?.email?.trim() || '';

    if (!email) {
      Alert.alert('Email unavailable', 'Your account email could not be found.');
      return;
    }

    if (!currentPassword) {
      Alert.alert(
        'Current password required',
        'Enter your current password before changing it.',
      );
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert(
        'Weak password',
        'Your new password must be at least 8 characters.',
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert(
        'Passwords do not match',
        'Enter the same new password in both fields.',
      );
      return;
    }

    if (newPassword === currentPassword) {
      Alert.alert(
        'Choose a new password',
        'Your new password must be different from your current password.',
      );
      return;
    }

    setPasswordBusy(true);
    const { error } = await changePassword(
      email,
      currentPassword,
      newPassword,
    );
    setPasswordBusy(false);

    if (error) {
      Alert.alert('Unable to change password', error.message);
      return;
    }

    setPasswordVisible(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    Alert.alert('Password updated', 'Your password has been changed successfully.');
  };

  const confirmSignOut = () => {
    if (saving || passwordBusy || signingOut) return;

    const performSignOut = async () => {
      setSigningOut(true);

      const { error } = await signOutAccount();
      if (error) {
        setSigningOut(false);
        if (Platform.OS === 'web') {
          window.alert(`Unable to sign out\n\n${error.message}`);
        } else {
          Alert.alert('Unable to sign out', error.message);
        }
        return;
      }

      // AppNavigator owns navigation after auth changes. The Supabase
      // SIGNED_OUT event resets the stack to the Welcome screen.
    };

    const message =
      'You will need to sign in again to access your FairShare account.';

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(`Sign out?\n\n${message}`);
      if (confirmed) {
        void performSignOut();
      }
      return;
    }

    Alert.alert(
      'Sign out?',
      message,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: () => {
            void performSignOut();
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0EA5A4" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.header}>
            <Pressable style={styles.headerButton} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={23} color="#FFFFFF" />
            </Pressable>
            <View style={styles.headerCenter}>
              <Text style={styles.eyebrow}>Account</Text>
              <Text style={styles.headerTitle}>My Profile</Text>
            </View>
            <Pressable
              style={styles.headerButton}
              onPress={editing ? cancelEditing : startEditing}
              disabled={saving}
            >
              <Ionicons
                name={editing ? 'close-outline' : 'create-outline'}
                size={22}
                color="#FFFFFF"
              />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.heroCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{avatarText}</Text>
              </View>
              <Text style={styles.heroName}>
                {profile?.full_name?.trim() || 'Your name'}
              </Text>
              <Text style={styles.heroEmail}>
                {profile?.email || 'No email available'}
              </Text>
              <View style={styles.memberSinceBadge}>
                <Ionicons name="calendar-outline" size={14} color="#0EA5A4" />
                <Text style={styles.memberSinceText}>
                  Member since {formatMemberSince(profile?.created_at || null)}
                </Text>
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.sectionTitleRow}>
                <View>
                  <Text style={styles.sectionTitle}>Profile details</Text>
                  <Text style={styles.sectionSubtitle}>
                    Keep your personal information up to date.
                  </Text>
                </View>
              </View>

              {editing ? (
                <>
                  <Text style={styles.inputLabel}>Full name</Text>
                  <TextInput
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="Your full name"
                    placeholderTextColor="#64748B"
                    style={styles.input}
                    autoCapitalize="words"
                    maxLength={120}
                  />

                  <Text style={styles.inputLabel}>Phone number</Text>
                  <TextInput
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    placeholder="Optional"
                    placeholderTextColor="#64748B"
                    style={styles.input}
                    keyboardType="phone-pad"
                    maxLength={30}
                  />

                  <View style={styles.editActions}>
                    <Pressable
                      style={styles.secondaryButton}
                      onPress={cancelEditing}
                      disabled={saving}
                    >
                      <Text style={styles.secondaryButtonText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.primaryButton, saving && styles.disabled]}
                      onPress={() => void saveProfile()}
                      disabled={saving}
                    >
                      {saving ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <>
                          <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                          <Text style={styles.primaryButtonText}>Save changes</Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                </>
              ) : (
                <>
                  <InfoRow
                    icon="person-outline"
                    label="Full name"
                    value={profile?.full_name || 'Not set'}
                  />
                  <InfoRow
                    icon="mail-outline"
                    label="Email"
                    value={profile?.email || 'Not available'}
                  />
                  <InfoRow
                    icon="call-outline"
                    label="Phone number"
                    value={profile?.phone_number || 'Not added'}
                    last
                  />
                </>
              )}
            </View>

            <View style={styles.card}>
              <View style={styles.sectionTitleRow}>
                <View>
                  <Text style={styles.sectionTitle}>Security</Text>
                  <Text style={styles.sectionSubtitle}>
                    Manage how you sign in to FairShare.
                  </Text>
                </View>
              </View>

              <Pressable
                style={styles.actionRow}
                onPress={openPasswordChange}
                disabled={saving || passwordBusy}
              >
                <View style={styles.actionIcon}>
                  <Ionicons name="lock-closed-outline" size={19} color="#0EA5A4" />
                </View>
                <View style={styles.actionCopy}>
                  <Text style={styles.actionTitle}>Change password</Text>
                  <Text style={styles.actionSubtitle}>
                    Verify your current password before updating it.
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#64748B" />
              </Pressable>
            </View>

            <View style={styles.card}>
              <View style={styles.sectionTitleRow}>
                <View>
                  <Text style={styles.sectionTitle}>Session</Text>
                  <Text style={styles.sectionSubtitle}>Sign out from this device.</Text>
                </View>
              </View>

              <Pressable
                style={styles.signOutButton}
                onPress={confirmSignOut}
                disabled={saving || passwordBusy || signingOut}
              >
                {signingOut ? (
                  <ActivityIndicator size="small" color="#FCA5A5" />
                ) : (
                  <Ionicons name="log-out-outline" size={19} color="#FCA5A5" />
                )}
                <Text style={styles.signOutText}>
                  {signingOut ? 'Signing out…' : 'Sign out'}
                </Text>
              </Pressable>
            </View>

            <Text style={styles.footerNote}>
              Your email is managed by your sign-in account. Default currency remains a group setting and is not stored in your profile.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <Modal
        visible={passwordVisible}
        transparent
        animationType="slide"
        onRequestClose={() => !passwordBusy && setPasswordVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.passwordSheet}>
            <View style={styles.modalHeader}>
              <View style={styles.flexOne}>
                <Text style={styles.modalTitle}>Change password</Text>
                <Text style={styles.modalSubtitle}>
                  Enter your current password, then choose a new one with at least 8 characters.
                </Text>
              </View>
              <Pressable
                onPress={() => !passwordBusy && setPasswordVisible(false)}
                hitSlop={10}
              >
                <Ionicons name="close" size={23} color="#FFFFFF" />
              </Pressable>
            </View>

            <Text style={styles.inputLabel}>Current password</Text>
            <TextInput
              value={currentPassword}
              onChangeText={setCurrentPassword}
              style={styles.input}
              placeholder="Current password"
              placeholderTextColor="#64748B"
              secureTextEntry
              autoCapitalize="none"
            />

            <Text style={styles.inputLabel}>New password</Text>
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              style={styles.input}
              placeholder="At least 8 characters"
              placeholderTextColor="#64748B"
              secureTextEntry
              autoCapitalize="none"
            />

            <Text style={styles.inputLabel}>Confirm new password</Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              style={styles.input}
              placeholder="Re-enter new password"
              placeholderTextColor="#64748B"
              secureTextEntry
              autoCapitalize="none"
            />

            <Pressable
              style={[styles.primaryButton, styles.passwordSaveButton, passwordBusy && styles.disabled]}
              onPress={() => void savePassword()}
              disabled={passwordBusy}
            >
              {passwordBusy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="shield-checkmark-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryButtonText}>Update password</Text>
                </>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

function InfoRow({
  icon,
  label,
  value,
  last = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={18} color="#94A3B8" />
      </View>
      <View style={styles.infoCopy}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F172A' },
  container: { flex: 1, backgroundColor: '#0F172A' },
  flexOne: { flex: 1, minWidth: 0 },
  header: {
    minHeight: 78,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#263247',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flex: 1, minWidth: 0, paddingHorizontal: 12 },
  eyebrow: { color: '#0EA5A4', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  headerTitle: { color: '#FFFFFF', fontSize: 19, fontWeight: '900', marginTop: 2 },
  content: { padding: 16, paddingBottom: 46 },
  heroCard: {
    backgroundColor: '#1E293B',
    borderRadius: 22,
    padding: 22,
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#263247',
  },
  avatar: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: '#0EA5A4',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#163A42',
  },
  avatarText: { color: '#FFFFFF', fontSize: 30, fontWeight: '900', letterSpacing: 0.5 },
  heroName: { color: '#FFFFFF', fontSize: 24, fontWeight: '900', marginTop: 13, textAlign: 'center' },
  heroEmail: { color: '#94A3B8', fontSize: 12, marginTop: 5, textAlign: 'center' },
  memberSinceBadge: {
    marginTop: 13,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 11,
    backgroundColor: '#0F172A',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#263247',
  },
  memberSinceText: { color: '#CBD5E1', fontSize: 10, fontWeight: '800' },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 17,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#263247',
  },
  sectionTitleRow: { marginBottom: 10 },
  sectionTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  sectionSubtitle: { color: '#64748B', fontSize: 11, lineHeight: 16, marginTop: 4 },
  inputLabel: { color: '#CBD5E1', fontSize: 10, fontWeight: '900', marginTop: 12, marginBottom: 7 },
  input: {
    backgroundColor: '#0F172A',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#2A3A50',
    color: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 13,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13 },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: '#243147' },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  infoCopy: { flex: 1, minWidth: 0 },
  infoLabel: { color: '#64748B', fontSize: 9, fontWeight: '800' },
  infoValue: { color: '#F8FAFC', fontSize: 13, fontWeight: '800', marginTop: 4 },
  editActions: { flexDirection: 'row', gap: 9, marginTop: 16 },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: { color: '#CBD5E1', fontSize: 12, fontWeight: '900' },
  primaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 13,
    backgroundColor: '#0EA5A4',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 14,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  disabled: { opacity: 0.65 },
  actionRow: { flexDirection: 'row', alignItems: 'center', minHeight: 66, paddingVertical: 8 },
  actionIcon: {
    width: 39,
    height: 39,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  actionCopy: { flex: 1, minWidth: 0 },
  actionTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  actionSubtitle: { color: '#64748B', fontSize: 10, marginTop: 4, lineHeight: 15 },
  signOutButton: {
    minHeight: 48,
    borderRadius: 13,
    backgroundColor: '#201A1F',
    borderWidth: 1,
    borderColor: '#3D252C',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  signOutText: { color: '#FCA5A5', fontSize: 12, fontWeight: '900' },
  footerNote: { color: '#64748B', fontSize: 9, lineHeight: 15, textAlign: 'center', paddingHorizontal: 7, marginTop: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(2,6,23,0.72)', justifyContent: 'flex-end' },
  passwordSheet: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#263247',
  },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  modalTitle: { color: '#FFFFFF', fontSize: 19, fontWeight: '900' },
  modalSubtitle: { color: '#64748B', fontSize: 10, lineHeight: 16, marginTop: 4, paddingRight: 10 },
  passwordSaveButton: { flex: 0, marginTop: 18 },
});
