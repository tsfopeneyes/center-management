import React, { useState, useEffect } from 'react';
import { ZoomIn, X, Calendar as CalendarIcon, User, Trash2, MapPin, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../../supabaseClient';
import ModernEditor from '../common/ModernEditor';
import UserAvatar from '../common/UserAvatar';
import LinkPreview from '../common/LinkPreview';
import { formatToLocalISO, formatProgramSchedule } from '../../utils/dateUtils';
import { extractUrls, extractProgramInfo } from '../../utils/textUtils';
import useNoticeModal from './hooks/useNoticeModal';

// Components
import NoticeCarousel from './components/NoticeCarousel';
import NoticeHeader from './components/NoticeHeader';
import WriteForm from '../admin/board/components/forms/WriteForm';

const NoticeModal = ({ notice, context, onClose, user, fromAdmin = false, responses, onResponse, comments, newComment, setNewComment, onPostComment, onDeleteComment, onUpdate, onDelete, onViewParticipants }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedNotice, setEditedNotice] = useState({ ...notice });
    const [zoomedImage, setZoomedImage] = useState(null);
    const [hostUsers, setHostUsers] = useState([]);
    const introRef = React.useRef(null);
    const hostRef = React.useRef(null);
    const [activeTab, setActiveTab] = useState('intro');

    const scrollToSection = (section) => {
        setActiveTab(section);
        const target = section === 'intro' ? introRef.current : hostRef.current;
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    useEffect(() => {
        const noticeHosts = notice.hosts || [];
        const ids = noticeHosts.length > 0
            ? noticeHosts.map(h => h.host_id).filter(Boolean)
            : (notice.host_ids || (notice.host_id ? [notice.host_id] : []));

        if (ids && ids.length > 0) {
            const fetchHosts = async () => {
                try {
                    const { data, error } = await supabase
                        .from('users')
                        .select('id, name, profile_image_url, school, role')
                        .in('id', ids);
                    if (error) throw error;
                    
                    const mapped = (data || []).map(user => {
                        const matchedHost = noticeHosts.find(h => h.host_id === user.id);
                        return {
                            ...user,
                            one_liner: matchedHost ? matchedHost.one_liner : notice.host_one_liner
                        };
                    });
                    setHostUsers(mapped);
                } catch (err) {
                    console.error('Error fetching host users:', err);
                }
            };
            fetchHosts();
        } else {
            setHostUsers([]);
        }
    }, [notice]);

    const { cleanContent, duration, location } = extractProgramInfo(notice.content);
    const formattedSchedule = formatProgramSchedule(
        notice.program_date,
        notice.program_duration || duration,
        notice.is_recruiting,
        notice.program_days,
        notice.program_start_date,
        notice.program_end_date
    );

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

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                // Ignore ESC key if a higher-level overlay is currently open
                if (document.querySelector('.dropdown-overlay')) return;

                if (zoomedImage) {
                    setZoomedImage(null);
                } else if (isEditing) {
                    setIsEditing(false);
                } else {
                    onClose();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose, zoomedImage, isEditing]);

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
                <div className="px-6 pt-6 pb-3">
                    {!isEditing && <NoticeCarousel allImages={allImages} />}

                    {isEditing ? (
                        <div className="py-2 animate-fade-in-up">
                            <WriteForm
                                mode={notice.category}
                                editNoticeId={notice.id}
                                existingNotice={notice}
                                onSave={(savedData) => {
                                    onUpdate({ ...savedData, id: notice.id });
                                    setIsEditing(false);
                                }}
                                onCancel={() => setIsEditing(false)}
                                flat={true}
                            />
                        </div>
                    ) : (
                        <>
                            <h1 className="text-2xl font-bold text-tossGrey900 leading-tight mb-4">{notice.title}</h1>
                            {notice.category === 'PROGRAM' && (
                                <div className="bg-tossGrey50 rounded-toss-xl p-5 space-y-4 mb-6">
                                    <div className="flex text-sm leading-relaxed">
                                        <span className="w-16 text-tossGrey500 font-semibold shrink-0">일정</span>
                                        <span className="text-tossBlue font-extrabold">{formattedSchedule}</span>
                                    </div>
                                    <div className="flex text-sm leading-relaxed">
                                        <span className="w-16 text-tossGrey500 font-semibold shrink-0">장소</span>
                                        <span className="text-tossGrey900 font-extrabold">{notice.program_location || location || '미정'}</span>
                                    </div>
                                    <div className="flex text-sm leading-relaxed">
                                        <span className="w-16 text-tossGrey500 font-semibold shrink-0">인원</span>
                                        <span className="text-tossGrey900 font-extrabold">{notice.max_capacity > 0 ? `${notice.max_capacity}명` : '제한 없음'}</span>
                                    </div>
                                </div>
                            )}

                            {/* Sticky Section Tabs: Only show when both Introduction and Host sections are active */}
                            {notice.category === 'PROGRAM' && notice.program_type === 'CENTER' && hostUsers.length > 0 && (
                                <div className="flex border-b border-tossGrey100 sticky top-0 bg-white/95 backdrop-blur z-20 mb-6">
                                    <button
                                        onClick={() => scrollToSection('intro')}
                                        className={`flex-1 py-3 text-center text-sm font-extrabold border-b-2 transition-all ${
                                            activeTab === 'intro' ? 'border-tossBlue text-tossBlue' : 'border-transparent text-tossGrey400 hover:text-tossGrey600'
                                        }`}
                                    >
                                        소개
                                    </button>
                                    <button
                                        onClick={() => scrollToSection('host')}
                                        className={`flex-1 py-3 text-center text-sm font-extrabold border-b-2 transition-all ${
                                            activeTab === 'host' ? 'border-tossBlue text-tossBlue' : 'border-transparent text-tossGrey400 hover:text-tossGrey600'
                                        }`}
                                    >
                                        호스트
                                    </button>
                                </div>
                            )}

                            {notice.category === 'PROGRAM' && (
                                <div 
                                    ref={notice.program_type === 'CENTER' && hostUsers.length > 0 ? introRef : null} 
                                    className={`flex items-center gap-2 scroll-mt-20 ${
                                        notice.program_type === 'CENTER' && hostUsers.length > 0 ? 'mt-4 mb-4' : 'mt-8 mb-4'
                                    }`}
                                >
                                    <div className="w-[3px] h-[14px] bg-tossBlue rounded-full"></div>
                                    <h3 className={`font-extrabold text-[15px] leading-none ${
                                        notice.program_type === 'CENTER' && hostUsers.length > 0 ? 'text-tossBlue' : 'text-tossGrey900'
                                    }`}>
                                        프로그램 소개
                                    </h3>
                                </div>
                            )}
                             <div className="prose max-w-none text-tossGrey850 leading-snug prose-p:leading-snug prose-headings:leading-snug prose-li:leading-snug prose-p:my-1.5 mb-4 overflow-hidden">
                                 <div dangerouslySetInnerHTML={{ __html: notice.category === 'PROGRAM' ? cleanContent : notice.content }} />
                                 {extractUrls(notice.content).map((url, i) => <LinkPreview key={i} url={url} />)}
                             </div>

                            {/* Host Intro: conditionally visible only for CENTER programs */}
                            {notice.category === 'PROGRAM' && notice.program_type === 'CENTER' && hostUsers.length > 0 && (
                                <div ref={hostRef} className="mt-8 pt-6 border-t border-tossGrey100 mb-6 scroll-mt-20">
                                    <div className="grid grid-cols-1 gap-3">
                                        {hostUsers.map(host => (
                                            <div key={host.id} className="flex items-center gap-3.5 bg-tossGrey50/85 border border-tossGrey100/40 rounded-toss-xl p-4 shadow-toss-subtle">
                                                <UserAvatar user={host} size="w-12 h-12" />
                                                <div className="flex flex-col min-w-0">
                                                    <span className="font-extrabold text-tossGrey900 text-sm leading-snug">{host.name}</span>
                                                    {host.one_liner && (
                                                        <span className="text-xs text-tossGrey600 font-semibold mt-1 break-keep leading-relaxed">{host.one_liner}</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Polls */}
                            {notice.is_poll && notice.poll_options?.length > 0 && (
                                <div className="mb-8">
                                    <div className="bg-white p-5 rounded-toss-xl border border-tossGrey200/50 shadow-toss-standard">
                                        <div className="flex justify-between items-center mb-5">
                                            <div className="flex flex-col gap-1">
                                                <h3 className="text-sm font-bold text-tossGrey900 flex items-center gap-2">
                                                    <span className="w-1 h-4 bg-tossBlue rounded-full inline-block"></span>
                                                    투표 참여 {notice.allow_multiple_votes && <span className="text-[10px] font-bold text-tossBlue bg-tossBlueLight px-2 py-0.5 rounded-toss-sm">다중 선택</span>}
                                                </h3>
                                                {notice.poll_deadline && <span className={`text-[10px] font-bold ${isPollExpired ? 'text-tossGrey400' : 'text-tossError animate-pulse'}`}>{pollTimeLeft}</span>}
                                            </div>
                                            <div className="text-[10px] bg-tossBlueLight text-tossBlue px-3 py-1.5 rounded-toss-md font-bold">{pollTotalVotes}명 참여</div>
                                        </div>
                                        <div className="space-y-3">
                                            {notice.poll_options.map(opt => {
                                                const isSelected = notice.allow_multiple_votes ? pendingVotes.includes(opt.id) : userVotes.includes(opt.id);
                                                const votesForOption = pollResults[opt.id] || 0;
                                                const percentage = pollTotalVotes > 0 ? Math.round((votesForOption / pollTotalVotes) * 100) : 0;
                                                const showProgress = userVotes.length > 0;
                                                return (
                                                    <div key={opt.id} onClick={() => handleOptionClick(opt.id, isEditing)} className={`relative overflow-hidden cursor-pointer transition-all duration-300 border rounded-toss-xl p-4 flex items-center gap-4 ${isSelected ? 'border-tossBlue bg-tossBlueLight/40' : 'border-tossGrey200 bg-white hover:border-tossBlue/20'}`}>
                                                        {showProgress && <div className={`absolute left-0 top-0 bottom-0 opacity-10 ${userVotes.includes(opt.id) ? 'bg-tossBlue' : 'bg-tossGrey400'}`} style={{ width: `${percentage}%` }} />}
                                                        {opt.image_url && (
                                                            <div className="relative w-14 h-14 rounded-toss-lg overflow-hidden shrink-0 border border-tossGrey100 bg-tossGrey50 z-10" onClick={(e) => { e.stopPropagation(); setZoomedImage(opt.image_url); }}>
                                                                <img src={opt.image_url} alt={opt.title} className="w-full h-full object-cover" />
                                                                <div className="absolute inset-0 bg-black/5 flex items-center justify-center opacity-0 hover:opacity-100 transition"><ZoomIn size={16} className="text-white shadow-sm" /></div>
                                                            </div>
                                                        )}
                                                        <div className="flex-1 z-10">
                                                            <div className="flex justify-between items-center">
                                                                <h4 className={`text-base font-bold ${isSelected ? 'text-tossBlue font-bold' : 'text-tossGrey800'}`}>{opt.title}</h4>
                                                                {showProgress && <span className="text-sm font-black text-tossBlue">{percentage}% <span className="text-[10px] opacity-70">({votesForOption}표)</span></span>}
                                                            </div>
                                                            {opt.description && <p className="text-xs text-tossGrey500">{opt.description}</p>}
                                                        </div>
                                                        <div className={`w-6 h-6 shrink-0 z-10 flex items-center justify-center border transition-colors ${notice.allow_multiple_votes ? 'rounded-toss-sm' : 'rounded-full'} ${isSelected ? 'border-tossBlue bg-tossBlue text-white' : 'border-tossGrey400 bg-white'}`}>
                                                            {isSelected && <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {notice.allow_multiple_votes && !isPollExpired && (
                                            <button onClick={() => handleSubmitVote(pendingVotes, isEditing)} disabled={isSubmittingPoll || pendingVotes.length === 0} className={`w-full mt-5 py-3.5 rounded-toss-xl font-bold text-white transition-all ${pendingVotes.length > 0 ? 'bg-tossBlue hover:bg-tossBlueHover' : 'bg-tossGrey100 text-tossGrey500 pointer-events-none'}`}>
                                                {isSubmittingPoll ? '제출 중...' : '투표 제출하기'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                             )}

                             {/* RSVP */}
                             {notice.category !== 'PROGRAM' && (
                                 notice.is_recruiting ? (
                                     <div className="bg-white p-6 rounded-toss-xl border border-tossGrey200/50 shadow-toss-standard mb-8">
                                         <div className="flex justify-between items-center mb-6">
                                             <div className="flex flex-col">
                                                 <p className="text-sm font-bold text-tossBlue">참여 여부 선택</p>
                                                 {notice.recruitment_deadline && <p className="text-[11px] font-bold text-tossError">{timeLeft}</p>}
                                             </div>
                                             {notice.max_capacity > 0 && <div className="bg-tossSuccess/10 text-tossSuccess px-3 py-1.5 rounded-toss-md text-xs font-bold">{joinCount} / {notice.max_capacity}명</div>}
                                         </div>
                                         {isAdmin ? (
                                             <button
                                                 onClick={() => onViewParticipants && onViewParticipants(notice)}
                                                 className="w-full py-3.5 rounded-toss-xl font-bold text-white transition-all bg-tossBlue hover:bg-tossBlueHover flex items-center justify-center gap-2"
                                             >
                                                 신청자 명단 ({joinCount}명)
                                             </button>
                                         ) : (
                                             <button
                                                 disabled={(notice.recruitment_deadline && new Date(notice.recruitment_deadline) < new Date()) || (notice.is_leader_only && !user.is_leader)}
                                                 onClick={() => onResponse(notice.id, (notice.max_capacity > 0 && joinCount >= notice.max_capacity) ? 'WAITLIST' : 'JOIN')}
                                                 className={`w-full py-3.5 rounded-toss-xl font-bold text-white transition-all active:scale-[0.98] ${
                                                     responses[notice.id]
                                                         ? 'bg-tossGrey100 text-tossGrey500 pointer-events-none'
                                                         : (notice.max_capacity > 0 && joinCount >= notice.max_capacity
                                                             ? 'bg-tossWarning hover:bg-tossWarning/90'
                                                             : 'bg-tossBlue hover:bg-tossBlueHover')
                                                 }`}
                                             >
                                                 {responses[notice.id] ? '신청 완료' : (notice.max_capacity > 0 && joinCount >= notice.max_capacity ? '대기 신청' : '신청하기')}
                                             </button>
                                         )}
                                     </div>
                                 ) : null
                             )}
                         </>
                     )}
                 </div>

                 {/* Comments Section */}
                 <div className="border-t border-tossGrey100 mt-2">
                     <div className="px-4 py-4 text-sm font-bold text-tossGrey900 border-b border-tossGrey100">댓글 {comments?.length || 0}</div>
                     {comments?.map(c => (
                         <div key={c.id} className="px-4 py-4 flex gap-3 text-sm hover:bg-tossGrey50 transition group/notice-comment">
                             <UserAvatar user={c.users} size="w-8 h-8" />
                             <div className="flex-1">
                                 <div className="flex items-baseline justify-between">
                                     <div className="flex items-center gap-2">
                                         <span className="font-bold text-tossGrey900">{c.users?.name}</span>
                                         <span className="text-[10px] text-tossGrey400">{new Date(c.created_at).toLocaleDateString()}</span>
                                     </div>
                                     {c.user_id === user.id && (
                                         <button onClick={() => onDeleteComment(c.id)} className="p-1 text-tossGrey400 hover:text-tossError transition-colors">
                                             <Trash2 size={14} />
                                         </button>
                                     )}
                                 </div>
                                 <p className="text-tossGrey700 mt-1 leading-normal">{c.content}</p>
                             </div>
                         </div>
                     ))}
                     
                     {/* Inline Comment Input for Program Notices */}
                     {notice.category === 'PROGRAM' && (
                         <div className="p-4 bg-white border-t border-tossGrey100">
                             <form onSubmit={(e) => { e.preventDefault(); onPostComment(e); }} className="flex items-center gap-3">
                                 <UserAvatar user={user} size="w-8 h-8" />
                                 <div className="flex-1 bg-tossGrey50 border border-tossGrey200 rounded-toss-xl px-4 py-2 flex items-center">
                                     <input type="text" value={newComment || ''} onChange={(e) => setNewComment(e.target.value)} placeholder="댓글 달기..." className="bg-transparent text-sm w-full outline-none py-1.5 text-tossGrey850" />
                                     {newComment?.trim() && <button type="submit" className="text-tossBlue text-sm font-bold ml-2">게시</button>}
                                 </div>
                             </form>
                         </div>
                     )}
                 </div>
             </div>

             {/* Program Notice Fixed Bottom Action Bar */}
             {notice.category === 'PROGRAM' && !isEditing && (
                 <div className="bg-white border-t border-tossGrey200 z-[60]">
                     {notice.is_recruiting && notice.recruitment_deadline && (
                         <div className="bg-tossGrey900 text-center py-2.5 px-4 text-xs font-bold text-tossCaution tracking-tight">
                             {timeLeft}
                         </div>
                     )}
                     {isAdmin ? (
                         <div className="p-4 flex gap-3">
                             <button
                                 onClick={() => onViewParticipants && onViewParticipants(notice)}
                                 className="flex-1 py-3.5 rounded-toss-xl font-bold text-white text-base bg-tossBlue hover:bg-tossBlueHover transition transform active:scale-[0.98] flex items-center justify-center gap-2"
                             >
                                 {notice.is_recruiting ? `신청자 명단 (${joinCount}명)` : '참석자 명단'}
                             </button>
                         </div>
                     ) : notice.is_recruiting ? (
                         <div className="p-4 flex gap-3">
                             <button
                                 disabled={(notice.recruitment_deadline && new Date(notice.recruitment_deadline) < new Date()) || (notice.is_leader_only && !user.is_leader)}
                                 onClick={() => onResponse(notice.id, (notice.max_capacity > 0 && joinCount >= notice.max_capacity) ? 'WAITLIST' : 'JOIN')}
                                 className={`flex-1 py-3.5 rounded-toss-xl font-bold text-white text-base transition transform active:scale-[0.98] ${
                                     responses[notice.id] 
                                         ? 'bg-tossGrey100 text-tossGrey500 pointer-events-none' 
                                         : (notice.max_capacity > 0 && joinCount >= notice.max_capacity 
                                             ? 'bg-tossWarning' 
                                             : 'bg-tossBlue hover:bg-tossBlueHover')
                                 }`}
                             >
                                 {responses[notice.id] ? '신청 완료' : (notice.max_capacity > 0 && joinCount >= notice.max_capacity ? '대기 신청' : '신청하기')}
                             </button>
                         </div>
                     ) : (
                         <div className="p-4 bg-tossBlueLight text-center">
                             <p className="text-sm font-bold text-tossBlue">오픈 프로그램입니다. 자유롭게 참여하세요.</p>
                         </div>
                     )}
                 </div>
             )}

             {/* Comment Input for Non-Program Notices */}
             {notice.category !== 'PROGRAM' && (
                 <div className="p-3 border-t border-tossGrey200 bg-white sticky bottom-0 z-50">
                     <form onSubmit={(e) => { e.preventDefault(); onPostComment(e); }} className="flex items-center gap-3">
                         <UserAvatar user={user} size="w-8 h-8" />
                         <div className="flex-1 bg-tossGrey50 border border-tossGrey200 rounded-toss-xl px-4 py-2 flex items-center">
                             <input type="text" value={newComment || ''} onChange={(e) => setNewComment(e.target.value)} placeholder="댓글 달기..." className="bg-transparent text-sm w-full outline-none py-1.5 text-tossGrey850" />
                             {newComment?.trim() && <button type="submit" className="text-tossBlue text-sm font-bold ml-2">게시</button>}
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
