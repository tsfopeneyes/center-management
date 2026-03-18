import React, { useState, useEffect } from 'react';
import { COMMUNITY_CATEGORIES } from '../../constants/appConstants';
import { motion, AnimatePresence } from 'framer-motion';
import PostItem from './PostItem';
import PostCreateModal from './PostCreateModal';
import CommentSection from './CommentSection'; // Added import
import { communityApi } from '../../api/communityApi';

const CommunityTab = ({ user }) => {
    const [selectedCategory, setSelectedCategory] = useState(COMMUNITY_CATEGORIES[0]);
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedPostForComment, setSelectedPostForComment] = useState(null); // Added state

    useEffect(() => {
        fetchPosts(selectedCategory);

        // Set up real-time subscription for likes and comments count
        const channel = communityApi.subscribeToPostChanges((updatedPost) => {
            setPosts(prevPosts => {
                // If the post is currently in the list, update it
                const postExists = prevPosts.some(p => p.id === updatedPost.id);
                if (postExists) {
                    return prevPosts.map(p => {
                        if (p.id === updatedPost.id) {
                            // Merge updatedPost while preserving local states (like isLikedByMe, author object)
                            return { ...p, ...updatedPost, isLikedByMe: p.isLikedByMe, author: p.author };
                        }
                        return p;
                    });
                }
                return prevPosts;
            });
        });

        return () => {
            communityApi.unsubscribeFromChanges(channel);
        };
    }, [selectedCategory, user?.id]);

    const fetchPosts = async (category) => {
        setLoading(true);
        const data = await communityApi.fetchPosts(category, user?.id);
        setPosts(data);
        setLoading(false);
    };

    const handleCreatePost = async (content) => {
        const newPost = await communityApi.createPost(user?.id, selectedCategory, content);
        if (newPost) {
            setShowCreateModal(false);
            fetchPosts(selectedCategory); // Refresh
        } else {
            alert('게시글 등록에 실패했습니다.');
        }
    };

    const handleLike = async (postId, isLiked) => {
        // Optimistic UI update
        setPosts(prev => prev.map(p => {
            if (p.id === postId) {
                return {
                    ...p,
                    isLikedByMe: !isLiked,
                    likes_count: isLiked ? Math.max(0, p.likes_count - 1) : p.likes_count + 1
                };
            }
            return p;
        }));

        const success = await communityApi.toggleLike(postId, user?.id, isLiked);
        if (!success) {
            // Revert on failure
            setPosts(prev => prev.map(p => {
                if (p.id === postId) {
                    return {
                        ...p,
                        isLikedByMe: isLiked, // revert back
                        likes_count: isLiked ? p.likes_count + 1 : Math.max(0, p.likes_count - 1) // revert count
                    };
                }
                return p;
            }));
            fetchPosts(selectedCategory); // Force refresh to get true state
        }
    };

    const handleEditPost = async (postId, newContent) => {
        const updatedPost = await communityApi.updatePost(postId, newContent);
        if (updatedPost) {
            setPosts(prev => prev.map(p => {
                if (p.id === postId) {
                    return { ...p, content: newContent, updated_at: new Date().toISOString() };
                }
                return p;
            }));
            return true;
        } else {
            alert('수정에 실패했습니다.');
            return false;
        }
    };

    const handleDelete = async (postId) => {
        if (!confirm('정말로 삭제하시겠습니까?')) return;
        const success = await communityApi.deletePost(postId);
        if (success) {
            setPosts(prev => prev.filter(p => p.id !== postId));
        } else {
            alert('삭제에 실패했습니다.');
        }
    };

    const handleClickComment = (post) => {
        setSelectedPostForComment(post); // Modified logic
    };

    const handleCloseComment = () => {
        setSelectedPostForComment(null);
        // Refresh posts to update comment counts
        fetchPosts(selectedCategory);
    };

    const handleCommentAdded = (postId) => {
        setPosts(prev => prev.map(p => {
            if (p.id === postId) {
                return { ...p, comments_count: (p.comments_count || 0) + 1 };
            }
            return p;
        }));
    };

    const handleCommentRemoved = (postId) => {
        setPosts(prev => prev.map(p => {
            if (p.id === postId && (p.comments_count || 0) > 0) {
                return { ...p, comments_count: p.comments_count - 1 };
            }
            return p;
        }));
    };

    return (
        <div className="flex flex-col min-h-[calc(100vh-80px)] bg-white rounded-t-[30px] shadow-sm mt-2 pb-20 font-sans overflow-hidden">
            {/* Header / Category Navigation */}
            <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-b border-gray-100">
                <div className="px-5 pt-6 pb-4">
                    <h2 className="text-3xl font-black text-gray-800 mb-2">
                        커뮤니티 💭
                    </h2>
                    <p className="text-gray-500 text-[15px] font-medium">떠오르는 생각을 함께 나눠주세요</p>
                </div>

                {/* Horizontal Scrollable Tabs */}
                <div className="flex overflow-x-auto hide-scrollbar px-3 pb-3 space-x-1.5 scroll-smooth">
                    {COMMUNITY_CATEGORIES.map(category => (
                        <button
                            key={category}
                            onClick={() => setSelectedCategory(category)}
                            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-[13px] font-bold transition-all ${selectedCategory === category
                                ? 'bg-gray-900 text-white shadow-md'
                                : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-200'
                                }`}
                        >
                            {category}
                        </button>
                    ))}
                </div>
            </div>

            {/* Feed Area */}
            <div className="flex-1 overflow-y-auto bg-gray-50/50">
                {loading ? (
                    <div className="p-8 flex justify-center">
                        <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin"></div>
                    </div>
                ) : posts.length === 0 ? (
                    <div className="p-10 text-center flex flex-col items-center">
                        <p className="text-gray-400 font-bold text-sm mb-1">아직 작성된 글이 없습니다.</p>
                        <p className="text-gray-300 text-xs font-bold">첫 번째 스레드를 남겨보세요!</p>
                    </div>
                ) : (
                    <div className="flex flex-col pb-32">
                        {posts.map(post => (
                            <PostItem
                                key={post.id}
                                post={post}
                                currentUser={user}
                                onLike={handleLike}
                                onClickComment={handleClickComment}
                                onEdit={handleEditPost}
                                onDelete={handleDelete}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Write FAB (Floating Action Button) */}
            <button
                onClick={() => setShowCreateModal(true)}
                className="fixed bottom-24 right-5 w-14 h-14 bg-gray-900 text-white rounded-2xl flex items-center justify-center shadow-[0_8px_30px_rgba(0,0,0,0.15)] hover:scale-105 transition-transform active:scale-95 z-20"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>

            {/* Modals */}
            <AnimatePresence>
                {showCreateModal && (
                    <PostCreateModal
                        user={user}
                        category={selectedCategory}
                        onClose={() => setShowCreateModal(false)}
                        onSubmit={handleCreatePost}
                    />
                )}
                {selectedPostForComment && (
                    <CommentSection
                        post={selectedPostForComment}
                        user={user}
                        onClose={handleCloseComment}
                        onCommentAdded={handleCommentAdded}
                        onCommentRemoved={handleCommentRemoved}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export default CommunityTab;
