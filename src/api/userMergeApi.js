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
        // 1. Update simple foreign key references
        
        // Logs
        const { error: logsError } = await supabase
            .from('logs')
            .update({ user_id: primaryUserId })
            .eq('user_id', tempUserId);
        if (logsError) console.error('Error merging logs:', logsError);

        // Notice Responses (RSVPs)
        const { error: noticeError } = await supabase
            .from('notice_responses')
            .update({ user_id: primaryUserId })
            .eq('user_id', tempUserId);
        if (noticeError) console.error('Error merging notice_responses:', noticeError);

        // Visit Notes (Checkout purpose)
        const { error: visitError } = await supabase
            .from('visit_notes')
            .update({ user_id: primaryUserId })
            .eq('user_id', tempUserId);
        if (visitError) console.error('Error merging visit_notes:', visitError);

        // Calling Forest Progress
        const { error: forestError } = await supabase
            .from('calling_forest_progress')
            .update({ student_id: primaryUserId })
            .eq('student_id', tempUserId);
        if (forestError) console.error('Error merging forest progress:', forestError);

        // 2. Update array-based references (School Logs)
        // This is more complex since participant_ids is an array.
        const { data: schoolLogs, error: fetchError } = await supabase
            .from('school_logs')
            .select('id, participant_ids')
            .filter('participant_ids', 'cs', `{"${tempUserId}"}`); // Contains operator

        if (fetchError) {
            console.error('Error fetching school logs for merge:', fetchError);
        } else if (schoolLogs && schoolLogs.length > 0) {
            for (const log of schoolLogs) {
                const updatedParticipants = log.participant_ids.map(id => 
                    id === tempUserId ? primaryUserId : id
                );
                
                // Remove duplicates if primary user was already in the list
                const uniqueParticipants = [...new Set(updatedParticipants)];

                await supabase
                    .from('school_logs')
                    .update({ participant_ids: uniqueParticipants })
                    .eq('id', log.id);
            }
        }

        // 3. Delete or Flag the temporary user
        // We delete it as requested ("Guest and Temp members should not be users")
        const { error: deleteError } = await supabase
            .from('users')
            .delete()
            .eq('id', tempUserId);
        
        if (deleteError) {
            console.error('Error deleting temp user after merge:', deleteError);
            // Even if delete fails, the merge of data happened.
        }

        return { success: true };
    } catch (err) {
        console.error('User merge failed:', err);
        return { success: false, error: err.message };
    }
};
