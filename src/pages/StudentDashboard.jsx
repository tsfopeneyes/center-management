import React, { useEffect, useState } from 'react';
import { CATEGORIES, TAB_NAMES, RESPONSE_STATUS, BADGE_DEFINITIONS } from '../constants/appConstants';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../supabaseClient';
import { Clock, Info, LogOut, CheckCircle, XCircle, HelpCircle, Search, MessageSquare, Send, X, ArrowLeft, Image as ImageIcon, Grid, Settings, User, Plus, Heart, ZoomIn, RotateCw, Home, FileText, MessageCircle, BookOpen, MoreHorizontal, Bookmark, Share2, ShieldCheck, Calendar, Edit2, Trash2, Save, Trash, ChevronRight, Pin, Award, Share } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Microlink from '@microlink/react';
import { motion, AnimatePresence } from 'framer-motion';
import SunEditor from 'suneditor-react';
import 'suneditor/dist/css/suneditor.min.css';
import Cropper from 'react-easy-crop';
import confetti from 'canvas-confetti';

import StudentChat from '../components/student/StudentChat';
import UserAvatar from '../components/common/UserAvatar';
import LinkPreview from '../components/common/LinkPreview';
import NoticeModal from '../components/student/NoticeModal';
import ProgramCard from '../components/student/ProgramCard';
import { stripHtml, extractUrls } from '../utils/textUtils';
import { formatToLocalISO } from '../utils/dateUtils';
import { subscribeToPush } from '../utils/pushUtils';
import getCroppedImg from '../utils/imageUtils';

import { useMessaging } from '../hooks/useMessaging';
import { useNotices } from '../hooks/useNotices';
import { useGuestbook } from '../hooks/useGuestbook';
import { useProfile } from '../hooks/useProfile';
import { challengesApi } from '../api/challengesApi';

import { parseISO, isWithinInterval, startOfDay } from 'date-fns';

const getBadgeProgress = (badge, stats) => {
    const { visitCount, programCount, specialStats } = stats;
    let earned = false;
    let current = 0;
    let target = badge.threshold || 1;

    if (badge.type === 'VISIT') {
        current = visitCount;
        earned = visitCount >= target;
    } else if (badge.type === 'PROGRAM') {
        current = programCount;
        earned = programCount >= target;
    } else if (badge.type === 'SPECIAL') {
        const name = badge.name || '';
        if (name.includes('벌스데이') || name.includes('생일')) {
            earned = specialStats.isBirthdayVisited;
            current = earned ? 1 : 0;
            target = 1;
        } else if (name.includes('올 클리어') || name.includes('공간 정복')) {
            current = specialStats.uniqueLocationsCount;
            target = specialStats.totalLocationsCount || 1;
            earned = current >= target && target > 0;
        } else if (name.includes('하이파이브') || name.includes('연속')) {
            current = specialStats.maxConsecutiveDays;
            earned = current >= target;
        }
    }

    const percentage = Math.min(100, Math.floor((current / target) * 100));
    return { earned, current, target, percentage };
};

const BadgeModal = ({ badge, stats, onClose }) => {
    const { earned, current, target, percentage } = getBadgeProgress(badge, stats);
    const [imgError, setImgError] = useState(false);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-white w-full max-w-sm rounded-[3rem] overflow-hidden shadow-2xl relative"
                onClick={e => e.stopPropagation()}
            >
                {/* Header Decoration */}
                <div className={`h-32 w-full absolute top-0 left-0 -z-10 bg-gradient-to-br ${earned ? 'from-blue-600 to-indigo-500' : 'from-gray-200 to-gray-100'}`} />

                <div className="p-8 pt-12 flex flex-col items-center">
                    <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors">
                        <X size={20} />
                    </button>

                    {/* Badge Icon */}
                    <div className={`w-32 h-32 rounded-full border-8 border-white shadow-2xl flex items-center justify-center bg-white mb-6 relative ${earned ? 'animate-bounce-slow' : 'grayscale opacity-60'}`}>
                        {badge.image_url && !imgError ? (
                            <img src={badge.image_url} alt={badge.name} onError={() => setImgError(true)} className="w-full h-full object-cover rounded-full" />
                        ) : (
                            <span className="text-5xl">🎖️</span>
                        )}
                        {earned && (
                            <div className="absolute -bottom-2 -right-2 bg-yellow-400 text-white p-2 rounded-full shadow-lg">
                                <CheckCircle size={20} strokeWidth={3} />
                            </div>
                        )}
                    </div>

                    <h3 className="text-2xl font-black text-gray-800 mb-2">{badge.name}</h3>
                    <p className="text-gray-500 font-bold text-center text-sm mb-6 leading-relaxed">
                        {badge.description || '이 챌린지를 달성하고 멋진 뱃지를 획득하세요!'}
                    </p>

                    {/* Progress Card */}
                    <div className="w-full bg-gray-50 rounded-3xl p-6 border border-gray-100 mb-8">
                        <div className="flex justify-between items-end mb-3">
                            <span className="text-xs font-black text-gray-400 tracking-wider uppercase">현재 달성도</span>
                            <span className={`text-sm font-black ${earned ? 'text-blue-600' : 'text-gray-600'}`}>
                                {earned ? '달성 완료!' : `${current} / ${target}`}
                            </span>
                        </div>
                        <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden shadow-inner">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${percentage}%` }}
                                transition={{ duration: 1, ease: "easeOut" }}
                                className={`h-full rounded-full ${earned ? 'bg-gradient-to-r from-blue-500 to-indigo-500' : 'bg-blue-400'}`}
                            />
                        </div>
                        {!earned && (
                            <p className="text-[10px] text-gray-400 font-bold mt-3 text-center">
                                조금만 더 힘내세요! 목표까지 {target - current}번 남았습니다.
                            </p>
                        )}
                    </div>

                    <div className="flex gap-3 w-full">
                        <button
                            onClick={() => {
                                if (navigator.share) {
                                    navigator.share({
                                        title: `SCI CENTER ${badge.name} 뱃지`,
                                        text: earned ? `제가 '${badge.name}' 뱃지를 획득했어요!` : `'${badge.name}' 뱃지 획득에 도전 중입니다!`,
                                        url: window.location.href,
                                    });
                                } else {
                                    alert('공유하기 지원하지 않는 브라우저입니다.');
                                }
                            }}
                            className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-black hover:bg-gray-200 transition flex items-center justify-center gap-2"
                        >
                            <Share2 size={18} /> 공유
                        </button>
                        {earned && (
                            <button className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-100 hover:bg-blue-700 transition">
                                뱃지 자랑하기
                            </button>
                        )}
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
};

