import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { Calendar, User, ArrowLeft, Share, AlertCircle } from 'lucide-react';
import NoticeCarousel from '../components/student/components/NoticeCarousel';
import LinkPreview from '../components/common/LinkPreview';
import { extractUrls } from '../utils/textUtils';
import { formatToLocalISO } from '../utils/dateUtils';
import { TAB_NAMES } from '../constants/appConstants';

const PublicProgramDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [notice, setNotice] = useState(null);
    const [loading, setLoading] = useState(true);
    const [timeLeft, setTimeLeft] = useState('');
    const [pollTimeLeft, setPollTimeLeft] = useState('');
    const [isPollExpired, setIsPollExpired] = useState(false);
    
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
                .select('*')
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
                
                {/* Information Tags */}
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

                {/* Body Content */}
                <div className="prose max-w-none text-gray-800 leading-snug mb-8">
                    <div dangerouslySetInnerHTML={{ __html: notice.content }} />
                    {extractUrls(notice.content).map((url, i) => <LinkPreview key={i} url={url} />)}
                </div>

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
