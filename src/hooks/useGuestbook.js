import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { guestbookApi } from '../api/guestbookApi';

export const useGuestbook = (userId) => {
    const [guestPosts, setGuestPosts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);

    const fetchGuestPosts = useCallback(async () => {
        setLoading(true);
        try {
            const data = await guestbookApi.fetchPosts();
            setGuestPosts(data || []);
        } catch (err) {
            console.error('Error fetching guest posts:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleCreatePost = async (content, imageFile) => {
        if (!content && !imageFile) return;
        setUploading(true);
        try {
            let imageUrl = null;
            if (imageFile) {
                const fileExt = imageFile.name.split('.').pop();
                const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
                const { error: uploadError } = await supabase.storage
                    .from('notice-images')
                    .upload(`guest/${fileName}`, imageFile);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('notice-images')
                    .getPublicUrl(`guest/${fileName}`);

                imageUrl = publicUrl;
            }

            await guestbookApi.createPost(userId, content, imageUrl);
            fetchGuestPosts();
            return true;
        } catch (err) {
            console.error('Error creating guest post:', err);
            alert('업로드 실패: ' + err.message);
            return false;
        } finally {
            setUploading(false);
        }
    };

    const fetchComments = async (postId) => {
        try {
            const data = await guestbookApi.fetchComments(postId);
            return data || [];
        } catch (err) {
            console.error('Error fetching guest comments:', err);
            return [];
        }
    };

    const handlePostComment = async (postId, content) => {
        if (!content.trim()) return false;
        try {
            await guestbookApi.postComment(postId, userId, content);
            return true;
        } catch (err) {
            console.error('Error posting guest comment:', err);
            alert('댓글 저장 실패');
            return false;
        }
    };

    useEffect(() => {
        fetchGuestPosts();
    }, [fetchGuestPosts]);

    return {
        guestPosts,
        loading,
        uploading,
        fetchGuestPosts,
        handleCreatePost,
        fetchComments,
        handlePostComment
    };
};
