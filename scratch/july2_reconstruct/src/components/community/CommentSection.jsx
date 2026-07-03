import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Send, MoreHorizontal, ChevronLeft } from 'lucide-react';
import UserAvatar from '../common/UserAvatar';
import { communityApi } from '../../api/communityApi';
import { formatDateRelative } from '../../utils/dateUtils';

const CommentSection = ({ post, user, onClose, onCommentAdded, onCommentRemoved }) => {
    const [comments, setComments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newComment, setNewComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingCommentId, setEditingCommentId] = useState(null);
    const [editContent, setEditContent] = useState('');

    useEffect(() => {
        const loadComments = async () => {
            const data = await communityApi.fetchComments(post.id);
            setComments(data);
            setLoading(false);
        };
        loadComments();

        // Trap back navigation for iOS swipe back and Android back button
        window.history.pushState(null, null, window.location.href);
        const handlePopState = (event) => {
            window.history.pushState(null, null, window.location.href);
            onClose(); // Just close the modal, don't go back
        };

        window.addEventListener('popstate', handlePopState);
        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, [post.id, onClose]);

    const handleCreateComment = async (e) => {
        e.preventDefault();
        if (!newComment.trim()) return;
        setIsSubmitting(true);
        const data = await communityApi.createComment(post.id, user?.id, newComment);
        if (data) {
            // Add user object manually for immediate render
            const optimisticComment = {
                ...data,
                author: { id: user?.id, name: user?.name, profile_image_url: user?.profile_image_url }
            };
            setComments(prev => [...prev, optimisticComment]);
            setNewComment('');
            if (onCommentAdded) onCommentAdded(post.id);
        } else {
            alert('댓글 작성 실패');
        }
        setIsSubmitting(false);
    };

    const handleDelete = async (commentId) => {
        if (!confirm('댓글을 삭제하시겠습니까?')) return;
        const success = await communityApi.deleteComment(commentId, post.id);
        if (success) {
            setComments(prev => prev.filter(c => c.id !== commentId));
            if (onCommentRemoved) onCommentRemoved(post.id);
        } else {
            alert('삭제 실패');
        }
    };

    const handleEditStart = (comment) => {
        setEditingCommentId(comment.id);
        setEditContent(comment.content);
    };

    const handleEditCancel = () => {
        setEditingCommentId(null);
        setEditContent('');
    };

    const handleEditSubmit = async (commentId) => {
        if (!editContent.trim()) return;
        setIsSubmitting(true);
        const updatedComment = await communityApi.updateComment(commentId, editContent);
        if (updatedComment) {
            setComments(prev => prev.map(c => c.id === commentId ? { ...c, content: editContent, updated_at: new Date().toISOString() } : c));
            setEditingCommentId(null);
            setEditContent('');
        } else {
            alert('수정 실패');
        }
        setIsSubmitting(false);
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-0 h-[100dvh] w-full z-[200] bg-white flex flex-col"
        >
            <div className="flex items-center justify-between p-4 pt-[max(env(safe-area-inset-top),16px)] border-b border-gray-100 bg-white relative z-[210] shrink-0 w-full">
                <button onClick={onClose} className="flex items-center gap-1 hover:bg-gray-50 rounded-lg p-1 pr-2 transition-colors -ml-1">
                    <ChevronLeft size={28} className="text-gray-900" />
                    <span className="font-bold text-[16px] text-gray-900">뒤로</span>
                </button>
                <div className="flex flex-col items-center absolute left-1/2 -translate-x-1/2">
                    <h3 className="font-bold text-gray-900 text-[16px]">커뮤니티</h3>
                </div>
                <div className="w-20"></div> {/* Placeholder for centering */}
            </div>

            <div className="flex-1 overflow-y-auto bg-white">
                {/* Original Post Preview */}
                <div className="pt-4 pb-3 px-4 flex gap-3 bg-white relative">
                    <div className="flex flex-col items-center flex-shrink-0 pt-0.5">
                        <UserAvatar user={post.author} size="w-9 h-9" />
                    </div>
                    <div className="flex-1 min-w-0 pb-2">
                        <div className="flex items-center gap-1.5 truncate mb-0.5">
                            <span className="font-bold text-gray-900 text-[15px] truncate">{post.author?.name}</span>
                            <span className="text-gray-400 text-[14px]">{formatDateRelative(post.created_at)}</span>
                        </div>
                        <p className="text-gray-900 text-[15px] leading-relaxed whitespace-pre-wrap break-words">{post.content}</p>
                    </div>
                </div>

                {/* Input Form immediately after post */}
                <div className="p-3 sm:p-4 border-b border-gray-100 bg-gray-50/50">
                    <div className="text-[14px] text-gray-500 mb-2 px-1 font-medium">
                        {post.author?.name}님에게 답글 남기는 중...
                    </div>
                    <form onSubmit={handleCreateComment} className="flex gap-2 items-center bg-gray-100 rounded-[24px] p-1.5 shadow-sm border border-gray-200/50">
                        <UserAvatar user={user} size="w-9 h-9 ml-1 shrink-0" />
                        <input
                            type="text"
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="답글 달기..."
                            className="flex-1 min-w-0 bg-transparent border-none outline-none px-2 text-[15px] placeholder:text-gray-400 font-medium"
                            disabled={isSubmitting}
                        />
                        <button
                            type="submit"
                            disabled={!newComment.trim() || isSubmitting}
                            className="px-4 py-1.5 mr-1 shrink-0 text-black bg-white rounded-full disabled:text-gray-300 disabled:bg-transparent shadow-sm disabled:shadow-none transition-all font-bold text-[14px]"
                        >
                            게시
                        </button>
                    </form>
                </div>

                {/* Comments List */}
                <div className="flex flex-col pb-6">
                    {loading ? (
                        <div className="flex justify-center py-10">
                            <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin"></div>
                        </div>
                    ) : comments.length === 0 ? (
                        <p className="text-center text-gray-400 font-bold py-10 text-[15px]">아직 답장이 없습니다.</p>
                    ) : (
                        comments.map(c => (
                            <div key={c.id} className="pt-3 pb-3 px-4 flex gap-3 border-b border-gray-100 bg-white">
                                <div className="flex flex-col items-center flex-shrink-0 pt-0.5">
                                    <UserAvatar user={c.author} size="w-9 h-9" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start mb-0.5">
                                        <div className="flex items-center gap-1.5 truncate">
                                            <span className="font-bold text-gray-900 text-[15px] truncate">{c.author?.name}</span>
                                            <span className="text-gray-400 text-[14px] whitespace-nowrap">{formatDateRelative(c.created_at)}</span>
                                            {c.updated_at && c.updated_at !== c.created_at && (
                                                <span className="text-gray-400 text-[13px] whitespace-nowrap">(수정됨)</span>
                                            )}
                                        </div>
                                        {c.author_id === user?.id && editingCommentId !== c.id && (
                                            <div className="flex gap-2 mr-1">
                                                <button onClick={() => handleEditStart(c)} className="text-gray-400 hover:text-blue-500 font-medium text-[13px] transition-colors">
                                                    수정
                                                </button>
                                                <button onClick={() => handleDelete(c.id)} className="text-gray-400 hover:text-red-500 font-medium text-[13px] transition-colors">
                                                    삭제
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    {editingCommentId === c.id ? (
                                        <div className="mt-1 flex flex-col gap-2">
                                            <textarea
                                                value={editContent}
                                                onChange={(e) => setEditContent(e.target.value)}
                                                className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2 text-[15px] outline-none focus:border-gray-900 focus:bg-white transition-all resize-none overflow-hidden"
                                                rows={Math.max(2, editContent.split('\n').length)}
                                                disabled={isSubmitting}
                                                autoFocus
                                            />
                                            <div className="flex border-t border-gray-100 justify-end gap-2 pt-2">
                                                <button
                                                    onClick={handleEditCancel}
                                                    disabled={isSubmitting}
                                                    className="px-3 py-1.5 text-gray-500 hover:bg-gray-100 rounded-lg text-[13px] font-bold transition-colors disabled:opacity-50"
                                                >
                                                    취소
                                                </button>
                                                <button
                                                    onClick={() => handleEditSubmit(c.id)}
                                                    disabled={!editContent.trim() || editContent === c.content || isSubmitting}
                                                    className="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-[13px] font-bold shadow-sm hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:bg-gray-200 disabled:text-gray-400"
                                                >
                                                    확인
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-gray-900 text-[15px] leading-relaxed break-words mt-0.5">{c.content}</p>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </motion.div>
    );
};

export default CommentSection;
