import React, { useState, useEffect } from 'react';
import { useGuestbook } from '../../../hooks/useGuestbook';
import { MessageSquare, Heart, Plus, Send, Trash2, Edit2, X } from 'lucide-react';
import UserAvatar from '../../common/UserAvatar';
import LinkPreview from '../../common/LinkPreview';
import { extractUrls } from '../../../utils/textUtils';
import AzitWriteModal from './AzitWriteModal';
import AzitReactions from './AzitReactions';

const AzitQT = ({ user, onBack, category }) => {
    const { 
        guestPosts, 
        loading,
        fetchGuestPosts, 
        handleCreatePost, 
        handleUpdatePost,
        handleToggleReaction,
        handleDeletePost,
        uploadingGuest,
        fetchComments,
        handlePostComment,
        handleUpdateComment,
        handleDeleteComment
    } = useGuestbook(user.id, category);

    const [showWrite, setShowWrite] = useState(false);
    const [editingPost, setEditingPost] = useState(null);
    const [expandedPostId, setExpandedPostId] = useState(null);
    const [comments, setComments] = useState({});
    const [newComment, setNewComment] = useState('');
    const [editingCommentId, setEditingCommentId] = useState(null);
    const [editCommentContent, setEditCommentContent] = useState('');

    const handleReactionClick = async (postId, emoji) => {
        await handleToggleReaction(postId, emoji);
    };

    const toggleComments = async (e, post) => {
        e.stopPropagation();
        if (expandedPostId === post.id) {
            setExpandedPostId(null);
            return;
        }
        setExpandedPostId(post.id);
        const data = await fetchComments(post.id);
        setComments(prev => ({ ...prev, [post.id]: data || [] }));
    };

    const handleCommentSubmit = async (e, postId) => {
        e.preventDefault();
        if (!newComment.trim()) return;
        const success = await handlePostComment(postId, newComment);
        if (success) {
            setNewComment('');
            const data = await fetchComments(postId);
            setComments(prev => ({ ...prev, [postId]: data || [] }));
        }
    };

    const handleDeleteCommentClick = async (postId, commentId) => {
        if (!window.confirm('댓글을 삭제하시겠습니까?')) return;
        const success = await handleDeleteComment(postId, commentId);
        if (success) {
            const data = await fetchComments(postId);
            setComments(prev => ({ ...prev, [postId]: data || [] }));
        }
    };

    const handleUpdateCommentSubmit = async (e, postId, commentId) => {
        e.preventDefault();
        if (!editCommentContent.trim()) return;
        const success = await handleUpdateComment(commentId, editCommentContent);
        if (success) {
            setEditingCommentId(null);
            setEditCommentContent('');
            const data = await fetchComments(postId);
            setComments(prev => ({ ...prev, [postId]: data || [] }));
        }
    };

    const handleDeletePostClick = async (e, postId) => {
        e.stopPropagation();
        if (!window.confirm('게시글을 삭제하시겠습니까? 연관된 댓글도 함께 삭제됩니다.')) return;
        await handleDeletePost(postId);
    };

    const handleEditPostClick = (e, post) => {
        e.stopPropagation();
        setEditingPost(post);
        setShowWrite(true);
    };
    return (
        <div className="animate-fade-in pb-32 bg-gray-50 min-h-screen">
            <div className="px-5 pt-5 pb-4 sticky top-0 bg-gray-50/95 backdrop-blur-xl z-20 flex justify-between items-center border-b border-gray-100/50 mb-6 shadow-sm">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 bg-white rounded-full shadow-sm text-gray-700 hover:bg-gray-100 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"></path></svg>
                    </button>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-1.5">
                        QT 나눔 <span className="text-2xl">🌱</span>
                    </h2>
                </div>
                <button 
                    onClick={() => {
                        setEditingPost(null);
                        setShowWrite(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-pink-100 text-pink-700 rounded-full text-xs font-bold hover:bg-pink-200 transition-colors shadow-sm"
                >
                    <Plus size={14} strokeWidth={3} /> 새글작성
                </button>
            </div>

            <div className="px-5 space-y-5 mt-2">
                {guestPosts.map(post => {
                    return (
                        <div key={post.id} onClick={(e) => toggleComments(e, post)} className="bg-white p-5 rounded-[2rem] shadow-sm border border-gray-100 cursor-pointer hover:border-pink-200 transition-colors">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <UserAvatar user={post.users} />
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-gray-800">{post.users?.name}</p>
                                        <p className="text-[10px] text-gray-400">{new Date(post.created_at).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                {post.user_id === user?.id && (
                                    <div className="flex items-center gap-2">
                                        <button onClick={(e) => handleEditPostClick(e, post)} className="text-gray-400 p-1.5 hover:bg-gray-100 rounded-full transition">
                                            <Edit2 size={14} />
                                        </button>
                                        <button onClick={(e) => handleDeletePostClick(e, post.id)} className="text-red-400 p-1.5 hover:bg-red-50 rounded-full transition">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                            
                            <p className="text-sm text-gray-700 mb-3 whitespace-pre-wrap leading-relaxed">
                                {post.content}
                            </p>
                            
                            {/* Image Display */}
                            {(post.images?.length > 0 || post.image_url) && (
                                <div className={`mb-4 rounded-2xl overflow-hidden shadow-sm ${(post.images?.length > 1) ? 'grid grid-cols-2 gap-0.5 aspect-square' : 'bg-gray-50'}`}>
                                    {post.images?.length > 1 ? (
                                        post.images.slice(0, 4).map((img, idx) => (
                                            <div key={idx} className="relative aspect-square">
                                                <img src={img} alt="post" className="w-full h-full object-cover" />
                                                {idx === 3 && post.images.length > 4 && (
                                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white font-bold">
                                                        +{post.images.length - 4}
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    ) : (
                                        <img
                                            src={post.images?.[0] || post.image_url}
                                            alt="post"
                                            className="w-full h-auto max-h-[400px] object-contain mx-auto"
                                        />
                                    )}
                                </div>
                            )}

                            <div className="flex items-center justify-between border-t border-gray-50 pt-3">
                                {/* Emoji Reactions System */}
                                <AzitReactions 
                                    reactions={post.guest_post_reactions} 
                                    currentUserId={user?.id}
                                    onToggleReaction={(emoji) => handleReactionClick(post.id, emoji)}
                                />
                                
                                <button 
                                    onClick={(e) => toggleComments(e, post)}
                                    className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-blue-500 transition-colors self-end"
                                >
                                    <MessageSquare size={16} /> 
                                    <span>댓글 {(comments[post.id]?.length || 0) > 0 ? comments[post.id].length : ''}</span>
                                </button>
                            </div>

                            {/* Inline Comments Section */}
                            {expandedPostId === post.id && (
                                <div className="mt-4 pt-4 border-t border-gray-100 animate-fade-in" onClick={e => e.stopPropagation()}>
                                    <div className="space-y-3 mb-4 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                        {(comments[post.id] || []).map(c => (
                                            <div key={c.id} className="bg-gray-50 p-3 rounded-2xl">
                                                <div className="flex justify-between items-start mb-1">
                                                    <div className="flex items-center gap-2">
                                                        <UserAvatar user={c.users} size="w-5 h-5" textSize="text-[10px]" />
                                                        <span className="font-bold text-xs text-gray-800">{c.users?.name}</span>
                                                    </div>
                                                    {c.user_id === user?.id && (
                                                        <div className="flex items-center gap-1">
                                                            <button onClick={() => { setEditingCommentId(c.id); setEditCommentContent(c.content); }} className="text-gray-400 p-1 hover:bg-gray-100 rounded-full transition">
                                                                <Edit2 size={12} />
                                                            </button>
                                                            <button onClick={() => handleDeleteCommentClick(post.id, c.id)} className="text-red-400 p-1 hover:bg-red-50 rounded-full transition">
                                                                <Trash2 size={12} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                                {editingCommentId === c.id ? (
                                                    <form onSubmit={(e) => handleUpdateCommentSubmit(e, post.id, c.id)} className="flex items-center gap-2 mt-1">
                                                        <input 
                                                            type="text" 
                                                            value={editCommentContent} 
                                                            onChange={(e) => setEditCommentContent(e.target.value)}
                                                            className="flex-1 bg-white border border-gray-200 rounded-full px-3 py-1 text-[13px] outline-none focus:border-pink-300" 
                                                            autoFocus
                                                        />
                                                        <button type="submit" className="text-pink-600 font-bold text-[13px] hover:text-pink-700 shrink-0">저장</button>
                                                        <button type="button" onClick={() => setEditingCommentId(null)} className="text-gray-400 hover:text-gray-600 shrink-0"><X size={14}/></button>
                                                    </form>
                                                ) : (
                                                    <p className="text-sm text-gray-600 ml-7 leading-relaxed">{c.content}</p>
                                                )}
                                            </div>
                                        ))}
                                        {!(comments[post.id]?.length > 0) && (
                                            <p className="text-center text-xs text-gray-400 py-3">아직 댓글이 없습니다. 첫 댓글을 남겨주세요!</p>
                                        )}
                                    </div>
                                    
                                    <form onSubmit={(e) => handleCommentSubmit(e, post.id)} className="flex gap-2">
                                        <input 
                                            type="text" 
                                            value={newComment} 
                                            onChange={(e) => setNewComment(e.target.value)} 
                                            placeholder="댓글을 남겨보세요..." 
                                            className="flex-1 bg-gray-50 border border-gray-100 rounded-full px-4 py-2 text-sm outline-none focus:border-pink-300 focus:bg-white transition-all" 
                                        />
                                        <button 
                                            type="submit" 
                                            disabled={!newComment.trim()} 
                                            className="bg-pink-600 text-white p-2 rounded-full hover:bg-pink-700 disabled:bg-gray-300 transition shrink-0 flex items-center justify-center p-2.5"
                                        >
                                            <Send size={16} />
                                        </button>
                                    </form>
                                </div>
                            )}
                        </div>
                    );
                })}
                {!loading && guestPosts.length === 0 && (
                    <div className="text-center py-24 text-gray-400">
                        <MessageSquare size={48} className="mx-auto mb-3 text-gray-200" />
                        <p className="font-bold">첫 말씀 나눔의 주인공이 되어보세요!</p>
                    </div>
                )}
            </div>

            {showWrite && (
                <AzitWriteModal 
                    category={category}
                    isEdit={!!editingPost}
                    initialData={editingPost}
                    onClose={() => { setShowWrite(false); setEditingPost(null); }}
                    onSubmit={async (content, images, existingImages, meta) => {
                        let success = false;
                        if (editingPost) {
                            success = await handleUpdatePost(editingPost.id, content, images, existingImages, meta);
                        } else {
                            success = await handleCreatePost(content, images, category, meta);
                        }
                        if(success) {
                            setShowWrite(false);
                            setEditingPost(null);
                        }
                    }}
                    uploading={uploadingGuest}
                />
            )}

        </div>
    );
};

export default AzitQT;
