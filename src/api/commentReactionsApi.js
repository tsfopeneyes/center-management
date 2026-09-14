import { supabase } from '../supabaseClient';

const toggle = async (table, commentId, userId, emoji) => {
    const { data, error } = await supabase.from(table)
        .select('comment_id')
        .eq('comment_id', commentId)
        .eq('user_id', userId)
        .eq('emoji', emoji)
        .maybeSingle();
    if (error) throw error;
    if (data) {
        const { error: deleteError } = await supabase.from(table)
            .delete()
            .eq('comment_id', commentId)
            .eq('user_id', userId)
            .eq('emoji', emoji);
        if (deleteError) throw deleteError;
        return false;
    }
    const { error: insertError } = await supabase.from(table)
        .insert({ comment_id: commentId, user_id: userId, emoji });
    if (insertError) throw insertError;
    return true;
};

export const commentReactionsApi = {
    toggleNoticeComment: (commentId, userId, emoji) => toggle('notice_comment_reactions', commentId, userId, emoji),
    toggleChannelComment: (commentId, userId, emoji) => toggle('community_channel_comment_reactions', commentId, userId, emoji),
};
