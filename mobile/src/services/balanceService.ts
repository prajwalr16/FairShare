import { supabase } from '../config/supabase';

export type GroupBalance = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  total_paid: number | string;
  total_owed: number | string;
  net_balance: number | string;
};

export async function getGroupBalances(
  groupId: string
) {
  return await supabase.rpc('get_group_balances', {
    p_group_id: groupId,
  });
}