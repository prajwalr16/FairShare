import {supabase} from '../config/supabase';
export const getMembers=(groupId)=>supabase.from('group_members').select('*').eq('group_id',groupId);
export const addMember=(groupId,email)=>supabase.from('group_members').insert([{group_id:groupId,email}]);
