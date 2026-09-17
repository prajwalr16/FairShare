import {supabase} from '../config/supabase';
export const getGroups=(id)=>supabase.from('groups').select('*').eq('owner_id',id).order('created_at',{ascending:false});
export const createGroup=(id,d)=>supabase.from('groups').insert([{owner_id:id,...d}]).select().single();
