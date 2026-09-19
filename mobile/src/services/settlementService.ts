import { supabase } from '../config/supabase';

export type GroupSettlement = {
  id: string;
  group_id: string;
  from_user_id: string;
  to_user_id: string;
  amount: number | string;
  note: string | null;
  created_by: string | null;
  created_at: string;
};

export type RecordSettlementInput = {
  groupId: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  note?: string;
};

export type UpdateSettlementInput = {
  groupId: string;
  settlementId: string;
  amount: number;
  note?: string;
};

export async function recordSettlement(input: RecordSettlementInput) {
  const cleanNote = input.note?.trim() || null;

  return await supabase.rpc('record_group_settlement', {
    p_group_id: input.groupId,
    p_from_user_id: input.fromUserId,
    p_to_user_id: input.toUserId,
    p_amount: Number(input.amount.toFixed(2)),
    p_note: cleanNote,
  });
}

export async function updateSettlement(input: UpdateSettlementInput) {
  const cleanNote = input.note?.trim() || null;

  return await supabase.rpc('update_group_settlement', {
    p_group_id: input.groupId,
    p_settlement_id: input.settlementId,
    p_amount: Number(input.amount.toFixed(2)),
    p_note: cleanNote,
  });
}

export async function deleteSettlement(
  groupId: string,
  settlementId: string
) {
  return await supabase.rpc('delete_group_settlement', {
    p_group_id: groupId,
    p_settlement_id: settlementId,
  });
}

export async function getGroupSettlements(groupId: string) {
  return await supabase
    .from('settlements')
    .select(
      'id,group_id,from_user_id,to_user_id,amount,note,created_by,created_at'
    )
    .eq('group_id', groupId)
    .order('created_at', { ascending: false });
}