import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { shareGroupInvite } from '../utils/shareInvite';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';

type Props = {
  visible: boolean;
  onClose: () => void;
  onAdd: (email: string) => Promise<void>;
  groupId?: string;
  groupName?: string;
};

export default function AddMemberModal({
  visible,
  onClose,
  onAdd,
  groupId,
  groupName,
}: Props) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const cleanEmail = email
      .trim()
      .toLowerCase();

    if (!cleanEmail) {
      return Alert.alert(
        'Missing email',
        'Enter the member’s email address.'
      );
    }

    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      return Alert.alert(
        'Invalid email',
        'Please enter a valid email address.'
      );
    }

    try {
      setLoading(true);
      await onAdd(cleanEmail);
      setEmail('');
      onClose();
    } catch (error: any) {
      Alert.alert(
        'Unable to add member',
        error?.message || 'Something went wrong.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <Text style={styles.title}>
            Add Member
          </Text>

          <Text style={styles.subtitle}>
            Enter their email. Existing FairShare users
            are added directly; new users receive an
            invitation to join the group.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Member email"
            placeholderTextColor="#64748B"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
          />

          <Pressable
            style={[
              styles.addButton,
              loading && styles.disabled,
            ]}
            onPress={submit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.addButtonText}>
                Add Member
              </Text>
            )}
          </Pressable>

          {groupId ? (
            <>
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.dividerLine} />
              </View>

              <Pressable
                style={styles.shareButton}
                onPress={() => {
                  void shareGroupInvite(groupId, groupName || 'Group');
                }}
                disabled={loading}
              >
                <Ionicons name="link-outline" size={19} color="#0EA5A4" style={{ marginRight: 8 }} />
                <Text style={styles.shareButtonText}>Share Group Invite Link</Text>
              </Pressable>
            </>
          ) : null}

          <Pressable
            style={styles.cancelButton}
            onPress={onClose}
            disabled={loading}
          >
            <Text style={styles.cancelText}>
              Cancel
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.62)',
    justifyContent: 'flex-end',
  },

  sheet: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 28,
  },

  handle: {
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#334155',
    alignSelf: 'center',
    marginBottom: 20,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '700',
  },

  subtitle: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 7,
    marginBottom: 20,
  },

  input: {
    backgroundColor: '#1E293B',
    color: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    marginBottom: 16,
  },

  addButton: {
    backgroundColor: '#0EA5A4',
    borderRadius: 14,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },

  disabled: {
    opacity: 0.7,
  },

  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  cancelButton: {
    alignItems: 'center',
    paddingVertical: 16,
  },

  cancelText: {
    color: '#94A3B8',
    fontSize: 15,
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
    fontSize: 12,
    fontWeight: '700',
    marginHorizontal: 12,
  },

  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#0EA5A4',
    borderRadius: 14,
    minHeight: 50,
    backgroundColor: 'rgba(14, 165, 164, 0.08)',
  },

  shareButtonText: {
    color: '#0EA5A4',
    fontSize: 15,
    fontWeight: '700',
  },
});
