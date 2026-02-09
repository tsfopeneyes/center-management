import { supabase } from '../supabaseClient';

export const challengesApi = {
    // Categories
    fetchCategories: async () => {
        const { data, error } = await supabase
            .from('challenge_categories')
            .select('*')
            .order('display_order');
        if (error) throw error;
        return data;
    },

    upsertCategory: async (category) => {
        const { data, error } = await supabase
            .from('challenge_categories')
            .upsert(category)
            .select();
        if (error) throw error;
        return data[0];
    },

    deleteCategory: async (id) => {
        const { error } = await supabase
            .from('challenge_categories')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },

    updateCategoryOrder: async (categories) => {
        const promises = categories.map((cat, index) =>
            supabase
                .from('challenge_categories')
                .update({ display_order: index + 1 })
                .eq('id', cat.id)
        );
        await Promise.all(promises);
    },

    // Challenges
    fetchChallenges: async () => {
        const { data, error } = await supabase
            .from('challenges')
            .select('*')
            .order('display_order');
        if (error) throw error;
        return data;
    },

    upsertChallenge: async (challenge) => {
        const { data, error } = await supabase
            .from('challenges')
            .upsert(challenge)
            .select();
        if (error) throw error;
        return data[0];
    },

    deleteChallenge: async (id) => {
        const { error } = await supabase
            .from('challenges')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },

    updateChallengeOrder: async (challenges) => {
        const promises = challenges.map((ch, index) =>
            supabase
                .from('challenges')
                .update({ display_order: index + 1 })
                .eq('id', ch.id)
        );
        await Promise.all(promises);
    }
};
