import React from 'react';
import {
  Modal,
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
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Filter by Who Paid</Text>
              <Text style={styles.subtitle}>Select a member to view their paid expenses</Text>
            </View>
            <Pressable hitSlop={8} onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={20} color="#94A3B8" />
            </Pressable>
          </View>

          <ScrollView style={styles.memberList} showsVerticalScrollIndicator={false}>
            {/* Option: All Group */}
            <Pressable
              style={[styles.memberRow, selectedMemberId === null && styles.memberRowSelected]}
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
                  style={[styles.memberRow, isSelected && styles.memberRowSelected]}
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
        </Pressable>
      </Pressable>
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
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
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
    padding: 4,
  },
  memberList: {
    maxHeight: 360,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  memberRowSelected: {
    borderColor: '#0EA5A4',
    backgroundColor: 'rgba(14, 165, 164, 0.08)',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
  },
  memberEmail: {
    color: '#64748B',
    fontSize: 12,
  },
});
