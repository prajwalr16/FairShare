import React from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GroupMember } from '../services/memberService';

export interface PaidByPickerModalProps {
  visible: boolean;
  onClose: () => void;
  members: GroupMember[];
  currentUserId?: string | null;
  selectedMemberId?: string | null;
  onSelectMember: (memberId: string | null) => void;
}

export default function PaidByPickerModal({
  visible,
  onClose,
  members,
  currentUserId,
  selectedMemberId,
  onSelectMember,
}: PaidByPickerModalProps) {
  const handleSelect = (id: string | null) => {
    onSelectMember(id);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        {/* Transparent backdrop touch area to close modal */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Close picker"
        />

        {/* Modal card container */}
        <View style={styles.modalCard}>
          <View style={styles.header}>
            <View style={styles.headerTitles}>
              <Text style={styles.title}>Filter by Who Paid</Text>
              <Text style={styles.subtitle}>Select a member to view their paid expenses</Text>
            </View>
            <Pressable
              hitSlop={12}
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeButton,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Ionicons name="close" size={22} color="#94A3B8" />
            </Pressable>
          </View>

          <ScrollView style={styles.memberList} showsVerticalScrollIndicator={false}>
            {/* Option: All Group */}
            <Pressable
              style={({ pressed }) => [
                styles.memberRow,
                selectedMemberId === null && styles.memberRowSelected,
                pressed && styles.memberRowPressed,
              ]}
              onPress={() => handleSelect(null)}
            >
              <View style={[styles.avatar, styles.allAvatar]}>
                <Ionicons name="people" size={16} color="#FFFFFF" />
              </View>
              <View style={styles.memberInfo}>
                <Text style={[styles.memberName, selectedMemberId === null && styles.nameSelected]}>
                  All Group
                </Text>
                <Text style={styles.memberEmail}>Show expenses paid by anyone</Text>
              </View>
              {selectedMemberId === null && (
                <Ionicons name="checkmark-circle" size={20} color="#0EA5A4" />
              )}
            </Pressable>

            {/* Members List */}
            {members.map((member) => {
              if (!member.user_id) return null;
              const isMe = currentUserId && member.user_id === currentUserId;
              const isSelected = selectedMemberId === member.user_id;
              const displayName = member.full_name?.trim() || member.email?.trim() || 'Member';
              const initial = displayName.charAt(0).toUpperCase();

              return (
                <Pressable
                  key={member.user_id}
                  style={({ pressed }) => [
                    styles.memberRow,
                    isSelected && styles.memberRowSelected,
                    pressed && styles.memberRowPressed,
                  ]}
                  onPress={() => handleSelect(member.user_id)}
                >
                  <View style={[styles.avatar, isMe && styles.meAvatar]}>
                    <Text style={styles.avatarText}>{initial}</Text>
                  </View>
                  <View style={styles.memberInfo}>
                    <Text style={[styles.memberName, isSelected && styles.nameSelected]}>
                      {displayName} {isMe ? '(You)' : ''}
                    </Text>
                    {member.email ? (
                      <Text style={styles.memberEmail} numberOfLines={1}>
                        {member.email}
                      </Text>
                    ) : null}
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={20} color="#0EA5A4" />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '80%',
    backgroundColor: '#1E293B',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
    zIndex: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerTitles: {
    flex: 1,
    paddingRight: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#94A3B8',
  },
  closeButton: {
    padding: 6,
  },
  memberList: {
    maxHeight: 360,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  memberRowPressed: {
    opacity: 0.8,
    backgroundColor: '#162235',
  },
  memberRowSelected: {
    borderColor: '#0EA5A4',
    backgroundColor: 'rgba(14, 165, 164, 0.12)',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  allAvatar: {
    backgroundColor: '#0EA5A4',
  },
  meAvatar: {
    backgroundColor: '#2563EB',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  nameSelected: {
    color: '#0EA5A4',
    fontWeight: '700',
  },
  memberEmail: {
    color: '#64748B',
    fontSize: 12,
  },
});
