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
import { ChecklistItem } from '../services/checklistService';
import { GroupMember } from '../services/memberService';
import { hapticSelection, hapticSuccess } from '../utils/haptics';

type Props = {
  visible: boolean;
  item: ChecklistItem | null;
  members: GroupMember[];
  currentUserId: string | null;
  onClose: () => void;
  onAssign: (itemId: string, memberId: string | null) => Promise<void>;
};

export default function AssignMemberModal({
  visible,
  item,
  members,
  currentUserId,
  onClose,
  onAssign,
}: Props) {
  if (!item) return null;

  const handleSelect = async (memberId: string | null) => {
    void hapticSuccess();
    await onAssign(item.id, memberId);
    onClose();
  };

  const displayName = (m: GroupMember) => m.full_name?.trim() || m.email || 'Member';

  const isAssignedToMe = item.assigned_to === currentUserId;

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.dismissArea} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Who is bringing this?</Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {item.title}
              </Text>
            </View>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color="#94A3B8" />
            </Pressable>
          </View>

          {/* Quick Actions */}
          <View style={styles.quickActions}>
            <Pressable
              style={[styles.quickBtn, isAssignedToMe && styles.quickBtnActive]}
              onPress={() => handleSelect(currentUserId)}
            >
              <Ionicons
                name="hand-right"
                size={14}
                color={isAssignedToMe ? '#06090F' : '#00E5FF'}
              />
              <Text style={[styles.quickBtnText, isAssignedToMe && styles.quickBtnTextActive]}>
                {isAssignedToMe ? 'Brought by You ✓' : "I'll bring this"}
              </Text>
            </Pressable>

            <Pressable
              style={[styles.unassignBtn, !item.assigned_to && styles.unassignBtnActive]}
              onPress={() => handleSelect(null)}
            >
              <Ionicons
                name="close-circle-outline"
                size={14}
                color={!item.assigned_to ? '#06090F' : '#FF4B72'}
              />
              <Text style={[styles.unassignBtnText, !item.assigned_to && styles.unassignBtnTextActive]}>
                Unassigned / Anyone
              </Text>
            </Pressable>
          </View>

          <Text style={styles.sectionLabel}>ASSIGN TO A GROUP MEMBER</Text>

          {/* Member List */}
          <ScrollView style={styles.memberList} showsVerticalScrollIndicator={false}>
            {members.map((member) => {
              const uid = member.user_id;
              if (!uid) return null;
              const isSelected = item.assigned_to === uid;
              const isMe = uid === currentUserId;
              const name = isMe ? `${displayName(member)} (You)` : displayName(member);

              return (
                <Pressable
                  key={member.id}
                  style={[styles.memberRow, isSelected && styles.memberRowSelected]}
                  onPress={() => handleSelect(uid)}
                >
                  <View style={[styles.avatar, isSelected && styles.avatarSelected]}>
                    <Text style={[styles.avatarText, isSelected && styles.avatarTextSelected]}>
                      {name.slice(0, 2).toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.memberInfo}>
                    <Text style={[styles.memberName, isSelected && styles.memberNameSelected]}>
                      {name}
                    </Text>
                    {member.email ? (
                      <Text style={styles.memberEmail} numberOfLines={1}>
                        {member.email}
                      </Text>
                    ) : null}
                  </View>

                  {isSelected ? (
                    <View style={styles.selectedPill}>
                      <Ionicons name="checkmark" size={13} color="#06090F" />
                      <Text style={styles.selectedPillText}>Assigned</Text>
                    </View>
                  ) : (
                    <Ionicons name="chevron-forward" size={16} color="#475569" />
                  )}
                </Pressable>
              );
            })}
            <View style={{ height: 24 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  dismissArea: { flex: 1 },
  sheet: {
    backgroundColor: '#0E1524',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    maxHeight: '75%',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#334155',
    alignSelf: 'center',
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  subtitle: { color: '#00E5FF', fontSize: 13, fontWeight: '700', marginTop: 2 },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#1E293B',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  quickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    borderRadius: 12,
    paddingVertical: 10,
  },
  quickBtnActive: {
    backgroundColor: '#00E5FF',
    borderColor: '#00E5FF',
  },
  quickBtnText: { color: '#00E5FF', fontSize: 12.5, fontWeight: '800' },
  quickBtnTextActive: { color: '#06090F' },
  unassignBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 75, 114, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 75, 114, 0.25)',
    borderRadius: 12,
    paddingVertical: 10,
  },
  unassignBtnActive: {
    backgroundColor: '#FF4B72',
    borderColor: '#FF4B72',
  },
  unassignBtnText: { color: '#FF4B72', fontSize: 12.5, fontWeight: '800' },
  unassignBtnTextActive: { color: '#FFFFFF' },
  sectionLabel: {
    color: '#64748B',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  memberList: {
    maxHeight: 280,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161F30',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#243247',
  },
  memberRowSelected: {
    borderColor: '#00E5FF',
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  avatarSelected: {
    backgroundColor: '#00E5FF',
    borderColor: '#00E5FF',
  },
  avatarText: { color: '#00E5FF', fontSize: 12, fontWeight: '900' },
  avatarTextSelected: { color: '#06090F' },
  memberInfo: { flex: 1 },
  memberName: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '700' },
  memberNameSelected: { color: '#00E5FF' },
  memberEmail: { color: '#64748B', fontSize: 11, fontWeight: '500', marginTop: 1 },
  selectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#00E5FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  selectedPillText: { color: '#06090F', fontSize: 11, fontWeight: '800' },
});
