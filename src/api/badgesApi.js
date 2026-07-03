import { supabase } from '../supabaseClient';

export const badgesApi = {
    // Categories
    fetchCategories: async () => {
        let { data, error } = await supabase
            .from('badge_categories')
            .select('*')
            .order('display_order');
        if (error) {
            const { data: fbData, error: fbError } = await supabase
                .from('challenge_categories')
                .select('*')
                .order('display_order');
            if (fbError) throw fbError;
            return fbData;
        }
        return data;
    },

    upsertCategory: async (category) => {
        let { data, error } = await supabase
            .from('badge_categories')
            .upsert(category)
            .select();
        if (error) {
            const { data: fbData, error: fbError } = await supabase
                .from('challenge_categories')
                .upsert(category)
                .select();
            if (fbError) throw fbError;
            return fbData[0];
        }
        return data[0];
    },

    deleteCategory: async (id) => {
        const { error } = await supabase
            .from('badge_categories')
            .delete()
            .eq('id', id);
        if (error) {
            const { error: fbError } = await supabase
                .from('challenge_categories')
                .delete()
                .eq('id', id);
            if (fbError) throw fbError;
        }
    },

    updateCategoryOrder: async (categories) => {
        try {
            const promises = categories.map((cat, index) =>
                supabase
                    .from('badge_categories')
                    .update({ display_order: index + 1 })
                    .eq('id', cat.id)
            );
            const results = await Promise.all(promises);
            const firstError = results.find(r => r.error);
            if (firstError) throw firstError.error;
        } catch (err) {
            const promises = categories.map((cat, index) =>
                supabase
                    .from('challenge_categories')
                    .update({ display_order: index + 1 })
                    .eq('id', cat.id)
            );
            await Promise.all(promises);
        }
    },

    // Badges
    fetchChallenges: async () => {
        let { data, error } = await supabase
            .from('badges')
            .select('*')
            .order('display_order');
        if (error) {
            const { data: fbData, error: fbError } = await supabase
                .from('challenges')
                .select('*')
                .order('display_order');
            if (fbError) throw fbError;
            return fbData;
        }
        return data;
    },

    upsertChallenge: async (challenge) => {
        let { data, error } = await supabase
            .from('badges')
            .upsert(challenge)
            .select();
        if (error) {
            const { data: fbData, error: fbError } = await supabase
                .from('challenges')
                .upsert(challenge)
                .select();
            if (fbError) throw fbError;
            return fbData[0];
        }
        return data[0];
    },

    deleteChallenge: async (id) => {
        const { error } = await supabase
            .from('badges')
            .delete()
            .eq('id', id);
        if (error) {
            const { error: fbError } = await supabase
                .from('challenges')
                .delete()
                .eq('id', id);
            if (fbError) throw fbError;
        }
    },

    updateChallengeOrder: async (challenges) => {
        try {
            const promises = challenges.map((ch, index) =>
                supabase
                    .from('badges')
                    .update({ display_order: index + 1 })
                    .eq('id', ch.id)
            );
            const results = await Promise.all(promises);
            const firstError = results.find(r => r.error);
            if (firstError) throw firstError.error;
        } catch (err) {
            const promises = challenges.map((ch, index) =>
                supabase
                    .from('challenges')
                    .update({ display_order: index + 1 })
                    .eq('id', ch.id)
            );
            await Promise.all(promises);
        }
    },

    // Award manual badges
    fetchAwardedUsers: async (challengeId) => {
        let { data, error } = await supabase
            .from('user_badges')
            .select('user_id')
            .eq('challenge_id', challengeId);
        if (error) {
            const { data: fbData, error: fbError } = await supabase
                .from('user_challenges')
                .select('user_id')
                .eq('challenge_id', challengeId);
            if (fbError) throw fbError;
            return fbData.map(d => d.user_id);
        }
        return data.map(d => d.user_id);
    },

    saveAwardedUsers: async (challengeId, userIds) => {
        try {
            const { error: deleteError } = await supabase
                .from('user_badges')
                .delete()
                .eq('challenge_id', challengeId);
            if (deleteError) throw deleteError;

            if (userIds.length > 0) {
                const inserts = userIds.map(userId => ({
                    challenge_id: challengeId,
                    user_id: userId
                }));
                const { error: insertError } = await supabase
                    .from('user_badges')
                    .insert(inserts);
                if (insertError) throw insertError;
            }
        } catch (err) {
            // Fallback
            const { error: deleteError } = await supabase
                .from('user_challenges')
                .delete()
                .eq('challenge_id', challengeId);
            if (deleteError) throw deleteError;

            if (userIds.length > 0) {
                const inserts = userIds.map(userId => ({
                    challenge_id: challengeId,
                    user_id: userId
                }));
                const { error: insertError } = await supabase
                    .from('user_challenges')
                    .insert(inserts);
                if (insertError) throw insertError;
            }
        }
    }
};