const BadgeItem = ({ badge, visitCount, programCount, specialStats, onClick }) => {
    const { earned, percentage } = getBadgeProgress(badge, { visitCount, programCount, specialStats });
    const [imgError, setImgError] = useState(false);

    return (
        <motion.div
            key={badge.id}
            whileHover={{ scale: 1.05, y: -5 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onClick(badge)}
            className="flex flex-col items-center gap-3 group cursor-pointer"
        >
            <div className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500 shadow-sm border-4 ${earned ? 'border-white bg-white shadow-[0_10px_25px_rgba(0,0,0,0.1)] ring-4 ring-blue-50' : 'bg-gray-100/50 border-gray-100/50 grayscale opacity-40'}`}>
                {badge.image_url && !imgError ? (
                    <img
                        src={badge.image_url}
                        alt={badge.name}
                        onError={() => setImgError(true)}
                        className={`w-full h-full object-cover rounded-full transition-all duration-500 ${earned ? 'opacity-100' : 'opacity-50 brightness-50'}`}
                    />
                ) : (
                    <span className={`text-3xl ${earned ? '' : 'opacity-50'}`}>🎖️</span>
                )}

                {!earned && (
                    <>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-12 h-12 bg-white/20 rounded-full backdrop-blur-sm flex items-center justify-center">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">
                                    {badge.type === 'VISIT' ? `${badge.threshold}V` : (badge.type === 'PROGRAM' ? `${badge.threshold}P` : 'GOAL')}
                                </span>
                            </div>
                        </div>
                        {/* Semi-circular progress indicator */}
                        <svg className="absolute inset-0 w-full h-full -rotate-90">
                            <circle
                                cx="50%"
                                cy="50%"
                                r="48%"
                                fill="none"
                                stroke="#e2e8f0"
                                strokeWidth="4"
                                strokeDasharray="100 100"
                            />
                            <motion.circle
                                cx="50%"
                                cy="50%"
                                r="48%"
                                fill="none"
                                stroke="#3b82f6"
                                strokeWidth="4"
                                strokeDasharray={`${percentage} 100`}
                                initial={{ strokeDasharray: "0 100" }}
                                animate={{ strokeDasharray: `${percentage} 100` }}
                                transition={{ duration: 1.5, ease: "easeOut" }}
                            />
                        </svg>
                    </>
                )}

                {/* Glow Effect for earned badges */}
                {earned && !imgError && (
                    <div className="absolute inset-0 rounded-full bg-blue-400/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
            </div>
            <div className="text-center">
                <p className={`text-xs font-black leading-tight ${earned ? 'text-gray-800' : 'text-gray-700'}`}>
                    {badge.name}
                </p>
                <div className="flex items-center justify-center gap-1 mt-1">
                    <p className={`text-[10px] font-bold ${earned ? 'text-blue-500' : 'text-gray-400'}`}>
                        {badge.criteria_label || (badge.type === 'VISIT' ? `${badge.threshold}회 방문` : (badge.type === 'PROGRAM' ? `${badge.threshold}회 참석` : '특별 조건'))}
                    </p>
                    {!earned && percentage > 0 && (
                        <span className="text-[9px] font-black text-blue-400 bg-blue-50 px-1 rounded-sm">{percentage}%</span>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

const StudentDashboard = () => {
    console.log("StudentDashboard Mounted");
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState(TAB_NAMES.HOME);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);

    // Hooks
    const { user, setUser, totalHours, visitCount, programCount, fetchStats, updateProfile, loading: profileLoadingState } = useProfile(null);
    const { notices, responses, fetchNotices, handleResponse } = useNotices(user?.id);
    const { messages, unreadCount, markAsRead } = useMessaging(user?.id);
    const { guestPosts, uploading: uploadingGuest, handleCreatePost, fetchComments: fetchGuestCommentsData, handlePostComment: handleGuestCommentSubmit, handleDeletePost: handleDeleteGuestPost, handleDeleteComment: handleDeleteGuestComment } = useGuestbook(user?.id);

    // UI-Specific State (Not in hooks)
    const [selectedNotice, setSelectedNotice] = useState(null);
    const [noticeContext, setNoticeContext] = useState(null);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');

    const [showGuestWrite, setShowGuestWrite] = useState(false);
    const [newGuestPost, setNewGuestPost] = useState({ content: '', images: [], previews: [] });
    const [selectedGuestPost, setSelectedGuestPost] = useState(null);
    const [guestComments, setGuestComments] = useState([]);
    const [newGuestComment, setNewGuestComment] = useState('');

    const [showProfileSettings, setShowProfileSettings] = useState(false);
    const [profileImage, setProfileImage] = useState(null);
    const [profilePreview, setProfilePreview] = useState(null);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [showCropModal, setShowCropModal] = useState(false);
    const [photoURL, setPhotoURL] = useState(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

    const [showProgramHistory, setShowProgramHistory] = useState(false);
    const [attendedProgramsList, setAttendedProgramsList] = useState([]);
    const [showEnlargedQr, setShowEnlargedQr] = useState(false);
    const [challengeCategories, setChallengeCategories] = useState([]);
    const [dynamicChallenges, setDynamicChallenges] = useState([]);
    const [challengesLoading, setChallengesLoading] = useState(false);
    const [specialStats, setSpecialStats] = useState({ isBirthdayVisited: false, uniqueLocationsCount: 0, maxConsecutiveDays: 0 });
    const [selectedBadge, setSelectedBadge] = useState(null);
    const [dashboardConfig, setDashboardConfig] = useState([
        { id: 'stats', label: '활동 통계', isVisible: true, count: 3 },
        { id: 'programs', label: '프로그램 신청', isVisible: true, count: 3 },
        { id: 'notices', label: '공지사항', isVisible: true, count: 3 },
        { id: 'gallery', label: '갤러리', isVisible: true, count: 6 }
    ]);

    const handleTabChange = (tabName) => {
        setActiveTab(tabName);
        setSelectedNotice(null);
        setNoticeContext(null);
        setSelectedGuestPost(null);
        setShowProfileSettings(false);
        setShowGuestWrite(false);

        // Celebration Logic
        if (tabName === TAB_NAMES.CHALLENGES) {
            const earnedCount = dynamicChallenges.filter(ch => getBadgeProgress(ch, { visitCount, programCount, specialStats }).earned).length;
            const lastSeenEarned = parseInt(localStorage.getItem(`lastEarnedCount_${user?.id}`) || '0');

            if (earnedCount > lastSeenEarned) {
                // Celebrate!
                setTimeout(() => {
                    confetti({
                        particleCount: 150,
                        spread: 70,
                        origin: { y: 0.6 },
                        colors: ['#3b82f6', '#4f46e5', '#ec4899', '#fbbf24']
                    });
                }, 500);
                localStorage.setItem(`lastEarnedCount_${user?.id}`, earnedCount.toString());
            }
        }
    };




    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (!storedUser) {
            alert('로그인이 필요합니다.');
            navigate('/');
            return;
        }

        const parsedUser = JSON.parse(storedUser);

        // Stabilize user state - only set if different
        if (!user || user.id !== parsedUser.id) {
            setUser(parsedUser);
        }

        fetchStats(parsedUser.id).then(res => {
            if (res && res.attendedPrograms) {
                setAttendedProgramsList(res.attendedPrograms);
            }
            if (res && res.specialStats) {
                setSpecialStats(res.specialStats);
            }
        });

        fetchChallengeData();
        subscribeToPush(parsedUser.id);
        setLoading(false);
    }, [navigate, fetchStats]); // Removed user/setUser from deps to avoid identity loops

    useEffect(() => {
        const fetchDashboardConfig = async () => {
            const { data } = await supabase
                .from('notices')
                .select('content')
                .eq('category', CATEGORIES.SYSTEM)
                .eq('title', 'STUDENT_DASHBOARD_CONFIG')
                .maybeSingle();

            if (data && data.content) {
                try {
                    const parsed = JSON.parse(data.content);
                    if (Array.isArray(parsed)) setDashboardConfig(parsed);
                } catch (e) {
                    console.error('Failed to parse dashboard config', e);
                }
            }
        };
        fetchDashboardConfig();
    }, []);

    const fetchChallengeData = async () => {
        setChallengesLoading(true);
        try {
            const [cats, chs] = await Promise.all([
                challengesApi.fetchCategories(),
                challengesApi.fetchChallenges()
            ]);
            setChallengeCategories(cats);
            setDynamicChallenges(chs);
        } catch (error) {
            console.error('Challenge fetch error:', error);
        } finally {
            setChallengesLoading(false);
        }
    };

    // Deep-linking: Open notice from URL query param
    useEffect(() => {
        if (notices.length > 0) {
            const params = new URLSearchParams(window.location.search);
            const noticeId = params.get('noticeId');
            if (noticeId) {
                const target = notices.find(n => n.id === noticeId);
                if (target) {
                    openNoticeDetail(target);
                    // Clear the query param without refresh to keep URL clean
                    window.history.replaceState({}, '', window.location.pathname);
                }
            }
        }
    }, [notices]);

    const handlePostComment = async (e) => {
        e.preventDefault();
        if (!newComment.trim()) return;
        try {
            const { error } = await supabase.from('comments').insert([{
                notice_id: selectedNotice.id,
                user_id: user?.id,
                content: newComment
            }]);
            if (error) throw error;
            setNewComment('');
            // Fetch updated comments
            const { data } = await supabase
                .from('comments')
                .select('*, users(name, profile_image_url)')
                .eq('notice_id', selectedNotice.id)
                .order('created_at', { ascending: true });
            setComments(data || []);
        } catch (err) { alert('댓글 작성 실패'); }
    };

    const handleDeleteComment = async (commentId) => {
        if (!confirm('댓글을 삭제하시겠습니까?')) return;
        try {
            const { error } = await supabase
                .from('comments')
                .delete()
                .eq('id', commentId)
                .eq('user_id', user?.id);
            if (error) throw error;
            // Fetch updated comments
            const { data } = await supabase
                .from('comments')
                .select('*, users(name, profile_image_url)')
                .eq('notice_id', selectedNotice.id)
                .order('created_at', { ascending: true });
            setComments(data || []);
        } catch (err) {
            console.error(err);
            alert('댓글 삭제 실패');
        }
    };

    const openNoticeDetail = async (notice, context = null) => {
        setSelectedNotice(notice);
        setNoticeContext(context);
        try {
            const { data } = await supabase
                .from('comments')
                .select('*, users(name, profile_image_url)')
                .eq('notice_id', notice.id)
                .order('created_at', { ascending: true });
            setComments(data || []);
        } catch (err) { console.error(err); }
    };

    const handleCreateGuestPost = async () => {
        const success = await handleCreatePost(newGuestPost.content, newGuestPost.images);
        if (success) {
            setNewGuestPost({ content: '', images: [], previews: [] });
            setShowGuestWrite(false);
        }
    };
    const openGuestPostDetail = async (post) => {
        setSelectedGuestPost(post);
        const data = await fetchGuestCommentsData(post.id);
        setGuestComments(data);
    };

    const handlePostGuestCommentData = async (e) => {
        e.preventDefault();
        const success = await handleGuestCommentSubmit(selectedGuestPost.id, newGuestComment);
        if (success) {
            setNewGuestComment('');
            const data = await fetchGuestCommentsData(selectedGuestPost.id);
            setGuestComments(data);
        }
    };

    const onDeleteGuestPost = async (postId) => {
        if (!confirm('방명록 글을 삭제하시겠습니까?')) return;
        const success = await handleDeleteGuestPost(postId);
        if (success) {
            setSelectedGuestPost(null);
            alert('삭제되었습니다.');
        }
    };

    const onDeleteGuestComment = async (commentId) => {
        if (!confirm('댓글을 삭제하시겠습니까?')) return;
        const success = await handleDeleteGuestComment(selectedGuestPost.id, commentId);
        if (success) {
            const data = await fetchGuestCommentsData(selectedGuestPost.id);
            setGuestComments(data);
        }
    };

    const handleGuestFileSelect = (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            const newPreviews = files.map(file => URL.createObjectURL(file));
            setNewGuestPost(prev => ({
                ...prev,
                images: [...prev.images, ...files],
                previews: [...prev.previews, ...newPreviews]
            }));
        }
    };





    // Filter Notices



    // Filter Notices
    const filteredNotices = notices.filter(n =>
        n.category === CATEGORIES.NOTICE &&
        (n.title.toLowerCase().includes(searchQuery.toLowerCase()) || n.content.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const galleryNotices = notices.filter(n =>
        n.category === CATEGORIES.GALLERY &&
        (n.title.toLowerCase().includes(searchQuery.toLowerCase()) || n.content.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const filteredPrograms = notices.filter(n =>
        n.category === CATEGORIES.PROGRAM &&
        (n.title.toLowerCase().includes(searchQuery.toLowerCase()) || n.content.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const homeNotices = filteredNotices.slice(0, 3);
    const homePrograms = filteredPrograms
        .filter(p => !p.program_date || new Date(p.program_date) >= startOfDay(new Date()))
        .slice(0, 3);
    const homeGallery = notices.filter(n => n.category === CATEGORIES.GALLERY).slice(0, 3);



    const handleProfileImageSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            setPhotoURL(URL.createObjectURL(file));
            setShowCropModal(true);
            // Reset Cropper
            setZoom(1);
            setRotation(0);
            setCrop({ x: 0, y: 0 });
        }
    };

    const onCropComplete = (croppedArea, croppedAreaPixels) => {
        setCroppedAreaPixels(croppedAreaPixels);
    };

    const handleCropSave = async () => {
        try {
            const croppedImageBlob = await getCroppedImg(photoURL, croppedAreaPixels, rotation);
            const file = new File([croppedImageBlob], "profile_cropped.jpg", { type: "image/jpeg" });

            setProfileImage(file);
            setProfilePreview(URL.createObjectURL(file));
            setShowCropModal(false);
        } catch (e) {
            console.error(e);
            alert('이미지 크롭 실패');
        }
    };

    const handleSaveProfile = async () => {
        const updates = {};
        if (newPassword) {
            if (newPassword.length < 4) {
                alert('비밀번호는 4자리 이상이어야 합니다.');
                return;
            }
            if (newPassword !== confirmPassword) {
                alert('비밀번호 확인이 일치하지 않습니다.');
                return;
            }
            updates.password = newPassword;
        }

        const result = await updateProfile(updates, profileImage);

        if (result.success) {
            alert('프로필이 업데이트되었습니다.');
            setShowProfileSettings(false);
            setProfileImage(null);
            setNewPassword('');
            setConfirmPassword('');
        } else {
            alert('프로필 저장 실패: ' + result.error);
        }
    };


    if (loading || !user) {
        return (
            <div className="w-full md:max-w-lg mx-auto min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-gray-400 font-bold animate-pulse">정보를 불러오는 중...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full md:max-w-lg mx-auto min-h-screen bg-gray-50 pb-20 font-sans">
            {/* Main Content */}
            <div className="p-4 pt-4">
            </div>

            {/* Modals & Overlays */}
            <AnimatePresence>
                {selectedNotice && (
                    <NoticeModal
                        key={selectedNotice.id}
                        notice={selectedNotice}
                        context={noticeContext}
                        onClose={() => { setSelectedNotice(null); setNoticeContext(null); }}
                        user={user}
                        responses={responses}
                        onResponse={handleResponse}
                        comments={comments}
                        newComment={newComment}
                        setNewComment={setNewComment}
                        onPostComment={handlePostComment}
                        onDeleteComment={handleDeleteComment}
                    />
                )}

                {selectedBadge && (
                    <BadgeModal
                        badge={selectedBadge}
                        stats={{ visitCount, programCount, specialStats }}
                        onClose={() => setSelectedBadge(null)}
                    />
                )}

                {/* Profile Settings Modal */}
                {showProfileSettings && (
                    <motion.div
                        key="profile-settings"
                        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="fixed inset-0 z-[110] bg-white flex flex-col sm:rounded-t-3xl sm:top-10 shadow-2xl pb-20"
                    >
                        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-20">
                            <button onClick={() => setShowProfileSettings(false)} className="p-2 hover:bg-gray-100 rounded-full">
                                <X size={24} className="text-gray-600" />
                            </button>
                            <h3 className="font-bold text-lg">프로필 설정</h3>
                            <button onClick={handleSaveProfile} disabled={profileLoadingState} className="text-blue-600 font-bold px-2 disabled:text-gray-300">
                                {profileLoadingState ? '...' : '저장'}
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-8">
                            <div className="flex flex-col items-center gap-4">
                                <div className="relative">
                                    {profilePreview || user?.profile_image_url ? (
                                        <img src={profilePreview || user?.profile_image_url} alt="Profile" className="w-32 h-32 rounded-full object-cover border-4 border-gray-50 shadow-sm" />
                                    ) : (
                                        <div className="w-32 h-32 rounded-full bg-gray-100 flex items-center justify-center">
                                            <User size={48} className="text-gray-300" />
                                        </div>
                                    )}
                                    <label className="absolute bottom-0 right-0 p-2 bg-blue-600 text-white rounded-full cursor-pointer hover:bg-blue-700 shadow-md transition">
                                        <ImageIcon size={16} />
                                        <input type="file" accept="image/*" className="hidden" onChange={handleProfileImageSelect} />
                                    </label>
                                </div>
                                <p className="text-sm text-gray-400">프로필 사진을 변경하려면 카메라 아이콘을 누르세요</p>
                            </div>
                            <div className="space-y-4">
                                <h4 className="font-bold text-gray-800 border-b pb-2">비밀번호 변경</h4>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1 ml-1">새 비밀번호 (4자리 이상)</label>
                                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="변경할 비밀번호를 입력하세요" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-base" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1 ml-1">새 비밀번호 확인</label>
                                    <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="비밀번호를 다시 입력하세요" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-base" />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Guestbook Write Modal */}
                {showGuestWrite && (
                    <motion.div
                        key="guest-write"
                        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="fixed inset-0 z-[110] bg-white flex flex-col sm:rounded-t-3xl sm:top-20 shadow-2xl pb-20"
                    >
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                            <button onClick={() => setShowGuestWrite(false)} className="text-gray-500 font-bold px-2">취소</button>
                            <h3 className="font-bold text-lg">새 글 쓰기</h3>
                            <button onClick={handleCreateGuestPost} disabled={uploadingGuest} className="text-blue-600 font-bold px-2 disabled:text-gray-300">
                                {uploadingGuest ? '...' : '완료'}
                            </button>
                        </div>
                        <div className="p-4 flex-1 overflow-y-auto">
                            <textarea value={newGuestPost.content} onChange={e => setNewGuestPost({ ...newGuestPost, content: e.target.value })} placeholder="무슨 생각을 하고 계신가요?" className="w-full h-40 text-lg outline-none resize-none placeholder:text-gray-300" />

                            <div className="flex flex-wrap gap-2 mt-2">
                                {newGuestPost.previews.map((preview, idx) => (
                                    <div key={idx} className="relative w-24 h-24 rounded-xl overflow-hidden shadow-sm border border-gray-100">
                                        <img src={preview} alt="preview" className="w-full h-full object-cover" />
                                        <button
                                            onClick={() => {
                                                const newImages = [...newGuestPost.images];
                                                const newPreviews = [...newGuestPost.previews];
                                                newImages.splice(idx, 1);
                                                newPreviews.splice(idx, 1);
                                                setNewGuestPost({ ...newGuestPost, images: newImages, previews: newPreviews });
                                            }}
                                            className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 border border-white/20 backdrop-blur-sm"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}

                                {newGuestPost.images.length < 8 && (
                                    <label className="inline-flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition">
                                        <ImageIcon className="text-gray-400" />
                                        <span className="text-[10px] text-gray-400 mt-1">추가</span>
                                        <input type="file" accept="image/*" className="hidden" multiple onChange={handleGuestFileSelect} />
                                    </label>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Guestbook Detail Modal */}
                {selectedGuestPost && (
                    <motion.div
                        key="guest-detail"
                        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="fixed inset-0 z-[110] bg-white flex flex-col sm:rounded-t-3xl sm:top-10 shadow-2xl pb-20"
                    >
                        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                            <div className="flex items-center gap-2">
                                <UserAvatar user={selectedGuestPost.users} size="w-8 h-8" />
                                <span className="font-bold text-gray-700">{selectedGuestPost.users?.name}</span>
                            </div>
                            {selectedGuestPost.user_id === user?.id && (
                                <button onClick={() => onDeleteGuestPost(selectedGuestPost.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-full transition"><Trash2 size={18} /></button>
                            )}
                        </div>
                        <div className="flex-1 overflow-y-auto pb-20">
                            <div className="p-4">
                                <div className="flex items-center gap-3 mb-4">
                                    <UserAvatar user={selectedGuestPost.users} size="w-10 h-10" />
                                    <div>
                                        <div className="font-bold text-gray-800 text-sm">{selectedGuestPost.users?.name}</div>
                                        <div className="text-xs text-gray-400">{new Date(selectedGuestPost.created_at).toLocaleString()}</div>
                                    </div>
                                </div>
                                <p className="text-gray-800 text-base mb-4 whitespace-pre-wrap leading-relaxed">{selectedGuestPost.content}</p>
                                {/* Image Display in Detail */}
                                {(selectedGuestPost.images?.length > 0 || selectedGuestPost.image_url) && (
                                    <div className={`mb-4 rounded-xl overflow-hidden border border-gray-50 shadow-sm ${(selectedGuestPost.images?.length > 1) ? 'grid grid-cols-2 gap-1' : 'bg-gray-50'
                                        }`}>
                                        {selectedGuestPost.images?.length > 1 ? (
                                            selectedGuestPost.images.map((img, idx) => (
                                                <div key={idx} className="relative aspect-square">
                                                    <img src={img} alt="post" className="w-full h-full object-cover" />
                                                </div>
                                            ))
                                        ) : (
                                            <img
                                                src={selectedGuestPost.images?.[0] || selectedGuestPost.image_url}
                                                alt="post"
                                                className="w-full h-auto max-h-[500px] object-contain mx-auto"
                                            />
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="border-t border-gray-100 p-4">
                                <h4 className="font-bold text-sm text-gray-600 mb-3">댓글</h4>
                                <div className="space-y-3">
                                    {guestComments.map(c => (
                                        <div key={c.id} className="bg-gray-50 p-3 rounded-2xl">
                                            <div className="flex justify-between items-baseline mb-1">
                                                <div className="flex items-center gap-2">
                                                    <UserAvatar user={c.users} size="w-4 h-4" textSize="text-[8px]" />
                                                    <span className="font-bold text-sm text-gray-800">{c.users?.name}</span>
                                                </div>
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="font-bold text-gray-900">{c.users?.name}</span>
                                                    {c.user_id === user?.id && (
                                                        <button onClick={() => onDeleteGuestComment(c.id)} className="text-red-400 p-1"><Trash size={12} /></button>
                                                    )}
                                                </div>
                                            </div>
                                            <p className="text-sm text-gray-600 ml-6">{c.content}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="p-4 border-t border-gray-100 bg-white sticky bottom-0">
                            <form onSubmit={handlePostGuestCommentData} className="flex gap-2">
                                <input type="text" value={newGuestComment} onChange={(e) => setNewGuestComment(e.target.value)} placeholder="댓글을 남겨주세요..." className="flex-1 bg-gray-100 rounded-full px-5 py-3 text-base outline-none focus:ring-2 focus:ring-green-500 transition" />
                                <button type="submit" disabled={!newGuestComment.trim()} className="bg-green-600 text-white p-3 rounded-full hover:bg-green-700 disabled:bg-gray-300 transition active:scale-90">
                                    <Send size={18} />
                                </button>
                            </form>
                        </div>
                    </motion.div>
                )}

                {/* Enlarged QR Modal */}
                {showEnlargedQr && (
                    <motion.div
                        key="enlarged-qr"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowEnlargedQr(false)}
                        className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-10"
                    >
                        <motion.div
                            initial={{ scale: 0.5, y: 50 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.5, y: 50 }}
                            onClick={e => e.stopPropagation()}
                            className="bg-white p-8 rounded-[3rem] shadow-2xl flex flex-col items-center gap-6"
                        >
                            <div className="p-4 bg-white rounded-2xl border border-gray-100">
                                <QRCodeSVG value={user?.id || '0000'} size={250} level="H" />
                            </div>
                            <div className="text-center">
                                <p className="text-4xl font-mono font-black text-gray-800 tracking-[0.3em] mb-2">{user?.phone_back4}</p>
                                <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">Scan at Kiosk</p>
                            </div>
                            <button
                                onClick={() => setShowEnlargedQr(false)}
                                className="mt-4 p-4 bg-gray-100 rounded-full hover:bg-gray-200 transition"
                            >
                                <X size={32} className="text-gray-600" />
                            </button>
                        </motion.div>
                    </motion.div>
                )}
                {/* Program History Modal */}
                {showProgramHistory && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
                        onClick={() => setShowProgramHistory(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="bg-white w-full max-w-sm rounded-[2.5rem] overflow-hidden shadow-2xl"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="p-8 pb-4 flex justify-between items-center">
                                <h3 className="text-xl font-black text-gray-800">참여 프로그램 내역</h3>
                                <button onClick={() => setShowProgramHistory(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                    <X size={20} className="text-gray-400" />
                                </button>
                            </div>
                            <div className="px-8 pb-10 max-h-[60vh] overflow-y-auto">
                                {attendedProgramsList.length === 0 ? (
                                    <div className="text-center py-10">
                                        <p className="text-gray-400 font-bold">참여한 프로그램이 없습니다.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {attendedProgramsList.map((title, idx) => (
                                            <div key={idx} className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 flex items-center gap-3">
                                                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                                                    <CheckCircle size={16} strokeWidth={3} />
                                                </div>
                                                <span className="text-gray-700 font-bold text-sm leading-tight">{title}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Cropper Modal */}
            {showCropModal && (
                <div className="fixed inset-0 z-[110] bg-black flex flex-col animate-fade-in pb-20">
                    <div className="flex-1 relative bg-black">
                        <Cropper
                            image={photoURL}
                            crop={crop}
                            zoom={zoom}
                            rotation={rotation}
                            aspect={1}
                            onCropChange={setCrop}
                            onCropComplete={onCropComplete}
                            onZoomChange={setZoom}
                            onRotationChange={setRotation}
                            cropShape="round"
                            showGrid={false}
                        />
                    </div>
                    <div className="bg-gray-900 p-6 flex flex-col gap-4">
                        <div className="flex items-center gap-4">
                            <ZoomIn className="text-gray-400" size={20} />
                            <span className="text-white text-xs w-10">Zoom</span>
                            <input
                                type="range"
                                value={zoom}
                                min={1}
                                max={3}
                                step={0.1}
                                onChange={(e) => setZoom(e.target.value)}
                                className="flex-1 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>
                        <div className="flex items-center gap-4">
                            <RotateCw className="text-gray-400" size={20} />
                            <span className="text-white text-xs w-10">Rot</span>
                            <input
                                type="range"
                                value={rotation}
                                min={0}
                                max={360}
                                step={1}
                                onChange={(e) => setRotation(e.target.value)}
                                className="flex-1 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>
                        <div className="flex gap-3 justify-end mt-2">
                            <button
                                onClick={() => setShowCropModal(false)}
                                className="px-6 py-3 text-white bg-gray-700 rounded-xl hover:bg-gray-600 transition font-bold"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleCropSave}
                                className="px-6 py-3 text-white bg-blue-600 rounded-xl hover:bg-blue-500 font-bold transition shadow-lg shadow-blue-900/20"
                            >
                                완료
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === TAB_NAMES.HOME && (
                <>
                    {/* Compact Integrated Header */}
                    {/* [COMPACT EFFICIENCY UI] - 여백을 최소화하여 데이터 밀도를 높임 */}
                    <header className="bg-primary-gradient p-5 pt-10 pb-6 text-white rounded-b-[2.5rem] shadow-2xl relative overflow-hidden mb-0 gpu-accelerated">
                        {/* Subtle Decorative Elements */}
                        <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-[60px] animate-float" />
                        <div className="absolute bottom-[-10%] left-[-5%] w-48 h-48 bg-indigo-500/20 rounded-full blur-[50px] animate-float [animation-delay:-5s]" />

                        <div className="relative z-10 max-w-sm mx-auto">
                            {/* Compact Content Wrapper */}
                            <div className="flex flex-col gap-5">
                                {/* Top: Info & QR Row */}
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <motion.div
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => setShowProfileSettings(true)}
                                            className="cursor-pointer p-0.5 bg-white/20 backdrop-blur-md rounded-full shadow-lg ring-2 ring-white/5 shrink-0"
                                        >
                                            <UserAvatar user={user} size="w-16 h-16" textSize="text-xl" />
                                        </motion.div>
                                        <div className="flex flex-col min-w-0">
                                            <p className="text-white/60 text-[10px] font-black tracking-widest uppercase mb-0.5">{user?.school || 'WELCOME'}</p>
                                            <h1 className="text-xl sm:text-2xl font-black tracking-tight leading-tight text-white whitespace-nowrap">
                                                {user?.name} 님!
                                            </h1>
                                        </div>
                                    </div>

                                    <motion.div
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => setShowEnlargedQr(true)}
                                        className="bg-white p-2.5 rounded-[1.5rem] shadow-xl flex flex-col items-center cursor-pointer shrink-0 border-[3px] border-white shadow-blue-900/5"
                                    >
                                        <QRCodeSVG value={user?.id || '0000'} size={70} level="H" />
                                        <span className="text-[10px] font-mono font-black text-gray-800 mt-1 tracking-wider">{user?.phone_back4}</span>
                                    </motion.div>
                                </div>

                                {/* Bottom: Compact Action Buttons */}
                                <div className="flex gap-2">
                                    {user?.role === 'admin' && (
                                        <button
                                            onClick={() => navigate('/admin')}
                                            className="flex-1 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-xl transition-all btn-tactile border border-white/5 backdrop-blur-md"
                                        >
                                            <ShieldCheck size={20} className="text-white" />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setShowProfileSettings(true)}
                                        className="flex-1 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-xl transition-all btn-tactile border border-white/5 backdrop-blur-md"
                                    >
                                        <Settings size={20} className="text-white" />
                                    </button>
                                    <button
                                        onClick={() => { localStorage.removeItem('user'); localStorage.removeItem('admin_user'); navigate('/'); }}
                                        className="flex-1 h-10 flex items-center justify-center bg-white/10 hover:bg-red-500/30 rounded-xl transition-all btn-tactile border border-white/5 group backdrop-blur-md"
                                    >
                                        <LogOut size={20} className="text-white/80 group-hover:text-white" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </header>

                    <div className="p-2.5 pt-2.5 pb-10 space-y-2.5 relative z-0">

                        {dashboardConfig.map((config) => {
                            if (!config.isVisible) return null;

                            switch (config.id) {
                                case 'stats':
                                    return (
                                        <div key="stats" className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-around">
                                            <div className="flex flex-col items-center flex-1">
                                                <p className="text-gray-400 text-[9px] mb-1 font-black uppercase tracking-wider">이용시간</p>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-2xl font-black text-blue-600 tracking-tighter">{totalHours}</span>
                                                    <span className="text-blue-300 text-[9px] font-black">시간</span>
                                                </div>
                                            </div>

                                            <div className="w-px h-8 bg-gray-100" />

                                            <div className="flex flex-col items-center flex-1">
                                                <p className="text-gray-400 text-[9px] mb-1 font-black uppercase tracking-wider">방문 수</p>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-2xl font-black text-indigo-600 tracking-tighter">{visitCount}</span>
                                                    <span className="text-indigo-200 text-[9px] font-black">일</span>
                                                </div>
                                            </div>

                                            <div className="w-px h-8 bg-gray-100" />

                                            <button onClick={() => setShowProgramHistory(true)} className="flex flex-col items-center flex-1 group active:scale-95 transition-transform">
                                                <p className="text-gray-400 text-[9px] mb-1 font-black uppercase tracking-wider flex items-center gap-1 group-hover:text-pink-400 transition-colors">
                                                    프로그램 <ChevronRight size={8} />
                                                </p>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-2xl font-black text-pink-500 tracking-tighter">{programCount}</span>
                                                    <span className="text-pink-200 text-[9px] font-black">회</span>
                                                </div>
                                            </button>
                                        </div>
                                    );


                                case 'programs':
                                    return (
                                        <div key="programs" className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                                            <h3 className="font-bold text-gray-800 mb-3 flex justify-between items-center text-sm">
                                                🔥 센터 프로그램 신청
                                                <button onClick={() => setActiveTab(TAB_NAMES.PROGRAMS)} className="text-[10px] text-blue-500 font-bold">전체보기</button>
                                            </h3>
                                            <div className="flex gap-3 overflow-x-auto pb-3 -mx-4 px-4 snap-x" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                                                {homePrograms.slice(0, config.count).map(p => (
                                                    <div key={p.id} className="min-w-[240px] w-[240px] snap-center">
                                                        <ProgramCard
                                                            program={{ ...p, responseStatus: responses[p.id] }}
                                                            onClick={openNoticeDetail}
                                                        />
                                                    </div>
                                                ))}
                                                {homePrograms.length === 0 && <p className="text-center py-4 text-gray-400 text-[10px] w-full">신청 가능한 프로그램이 없습니다</p>}
                                            </div>
                                        </div>
                                    );
                                case 'notices':
                                    return (
                                        <div key="notices" className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                                            <h3 className="font-bold text-gray-800 mb-3 flex justify-between items-center text-sm">
                                                공지사항
                                                <button onClick={() => setActiveTab(TAB_NAMES.NOTICES)} className="text-[10px] text-blue-500 font-bold">더보기</button>
                                            </h3>
                                            <ul className="space-y-2">
                                                {homeNotices.slice(0, config.count).map(n => (
                                                    <li key={n.id} onClick={() => openNoticeDetail(n)} className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-2 -mx-2 rounded-lg transition">
                                                        {n.is_sticky ? (
                                                            <div className="px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded text-[9px] font-bold whitespace-nowrap">공지</div>
                                                        ) : (
                                                            <div className={`w-1.5 h-1.5 rounded-full ${n.is_recruiting ? 'bg-red-500' : 'bg-blue-500'}`} />
                                                        )}
                                                        <span className="flex-1 text-xs text-gray-700 truncate">{n.title}</span>
                                                        {(n.images?.length > 0 || n.image_url) && <ImageIcon size={10} className="text-gray-400" />}
                                                        <span className="text-[10px] text-gray-400">{new Date(n.created_at).toLocaleDateString()}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    );
                                case 'gallery':
                                    return homeGallery.length > 0 && (
                                        <div key="gallery" className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                                            <h3 className="font-bold text-gray-800 mb-3 flex justify-between items-center text-sm">
                                                갤러리
                                                <button onClick={() => setActiveTab(TAB_NAMES.GALLERY)} className="text-[10px] text-pink-500 font-bold">더보기</button>
                                            </h3>
                                            <div className="grid grid-cols-3 gap-1 rounded-lg overflow-hidden">
                                                {homeGallery.slice(0, config.count).map(n => {
                                                    const thumb = n.images?.length > 0 ? n.images[0] : n.image_url;
                                                    if (!thumb) return null;
                                                    return (
                                                        <div key={n.id} onClick={() => openNoticeDetail(n, galleryNotices)} className="relative aspect-[4/5] bg-gray-100 overflow-hidden cursor-pointer group">
                                                            <img src={thumb} alt={n.title} className="w-full h-full object-cover transition duration-300 group-hover:scale-110" />
                                                            {n.images?.length > 1 && (
                                                                <div className="absolute top-1 right-1 bg-black/50 text-white p-0.5 rounded-full">
                                                                    <ImageIcon size={9} />
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    );
                                default:
                                    return null;
                            }
                        })}
                    </div>

                </>
            )}

            {activeTab === TAB_NAMES.CHALLENGES && (
                <div className="p-2.5 pt-10 pb-32 relative overflow-hidden min-h-screen">
                    {/* Decorative Background Elements */}
                    <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-blue-400/10 rounded-full blur-3xl -z-10" />
                    <div className="absolute bottom-[20%] left-[-10%] w-48 h-48 bg-pink-400/10 rounded-full blur-3xl -z-10" />

                    <div className="flex justify-between items-end mb-8 px-2">
                        <div>
                            <h1 className="text-3xl font-black text-gray-800 flex items-center gap-3">
                                챌린지 🏆
                                <span className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-full font-black shadow-lg shadow-blue-200">
                                    {dynamicChallenges.filter(ch => getBadgeProgress(ch, { visitCount, programCount, specialStats }).earned).length} / {dynamicChallenges.length}
                                </span>
                            </h1>
                            <p className="text-gray-400 text-sm mt-2 font-bold">활동을 통해 멋진 뱃지를 획득해보세요!</p>
                        </div>
                    </div>

                    <div className="space-y-12">
                        {challengeCategories.map(cat => {
                            const catChallenges = dynamicChallenges.filter(ch => ch.category_id === cat.id);
                            if (catChallenges.length === 0) return null;

                            return (
                                <div key={cat.id} className="bg-white/60 backdrop-blur-xl p-8 rounded-[3rem] border border-white shadow-[0_20px_50px_rgba(0,0,0,0.05)]">
                                    <div className="mb-8 border-b border-gray-100 pb-4">
                                        <h2 className="text-xl font-black text-gray-800">{cat.name}</h2>
                                        {cat.description && <p className="text-xs text-gray-400 font-bold mt-1">{cat.description}</p>}
                                    </div>
                                    <div className="grid grid-cols-3 gap-y-12 gap-x-4">
                                        {catChallenges.map(badge => (
                                            <BadgeItem
                                                key={badge.id}
                                                badge={badge}
                                                visitCount={visitCount}
                                                programCount={programCount}
                                                specialStats={specialStats}
                                                onClick={setSelectedBadge}
                                            />
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {activeTab === TAB_NAMES.PROGRAMS && (
                <div className="p-2.5 pt-8 pb-32">
                    <h1 className="text-3xl font-black text-gray-800 mb-2">센터 프로그램 🚀</h1>
                    <p className="text-gray-500 text-sm mb-6">다양한 프로그램에 참여해보세요!</p>

                    <div className="relative mb-6 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={20} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="프로그램 검색..."
                            className="w-full pl-12 p-4 bg-white border border-gray-100 rounded-[1.5rem] shadow-lg shadow-gray-200/50 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                        />
                    </div>

                    <div className="space-y-4">
                        {filteredPrograms.length === 0 ? (
                            <div className="text-center py-20 text-gray-400">진행 중인 프로그램이 없습니다.</div>
                        ) : (
                            filteredPrograms.map(n => (
                                <ProgramCard
                                    key={n.id}
                                    program={{ ...n, responseStatus: responses[n.id] }}
                                    onClick={openNoticeDetail}
                                />
                            ))
                        )}
                    </div>
                </div>
            )
            }

            {activeTab === TAB_NAMES.NOTICES && (
                <div className="p-2.5 pt-8 pb-32">
                    <h1 className="text-3xl font-black text-gray-800 mb-6">공지사항 📢</h1>
                    <div className="relative mb-6">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="검색어를 입력하세요..." className="w-full pl-12 p-4 bg-white border border-gray-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div className="space-y-4">
                        {filteredNotices.length === 0 ? (
                            <div className="text-center py-20 text-gray-400">등록된 공지사항이 없습니다.</div>
                        ) : (
                            filteredNotices.map(n => (
                                <motion.div
                                    key={n.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    onClick={() => openNoticeDetail(n)}
                                    className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 btn-tactile cursor-pointer hover:shadow-md"
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-2">
                                            {n.is_sticky && (
                                                <span className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 text-orange-600 rounded-full text-[10px] font-black shadow-sm whitespace-nowrap shrink-0">
                                                    <Pin size={12} className="fill-orange-600" /> 공지
                                                </span>
                                            )}
                                            <h3 className="font-extrabold text-gray-800 text-base leading-tight line-clamp-1">{n.title}</h3>
                                        </div>
                                        {n.is_recruiting && <span className="px-2.5 py-1 bg-indigo-100 text-indigo-600 rounded-full text-[10px] font-black">모집중</span>}
                                    </div>
                                    {/* Thumbnail */}
                                    {(n.images?.length > 0 || n.image_url) && (
                                        <div className="mb-4 rounded-2xl overflow-hidden h-36 bg-gray-50 border border-gray-100 relative shadow-inner">
                                            <img src={n.images?.length > 0 ? n.images[0] : n.image_url} alt="thumbnail" className="w-full h-full object-cover" />
                                            {n.images?.length > 1 && <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-3 py-1 rounded-full border border-white/10">+{n.images.length - 1}</div>}
                                        </div>
                                    )}
                                    <p className="text-sm text-gray-500 line-clamp-2 mb-4 leading-relaxed font-medium">{stripHtml(n.content)}</p>
                                    <div className="flex justify-between items-center text-[10px] text-gray-400 border-t border-gray-50 pt-4 font-bold uppercase tracking-wider">
                                        <span>{new Date(n.created_at).toLocaleDateString()}</span>
                                        <span className="flex items-center gap-1.5 text-blue-600">상세보기 <ChevronRight size={12} /></span>
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </div>
                </div>
            )
            }

            {activeTab === TAB_NAMES.GALLERY && (
                <div className="p-2.5 pt-8 pb-32">
                    <h1 className="text-3xl font-black text-gray-800 mb-2">스처 갤러리 📸</h1>
                    <p className="text-gray-500 text-sm mb-6">우리들의 추억을 모아보세요</p>

                    <div className="grid grid-cols-3 gap-1.5 rounded-2xl overflow-hidden">
                        {galleryNotices.map(n => {
                            const thumb = n.images?.length > 0 ? n.images[0] : n.image_url;
                            if (!thumb) return null;
                            return (
                                <div key={n.id} onClick={() => openNoticeDetail(n, galleryNotices)} className="relative aspect-[4/5] bg-gray-100 overflow-hidden cursor-pointer group rounded-xl border border-gray-100/50">
                                    <img src={thumb} alt={n.title} className="w-full h-full object-cover transition duration-300 group-hover:scale-110" />
                                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                        {n.images?.length > 1 && <ImageIcon className="text-white drop-shadow-md" size={20} />}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                    {galleryNotices.length === 0 && <div className="text-center py-20 text-gray-400 text-sm italic">등록된 사진이 없습니다.</div>}
                </div>
            )}

            {
                activeTab === TAB_NAMES.MESSAGES && (
                    <StudentChat currentUser={user} onRefreshUnread={() => { }} />
                )
            }

            {
                activeTab === TAB_NAMES.GUESTBOOK && (
                    <div className="p-2.5 pt-8 pb-32 relative min-h-screen">
                        <h1 className="text-3xl font-black text-gray-800 mb-2">방명록 👋</h1>
                        <p className="text-gray-500 text-sm mb-6">자유롭게 글과 사진을 남겨주세요</p>

                        <div className="space-y-6">
                            {guestPosts.map(post => (
                                <div key={post.id} className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100" onClick={() => openGuestPostDetail(post)}>
                                    <div className="flex items-center gap-3 mb-3">
                                        <UserAvatar user={post.users} />
                                        <div className="flex-1">
                                            <p className="text-sm font-bold text-gray-800">{post.users?.name}</p>
                                            <p className="text-[10px] text-gray-400">{new Date(post.created_at).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <p className="text-sm text-gray-700 mb-3 whitespace-pre-wrap line-clamp-3">
                                        {post.content}
                                        {extractUrls(post.content).map((url, i) => (
                                            <LinkPreview key={i} url={url} size="small" />
                                        ))}
                                    </p>
                                    {/* Image Display */}
                                    {(post.images?.length > 0 || post.image_url) && (
                                        <div className={`mb-3 rounded-2xl overflow-hidden border border-gray-50 shadow-sm ${(post.images?.length > 1) ? 'grid grid-cols-2 gap-0.5 aspect-square' : 'bg-gray-50'
                                            }`}>
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
                                    <div className="flex justify-end gap-2 text-gray-400 text-xs font-bold">
                                        <button className="flex items-center gap-1 hover:text-green-600 transition">
                                            <MessageSquare size={14} /> 댓글 달기
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {guestPosts.length === 0 && <div className="text-center py-20 text-gray-400">첫 방명록의 주인공이 되어보세요!</div>}
                        </div>

                        <button
                            onClick={() => setShowGuestWrite(true)}
                            className="fixed bottom-24 right-6 w-14 h-14 bg-green-600 text-white rounded-full shadow-lg shadow-green-300 flex items-center justify-center hover:scale-105 active:scale-95 transition z-40"
                        >
                            <Plus size={28} strokeWidth={2.5} />
                        </button>
                    </div>
                )}

            {/* Bottom Navigation */}
            <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full md:max-w-lg bg-white/95 backdrop-blur-xl border-t border-gray-100 flex justify-around items-center px-4 py-3 z-[120] safe-area-bottom shadow-[0_-10px_30px_rgba(0,0,0,0.08)] rounded-t-[2.5rem]">
                {[
                    { id: TAB_NAMES.HOME, icon: Home, label: '홈' },
                    { id: TAB_NAMES.CHALLENGES, icon: Award, label: '챌린지' },
                    { id: TAB_NAMES.PROGRAMS, icon: BookOpen, label: '프로그램', activeColor: 'text-blue-600' },
                    { id: TAB_NAMES.GALLERY, icon: ImageIcon, label: '갤러리' },
                    { id: TAB_NAMES.GUESTBOOK, icon: MessageCircle, label: '방명록' }
                ].map((tab) => (
                    <motion.button
                        key={tab.id}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleTabChange(tab.id)}
                        className={`flex flex-col items-center gap-1.5 p-2 rounded-2xl transition-all duration-300 flex-1 relative btn-tactile ${activeTab === tab.id ? (tab.activeColor || 'text-gray-900') : 'text-gray-300'}`}
                    >
                        <tab.icon size={24} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
                        <span className={`text-[10px] font-black tracking-tight ${activeTab === tab.id ? (tab.activeColor || 'text-gray-900') : 'text-gray-400'}`}>
                            {tab.label}
                        </span>
                        {activeTab === tab.id && (
                            <motion.div
                                layoutId="activeTabPill"
                                className={`absolute -top-1 w-1.5 h-1.5 rounded-full ${tab.activeColor ? 'bg-blue-600' : 'bg-gray-900'}`}
                            />
                        )}
                    </motion.button>
                ))}
            </div>
        </div >
    );
};





export default StudentDashboard;
