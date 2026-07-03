import React, { useState, useEffect, useMemo } from 'react';
import { useGuestbook } from '../../../hooks/useGuestbook';
import { guestbookApi } from '../../../api/guestbookApi';
import { MessageSquare, Heart, Plus, Send, Trash2, Edit2, X, Info, HelpCircle } from 'lucide-react';
import UserAvatar from '../../common/UserAvatar';
import AzitWriteModal from './AzitWriteModal';
import AzitReactions from './AzitReactions';

const PROGRAM_START_DATE = '2026-03-30'; // Admin can change this.

// Helper function to map week number to PDF card index
const getCardIndexForWeek = (weekNumber) => {
    // 1-indexed
    const roundNum = Math.ceil(weekNumber / 6);
    const categoryNum = ((weekNumber - 1) % 6) + 1;
    return (categoryNum - 1) * 10 + roundNum;
};

const AzitWeeklyQuestion = ({ user, onBack, category }) => {
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

    const [weeklyQuestion, setWeeklyQuestion] = useState(null);
    const [loadingQuestion, setLoadingQuestion] = useState(true);

    const [showWrite, setShowWrite] = useState(false);
    const [editingPost, setEditingPost] = useState(null);
    const [expandedPostId, setExpandedPostId] = useState(null);
    const [showingQuestionFor, setShowingQuestionFor] = useState(null);
    const [comments, setComments] = useState({});
    const [newComment, setNewComment] = useState('');
    const [editingCommentId, setEditingCommentId] = useState(null);
    const [editCommentContent, setEditCommentContent] = useState('');

    const currentWeekNumber = useMemo(() => {
        const start = new Date(PROGRAM_START_DATE);
        start.setHours(0,0,0,0);
        const now = new Date();
        const diffTime = Math.abs(now - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const week = Math.floor(diffDays / 7) + 1;
        return week > 60 ? 60 : week;
    }, []);

    useEffect(() => {
        const getQuestion = async () => {
            try {
                const data = await guestbookApi.fetchWeeklyQuestion(currentWeekNumber);
                setWeeklyQuestion(data);
            } catch (error) {
                console.error("Failed to fetch weekly question", error);
            } finally {
                setLoadingQuestion(false);
            }
        };
        getQuestion();
    }, [currentWeekNumber]);

    // Only show posts that belong to the current week's question (or just all for this category if we want a continuous feed, but usually metadata filters it)
    const currentWeekPosts = guestPosts.filter(post => post.metadata?.week_number === currentWeekNumber);

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
        if (!window.confirm('답변을 삭제하시겠습니까? 연관된 댓글도 함께 삭제됩니다.')) return;
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
                        위클리 퀘스천 <span className="text-2xl">🤔</span>
                    </h2>
                </div>
                <button 
                    onClick={() => {
                        setEditingPost(null);
                        setShowWrite(true);
                    }}
                    disabled={loadingQuestion || !weeklyQuestion}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-xs font-bold hover:bg-blue-200 transition-colors shadow-sm disabled:opacity-50"
                >
                    <Plus size={14} strokeWidth={3} /> 답변하기
                </button>
            </div>

            <div className="px-5 space-y-6 mt-4">
                {/* Question Banner Image & Fallback */}
                {loadingQuestion ? (
                    <div className="bg-gray-100 rounded-3xl p-6 shadow-sm relative overflow-hidden animate-pulse aspect-[4/3] w-full"></div>
                ) : weeklyQuestion ? (
                <div className="flex justify-center w-full">
                    <div className="relative w-[90%] max-w-sm rounded-[2rem] shadow-[0_15px_40px_-15px_rgba(0,0,0,0.15)] overflow-hidden bg-white transform transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_25px_50px_-15px_rgba(0,0,0,0.25)] ring-1 ring-gray-900/5 group">
                        <img 
                            src={`/cards/${getCardIndexForWeek(currentWeekNumber)}.jpg`} 
                            alt={`Week ${currentWeekNumber} Question`} 
                            className="w-full h-auto object-cover scale-[1.03] transition-transform duration-700 ease-out group-hover:scale-[1.06]"
                            onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextElementSibling.style.display = 'block';
                            }}
                        />
                        <div className="hidden bg-gradient-to-br from-blue-600 to-indigo-700 p-6 text-white h-full relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
                            <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-400/20 rounded-full blur-xl -ml-5 -mb-5 pointer-events-none"></div>
                            <div className="relative z-10">
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="bg-white/20 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider backdrop-blur-sm">
                                        Week {currentWeekNumber}
                                    </span>
                                    <span className="bg-black/20 text-blue-50 text-[10px] font-bold px-2.5 py-1 rounded-full backdrop-blur-sm">
                                        {weeklyQuestion.category}
                                    </span>
                                </div>
                                <h3 className="text-xl font-bold mb-2 leading-tight">
                                    {weeklyQuestion.main_question}
                                </h3>
                                {weeklyQuestion.sub_question && (
                                    <p className="text-blue-100 text-sm font-medium opacity-90">
                                        {weeklyQuestion.sub_question}
                                    </p>
                                )}
                                <div className="mt-4 flex items-center gap-1.5 text-[10px] text-blue-100/70 bg-black/10 inline-flex px-3 py-1.5 rounded-xl backdrop-blur-sm">
                                    <Info size={12} /> 이번 주 첫 답변 시 하이픈 1개가 지급됩니다.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                ) : (
                    <div className="bg-gray-100 rounded-3xl p-6 text-center py-10 shadow-sm relative z-10">
                        <p className="font-bold opacity-80 text-gray-500">이번 주 질문이 아직 등록되지 않았습니다.</p>
                    </div>
                )}

                {/* Answers Feed */}
                <div className="space-y-5">
                    <div className="flex items-center justify-between px-2">
                        <h4 className="font-bold text-gray-800 flex items-center gap-2">
                            친구들의 답변 <span className="bg-blue-100 text-blue-600 text-xs px-2 py-0.5 rounded-full">{currentWeekPosts.length}</span>
                        </h4>
                    </div>

                    {currentWeekPosts.map(post => {
                        return (
                            <div key={post.id} onClick={(e) => toggleComments(e, post)} className="bg-white p-5 rounded-[2rem] shadow-sm border border-gray-100 cursor-pointer hover:border-blue-200 transition-colors">
                                <div className="flex items-center justify-between mb-3 relative">
                                    <div className="flex items-center gap-3">
                                        <UserAvatar user={post.users} />
                                        <div>
                                            <p className="text-sm font-bold text-gray-800">{post.users?.name}</p>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <p className="text-[10px] text-gray-400">{new Date(post.created_at).toLocaleDateString()}</p>
                                                {/* 질문 보기 버튼 */}
                                                <button 
                                                    onClick={(e) => { 
                                                        e.stopPropagation(); 
                                                        setShowingQuestionFor(showingQuestionFor === post.id ? null : post.id); 
                                                    }}
                                                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold transition-colors ${
                                                        showingQuestionFor === post.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                                    }`}
                                                >
                                                    <HelpCircle size={10} strokeWidth={3} /> 질문
                                                </button>
                                            </div>
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

                                    {/* Tooltip for Question */}
                                    {showingQuestionFor === post.id && (
                                        <div className="absolute top-12 left-0 z-10 w-full bg-blue-50/95 backdrop-blur-md rounded-xl p-4 border border-blue-200 shadow-sm animate-fade-in text-sm" onClick={e => e.stopPropagation()}>
                                            <p className="font-black text-blue-900 mb-2 flex items-center gap-1.5">
                                                <HelpCircle size={14} className="text-blue-500" /> 답변한 질문 
                                                <span className="bg-blue-200 text-blue-800 text-[10px] px-2 py-0.5 rounded-full ml-1 shadow-sm">
                                                    {new Date(post.created_at).getFullYear().toString().slice(2)}/{new Date(post.created_at).getMonth() + 1} Week {post.metadata?.week_number || currentWeekNumber}
                                                </span>
                                            </p>
                                            <p className="font-bold text-gray-900 mb-1 leading-tight">
                                                {post.metadata?.question_main || (post.metadata?.week_number === currentWeekNumber ? weeklyQuestion?.main_question : "등록된 질문 내용을 불러올 수 없습니다.")}
                                            </p>
                                            {(post.metadata?.question_sub || (post.metadata?.week_number === currentWeekNumber && weeklyQuestion?.sub_question)) && (
                                                <p className="text-xs text-blue-700 font-medium opacity-90 leading-snug">
                                                    {post.metadata?.question_sub || weeklyQuestion?.sub_question}
                                                </p>
                                            )}
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
                                        className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-indigo-500 transition-colors self-end"
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
                                                                className="flex-1 bg-white border border-gray-200 rounded-full px-3 py-1 text-[13px] outline-none focus:border-blue-300" 
                                                                autoFocus
                                                            />
                                                            <button type="submit" className="text-blue-600 font-bold text-[13px] hover:text-blue-700 shrink-0">저장</button>
                                                            <button type="button" onClick={() => setEditingCommentId(null)} className="text-gray-400 hover:text-gray-600 shrink-0"><X size={14}/></button>
                                                        </form>
                                                    ) : (
                                                        <p className="text-sm text-gray-600 ml-7 leading-relaxed">{c.content}</p>
                                                    )}
                                                </div>
                                            ))}
                                            {!(comments[post.id]?.length > 0) && (
                                                <p className="text-center text-xs text-gray-400 py-3">아직 댓글이 없습니다. 첫 공감 요정이 되어주세요!</p>
                                            )}
                                        </div>
                                        
                                        <form onSubmit={(e) => handleCommentSubmit(e, post.id)} className="flex gap-2">
                                            <input 
                                                type="text" 
                                                value={newComment} 
                                                onChange={(e) => setNewComment(e.target.value)} 
                                                placeholder="따뜻한 댓글을 남겨보세요..." 
                                                className="flex-1 bg-gray-50 border border-gray-100 rounded-full px-4 py-2 text-sm outline-none focus:border-blue-300 focus:bg-white transition-all" 
                                            />
                                            <button 
                                                type="submit" 
                                                disabled={!newComment.trim()} 
                                                className="bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 disabled:bg-gray-300 transition shrink-0 flex items-center justify-center p-2.5"
                                            >
                                                <Send size={16} />
                                            </button>
                                        </form>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {!loading && currentWeekPosts.length === 0 && (
                        <div className="text-center py-24 text-gray-400">
                            <MessageSquare size={48} className="mx-auto mb-3 text-gray-200" />
                            <p className="font-bold">가장 먼저 답변을 작성해보세요!</p>
                        </div>
                    )}
                </div>
            </div>

            {showWrite && (
                <AzitWriteModal 
                    category={category}
                    isEdit={!!editingPost}
                    initialData={editingPost}
                    weeklyQuestion={weeklyQuestion}
                    onClose={() => { setShowWrite(false); setEditingPost(null); }}
                    onSubmit={async (content, images, existingImages, meta) => {
                        let success = false;
                        
                        // Attach week_number and question_id to metadata
                        const finalMeta = {
                            ...meta,
                            week_number: currentWeekNumber,
                            question_id: weeklyQuestion?.id,
                            question_main: weeklyQuestion?.main_question,
                            question_sub: weeklyQuestion?.sub_question
                        };

                        if (editingPost) {
                            success = await handleUpdatePost(editingPost.id, content, images, existingImages, finalMeta);
                        } else {
                            success = await handleCreatePost(content, images, category, finalMeta);
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

export default AzitWeeklyQuestion;
