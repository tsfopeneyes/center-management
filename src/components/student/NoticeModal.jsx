import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import {
    ArrowLeft, ImageIcon, MoreHorizontal, Heart, Bookmark, Share2,
    Calendar, Clock, Calendar as CalendarIcon, Clock as ClockIcon,
    User, ShieldCheck, Edit2, Trash2, MessageSquare
} from 'lucide-react';
import { motion } from 'framer-motion';
import ModernEditor from '../common/ModernEditor';
import UserAvatar from '../common/UserAvatar';
import LinkPreview from '../common/LinkPreview';
import { formatToLocalISO } from '../../utils/dateUtils';
import { stripHtml, extractUrls, extractProgramInfo } from '../../utils/textUtils';

const GalleryPost = ({ notice, user, responses, onResponse, isAdmin, onUpdate, onDelete, onDeleteComment }) => {
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [liked, setLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(0);
    const [joinCount, setJoinCount] = useState(0);
    const [waitlistCount, setWaitlistCount] = useState(0);

    const isGallery = notice.category === 'GALLERY';

    let allImages = [];
    if (notice.images && Array.isArray(notice.images)) {
        allImages = [...notice.images];
    }
    if (allImages.length === 0 && notice.image_url) {
        allImages.push(notice.image_url);
    }

    useEffect(() => {
        fetchLikeStatus();
        fetchParticipantCounts();
        fetchComments();
    }, [notice.id, user]);

    const fetchParticipantCounts = async () => {
        if (!notice.is_recruiting) return;
        try {
            const { data } = await supabase
                .from('notice_responses')
                .select('status')
                .eq('notice_id', notice.id);

            const counts = { JOIN: 0, WAITLIST: 0 };
            data?.forEach(r => {
                if (counts[r.status] !== undefined) counts[r.status]++;
            });
            setJoinCount(counts.JOIN);
            setWaitlistCount(counts.WAITLIST);
        } catch (err) { console.error(err); }
    };

    const fetchLikeStatus = async () => {
        try {
            const { count, error: countError } = await supabase
                .from('notice_likes')
                .select('*', { count: 'exact', head: true })
                .eq('notice_id', notice.id);

            if (!countError) setLikeCount(count || 0);

            const { data, error: statusError } = await supabase
                .from('notice_likes')
                .select('id')
                .eq('notice_id', notice.id)
                .eq('user_id', user.id);

            if (!statusError) setLiked(data?.length > 0);
        } catch (err) {
            console.error('Like fetch error:', err);
        }
    };

    const fetchComments = async () => {
        try {
            const { data } = await supabase
                .from('comments')
                .select('*, users(name, profile_image_url, is_leader)')
                .eq('notice_id', notice.id)
                .order('created_at', { ascending: true });
            setComments(data || []);
        } catch (err) { console.error(err); }
    };

    const handleDeleteComment = async (commentId) => {
        if (!confirm('댓글을 삭제하시겠습니까?')) return;
        try {
            const { error } = await supabase
                .from('comments')
                .delete()
                .eq('id', commentId)
                .eq('user_id', user.id);
            if (error) throw error;
            fetchComments();
        } catch (err) {
            console.error(err);
            alert('댓글 삭제 실패');
        }
    };

    const toggleLike = async () => {
        try {
            if (liked) {
                const { error } = await supabase
                    .from('notice_likes')
                    .delete()
                    .eq('notice_id', notice.id)
                    .eq('user_id', user.id);
                if (!error) {
                    setLiked(false);
                    setLikeCount(prev => Math.max(0, prev - 1));
                }
            } else {
                const { error } = await supabase
                    .from('notice_likes')
                    .insert([{ notice_id: notice.id, user_id: user.id }]);
                if (!error) {
                    setLiked(true);
                    setLikeCount(prev => prev + 1);
                }
            }
        } catch (err) {
            console.error('Like toggle error:', err);
        }
    };

    const handleShare = async () => {
        const shareUrl = `${window.location.origin}/student?noticeId=${notice.id}`;
        const shareData = {
            title: notice.title,
            text: notice.title + ' - 더작은재단 ENTER',
            url: shareUrl,
        };

        if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
            try {
                await navigator.share(shareData);
            } catch (err) {
                if (err.name !== 'AbortError') console.error('Share failed:', err);
            }
        } else {
            try {
                await navigator.clipboard.writeText(shareUrl);
                alert('링크가 클립보드에 복사되었습니다.');
            } catch (err) {
                console.error('Clipboard failed:', err);
                alert('링크 복사에 실패했습니다.');
            }
        }
    };

    const handlePostComment = async (e) => {
        e.preventDefault();
        if (!newComment.trim()) return;
        try {
            const { error } = await supabase.from('comments').insert([{
                notice_id: notice.id,
                user_id: user.id,
                content: newComment
            }]);
            if (error) throw error;
            setNewComment('');
            fetchComments();
        } catch (err) { alert('댓글 작성 실패'); }
    };

    return (
        <div className="border-b border-gray-100 pb-8 bg-white" id={`notice-${notice.id}`}>
            {/* User Info Header */}
            <div className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div>
                        <p className="text-sm font-bold text-gray-900 leading-none">{notice.title}</p>
                        <p className="text-[10px] text-gray-500 mt-1 line-clamp-1">{stripHtml(notice.content)}</p>
                    </div>
                </div>
                {isAdmin && (
                    <div className="flex gap-2">
                        <button onClick={() => onDelete(notice.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-full transition">
                            <Trash2 size={16} />
                        </button>
                    </div>
                )}
            </div>

            {/* Carousel */}
            {allImages.length > 0 ? (
                <div className="bg-gray-100 relative w-full aspect-[4/5] overflow-hidden group">
                    <div
                        className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide h-full w-full"
                        onScroll={(e) => {
                            const index = Math.round(e.target.scrollLeft / e.target.clientWidth);
                            setCurrentImageIndex(index);
                        }}
                    >
                        {allImages.map((img, idx) => (
                            <div key={idx} className="flex-shrink-0 w-full h-full snap-center flex items-center justify-center bg-gray-100 relative">
                                <img
                                    src={img}
                                    alt={`Gallery ${idx}`}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        ))}
                    </div>
                    {allImages.length > 1 && (
                        <div className="absolute top-3 right-3 bg-black/60 text-white text-[10px] px-2 py-1 rounded-full font-bold backdrop-blur-md">
                            {currentImageIndex + 1} / {allImages.length}
                        </div>
                    )}
                </div>
            ) : (
                <div className="aspect-video bg-gray-50 flex items-center justify-center text-gray-400 text-sm border-y border-gray-100">
                    이미지가 없습니다
                </div>
            )}

            {/* Action Bar */}
            <div className="px-3 pt-3 pb-2">
                <div className="flex justify-between items-center mb-2">
                    <div className="flex gap-4">
                        <button onClick={toggleLike} className="hover:opacity-60 transition active:scale-90">
                            <Heart
                                size={26}
                                strokeWidth={liked ? 0 : 1.5}
                                className={liked ? "fill-red-500 text-red-500" : "text-gray-900"}
                            />
                        </button>
                        <button onClick={handleShare} className="hover:opacity-60 transition active:scale-90">
                            <Share2 size={24} strokeWidth={1.5} className="text-gray-900" />
                        </button>
                    </div>
                    <button className="hover:opacity-60 transition">
                        <Bookmark size={24} strokeWidth={1.5} className="text-gray-900" />
                    </button>
                </div>
                <div className="text-sm font-bold text-gray-900 mb-1">좋아요 {likeCount}개</div>

                {/* Caption */}
                <div className="text-sm text-gray-900 mb-2">
                    <span className="font-bold mr-2">{notice.title}</span>
                    <span dangerouslySetInnerHTML={{ __html: notice.content }} className="inline-block" />
                </div>

                {/* Comments Preview */}
                <div className="space-y-1 mb-2">
                    {comments.slice(-2).map(c => (
                        <div key={c.id} className="text-xs flex items-center justify-between group/comment">
                            <div className="flex-1">
                                <span className="font-bold mr-2 flex items-center gap-1">
                                    {c.users?.name}
                                    {c.users?.is_leader && <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="#FACC15" stroke="#FACC15" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-star"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>}
                                </span>
                                <span className="text-gray-600">{c.content}</span>
                            </div>
                            {c.user_id === user.id && (
                                <button onClick={() => handleDeleteComment(c.id)} className="p-1 text-gray-300 hover:text-red-500 transition-colors">
                                    <Trash2 size={12} />
                                </button>
                            )}
                        </div>
                    ))}
                    {comments.length > 2 && (
                        <button className="text-gray-400 text-xs mt-1">댓글 {comments.length}개 모두 보기</button>
                    )}
                </div>

                <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-3">
                    {new Date(notice.created_at).toLocaleDateString()}
                </div>

                {/* Comment Input */}
                <form onSubmit={handlePostComment} className="flex items-center gap-2 border-t border-gray-50 pt-3 mt-2">
                    <UserAvatar user={user} size="w-6 h-6" />
                    <input
                        type="text"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="댓글 달기..."
                        className="flex-1 text-sm bg-transparent outline-none py-1"
                    />
                    {newComment.trim() && (
                        <button type="submit" className="text-blue-500 text-xs font-bold px-2">게시</button>
                    )}
                </form>
            </div>
        </div>
    );
};

const NoticeModal = ({ notice, context, onClose, user, responses, onResponse, comments, newComment, setNewComment, onPostComment, onDeleteComment, onUpdate, onDelete }) => {
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [isEditing, setIsEditing] = useState(false);
    const [editedNotice, setEditedNotice] = useState({ ...notice });

    const isAdmin = user?.role === 'admin';
    const isGallery = notice.category === 'GALLERY';

    useEffect(() => {
        if (isGallery && context && notice.id) {
            const element = document.getElementById(`notice-${notice.id}`);
            if (element) {
                element.scrollIntoView({ behavior: 'auto' });
            }
        }
    }, [notice.id, isGallery, context]);

    let allImages = [];
    if (notice.images && Array.isArray(notice.images)) {
        allImages = [...notice.images];
    }
    if (allImages.length === 0 && notice.image_url) {
        allImages.push(notice.image_url);
    }

    const [joinCount, setJoinCount] = useState(0);
    const [waitlistCount, setWaitlistCount] = useState(0);
    const [liked, setLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(0);
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        if (!notice.recruitment_deadline) return;

        const updateTimer = () => {
            const now = new Date();
            const deadline = new Date(notice.recruitment_deadline);
            if (deadline < now) {
                setTimeLeft('마감됨');
                return;
            }

            const diff = deadline - now;
            if (isNaN(diff)) {
                setTimeLeft('');
                return;
            }

            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            let timeStr = '';
            if (days > 0) timeStr += `${days}일 `;
            timeStr += `${hours}시간 ${minutes}분 ${seconds}초 후 종료`;
            setTimeLeft(timeStr);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [notice.recruitment_deadline]);

    useEffect(() => {
        if (!context) {
            fetchLikeStatus();
            fetchParticipantCounts();
        }
    }, [notice.id, user, responses?.[notice.id]]);

    const fetchParticipantCounts = async () => {
        if (!notice.is_recruiting) return;
        try {
            const { data } = await supabase
                .from('notice_responses')
                .select('status')
                .eq('notice_id', notice.id);

            const counts = { JOIN: 0, WAITLIST: 0 };
            data?.forEach(r => {
                if (counts[r.status] !== undefined) counts[r.status]++;
            });
            setJoinCount(counts.JOIN);
            setWaitlistCount(counts.WAITLIST);
        } catch (err) { console.error(err); }
    };

    const fetchLikeStatus = async () => {
        try {
            const { count, error: countError } = await supabase
                .from('notice_likes')
                .select('*', { count: 'exact', head: true })
                .eq('notice_id', notice.id);

            if (!countError) setLikeCount(count || 0);

            const { data, error: statusError } = await supabase
                .from('notice_likes')
                .select('id')
                .eq('notice_id', notice.id)
                .eq('user_id', user.id);

            if (!statusError) setLiked(data?.length > 0);
        } catch (err) {
            console.error('Like fetch error:', err);
        }
    };

    const toggleLike = async () => {
        try {
            if (liked) {
                const { error } = await supabase
                    .from('notice_likes')
                    .delete()
                    .eq('notice_id', notice.id)
                    .eq('user_id', user.id);
                if (!error) {
                    setLiked(false);
                    setLikeCount(prev => Math.max(0, prev - 1));
                }
            } else {
                const { error } = await supabase
                    .from('notice_likes')
                    .insert([{ notice_id: notice.id, user_id: user.id }]);
                if (!error) {
                    setLiked(true);
                    setLikeCount(prev => prev + 1);
                }
            }
        } catch (err) {
            console.error('Like toggle error:', err);
        }
    };

    const handleShare = async () => {
        const shareUrl = `${window.location.origin}/student?noticeId=${notice.id}`;
        const shareData = {
            title: notice.title,
            text: notice.title + ' - 더작은재단 ENTER',
            url: shareUrl,
        };

        if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
            try {
                await navigator.share(shareData);
            } catch (err) {
                if (err.name !== 'AbortError') console.error('Share failed:', err);
            }
        } else {
            try {
                await navigator.clipboard.writeText(shareUrl);
                alert('링크가 클립보드에 복사되었습니다.');
            } catch (err) {
                console.error('Clipboard failed:', err);
                alert('링크 복사에 실패했습니다.');
            }
        }
    };

    const handleSave = () => {
        onUpdate(editedNotice);
        setIsEditing(false);
    };

    return (
        <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-[110] bg-white flex flex-col sm:max-w-lg mx-auto overflow-hidden shadow-2xl pb-20 gpu-accelerated"
        >
            {/* Header */}
            <div className="h-14 px-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-50 shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={onClose} className="-ml-2 p-2 hover:bg-gray-50 rounded-full transition">
                        <ArrowLeft size={24} className="text-gray-900" />
                    </button>
                    <div>
                        <div className="font-bold text-sm text-gray-900">{isGallery ? notice.title : (isEditing ? '게시물 수정' : '게시물')}</div>
                        {isGallery && (
                            <div className="text-[10px] text-gray-400 font-medium line-clamp-1">{stripHtml(notice.content)}</div>
                        )}
                    </div>
                </div>
                {isAdmin && (
                    <div className="flex items-center gap-2">
                        {isEditing ? (
                            <>
                                <button onClick={() => setIsEditing(false)} className="text-gray-500 text-sm font-medium px-2 py-1">취소</button>
                                <button onClick={handleSave} className="text-blue-600 font-bold text-sm px-3 py-1 bg-blue-50 rounded-lg">저장</button>
                            </>
                        ) : (
                            <>
                                <button onClick={() => setIsEditing(true)} className="p-2 text-gray-600 hover:bg-gray-50 rounded-full">
                                    <Edit2 size={18} />
                                </button>
                                <button onClick={() => onDelete(notice.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-full">
                                    <Trash2 size={18} />
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto pb-20 scrollbar-hide bg-white">
                {isGallery && context ? (
                    <div className="flex flex-col">
                        {context.map((item) => (
                            <GalleryPost
                                key={item.id}
                                notice={item}
                                user={user}
                                responses={responses}
                                onResponse={onResponse}
                                isAdmin={isAdmin}
                                onUpdate={onUpdate}
                                onDelete={onDelete}
                                onDeleteComment={onDeleteComment}
                            />
                        ))}
                    </div>
                ) : isGallery ? (
                    <>
                        {/* User Info Header */}
                        <div className="p-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div>
                                    <p className="text-sm font-bold text-gray-900 leading-none">{notice.title}</p>
                                    <p className="text-[10px] text-gray-500 mt-1">{stripHtml(notice.content)}</p>
                                </div>
                            </div>
                            <button className="text-gray-900">
                                <MoreHorizontal size={20} />
                            </button>
                        </div>

                        {/* Carousel */}
                        {allImages.length > 0 ? (
                            <div className="bg-gray-100 relative w-full aspect-square overflow-hidden group">
                                <div
                                    className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide h-full w-full"
                                    onScroll={(e) => {
                                        const index = Math.round(e.target.scrollLeft / e.target.clientWidth);
                                        setCurrentImageIndex(index);
                                    }}
                                >
                                    {allImages.map((img, idx) => (
                                        <div key={idx} className="flex-shrink-0 w-full h-full snap-center flex items-center justify-center bg-gray-100 relative">
                                            <img
                                                src={img}
                                                alt={`Gallery ${idx}`}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    ))}
                                </div>

                                {allImages.length > 1 && (
                                    <div className="absolute top-3 right-3 bg-black/60 text-white text-[10px] px-2 py-1 rounded-full font-bold backdrop-blur-md">
                                        {currentImageIndex + 1} / {allImages.length}
                                    </div>
                                )}

                                {allImages.length > 1 && (
                                    <div className="absolute -bottom-6 left-0 right-0 flex justify-center gap-1 py-4 pointer-events-none">
                                        {allImages.map((_, idx) => (
                                            <div
                                                key={idx}
                                                className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${idx === currentImageIndex ? 'bg-blue-500' : 'bg-gray-300'}`}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="aspect-video bg-gray-50 flex items-center justify-center text-gray-400 text-sm border-y border-gray-100">
                                이미지가 없습니다
                            </div>
                        )}

                        {/* Action Bar */}
                        <div className="px-3 pt-3 pb-2">
                            <div className="flex justify-between items-center mb-2">
                                <div className="flex gap-4">
                                    <button onClick={toggleLike} className="hover:opacity-60 transition active:scale-90">
                                        <Heart
                                            size={28}
                                            strokeWidth={liked ? 0 : 1.5}
                                            className={liked ? "fill-red-500 text-red-500" : "text-gray-900"}
                                        />
                                    </button>
                                    <button onClick={handleShare} className="hover:opacity-60 transition active:scale-90">
                                        <Share2 size={26} strokeWidth={1.5} className="text-gray-900" />
                                    </button>
                                </div>
                                <button className="hover:opacity-60 transition">
                                    <Bookmark size={26} strokeWidth={1.5} className="text-gray-900" />
                                </button>
                            </div>
                            {/* Likes Count */}
                            <div className="text-sm font-bold text-gray-900 mb-1">
                                좋아요 {likeCount}개
                            </div>

                            {/* Caption */}
                            <div className="text-sm text-gray-900 mb-2">
                                <span className="font-bold mr-2">갤러리</span>
                                <span dangerouslySetInnerHTML={{ __html: notice.content }} className="inline-block" />
                                {extractUrls(notice.content).map((url, i) => (
                                    <LinkPreview key={i} url={url} />
                                ))}
                            </div>

                            <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-3">
                                {new Date(notice.created_at).toLocaleDateString()}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="px-6 py-8">
                        {/* Banner Image */}
                        {allImages.length > 0 && !isEditing && (
                            <div className="mb-6 rounded-2xl overflow-hidden shadow-sm">
                                <img src={allImages[0]} alt="Banner" className="w-full h-48 object-cover" />
                            </div>
                        )}

                        {isEditing ? (
                            <div className="space-y-6">
                                <input
                                    type="text"
                                    value={editedNotice.title}
                                    onChange={(e) => setEditedNotice({ ...editedNotice, title: e.target.value })}
                                    className="w-full text-3xl font-bold border-none outline-none placeholder:text-gray-200"
                                    placeholder="제목 없음"
                                />

                                <div className="space-y-4 border-y border-gray-50 py-6">
                                    <div className="flex items-center gap-4 text-sm">
                                        <div className="w-24 text-gray-400 flex items-center gap-2">
                                            <Calendar size={14} />
                                            <span>마감일</span>
                                        </div>
                                        <input
                                            type="datetime-local"
                                            value={editedNotice.recruitment_deadline ? formatToLocalISO(editedNotice.recruitment_deadline) : ''}
                                            onChange={(e) => setEditedNotice({ ...editedNotice, recruitment_deadline: e.target.value })}
                                            className="flex-1 bg-transparent border-none outline-none font-medium text-base"
                                        />
                                    </div>
                                    <div className="flex items-center gap-4 text-sm">
                                        <div className="w-24 text-gray-400 flex items-center gap-2">
                                            <User size={14} />
                                            <span>정원</span>
                                        </div>
                                        <input
                                            type="number"
                                            value={editedNotice.max_capacity || 0}
                                            onChange={(e) => setEditedNotice({ ...editedNotice, max_capacity: parseInt(e.target.value) })}
                                            className="flex-1 bg-transparent border-none outline-none font-medium text-base"
                                            placeholder="0 = 제한없음"
                                        />
                                    </div>
                                    <div className="flex items-center gap-4 text-sm">
                                        <div className="w-24 text-gray-400 flex items-center gap-2">
                                            <ShieldCheck size={14} />
                                            <span>모집 여부</span>
                                        </div>
                                        <button
                                            onClick={() => setEditedNotice({ ...editedNotice, is_recruiting: !editedNotice.is_recruiting })}
                                            className={`px-3 py-1 rounded-full text-xs font-bold transition ${editedNotice.is_recruiting ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}
                                        >
                                            {editedNotice.is_recruiting ? '모집 중' : '모집 중지'}
                                        </button>
                                    </div>
                                </div>

                                <div className="min-h-[300px]">
                                    <ModernEditor
                                        content={editedNotice.content}
                                        onChange={(content) => setEditedNotice({ ...editedNotice, content })}
                                        placeholder="내용을 입력하세요..."
                                    />
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex justify-between items-start gap-4 mb-4">
                                    <h1 className="text-3xl font-bold text-gray-900 leading-tight">{notice.title}</h1>
                                    <button onClick={handleShare} className="p-2 bg-gray-50 rounded-full text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition shrink-0">
                                        <Share2 size={24} />
                                    </button>
                                </div>

                                {/* Properties Area */}
                                {notice.category !== 'NOTICE' && (
                                    <div className="space-y-4 mb-8 bg-gray-50/50 p-5 rounded-2xl border border-gray-100">
                                        {(() => {
                                            const info = extractProgramInfo(notice.content);
                                            return (
                                                <div className="grid grid-cols-1 gap-y-4 text-sm">
                                                    <div className="flex items-center gap-4">
                                                        <CalendarIcon size={18} className="text-blue-500 shrink-0" />
                                                        <span className="text-gray-400 w-20 shrink-0">일정</span>
                                                        <span className="text-gray-700 font-bold">
                                                            {notice.program_date ? new Date(notice.program_date).toLocaleString('ko-KR', {
                                                                year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                                            }) : (info.date ? new Date(info.date).toLocaleString('ko-KR', {
                                                                year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                                            }) : '미정')}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <ClockIcon size={18} className="text-orange-500 shrink-0" />
                                                        <span className="text-gray-400 w-20 shrink-0">소요시간</span>
                                                        <span className="text-gray-700 font-bold">{info.duration || '미정'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <ShieldCheck size={18} className="text-green-500 shrink-0" />
                                                        <span className="text-gray-400 w-20 shrink-0">장소</span>
                                                        <span className="text-gray-700 font-bold">{info.location || '미정'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <User size={18} className="text-indigo-500 shrink-0" />
                                                        <span className="text-gray-400 w-20 shrink-0">모집인원</span>
                                                        <span className="text-gray-700 font-bold">{notice.max_capacity > 0 ? `${notice.max_capacity}명` : '제한 없음'}</span>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}

                                <div className="prose max-w-none text-gray-800 leading-relaxed mb-10 overflow-hidden">
                                    <div dangerouslySetInnerHTML={{ __html: extractProgramInfo(notice.content).cleanContent }} />
                                    {extractUrls(notice.content).map((url, i) => (
                                        <div key={i} className="mt-4">
                                            <LinkPreview url={url} />
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Recruiting RSVP */}
                {notice.is_recruiting && !isEditing && (
                    <div className="px-6 pb-8">
                        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm relative">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-2">
                                <div className="flex flex-col">
                                    <p className="text-sm font-black text-blue-600">
                                        {notice.program_status === 'COMPLETED' ? '종료된 프로그램' :
                                            notice.program_status === 'CANCELLED' ? '취소된 프로그램' : '참여 여부 선택'}
                                    </p>
                                    {notice.recruitment_deadline && notice.program_status === 'ACTIVE' && (
                                        <p className="text-[11px] font-bold text-red-500 mt-0.5">
                                            {timeLeft}
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="flex flex-col items-end">
                                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">마감 기한</span>
                                        <span className="text-xs font-black text-gray-800">
                                            {notice.recruitment_deadline ? new Date(notice.recruitment_deadline).toLocaleString('ko-KR', {
                                                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                            }) : '미지정'}
                                        </span>
                                    </div>
                                    {notice.max_capacity > 0 && (
                                        <div className="bg-green-100 text-green-600 px-3 py-1.5 rounded-xl text-xs font-black ml-2 shadow-sm border border-green-200/50">
                                            {joinCount} / {notice.max_capacity}명
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-2">
                                {(() => {
                                    const currentStatus = responses[notice.id];
                                    const isFull = notice.max_capacity > 0 && joinCount >= notice.max_capacity;
                                    const isExpired = (notice.recruitment_deadline && new Date(notice.recruitment_deadline) < new Date()) || (notice.program_status !== 'ACTIVE');

                                    let targetStatus = 'JOIN';
                                    let displayLabel = '신청하기';
                                    let colorClass = 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200';

                                    if (currentStatus === 'JOIN') {
                                        displayLabel = '신청 완료';
                                        colorClass = 'bg-gray-100 text-gray-400 border-gray-100';
                                    } else if (currentStatus === 'WAITLIST') {
                                        displayLabel = '대기중';
                                        colorClass = 'bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-200';
                                    } else if (isFull) {
                                        displayLabel = '대기 신청';
                                        targetStatus = 'WAITLIST';
                                        colorClass = 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200';
                                    }

                                    return (
                                        <button
                                            disabled={isExpired}
                                            onClick={() => onResponse(notice.id, targetStatus)}
                                            className={`w-full py-4 rounded-full text-base font-black border transition transform active:scale-95 ${colorClass} ${isExpired ? 'opacity-30 grayscale cursor-not-allowed' : ''}`}
                                        >
                                            {displayLabel}
                                        </button>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                )}

                {/* Comments Section */}
                {(!isGallery || !context) && (
                    <div className="border-t border-gray-50 mt-4">
                        <div className="px-4 py-4 text-sm font-bold text-gray-900 border-b border-gray-50">댓글 {comments.length}</div>
                        {comments.map(c => (
                            <div key={c.id} className="px-4 py-4 flex gap-3 text-sm hover:bg-gray-50 transition group/notice-comment">
                                <UserAvatar user={c.users} size="w-8 h-8" />
                                <div className="flex-1">
                                    <div className="flex items-baseline justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-gray-900">{c.users?.name}</span>
                                            <span className="text-[10px] text-gray-400">{new Date(c.created_at).toLocaleDateString()}</span>
                                        </div>
                                        {c.user_id === user.id && (
                                            <button onClick={() => onDeleteComment(c.id)} className="p-1 text-gray-300 hover:text-red-500 transition-colors">
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-gray-700 mt-1 leading-normal">{c.content}</p>
                                </div>
                            </div>
                        ))}
                        {comments.length === 0 && (
                            <div className="py-12 text-center text-gray-300 text-xs">
                                가장 먼저 댓글을 남겨보세요!
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Input Area */}
            {(!isGallery || !context) && (
                <div className="p-3 border-t border-gray-100 bg-white sticky bottom-0 z-50">
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            onPostComment(e);
                        }}
                        className="flex items-center gap-3"
                    >
                        <UserAvatar user={user} size="w-8 h-8" />
                        <div className="flex-1 bg-gray-100 rounded-full px-4 py-2.5 flex items-center">
                            <input
                                type="text"
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder={`${user.name}(으)로 댓글 달기...`}
                                className="bg-transparent text-base w-full outline-none placeholder:text-gray-400"
                            />
                            {newComment.trim() && (
                                <button type="submit" className="text-blue-600 text-sm font-bold hover:text-blue-800 transition ml-2">
                                    게시
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            )}
        </motion.div>
    );
};

export default NoticeModal;
