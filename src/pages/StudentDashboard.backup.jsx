import React, { useEffect, useState } from 'react';
import { CATEGORIES, TAB_NAMES, RESPONSE_STATUS, BADGE_DEFINITIONS } from '../constants/appConstants';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../supabaseClient';
import { AlertCircle, MapPin, Clock, Info, LogOut, CheckCircle, XCircle, HelpCircle, MessageSquare, Send, X, ArrowLeft, Image as ImageIcon, Grid, Settings, User, Plus, Heart, ZoomIn, RotateCw, Home, FileText, MessageCircle, BookOpen, MoreHorizontal, Bookmark, Share2, ShieldCheck, Calendar, Edit2, Trash2, Save, Trash, ChevronRight, Pin, Award, Share, Bell, QrCode } from 'lucide-react';
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
import StudentHomeTab from '../components/student/StudentHomeTab';
import StudentChallengesTab from '../components/student/StudentChallengesTab';
import StudentProgramsTab from '../components/student/StudentProgramsTab';
import StudentNoticesTab from '../components/student/StudentNoticesTab';
import StudentGalleryTab from '../components/student/StudentGalleryTab';
import StudentGuestbookTab from '../components/student/StudentGuestbookTab';
import StudentCalendarTab from '../components/student/StudentCalendarTab';
import CommunityTab from '../components/community/CommunityTab';
import { stripHtml, extractUrls } from '../utils/textUtils';
import { formatToLocalISO } from '../utils/dateUtils';
import { subscribeToPush } from '../utils/pushUtils';
import getCroppedImg from '../utils/imageUtils';

import { useMessaging } from '../hooks/useMessaging';
import { useNotices } from '../hooks/useNotices';
import { useGuestbook } from '../hooks/useGuestbook';
import { useProfile } from '../hooks/useProfile';
import { challengesApi } from '../api/challengesApi';
import { userApi } from '../api/userApi';

import { parseISO, isWithinInterval, startOfDay, eachDayOfInterval, isSameDay } from 'date-fns';

import { getBadgeProgress, BadgeModal, BadgeItem } from '../components/student/BadgeComponents';

