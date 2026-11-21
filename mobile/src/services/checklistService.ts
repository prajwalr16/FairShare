import { apiRequest } from './apiClient';

export type ChecklistItem = {
  id: string;
  group_id: string;
  created_by: string;
  title: string;
  category: string;
  scope: 'personal' | 'group';
  is_private: boolean;
  assigned_to?: string | null;
  assigned_name?: string | null;
  is_packed: boolean;
  created_at: string;
};

export type ChecklistSummary = {
  personal: ChecklistItem[];
  group: ChecklistItem[];
  personal_total: number;
  personal_packed: number;
  group_total: number;
  group_packed: number;
};

export type ChecklistCreateInput = {
  title: string;
  category: string;
  scope: 'personal' | 'group';
  is_private: boolean;
  assigned_to?: string | null;
};

export type ChecklistBatchImportInput = {
  title: string;
  category: string;
  scope: 'personal' | 'group';
  is_private?: boolean;
};

export async function getChecklists(groupId: string, signal?: AbortSignal) {
  return apiRequest<ChecklistSummary>(`/groups/${groupId}/checklists`, { signal });
}

export async function createChecklistItem(groupId: string, payload: ChecklistCreateInput) {
  return apiRequest<{ id: string }>(`/groups/${groupId}/checklists`, {
    method: 'POST',
    body: payload,
  });
}

export async function importChecklistItems(groupId: string, items: ChecklistBatchImportInput[]) {
  return apiRequest<{ imported: number }>(`/groups/${groupId}/checklists/import`, {
    method: 'POST',
    body: { items },
  });
}

export async function toggleChecklistItem(groupId: string, checklistId: string) {
  return apiRequest<{ is_packed: boolean }>(`/groups/${groupId}/checklists/${checklistId}/toggle`, {
    method: 'PATCH',
  });
}

export async function assignChecklistItem(
  groupId: string,
  checklistId: string,
  assignedTo: string | null,
) {
  return apiRequest<{ status: string }>(`/groups/${groupId}/checklists/${checklistId}/assign`, {
    method: 'PATCH',
    body: { assigned_to: assignedTo },
  });
}

export async function deleteChecklistItem(groupId: string, checklistId: string) {
  return apiRequest<void>(`/groups/${groupId}/checklists/${checklistId}`, {
    method: 'DELETE',
  });
}
