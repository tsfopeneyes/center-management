import { supabase } from '../supabaseClient';

const missingRpc = error => ['PGRST202', '42883'].includes(error?.code);

export const challengeCommunityApi = {
    async fetchPosts(challengeId) {
        const { data, error } = await supabase
            .from('community_channel_posts')
            .select(`id,channel_id,author_id,content,is_hidden,created_at,updated_at,
                community_channels!inner(source_notice_id),
                author:users!author_id(id,name,school,profile_image_url),
                community_post_media(id,media_type,media_url,sort_order),
                online_challenge_submissions(id,mission_id,completion_date,is_valid,online_challenge_missions(id,title,schedule_type)),
                community_channel_reactions(user_id,emoji,users(id,name,school,profile_image_url)),
                community_channel_comments(id,content,created_at,user_id,author:users!user_id(id,name,school,profile_image_url),community_channel_comment_reactions(user_id,emoji,users(id,name,school,profile_image_url)))`)
            .eq('community_channels.source_notice_id', challengeId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(post => ({
            ...post,
            media: (post.community_post_media || []).sort((a, b) => a.sort_order - b.sort_order),
            // PostgREST returns this relation as an object when it detects the
            // unique post_id FK, and as an array on older schema caches.
            submission: (Array.isArray(post.online_challenge_submissions)
                ? post.online_challenge_submissions
                : post.online_challenge_submissions ? [post.online_challenge_submissions] : []
            ).find(item => item.is_valid) || null,
        }));
    },

    async createPost({ challengeId, authorId, content, imageUrl, missionId }) {
        const payload = {
            notice_id: challengeId,
            author_id: authorId,
            content: content.trim(),
            image_url: imageUrl || null,
            mission_id: missionId || null,
        };
        const { data, error } = await supabase.rpc('create_online_challenge_post', { p_payload: payload });
        if (!error) return data;
        if (!missingRpc(error)) throw error;

        // Direct-table fallback for staged deployments. A failed later insert
        // soft-deletes the post, so an incomplete record never appears in feed.
        const { data: channel, error: channelError } = await supabase.from('community_channels')
            .select('id').eq('source_notice_id', challengeId).eq('status', 'ACTIVE').single();
        if (channelError) throw channelError;
        const { data: post, error: insertError } = await supabase.from('community_channel_posts')
            .insert({ channel_id: channel.id, author_id: authorId, content: content.trim() })
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
        const { error } = await supabase.from('community_channel_posts')
            .update({ deleted_at: new Date().toISOString() }).eq('id', postId);
        if (error) throw error;
    },

    async updatePost(postId, content) {
        const trimmedContent = content.trim();
        if (!trimmedContent) throw new Error('글 내용을 입력해주세요.');
        const { data, error } = await supabase.from('community_channel_posts')
            .update({ content: trimmedContent, updated_at: new Date().toISOString() })
            .eq('id', postId)
            .select('id,content,updated_at')
            .single();
        if (error) throw error;
        return data;
    },
};
