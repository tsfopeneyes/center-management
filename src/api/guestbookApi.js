import { supabase } from '../supabaseClient';

export const guestbookApi = {
    async fetchPosts() {
        const { data, error } = await supabase
            .from('guest_posts')
            .select('*, users(name, school, user_group, profile_image_url)')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data;
    },

    async createPost(userId, content, imageUrl, images = []) {
        const { error } = await supabase.from('guest_posts').insert([{
            user_id: userId,
            content: content,
            image_url: imageUrl,
            images: images
        }]);
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
    }
};
