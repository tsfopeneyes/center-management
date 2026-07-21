import React, { useState, useEffect } from 'react';
import { ZoomIn, X, Calendar as CalendarIcon, User, Trash2, MapPin, Users, Upload, Clock, CheckCircle, Check, Sparkles, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../../supabaseClient';
import ModernEditor from '../common/ModernEditor';
import UserAvatar from '../common/UserAvatar';
import LinkPreview from '../common/LinkPreview';
import { formatToLocalISO, formatProgramSchedule } from '../../utils/dateUtils';
import { extractUrls, extractProgramInfo } from '../../utils/textUtils';
import useNoticeModal from './hooks/useNoticeModal';
import { compressImage } from '../../utils/imageUtils';
import confetti from 'canvas-confetti';

// Components
import NoticeCarousel from './components/NoticeCarousel';
import NoticeHeader from './components/NoticeHeader';
import WriteForm from '../admin/board/components/forms/WriteForm';

const NoticeModal = ({ notice, context, onClose, user, fromAdmin = false, responses, responseDetails = {}, onResponse, onRefresh, comments, newComment, setNewComment, onPostComment, onDeleteComment, onUpdate, onDelete, onViewParticipants, onRegisterRegularUser }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedNotice, setEditedNotice] = useState({ ...notice });
    const [zoomedImage, setZoomedImage] = useState(null);
    const [hostUsers, setHostUsers] = useState([]);
    const introRef = React.useRef(null);
    const hostRef = React.useRef(null);
    const [activeTab, setActiveTab] = useState('intro');

    // Challenge States
    const [challengeParticipants, setChallengeParticipants] = useState([]);
    const [uploadingMissionId, setUploadingMissionId] = useState(null);
    const [selectedMissionForDetail, setSelectedMissionForDetail] = useState(null);
    const [showSuccessPopup, setShowSuccessPopup] = useState(false);
    const [selectedParticipantForMissions, setSelectedParticipantForMissions] = useState(null);

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
                    const sortedMapped = mapped.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
                    setHostUsers(sortedMapped);
                } catch (err) {
                    console.error('Error fetching host users:', err);
                }
            };
            fetchHosts();
        } else {
            setHostUsers([]);
        }
    }, [notice]);

    useEffect(() => {
        if (notice?.is_challenge && notice?.id) {
            const fetchChallengeParticipants = async () => {
                const { data, error } = await supabase
                    .from('notice_responses')
                    .select('user_id, status, challenge_mission_statuses, users(name, school)')
                    .eq('notice_id', notice.id)
                    .eq('status', 'JOIN');
                if (data) {
                    setChallengeParticipants(data);
                }
            };
            fetchChallengeParticipants();
        }
    }, [notice?.id, notice?.is_challenge, responses]);

    const handleUploadMissionImage = async (missionId, file) => {
        if (!file) return;
        setUploadingMissionId(missionId);
        try {
            const compressedFile = await compressImage(file);
            const fileExt = file.name.split('.').pop();
            const fileName = `mission_${notice.id}_${user.id}_${missionId}_${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('notice-images')
                .upload(fileName, compressedFile);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('notice-images')
                .getPublicUrl(fileName);

            const myResponse = responseDetails[notice.id] || {};
            const currentStatuses = myResponse.challenge_mission_statuses || {};

            currentStatuses[missionId] = {
                completed: true,
                auth_image: publicUrl,
                submitted_at: new Date().toISOString()
            };

            const { error: updateErr } = await supabase
                .from('notice_responses')
                .update({ challenge_mission_statuses: currentStatuses })
                .eq('notice_id', notice.id)
                .eq('user_id', user.id);

            if (updateErr) throw updateErr;

            alert('인증샷 등록이 완료되었습니다!');

            const totalMissions = notice.challenge_missions?.length || 0;
            const isAllCompleted = totalMissions > 0 && notice.challenge_missions.every(m => currentStatuses[m.id]?.completed);
            if (isAllCompleted) {
                setTimeout(() => {
                    confetti({
                        particleCount: 150,
                        spread: 80,
                        origin: { y: 0.6 }
                    });
                    setShowSuccessPopup(true);
                }, 500);
            }
            
            if (onRefresh) onRefresh(); 
        } catch (err) {
            console.error('Failed to upload mission image:', err);
            alert('인증샷 업로드에 실패했습니다: ' + err.message);
        } finally {
            setUploadingMissionId(null);
        }
    };

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
                <div className="px-6 pt-6 pb-1">
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

                            {/* Program Intro Content (Always rendered first) */}
                            <div>
                                {notice.category === 'PROGRAM' && (
                                    <div 
                                        ref={notice.program_type === 'CENTER' && hostUsers.length > 0 ? introRef : null} 
                                        className={`flex items-center gap-2 scroll-mt-20 ${
                                            notice.program_type === 'CENTER' && hostUsers.length > 0 ? 'mt-4 mb-4' : 'mt-8 mb-4'
                                        }`}
                                    >
                                        <div className="w-[3px] h-[14px] bg-tossBlue rounded-full"></div>
                                        <h3 className="font-extrabold text-[15px] leading-none text-tossGrey900">
                                            소개
                                        </h3>
                                    </div>
                                )}
                                <div className="prose max-w-none text-tossGrey850 leading-snug prose-p:leading-snug prose-headings:leading-snug prose-li:leading-snug prose-p:my-1.5 mb-2 overflow-hidden">
                                    <div dangerouslySetInnerHTML={{ __html: notice.category === 'PROGRAM' ? cleanContent : notice.content }} />
                                    {extractUrls(notice.content).map((url, i) => <LinkPreview key={i} url={url} />)}
                                </div>
                            </div>

                            {/* Challenge Sections: render below intro */}
                            {notice.is_challenge && (() => {
                                const myResponse = responseDetails[notice.id] || {};
                                const statuses = myResponse.challenge_mission_statuses || {};
                                const totalMissions = notice.challenge_missions?.length || 0;
                                const isAllDone = totalMissions > 0 && notice.challenge_missions.every(m => statuses[m.id]?.completed);

                                return (
                                    <>
                                        {isAllDone && (
                                            <div className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50/50 border border-blue-100/50 rounded-2xl p-5 flex flex-col items-center text-center shadow-sm animate-fade-in">
                                                <span className="text-3xl mb-2">🎉</span>
                                                <h4 className="font-black text-slate-800 text-sm">챌린지 미션 달성 완료!</h4>
                                                <p className="text-[11px] text-slate-505 font-semibold mt-1">모든 미션 인증에 성공하셨습니다.</p>
                                                <button
                                                    onClick={() => {
                                                        confetti({
                                                            particleCount: 100,
                                                            spread: 70,
                                                            origin: { y: 0.6 }
                                                        });
                                                        setShowSuccessPopup(true);
                                                    }}
                                                    className="mt-3 px-4 py-2 bg-tossBlue hover:bg-tossBlueHover text-white font-extrabold text-xs rounded-xl shadow-sm active:scale-[0.98] transition-all"
                                                >
                                                    축하 메시지 다시보기
                                                </button>
                                            </div>
                                        )}
                                        {/* Missions List */}
                                        <div className="mt-8 border-t border-tossGrey100 pt-8">
                                            <div className="flex items-center gap-2 mb-4">
                                                <div className="w-[3px] h-[14px] bg-tossBlue rounded-full"></div>
                                                <h3 className="font-extrabold text-[15px] leading-none text-tossGrey900">
                                                    미션 목록
                                                </h3>
                                            </div>
                                            
                                            <div className="bg-white border border-tossGrey200 rounded-toss-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.015)]">
                                                <div className="flex items-center justify-around gap-2">
                                                    {notice.challenge_missions?.map((mission, index) => {
                                                        const myResponse = responseDetails[notice.id] || {};
                                                        const statuses = myResponse.challenge_mission_statuses || {};
                                                        const mStatus = statuses[mission.id] || {};
                                                        const isDone = mStatus.completed;
                                                        return (
                                                            <div 
                                                                key={mission.id}
                                                                onClick={() => setSelectedMissionForDetail(mission)}
                                                                className="flex flex-col items-center cursor-pointer select-none group flex-1"
                                                            >
                                                                {/* Icon Circle */}
                                                                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-xs mb-2 transition-colors ${
                                                                    isDone 
                                                                        ? 'bg-tossGrey200 text-tossGrey400' 
                                                                        : 'bg-tossBlueLight text-tossBlue group-hover:bg-tossBlue group-hover:text-white'
                                                                }`}>
                                                                    {isDone ? (
                                                                        <Check size={14} />
                                                                    ) : (
                                                                        index + 1
                                                                    )}
                                                                </div>

                                                                {/* Mission Info */}
                                                                <span className={`text-[11px] font-bold text-center leading-snug break-all ${
                                                                    isDone ? 'text-tossGrey400 line-through font-medium' : 'text-tossGrey900'
                                                                }`}>
                                                                    {mission.title}
                                                                </span>
                                                                {isDone && (
                                                                    <span className="bg-tossGrey100 text-tossGrey500 text-[8px] font-extrabold px-1.5 py-0.2 rounded mt-1">
                                                                        성공
                                                                    </span>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>

                                    {/* Mission Detail Modal (Overlay) */}
                                    {selectedMissionForDetail && (() => {
                                        const mission = selectedMissionForDetail;
                                        const myResponse = responseDetails[notice.id] || {};
                                        const statuses = myResponse.challenge_mission_statuses || {};
                                        const mStatus = statuses[mission.id] || {};
                                        const isDone = mStatus.completed;
                                        const hasImg = !!mStatus.auth_image;
                                        const hasJoined = responses[notice.id] === 'JOIN';

                                        return (
                                            <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setSelectedMissionForDetail(null)}>
                                                <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden relative shadow-[0_20px_50px_rgba(0,0,0,0.15)] animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                                                    {/* Card Header Banner */}
                                                    <div className="bg-gradient-to-r from-blue-50/70 to-indigo-50/50 px-6 py-4 border-b border-tossGrey100 flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-black text-tossBlue tracking-wider uppercase">Mission Card</span>
                                                            <div className="w-1.5 h-1.5 rounded-full bg-tossBlue animate-pulse"></div>
                                                        </div>
                                                        <button 
                                                            onClick={() => setSelectedMissionForDetail(null)}
                                                            className="p-1 hover:bg-tossGrey100 rounded-full transition text-tossGrey500"
                                                        >
                                                            <X size={18} className="stroke-[2.5]" />
                                                        </button>
                                                    </div>

                                                    {/* Card Content */}
                                                    <div className="p-6">
                                                        <h3 className="text-2xl font-black text-tossGrey900 mb-6">{mission.title}</h3>

                                                        <div className="space-y-5 mb-8">
                                                            {mission.location && (
                                                                <div className="flex flex-col gap-1">
                                                                    <span className="text-xs font-bold text-tossGrey400 uppercase tracking-wider">지정 장소</span>
                                                                    <span className="font-black text-tossGrey800 text-[15px]">{mission.location}</span>
                                                                </div>
                                                            )}

                                                            {mission.description && (
                                                                <div className="flex flex-col gap-1.5">
                                                                    <span className="text-xs font-bold text-tossGrey400 uppercase tracking-wider">미션 가이드</span>
                                                                    <span className="font-semibold text-tossGrey700 text-sm leading-relaxed whitespace-pre-wrap">{mission.description}</span>
                                                                </div>
                                                            )}

                                                            {hasImg && (
                                                                <div className="pt-2">
                                                                    <span className="text-xs font-bold text-tossGrey400 block mb-2">등록한 인증 사진</span>
                                                                    <div className="relative rounded-2xl overflow-hidden border border-tossGrey150 max-h-56 bg-tossGrey50 flex items-center justify-center">
                                                                        <img src={mStatus.auth_image} alt="" className="max-h-56 w-full object-cover" />
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    {/* Verification Button */}
                                                    {hasJoined && (
                                                        isDone ? (
                                                            <div className="flex gap-2">
                                                                <a
                                                                    href={mStatus.auth_image}
                                                                    download={`mission_auth_${mission.id}.jpg`}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="flex-1 py-3 bg-tossGrey100 hover:bg-tossGrey200 text-tossGrey700 font-bold text-center rounded-2xl text-xs transition flex items-center justify-center gap-1"
                                                                >
                                                                    <span>사진 다운로드</span>
                                                                </a>
                                                                <button
                                                                    onClick={() => {
                                                                        document.getElementById(`modal-file-input-${mission.id}`).click();
                                                                    }}
                                                                    disabled={uploadingMissionId === mission.id}
                                                                    className="flex-1 py-3 bg-tossBlue text-white font-extrabold text-center rounded-2xl text-xs transition hover:bg-blue-600 active:scale-[0.98]"
                                                                >
                                                                    {uploadingMissionId === mission.id ? '업로드 중...' : '수정 후 재등록'}
                                                                </button>
                                                                <input 
                                                                    type="file" 
                                                                    id={`modal-file-input-${mission.id}`}
                                                                    accept="image/*" 
                                                                    className="hidden" 
                                                                    onChange={async (e) => {
                                                                        if (e.target.files[0]) {
                                                                            await handleUploadMissionImage(mission.id, e.target.files[0]);
                                                                            setSelectedMissionForDetail(null);
                                                                        }
                                                                    }}
                                                                />
                                                            </div>
                                                        ) : (
                                                            <div>
                                                                <button
                                                                    onClick={() => {
                                                                        document.getElementById(`modal-file-input-${mission.id}`).click();
                                                                    }}
                                                                    disabled={uploadingMissionId === mission.id}
                                                                    className="w-full py-4 bg-tossBlue text-white font-black text-center rounded-2xl text-sm transition-all hover:bg-blue-600 active:scale-[0.98] flex items-center justify-center gap-1.5"
                                                                >
                                                                    {uploadingMissionId === mission.id ? (
                                                                        <span className="animate-pulse">업로드 중...</span>
                                                                    ) : (
                                                                        <>
                                                                            <Upload size={16} />
                                                                            <span>인증하기</span>
                                                                        </>
                                                                    )}
                                                                </button>
                                                                <input 
                                                                    type="file" 
                                                                    id={`modal-file-input-${mission.id}`}
                                                                    accept="image/*" 
                                                                    className="hidden" 
                                                                    onChange={async (e) => {
                                                                        if (e.target.files[0]) {
                                                                            await handleUploadMissionImage(mission.id, e.target.files[0]);
                                                                            setSelectedMissionForDetail(null);
                                                                        }
                                                                    }}
                                                                />
                                                            </div>
                                                        )
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}

                                    {/* Challengers Status */}
                                    <div className="mt-8 border-t border-tossGrey100 pt-8">
                                        <div className="flex items-center gap-2 mb-4">
                                            <div className="w-[3px] h-[14px] bg-tossBlue rounded-full"></div>
                                            <h3 className="font-extrabold text-[15px] leading-none text-tossGrey900">
                                                참여자 현황
                                            </h3>
                                        </div>
                                        <div className="flex flex-wrap gap-2.5 justify-start">
                                            {challengeParticipants.length === 0 ? (
                                                <div className="w-full p-8 text-center text-tossGrey400 text-xs font-bold bg-white border border-tossGrey200 rounded-toss-xl">
                                                    첫 번째 참여자가 되어보세요.
                                                </div>
                                            ) : (
                                                challengeParticipants.map((challenger) => {
                                                    const statuses = challenger.challenge_mission_statuses || {};
                                                    const isSuccess = (notice.challenge_missions?.length || 0) > 0 && notice.challenge_missions.every(m => statuses[m.id]?.completed);
                                                    const completedCount = notice.challenge_missions?.filter(m => statuses[m.id]?.completed).length || 0;

                                                    return (
                                                        <div 
                                                            key={challenger.user_id} 
                                                            className="px-3 py-2 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors border border-tossGrey200 rounded-2xl bg-white text-center hover:border-tossBlue hover:shadow-toss-subtle min-w-[75px] max-w-[100px] flex-1"
                                                            onClick={() => setSelectedParticipantForMissions(challenger)}
                                                        >
                                                            <span className="text-xs font-bold text-tossGrey850 truncate w-full px-1">
                                                                {challenger.users?.name?.replace('(guest)', '')}
                                                            </span>
                                                            <span className={`text-[9px] font-black mt-1 px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                                                                isSuccess 
                                                                    ? 'bg-tossBlueLight text-tossBlue' 
                                                                    : 'bg-tossGrey50 text-tossGrey500'
                                                            }`}>
                                                                {completedCount}/{notice.challenge_missions?.length || 0} 완료
                                                            </span>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                </>
                            )})()}

                            {notice.category === 'PROGRAM' && notice.program_type === 'CENTER' && hostUsers.length > 0 && (
                                <div ref={hostRef} className="mb-6 scroll-mt-20 flex flex-col gap-3">
                                    {/* Hosts with one-liners: rendered individually */}
                                    {hostUsers.filter(h => h.one_liner && h.one_liner.trim() !== '').map(host => (
                                        <div key={host.id} className="flex items-center gap-3.5 bg-tossGrey50/85 border border-tossGrey100/40 rounded-toss-xl p-4 shadow-toss-subtle">
                                            <UserAvatar user={host} size="w-12 h-12" />
                                            <div className="flex flex-col min-w-0">
                                                <span className="font-extrabold text-tossGrey900 text-sm leading-snug">{host.name}</span>
                                                <span className="text-xs text-tossGrey600 font-semibold mt-1 break-keep leading-relaxed">{host.one_liner}</span>
                                            </div>
                                        </div>
                                    ))}
                                    
                                    {/* Hosts without one-liners: grouped together in one card */}
                                    {(() => {
                                        const noOneLinerHosts = hostUsers.filter(h => !h.one_liner || h.one_liner.trim() === '');
                                        if (noOneLinerHosts.length === 0) return null;
                                        
                                        const count = noOneLinerHosts.length;
                                        let avatarSize = "w-10 h-10";
                                        let nameSize = "text-xs";
                                        let textSize = "text-xs";
                                        
                                        if (count >= 7) {
                                            avatarSize = "w-7 h-7";
                                            nameSize = "text-[10px]";
                                            textSize = "text-[9px]";
                                        } else if (count === 6) {
                                            avatarSize = "w-8 h-8";
                                            nameSize = "text-[11px]";
                                            textSize = "text-[10px]";
                                        } else if (count <= 3) {
                                            avatarSize = "w-12 h-12";
                                            nameSize = "text-sm";
                                            textSize = "text-xs";
                                        }
                                        
                                        return (
                                            <div className="flex flex-row items-center justify-center gap-2 sm:gap-4 bg-tossGrey50/85 border border-tossGrey100/40 rounded-toss-xl p-5 shadow-toss-subtle w-full">
                                                {noOneLinerHosts.map(host => (
                                                    <div key={host.id} className="flex flex-col items-center gap-1 text-center min-w-0 flex-1">
                                                        <UserAvatar user={host} size={avatarSize} textSize={textSize} />
                                                        <span className={`font-extrabold text-tossGrey900 ${nameSize} truncate w-full`}>{host.name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })()}
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
                                                 disabled={(notice.recruitment_deadline && new Date(notice.recruitment_deadline) < new Date()) || (!responses[notice.id] && notice.is_leader_only && !user?.is_leader)}
                                                 onClick={() => {
                                                     if (responses[notice.id]) {
                                                         onResponse(notice.id, 'CANCEL');
                                                     } else {
                                                         onResponse(notice.id, (notice.max_capacity > 0 && joinCount >= notice.max_capacity) ? 'WAITLIST' : 'JOIN');
                                                     }
                                                 }}
                                                 className={`w-full py-3.5 rounded-toss-xl font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 ${
                                                     responses[notice.id]
                                                         ? 'bg-red-50 text-tossError border border-red-200 hover:bg-red-100'
                                                         : (notice.max_capacity > 0 && joinCount >= notice.max_capacity
                                                             ? 'bg-tossWarning hover:bg-tossWarning/90 text-white'
                                                             : 'bg-tossBlue hover:bg-tossBlueHover text-white')
                                                 }`}
                                             >
                                                 {responses[notice.id] ? (
                                                     <>
                                                         <XCircle size={16} />
                                                         <span>{responses[notice.id] === 'WAITLIST' ? '대기 신청 취소' : '신청 취소'}</span>
                                                     </>
                                                 ) : (
                                                     notice.max_capacity > 0 && joinCount >= notice.max_capacity ? '대기 신청' : '신청하기'
                                                 )}
                                             </button>
                                         )}
                                     </div>
                                 ) : null
                             )}
                         </>
                     )}
                 </div>

                 {/* Comments Section */}
                 <div className="border-t border-tossGrey100 mt-1">
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
                                 disabled={(notice.recruitment_deadline && new Date(notice.recruitment_deadline) < new Date()) || (!responses[notice.id] && notice.is_leader_only && !user?.is_leader)}
                                 onClick={() => {
                                     if (responses[notice.id]) {
                                         onResponse(notice.id, 'CANCEL');
                                     } else {
                                         onResponse(notice.id, (notice.max_capacity > 0 && joinCount >= notice.max_capacity) ? 'WAITLIST' : 'JOIN');
                                     }
                                 }}
                                 className={`flex-1 py-3.5 rounded-toss-xl font-bold text-base transition transform active:scale-[0.98] flex items-center justify-center gap-1.5 ${
                                     responses[notice.id] 
                                         ? 'bg-red-50 text-tossError border border-red-200 hover:bg-red-100' 
                                         : (notice.max_capacity > 0 && joinCount >= notice.max_capacity 
                                             ? 'bg-tossWarning hover:bg-tossWarning/90 text-white' 
                                             : 'bg-tossBlue hover:bg-tossBlueHover text-white')
                                 }`}
                             >
                                 {responses[notice.id] ? (
                                     <>
                                         <XCircle size={18} />
                                         <span>{responses[notice.id] === 'WAITLIST' ? '대기 신청 취소' : '신청 취소'}</span>
                                     </>
                                 ) : (
                                     notice.max_capacity > 0 && joinCount >= notice.max_capacity ? '대기 신청' : '신청하기'
                                 )}
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
                     className="fixed inset-0 z-[220] bg-black/95 flex items-center justify-center p-4 cursor-pointer animate-fade-in"
                     onClick={() => setZoomedImage(null)}
                 >
                     <button className="absolute top-6 right-6 text-white bg-white/10 p-2 rounded-full hover:bg-white/20 transition">
                         <X size={32} />
                     </button>
                     <img src={zoomedImage} className="max-w-full max-h-full object-contain animate-zoom-in" alt="Zoomed" />
                 </div>
             )}

             {/* Challenge Success Congratulation Modal */}
             {showSuccessPopup && (
                 <div className="fixed inset-0 z-[210] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setShowSuccessPopup(false)}>
                     <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden relative shadow-[0_20px_50px_rgba(0,0,0,0.25)] animate-in fade-in zoom-in-95 duration-200 p-6 flex flex-col items-center text-center" onClick={(e) => e.stopPropagation()}>
                         <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center text-3xl mb-4 animate-bounce">
                             🏆
                         </div>
                         <h3 className="text-xl font-black text-slate-800 mb-2">축하합니다! 챌린지 성공!</h3>
                         <div className="text-sm font-semibold text-slate-600 leading-relaxed whitespace-pre-wrap mb-6 max-h-48 overflow-y-auto w-full px-2">
                             {notice.challenge_success_message || "모든 미션을 완벽히 해결하셨습니다! 대단해요 🎉"}
                         </div>
                         <div className="flex gap-2 w-full mt-2">
                             {notice.challenge_show_hyphen_btn && (user?.role === 'GUEST' || user?.user_group === '게스트') && (
                                 <button
                                     onClick={() => {
                                         setShowSuccessPopup(false);
                                         if (onRegisterRegularUser) onRegisterRegularUser();
                                     }}
                                     className="flex-1 py-3.5 bg-white border border-tossBlue text-tossBlue font-black rounded-2xl text-xs transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
                                 >
                                     <Sparkles size={12} className="text-indigo-500 shrink-0" />
                                     <span>하이픈 등록</span>
                                 </button>
                             )}
                             <button
                                 onClick={() => setShowSuccessPopup(false)}
                                 className="flex-1 py-3.5 bg-tossBlue hover:bg-tossBlueHover text-white font-black rounded-2xl text-xs transition-all active:scale-[0.98]"
                             >
                                 확인
                             </button>
                         </div>
                     </div>
                 </div>
             )}

             {/* Participant Mission Detail Overlay Modal */}
             {selectedParticipantForMissions && (() => {
                 const challenger = selectedParticipantForMissions;
                 const statuses = challenger.challenge_mission_statuses || {};
                 const name = challenger.users?.name?.replace('(guest)', '') || '참여자';
                 
                 return (
                     <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setSelectedParticipantForMissions(null)}>
                         <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden relative shadow-[0_20px_50px_rgba(0,0,0,0.15)] animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]" onClick={(e) => e.stopPropagation()}>
                             {/* Header */}
                             <div className="bg-gradient-to-r from-blue-50/70 to-indigo-50/50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                                 <div className="flex items-center gap-2">
                                     <span className="text-xs font-black text-tossBlue tracking-wider uppercase">Participant Missions</span>
                                     <div className="w-1.5 h-1.5 rounded-full bg-tossBlue"></div>
                                 </div>
                                 <button 
                                     onClick={() => setSelectedParticipantForMissions(null)}
                                     className="p-1 hover:bg-tossGrey100 rounded-full transition text-tossGrey500"
                                 >
                                     <X size={18} className="stroke-[2.5]" />
                                 </button>
                             </div>
                             
                             {/* Body */}
                             <div className="p-6 overflow-y-auto space-y-6 flex-1">
                                 <div className="pb-4 border-b border-slate-100">
                                     <h3 className="text-lg font-black text-slate-800">{name}님의 미션 현황</h3>
                                     <p className="text-[11px] text-slate-400 font-bold mt-1">{challenger.users?.school || '더작은재단'}</p>
                                 </div>
                                 
                                 <div className="space-y-4">
                                     {notice.challenge_missions?.map((mission, index) => {
                                         const mStatus = statuses[mission.id] || {};
                                         const isDone = mStatus.completed;
                                         const authImg = mStatus.auth_image;
                                         
                                         return (
                                             <div key={mission.id || index} className="bg-slate-50/60 border border-slate-200/50 rounded-2xl p-4 space-y-3">
                                                 <div className="flex items-center gap-3">
                                                     <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                                                         isDone ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'
                                                     }`}>
                                                         {isDone ? <Check size={14} className="stroke-[3]" /> : index + 1}
                                                     </div>
                                                     <span className={`text-sm font-bold ${isDone ? 'text-slate-800' : 'text-slate-400'}`}>
                                                         {mission.title}
                                                     </span>
                                                 </div>
                                                 
                                                 {isDone && authImg && (
                                                     <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 max-h-48 flex items-center justify-center cursor-pointer group" onClick={() => setZoomedImage(authImg)}>
                                                         <img src={authImg} alt="" className="max-h-48 w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                                                         <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                             <ZoomIn className="text-white shrink-0" size={24} />
                                                         </div>
                                                     </div>
                                                 )}
                                             </div>
                                         );
                                     })}
                                 </div>
                             </div>
                         </div>
                     </div>
                 );
             })()}
         </motion.div>
     );
 };

 export default NoticeModal;
