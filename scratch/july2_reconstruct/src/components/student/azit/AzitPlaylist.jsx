import React, { useState } from 'react';
import { useGuestbook } from '../../../hooks/useGuestbook';
import { Music, Play, Heart, Plus, MessageSquare, Send, Trash2, Edit2, X } from 'lucide-react';
import UserAvatar from '../../common/UserAvatar';
import AzitWriteModal from './AzitWriteModal';
import AzitReactions from './AzitReactions';

// Helper to extract YouTube ID
const getYouTubeID = (url) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
};

const AzitPlaylist = ({ user, onBack, category }) => {
    const { 
        guestPosts, 
        loading,
        fetchGuestPosts, 
        handleCreatePost, 
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
                        플레이리스트 <span className="text-2xl">🎧</span>
                    </h2>
                </div>
                <button 
                    onClick={() => {
                        setEditingPost(null);
                        setShowWrite(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold hover:bg-indigo-200 transition-colors shadow-sm"
                >
                    <Plus size={14} strokeWidth={3} /> 플리 공유
                </button>
            </div>

            <div className="px-5 space-y-4 mt-2">
                {guestPosts.map(post => {
                    const meta = post.metadata || {};
                    const ytId = getYouTubeID(meta.youtubeUrl);
                    const thumbUrl = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : null;

                    // Support fallback logic for reason extraction
                    const reason = meta.reason || post.content.split('\n\n')[1] || '';
                    
                    const tracks = meta.type === 'PLAYLIST_V2' ? (meta.tracks || []) : [{ title: meta.title, artist: meta.artist, youtubeUrl: meta.youtubeUrl }];
                    const firstTrack = tracks[0] || {};
                    const firstTrackYtId = getYouTubeID(firstTrack.youtubeUrl);
                    const mainThumbUrl = firstTrackYtId ? `https://img.youtube.com/vi/${firstTrackYtId}/hqdefault.jpg` : null;

                    return (
                        <div key={post.id} onClick={(e) => toggleComments(e, post)} className="bg-white p-5 rounded-[2rem] shadow-sm border border-gray-100 cursor-pointer hover:border-indigo-200 transition-all hover:shadow-md flex flex-col gap-4">
                            
                            <div className="flex gap-4 items-center">
                                {/* Representative Thumbnail */}
                                <div className="w-14 h-14 rounded-2xl overflow-hidden bg-gray-100 shrink-0 relative shadow-sm border border-black/5 group">
                                    {mainThumbUrl ? (
                                        <img src={mainThumbUrl} alt="thumbnail" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                                            <Music size={20} />
                                        </div>
                                    )}
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-[16px] font-bold text-gray-900 tracking-tight truncate">
                                        {meta.type === 'PLAYLIST_V2' ? (meta.playlistTitle || '제목 없음') : (meta.title || '제목 없음')}
                                    </h3>
                                    <div className="flex items-center gap-1.5 mt-1 text-[12px] font-medium text-gray-500">
                                        <span>총 {tracks.length}곡</span>
                                        <span className="text-[10px] text-gray-300">•</span>
                                        <span>{post.users?.name}</span>
                                    </div>
                                </div>

                                {post.user_id === user?.id && (
                                    <div className="flex items-center gap-2 self-start mt-1">
                                        <button onClick={(e) => handleEditPostClick(e, post)} className="text-gray-400 p-1.5 hover:bg-gray-100 rounded-full transition">
                                            <Edit2 size={14} />
                                        </button>
                                        <button onClick={(e) => handleDeletePostClick(e, post.id)} className="text-red-400 p-1.5 hover:bg-red-50 rounded-full transition">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                            
                            {/* Expanded Content: Reason, Actions, Comments */}
                            {expandedPostId === post.id && (
                                <div className="animate-fade-in mt-2 border-t border-gray-100 pt-4" onClick={(e) => e.stopPropagation()}>
                                    {/* Tracks Display (Moved inside expanded area) */}
                                    <div className="mb-5 border border-gray-100 rounded-2xl overflow-hidden bg-gray-50 divide-y divide-gray-100">
                                        {tracks.map((track, idx) => {
                                            const trackYtId = getYouTubeID(track.youtubeUrl);
                                            const trackThumbUrl = trackYtId ? `https://img.youtube.com/vi/${trackYtId}/hqdefault.jpg` : null;

                                            return (
                                                <div key={idx} className="flex gap-3 items-center p-2 py-2.5 hover:bg-gray-100 transition-colors">
                                                    <span className="w-5 text-center font-bold text-gray-400 text-xs shrink-0">{idx + 1}</span>
                                                    
                                                    {/* Thumbnail (Minimal) */}
                                                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-white shrink-0 relative shadow-sm border border-black/5 group">
                                                        {trackThumbUrl ? (
                                                            <a href={track.youtubeUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="block w-full h-full">
                                                                <img src={trackThumbUrl} alt="thumbnail" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                                                <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                                                                    <div className="w-5 h-5 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center pl-0.5 text-indigo-600 shadow-sm">
                                                                        <Play size={8} strokeWidth={3} />
                                                                    </div>
                                                                </div>
                                                            </a>
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-gray-300">
                                                                <Music size={16} />
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="text-[14px] font-bold text-gray-800 truncate">{track.title || '제목 없음'}</h4>
                                                        <p className="text-[11px] font-bold text-indigo-500 truncate mt-0.5">{track.artist || '아티스트 미상'}</p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Reason Display */}
                                    {reason && (
                                        <p className="text-[15px] font-medium text-gray-700 whitespace-pre-wrap leading-relaxed mb-4 px-1">
                                            {reason}
                                        </p>
                                    )}

                                    {/* Actions */}
                                    <div className="flex items-center justify-between mb-3 px-1">
                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center gap-1.5 text-sm font-bold text-indigo-500">
                                                <MessageSquare size={18} /> 
                                                <span>댓글 {(comments[post.id]?.length || 0) > 0 ? comments[post.id].length : ''}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Emoji Reactions System */}
                                    <AzitReactions 
                                        reactions={post.guest_post_reactions} 
                                        currentUserId={user?.id}
                                        onToggleReaction={(emoji) => handleReactionClick(post.id, emoji)}
                                    />

                                    {/* Comments Thread */}
                                    <div className="bg-gray-50 rounded-2xl p-4 mt-2">
                                        <div className="space-y-3 mb-4 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                            {(comments[post.id] || []).map(c => (
                                                <div key={c.id} className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100">
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
                                                                className="flex-1 bg-white border border-gray-200 rounded-full px-3 py-1 text-[13px] outline-none focus:border-indigo-300" 
                                                                autoFocus
                                                            />
                                                            <button type="submit" className="text-indigo-600 font-bold text-[13px] hover:text-indigo-700 shrink-0">저장</button>
                                                            <button type="button" onClick={() => setEditingCommentId(null)} className="text-gray-400 hover:text-gray-600 shrink-0"><X size={14}/></button>
                                                        </form>
                                                    ) : (
                                                        <p className="text-[13px] text-gray-600 ml-7 leading-relaxed">{c.content}</p>
                                                    )}
                                                </div>
                                            ))}
                                            {!(comments[post.id]?.length > 0) && (
                                                <p className="text-center text-xs text-gray-400 py-3">아직 댓글이 없습니다. 첫 댓글을 남겨보세요!</p>
                                            )}
                                        </div>
                                        
                                        <form onSubmit={(e) => handleCommentSubmit(e, post.id)} className="flex gap-2">
                                            <input 
                                                type="text" 
                                                value={newComment} 
                                                onChange={(e) => setNewComment(e.target.value)} 
                                                placeholder="댓글 작성..." 
                                                className="flex-1 bg-white border border-gray-200 rounded-full px-4 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 transition-all font-medium" 
                                            />
                                            <button 
                                                type="submit" 
                                                disabled={!newComment.trim()} 
                                                className="bg-gray-900 text-white w-9 h-9 rounded-full flex items-center justify-center hover:bg-indigo-600 disabled:bg-gray-300 transition-colors shrink-0 shadow-sm"
                                            >
                                                <Send size={14} className="ml-0.5" />
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}

                {!loading && guestPosts.length === 0 && (
                    <div className="text-center py-24 text-gray-400">
                        <Music size={48} className="mx-auto mb-3 text-gray-200" />
                        <p className="font-bold">함께 듣고 싶은 찬양을 가장 먼저 공유해주세요!</p>
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

export default AzitPlaylist;
