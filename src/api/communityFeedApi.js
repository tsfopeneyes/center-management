import { supabase } from '../supabaseClient';

const missingRpc = error => ['PGRST202', '42883'].includes(error?.code);
const missingTable = error => ['PGRST205', '42P01'].includes(error?.code);
const storageKey = (channelId, userId) => `communityRead:${channelId}:${userId}`;

export const sortCommunityPosts = posts => [...posts].sort((left, right) => {
    if (Boolean(left.is_announcement) !== Boolean(right.is_announcement)) return left.is_announcement ? -1 : 1;
    const leftTime = left.is_announcement ? left.announced_at || left.created_at : left.created_at;
    const rightTime = right.is_announcement ? right.announced_at || right.created_at : right.created_at;
    return new Date(rightTime) - new Date(leftTime) || String(right.id).localeCompare(String(left.id));
});

export const getUnreadBoundary = (posts, lastReadAt, userId) => {
    if (!lastReadAt) return null;
    const lastReadTime = new Date(lastReadAt).getTime();
    const unreadIndexes = posts.flatMap((post, index) =>
        !post.is_announcement && post.author_id !== userId && new Date(post.created_at).getTime() > lastReadTime ? [index] : []);
    if (unreadIndexes.length) {
        const lastIndex = unreadIndexes.at(-1);
        const hasOlderPosts = posts.slice(lastIndex + 1).some(post => !post.is_announcement);
        return hasOlderPosts ? { after: lastIndex } : { before: unreadIndexes[0] };
    }
    const firstUnreadAnnouncement = posts.findIndex(post => post.is_announcement
        && post.author_id !== userId && new Date(post.created_at).getTime() > lastReadTime);
    return firstUnreadAnnouncement >= 0 ? { before: firstUnreadAnnouncement } : null;
};

export const communityFeedApi = {
    async fetchChallengeChannelId(challengeId) {
        const { data, error } = await supabase.from('community_channels')
            .select('id').eq('source_notice_id', challengeId).eq('status', 'ACTIVE').maybeSingle();
        if (error) throw error;
        return data?.id || null;
    },

    async fetchReadAt(channelId, userId) {
        const { data, error } = await supabase.from('community_channel_read_cursors')
            .select('last_read_at').eq('channel_id', channelId).eq('user_id', userId).maybeSingle();
        if (!error) return data?.last_read_at || null;
        if (!missingTable(error)) throw error;
        return localStorage.getItem(storageKey(channelId, userId));
    },

    async markRead(channelId, userId, readAt) {
        const { error } = await supabase.rpc('mark_community_channel_read', {
            p_channel_id: channelId, p_user_id: userId, p_read_at: readAt,
        });
        if (!error) return;
        if (!missingRpc(error)) throw error;

        // Direct-table fallback while the RPC is absent from PostgREST's cache.
        const { error: directError } = await supabase.from('community_channel_read_cursors')
            .upsert({ channel_id: channelId, user_id: userId, last_read_at: readAt },
                { onConflict: 'channel_id,user_id' });
        if (!directError) return;
        if (!missingTable(directError)) throw directError;
        localStorage.setItem(storageKey(channelId, userId), readAt);
    },

    async setAnnouncement(postId, isAnnouncement) {
        const { data, error } = await supabase.from('community_channel_posts')
            .update({ is_announcement: isAnnouncement })
            .eq('id', postId).is('deleted_at', null)
            .select('id,is_announcement,announced_at')
            .single();
        if (error) throw error;
        return data;
    },
};