const StudentDashboard = () => {
    console.log("StudentDashboard Mounted");
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState(TAB_NAMES.HOME);
    const [loading, setLoading] = useState(true);
    const [studentRegion, setStudentRegion] = useState(null);

    // Real-time Status State
    const [locationGroups, setLocationGroups] = useState([]);
    const [locations, setLocations] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [activeUserCountByGroup, setActiveUserCountByGroup] = useState({});

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
    const [adminSchedules, setAdminSchedules] = useState([]);
    const [calendarCategories, setCalendarCategories] = useState([]);
    const [dashboardConfig, setDashboardConfig] = useState([
        { id: 'stats', label: '활동 통계', isVisible: true, count: 3 },
        { id: 'programs', label: '프로그램 신청', isVisible: true, count: 3 },
        { id: 'space_status', isVisible: true, count: 0 }, // Add space_status below programs
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

    const [notifications, setNotifications] = useState([]);
    const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
    const [showNotificationsModal, setShowNotificationsModal] = useState(false);

    const fetchNotifications = async (currentUser) => {
        if (!currentUser) return;
        try {
            const groups = ['전체', currentUser.user_group];
            if (currentUser.role === 'admin' || currentUser.user_group === 'STAFF') groups.push('STAFF');

            const { data: notifs, error: notifErr } = await supabase
                .from('app_notifications')
                .select('*')
                .in('target_group', groups)
                .order('created_at', { ascending: false });

            if (notifErr) throw notifErr;

            const { data: reads, error: readErr } = await supabase
                .from('user_notification_reads')
                .select('notification_id')
                .eq('user_id', currentUser.id);

            if (readErr) throw readErr;

            const readNotifIds = new Set(reads.map(r => r.notification_id));
            const unreadCount = (notifs || []).filter(n => !readNotifIds.has(n.id)).length;

            setNotifications(notifs || []);
            setUnreadNotificationCount(unreadCount);
        } catch (err) {
            console.error('Error fetching notifications:', err);
        }
    };

    const markNotificationsAsRead = async () => {
        if (!user || unreadNotificationCount === 0) return;
        try {
            const { data: reads } = await supabase
                .from('user_notification_reads')
                .select('notification_id')
                .eq('user_id', user.id);
            const readNotifIds = new Set((reads || []).map(r => r.notification_id));

            const unreadNotifs = notifications.filter(n => !readNotifIds.has(n.id));
            if (unreadNotifs.length === 0) return;

            const inserts = unreadNotifs.map(n => ({
                user_id: user.id,
                notification_id: n.id
            }));

            await supabase.from('user_notification_reads').insert(inserts);
            setUnreadNotificationCount(0);
        } catch (err) {
            console.error('Error marking notifications read:', err);
        }
    };

    const handleShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'SCI CENTER 학생앱',
                    text: '학생앱에 접속해보세요!',
                    url: 'https://centerpass.netlify.app/',
                });
            } catch (err) {
                console.error('Share failed:', err);
            }
        } else {
            alert('공유하기를 지원하지 않는 기기입니다. URL을 복사해주세요.');
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

        if (!user || user.id !== parsedUser.id) {
            setUser(parsedUser);
        }

        // Refresh User Data (to ensure is_leader is up-to-date)
        userApi.fetchUser(parsedUser.id).then(latestUser => {
            if (latestUser) {
                const mergedUser = { ...parsedUser, ...latestUser };
                setUser(mergedUser);
                localStorage.setItem('user', JSON.stringify(mergedUser));
            }
        });

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
        fetchSchedules();
        fetchRealtimeStatusData();
        fetchNotifications(parsedUser);

        // Fetch student's region based on their school
        if (parsedUser.school) {
            supabase
                .from('schools')
                .select('region')
                .eq('name', parsedUser.school)
                .maybeSingle()
                .then(({ data, error }) => {
                    if (!error && data) {
                        setStudentRegion(data.region);
                    }
                });
        }

        setLoading(false);

        // Realtime Subscription for Logs (Status Update)
        let debounceTimer;
        const debouncedFetchStatus = () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                fetchRealtimeStatusData();
            }, 1000);
        };

        const subscription = supabase
            .channel('public:logs_student_dashboard')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'logs' }, debouncedFetchStatus)
            .subscribe();

        return () => {
            clearTimeout(debounceTimer);
            supabase.removeChannel(subscription);
        };
    }, [navigate, fetchStats]); // Removed user/setUser from deps to avoid identity loops

    const fetchRealtimeStatusData = async () => {
        try {
            const [usersRes, locRes, groupRes, logsRes] = await Promise.all([
                supabase.from('users').select('id, name, user_group, role'),
                supabase.from('locations').select('id, group_id'),
                supabase.from('location_groups').select('id, name'),
                supabase.from('logs').select('user_id, location_id, type').order('created_at', { ascending: false }).limit(3000)
            ]);

            const fetchedUsers = usersRes.data || [];
            const fetchedLocations = locRes.data || [];
            const fetchedGroups = groupRes.data || [];
            const fetchedLogs = logsRes.data ? [...logsRes.data].reverse() : [];

            setAllUsers(fetchedUsers);
            setLocations(fetchedLocations);
            setLocationGroups(fetchedGroups);

            const adminIdsSet = new Set(fetchedUsers.filter(u =>
                u.name === 'admin' || u.user_group === '관리자' || u.role === 'admin'
            ).map(u => u.id));

            const userCurrentLocation = {};
            fetchedLogs.forEach(log => {
                if (log.type === 'CHECKIN' || log.type === 'MOVE') userCurrentLocation[log.user_id] = log.location_id;
                else if (log.type === 'CHECKOUT') userCurrentLocation[log.user_id] = null;
            });

            const groupCounts = {};
            fetchedGroups.forEach(g => { groupCounts[g.id] = 0; });
            groupCounts['unassigned'] = 0; // fallback

            Object.entries(userCurrentLocation).forEach(([uid, locId]) => {
                if (locId && !adminIdsSet.has(uid)) {
                    const loc = fetchedLocations.find(l => l.id === locId);
                    if (loc && loc.group_id) {
                        if (groupCounts[loc.group_id] !== undefined) {
                            groupCounts[loc.group_id]++;
                        }
                    } else if (loc) {
                        groupCounts['unassigned']++;
                    }
                }
            });

            setActiveUserCountByGroup(groupCounts);
        } catch (err) {
            console.error('Error fetching realtime status:', err);
        }
    };

    const fetchSchedules = async () => {
        try {
            const [catRes, schRes] = await Promise.all([
                supabase.from('calendar_categories').select('*'),
                supabase.from('admin_schedules').select('*')
            ]);
            if (catRes.data) setCalendarCategories(catRes.data);
            if (schRes.data) setAdminSchedules(schRes.data);
        } catch (err) {
            console.error('Error fetching schedules:', err);
        }
    };

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



    const filteredNotices = notices.filter(n =>
        n.category === CATEGORIES.NOTICE
    );

    const galleryNotices = notices.filter(n =>
        n.category === CATEGORIES.GALLERY
    );

    const filteredPrograms = notices.filter(n => {
        if (n.category !== CATEGORIES.PROGRAM) return false;
        if (n.program_date && new Date(n.program_date) < startOfDay(new Date())) return false;

        // Region matching logic
        const targets = n.target_regions || [];
        if (targets.length === 0 || targets.length === 2) return true; // Empty array or both Gangdong and Gangseo selected -> Visible to all

        // If targets is length 1 and we don't know the student's region yet, maybe hide or show? Hide to be safe, or just show. 
        // For admin/staff, studentRegion might be null or they can see all. let's let admins see all.
        if (user?.role === 'admin' || user?.user_group === '관리자') return true;

        if (!studentRegion) return false;
        return targets.includes(studentRegion);
    });

    const homeNotices = filteredNotices.slice(0, 3);
    const homePrograms = filteredPrograms.slice(0, 3);
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
                                        <div className="font-bold text-gray-800 text-sm flex items-center gap-1">
                                            {selectedGuestPost.users?.name}
                                            {selectedGuestPost.users?.is_leader && <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#FACC15" stroke="#FACC15" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-star"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>}
                                        </div>
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
                                                    <span className="font-bold text-sm text-gray-800 flex items-center gap-1">
                                                        {c.users?.name}
                                                        {c.users?.is_leader && <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="#FACC15" stroke="#FACC15" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-star"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>}
                                                    </span>
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
                {/* Notifications Modal */}
                {showNotificationsModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[200] flex justify-center p-4 bg-black/60 backdrop-blur-sm sm:items-center items-end pb-24"
                        onClick={() => setShowNotificationsModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 100 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 100 }}
                            className="bg-white w-full max-w-sm rounded-[2rem] overflow-hidden shadow-2xl flex flex-col max-h-[70vh]"
                            onClick={e => e.stopPropagation()}
                            onAnimationComplete={() => markNotificationsAsRead()}
                        >
                            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                <div className="flex items-center gap-2">
                                    <Bell size={20} className="text-gray-800" />
                                    <h3 className="text-lg font-black text-gray-800">새로운 소식</h3>
                                </div>
                                <button onClick={() => setShowNotificationsModal(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                                    <X size={20} className="text-gray-500" />
                                </button>
                            </div>
                            <div className="overflow-y-auto p-4 flex-1 bg-gray-50/30">
                                {notifications.length === 0 ? (
                                    <div className="text-center py-10">
                                        <Bell size={32} className="mx-auto text-gray-300 mb-3" />
                                        <p className="text-gray-400 font-bold text-sm">새로운 알림이 없습니다.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {notifications.map((notif, idx) => (
                                            <div key={idx} className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="text-[10px] uppercase font-black tracking-widest text-blue-500 bg-blue-50 px-2 py-0.5 rounded-md">
                                                        {notif.target_group === '전체' ? '공지' : notif.target_group}
                                                    </span>
                                                    <span className="text-[10px] text-gray-400 font-bold">
                                                        {new Date(notif.created_at).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-700 font-bold leading-relaxed whitespace-pre-wrap">
                                                    {notif.content}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
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
                <StudentHomeTab
                    user={user}
                    unreadNotificationCount={unreadNotificationCount}
                    setShowProfileSettings={setShowProfileSettings}
                    setShowNotificationsModal={setShowNotificationsModal}
                    handleShare={handleShare}
                    setShowEnlargedQr={setShowEnlargedQr}
                    navigate={navigate}
                    adminSchedules={adminSchedules}
                    calendarCategories={calendarCategories}
                    dashboardConfig={dashboardConfig}
                    totalHours={totalHours}
                    visitCount={visitCount}
                    programCount={programCount}
                    setShowProgramHistory={setShowProgramHistory}
                    setActiveTab={setActiveTab}
                    homePrograms={homePrograms}
                    responses={responses}
                    openNoticeDetail={openNoticeDetail}
                    homeNotices={homeNotices}
                    homeGallery={homeGallery}
                    galleryNotices={galleryNotices}
                    locationGroups={locationGroups}
                    activeUserCountByGroup={activeUserCountByGroup}
                />
            )}

            {activeTab === TAB_NAMES.CHALLENGES && (
                <StudentChallengesTab
                    dynamicChallenges={dynamicChallenges}
                    challengeCategories={challengeCategories}
                    visitCount={visitCount}
                    programCount={programCount}
                    specialStats={specialStats}
                    setSelectedBadge={setSelectedBadge}
                />
            )}

            {activeTab === TAB_NAMES.PROGRAMS && (
                <StudentProgramsTab
                    filteredPrograms={filteredPrograms}
                    responses={responses}
                    openNoticeDetail={openNoticeDetail}
                />
            )}

            {activeTab === TAB_NAMES.NOTICES && (
                <StudentNoticesTab
                    filteredNotices={filteredNotices}
                    openNoticeDetail={openNoticeDetail}
                />
            )}

            {activeTab === TAB_NAMES.GALLERY && (
                <StudentGalleryTab
                    galleryNotices={galleryNotices}
                    openNoticeDetail={openNoticeDetail}
                />
            )}

            {activeTab === TAB_NAMES.MESSAGES && (
                <StudentChat currentUser={user} onRefreshUnread={() => { }} />
            )}

            {activeTab === TAB_NAMES.GUESTBOOK && (
                <StudentGuestbookTab
                    guestPosts={guestPosts}
                    openGuestPostDetail={openGuestPostDetail}
                    setShowGuestWrite={setShowGuestWrite}
                />
            )}

            {activeTab === TAB_NAMES.CALENDAR && (
                <StudentCalendarTab
                    adminSchedules={adminSchedules}
                    notices={notices}
                    calendarCategories={calendarCategories}
                    openNoticeDetail={openNoticeDetail}
                />
            )}

            {activeTab === TAB_NAMES.COMMUNITY && (
                <CommunityTab user={user} />
            )}

            {/* Bottom Navigation */}
            <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full md:max-w-lg bg-white/95 backdrop-blur-xl border-t border-gray-100 flex justify-around items-center px-4 py-3 z-[120] safe-area-bottom shadow-[0_-10px_30px_rgba(0,0,0,0.08)] rounded-t-[2.5rem]">
                {[
                    { id: TAB_NAMES.HOME, icon: Home, label: '홈' },
                    { id: TAB_NAMES.CALENDAR, icon: Calendar, label: '캘린더' },
                    { id: TAB_NAMES.PROGRAMS, icon: BookOpen, label: '프로그램', activeColor: 'text-blue-600' },
                    { id: TAB_NAMES.CHALLENGES, icon: Award, label: '챌린지' },
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
