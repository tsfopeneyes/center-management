import { supabase } from '../supabaseClient';
import { normalizeSchoolName } from '../utils/userUtils';
import { requestSupabaseRest } from '../utils/supabaseRest';

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
        const [classified] = await this.attachAccountRoles([data]);
        return classified || { ...data, account_role: 'member' };
    },

    async fetchUserPreferences(userId) {
        if (!userId) return {};
        const { data, error } = await supabase
            .from('users')
            .select('preferences')
            .eq('id', userId)
            .single();

        // Return empty object if no preferences yet, or log error
        if (error && error.code !== 'PGRST116') throw error; // ignore no rows error
        return data?.preferences || {};
    },

    async updateUserPreferences(userId, newPreferences) {
        if (!userId) return;

        // 1. Fetch current first to merge (if needed)
        const currentPrefs = await this.fetchUserPreferences(userId);
        const updatedPrefs = { ...currentPrefs, ...newPreferences };

        const { data, error } = await supabase
            .from('users')
            .update({ preferences: updatedPrefs })
            .eq('id', userId)
            .select('preferences')
            .single();

        if (error) throw error;
        return data?.preferences || updatedPrefs;
    },

    async updateProfile(userId, updates) {
        if (updates && updates.school) {
            updates.school = normalizeSchoolName(updates.school);
        }
        const { error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', userId);
        if (error) throw error;
    },

    async fetchStaff() {
        const rows = [];
        const pageSize = 500;
        for (let offset = 0; ; offset += pageSize) {
            const page = await requestSupabaseRest(
                `staff_directory?select=id,name,school,profile_image_url,user_group,role,is_master,status&order=name.asc,id.asc&offset=${offset}&limit=${pageSize}`,
                {},
                2,
                10000
            );
            rows.push(...(page || []));
            if (!page || page.length < pageSize) break;
        }
        return rows.map(user => ({ ...user, account_role: user.role }));
    },

    async attachAccountRoles(users) {
        const rows = Array.isArray(users) ? users : [];
        if (!rows.length) return [];
        let staff = [];
        try {
            staff = await this.fetchStaff();
        } catch (error) {
            // Anonymous guest pages cannot read the staff directory. Failing
            // closed as member keeps those pages usable without trusting the
            // legacy public role fields.
            if (![401, 403].includes(Number(error?.status)) && error?.code !== '42501') throw error;
        }
        const roles = new Map(staff.map(user => [String(user.id), user.account_role]));
        return rows.map(user => ({
            ...user,
            account_role: roles.get(String(user.id)) || 'member',
        }));
    }
};
