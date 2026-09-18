import { supabase } from '../supabaseClient';
import { getKSTDateString } from '../utils/dateUtils';
import { sortCommunityPosts } from './communityFeedApi';

const missingRpc = error => ['PGRST202', '42883'].includes(error?.code);

export const challengeCommunityApi = {
    async fetchPosts(challengeId) {
        const { data, error } = await supabase
            .from('community_channel_posts')
            .select(`id,channel_id,author_id,content,is_hidden,is_announcement,announced_at,created_at,updated_at,
                community_channels!inner(source_notice_id),
                author:users!author_id(id,name,school,profile_image_url),
                community_post_media(id,media_type,media_url,sort_order),
                online_challenge_submissions(id,mission_id,completion_date,is_valid,online_challenge_missions(id,title,schedule_type)),
                community_channel_reactions(user_id,emoji,users(id,name,school,profile_image_url)),
                community_channel_comments(id,content,created_at,user_id,author:users!user_id(id,name,school,profile_image_url),community_channel_comment_reactions(user_id,emoji,users(id,name,school,profile_image_url)))`)
            .eq('community_channels.source_notice_id', challengeId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return sortCommunityPosts((data || []).map(post => ({
            ...post,
            media: (post.community_post_media || []).sort((a, b) => a.sort_order - b.sort_order),
            // PostgREST returns this relation as an object when it detects the
            // unique post_id FK, and as an array on older schema caches.
            submission: (Array.isArray(post.online_challenge_submissions)
                ? post.online_challenge_submissions
                : post.online_challenge_submissions ? [post.online_challenge_submissions] : []
            ).find(item => item.is_valid) || null,
        })));
    },

    async createPost({ challengeId, authorId, content, imageUrl, missionId, isAnnouncement = false }) {
        const payload = {
            notice_id: challengeId,
            author_id: authorId,
            content: content.trim(),
            image_url: imageUrl || null,
            mission_id: missionId || null,
        };
        const { data, error } = await supabase.rpc(
            isAnnouncement ? 'create_online_challenge_announcement' : 'create_online_challenge_post',
            { p_payload: payload });
        if (!error) return data;
        if (!missingRpc(error)) throw error;

        // Direct-table fallback for staged deployments. A failed later insert
        // soft-deletes the post, so an incomplete record never appears in feed.
        const { data: channel, error: channelError } = await supabase.from('community_channels')
            .select('id').eq('source_notice_id', challengeId).eq('status', 'ACTIVE').single();
        if (channelError) throw channelError;
        const { data: post, error: insertError } = await supabase.from('community_channel_posts')
            .insert({ channel_id: channel.id, author_id: authorId, content: content.trim(), is_announcement: isAnnouncement })
            .select('id').single();
        if (insertError) throw insertError;
        try {
            if (imageUrl) {
                const { error: mediaError } = await supabase.from('community_post_media')
                    .insert({ post_id: post.id, media_url: imageUrl, sort_order: 0 });
                if (mediaError) throw mediaError;
            }
            if (missionId) {
                const { error: submissionError } = await supabase.from('online_challenge_submissions').insert({
                    challenge_id: challengeId,
                    mission_id: missionId,
                    participant_id: authorId,
                    post_id: post.id,
                    completion_date: new Date().toISOString().slice(0, 10),
                    completion_key: post.id,
                });
                if (submissionError) throw submissionError;
            }
            return post.id;
        } catch (fallbackError) {
            await supabase.from('community_channel_posts').update({ deleted_at: new Date().toISOString() }).eq('id', post.id);
            throw fallbackError;
        }
    },

    async toggleReaction(postId, userId, emoji) {
        const { data, error } = await supabase.from('community_channel_reactions').select('post_id')
            .eq('post_id', postId).eq('user_id', userId).eq('emoji', emoji).maybeSingle();
        if (error) throw error;
        if (data) {
            const { error: deleteError } = await supabase.from('community_channel_reactions').delete()
                .eq('post_id', postId).eq('user_id', userId).eq('emoji', emoji);
            if (deleteError) throw deleteError;
            return false;
        } else {
            const { error: insertError } = await supabase.from('community_channel_reactions')
                .insert({ post_id: postId, user_id: userId, emoji });
            if (insertError) throw insertError;
            return true;
        }
    },

    async createComment(postId, userId, content) {
        const trimmedContent = content.trim();
        const { data: comment, error } = await supabase.from('community_channel_comments')
            .insert({ post_id: postId, user_id: userId, content: trimmedContent })
            .select('id').single();
        if (error) throw error;
        return comment.id;
    },

    async updateComment(commentId, content) {
        const trimmedContent = content.trim();
        if (!trimmedContent) throw new Error('댓글 내용을 입력해주세요.');
        const { data, error } = await supabase.from('community_channel_comments')
            .update({ content: trimmedContent })
            .eq('id', commentId)
            .select('id,content');
        if (error) throw error;
        const updated = data?.[0];
        if (!updated) throw new Error('댓글 수정 권한이 아직 적용되지 않았습니다.');
        return updated;
    },

    async deleteComment(commentId) {
        const { data, error } = await supabase.from('community_channel_comments')
            .delete()
            .eq('id', commentId)
            .select('id');
        if (error) throw error;
        if (!data?.length) throw new Error('댓글 삭제 권한이 아직 적용되지 않았습니다.');
    },

    async deletePost(postId) {
        const { error: rpcError } = await supabase.rpc('soft_delete_community_post', { p_post_id: postId });
        if (!rpcError) return;
        if (!missingRpc(rpcError)) throw rpcError;

        // Direct-table fallback for an RPC missing from PostgREST's schema cache.
        const { data, error } = await supabase.from('community_channel_posts')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', postId)
            .select('id');
        if (error) throw error;
        if (!data?.length) throw new Error('글 삭제 권한이 아직 적용되지 않았습니다.');
    },

    async updatePost(post, content, missionId, challengeId, authorId) {
        const trimmedContent = content.trim();
        if (!trimmedContent) throw new Error('글 내용을 입력해주세요.');
        if (post.author_id !== authorId) throw new Error('본인 글만 수정할 수 있습니다.');
        const { data: rpcResult, error: rpcError } = await supabase.rpc('update_online_challenge_post', {
            p_post_id: post.id,
            p_author_id: authorId,
            p_content: trimmedContent,
            p_mission_id: missionId || null,
        });
        if (!rpcError) return rpcResult;
        if (!missingRpc(rpcError)) throw rpcError;

        // Direct-table fallback while the reviewed transaction function is unavailable.
        const oldMissionId = post.submission?.mission_id || null;
        const nextMissionId = missionId || null;
        const categoryChanged = oldMissionId !== nextMissionId;
        const { data, error } = await supabase.from('community_channel_posts')
            .update({ content: trimmedContent, updated_at: new Date().toISOString() })
            .eq('id', post.id).eq('author_id', authorId).is('deleted_at', null)
            .select('id,content,updated_at')
            .single();
        if (error) throw error;
        if (!categoryChanged) return data;

        try {
            if (post.submission) {
                const { data: reward, error: rewardError } = await supabase.from('challenge_completion_rewards')
                    .select('challenge_id').eq('challenge_id', challengeId).eq('participant_id', authorId).maybeSingle();
                if (rewardError) throw rewardError;
                if (reward) throw new Error('챌린지 완료 보상이 확정된 미션 기록은 변경할 수 없습니다.');
            }

            if (!nextMissionId) {
                const { data: invalidated, error: invalidateError } = await supabase.from('online_challenge_submissions')
                    .update({ is_valid: false, invalidated_at: new Date().toISOString() })
                    .eq('id', post.submission.id).eq('post_id', post.id).eq('participant_id', authorId).eq('is_valid', true)
                    .select('id');
                if (invalidateError) throw invalidateError;
                if (!invalidated?.length) throw new Error('미션 기록을 변경할 수 없습니다. 다시 불러와 주세요.');
            } else {
                const today = getKSTDateString(new Date());
                const { data: mission, error: missionError } = await supabase.from('online_challenge_missions')
                    .select('id,challenge_id,schedule_type,fixed_date,target_count')
                    .eq('id', nextMissionId).eq('challenge_id', challengeId).eq('is_active', true).single();
                if (missionError) throw missionError;
                if (mission.schedule_type === 'FIXED_DATE' && mission.fixed_date !== today) {
                    throw new Error('오늘 수행할 수 없는 미션입니다.');
                }
                const completionKey = mission.schedule_type === 'FIXED_DATE' ? 'fixed'
                    : mission.schedule_type === 'DAILY' ? today : post.id;
                if (post.submission) {
                    const { count, error: countError } = await supabase.from('online_challenge_submissions')
                        .select('*', { count: 'exact', head: true })
                        .eq('mission_id', nextMissionId).eq('participant_id', authorId).eq('is_valid', true)
                        .neq('post_id', post.id);
                    if (countError) throw countError;
                    if (mission.schedule_type === 'FLEXIBLE' && count >= mission.target_count) {
                        throw new Error('이미 목표 횟수를 완료한 미션입니다.');
                    }
                    const { data: changed, error: changeError } = await supabase.from('online_challenge_submissions')
                        .update({ mission_id: nextMissionId, completion_date: today, completion_key: completionKey })
                        .eq('id', post.submission.id).eq('post_id', post.id).eq('participant_id', authorId).eq('is_valid', true)
                        .select('id');
                    if (changeError) throw changeError;
                    if (!changed?.length) throw new Error('미션 기록을 변경할 수 없습니다. 다시 불러와 주세요.');
                } else {
                    const { data: earlierSubmission, error: earlierError } = await supabase.from('online_challenge_submissions')
                        .select('id').eq('post_id', post.id).maybeSingle();
                    if (earlierError) throw earlierError;
                    if (earlierSubmission) throw new Error('이 글의 미션 기록을 다시 연결하려면 데이터베이스 변경이 필요합니다.');
                    const { error: insertError } = await supabase.from('online_challenge_submissions').insert({
                        challenge_id: challengeId,
                        mission_id: nextMissionId,
                        participant_id: authorId,
                        post_id: post.id,
                        completion_date: today,
                        completion_key: completionKey,
                    });
                    if (insertError) throw insertError;
                }
            }
        } catch (categoryError) {
            const { error: restoreError } = await supabase.from('community_channel_posts')
                .update({ content: post.content, updated_at: post.updated_at || post.created_at })
                .eq('id', post.id).eq('author_id', authorId);
            if (restoreError) console.error('Failed to restore post content after mission edit:', restoreError);
            throw categoryError;
        }
        return data;
    },
};
