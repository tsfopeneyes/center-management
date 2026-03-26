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
import { getBadgeProgress } from '../components/student/BadgeComponents';

export const useStudentDashboard = () => {
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
            const groups = ['전체', currentUser.user_group, `USER_${currentUser.id}`];
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
    return {
        // Core State
        loading,
        user, setUser,
        activeTab,
        
        // Modals Traps
        showProfileSettings, setShowProfileSettings,
        showGuestWrite, setShowGuestWrite,
        selectedGuestPost, setSelectedGuestPost,
        showProgramHistory, setShowProgramHistory,
        showEnlargedQr, setShowEnlargedQr,
        showNotificationsModal, setShowNotificationsModal,
        selectedBadge, setSelectedBadge,
        selectedNotice, setSelectedNotice,
        noticeContext, setNoticeContext,
        
        // Modal dependencies & handlers (passed through)
        comments, setComments,
        newComment, setNewComment,
        handlePostComment, handleDeleteComment,
        handleShare,
        handleTabChange,
        openNoticeDetail,
        markNotificationsAsRead,
        
        // Mapped Data For Tabs & Dashboard
        notices, responses, handleResponse,
        filteredNotices, filteredPrograms,
        homeNotices, homePrograms,
        studentRegion, locationGroups, locations, allUsers, activeUserCountByGroup,
        totalHours, visitCount, programCount,
        attendedProgramsList,
        challengeCategories, dynamicChallenges, specialStats,
        adminSchedules, calendarCategories, dashboardConfig,
        notifications, unreadNotificationCount,
        updateProfile, profileLoadingState,
        
        // Guestbook Hooks
        guestPosts, uploadingGuest, handleCreatePost,
        fetchGuestCommentsData, handleGuestCommentSubmit, handleDeleteGuestPost, handleDeleteGuestComment
    };
};
