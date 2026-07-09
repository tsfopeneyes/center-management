import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Calendar, User, ArrowLeft, Share, AlertCircle, MapPin, Users } from 'lucide-react';
import NoticeCarousel from '../components/student/components/NoticeCarousel';
import LinkPreview from '../components/common/LinkPreview';
import { extractUrls, extractProgramInfo } from '../utils/textUtils';
import { formatToLocalISO, formatProgramSchedule } from '../utils/dateUtils';
import { TAB_NAMES } from '../constants/appConstants';

const PublicProgramDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [notice, setNotice] = useState(null);
    const [loading, setLoading] = useState(true);
    const [timeLeft, setTimeLeft] = useState('');
    const [pollTimeLeft, setPollTimeLeft] = useState('');
    const [isPollExpired, setIsPollExpired] = useState(false);
    const [hostUser, setHostUser] = useState(null);
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
        if (notice && notice.host_id) {
            const fetchHost = async () => {
                try {
                    const { data, error } = await supabase
                        .from('users')
                        .select('id, name, profile_image_url, school, role')
                        .eq('id', notice.host_id)
                        .single();
                    if (error) throw error;
                    setHostUser(data);
                } catch (err) {
                    console.error('Error fetching host user:', err);
                }
            };
            fetchHost();
        } else {
            setHostUser(null);
        }
    }, [notice]);
    
    // Auto redirect if already logged in
    useEffect(() => {
        const checkExistingLogin = async () => {
            const storedUser = localStorage.getItem('user');
            if (storedUser) {
                // User is already logged in, redirect them seamlessly to the app and auto-open it
                localStorage.setItem('pendingProgramJoin', id);
                try {
                    const user = JSON.parse(storedUser);
                    if (user.role === 'admin') {
                        navigate('/admin');
                    } else {
                        navigate('/student');
                    }
                } catch {
                    // Invalid cache, continue rendering public view
                }
            } else {
                fetchNotice();
            }
        };
        checkExistingLogin();
    }, [id, navigate]);

    const fetchNotice = async () => {
        try {
            const { data, error } = await supabase
                .from('notices')
                .select('*, host:users(id, name, avatar_url, school, role)')
                .eq('id', id)
                .single();
                
            if (error) throw error;
            setNotice(data);
        } catch (err) {
            console.error(err);
            setNotice(false); // Indicates not found or error
        } finally {
            setLoading(false);
        }
    };

    // Timers
    useEffect(() => {
        if (!notice || (!notice.recruitment_deadline && !notice.poll_deadline)) return;
        
        const updateTimer = () => {
            const now = new Date();
            
            // Recruitment Timer
            if (notice.recruitment_deadline) {
                const deadline = new Date(notice.recruitment_deadline);
                if (deadline < now) {
                    setTimeLeft('마감됨');
                } else {
                    const diff = deadline - now;
                    let text = '';
                    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                    if (days > 0) text += `${days}일 `;
                    text += `${Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))}시간 ${Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))}분 남음`;
                    setTimeLeft(text);
                }
            }

            // Poll Timer
            if (notice.is_poll && notice.poll_deadline) {
                const deadline = new Date(notice.poll_deadline);
                if (deadline < now) {
                    setPollTimeLeft('마감됨');
                    setIsPollExpired(true);
                } else {
                    const diff = deadline - now;
                    setIsPollExpired(false);
                    let text = '';
                    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                    if (days > 0) text += `${days}일 `;
                    text += `${Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))}시간 ${Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))}분 남음`;
                    setPollTimeLeft(text);
                }
            }
        };

        updateTimer();
        const interval = setInterval(updateTimer, 60000); // Check every minute
        return () => clearInterval(interval);
    }, [notice]);

    const handleActionClick = () => {
        // Save intent for after login
        localStorage.setItem('pendingProgramJoin', id);
        alert('신청(참여) 하려면 로그인이 필요합니다.');
        navigate('/'); // Redirect to Landing for login
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (notice === false) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
                <AlertCircle size={48} className="text-gray-400 mb-4" />
                <h1 className="text-2xl font-bold text-gray-800 mb-2">프로그램을 찾을 수 없습니다.</h1>
                <p className="text-gray-500 mb-6">삭제되었거나 주소가 잘못되었습니다.</p>
                <button onClick={() => navigate('/')} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold">
                    메인홈으로 가기
                </button>
            </div>
        );
    }

    let allImages = notice.images ? [...notice.images] : [];
    if (allImages.length === 0 && notice.image_url) {
        allImages.push(notice.image_url);
    }

    const { cleanContent, duration, location } = extractProgramInfo(notice.content);
    const formattedSchedule = formatProgramSchedule(
        notice.program_date,
        notice.program_duration || duration,
        notice.is_recruiting,
        notice.program_days,
        notice.program_start_date
    );

    return (
        <div className="w-full md:max-w-lg mx-auto min-h-screen bg-white relative pb-24 shadow-2xl">
            {/* Header */}
            <div className="h-14 px-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-50">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/')} className="-ml-2 p-2 hover:bg-gray-50 rounded-full transition">
                        <ArrowLeft size={24} className="text-gray-900" />
                    </button>
                    <div className="font-bold text-sm text-gray-900">프로그램 정보</div>
                </div>
                <button 
                    onClick={() => {
                        navigator.clipboard.writeText(window.location.href)
                            .then(() => alert('공유 링크가 클립보드에 복사되었습니다!'));
                    }} 
                    className="p-2 hover:bg-gray-50 rounded-full transition text-gray-500"
                >
                    <Share size={20} />
                </button>
            </div>

            {/* Content */}
            <div className="px-6 py-8">
                <NoticeCarousel allImages={allImages} />

                <h1 className="text-2xl font-bold text-gray-900 leading-tight mb-4">{notice.title}</h1>
                
                {notice.category === 'PROGRAM' && (
                    <div className="bg-[#f8fafc] rounded-2xl p-5 space-y-4 mb-6">
                        <div className="flex text-sm leading-relaxed">
                            <span className="w-16 text-gray-500 font-semibold shrink-0">일정</span>
                            <span className="text-blue-600 font-extrabold">{formattedSchedule}</span>
                        </div>
                        <div className="flex text-sm leading-relaxed">
                            <span className="w-16 text-gray-500 font-semibold shrink-0">장소</span>
                            <span className="text-gray-900 font-extrabold">{notice.program_location || location || '미정'}</span>
                        </div>
                        <div className="flex text-sm leading-relaxed">
                            <span className="w-16 text-gray-500 font-semibold shrink-0">인원</span>
                            <span className="text-gray-900 font-extrabold">{notice.max_capacity > 0 ? `${notice.max_capacity}명` : '제한 없음'}</span>
                        </div>
                    </div>
                )}

                {/* Sticky Section Tabs: Only show when both Introduction and Host sections are active */}
                {notice.category === 'PROGRAM' && notice.program_type === 'CENTER' && hostUser && (
                    <div className="flex border-b border-gray-100 sticky top-14 bg-white/95 backdrop-blur z-20 mb-6">
                        <button
                            onClick={() => scrollToSection('intro')}
                            className={`flex-1 py-3 text-center text-sm font-extrabold border-b-2 transition-all ${
                                activeTab === 'intro' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'
                            }`}
                        >
                            소개
                        </button>
                        <button
                            onClick={() => scrollToSection('host')}
                            className={`flex-1 py-3 text-center text-sm font-extrabold border-b-2 transition-all ${
                                activeTab === 'host' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'
                            }`}
                        >
                            호스트
                        </button>
                    </div>
                )}

                {/* Information Tags */}
                {notice.category !== 'PROGRAM' && (notice.program_date || notice.max_capacity > 0) && (
                    <div className="flex flex-wrap gap-2 mb-6">
                        {notice.program_date && (
                            <div className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-gray-50 text-gray-600 rounded-lg">
                                <Calendar size={14} />
                                {new Date(notice.program_date).toLocaleDateString()} 진행
                            </div>
                        )}
                        {notice.max_capacity > 0 && (
                            <div className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg">
                                <User size={14} />
                                선착순 {notice.max_capacity}명
                            </div>
                        )}
                    </div>
                )}

                {/* Body Content */}
                {notice.category === 'PROGRAM' && !(notice.program_type === 'CENTER' && hostUser) && (
                    <h3 className="text-base font-extrabold text-gray-900 mt-8 mb-4">프로그램 소개</h3>
                )}
                <div ref={notice.program_type === 'CENTER' && hostUser ? introRef : null} className={`prose max-w-none text-gray-800 leading-snug mb-8 ${notice.program_type === 'CENTER' && hostUser ? 'scroll-mt-28' : ''}`}>
                    <div dangerouslySetInnerHTML={{ __html: notice.category === 'PROGRAM' ? cleanContent : notice.content }} />
                    {extractUrls(notice.content).map((url, i) => <LinkPreview key={i} url={url} />)}
                </div>

                {/* Host Intro: conditionally visible only for CENTER programs */}
                {notice.category === 'PROGRAM' && notice.program_type === 'CENTER' && hostUser && (
                    <div ref={hostRef} className="mt-8 pt-6 border-t border-gray-100 mb-8 scroll-mt-28">
                        <div className="flex items-center gap-3.5 bg-slate-50/85 border border-gray-100 rounded-2xl p-4 shadow-[0px_1px_3px_rgba(0,0,0,0.03)]">
                            {/* Simple inline avatar view as helper */}
                            <div className="w-12 h-12 rounded-full overflow-hidden bg-blue-50 border border-gray-100 flex items-center justify-center shrink-0">
                                {hostUser.profile_image_url ? (
                                    <img src={hostUser.profile_image_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <User size={20} className="text-blue-500" />
                                )}
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="font-extrabold text-gray-900 text-sm leading-snug">{hostUser.name}</span>
                                {notice.host_one_liner && (
                                    <span className="text-xs text-gray-600 font-semibold mt-1 break-keep leading-relaxed">{notice.host_one_liner}</span>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Read-only Poll */}
                {notice.is_poll && notice.poll_options?.length > 0 && (
                    <div className="mb-8 bg-gray-50 p-6 rounded-[2rem] border border-gray-100">
                        <div className="flex flex-col gap-1 mb-5">
                            <h3 className="text-sm font-black text-gray-800 flex items-center gap-2">
                                <span className="w-1.5 h-5 bg-blue-500 rounded-full inline-block"></span>
                                프로그램 투표 진행 중
                            </h3>
                            {notice.poll_deadline && <span className={`text-[11px] font-bold ${isPollExpired ? 'text-gray-400' : 'text-red-500'}`}>{pollTimeLeft}</span>}
                        </div>
                        <div className="space-y-3 relative">
                            {/* Overlay to block clicking */}
                            <div className="absolute inset-0 z-10 cursor-pointer" onClick={handleActionClick}></div>
                            {notice.poll_options.map(opt => (
                                <div key={opt.id} className="bg-white border text-gray-800 border-gray-200 rounded-2xl p-4 flex items-center gap-4">
                                    {opt.image_url && (
                                        <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-gray-100">
                                            <img src={opt.image_url} alt={opt.title} className="w-full h-full object-cover" />
                                        </div>
                                    )}
                                    <h4 className="text-sm font-bold flex-1">{opt.title}</h4>
                                </div>
                            ))}
                        </div>
                        <button onClick={handleActionClick} className="w-full mt-4 py-3 bg-white border border-gray-200 rounded-xl font-bold text-sm text-gray-600">
                            로그인하고 투표하기
                        </button>
                    </div>
                )}
            </div>

            {/* Bottom Floating Action Bar */}
            <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full md:max-w-lg bg-white/95 backdrop-blur-xl border-t border-gray-100 p-4 z-50 safe-area-bottom">
                {notice.is_recruiting ? (
                    <div className="flex gap-3 items-center">
                        <div className="flex flex-col pl-2 whitespace-nowrap min-w-fit">
                            <span className="text-[10px] font-black text-gray-400">모집마감</span>
                            <span className={`text-xs font-bold ${(notice.recruitment_deadline && new Date(notice.recruitment_deadline) < new Date()) ? 'text-gray-400' : 'text-red-500 max-w-[80px] truncate'}`}>{timeLeft || '기한없음'}</span>
                        </div>
                        <button 
                            onClick={handleActionClick}
                            className="flex-1 bg-blue-600 text-white rounded-2xl py-4 font-black shadow-lg shadow-blue-200"
                        >
                            로그인하고 신청하기
                        </button>
                    </div>
                ) : (
                    <button 
                        onClick={() => navigate('/')}
                        className="w-full bg-gray-900 text-white rounded-2xl py-4 font-black"
                    >
                        SCI CENTER 메인홈 가기
                    </button>
                )}
            </div>
        </div>
    );
};

export default PublicProgramDetail;
