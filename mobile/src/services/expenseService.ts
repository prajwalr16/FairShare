import {supabase} from '../config/supabase';
export const createExpense=(groupId,data)=>supabase.from('expenses').insert([{group_id:groupId,...data}]);
