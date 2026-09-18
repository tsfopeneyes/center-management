import { supabase } from '../supabaseClient';
import { fetchAllPages } from '../utils/fetchAllPages';
import { userApi } from './userApi';
import { sortCommunityPosts } from './communityFeedApi';

const postSelect = `id,channel_id,author_id,content,is_hidden,is_announcement,announced_at,created_at,updated_at,
    author:users!author_id(id,name,school,profile_image_url),
    community_post_media(id,media_type,media_url,sort_order),
    online_challenge_submissions(id,mission_id,is_valid,online_challenge_missions(id,title)),
    community_channel_reactions(user_id,emoji,users(id,name,school,profile_image_url)),
    community_channel_comments(id,content,created_at,user_id,author:users!user_id(id,name,school,profile_image_url),community_channel_comment_reactions(user_id,emoji,users(id,name,school,profile_image_url)))`;

const missingRpc = error => ['PGRST202', '42883'].includes(error?.code);

export const communityChannelsApi = {
    async fetchInvitePreview(channelId) {
        const { data, error } = await supabase.rpc('get_community_invite_preview', { p_channel_id: channelId });
        if (!error) return Array.isArray(data) ? data[0] : data;
        if (!missingRpc(error)) throw error;
        const { data: channel, error: channelError } = await supabase.from('community_channels')
            .select('id,name,description,status').eq('id', channelId).eq('status', 'ACTIVE').single();
        if (channelError) throw channelError;
        return { ...channel, participant_count: 0, source_title: null };
    },

    async fetchChannels() {
        const { data, error } = await supabase.from('community_channels')
            .select('id,name,description,channel_type,source_notice_id,status,created_at,source_notice:notices!source_notice_id(id,title,category,is_challenge,challenge_format),community_channel_members(user_id)')
            .order('created_at', { ascending: false });
        if (error) throw error;
        const rows = data || [];
        const noticeIds = rows.map(channel => channel.source_notice_id).filter(Boolean);
        const channelIds = rows.map(channel => channel.id);
        const [joined, visiblePosts] = await Promise.all([
            noticeIds.length ? fetchAllPages(() => supabase.from('notice_responses')
                .select('notice_id,user_id').in('notice_id', noticeIds).eq('status', 'JOIN')
                .order('notice_id').order('user_id')) : [],
            channelIds.length ? fetchAllPages(() => supabase.from('community_channel_posts')
                .select('id,channel_id').in('channel_id', channelIds).is('deleted_at', null)
                .order('id')) : [],
        ]);
        const postCounts = visiblePosts.reduce((counts, post) => counts.set(post.channel_id, (counts.get(post.channel_id) || 0) + 1), new Map());
        return rows.map(channel => ({
            ...channel,
            post_count: postCounts.get(channel.id) || 0,
            participant_count: channel.source_notice_id
                ? new Set(joined.filter(item => item.notice_id === channel.source_notice_id).map(item => item.user_id)).size
                : new Set((channel.community_channel_members || []).map(member => member.user_id)).size,
        }));
    },

    async fetchChannel(channelId) {
        const { data, error } = await supabase.from('community_channels')
            .select('id,name,description,channel_type,source_notice_id,status,created_at,source_notice:notices!source_notice_id(id,title,category,is_challenge,challenge_format)')
            .eq('id', channelId).single();
        if (error) throw error;
        return data;
    },

    async fetchChallengeAccess(noticeId, userId) {
        const { data, error } = await supabase.from('notice_responses')
            .select('user_id')
            .eq('notice_id', noticeId).eq('user_id', userId).eq('status', 'JOIN')
            .maybeSingle();
        if (error) throw error;
        return Boolean(data);
    },

    async fetchChallengeNotice(noticeId) {
        const { data, error } = await supabase.from('notices')
            .select('id,title,program_start_date,program_end_date,is_challenge,challenge_format,community_enabled')
            .eq('id', noticeId).single();
        if (error) throw error;
        return data;
    },

    async createStandaloneChannel({ name, description = '' }) {
        const { data, error } = await supabase.from('community_channels')
            .insert({ name: name.trim(), description: description.trim(), channel_type: 'PRIVATE', source_notice_id: null, status: 'ACTIVE' })
            .select('id,name,description,channel_type,source_notice_id,status,created_at').single();
        if (error) throw error;
        return data;
    },

    async joinStandaloneChannel(channelId, userId) {
        const { error } = await supabase.from('community_channel_members')
            .upsert({ channel_id: channelId, user_id: userId, member_role: 'MEMBER' }, { onConflict: 'channel_id,user_id', ignoreDuplicates: true });
        if (error) throw error;
    },

    async fetchMembers(channel) {
        if (channel.source_notice_id) {
            const responses = await fetchAllPages(() => supabase.from('notice_responses')
                .select('user_id,user:users!user_id(id,name,school,profile_image_url)')
                .eq('notice_id', channel.source_notice_id).eq('status', 'JOIN').order('user_id'));
            return [...new Map(responses.map(item => [item.user_id, {
                user_id: item.user_id, user: item.user, member_role: 'PARTICIPANT', source: 'PROGRAM',
            }])).values()].sort((a, b) => (a.user?.name || '').localeCompare(b.user?.name || '', 'ko'));
        }
        const { data, error } = await supabase.from('community_channel_members')
            .select('user_id,member_role,joined_at,user:users!user_id(id,name,school,profile_image_url)')
            .eq('channel_id', channel.id);
        if (error) throw error;
        return (data || []).map(item => ({ ...item, source: 'DIRECT' }))
            .sort((a, b) => (a.user?.name || '').localeCompare(b.user?.name || '', 'ko'));
    },

    async fetchUsers() {
        const [data,staff] = await Promise.all([
            fetchAllPages(() => supabase.from('users')
                .select('id,name,school,profile_image_url,user_group,status')
                .order('name').order('id')),
            userApi.fetchStaff(),
        ]);
        const merged = new Map(data.map(user => [user.id, user]));
        staff.forEach(user => merged.set(user.id, { ...merged.get(user.id), ...user, account_role: user.account_role }));
        return [...merged.values()]
            .map(user => ({ ...user, account_role: user.account_role || 'member' }))
            .filter(user => String(user.status || '').toLowerCase() !== 'withdrawn')
            .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ko'));
    },

    async addMember(channelId, userId) {
        const { error } = await supabase.from('community_channel_members').upsert({
            channel_id: channelId, user_id: userId, member_role: 'MEMBER',
        }, { onConflict: 'channel_id,user_id' });
        if (error) throw error;
    },

    async removeMember(channelId, userId) {
        const { error } = await supabase.from('community_channel_members').delete()
            .eq('channel_id', channelId).eq('user_id', userId);
        if (error) throw error;
    },

    async updateChannel(channelId, values) {
        const { data, error } = await supabase.from('community_channels').update({
            name: values.name.trim(), description: (values.description || '').trim(), updated_at: new Date().toISOString(),
        }).eq('id', channelId).select('id,name,description').single();
        if (error) throw error;
        return data;
    },

    async updateChannelStatus(channelId, status) {
        const { data, error } = await supabase.from('community_channels').update({
            status, updated_at: new Date().toISOString(),
        }).eq('id', channelId).select('id,status').single();
        if (error) throw error;
        return data;
    },

    async archiveChannel(channelId) {
        const { data: channel, error: channelError } = await supabase.from('community_channels')
            .select('source_notice_id').eq('id', channelId).single();
        if (channelError) throw channelError;

        if (channel.source_notice_id) {
            const { data: notice, error: noticeReadError } = await supabase.from('notices')
                .select('guest_properties').eq('id', channel.source_notice_id).single();
            if (noticeReadError) throw noticeReadError;
            const { error: noticeError } = await supabase.from('notices').update({
                community_enabled: false,
                guest_properties: { ...(notice.guest_properties || {}), community_channel_id: '' },
            }).eq('id', channel.source_notice_id);
            if (noticeError) throw noticeError;
        }

        const { data, error } = await supabase.from('community_channels').update({
            status: 'ARCHIVED', source_notice_id: null, channel_type: 'PRIVATE', updated_at: new Date().toISOString(),
        }).eq('id', channelId).select('id,status').single();
        if (error) throw error;
        return data;
    },

    async fetchLinkableChallenges() {
        const { data, error } = await supabase.from('notices')
            .select('id,title,community_enabled,challenge_format,program_start_date,program_end_date')
            .eq('category', 'PROGRAM').eq('is_challenge', true).eq('challenge_format', 'ONLINE')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    async linkToChallenge(channelId, noticeId) {
        const { error } = await supabase.rpc('link_community_channel_to_notice', {
            p_channel_id: channelId, p_notice_id: noticeId || null,
        });
        if (!error) return;
        if (!missingRpc(error)) throw error;

        const { data: selected, error: selectedError } = await supabase.from('community_channels')
            .select('id,source_notice_id').eq('id', channelId).single();
        if (selectedError) throw selectedError;
        if (selected.source_notice_id && selected.source_notice_id !== noticeId) {
            const { data: previousNotice, error: previousNoticeReadError } = await supabase.from('notices')
                .select('guest_properties').eq('id', selected.source_notice_id).single();
            if (previousNoticeReadError) throw previousNoticeReadError;
            const { error: previousNoticeError } = await supabase.from('notices')
                .update({
                    community_enabled: false,
                    guest_properties: { ...(previousNotice.guest_properties || {}), community_channel_id: '' },
                }).eq('id', selected.source_notice_id);
            if (previousNoticeError) throw previousNoticeError;
        }
        let current = null;
        if (noticeId) {
            const currentResult = await supabase.from('community_channels')
                .select('id').eq('source_notice_id', noticeId).maybeSingle();
            if (currentResult.error) throw currentResult.error;
            current = currentResult.data;
        }
        if (current && current.id !== channelId) {
            const { error: detachError } = await supabase.from('community_channels').update({
                source_notice_id: null, channel_type: 'PRIVATE', updated_at: new Date().toISOString(),
            }).eq('id', current.id);
            if (detachError) throw detachError;
        }
        const { error: linkError } = await supabase.from('community_channels').update({
            source_notice_id: noticeId || null,
            channel_type: noticeId ? 'CHALLENGE' : 'PRIVATE',
            status: 'ACTIVE',
            updated_at: new Date().toISOString(),
        }).eq('id', channelId);
        if (linkError) throw linkError;
        if (noticeId) {
            const { data: notice, error: noticeReadError } = await supabase.from('notices')
                .select('guest_properties').eq('id', noticeId).single();
            if (noticeReadError) throw noticeReadError;
            const { error: noticeError } = await supabase.from('notices')
                .update({
                    community_enabled: true,
                    guest_properties: { ...(notice.guest_properties || {}), community_channel_id: channelId },
                }).eq('id', noticeId);
            if (noticeError) throw noticeError;
        }
    },

    async fetchPosts(channelId) {
        const { data, error } = await supabase.from('community_channel_posts')
            .select(postSelect).eq('channel_id', channelId).is('deleted_at', null)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return sortCommunityPosts((data || []).map(post => ({
            ...post,
            media: (post.community_post_media || []).sort((a, b) => a.sort_order - b.sort_order),
            submission: (Array.isArray(post.online_challenge_submissions)
                ? post.online_challenge_submissions
                : post.online_challenge_submissions ? [post.online_challenge_submissions] : [])
                .find(item => item.is_valid) || null,
        })));
    },

    async createPost(channelId, authorId, content, isAnnouncement = false) {
        const { data, error } = await supabase.from('community_channel_posts')
            .insert({ channel_id: channelId, author_id: authorId, content: content.trim(), is_announcement: isAnnouncement })
            .select('id').single();
        if (error) throw error;
        return data.id;
    },

    async updatePost(postId, authorId, content) {
        const trimmedContent = content.trim();
        if (!trimmedContent) throw new Error('글 내용을 입력해주세요.');
        const { data, error } = await supabase.from('community_channel_posts')
            .update({ content: trimmedContent, updated_at: new Date().toISOString() })
            .eq('id', postId).eq('author_id', authorId).is('deleted_at', null)
            .select('id,content,updated_at').single();
        if (error) throw error;
        return data;
    },
};
