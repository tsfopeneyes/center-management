import { supabase, supabaseUrl } from '../supabaseClient';
import { getKSTDateString } from '../utils/dateUtils';
import { sortCommunityPosts } from './communityFeedApi';
import { communityImagePath } from '../utils/communityImageStorage';
import { isAdminOrStaff } from '../utils/userUtils';

const missingRpc = error => ['PGRST202', '42883'].includes(error?.code);
const pendingReactionToggles = new Map();

export const challengeCommunityApi = {
    async isChallengeHost(challengeId, user) {
        const { data, error } = await supabase.rpc('is_challenge_host', { p_notice_id: challengeId });
        if (!error) return data === true;
        if (!missingRpc(error)) throw error;
        const { data: notice, error: readError } = await supabase.from('notices')
            .select('host_id,host_ids,hosts').eq('id', challengeId).single();
        if (readError) throw readError;
        const hostIds = [notice.host_id, ...(notice.host_ids || []),
            ...(Array.isArray(notice.hosts) ? notice.hosts.map(host => host?.host_id) : [])];
        return isAdminOrStaff(user) && hostIds.includes(user?.id);
    },

    async fetchPosts(challengeId) {
        const { data, error } = await supabase
            .from('community_channel_posts')
            .select(`id,channel_id,author_id,content,image_url,is_hidden,is_announcement,announced_at,created_at,updated_at,
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

    async createPost({ challengeId, authorId, content, imageUrls = [], missionId, isAnnouncement = false }) {
        if (imageUrls.length > 10) throw new Error('사진은 최대 10장까지 첨부할 수 있습니다.');
        const payload = {
            notice_id: challengeId,
            author_id: authorId,
            content: content.trim(),
            image_urls: imageUrls,
            mission_id: missionId || null,
        };
        const { data: batchPostId, error: batchError } = await supabase.rpc('create_online_challenge_post_with_media', {
            p_payload: payload, p_is_announcement: isAnnouncement,
        });
        if (!batchError) return batchPostId;
        if (!missingRpc(batchError)) throw batchError;

        // Direct-table fallback while the batch function is unavailable.
        const legacyPayload = { ...payload, image_url: imageUrls[0] || null };
        const { data, error } = await supabase.rpc(
            isAnnouncement ? 'create_online_challenge_announcement' : 'create_online_challenge_post',
            { p_payload: legacyPayload });
        if (!error) {
            if (imageUrls.length > 1) {
                const { error: mediaError } = await supabase.from('community_post_media').insert(
                    imageUrls.slice(1).map((media_url, index) => ({ post_id: data, media_url, sort_order: index + 1 })));
                if (mediaError) {
                    let removed = false;
                    try { await this.deletePost(data); removed = true; }
                    catch (cleanupError) { console.error('Failed to remove incomplete community post:', cleanupError); }
                    if (removed) throw mediaError;
                    const partialError = new Error('글은 저장되었지만 추가 사진을 첨부하지 못했습니다. 다시 확인해 주세요.');
                    partialError.postId = data;
                    throw partialError;
                }
            }
            return data;
        }
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
            if (imageUrls.length) {
                const { error: mediaError } = await supabase.from('community_post_media')
                    .insert(imageUrls.map((media_url, sort_order) => ({ post_id: post.id, media_url, sort_order })));
                if (mediaError) throw mediaError;
            }
            if (missionId) {
                const { error: submissionError } = await supabase.from('online_challenge_submissions').insert({
                    challenge_id: challengeId,
                    mission_id: missionId,
                    participant_id: authorId,
                    post_id: post.id,
                    completion_date: getKSTDateString(new Date()),
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

    toggleReaction(postId, userId, emoji) {
        const key = JSON.stringify([postId, userId, emoji]);
        if (pendingReactionToggles.has(key)) return pendingReactionToggles.get(key);
        const request = this.toggleReactionOnce(postId, userId, emoji)
            .finally(() => pendingReactionToggles.delete(key));
        pendingReactionToggles.set(key, request);
        return request;
    },

    async toggleReactionOnce(postId, userId, emoji) {
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
            if (insertError?.code === '23505') {
                // Only accept a duplicate when this exact reaction now exists.
                const { data: existing, error: checkError } = await supabase.from('community_channel_reactions')
                    .select('post_id').eq('post_id', postId).eq('user_id', userId).eq('emoji', emoji).maybeSingle();
                if (checkError) throw checkError;
                if (!existing) throw insertError;
            } else if (insertError) throw insertError;
            return true;
        }
    },

    async setPostMissionAsAdmin(post, missionId) {
        const { error } = await supabase.rpc('admin_set_online_post_mission', {
            p_post_id: post.id, p_mission_id: missionId || null,
        });
        if (!error) return;
        if (!missingRpc(error)) throw error;

        // Direct-table fallback for a staged schema cache. The database's
        // policies and submission trigger still enforce authorization and slots.
        const { data: channel, error: channelError } = await supabase.from('community_channels')
            .select('source_notice_id').eq('id', post.channel_id).single();
        if (channelError) throw channelError;
        const { data: reward, error: rewardError } = await supabase.from('challenge_completion_rewards')
            .select('challenge_id').eq('challenge_id', channel.source_notice_id)
            .eq('participant_id', post.author_id).maybeSingle();
        if (rewardError) throw rewardError;
        if (reward) throw new Error('완료 보상이 확정된 미션 기록은 변경할 수 없습니다.');
        const { data: rows, error: readError } = await supabase.from('online_challenge_submissions')
            .select('id,mission_id,is_valid').eq('post_id', post.id);
        if (readError) throw readError;
        const existing = rows?.[0];
        if (!missionId) {
            if (!existing?.is_valid) return;
            const { error: updateError } = await supabase.from('online_challenge_submissions')
                .update({ is_valid: false, invalidated_at: new Date().toISOString() }).eq('id', existing.id);
            if (updateError) throw updateError;
            return;
        }
        const { data: mission, error: missionError } = await supabase.from('online_challenge_missions')
            .select('id,schedule_type,fixed_date,challenge_id,target_count').eq('id', missionId)
            .eq('challenge_id', channel.source_notice_id).eq('is_active', true).single();
        if (missionError) throw missionError;
        const date = getKSTDateString(new Date(post.created_at));
        if (mission.schedule_type === 'FIXED_DATE' && mission.fixed_date !== date)
            throw new Error('글 작성일과 미션 날짜가 다릅니다.');
        const completionKey = mission.schedule_type === 'FIXED_DATE' ? 'fixed'
            : mission.schedule_type === 'DAILY' ? date : post.id;
        if (mission.schedule_type === 'FLEXIBLE') {
            const { count, error: countError } = await supabase.from('online_challenge_submissions')
                .select('*', { count: 'exact', head: true }).eq('mission_id', missionId)
                .eq('participant_id', post.author_id).eq('is_valid', true).neq('post_id', post.id);
            if (countError) throw countError;
            if (count >= mission.target_count) throw new Error('이미 목표 횟수를 완료했습니다.');
        }
        const values = { mission_id: missionId, completion_date: date, completion_key: completionKey,
            is_valid: true, invalidated_at: null };
        const fallback = existing
            ? await supabase.from('online_challenge_submissions').update(values).eq('id', existing.id)
            : await supabase.from('online_challenge_submissions').insert({ ...values,
                challenge_id: mission.challenge_id, participant_id: post.author_id, post_id: post.id });
        if (fallback.error) throw fallback.error;
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

    async replacePostImages(post, imageUrls, authorId, challengeId) {
        if (post.author_id !== authorId) throw new Error('본인 글의 사진만 수정할 수 있습니다.');
        if (imageUrls.length > 10) throw new Error('사진은 최대 10장까지 첨부할 수 있습니다.');
        for (const url of imageUrls) {
            if (!communityImagePath(url, authorId, challengeId, supabaseUrl))
                throw new Error('사진의 저장 위치를 확인할 수 없습니다.');
        }
        const expectedUrls = (post.media || []).map(item => item.media_url);
        const { data, error } = await supabase.rpc('replace_community_post_media', {
            p_post_id: post.id, p_author_id: authorId,
            p_expected_urls: expectedUrls, p_next_urls: imageUrls,
        });
        if (!error) return (data || []).sort((a, b) => a.sort_order - b.sort_order);
        if (!missingRpc(error)) throw error;

        // Direct-table fallback when the new RPC is absent from the schema cache.
        const { data: rows, error: readError } = await supabase.from('community_post_media')
            .select('id,media_type,media_url,sort_order').eq('post_id', post.id)
            .order('sort_order', { ascending: true });
        if (readError) throw readError;
        if (JSON.stringify((rows || []).map(row => row.media_url)) !== JSON.stringify(expectedUrls))
            throw new Error('사진이 다른 곳에서 변경되었습니다. 다시 불러와 주세요.');
        const { error: deleteError } = await supabase.from('community_post_media')
            .delete().eq('post_id', post.id);
        if (deleteError) throw deleteError;
        const { data: replacement, error: insertError } = imageUrls.length
            ? await supabase.from('community_post_media').insert(imageUrls.map((media_url, sort_order) => ({
                post_id: post.id, media_url, sort_order,
            }))).select('id,media_type,media_url,sort_order')
            : { data: [], error: null };
        if (insertError) {
            const { error: restoreError } = await supabase.from('community_post_media')
                .insert((rows || []).map(row => ({ post_id: post.id, media_url: row.media_url, sort_order: row.sort_order })));
            if (restoreError) console.error('Failed to restore community photos:', restoreError);
            throw insertError;
        }
        const { error: postError } = await supabase.from('community_channel_posts')
            .update({ image_url: imageUrls[0] || null }).eq('id', post.id).eq('author_id', authorId);
        if (postError) {
            const { error: rollbackError } = await supabase.from('community_post_media').delete().eq('post_id', post.id);
            if (!rollbackError && rows?.length) {
                const restored = await supabase.from('community_post_media').insert(rows.map(row => ({
                    post_id: post.id, media_url: row.media_url, sort_order: row.sort_order,
                })));
                if (restored.error) console.error('Failed to restore community photos:', restored.error);
            } else if (rollbackError) console.error('Failed to roll back community photos:', rollbackError);
            throw postError;
        }
        return replacement || [];
    },

    async replacePostImage(post, imageUrl, authorId, challengeId) {
        if (post.author_id !== authorId) throw new Error('본인 글의 사진만 수정할 수 있습니다.');
        const { data: rows, error: readError } = await supabase.from('community_post_media')
            .select('id,media_type,media_url,sort_order').eq('post_id', post.id)
            .order('sort_order', { ascending: true });
        if (readError) throw readError;
        if (rows?.length > 1 || rows?.[0]?.media_url !== (post.media?.[0]?.media_url || undefined))
            throw new Error('사진이 다른 곳에서 변경되었습니다. 다시 불러와 주세요.');
        const previous = rows?.[0] || null;
        const oldPath = previous && communityImagePath(previous.media_url, authorId, challengeId, supabaseUrl);
        if (previous && !oldPath) throw new Error('이 사진의 저장 위치를 확인할 수 없어 삭제하지 않았습니다.');
        if (imageUrl && !communityImagePath(imageUrl, authorId, challengeId, supabaseUrl))
            throw new Error('새 사진의 저장 위치를 확인할 수 없습니다.');
        if (previous) {
            const { count, error } = await supabase.from('community_post_media')
                .select('id', { count: 'exact', head: true }).eq('media_url', previous.media_url).neq('id', previous.id);
            if (error) throw error;
            if (count) throw new Error('다른 글에서도 사용하는 사진이라 파일을 삭제할 수 없습니다.');
        }

        let nextMedia = null;
        try {
            if (previous && imageUrl) {
                const { data, error } = await supabase.from('community_post_media')
                    .update({ media_url: imageUrl }).eq('id', previous.id).eq('post_id', post.id)
                    .select('id,media_type,media_url,sort_order').single();
                if (error) throw error;
                nextMedia = data;
            } else if (previous) {
                const { data, error } = await supabase.from('community_post_media')
                    .delete().eq('id', previous.id).eq('post_id', post.id).select('id');
                if (error) throw error;
                if (!data?.length) throw new Error('사진 삭제 권한을 확인하지 못했습니다.');
            } else if (imageUrl) {
                const { data, error } = await supabase.from('community_post_media')
                    .insert({ post_id: post.id, media_url: imageUrl, sort_order: 0 })
                    .select('id,media_type,media_url,sort_order').single();
                if (error) throw error;
                nextMedia = data;
            }
            if (post.image_url === previous?.media_url) {
                const { data, error } = await supabase.from('community_channel_posts')
                    .update({ image_url: imageUrl || null }).eq('id', post.id).eq('author_id', authorId)
                    .select('id');
                if (error) throw error;
                if (!data?.length) throw new Error('게시글 사진 정보를 수정할 권한을 확인하지 못했습니다.');
            }
            if (oldPath) {
                const { data, error } = await supabase.storage.from('notice-images').remove([oldPath]);
                if (error) throw error;
                if (!data?.length) throw new Error('저장된 사진 파일을 삭제하지 못했습니다. 다시 시도해 주세요.');
            }
            return nextMedia ? [nextMedia] : [];
        } catch (error) {
            if (previous && nextMedia) {
                const { error: restoreError } = await supabase.from('community_post_media')
                    .update({ media_url: previous.media_url }).eq('id', previous.id).eq('post_id', post.id);
                if (restoreError) console.error('Failed to restore post image after edit:', restoreError);
            } else if (previous && !imageUrl) {
                const { error: restoreError } = await supabase.from('community_post_media')
                    .insert({ post_id: post.id, media_url: previous.media_url, sort_order: previous.sort_order });
                if (restoreError) console.error('Failed to restore deleted post image:', restoreError);
            } else if (!previous && nextMedia) {
                const { error: restoreError } = await supabase.from('community_post_media')
                    .delete().eq('id', nextMedia.id).eq('post_id', post.id);
                if (restoreError) console.error('Failed to undo new post image:', restoreError);
            }
            if (post.image_url === previous?.media_url) {
                const { error: restoreError } = await supabase.from('community_channel_posts')
                    .update({ image_url: previous?.media_url || null }).eq('id', post.id).eq('author_id', authorId);
                if (restoreError) console.error('Failed to restore legacy post image:', restoreError);
            }
            throw error;
        }
    },
};
