import { supabase } from '../supabaseClient';

/**
 * Merges data from a temporary/guest user into a primary user account.
 * @param {string} tempUserId - The ID of the temporary/guest user to be merged.
 * @param {string} primaryUserId - The ID of the existing primary user account.
 * @returns {Promise<{success: boolean, error?: any}>}
 */
export const mergeUserStats = async (tempUserId, primaryUserId) => {
    if (!tempUserId || !primaryUserId || tempUserId === primaryUserId) {
        return { success: false, error: 'Invalid user IDs provided for merge.' };
    }

    try {
        const { error } = await supabase.rpc('merge_duplicate_users', {
            p_source_id: tempUserId,
            p_target_id: primaryUserId
        });

        if (error) {
            console.error('Error merging users via RPC:', error);
            throw error;
        }

        return { success: true };
    } catch (err) {
        console.error('User merge failed:', err);
        return { success: false, error: err.message };
    }
};
