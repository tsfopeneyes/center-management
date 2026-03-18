import { supabase } from '../supabaseClient';

export const templatesApi = {
    /**
     * Fetch templates by type for the current user
     */
    async getByType(userId, type) {
        if (!userId) return [];
        const { data, error } = await supabase
            .from('admin_templates')
            .select('*')
            .eq('user_id', userId)
            .eq('type', type)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    /**
     * Create a new template
     */
    async create(templateData) {
        const { data, error } = await supabase
            .from('admin_templates')
            .insert([templateData])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Delete a template
     */
    async delete(id) {
        const { error } = await supabase
            .from('admin_templates')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return true;
    }
};
