import { supabase } from '../supabaseClient';

export const guestbookApi = {
    async fetchPosts() {
        const { data, error } = await supabase
            .from('guest_posts')
            .select('*, users(name, school, user_group)')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data;
    },

    async createPost(userId, content, imageUrl) {
        const { error } = await supabase.from('guest_posts').insert([{
            user_id: userId,
            content: content,
            image_url: imageUrl
        }]);
        if (error) throw error;
    },

    async fetchComments(postId) {
        const { data, error } = await supabase
            .from('guest_comments')
            .select('*, users(name)')
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
    }
};
