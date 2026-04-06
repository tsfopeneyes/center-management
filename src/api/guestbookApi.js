import { supabase } from '../supabaseClient';

export const guestbookApi = {
    async fetchWeeklyQuestion(weekNumber) {
        const { data, error } = await supabase
            .from('weekly_questions')
            .select('*')
            .eq('week_number', weekNumber)
            .maybeSingle();
            
        if (error) throw error;
        return data;
    },
    async fetchPosts(category = null) {
        let query = supabase
            .from('guest_posts')
            .select('*, users!guest_posts_user_id_fkey(name, school, user_group, profile_image_url), guest_post_reactions(user_id, emoji)')
            .order('created_at', { ascending: false });
            
        if (category) {
            query = query.eq('category', category);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
    },

    async createPost(userId, content, imageUrl, images = [], category = 'QT나눔', metadata = {}) {
        const { data, error } = await supabase.from('guest_posts').insert([{
            user_id: userId,
            content: content,
            image_url: imageUrl,
            images: images,
            category: category,
            metadata: metadata
        }]).select('id').single();
        if (error) throw error;
        return data;
    },

    async updatePost(postId, content, images = [], metadata = null) {
        const payload = {
            content: content,
            image_url: images.length > 0 ? images[0] : null,
            images: images
        };
        if (metadata !== null) {
            payload.metadata = metadata;
        }
        const { error } = await supabase.from('guest_posts').update(payload).eq('id', postId);
        if (error) throw error;
    },

    async fetchComments(postId) {
        const { data, error } = await supabase
            .from('guest_comments')
            .select('*, users(name, profile_image_url)')
            .eq('post_id', postId)
            .order('created_at', { ascending: true });
        if (error) throw error;
        return data;
    },

    async postComment(postId, userId, content) {
        const { error } = await supabase.from('guest_comments').insert([{
            post_id: postId,
            user_id: userId,
            content: content
        }]);
        if (error) throw error;
    },

    async deletePost(postId) {
        // First delete associated comments
        const { error: commentError } = await supabase.from('guest_comments').delete().eq('post_id', postId);
        if (commentError) throw commentError;

        // Perform delete and check if any row was actually affected
        const { data, error } = await supabase
            .from('guest_posts')
            .delete()
            .eq('id', postId)
            .select();

        if (error) throw error;

        if (!data || data.length === 0) {
            throw new Error('삭제할 권한이 없거나 이미 삭제된 게시글입니다. (Supabase RLS 정책 확인 필요)');
        }
    },

    async deleteComment(commentId) {
        const { data, error } = await supabase
            .from('guest_comments')
            .delete()
            .eq('id', commentId)
            .select();

        if (error) throw error;

        if (!data || data.length === 0) {
            throw new Error('댓글 삭제 권한이 없거나 이미 삭제된 댓글입니다.');
        }
    },

    async updateComment(commentId, content) {
        const { data, error } = await supabase
            .from('guest_comments')
            .update({ content })
            .eq('id', commentId)
            .select();

        if (error) throw error;

        if (!data || data.length === 0) {
            throw new Error('댓글 수정 권한이 없습니다.');
        }
    },

    async toggleReaction(postId, userId, emoji) {
        const { data: existing, error: checkErr } = await supabase
            .from('guest_post_reactions')
            .select('*')
            .eq('post_id', postId)
            .eq('user_id', userId)
            .eq('emoji', emoji)
            .maybeSingle();
            
        if (checkErr) throw checkErr;
        
        if (existing) {
            const { error: delErr } = await supabase.from('guest_post_reactions').delete().eq('post_id', postId).eq('user_id', userId).eq('emoji', emoji);
            if (delErr) throw delErr;
            return false; // Result is unreacted
        } else {
            const { error: insErr } = await supabase.from('guest_post_reactions').insert([{ post_id: postId, user_id: userId, emoji }]);
            if (insErr) throw insErr;
            return true; // Result is reacted
        }
    }
};
