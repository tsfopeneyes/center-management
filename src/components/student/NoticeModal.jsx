import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import {
    ArrowLeft, ImageIcon, MoreHorizontal, Heart, Bookmark, Share2,
    Calendar, Clock, User, ShieldCheck, Edit2, Trash2,
    MessageSquare, Calendar as CalendarIcon, Clock as ClockIcon
} from 'lucide-react';
import { motion } from 'framer-motion';
import SunEditor from 'suneditor-react';
import 'suneditor/dist/css/suneditor.min.css';
import {
    align, font, fontSize, formatBlock, hiliteColor, horizontalRule, lineHeight, list, paragraphStyle, table, template, textStyle, image, link, video
} from 'suneditor/src/plugins';
import UserAvatar from '../common/UserAvatar';
import LinkPreview from '../common/LinkPreview';
import { formatToLocalISO } from '../../utils/dateUtils';
import { extractUrls } from '../../utils/textUtils';

const NoticeModal = ({ notice, onClose, user, responses, onResponse, comments, newComment, setNewComment, onPostComment, onUpdate, onDelete }) => {
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [isEditing, setIsEditing] = useState(false);
    const [editedNotice, setEditedNotice] = useState({ ...notice });

    const isAdmin = user?.role === 'admin';
    const isGallery = notice.category === 'GALLERY';

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

    useEffect(() => {
        fetchLikeStatus();
        fetchParticipantCounts();
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
            className="fixed inset-0 z-[110] bg-white flex flex-col sm:max-w-lg mx-auto overflow-hidden shadow-2xl pb-20"
        >
            {/* Header */}
            <div className="h-14 px-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-50 shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={onClose} className="-ml-2 p-2 hover:bg-gray-50 rounded-full transition">
                        <ArrowLeft size={24} className="text-gray-900" />
                    </button>
                    <div>
                        <div className="font-bold text-sm text-gray-900">{isEditing ? '게시물 수정' : '게시물'}</div>
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
                {isGallery ? (
                    <>
                        {/* User Info Header */}
                        <div className="p-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 to-pink-600 p-[2px]">
                                    <div className="w-full h-full rounded-full bg-white p-[1px] overflow-hidden">
                                        <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                                            <ImageIcon size={14} className="text-gray-400" />
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-gray-900 leading-none">갤러리</p>
                                    <p className="text-xs text-gray-500 mt-0.5">{notice.title}</p>
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
                                            className="flex-1 bg-transparent border-none outline-none font-medium"
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
                                            className="flex-1 bg-transparent border-none outline-none font-medium"
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

                                <div className="SunEditorContainer">
                                    <SunEditor
                                        setOptions={{
                                            height: 'auto', minHeight: '300px',
                                            plugins: [align, font, fontSize, formatBlock, hiliteColor, horizontalRule, lineHeight, list, paragraphStyle, table, template, textStyle, image, link, video],
                                            buttonList: [['undo', 'redo'], ['fontSize', 'formatBlock'], ['bold', 'underline', 'italic'], ['align', 'list'], ['table', 'link', 'image'], ['fullScreen']]
                                        }}
                                        setContents={editedNotice.content}
                                        onChange={(content) => setEditedNotice({ ...editedNotice, content })}
                                        placeholder="내용을 입력하세요..."
                                    />
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="flex justify-between items-start gap-4 mb-6">
                                    <h1 className="text-3xl font-bold text-gray-900 leading-tight">{notice.title}</h1>
                                    <button onClick={handleShare} className="p-2 bg-gray-50 rounded-full text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition shrink-0">
                                        <Share2 size={24} />
                                    </button>
                                </div>

                                {/* Properties Area */}
                                <div className="space-y-3 mb-8 text-sm">
                                    <div className="flex items-center gap-4">
                                        <div className="w-20 text-gray-400 flex items-center gap-2">
                                            <CalendarIcon size={14} />
                                            <span>작성일</span>
                                        </div>
                                        <span className="text-gray-700 font-medium">{new Date(notice.created_at).toLocaleDateString()}</span>
                                    </div>
                                    {notice.is_recruiting && (
                                        <>
                                            <div className="flex items-center gap-4">
                                                <div className="w-20 text-gray-400 flex items-center gap-2">
                                                    <ClockIcon size={14} />
                                                    <span>마감일</span>
                                                </div>
                                                <span className={`font-medium ${notice.recruitment_deadline && new Date(notice.recruitment_deadline) < new Date() ? 'text-red-500' : 'text-gray-700'}`}>
                                                    {notice.recruitment_deadline
                                                        ? new Date(notice.recruitment_deadline).toLocaleDateString('ko-KR', {
                                                            year: 'numeric', month: '2-digit', day: '2-digit',
                                                            hour: '2-digit', minute: '2-digit', hour12: false
                                                        })
                                                        : '미지정'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="w-20 text-gray-400 flex items-center gap-2">
                                                    <User size={14} />
                                                    <span>정원</span>
                                                </div>
                                                <span className="text-gray-700 font-medium">
                                                    {notice.max_capacity > 0 ? `${notice.max_capacity}명` : '제한 없음'}
                                                </span>
                                            </div>
                                        </>
                                    )}
                                </div>

                                <div className="prose max-w-none text-gray-800 leading-relaxed mb-10 overflow-hidden">
                                    <div dangerouslySetInnerHTML={{ __html: notice.content }} />
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
                    <div className="px-3 pb-8">
                        <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 shadow-sm">
                            <div className="flex justify-between items-center mb-4">
                                <p className="text-xs font-bold text-blue-600">
                                    {notice.program_status === 'COMPLETED' ? '종료된 프로그램' :
                                        notice.program_status === 'CANCELLED' ? '취소된 프로그램' : '참여 여부 선택'}
                                </p>
                                {notice.max_capacity > 0 && (
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${joinCount >= notice.max_capacity ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                            {joinCount} / {notice.max_capacity}명
                                        </span>
                                        {waitlistCount > 0 && <span className="text-[10px] text-gray-400 font-bold">대기 {waitlistCount}명</span>}
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2">
                                {['JOIN:참여', 'DECLINE:불참', 'UNDECIDED:미정'].map(opt => {
                                    const [val, label] = opt.split(':');
                                    const currentStatus = responses[notice.id];
                                    const isFull = notice.max_capacity > 0 && joinCount >= notice.max_capacity;

                                    let displayLabel = label;
                                    let targetStatus = val;

                                    if (val === 'JOIN') {
                                        if (currentStatus === 'WAITLIST') {
                                            displayLabel = '대기중';
                                        } else if (isFull && currentStatus !== 'JOIN') {
                                            displayLabel = '대기 신청';
                                            targetStatus = 'WAITLIST';
                                        }
                                    }

                                    const isSelected = currentStatus === val || (val === 'JOIN' && currentStatus === 'WAITLIST');

                                    let colorClass = 'bg-white text-gray-600 border-gray-100 hover:bg-gray-50';
                                    if (isSelected) {
                                        if (val === 'JOIN') colorClass = currentStatus === 'WAITLIST' ? 'bg-orange-500 text-white border-orange-500 shadow-md' : 'bg-blue-600 text-white border-blue-600 shadow-md';
                                        else if (val === 'DECLINE') colorClass = 'bg-red-500 text-white border-red-500 shadow-md';
                                        else colorClass = 'bg-gray-500 text-white border-gray-500 shadow-md';
                                    }

                                    const isExpired = (notice.recruitment_deadline && new Date(notice.recruitment_deadline) < new Date()) || (notice.program_status !== 'ACTIVE');

                                    return (
                                        <button
                                            key={val}
                                            disabled={isExpired}
                                            onClick={() => onResponse(notice.id, targetStatus)}
                                            className={`flex-1 py-3 rounded-xl text-xs font-bold border transition transform active:scale-95 ${colorClass} ${isExpired ? 'opacity-30 grayscale cursor-not-allowed' : ''}`}
                                        >
                                            {displayLabel}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* Comments Section */}
                <div className="border-t border-gray-50 mt-4">
                    <div className="px-4 py-4 text-sm font-bold text-gray-900 border-b border-gray-50">댓글 {comments.length}</div>
                    {comments.map(c => (
                        <div key={c.id} className="px-4 py-4 flex gap-3 text-sm hover:bg-gray-50 transition">
                            <UserAvatar user={c.users} size="w-8 h-8" />
                            <div className="flex-1">
                                <div className="flex items-baseline justify-between">
                                    <span className="font-bold text-gray-900 mr-2">{c.users?.name}</span>
                                    <span className="text-[10px] text-gray-400">{new Date(c.created_at).toLocaleDateString()}</span>
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
            </div>

            {/* Input Area */}
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
                            className="bg-transparent text-sm w-full outline-none placeholder:text-gray-400"
                        />
                        {newComment.trim() && (
                            <button type="submit" className="text-blue-600 text-sm font-bold hover:text-blue-800 transition ml-2">
                                게시
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </motion.div>
    );
};

export default NoticeModal;
