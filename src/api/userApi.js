import { supabase } from '../supabaseClient';

export const userApi = {
    async fetchLogs(userId) {
        const { data, error } = await supabase
            .from('logs')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: true });
        if (error) throw error;
        return data;
    },
    async fetchUser(userId) {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();
        if (error) throw error;
        return data;
    },

    async updateProfile(userId, updates) {
        const { error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', userId);
        if (error) throw error;
    },

    async fetchStaff() {
        const { data, error } = await supabase
            .from('users')
            .select('id, name, user_group')
            .eq('user_group', 'STAFF');
        if (error) throw error;
        return data;
    }
};
