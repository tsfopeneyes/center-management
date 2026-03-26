import React, { useState, useEffect } from 'react';
import { ZoomIn, X, Calendar as CalendarIcon, User, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import ModernEditor from '../common/ModernEditor';
import UserAvatar from '../common/UserAvatar';
import LinkPreview from '../common/LinkPreview';
import { formatToLocalISO } from '../../utils/dateUtils';
import { extractUrls } from '../../utils/textUtils';
import useNoticeModal from './hooks/useNoticeModal';

// Components
import NoticeCarousel from './components/NoticeCarousel';
import NoticeHeader from './components/NoticeHeader';

const NoticeModal = ({ notice, context, onClose, user, fromAdmin = false, responses, onResponse, comments, newComment, setNewComment, onPostComment, onDeleteComment, onUpdate, onDelete }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedNotice, setEditedNotice] = useState({ ...notice });
    const [zoomedImage, setZoomedImage] = useState(null);

    const isAdmin = user?.role === 'admin';

    const {
        joinCount, waitlistCount,
        timeLeft,
        userVotes, pendingVotes,
        isSubmittingPoll, pollResults,
        pollTotalVotes, pollTimeLeft, isPollExpired,
        handleOptionClick, handleSubmitVote,
    } = useNoticeModal({ notice, user, context, responses });

    let allImages = [];
    if (notice.images && Array.isArray(notice.images)) {
        allImages = [...notice.images];
    }
    if (allImages.length === 0 && notice.image_url) {
        allImages.push(notice.image_url);
    }

    const handleSave = () => {
        onUpdate(editedNotice);
        setIsEditing(false);
    };

    useEffect(() => {
        const isGallery = context === 'GALLERY'; // Quick hack based on previous logic
        if (isGallery && context && notice.id) {
            const element = document.getElementById(`notice-${notice.id}`);
            if (element) {
                element.scrollIntoView({ behavior: 'auto' });
            }
        }
    }, [notice.id, context]);

    return (
        <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-[110] bg-white flex flex-col sm:max-w-lg mx-auto overflow-hidden shadow-2xl pb-20 gpu-accelerated"
        >
            <NoticeHeader
                onClose={onClose}
                isAdmin={isAdmin}
                fromAdmin={fromAdmin}
                isEditing={isEditing}
                setIsEditing={setIsEditing}
                handleSave={handleSave}
                handleDelete={onDelete}
                noticeId={notice.id}
            />

            <div className="flex-1 overflow-y-auto scrollbar-hide bg-white">
                <div className="px-6 py-8">
                    {!isEditing && <NoticeCarousel allImages={allImages} />}

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
                                                    <div key={opt.id} onClick={() => handleOptionClick(opt.id, isEditing)} className={`relative overflow-hidden cursor-pointer transition-all duration-300 border-2 rounded-2xl p-4 flex items-center gap-4 ${isSelected ? 'border-blue-500 bg-blue-50/20' : 'border-gray-100 bg-white hover:border-blue-200'}`}>
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
                                            <button onClick={() => handleSubmitVote(pendingVotes, isEditing)} disabled={isSubmittingPoll || pendingVotes.length === 0} className={`w-full mt-5 py-4 rounded-xl font-bold text-white transition-all shadow-sm ${pendingVotes.length > 0 ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-300'}`}>
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

                {/* Comments Section */}
                <div className="border-t border-gray-50 mt-4">
                    <div className="px-4 py-4 text-sm font-bold text-gray-900 border-b border-gray-50">댓글 {comments?.length || 0}</div>
                    {comments?.map(c => (
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
            </div>

            {/* Comment Input */}
            <div className="p-3 border-t border-gray-100 bg-white sticky bottom-0 z-50">
                <form onSubmit={(e) => { e.preventDefault(); onPostComment(e); }} className="flex items-center gap-3">
                    <UserAvatar user={user} size="w-8 h-8" />
                    <div className="flex-1 bg-gray-100 rounded-full px-4 py-2 flex items-center">
                        <input type="text" value={newComment || ''} onChange={(e) => setNewComment(e.target.value)} placeholder="댓글 달기..." className="bg-transparent text-sm w-full outline-none py-1.5" />
                        {newComment?.trim() && <button type="submit" className="text-blue-600 text-sm font-bold ml-2">게시</button>}
                    </div>
                </form>
            </div>

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
