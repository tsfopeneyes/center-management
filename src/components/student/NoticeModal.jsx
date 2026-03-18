import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import {
    ArrowLeft, ImageIcon, MoreHorizontal, Heart, Bookmark, Share2,
    Calendar, Clock, Calendar as CalendarIcon, Clock as ClockIcon,
    User, ShieldCheck, Edit2, Trash2, MessageSquare, ZoomIn, X,
    ChevronLeft, ChevronRight
} from 'lucide-react';
import { motion } from 'framer-motion';
import ModernEditor from '../common/ModernEditor';
import UserAvatar from '../common/UserAvatar';
import LinkPreview from '../common/LinkPreview';
import { formatToLocalISO } from '../../utils/dateUtils';
import { stripHtml, extractUrls, extractProgramInfo } from '../../utils/textUtils';
import { noticesApi } from '../../api/noticesApi';

const GalleryPost = ({ notice, user, responses, onResponse, isAdmin, fromAdmin = false, onUpdate, onDelete, onDeleteComment }) => {
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');
    const [liked, setLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(0);
    const [joinCount, setJoinCount] = useState(0);
    const [waitlistCount, setWaitlistCount] = useState(0);
    const [zoomedImage, setZoomedImage] = useState(null);

    const isGallery = notice.category === 'GALLERY';

    let allImages = [];
    if (notice.images && Array.isArray(notice.images)) {
        allImages = [...notice.images];
    }
    if (allImages.length === 0 && notice.image_url) {
        allImages.push(notice.image_url);
    }

    const scrollRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);

    const handleMouseDown = (e) => {
        setIsDragging(true);
        setStartX(e.pageX - scrollRef.current.offsetLeft);
        setScrollLeft(scrollRef.current.scrollLeft);
    };

    const handleMouseLeave = () => setIsDragging(false);
    const handleMouseUp = () => setIsDragging(false);

    const handleMouseMove = (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const x = e.pageX - scrollRef.current.offsetLeft;
        const walk = (x - startX) * 2;
        scrollRef.current.scrollLeft = scrollLeft - walk;
    };

    const scrollPrev = () => {
        if (scrollRef.current) {
            scrollRef.current.scrollBy({ left: -scrollRef.current.clientWidth, behavior: 'smooth' });
        }
    };

    const scrollNext = () => {
        if (scrollRef.current) {
            scrollRef.current.scrollBy({ left: scrollRef.current.clientWidth, behavior: 'smooth' });
        }
    };

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
                {isAdmin && fromAdmin && (
                    <div className="flex gap-2">
                        <button onClick={() => onDelete(notice.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-full transition">
                            <Trash2 size={16} />
                        </button>
                    </div>
                )}
            </div>

            {/* Carousel */}
            {allImages.length > 0 ? (
                <div className="bg-gray-100 relative w-full overflow-hidden group">
                    <div
                        ref={scrollRef}
                        className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide w-full cursor-grab active:cursor-grabbing select-none"
                        onMouseDown={handleMouseDown}
                        onMouseLeave={handleMouseLeave}
                        onMouseUp={handleMouseUp}
                        onMouseMove={handleMouseMove}
                        onScroll={(e) => {
                            const index = Math.round(e.target.scrollLeft / e.target.clientWidth);
                            setCurrentImageIndex(index);
                        }}
                    >
                        {allImages.map((img, idx) => (
                            <div key={idx} className="flex-shrink-0 w-full snap-center flex items-center justify-center bg-gray-50 relative group/img">
                                <img
                                    src={img}
                                    alt={`Gallery ${idx}`}
                                    className="w-full h-auto object-contain pointer-events-none"
                                />
                            </div>
                        ))}
                    </div>

                    {/* Navigation Arrows */}
                    {allImages.length > 1 && (
                        <>
                            <button
                                onClick={(e) => { e.stopPropagation(); scrollPrev(); }}
                                className={`absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-gray-900 shadow-xl backdrop-blur-md flex items-center justify-center transition-all duration-300 z-10 opacity-0 group-hover:opacity-100 active:scale-90 ${currentImageIndex === 0 ? 'invisible' : 'visible'}`}
                            >
                                <ChevronLeft size={20} />
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); scrollNext(); }}
                                className={`absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-gray-900 shadow-xl backdrop-blur-md flex items-center justify-center transition-all duration-300 z-10 opacity-0 group-hover:opacity-100 active:scale-90 ${currentImageIndex === allImages.length - 1 ? 'invisible' : 'visible'}`}
                            >
                                <ChevronRight size={20} />
                            </button>
                            <div className="absolute top-3 right-3 bg-black/60 text-white text-[10px] px-2 py-1 rounded-full font-bold backdrop-blur-md z-10">
                                {currentImageIndex + 1} / {allImages.length}
                            </div>
                        </>
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

            {/* Zoom Overlay */}
            {zoomedImage && (
                <div 
                    className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 cursor-pointer animate-fade-in"
                    onClick={() => setZoomedImage(null)}
                >
                    <button className="absolute top-6 right-6 text-white bg-white/10 p-2 rounded-full hover:bg-white/20 transition">
                        <X size={32} />
                    </button>
                    <img src={zoomedImage} className="max-w-full max-h-full object-contain animate-zoom-in shadow-2xl" alt="Zoomed" />
                </div>
            )}
        </div>
    );
};

const NoticeModal = ({ notice, context, onClose, user, fromAdmin = false, responses, onResponse, comments, newComment, setNewComment, onPostComment, onDeleteComment, onUpdate, onDelete }) => {
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [isEditing, setIsEditing] = useState(false);
    const [editedNotice, setEditedNotice] = useState({ ...notice });
    const [zoomedImage, setZoomedImage] = useState(null);

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
    const bannerScrollRef = useRef(null);
    const [isBannerDragging, setIsBannerDragging] = useState(false);
    const [bannerStartX, setBannerStartX] = useState(0);
    const [bannerScrollLeft, setBannerScrollLeft] = useState(0);

    const handleBannerMouseDown = (e) => {
        setIsBannerDragging(true);
        setBannerStartX(e.pageX - bannerScrollRef.current.offsetLeft);
        setBannerScrollLeft(bannerScrollRef.current.scrollLeft);
    };

    const handleBannerMouseLeave = () => setIsBannerDragging(false);
    const handleBannerMouseUp = () => setIsBannerDragging(false);

    const handleBannerMouseMove = (e) => {
        if (!isBannerDragging) return;
        e.preventDefault();
        const x = e.pageX - bannerScrollRef.current.offsetLeft;
        const walk = (x - bannerStartX) * 2;
        bannerScrollRef.current.scrollLeft = bannerScrollLeft - walk;
    };

    const scrollPrev = () => {
        if (bannerScrollRef.current) {
            bannerScrollRef.current.scrollBy({ left: -bannerScrollRef.current.clientWidth, behavior: 'smooth' });
        }
    };

    const scrollNext = () => {
        if (bannerScrollRef.current) {
            bannerScrollRef.current.scrollBy({ left: bannerScrollRef.current.clientWidth, behavior: 'smooth' });
        }
    };

    // --- Poll State ---
    const [userVotes, setUserVotes] = useState([]);
    const [pendingVotes, setPendingVotes] = useState([]);
    const [isSubmittingPoll, setIsSubmittingPoll] = useState(false);
    const [pollResults, setPollResults] = useState({});
    const [pollTotalVotes, setPollTotalVotes] = useState(0);
    const [pollTimeLeft, setPollTimeLeft] = useState('');
    const [isPollExpired, setIsPollExpired] = useState(false);

    const fetchPollData = async () => {
        if (!notice.is_poll || !notice.id) return;
        try {
            const votes = await noticesApi.getUserPollVote(notice.id, user.id);
            const votesArray = votes || [];
            setUserVotes(votesArray);
            setPendingVotes(votesArray);

            const responses = await noticesApi.fetchPollResponses(notice.id);
            const counts = {};
            responses?.forEach(r => {
                counts[r.option_id] = (counts[r.option_id] || 0) + 1;
            });
            setPollResults(counts);
            const uniqueUsers = new Set(responses?.map(r => r.user_id));
            setPollTotalVotes(uniqueUsers.size || 0);
        } catch (err) {
            console.error('Failed to fetch poll data', err);
        }
    };

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
            if (isNaN(diff)) { setTimeLeft(''); return; }
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
        if (!notice.is_poll || !notice.poll_deadline) return;
        const updatePollTimer = () => {
            const now = new Date();
            const deadline = new Date(notice.poll_deadline);
            if (deadline < now) {
                setPollTimeLeft('마감됨');
                setIsPollExpired(true);
                return;
            }
            const diff = deadline - now;
            if (isNaN(diff)) { setPollTimeLeft(''); setIsPollExpired(false); return; }
            setIsPollExpired(false);
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);
            let timeStr = '';
            if (days > 0) timeStr += `${days}일 `;
            timeStr += `${hours}시간 ${minutes}분 ${seconds}초 후 종료`;
            setPollTimeLeft(timeStr);
        };
        updatePollTimer();
        const interval = setInterval(updatePollTimer, 1000);
        return () => clearInterval(interval);
    }, [notice.poll_deadline, notice.is_poll]);

    useEffect(() => {
        if (!context) {
            fetchLikeStatus();
            fetchParticipantCounts();
            fetchPollData();
        }
    }, [notice.id, user, responses?.[notice.id]]);

    const handleOptionClick = (optionId) => {
        if (isEditing || isPollExpired) return;
        if (!notice.allow_multiple_votes) {
            handleSubmitVote([optionId]);
        } else {
            setPendingVotes(prev => 
                prev.includes(optionId) 
                    ? prev.filter(id => id !== optionId)
                    : [...prev, optionId]
            );
        }
    };

    const handleSubmitVote = async (votesToSubmit = pendingVotes) => {
        if (isEditing || isPollExpired) return;
        if (votesToSubmit.length === 0) return alert('항목을 하나 이상 선택해주세요.');
        setIsSubmittingPoll(true);
        try {
            await noticesApi.upsertPollVote(notice.id, user.id, votesToSubmit);
            setUserVotes(votesToSubmit);
            setPendingVotes(votesToSubmit);
            fetchPollData();
        } catch (err) {
            console.error('Vote failed:', err);
            alert('투표 처리에 실패했습니다.');
        } finally {
            setIsSubmittingPoll(false);
        }
    };

    const fetchParticipantCounts = async () => {
        if (!notice.is_recruiting) return;
        try {
            const { data } = await supabase.from('notice_responses').select('status').eq('notice_id', notice.id);
            const counts = { JOIN: 0, WAITLIST: 0 };
            data?.forEach(r => { if (counts[r.status] !== undefined) counts[r.status]++; });
            setJoinCount(counts.JOIN);
            setWaitlistCount(counts.WAITLIST);
        } catch (err) { console.error(err); }
    };

    const fetchLikeStatus = async () => {
        try {
            const { count } = await supabase.from('notice_likes').select('*', { count: 'exact', head: true }).eq('notice_id', notice.id);
            setLikeCount(count || 0);
            const { data } = await supabase.from('notice_likes').select('id').eq('notice_id', notice.id).eq('user_id', user.id);
            setLiked(data?.length > 0);
        } catch (err) { console.error('Like fetch error:', err); }
    };

    const toggleLike = async () => {
        try {
            if (liked) {
                await supabase.from('notice_likes').delete().eq('notice_id', notice.id).eq('user_id', user.id);
                setLiked(false);
                setLikeCount(prev => Math.max(0, prev - 1));
            } else {
                await supabase.from('notice_likes').insert([{ notice_id: notice.id, user_id: user.id }]);
                setLiked(true);
                setLikeCount(prev => prev + 1);
            }
        } catch (err) { console.error('Like toggle error:', err); }
    };

    const handleShare = async () => {
        const shareUrl = `${window.location.origin}/student?noticeId=${notice.id}`;
        const shareData = { title: notice.title, text: notice.title + ' - 더작은재단 ENTER', url: shareUrl };
        if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
            try { await navigator.share(shareData); } catch (err) { if (err.name !== 'AbortError') console.error('Share failed:', err); }
        } else {
            try { await navigator.clipboard.writeText(shareUrl); alert('링크가 클립보드에 복사되었습니다.'); }
            catch (err) { console.error('Clipboard failed:', err); alert('링크 복사에 실패했습니다.'); }
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
                {isAdmin && fromAdmin && (
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

            <div className="flex-1 overflow-y-auto scrollbar-hide bg-white">
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
                                fromAdmin={fromAdmin}
                                onUpdate={onUpdate}
                                onDelete={onDelete}
                                onDeleteComment={onDeleteComment}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="px-6 py-8">
                        {/* Banner Carousel */}
                        {allImages.length > 0 && !isEditing && (
                            <div className="mb-6 rounded-2xl overflow-hidden shadow-sm bg-gray-50 border border-gray-100 relative group">
                                <div
                                    ref={bannerScrollRef}
                                    className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide w-full cursor-grab active:cursor-grabbing select-none"
                                    onMouseDown={handleBannerMouseDown}
                                    onMouseLeave={handleBannerMouseLeave}
                                    onMouseUp={handleBannerMouseUp}
                                    onMouseMove={handleBannerMouseMove}
                                    onScroll={(e) => {
                                        const index = Math.round(e.target.scrollLeft / e.target.clientWidth);
                                        setCurrentImageIndex(index);
                                    }}
                                >
                                    {allImages.map((img, idx) => (
                                        <div key={idx} className="flex-shrink-0 w-full snap-center flex items-center justify-center bg-gray-50 relative group/img">
                                            <img src={img} className="w-full h-auto object-contain max-h-[70vh] pointer-events-none" alt={`Slide ${idx}`} />
                                        </div>
                                    ))}
                                </div>

                                {/* Navigation Arrows */}
                                {allImages.length > 1 && (
                                    <>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); scrollPrev(); }}
                                            className={`absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-gray-900 shadow-xl backdrop-blur-md flex items-center justify-center transition-all duration-300 z-10 opacity-0 group-hover:opacity-100 active:scale-90 ${currentImageIndex === 0 ? 'invisible' : 'visible'}`}
                                        >
                                            <ChevronLeft size={20} />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); scrollNext(); }}
                                            className={`absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-gray-900 shadow-xl backdrop-blur-md flex items-center justify-center transition-all duration-300 z-10 opacity-0 group-hover:opacity-100 active:scale-90 ${currentImageIndex === allImages.length - 1 ? 'invisible' : 'visible'}`}
                                        >
                                            <ChevronRight size={20} />
                                        </button>
                                        <div className="absolute top-3 right-3 bg-black/60 text-white text-[10px] px-2 py-1 rounded-full font-bold backdrop-blur-md z-10">
                                            {currentImageIndex + 1} / {allImages.length}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {isEditing ? (
                            <div className="space-y-6">
                                <input
                                    type="text"
                                    value={editedNotice.title}
                                    onChange={(e) => setEditedNotice({ ...editedNotice, title: e.target.value })}
                                    className="w-full text-2xl font-bold border-none outline-none placeholder:text-gray-200"
                                    placeholder="제목 없음"
                                />
                                <div className="space-y-4 border-y border-gray-50 py-6">
                                    <div className="flex items-center gap-4 text-sm">
                                        <div className="w-24 text-gray-400 flex items-center gap-2"><CalendarIcon size={14} /><span>마감일</span></div>
                                        <input type="datetime-local" value={editedNotice.recruitment_deadline ? formatToLocalISO(editedNotice.recruitment_deadline) : ''} onChange={(e) => setEditedNotice({ ...editedNotice, recruitment_deadline: e.target.value })} className="flex-1 bg-transparent border-none outline-none font-medium text-base" />
                                    </div>
                                    <div className="flex items-center gap-4 text-sm">
                                        <div className="w-24 text-gray-400 flex items-center gap-2"><User size={14} /><span>정원</span></div>
                                        <input type="number" value={editedNotice.max_capacity || 0} onChange={(e) => setEditedNotice({ ...editedNotice, max_capacity: parseInt(e.target.value) })} className="flex-1 bg-transparent border-none outline-none font-medium text-base" />
                                    </div>
                                </div>
                                <ModernEditor content={editedNotice.content} onChange={(content) => setEditedNotice({ ...editedNotice, content })} />
                            </div>
                        ) : (
                            <>
                                <h1 className="text-2xl font-bold text-gray-900 leading-tight mb-4">{notice.title}</h1>
                                <div className="prose max-w-none text-gray-800 leading-relaxed mb-6 overflow-hidden">
                                    <div dangerouslySetInnerHTML={{ __html: notice.content }} />
                                    {extractUrls(notice.content).map((url, i) => <LinkPreview key={i} url={url} />)}
                                </div>

                                {/* Polls */}
                                {notice.is_poll && notice.poll_options?.length > 0 && (
                                    <div className="mb-8">
                                        <div className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">
                                            <div className="flex justify-between items-center mb-5">
                                                <div className="flex flex-col gap-1">
                                                    <h3 className="text-sm font-black text-gray-800 flex items-center gap-2">
                                                        <span className="w-1.5 h-5 bg-blue-500 rounded-full inline-block"></span>
                                                        투표 참여 {notice.allow_multiple_votes && <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">다중 선택</span>}
                                                    </h3>
                                                    {notice.poll_deadline && <span className={`text-[10px] font-bold ${isPollExpired ? 'text-gray-400' : 'text-red-500 animate-pulse'}`}>{pollTimeLeft}</span>}
                                                </div>
                                                <div className="text-[10px] bg-blue-50 text-blue-600 px-3 py-1.5 rounded-xl font-bold">{pollTotalVotes}명 참여</div>
                                            </div>
                                            <div className="space-y-3">
                                                {notice.poll_options.map(opt => {
                                                    const isSelected = notice.allow_multiple_votes ? pendingVotes.includes(opt.id) : userVotes.includes(opt.id);
                                                    const votesForOption = pollResults[opt.id] || 0;
                                                    const percentage = pollTotalVotes > 0 ? Math.round((votesForOption / pollTotalVotes) * 100) : 0;
                                                    const showProgress = userVotes.length > 0;
                                                    return (
                                                        <div key={opt.id} onClick={() => handleOptionClick(opt.id)} className={`relative overflow-hidden cursor-pointer transition-all duration-300 border-2 rounded-2xl p-4 flex items-center gap-4 ${isSelected ? 'border-blue-500 bg-blue-50/20' : 'border-gray-100 bg-white hover:border-blue-200'}`}>
                                                            {showProgress && <div className={`absolute left-0 top-0 bottom-0 opacity-10 ${userVotes.includes(opt.id) ? 'bg-blue-600' : 'bg-gray-400'}`} style={{ width: `${percentage}%` }} />}
                                                            {opt.image_url && (
                                                                <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-gray-100 bg-gray-50 z-10" onClick={(e) => { e.stopPropagation(); setZoomedImage(opt.image_url); }}>
                                                                    <img src={opt.image_url} alt={opt.title} className="w-full h-full object-cover" />
                                                                    <div className="absolute inset-0 bg-black/5 flex items-center justify-center opacity-0 hover:opacity-100 transition"><ZoomIn size={16} className="text-white shadow-sm" /></div>
                                                                </div>
                                                            )}
                                                            <div className="flex-1 z-10">
                                                                <div className="flex justify-between items-center">
                                                                    <h4 className={`text-base font-bold ${isSelected ? 'text-blue-700' : 'text-gray-800'}`}>{opt.title}</h4>
                                                                    {showProgress && <span className="text-sm font-black text-blue-600">{percentage}% <span className="text-[10px] opacity-70">({votesForOption}표)</span></span>}
                                                                </div>
                                                                {opt.description && <p className="text-xs text-gray-500">{opt.description}</p>}
                                                            </div>
                                                            <div className={`w-6 h-6 shrink-0 z-10 flex items-center justify-center border-2 transition-colors ${notice.allow_multiple_votes ? 'rounded-md' : 'rounded-full'} ${isSelected ? 'border-blue-500 bg-blue-500 text-white' : 'border-gray-300 bg-white'}`}>
                                                                {isSelected && <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            {notice.allow_multiple_votes && !isPollExpired && (
                                                <button onClick={() => handleSubmitVote()} disabled={isSubmittingPoll || pendingVotes.length === 0} className={`w-full mt-5 py-4 rounded-xl font-bold text-white transition-all shadow-sm ${pendingVotes.length > 0 ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-300'}`}>
                                                    {isSubmittingPoll ? '제출 중...' : '투표 제출하기'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* RSVP */}
                                {notice.is_recruiting && (
                                    <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm mb-8">
                                        <div className="flex justify-between items-center mb-6">
                                            <div className="flex flex-col">
                                                <p className="text-sm font-black text-blue-600">참여 여부 선택</p>
                                                {notice.recruitment_deadline && <p className="text-[11px] font-bold text-red-500">{timeLeft}</p>}
                                            </div>
                                            {notice.max_capacity > 0 && <div className="bg-green-100 text-green-600 px-3 py-1.5 rounded-xl text-xs font-black">{joinCount} / {notice.max_capacity}명</div>}
                                        </div>
                                        <button 
                                            disabled={(notice.recruitment_deadline && new Date(notice.recruitment_deadline) < new Date()) || (notice.is_leader_only && !user.is_leader)}
                                            onClick={() => onResponse(notice.id, (notice.max_capacity > 0 && joinCount >= notice.max_capacity) ? 'WAITLIST' : 'JOIN')}
                                            className={`w-full py-4 rounded-full font-black text-white transition transform active:scale-95 ${(responses[notice.id] ? 'bg-gray-400' : 'bg-blue-600 shadow-lg shadow-blue-200')}`}
                                        >
                                            {responses[notice.id] ? '신청 완료' : (notice.max_capacity > 0 && joinCount >= notice.max_capacity ? '대기 신청' : '신청하기')}
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
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
                    </div>
                )}
            </div>

            {/* Comment Input */}
            {(!isGallery || !context) && (
                <div className="p-3 border-t border-gray-100 bg-white sticky bottom-0 z-50">
                    <form onSubmit={(e) => { e.preventDefault(); onPostComment(e); }} className="flex items-center gap-3">
                        <UserAvatar user={user} size="w-8 h-8" />
                        <div className="flex-1 bg-gray-100 rounded-full px-4 py-2 flex items-center">
                            <input type="text" value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="댓글 달기..." className="bg-transparent text-sm w-full outline-none py-1.5" />
                            {newComment.trim() && <button type="submit" className="text-blue-600 text-sm font-bold ml-2">게시</button>}
                        </div>
                    </form>
                </div>
            )}

            {/* Zoom Overlay (Banner/Carousel & Poll Options) */}
            {zoomedImage && (
                <div 
                    className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-4 cursor-pointer animate-fade-in"
                    onClick={() => setZoomedImage(null)}
                >
                    <button className="absolute top-6 right-6 text-white bg-white/10 p-2 rounded-full hover:bg-white/20 transition">
                        <X size={32} />
                    </button>
                    <img src={zoomedImage} className="max-w-full max-h-full object-contain animate-zoom-in" alt="Zoomed" />
                </div>
            )}
        </motion.div>
    );
};

export default NoticeModal;
