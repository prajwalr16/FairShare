import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';

import {
  deleteGroup,
  getGroupSettings,
  leaveGroup,
  updateGroupSettings,
  getGroupMemberRoles,
  updateGroupMemberRole,
  GroupSettings,
  GroupMemberRole,
  GroupRole,
} from '../../services/groupService';

const GROUP_TYPES = ['Trip', 'Home', 'Friends', 'Office', 'Other'];
const CURRENCIES = [
  { code: 'INR', name: 'Indian Rupee' },
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British Pound' },
  { code: 'AED', name: 'UAE Dirham' },
  { code: 'SGD', name: 'Singapore Dollar' },
];

type PickerType = 'type' | 'currency' | null;

function PermissionLegend({
  role,
  title,
  text,
}: {
  role: GroupRole;
  title: string;
  text: string;
}) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, role === 'admin' ? styles.adminDot : role === 'viewer' ? styles.viewerDot : styles.memberDot]} />
      <View style={styles.legendTextWrap}>
        <Text style={styles.legendTitle}>{title}</Text>
        <Text style={styles.legendText}>{text}</Text>
      </View>
    </View>
  );
}

export default function GroupSettingsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const groupId = route.params?.groupId as string | undefined;

  const [group, setGroup] = useState<GroupSettings | null>(null);
  const [name, setName] = useState('');
  const [type, setType] = useState('Trip');
  const [currency, setCurrency] = useState('INR');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dangerLoading, setDangerLoading] = useState(false);
  const isOwner = group?.is_owner === true;
  const [picker, setPicker] = useState<PickerType>(null);
  const [roleMembers, setRoleMembers] = useState<GroupMemberRole[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [roleUpdatingUserId, setRoleUpdatingUserId] = useState<string | null>(null);
  const [selectedRoleMember, setSelectedRoleMember] = useState<GroupMemberRole | null>(null);
  const [rolePickerVisible, setRolePickerVisible] = useState(false);

  const ROLE_OPTIONS: Array<{
    role: GroupRole;
    title: string;
    description: string;
  }> = [
    {
      role: 'admin',
      title: 'Admin',
      description: 'Can manage members and group money. Cannot edit group settings, assign roles, or delete the group.',
    },
    {
      role: 'member',
      title: 'Member',
      description: 'Can add and manage group expenses and settlements. Cannot manage members or group settings.',
    },
    {
      role: 'viewer',
      title: 'Viewer',
      description: 'Can view expenses, balances and history. Cannot add, edit or delete money records.',
    },
  ];

  const loadSettings = useCallback(async () => {
    if (!groupId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setRolesLoading(true);

    const [{ data, error }, roleResult] = await Promise.all([
      getGroupSettings(groupId),
      getGroupMemberRoles(groupId),
    ]);

    if (error || !data) {
      Alert.alert(
        'Unable to load group settings',
        error?.message || 'The group could not be loaded.'
      );
      setLoading(false);
      setRolesLoading(false);
      return;
    }

    setGroup(data);
    setName(data.name || '');
    setType(data.type || 'Other');
    setCurrency(data.currency || 'INR');
    setDescription(data.description || '');

    if (roleResult.error) {
      console.log('Unable to load member roles:', roleResult.error.message);
      setRoleMembers([]);
    } else {
      setRoleMembers(roleResult.data || []);
    }

    setLoading(false);
    setRolesLoading(false);
  }, [groupId]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async () => {
    if (!groupId || !isOwner) return;

    const normalizedName = name.trim();
    const normalizedDescription = description.trim();

    if (!normalizedName) {
      Alert.alert('Group name required', 'Enter a name for the group.');
      return;
    }

    if (normalizedName.length > 80) {
      Alert.alert('Group name too long', 'Keep the group name within 80 characters.');
      return;
    }

    if (normalizedDescription.length > 500) {
      Alert.alert('Description too long', 'Keep the description within 500 characters.');
      return;
    }

    setSaving(true);
    const { data, error } = await updateGroupSettings({
      groupId,
      name: normalizedName,
      type,
      currency,
      description: normalizedDescription,
    });
    setSaving(false);

    if (error) {
      Alert.alert('Unable to save changes', error.message);
      return;
    }

    setGroup(data || null);
    Alert.alert('Group updated', 'Your group settings were saved.', [
      {
        text: 'Done',
        onPress: () =>
          navigation.reset({
            index: 1,
            routes: [
              { name: 'Home' },
              {
                name: 'GroupDetails',
                params: {
                  groupId,
                  groupName: normalizedName,
                },
              },
            ],
          }),
      },
    ]);
  };

  const handleLeaveGroup = () => {
    if (!groupId || !group) return;

    Alert.alert(
      'Leave group?',
      'You can leave only when your balance in this group is settled. The group owner cannot leave the group.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            setDangerLoading(true);
            const { error } = await leaveGroup(groupId);
            setDangerLoading(false);

            if (error) {
              Alert.alert('Unable to leave group', error.message);
              return;
            }

            navigation.reset({
              index: 0,
              routes: [{ name: 'Home' }],
            });
          },
        },
      ]
    );
  };

  const handleDeleteGroup = () => {
    if (!groupId || !group) return;

    Alert.alert(
      'Delete group?',
      `This permanently deletes ${group.name || 'this group'}, including its expenses, splits, settlements and memberships. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDangerLoading(true);
            const { error } = await deleteGroup(groupId);
            setDangerLoading(false);

            if (error) {
              Alert.alert('Unable to delete group', error.message);
              return;
            }

            navigation.reset({
              index: 0,
              routes: [{ name: 'Home' }],
            });
          },
        },
      ]
    );
  };

  const openRolePicker = (member: GroupMemberRole) => {
    if (!isOwner || !member.user_id || member.status !== 'active') return;
    if (member.role === 'owner') return;
    setSelectedRoleMember(member);
    setRolePickerVisible(true);
  };

  const handleRoleChange = async (role: GroupRole) => {
    if (!groupId || !selectedRoleMember?.user_id || !isOwner) return;

    setRoleUpdatingUserId(selectedRoleMember.user_id);
    const { data, error } = await updateGroupMemberRole({
      groupId,
      userId: selectedRoleMember.user_id,
      role,
    });
    setRoleUpdatingUserId(null);

    if (error) {
      Alert.alert('Unable to update role', error.message);
      return;
    }

    setRoleMembers((previous) =>
      previous.map((member) =>
        member.user_id === selectedRoleMember.user_id
          ? { ...member, ...data, role }
          : member
      )
    );
    setSelectedRoleMember(null);
    setRolePickerVisible(false);
  };

  const selectedRoleOption = ROLE_OPTIONS.find(
    (option) => option.role === selectedRoleMember?.role
  );

  const selectedCurrency = CURRENCIES.find((item) => item.code === currency);

  const pickerTitle = picker === 'type' ? 'Group type' : 'Base currency';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            hitSlop={10}
          >
            <Ionicons name="arrow-back" size={23} color="#FFFFFF" />
          </Pressable>

          <View style={styles.headerTextContainer}>
            <Text style={styles.title}>Group Settings</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {group?.name || 'Group'}
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#0EA5A4" />
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Group details</Text>
              <Text style={styles.sectionSubtitle}>
                Update the information members see for this group.
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>Group name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                editable={isOwner}
                placeholder="Group name"
                placeholderTextColor="#64748B"
                maxLength={80}
                style={styles.input}
                autoCapitalize="sentences"
              />

              <Text style={styles.label}>Group type</Text>
              <Pressable
                style={[styles.selector, !isOwner && styles.disabledSelector]}
                onPress={() => isOwner && setPicker('type')}
                disabled={!isOwner}
              >
                <View style={styles.selectorTextWrap}>
                  <Text style={styles.selectorValue}>{type}</Text>
                  <Text style={styles.selectorHint}>Choose how this group is categorized</Text>
                </View>
                <Ionicons name="chevron-down" size={18} color="#94A3B8" />
              </Pressable>

              <Text style={styles.label}>Base currency</Text>
              <Pressable
                style={[styles.selector, !isOwner && styles.disabledSelector]}
                onPress={() => isOwner && setPicker('currency')}
                disabled={!isOwner}
              >
                <View style={styles.selectorTextWrap}>
                  <Text style={styles.selectorValue}>
                    {currency} · {selectedCurrency?.name || 'Currency'}
                  </Text>
                  <Text style={styles.selectorHint}>
                    Used for this group's primary amounts
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={18} color="#94A3B8" />
              </Pressable>

              <Text style={styles.label}>Description</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                editable={isOwner}
                placeholder="Optional description"
                placeholderTextColor="#64748B"
                maxLength={500}
                style={[styles.input, styles.multilineInput]}
                multiline
                textAlignVertical="top"
              />

              {isOwner ? (
                <Pressable
                  style={({ pressed }) => [styles.saveButton, pressed && styles.buttonPressed]}
                  onPress={handleSave}
                  disabled={saving}
                >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={19} color="#FFFFFF" />
                    <Text style={styles.saveButtonText}>Save Changes</Text>
                  </>
                )}
                </Pressable>
              ) : (
                <View style={styles.ownerOnlyNote}>
                  <Ionicons name="lock-closed-outline" size={16} color="#64748B" />
                  <Text style={styles.ownerOnlyNoteText}>Only the group owner can edit these settings.</Text>
                </View>
              )}
            </View>

            <View style={styles.sectionRoleHeader}>
              <View style={styles.sectionRoleHeaderText}>
                <Text style={styles.sectionTitle}>Member permissions</Text>
                <Text style={styles.sectionSubtitle}>
                  Choose what each active member can do in this group.
                </Text>
              </View>
            </View>

            <View style={styles.rolesCard}>
              {isOwner ? (
                <>
                  <View style={styles.permissionLegend}>
                    <PermissionLegend role="admin" title="Admin" text="Manage members and money" />
                    <PermissionLegend role="member" title="Member" text="Manage group expenses and settlements" />
                    <PermissionLegend role="viewer" title="Viewer" text="View only" />
                  </View>

                  {rolesLoading ? (
                    <View style={styles.roleLoadingRow}>
                      <ActivityIndicator size="small" color="#0EA5A4" />
                    </View>
                  ) : roleMembers.length ? (
                    roleMembers.map((member) => {
                      const isMemberOwner = member.role === 'owner';
                      const displayName = member.full_name?.trim() || member.email || 'Member';
                      const roleLabel = isMemberOwner
                        ? 'Owner'
                        : member.role === 'admin'
                          ? 'Admin'
                          : member.role === 'viewer'
                            ? 'Viewer'
                            : 'Member';

                      return (
                        <View key={member.id} style={styles.roleMemberRow}>
                          <View style={styles.roleMemberAvatar}>
                            <Text style={styles.roleMemberAvatarText}>
                              {displayName.charAt(0).toUpperCase()}
                            </Text>
                          </View>

                          <View style={styles.roleMemberInfo}>
                            <Text style={styles.roleMemberName} numberOfLines={1}>
                              {displayName}
                            </Text>
                            <Text style={styles.roleMemberEmail} numberOfLines={1}>
                              {member.email || ''}
                            </Text>
                          </View>

                          {isMemberOwner ? (
                            <View style={styles.ownerRoleBadge}>
                              <Text style={styles.ownerRoleText}>Owner</Text>
                            </View>
                          ) : member.status === 'pending' ? (
                            <View style={styles.pendingRoleBadge}>
                              <Text style={styles.pendingRoleText}>Pending</Text>
                            </View>
                          ) : (
                            <Pressable
                              style={styles.roleSelectorButton}
                              onPress={() => openRolePicker(member)}
                              disabled={roleUpdatingUserId === member.user_id}
                            >
                              {roleUpdatingUserId === member.user_id ? (
                                <ActivityIndicator size="small" color="#0EA5A4" />
                              ) : (
                                <>
                                  <Text style={styles.roleSelectorText}>{roleLabel}</Text>
                                  <Ionicons name="chevron-down" size={16} color="#94A3B8" />
                                </>
                              )}
                            </Pressable>
                          )}
                        </View>
                      );
                    })
                  ) : (
                    <Text style={styles.noRolesText}>No members found.</Text>
                  )}

                  <Text style={styles.roleNote}>
                    The owner always has full access. Admins cannot assign roles or delete the group.
                  </Text>
                </>
              ) : (
                <View>
                  <Text style={styles.currentRoleTitle}>
                    Your role: {group?.role === 'admin' ? 'Admin' : group?.role === 'viewer' ? 'Viewer' : 'Member'}
                  </Text>
                  <Text style={styles.currentRoleText}>
                    {group?.role === 'admin'
                      ? 'You can manage members and group money, but you cannot edit group settings or assign roles.'
                      : group?.role === 'viewer'
                        ? 'You can view group information, expenses, balances and history, but cannot change money records.'
                        : 'You can add and manage expenses and settlements, but cannot manage members or group settings.'}
                  </Text>
                </View>
              )}
            </View>

            <View style={[styles.section, styles.dangerSection]}>
              <Text style={styles.sectionTitle}>Danger zone</Text>
              <Text style={styles.sectionSubtitle}>
                These actions affect your membership or permanently remove the group.
              </Text>
            </View>

            <View style={styles.dangerCard}>
              {group?.is_owner ? (
                <>
                  <Text style={styles.dangerTitle}>Delete group</Text>
                  <Text style={styles.dangerText}>
                    Permanently remove the group and all of its recorded data.
                  </Text>

                  <Pressable
                    style={({ pressed }) => [
                      styles.deleteButton,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={handleDeleteGroup}
                    disabled={dangerLoading}
                  >
                    {dangerLoading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
                        <Text style={styles.deleteButtonText}>Delete Group</Text>
                      </>
                    )}
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.dangerTitle}>Leave group</Text>
                  <Text style={styles.dangerText}>
                    You must have a settled balance before leaving. The group remains for everyone else.
                  </Text>

                  <Pressable
                    style={({ pressed }) => [
                      styles.deleteButton,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={handleLeaveGroup}
                    disabled={dangerLoading}
                  >
                    {dangerLoading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons name="exit-outline" size={18} color="#FFFFFF" />
                        <Text style={styles.deleteButtonText}>Leave Group</Text>
                      </>
                    )}
                  </Pressable>
                </>
              )}
            </View>
          </ScrollView>
        )}

        <Modal
          visible={rolePickerVisible}
          transparent
          animationType="fade"
          onRequestClose={() => {
            if (!roleUpdatingUserId) {
              setRolePickerVisible(false);
              setSelectedRoleMember(null);
            }
          }}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => {
              if (!roleUpdatingUserId) {
                setRolePickerVisible(false);
                setSelectedRoleMember(null);
              }
            }}
          >
            <Pressable style={styles.pickerCard} onPress={() => undefined}>
              <View style={styles.modalHandle} />
              <Text style={styles.pickerTitle}>
                {selectedRoleMember?.full_name?.trim() || selectedRoleMember?.email || 'Member'}
              </Text>
              <Text style={styles.roleModalSubtitle}>
                {selectedRoleOption?.description || 'Choose this member’s access level.'}
              </Text>

              <ScrollView
                style={styles.pickerList}
                contentContainerStyle={styles.pickerListContent}
                showsVerticalScrollIndicator={false}
              >
                {ROLE_OPTIONS.map((option) => (
                  <Pressable
                    key={option.role}
                    style={styles.roleOptionCard}
                    onPress={() => handleRoleChange(option.role)}
                    disabled={!!roleUpdatingUserId}
                  >
                    <View style={styles.roleOptionTextWrap}>
                      <Text style={styles.roleOptionTitle}>{option.title}</Text>
                      <Text style={styles.roleOptionDescription}>
                        {option.description}
                      </Text>
                    </View>
                    {selectedRoleMember?.role === option.role ? (
                      <Ionicons name="checkmark-circle" size={21} color="#0EA5A4" />
                    ) : null}
                  </Pressable>
                ))}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>

        <Modal
          visible={picker !== null}
          transparent
          animationType="fade"
          onRequestClose={() => setPicker(null)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setPicker(null)}>
            <Pressable style={styles.pickerCard} onPress={() => undefined}>
              <View style={styles.modalHandle} />
              <Text style={styles.pickerTitle}>{pickerTitle}</Text>

              <ScrollView
                style={styles.pickerList}
                contentContainerStyle={styles.pickerListContent}
                showsVerticalScrollIndicator={false}
              >
                {picker === 'type'
                  ? GROUP_TYPES.map((item) => (
                      <Pressable
                        key={item}
                        style={styles.pickerRow}
                        onPress={() => {
                          setType(item);
                          setPicker(null);
                        }}
                      >
                        <Text style={styles.pickerRowText}>{item}</Text>
                        {type === item ? (
                          <Ionicons name="checkmark" size={20} color="#0EA5A4" />
                        ) : null}
                      </Pressable>
                    ))
                  : CURRENCIES.map((item) => (
                      <Pressable
                        key={item.code}
                        style={styles.pickerRow}
                        onPress={() => {
                          setCurrency(item.code);
                          setPicker(null);
                        }}
                      >
                        <View style={styles.pickerRowTextWrap}>
                          <Text style={styles.pickerRowText}>{item.code}</Text>
                          <Text style={styles.pickerRowHint}>{item.name}</Text>
                        </View>
                        {currency === item.code ? (
                          <Ionicons name="checkmark" size={20} color="#0EA5A4" />
                        ) : null}
                      </Pressable>
                    ))}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
      </KeyboardAvoidingView>
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 18,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  headerTextContainer: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 50,
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '700',
  },
  sectionSubtitle: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
    lineHeight: 18,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 22,
    padding: 20,
  },
  label: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#FFFFFF',
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 17,
  },
  multilineInput: {
    minHeight: 100,
    paddingTop: 13,
  },
  selector: {
    minHeight: 64,
    backgroundColor: '#0F172A',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 17,
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectorTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  selectorValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  selectorHint: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 4,
  },
  disabledSelector: {
    opacity: 0.7,
  },
  ownerOnlyNote: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 13,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  ownerOnlyNoteText: {
    flex: 1,
    color: '#64748B',
    fontSize: 12,
    lineHeight: 17,
  },
  saveButton: {
    minHeight: 50,
    borderRadius: 15,
    backgroundColor: '#0EA5A4',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  buttonPressed: {
    opacity: 0.78,
  },
  sectionRoleHeader: {
    marginTop: 28,
    marginBottom: 14,
  },
  sectionRoleHeaderText: {
    flex: 1,
  },
  rolesCard: {
    backgroundColor: '#1E293B',
    borderRadius: 22,
    padding: 16,
  },
  permissionLegend: {
    marginBottom: 6,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  adminDot: {
    backgroundColor: '#0EA5A4',
  },
  memberDot: {
    backgroundColor: '#64748B',
  },
  viewerDot: {
    backgroundColor: '#F59E0B',
  },
  legendTextWrap: {
    flex: 1,
  },
  legendTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  legendText: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  roleLoadingRow: {
    minHeight: 74,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleMemberRow: {
    minHeight: 68,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  roleMemberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  roleMemberAvatarText: {
    color: '#0EA5A4',
    fontSize: 14,
    fontWeight: '800',
  },
  roleMemberInfo: {
    flex: 1,
    minWidth: 0,
  },
  roleMemberName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  roleMemberEmail: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 3,
  },
  roleSelectorButton: {
    minWidth: 96,
    minHeight: 38,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 10,
  },
  roleSelectorText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  ownerRoleBadge: {
    borderRadius: 10,
    backgroundColor: 'rgba(14,165,164,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  ownerRoleText: {
    color: '#0EA5A4',
    fontSize: 12,
    fontWeight: '800',
  },
  pendingRoleBadge: {
    borderRadius: 10,
    backgroundColor: 'rgba(245,158,11,0.10)',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  pendingRoleText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '800',
  },
  roleNote: {
    color: '#64748B',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 11,
  },
  noRolesText: {
    color: '#64748B',
    paddingVertical: 14,
  },
  currentRoleTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  currentRoleText: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  roleOptionCard: {
    minHeight: 68,
    borderRadius: 14,
    backgroundColor: '#0F172A',
    paddingHorizontal: 13,
    paddingVertical: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  roleOptionTextWrap: {
    flex: 1,
    minWidth: 0,
    paddingRight: 10,
  },
  roleOptionTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  roleOptionDescription: {
    color: '#64748B',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  roleModalSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  dangerSection: {
    marginTop: 28,
  },
  dangerCard: {
    backgroundColor: '#1E293B',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: '#3F1D29',
  },
  dangerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  dangerText: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
    marginBottom: 16,
  },
  deleteButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#B91C1C',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.78)',
    justifyContent: 'flex-end',
  },
  pickerCard: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingHorizontal: 18,
    paddingBottom: 30,
    maxHeight: '70%',
  },
  modalHandle: {
    alignSelf: 'center',
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#475569',
    marginBottom: 14,
  },
  pickerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 10,
  },
  pickerList: {
    maxHeight: 420,
  },
  pickerListContent: {
    paddingBottom: 4,
  },
  pickerRow: {
    minHeight: 54,
    paddingHorizontal: 12,
    borderRadius: 13,
    backgroundColor: '#0F172A',
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerRowTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  pickerRowText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  pickerRowHint: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 3,
  },
});