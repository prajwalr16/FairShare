import React, { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { shareGroupInvite } from '../utils/shareInvite';
import { parseBulkMemberNames } from '../utils/memberOnboarding';
import { formatAuthError } from '../utils/authErrors';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';

type Props = {
  visible: boolean;
  onClose: () => void;
  onAdd: (email: string) => Promise<void>;
  onBatchAdd?: (names: string[]) => Promise<void>;
  groupId?: string;
  groupName?: string;
};

export default function AddMemberModal({
  visible,
  onClose,
  onAdd,
  onBatchAdd,
  groupId,
  groupName,
}: Props) {
  const [tab, setTab] = useState<'names' | 'email'>('names');
  const [namesText, setNamesText] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const parsedNames = useMemo(() => parseBulkMemberNames(namesText), [namesText]);

  const handleClose = () => {
    setErrorMessage(null);
    onClose();
  };

  const handleTabChange = (nextTab: 'names' | 'email') => {
    setTab(nextTab);
    setErrorMessage(null);
  };

  const submitNames = async () => {
    if (parsedNames.length === 0) {
      setErrorMessage('Please enter at least one member name (e.g. Rahul, Sneha, Rohan).');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);
      if (onBatchAdd) {
        await onBatchAdd(parsedNames);
      } else {
        // Fallback: batchAddMembers directly
        const { batchAddMembers } = await import('../services/memberService');
        if (groupId) {
          const res = await batchAddMembers(groupId, parsedNames);
          if (res.error) throw res.error;
        }
      }
      setNamesText('');
      handleClose();
    } catch (error: any) {
      setErrorMessage(error?.message || 'Something went wrong while adding members. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const submitEmail = async () => {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setErrorMessage('Please enter the member’s email address.');
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setErrorMessage('Please enter a valid email address (e.g. name@example.com).');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);
      await onAdd(cleanEmail);
      setEmail('');
      handleClose();
    } catch (error: any) {
      const formatted = formatAuthError(error);
      const detail = formatted.actionHint
        ? `${formatted.message} ${formatted.actionHint}`
        : formatted.message;
      setErrorMessage(detail || error?.message || 'Something went wrong while inviting this member.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <Text style={styles.title}>Add Members</Text>

          {!!errorMessage && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={17} color="#EF4444" />
              <Text style={styles.errorBannerText}>{errorMessage}</Text>
            </View>
          )}

          {/* Mode Switcher Tabs */}
          <View style={styles.tabContainer}>
            <Pressable
              style={[styles.tabButton, tab === 'names' && styles.tabButtonActive]}
              onPress={() => handleTabChange('names')}
            >
              <Ionicons
                name="people"
                size={16}
                color={tab === 'names' ? '#00E5FF' : '#94A3B8'}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.tabText, tab === 'names' && styles.tabTextActive]}>
                Quick Add (Names)
              </Text>
            </Pressable>

            <Pressable
              style={[styles.tabButton, tab === 'email' && styles.tabButtonActive]}
              onPress={() => handleTabChange('email')}
            >
              <Ionicons
                name="mail-outline"
                size={16}
                color={tab === 'email' ? '#00E5FF' : '#94A3B8'}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.tabText, tab === 'email' && styles.tabTextActive]}>
                Email Invite
              </Text>
            </Pressable>
          </View>

          {tab === 'names' ? (
            <View>
              <Text style={styles.subtitle}>
                Add travel buddies instantly with just their name. No email required — split expenses right away!
              </Text>

              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="e.g. Rahul, Sneha, Rohan, Amit"
                placeholderTextColor="#64748B"
                autoCapitalize="words"
                autoCorrect={false}
                multiline
                numberOfLines={2}
                value={namesText}
                onChangeText={(text) => {
                  setNamesText(text);
                  if (errorMessage) setErrorMessage(null);
                }}
              />

              {parsedNames.length > 0 ? (
                <View style={styles.previewContainer}>
                  <Text style={styles.previewLabel}>
                    DETECTED MEMBERS ({parsedNames.length}):
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipsRow}
                  >
                    {parsedNames.map((name, idx) => (
                      <View key={idx} style={styles.nameChip}>
                        <Ionicons name="person" size={12} color="#00E5FF" style={{ marginRight: 5 }} />
                        <Text style={styles.nameChipText}>{name}</Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              ) : null}

              <Pressable
                style={[styles.addButton, loading && styles.disabled]}
                onPress={submitNames}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.addButtonText}>
                    {parsedNames.length > 1
                      ? `Add ${parsedNames.length} Members`
                      : 'Add Member'}
                  </Text>
                )}
              </Pressable>
            </View>
          ) : (
            <View>
              <Text style={styles.subtitle}>
                Send an invitation email. Existing users join automatically; new users receive an invite link.
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Member email"
                placeholderTextColor="#64748B"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (errorMessage) setErrorMessage(null);
                }}
              />

              <Pressable
                style={[styles.addButton, loading && styles.disabled]}
                onPress={submitEmail}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.addButtonText}>Send Invitation</Text>
                )}
              </Pressable>
            </View>
          )}

          {groupId ? (
            <>
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR SHARE LINK</Text>
                <View style={styles.dividerLine} />
              </View>

              <Pressable
                style={styles.shareButton}
                onPress={() => {
                  void shareGroupInvite(groupId, groupName || 'Group');
                }}
                disabled={loading}
              >
                <Ionicons name="link-outline" size={19} color="#00E5FF" style={{ marginRight: 8 }} />
                <Text style={styles.shareButtonText}>Share Group Invite Link</Text>
              </Pressable>
            </>
          ) : null}

          <Pressable style={styles.cancelButton} onPress={handleClose} disabled={loading}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },

  sheet: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 28,
    borderWidth: 1,
    borderColor: '#1E293B',
  },

  handle: {
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#334155',
    alignSelf: 'center',
    marginBottom: 16,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.3,
  },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 12,
    marginBottom: 4,
  },

  errorBannerText: {
    flex: 1,
    color: '#FCA5A5',
    fontSize: 12.5,
    fontWeight: '600',
    lineHeight: 18,
  },

  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#06090F',
    borderRadius: 12,
    padding: 4,
    marginTop: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
  },

  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 9,
  },

  tabButtonActive: {
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
  },

  tabText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },

  tabTextActive: {
    color: '#00E5FF',
    fontWeight: '700',
  },

  subtitle: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },

  input: {
    backgroundColor: '#1E293B',
    color: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },

  textArea: {
    minHeight: 64,
    textAlignVertical: 'top',
  },

  previewContainer: {
    marginBottom: 14,
  },

  previewLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
  },

  chipsRow: {
    flexDirection: 'row',
    gap: 8,
  },

  nameChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderColor: 'rgba(0, 229, 255, 0.25)',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },

  nameChipText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
  },

  addButton: {
    backgroundColor: '#00E5FF',
    borderRadius: 14,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },

  disabled: {
    opacity: 0.6,
  },

  addButtonText: {
    color: '#06090F',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  cancelButton: {
    alignItems: 'center',
    paddingVertical: 14,
  },

  cancelText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
  },

  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#334155',
  },

  dividerText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginHorizontal: 12,
  },

  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.35)',
    borderRadius: 14,
    minHeight: 48,
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
  },

  shareButtonText: {
    color: '#00E5FF',
    fontSize: 14,
    fontWeight: '700',
  },
});
