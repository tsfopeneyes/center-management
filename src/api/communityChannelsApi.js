import { supabase } from '../supabaseClient';
import { fetchAllPages } from '../utils/fetchAllPages';
import { userApi } from './userApi';
import { sortCommunityPosts } from './communityFeedApi';
import { isAdminOrStaff } from '../utils/userUtils';

const postSelect = `id,channel_id,author_id,content,is_hidden,is_announcement,announced_at,created_at,updated_at,
    author:users!author_id(id,name,school,profile_image_url),
    community_post_media(id,media_type,media_url,sort_order),
    online_challenge_submissions(id,challenge_id,mission_id,is_valid,online_challenge_missions(id,title)),
    community_channel_reactions(user_id,emoji,users(id,name,school,profile_image_url)),
    community_channel_comments(id,content,created_at,user_id,author:users!user_id(id,name,school,profile_image_url),community_channel_comment_reactions(user_id,emoji,users(id,name,school,profile_image_url)))`;

const missingRpc = error => ['PGRST202', '42883'].includes(error?.code);

export const communityChannelsApi = {
    async fetchProgramInvite(noticeId) {
        const {data,error}=await supabase.from('community_channel_invites').select('*').eq('source_notice_id',noticeId).maybeSingle();
        if(error)throw error;
        return data;
    },
    async fetchInvitePreview(channelId) {
        const { data, error } = await supabase.from('community_channel_invites').select('*').eq('id', channelId).single();
        if (error) throw error;
        return data;
    },

    async fetchChannels() {
        const { data, error } = await supabase.from('community_channel_directory').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        const rows = data || [];
        const visiblePosts = rows.length ? await fetchAllPages(() => supabase.from('community_channel_posts')
            .select('id,channel_id').in('channel_id', rows.map(row => row.id)).is('deleted_at', null).order('id')) : [];
        const counts = visiblePosts.reduce((map, post) => map.set(post.channel_id, (map.get(post.channel_id) || 0) + 1), new Map());
        return rows.map(channel => ({ ...channel, post_count: counts.get(channel.id) || 0 }));
    },

    async fetchChannel(channelId) {
        const { data, error } = await supabase.from('community_channel_directory').select('*').eq('id', channelId).single();
        if (error) throw error;
        return data;
    },

    async fetchProgramChannel(noticeId) {
        const { data, error } = await supabase.from('community_channel_directory').select('*')
            .eq('source_notice_id', noticeId).neq('status', 'ARCHIVED').maybeSingle();
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
            .select('id,title,program_start_date,program_end_date,is_challenge,challenge_format,community_enabled,is_recruiting,host_id,host_ids,hosts')
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
            .upsert({ channel_id: channelId, user_id: userId, member_role: 'MEMBER', revoked_at: null }, { onConflict: 'channel_id,user_id' });
        if (error) throw error;
    },

    async fetchMembers(channel) {
        return (await fetchAllPages(() => supabase.from('community_channel_participants').select('*')
            .eq('channel_id', channel.id).order('user_id')))
            .sort((a, b) => (a.user?.name || '').localeCompare(b.user?.name || '', 'ko'));
    },

    async fetchMentionCandidates(channel) {
        const members = await this.fetchMembers(channel);
        const hostIds = channel.source_notice_id ? await (async () => {
            const { data, error } = await supabase.from('notices').select('host_id,host_ids,hosts')
                .eq('id', channel.source_notice_id).single();
            if (error) throw error;
            return [data.host_id, ...(data.host_ids || []),
                ...(Array.isArray(data.hosts) ? data.hosts.map(host => host?.host_id) : [])].filter(Boolean);
        })() : members.filter(member => member.member_role === 'HOST').map(member => member.user_id);
        const memberUsers = members.map(member => member.user).filter(Boolean);
        const missingHostIds = [...new Set(hostIds)].filter(id => !memberUsers.some(user => user.id === id));
        let hosts = [];
        if (missingHostIds.length) {
            const { data, error } = await supabase.from('users').select('id,name,school,profile_image_url').in('id', missingHostIds);
            if (error) throw error;
            hosts = data || [];
        }
        const hostSet = new Set(hostIds);
        return [...new Map([...memberUsers, ...hosts].map(user => [user.id, { ...user, isHost: hostSet.has(user.id) }])).values()]
            .filter(user => user.id && user.name)
            .sort((a, b) => Number(b.isHost) - Number(a.isHost) || a.name.localeCompare(b.name, 'ko'));
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
        const channel = await this.fetchChannel(channelId);
        if (channel.source_notice_id) throw new Error('프로그램 참여자 관리에서 신청자를 추가해주세요.');
        const { error } = await supabase.from('community_channel_members').upsert({
            channel_id: channelId, user_id: userId, member_role: 'MEMBER', revoked_at: null,
        }, { onConflict: 'channel_id,user_id' });
        if (error) throw error;
    },

    async removeMember(channelId, userId) {
        const { error } = await supabase.from('community_channel_members').update({ revoked_at: new Date().toISOString() })
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
        const { error } = await supabase.from('community_channels').update({ status, updated_at: new Date().toISOString() }).eq('id', channelId);
        if (error) throw error;
        return this.fetchChannel(channelId);
    },

    async archiveChannel(channelId) {
        const channel = await this.fetchChannel(channelId);
        const { data, error } = await supabase.from('community_channel_link_requests')
            .insert({ channel_id: channelId, notice_id: null, expected_notice_id: channel.source_notice_id, archive: true }).select('id').single();
        if (error) throw error;
        return data;
    },

    async fetchLinkablePrograms() {
        const { data, error } = await supabase.from('notices')
            .select('id,title,community_enabled,is_challenge,challenge_format,is_recruiting,program_start_date,program_end_date')
            .eq('category', 'PROGRAM').order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    },

    async linkToProgram(channelId, noticeId, expectedNoticeId) {
        const { error } = await supabase.rpc('set_community_channel_program', {
            p_channel_id: channelId, p_notice_id: noticeId || null, p_expected_notice_id: expectedNoticeId || null,
        });
        if (!error) return;
        if (!missingRpc(error)) throw error;
        const { error: requestError } = await supabase.from('community_channel_link_requests')
            .insert({ channel_id: channelId, notice_id: noticeId || null, expected_notice_id: expectedNoticeId || null });
        if (requestError) throw requestError;
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

    async createPost({ channelId, authorId, content, imageUrls = [], missionId = null, isAnnouncement = false }) {
        const channel = await this.fetchChannel(channelId);
        if (channel.source_notice_id) {
            const notice = await this.fetchChallengeNotice(channel.source_notice_id);
            const isStaff = isAdminOrStaff(await userApi.fetchUser(authorId));
            if (notice.is_challenge && (missionId || !isStaff) && !await this.fetchChallengeAccess(notice.id, authorId)) {
                throw new Error('챌린지 신청 확정자만 미션과 자유글을 작성할 수 있어요.');
            }
        }
        const payload = { channel_id: channelId, author_id: authorId, content: content.trim(), image_urls: imageUrls, mission_id: missionId };
        const { data, error } = await supabase.rpc('create_community_post_with_media', { p_payload: payload, p_is_announcement: isAnnouncement });
        if (!error) return data;
        if (!missingRpc(error)) throw error;
        const { data: request, error: requestError } = await supabase.from('community_post_create_requests')
            .insert({ payload, is_announcement: isAnnouncement }).select('post_id').single();
        if (requestError) throw requestError;
        return request.post_id;
    },

    async editPost(post, authorId, content, missionId, imageUrls = null) {
        const payload = { post_id: post.id, author_id: authorId, content: content.trim(), mission_id: missionId || null,
            ...(imageUrls === null ? {} : { expected_urls: (post.media || []).map(item => item.media_url), next_urls: imageUrls }) };
        const { data, error } = await supabase.rpc('update_community_post_with_media', { p_payload: payload });
        if (!error) return data;
        if (!missingRpc(error)) throw error;
        const { data: request, error: requestError } = await supabase.from('community_post_create_requests')
            .insert({ payload, operation: 'UPDATE' }).select('result').single();
        if (requestError) throw requestError;
        return request.result;
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
