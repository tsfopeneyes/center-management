import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { guestbookApi } from '../api/guestbookApi';
import { compressImage } from '../utils/imageUtils';

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

    const handleCreatePost = async (content, imageFiles = []) => {
        if (!content && (!imageFiles || imageFiles.length === 0)) return;
        setUploading(true);
        try {
            const imageUrls = [];

            for (const file of imageFiles) {
                // Apply automatic compression before upload
                const compressedFile = await compressImage(file);
                const fileExt = compressedFile.name.split('.').pop();
                const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
                const { error: uploadError } = await supabase.storage
                    .from('notice-images')
                    .upload(`guest/${fileName}`, compressedFile);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('notice-images')
                    .getPublicUrl(`guest/${fileName}`);

                imageUrls.push(publicUrl);
            }

            // image_url is the first one for backward compatibility, images is the full array
            const mainImageUrl = imageUrls.length > 0 ? imageUrls[0] : null;
            await guestbookApi.createPost(userId, content, mainImageUrl, imageUrls);
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

    const handleDeletePost = async (postId) => {
        try {
            await guestbookApi.deletePost(postId);
            fetchGuestPosts();
            return true;
        } catch (err) {
            console.error('Error deleting guest post:', err);
            alert('삭제 실패: ' + err.message);
            return false;
        }
    };

    const handleDeleteComment = async (postId, commentId) => {
        try {
            await guestbookApi.deleteComment(commentId);
            return true;
        } catch (err) {
            console.error('Error deleting guest comment:', err);
            alert('댓글 삭제 실패');
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
        handlePostComment,
        handleDeletePost,
        handleDeleteComment
    };
};
