import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

// Utilities
import { performFullSyncToGoogleSheets } from '../utils/integrationUtils';
import { processAnalyticsData, processUserAnalytics, processProgramAnalytics } from '../utils/analyticsUtils';
import { aggregateVisitSessions } from '../utils/visitUtils';
import { feedbackApi } from '../api/feedbackApi';
import { requestSupabaseRest } from '../utils/supabaseRest';
import { calculateCurrentLocations, mergeRealtimeVisitLog, sortVisitLogsChronologically } from '../utils/liveOccupancyUtils';
import { getTodayVisitState, recordVisitEvent } from '../utils/visitLifecycle';
import { hasExpiredWebAccessTimestamp, removeWebAccessTimestamp } from '../utils/webAccessUtils';
import { isAdminOrStaff } from '../utils/userUtils';
import { userApi } from '../api/userApi';

// Components
import AdminSidebar from '../components/admin/AdminSidebar';
import AdminStatus from '../components/admin/dashboard/AdminStatus';
import AdminBoard from '../components/admin/board/AdminBoard';
import AdminUsers from '../components/admin/users/AdminUsers';
import AdminLogs from '../components/admin/dashboard/AdminLogs';
import AdminSettings from '../components/admin/settings/AdminSettings';
import AdminBadges from '../components/admin/settings/AdminBadges';
import AdminStatistics from '../components/admin/statistics/AdminStatistics';
import AdminMessages from '../components/admin/messages/AdminMessages';
import AdminReport from '../components/admin/statistics/AdminReport';
import AdminCalendar from '../components/admin/calendar/AdminCalendar';
import AdminSchool from '../components/admin/school/AdminSchool';
import AdminStore from '../components/admin/store/AdminStore';
import AdminRentals from '../components/admin/rentals/AdminRentals';
import AdminContents from '../components/admin/contents/AdminContents';
import AdminPushNotifications from '../components/admin/notifications/AdminPushNotifications';
import AdminScreen from '../components/admin/screen/AdminScreen';
import { removeFirebaseToken } from '../firebase';
import AdminDuty from '../components/admin/duty/AdminDuty';
import StaffPresenceToggleCard from '../components/admin/dashboard/components/StaffPresenceToggleCard';
import AdminSurveys from '../components/admin/surveys/AdminSurveys';
import AdminCommunity from '../components/admin/community/AdminCommunity';
import { Menu, X as CloseIcon } from 'lucide-react';
import { subscribeToPush } from '../utils/pushUtils';
import { useFCM } from '../hooks/useFCM';
import { useAuth } from '../auth/AuthProvider';

const mergeRealtimeRow = (rows, payload) => {
    const id = payload?.new?.id || payload?.old?.id;
    if (!id) return rows;
    const remaining = rows.filter(row => row.id !== id);
    return payload.eventType === 'DELETE' || !payload.new ? remaining : [payload.new, ...remaining];
};

const AdminDashboard = () => {
    const navigate = useNavigate();
    const auth = useAuth();

    // Auth & Data State
    const [currentAdmin, setCurrentAdmin] = useState(null);
    useFCM(currentAdmin);
    const [activeMenu, setActiveMenu] = useState(() => {
        const noticeId = new URLSearchParams(window.location.search).get('noticeId');
        return noticeId ? 'PROGRAMS' : 'STATUS';
    }); // STATUS, BOARD, GALLERY, USERS, STATISTICS, LOGS, SETTINGS
    const [programNoticeToOpen, setProgramNoticeToOpen] = useState(() => new URLSearchParams(window.location.search).get('noticeId'));
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isSidebarPinned, setIsSidebarPinned] = useState(true);
    const [loading, setLoading] = useState(true);
    const [adminAuthReady, setAdminAuthReady] = useState(false);
    const [adminAuthError, setAdminAuthError] = useState('');
    const [isStatsLoading, setIsStatsLoading] = useState(false);
    const [loadError, setLoadError] = useState('');

    // Data
    const [users, setUsers] = useState([]);
    const [locations, setLocations] = useState([]);
    const [locationGroups, setLocationGroups] = useState([]);
    const [notices, setNotices] = useState([]);
    const [allLogs, setAllLogs] = useState([]);
    const [schoolLogs, setSchoolLogs] = useState([]);
    const [responses, setResponses] = useState([]);
    const [feedbacks, setFeedbacks] = useState([]);
    const [zoneStats, setZoneStats] = useState({});
    const [dailyVisitStats, setDailyVisitStats] = useState({});
    const [currentLocations, setCurrentLocations] = useState({}); // { userId: locationId }
    const [visitNotes, setVisitNotes] = useState([]);
    const [checkinSurveys, setCheckinSurveys] = useState([]);

    // Alert & Realtime Notification State
    const [isAlertEnabled, setIsAlertEnabled] = useState(localStorage.getItem('admin_alert_enabled') !== 'false');
    const [toasts, setToasts] = useState([]);
    const usersRef = React.useRef([]);
    const locationsRef = React.useRef([]);
    const noticesRef = React.useRef([]);
    const liveStatusLogsRef = React.useRef([]);
    const seenCheckinsRef = React.useRef(new Set());
    const currentAdminRef = React.useRef(null);

    useEffect(() => {
        usersRef.current = users;
    }, [users]);

    useEffect(() => {
        locationsRef.current = locations;
    }, [locations]);

    useEffect(() => {
        noticesRef.current = notices;
    }, [notices]);

    useEffect(() => {
        currentAdminRef.current = currentAdmin;
    }, [currentAdmin]);

    useEffect(() => {
        if (auth.status === 'authenticated' || (auth.status === 'refreshing' && auth.profile?.id)) {
            if (!isAdminOrStaff(auth.profile)) {
                // Losing a staff role changes the available screen, not the
                // identity session. Never sign the member out here.
                navigate('/student', { replace: true });
                return;
            }
            setCurrentAdmin(auth.profile);
            try { localStorage.setItem('admin_user', JSON.stringify(auth.profile)); } catch {}
            setAdminAuthError('');
            setAdminAuthReady(true);
            return;
        }
        if (auth.status === 'offline') {
            if (currentAdmin?.id && isAdminOrStaff(currentAdmin)) {
                // This tab already completed server verification. A temporary
                // outage must not replace the working dashboard with a gate.
                setAdminAuthError('');
                setAdminAuthReady(true);
                return;
            }
            setAdminAuthReady(false);
            setAdminAuthError('로그인 세션은 유지 중입니다. 네트워크를 확인한 뒤 다시 시도해주세요.');
            return;
        }
        if (auth.status === 'blocked') {
            setAdminAuthReady(false);
            setAdminAuthError('계정 또는 스탭 권한을 확인할 수 없습니다. 관리자에게 문의해주세요.');
            return;
        }
        if (auth.status === 'anonymous') {
            navigate('/', { replace: true });
            return;
        }
        setAdminAuthReady(false);
    }, [auth.status, auth.profile, currentAdmin, navigate]);

    const playChime = useCallback(() => {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(659.25, audioCtx.currentTime); // E5
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
            oscillator.start();
            
            oscillator.frequency.setValueAtTime(880.00, audioCtx.currentTime + 0.12); // A5
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime + 0.12);
            
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
            oscillator.stop(audioCtx.currentTime + 0.6);
        } catch (e) {
            console.error("Audio play failed:", e);
        }
    }, []);

    const handleToggleAlert = useCallback((enabled) => {
        setIsAlertEnabled(enabled);
        localStorage.setItem('admin_alert_enabled', String(enabled));
        if (enabled && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, []);

    const fetchData = useCallback(async (isFullFetch = false) => {
        // Automatically perform full fetch if currently in statistics or report mode
        const needsFullFetch = isFullFetch || activeMenu === 'STATISTICS' || activeMenu === 'REPORTS';
        if (needsFullFetch) setIsStatsLoading(true);
        const failedReads = [];
        const readAdminData = async (label, path) => {
            try {
                // Samsung Internet can abort Supabase client's internal request
                // while restoring a PWA. Use the same resilient REST path as QR flows.
                return await requestSupabaseRest(path, {}, 2, 15000);
            } catch (error) {
                console.error(`Failed to load admin ${label}:`, error);
                failedReads.push(label);
                return [];
            }
        };
        try {
            const logLimit = activeMenu === 'STATISTICS' || isFullFetch ? 10000 : 2000;
            let [userData, locData, lgData, noticeData, responseData, vNotesData, surveyDataList, rawLogs, sLogs] = await Promise.all([
                readAdminData('회원', 'users?select=*&order=name.asc'),
                readAdminData('장소', 'locations?select=*&order=id.asc'),
                readAdminData('장소 그룹', 'location_groups?select=*&order=created_at.asc'),
                readAdminData('프로그램', 'notices?select=*&order=is_sticky.desc,created_at.desc'),
                readAdminData('신청 내역', 'notice_responses?select=*'),
                readAdminData('방문 메모', 'visit_notes?select=*'),
                readAdminData('체크인 설문', 'checkin_surveys?select=*&order=created_at.desc&limit=1000'),
                readAdminData('입출입 기록', `logs?select=*&order=created_at.desc&limit=${logLimit}`),
                readAdminData('학교 기록', 'school_logs?select=*,users(name),schools(name)&order=date.desc'),
            ]);

            // The web access page only needs a member's latest access time.
            // Remove timestamps after the disclosed three-month retention period
            // without touching visit, program, point, or other user records.
            const expiredWebAccessUsers = (userData || []).filter(user => hasExpiredWebAccessTimestamp(user.preferences));
            if (expiredWebAccessUsers.length > 0) {
                const cleanupResults = await Promise.allSettled(
                    expiredWebAccessUsers.map(async (user) => {
                        const preferences = removeWebAccessTimestamp(user.preferences);
                        const { error } = await supabase
                            .from('users')
                            .update({ preferences })
                            .eq('id', user.id);
                        if (error) throw error;
                        return user.id;
                    })
                );
                const cleanedUserIds = new Set(
                    cleanupResults
                        .filter(result => result.status === 'fulfilled')
                        .map(result => result.value)
                );
                if (cleanupResults.some(result => result.status === 'rejected')) {
                    failedReads.push('만료된 웹 접속 기록 정리');
                }
                userData = (userData || []).map(user => (
                    cleanedUserIds.has(user.id)
                        ? { ...user, preferences: removeWebAccessTimestamp(user.preferences) }
                        : user
                ));
            }
            setLoadError(failedReads.length > 0
                ? `${failedReads.join(', ')} 데이터를 불러오지 못했습니다. 네트워크를 확인한 뒤 새로고침해 주세요.`
                : '');
            userData = await userApi.attachAccountRoles(userData || []);
            setUsers(userData);

            // Automatically sync currentAdmin with latest DB data
            const storedAdminStr = localStorage.getItem('admin_user');
            if (storedAdminStr && userData) {
                try {
                    const parsedAdmin = JSON.parse(storedAdminStr);
                    const latestAdminUser = userData.find(u => u.id === parsedAdmin.id);
                    if (latestAdminUser) {
                        const mergedAdmin = { ...parsedAdmin, ...latestAdminUser };
                        setCurrentAdmin(mergedAdmin);
                        localStorage.setItem('admin_user', JSON.stringify(mergedAdmin));
                    }
                } catch (e) {
                    console.error('Failed to sync currentAdmin:', e);
                }
            }

            setLocations(locData || []);

            setLocationGroups(lgData || []);

            setNotices(noticeData || []);

            setResponses(responseData || []);

            let feedbackData = [];
            try {
                feedbackData = await feedbackApi.fetchAllFeedbacks();
            } catch (fbErr) {
                console.error("Failed to fetch feedbacks", fbErr);
            }
            setFeedbacks(feedbackData || []);

            setVisitNotes(vNotesData || []);

            setCheckinSurveys(surveyDataList);

            // Stats Calculation - Limit initial log fetch dynamically for speed
            const logs = sortVisitLogsChronologically(rawLogs || []);
            liveStatusLogsRef.current = logs;

            const userCurrentLocation = calculateCurrentLocations(logs);

            const adminIdsSet = new Set(userData?.filter(u =>
                isAdminOrStaff(u)
            ).map(u => u.id) || []);

            // Occupancy Stats Calculation (Real-time) - Only count non-staff
            const zStats = {};
            locData?.forEach(l => zStats[l.id] = 0);
            Object.entries(userCurrentLocation).forEach(([key, locInfo]) => {
                const locId = locInfo?.locId;
                const userId = locInfo?.isGuest ? null : key;
                if (locId && zStats[locId] !== undefined && (!userId || !adminIdsSet.has(userId))) {
                    zStats[locId]++;
                }
            });

            // Visitor Stats Calculation (Today)
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const todayLogs = logs?.filter(l => new Date(l.created_at) >= todayStart) || [];

            const vStats = {};
            const locVisitors = {}; // { locId: Set of studentIds }

            locData?.forEach(l => {
                vStats[l.id] = 0;
                locVisitors[l.id] = new Set();
            });

            todayLogs.forEach(log => {
                if (log.location_id && vStats[log.location_id] !== undefined) {
                    const isNotAdmin = !log.user_id || !adminIdsSet.has(log.user_id);
                    if (isNotAdmin && (log.type === 'CHECKIN' || log.type === 'MOVE' || log.type === 'GUEST_ENTRY')) {
                        const userObj = (userData || []).find(u => u.id === log.user_id);
                        const visitorKey = log.user_id 
                            ? log.user_id 
                            : (userObj?.name ? userObj.name : (log.metadata?.guest_name ? `guest_${log.metadata.guest_name}` : `guest_${log.id}`));
                        locVisitors[log.location_id].add(visitorKey);
                    }
                }
            });

            // Set unique visitor count per location
            Object.keys(locVisitors).forEach(locId => {
                vStats[locId] = locVisitors[locId].size;
            });

            setZoneStats(zStats);
            setDailyVisitStats(vStats);
            setCurrentLocations(userCurrentLocation);
            setAllLogs(logs || []);

            setSchoolLogs(sLogs || []);

            return { users: userData || [], locations: locData || [], locationGroups: lgData || [], notices: noticeData || [], responses: responseData || [], allLogs: logs || [], schoolLogs: sLogs || [], feedbacks: feedbackData || [] };

        } catch (error) {
            console.error(error);
            setLoadError('관리자 데이터를 불러오는 중 문제가 생겼습니다. 잠시 후 다시 시도해 주세요.');
        }
        finally {
            setLoading(false);
            setIsStatsLoading(false);
        }
    }, [activeMenu]);

    const applyLiveStatusLogs = useCallback((rawLiveLogs = []) => {
        const liveLogs = sortVisitLogsChronologically(rawLiveLogs);
        liveStatusLogsRef.current = liveLogs;
        const userCurrentLocation = calculateCurrentLocations(liveLogs);
        const adminIds = new Set(usersRef.current.filter(isAdminOrStaff).map(user => user.id));
        const nextZoneStats = {};
        const nextVisitors = {};

        locationsRef.current.forEach(location => {
            nextZoneStats[location.id] = 0;
            nextVisitors[location.id] = new Set();
        });

        Object.entries(userCurrentLocation).forEach(([userId, details]) => {
            if (!details?.locId || nextZoneStats[details.locId] === undefined) return;
            if (details.isGuest || !adminIds.has(userId)) nextZoneStats[details.locId] += 1;
        });

        liveLogs.forEach(log => {
            if (!['CHECKIN', 'MOVE', 'GUEST_ENTRY'].includes(log.type) || !nextVisitors[log.location_id]) return;
            if (log.user_id && adminIds.has(log.user_id)) return;
            const user = usersRef.current.find(item => item.id === log.user_id);
            const visitorKey = log.user_id
                || (user?.name ? user.name : (log.metadata?.guest_name ? `guest_${log.metadata.guest_name}` : `guest_${log.id}`));
            nextVisitors[log.location_id].add(visitorKey);
        });

        setCurrentLocations(userCurrentLocation);
        setZoneStats(nextZoneStats);
        setDailyVisitStats(Object.fromEntries(Object.entries(nextVisitors).map(([id, visitors]) => [id, visitors.size])));
        setAllLogs(previous => {
            const previousById = new Map(previous.map(log => [log.id, log]));
            const todayKst = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
            const older = previous.filter(log => {
                return new Date(log.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }) !== todayKst;
            });
            const completeLiveLogs = liveLogs.map(log => ({ ...previousById.get(log.id), ...log }));
            return sortVisitLogsChronologically([...older, ...completeLiveLogs]).slice(-2000);
        });
    }, []);

    const refreshLiveStatus = useCallback(async () => {
        if (activeMenu !== 'STATUS' || document.visibilityState === 'hidden') return;
        const todayKst = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
        let { data, error } = await supabase
            .from('logs')
            .select('id,user_id,location_id,type,created_at,metadata,duration')
            .gte('created_at', `${todayKst}T00:00:00+09:00`)
            .order('created_at', { ascending: true });
        // Production installations created before the compact status view do
        // not have the optional metadata/duration columns. Keep live status
        // available with the stable visit-log columns instead of failing the
        // whole status refresh with Postgres 42703.
        if (error?.code === '42703') {
            ({ data, error } = await supabase
                .from('logs')
                .select('id,user_id,location_id,type,created_at')
                .gte('created_at', `${todayKst}T00:00:00+09:00`)
                .order('created_at', { ascending: true }));
        }
        if (error) {
            console.error('Failed to load compact live status:', error);
            return;
        }
        applyLiveStatusLogs(data || []);
    }, [activeMenu, applyLiveStatusLogs]);

    const notifyRealtimeCheckin = useCallback((log) => {
        if (log?.type !== 'CHECKIN' || !log.id || localStorage.getItem('admin_alert_enabled') === 'false') return;
        if (seenCheckinsRef.current.has(log.id)) return;
        seenCheckinsRef.current.add(log.id);
        if (seenCheckinsRef.current.size > 300) {
            seenCheckinsRef.current = new Set([...seenCheckinsRef.current].slice(-150));
        }

        const adminId = currentAdminRef.current?.id;
        const systemNotices = noticesRef.current.filter(notice => notice.category === 'SYSTEM');
        const configNotice = systemNotices.find(notice => notice.title === 'STAFF_PRESENCE_CONFIG');
        const statusNotice = systemNotices.find(notice => notice.title === 'STAFF_PRESENCE_STATUS');
        let staffConfig = { '하이픈': [], '이높플레이스': [] };
        let presenceStatus = {};
        try { if (configNotice?.content) staffConfig = JSON.parse(configNotice.content) || staffConfig; } catch {}
        try { if (statusNotice?.content) presenceStatus = JSON.parse(statusNotice.content) || {}; } catch {}
        if (!adminId || presenceStatus[adminId] !== true) return;

        const location = locationsRef.current.find(item => item.id === log.location_id);
        const user = usersRef.current.find(item => item.id === log.user_id);
        if (!location || !user) return;
        const isHaifn = location.name?.includes('하이픈');
        const isInop = location.name?.includes('이높플레이스');
        if ((isHaifn && !(staffConfig['하이픈'] || []).includes(adminId))
            || (isInop && !(staffConfig['이높플레이스'] || []).includes(adminId))) return;

        const branchName = isHaifn ? '하이픈' : (isInop ? '이높플레이스' : '센터');
        const message = `${user.name} 학생이 ${branchName}에 체크인했어요!`;
        playChime();
        if (Notification.permission === 'granted') {
            new Notification('체크인 알림', { body: message, icon: '/favicon.ico' });
        }
        const toastId = `${log.id}-${Date.now()}`;
        setToasts(previous => [...previous, { id: toastId, message, name: user.name, school: user.school }]);
        window.setTimeout(() => setToasts(previous => previous.filter(toast => toast.id !== toastId)), 5000);
    }, [playChime]);

    useEffect(() => {
        if (!adminAuthReady) return undefined;
        const storedAdmin = localStorage.getItem('admin_user');
        if (!storedAdmin) {
            alert('관리자 권한이 필요합니다.');
            navigate('/');
            return;
        }
        const admin = JSON.parse(storedAdmin);
        setCurrentAdmin(admin);
        subscribeToPush(admin.id); // Ask for notification permission

        // The program board owns its compact notice query. Starting the full
        // dashboard hydration here also pulled thousands of logs, every user,
        // surveys and feedbacks, then repeated it on each live update. That
        // can freeze Samsung Internet while the program grid is visible.
        if (activeMenu === 'PROGRAMS') {
            setLoading(false);
            return undefined;
        }
        fetchData();

        // Realtime changes are merged into local state. A single event must
        // never fan out into a full dashboard hydration for every open admin.
        let debounceTimer;
        const debouncedLiveRefresh = () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                refreshLiveStatus().catch(error => console.error('Failed to refresh live status:', error));
            }, 500);
        };

        let isRefreshingOccupancy = false;
        const refreshOccupancy = async () => {
            if (activeMenu !== 'STATUS' || document.visibilityState === 'hidden' || isRefreshingOccupancy) return;

            isRefreshingOccupancy = true;
            try {
                await refreshLiveStatus();
            } finally {
                isRefreshingOccupancy = false;
            }
        };

        const subscription = supabase
            .channel('public:updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'logs' }, payload => {
                const merged = mergeRealtimeVisitLog(liveStatusLogsRef.current, payload);
                if (merged) applyLiveStatusLogs(merged);
                else if (activeMenu === 'STATUS') debouncedLiveRefresh();
                if (payload.eventType === 'INSERT') notifyRealtimeCheckin(payload.new);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, payload => {
                setUsers(previous => mergeRealtimeRow(previous, payload));
                if (payload.new?.id === currentAdminRef.current?.id) setCurrentAdmin(current => ({ ...current, ...payload.new }));
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notices' }, payload => setNotices(previous => mergeRealtimeRow(previous, payload)))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notice_responses' }, payload => setResponses(previous => mergeRealtimeRow(previous, payload)))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'checkin_surveys' }, payload => setCheckinSurveys(previous => mergeRealtimeRow(previous, payload)))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'visit_notes' }, payload => setVisitNotes(previous => mergeRealtimeRow(previous, payload)))
            .subscribe(status => {
                // A browser can miss events while its tab or network is suspended.
                // Reconcile from the database as soon as the channel reconnects.
                if (status === 'SUBSCRIBED') refreshOccupancy();
            });

        // Realtime is normally immediate, but some mobile browsers suspend a
        // WebSocket after the admin screen has been open for a while. Refresh
        // the live status separately from the alert preference so checkout is
        // still reflected even when desktop check-in sounds are turned off.
        const occupancyRefreshInterval = setInterval(refreshOccupancy, 60000);
        const refreshWhenVisible = () => {
            if (document.visibilityState === 'visible') refreshOccupancy();
        };
        const refreshWhenFocused = () => refreshOccupancy();
        const refreshWhenOnline = () => refreshOccupancy();

        document.addEventListener('visibilitychange', refreshWhenVisible);
        window.addEventListener('focus', refreshWhenFocused);
        window.addEventListener('online', refreshWhenOnline);

        return () => {
            clearTimeout(debounceTimer);
            clearInterval(occupancyRefreshInterval);
            document.removeEventListener('visibilitychange', refreshWhenVisible);
            window.removeEventListener('focus', refreshWhenFocused);
            window.removeEventListener('online', refreshWhenOnline);
            supabase.removeChannel(subscription);
        };
    }, [activeMenu, adminAuthReady, applyLiveStatusLogs, fetchData, navigate, notifyRealtimeCheckin, refreshLiveStatus]);

    const handleForceCheckout = useCallback(async (userId) => {
        if (!confirm('해당 이용자를 강제 퇴실 처리하시겠습니까?')) return;
        try {
            const isGuestId = typeof userId === 'string' && userId.startsWith('guest_');
            if (isGuestId) throw new Error('게스트 이용자는 현황 화면에서 퇴실 처리해주세요.');
            const visit = await getTodayVisitState(userId);
            if (!['ACTIVE', 'AUTO_CHECKED_OUT'].includes(visit.status)) {
                throw new Error('이미 퇴실 처리된 이용자입니다.');
            }
            const result = await recordVisitEvent({
                userId,
                locationId: visit.locationId,
                type: 'CHECKOUT',
                adminId: currentAdminRef.current?.id || null,
            });
            if (!['CREATED', 'RECONCILED'].includes(result.outcome)) {
                throw new Error('퇴실 상태를 다시 확인해주세요.');
            }
            fetchData();
            alert('퇴실 처리되었습니다.');
        } catch (err) {
            console.error(err);
            alert(`퇴실 처리 실패: ${err.message || '알 수 없는 오류'}`);
        }
    }, [fetchData]);

    const handleBatchCheckout = useCallback(async (userIds) => {
        if (userIds.length === 0) return;
        if (!confirm(`현재 입실 중인 ${userIds.length}명 전원을 퇴실 처리하시겠습니까?`)) return;

        try {
            const results = await Promise.all(userIds.map(async (userId) => {
                const visit = await getTodayVisitState(userId);
                if (!['ACTIVE', 'AUTO_CHECKED_OUT'].includes(visit.status)) return null;
                return recordVisitEvent({
                    userId,
                    locationId: visit.locationId,
                    type: 'CHECKOUT',
                    adminId: currentAdminRef.current?.id || null,
                });
            }));
            if (results.some(result => result && !['CREATED', 'RECONCILED'].includes(result.outcome))) {
                throw new Error('일부 이용자의 퇴실 상태를 다시 확인해주세요.');
            }

            fetchData();
            alert('전원 퇴실 처리되었습니다.');
        } catch (err) {
            console.error(err);
            alert(`일괄 퇴실 실패: ${err.message}`);
        }
    }, [fetchData]);

    // Trigger full fetch when entering statistics
    useEffect(() => {
        if (activeMenu === 'STATISTICS') {
            fetchData(true);
        }
    }, [activeMenu]);

    // B안: 뒤로가기 시 이전 탭으로 화면 전환을 위해 History API 연동
    useEffect(() => {
        // 첫 진입 시 현재 상태를 히스토리에 기재
        window.history.replaceState({ menu: activeMenu }, '');

        const handlePopState = (event) => {
            if (event.state && event.state.menu) {
                setActiveMenu(event.state.menu);
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    // activeMenu가 변경될 때마다 새로운 히스토리 항목 추가 (동일한 탭 연속 중복 추가 방지)
    useEffect(() => {
        if (window.history.state?.menu !== activeMenu) {
            window.history.pushState({ menu: activeMenu }, '');
        }
    }, [activeMenu]);

    // Responsive Sidebar Fix: Handle window resize to sync states
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 768) {
                // When expanding to desktop, close mobile drawer
                setIsMenuOpen(false);
                // Auto-pin when returning to desktop to restore original behavior
                setIsSidebarPinned(true);
            } else {
                // When shrinking to mobile, always close the overlay and clear pin
                setIsMenuOpen(false);
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Weekday 10PM Auto Sync Scheduler
    const syncDataRef = React.useRef({ users, allLogs, responses, notices, locations, schoolLogs, feedbacks });
    useEffect(() => {
        syncDataRef.current = { users, allLogs, responses, notices, locations, schoolLogs, feedbacks };
    }, [users, allLogs, responses, notices, locations, schoolLogs, feedbacks]);

    useEffect(() => {
        const checkAutoSync = () => {
            const now = new Date();
            const day = now.getDay(); // 0: Sun, 1-5: Mon-Fri, 6: Sat
            const isWeekday = day >= 1 && day <= 5;
            const hour = now.getHours();

            if (isWeekday && hour === 22) {
                const today = format(now, 'yyyy-MM-dd');
                const lastSync = localStorage.getItem('last_auto_sync_date');
                const gsWebhookUrl = localStorage.getItem('gs_webhook_url');

                if (lastSync !== today && gsWebhookUrl && syncDataRef.current.users.length > 0) {
                    console.log('--- Triggering Weekday 10PM Auto Sync ---');
                    handleAutoSync(gsWebhookUrl, today);
                }
            }
        };

        const interval = setInterval(checkAutoSync, 60000); // Check every minute
        checkAutoSync(); // Initial check

        return () => clearInterval(interval);
    }, []);

    const handleAutoSync = async (webhookUrl, todayStr) => {
        try {
            // Need latest visit notes for the sync
            const { data: vNotes } = await supabase.from('visit_notes').select('*');
            const { users, allLogs, responses, notices, locations, schoolLogs, feedbacks } = syncDataRef.current;

            await performFullSyncToGoogleSheets({
                webhookUrl,
                users,
                logs: allLogs,
                responses,
                notices,
                locations,
                schoolLogs,
                feedbacks,
                visitNotes: vNotes,
                processUserAnalytics,
                processProgramAnalytics,
                processAnalyticsData,
                aggregateVisitSessions
            });

            localStorage.setItem('last_auto_sync_date', todayStr);
            console.log('Auto Sync Successful:', todayStr);
        } catch (err) {
            console.error('Auto Sync Failed:', err);
        }
    };

    const handleLogout = async () => {
        if (confirm("로그아웃 하시겠습니까?")) {
            await removeFirebaseToken(currentAdmin?.id);
            await supabase.auth.signOut();
            localStorage.removeItem('admin_user');
            localStorage.removeItem('user');
            navigate('/');
        }
    };

    if (adminAuthError) return <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6"><div className="w-full max-w-sm rounded-3xl bg-white p-8 text-center shadow-lg"><h1 className="text-xl font-black text-gray-900">로그인 확인이 필요해요</h1><p className="mt-3 text-sm font-semibold leading-relaxed text-gray-500">{adminAuthError}</p><button type="button" onClick={auth.refresh} className="mt-6 w-full rounded-2xl bg-blue-600 py-3.5 font-bold text-white">다시 확인</button></div></div>;
    if (loading || !adminAuthReady) return <div className="min-h-screen bg-gray-50" aria-hidden="true" />;

    return (
        <div className="flex bg-gray-50 min-h-screen font-sans">
            {/* Sidebar */}
            <AdminSidebar
                activeMenu={activeMenu}
                setActiveMenu={(menu) => {
                    setActiveMenu(menu);
                    setIsMenuOpen(false);
                }}
                onLogout={handleLogout}
                isOpen={isMenuOpen}
                setIsOpen={setIsMenuOpen}
                isPinned={isSidebarPinned}
                setIsPinned={setIsSidebarPinned}
                notices={notices}
            />

            {/* Main Content */}
            <div className={`flex-1 ${isSidebarPinned ? 'md:ml-64' : 'ml-0'} min-w-0 transition-all duration-300 ease-in-out`}>
                {/* Universal Header - Visible on all sizes */}
                <header className="bg-white border-b border-gray-100 p-4 sticky top-0 z-30 flex justify-between items-center shadow-sm">
                    <h1 className="text-lg font-extrabold text-blue-600 tracking-tight">SCI CENTER <span className="text-gray-400 text-[10px] ml-1 uppercase">Admin</span></h1>
                    <button
                        onClick={() => {
                            // On desktop, toggle pinning. On mobile, toggle overlay.
                            if (window.innerWidth >= 768) {
                                // If already unpinned but overlay is open, close overlay
                                if (!isSidebarPinned && isMenuOpen) {
                                    setIsMenuOpen(false);
                                } else {
                                    setIsSidebarPinned(!isSidebarPinned);
                                }
                            } else {
                                setIsMenuOpen(!isMenuOpen);
                            }
                        }}
                        className="p-2 text-gray-500 hover:bg-gray-50 rounded-lg transition-colors border border-gray-100 shadow-sm"
                    >
                        {(isMenuOpen || (window.innerWidth >= 768 && isSidebarPinned)) ? <CloseIcon size={20} /> : <Menu size={20} />}
                    </button>
                </header>

                <main className="p-4 md:p-10 max-w-[1600px] mx-auto">
                    {loadError && (
                        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800 flex items-center justify-between gap-3">
                            <span>{loadError}</span>
                            <button onClick={() => fetchData()} className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-amber-800 shadow-sm">다시 시도</button>
                        </div>
                    )}
                    {activeMenu === 'STATUS' && (
                        <AdminStatus
                            users={users}
                            locations={locations}
                            locationGroups={locationGroups}
                            zoneStats={zoneStats}
                            currentLocations={currentLocations}
                            handleBatchCheckout={handleBatchCheckout}
                            fetchData={fetchData}
                            allLogs={allLogs}
                            dailyVisitStats={dailyVisitStats}
                            setActiveMenu={setActiveMenu}
                            handleForceCheckout={handleForceCheckout}
                            isAlertEnabled={isAlertEnabled}
                            handleToggleAlert={handleToggleAlert}
                            checkinSurveys={checkinSurveys}
                            visitNotes={visitNotes}
                            surveyConfig={(() => {
                                const notice = notices.find(n => n.category === 'SYSTEM' && n.title === 'CHECKIN_SURVEY_CONFIG');
                                if (notice?.content) {
                                    try { return JSON.parse(notice.content); } catch (e) {}
                                }
                                return null;
                            })()}
                        />
                    )}
                    {activeMenu === 'WORK_STATUS' && (
                        <div className="animate-fade-in-up">
                            <StaffPresenceToggleCard users={users} />
                        </div>
                    )}
                    {activeMenu === 'CALENDAR' && (
                        <AdminCalendar notices={notices} fetchData={fetchData} setActiveMenu={setActiveMenu}
                            onOpenProgram={(noticeId) => {
                                setProgramNoticeToOpen(noticeId);
                                setActiveMenu('PROGRAMS');
                            }} />
                    )}
                    {activeMenu === 'PROGRAMS' && (
                        <AdminBoard mode="PROGRAM" notices={notices} fetchData={fetchData} users={users} currentLocations={currentLocations} setActiveMenu={setActiveMenu}
                            initialNoticeId={programNoticeToOpen} onInitialNoticeOpened={() => setProgramNoticeToOpen(null)} />
                    )}
                    {activeMenu === 'BOARD' && (
                        <AdminBoard mode="NOTICE" notices={notices} fetchData={fetchData} users={users} currentLocations={currentLocations} setActiveMenu={setActiveMenu} />
                    )}
                    {activeMenu === 'GALLERY' && (
                        <AdminBoard mode="GALLERY" notices={notices} fetchData={fetchData} users={users} currentLocations={currentLocations} setActiveMenu={setActiveMenu} />
                    )}
                    {activeMenu === 'STORE' && (
                        <AdminStore users={users} />
                    )}
                    {activeMenu === 'CONTENTS_MGMT' && (
                        <AdminContents />
                    )}
                    {activeMenu === 'RENTAL_MGMT' && (
                        <AdminRentals />
                    )}
                    {activeMenu === 'COMMUNITY' && <AdminCommunity />}
                    {activeMenu === 'NOTIFICATIONS' && (
                        <AdminPushNotifications currentAdmin={currentAdmin} />
                    )}
                    {activeMenu === 'SCREEN' && (
                        <AdminScreen currentAdmin={currentAdmin} />
                    )}
                    {activeMenu === 'DUTY' && (
                        <AdminDuty currentAdmin={currentAdmin} users={users} />
                    )}
                    {activeMenu === 'USERS' && (
                        <AdminUsers users={users} allLogs={allLogs} locations={locations} fetchData={fetchData} />
                    )}
                    {activeMenu === 'SCHOOLS' && (
                        <AdminSchool users={users} fetchData={fetchData} />
                    )}
                    {activeMenu === 'SURVEYS' && (
                        <AdminSurveys notices={notices} responses={checkinSurveys} visitNotes={visitNotes} users={users} locations={locations} logs={allLogs} fetchData={fetchData} />
                    )}
                    {activeMenu === 'RENTALS' && (
                        <AdminRentals notices={notices} />
                    )}
                    {activeMenu === 'CONTENTS' && (
                        <AdminContents />
                    )}
                    {activeMenu === 'MESSAGES' && (
                        <AdminMessages users={users} />
                    )}
                    {activeMenu === 'STATISTICS' && (
                        <AdminStatistics 
                            logs={allLogs} 
                            schoolLogs={schoolLogs} 
                            locations={locations} 
                            locationGroups={locationGroups} 
                            users={users} 
                            notices={notices} 
                            responses={responses} 
                            feedbacks={feedbacks}
                            visitNotes={visitNotes}
                            isLoading={isStatsLoading} 
                            fetchData={fetchData} 
                        />
                    )}
                    {activeMenu === 'LOGS' && (
                        <AdminLogs allLogs={allLogs} schoolLogs={schoolLogs} users={users} locations={locations} notices={notices} fetchData={fetchData} currentAdmin={currentAdmin} />
                    )}
                    {activeMenu === 'REPORTS' && (
                        <AdminReport allLogs={allLogs} users={users} locations={locations} notices={notices} responses={responses} />
                    )}
                    {activeMenu === 'BADGES' && (
                        <AdminBadges />
                    )}
                    {activeMenu === 'SETTINGS' && (
                        <AdminSettings currentAdmin={currentAdmin} locations={locations} locationGroups={locationGroups} notices={notices} fetchData={fetchData} users={users} allLogs={allLogs} responses={responses} schoolLogs={schoolLogs} setActiveMenu={setActiveMenu} />
                    )}
                </main>
            </div>

            {/* Realtime Toast Container */}
            <div className="fixed top-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className="bg-white/90 backdrop-blur-md border border-blue-100 rounded-2xl p-4 shadow-xl flex items-start gap-3 pointer-events-auto transition-all hover:scale-[1.02] animate-fade-in"
                    >
                        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0 font-bold">
                            🔔
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-400 font-black truncate">{toast.school || '센터 이용자'}</p>
                            <p className="text-sm font-bold text-[#191f28] mt-0.5 leading-tight">{toast.message}</p>
                        </div>
                        <button
                            onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                            className="text-gray-400 hover:text-gray-600 transition shrink-0 p-1 hover:bg-gray-100 rounded-lg"
                        >
                            <CloseIcon size={16} />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AdminDashboard;

