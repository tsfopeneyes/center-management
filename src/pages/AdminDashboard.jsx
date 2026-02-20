import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

// Utilities
import { performFullSyncToGoogleSheets } from '../utils/integrationUtils';
import { processAnalyticsData, processUserAnalytics, processProgramAnalytics } from '../utils/analyticsUtils';
import { aggregateVisitSessions } from '../utils/visitUtils';

// Components
import AdminSidebar from '../components/admin/AdminSidebar';
import AdminStatus from '../components/admin/AdminStatus';
import AdminBoard from '../components/admin/AdminBoard';
import AdminUsers from '../components/admin/AdminUsers';
import AdminLogs from '../components/admin/AdminLogs';
import AdminSettings from '../components/admin/AdminSettings';
import AdminStatistics from '../components/admin/AdminStatistics';
import AdminMessages from '../components/admin/AdminMessages';
import AdminGuestbook from '../components/admin/AdminGuestbook';
import AdminReport from '../components/admin/AdminReport';
import AdminChallenges from '../components/admin/AdminChallenges';
import AdminCalendar from '../components/admin/AdminCalendar';
import AdminSchool from '../components/admin/AdminSchool';
import { Menu, X as CloseIcon } from 'lucide-react';
import { subscribeToPush } from '../utils/pushUtils';

const AdminDashboard = () => {
    const navigate = useNavigate();

    // Auth & Data State
    const [currentAdmin, setCurrentAdmin] = useState(null);
    const [activeMenu, setActiveMenu] = useState('STATUS'); // STATUS, BOARD, GALLERY, USERS, STATISTICS, LOGS, SETTINGS
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isSidebarPinned, setIsSidebarPinned] = useState(true);
    const [loading, setLoading] = useState(true);
    const [isStatsLoading, setIsStatsLoading] = useState(false);

    // Data
    const [users, setUsers] = useState([]);
    const [locations, setLocations] = useState([]);
    const [locationGroups, setLocationGroups] = useState([]);
    const [notices, setNotices] = useState([]);
    const [allLogs, setAllLogs] = useState([]);
    const [schoolLogs, setSchoolLogs] = useState([]);
    const [responses, setResponses] = useState([]);
    const [zoneStats, setZoneStats] = useState({});
    const [dailyVisitStats, setDailyVisitStats] = useState({});
    const [currentLocations, setCurrentLocations] = useState({}); // { userId: locationId }

    useEffect(() => {
        const storedAdmin = localStorage.getItem('admin_user');
        if (!storedAdmin) {
            alert('관리자 권한이 필요합니다.');
            navigate('/');
            return;
        }
        const admin = JSON.parse(storedAdmin);
        setCurrentAdmin(admin);
        fetchData();
        subscribeToPush(admin.id); // Ask for notification permission

        // Realtime Subscription with Debounce
        let debounceTimer;
        const debouncedFetch = () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                fetchData();
            }, 1000); // 1-second debounce to handle burst updates
        };

        const subscription = supabase
            .channel('public:updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'logs' }, debouncedFetch)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notice_responses' }, debouncedFetch)
            .subscribe();

        return () => {
            clearTimeout(debounceTimer);
            supabase.removeChannel(subscription);
        };
    }, [navigate]);

    const fetchData = async (isFullFetch = false) => {
        // Automatically perform full fetch if currently in statistics or report mode
        const needsFullFetch = isFullFetch || activeMenu === 'STATISTICS' || activeMenu === 'REPORTS';
        if (needsFullFetch) setIsStatsLoading(true);
        try {
            const { data: userData } = await supabase.from('users').select('*').order('name');
            setUsers(userData || []);

            const { data: locData } = await supabase.from('locations').select('*').order('id');
            setLocations(locData || []);

            const { data: lgData } = await supabase.from('location_groups').select('*').order('created_at');
            setLocationGroups(lgData || []);

            const { data: noticeData } = await supabase.from('notices').select('*')
                .order('is_sticky', { ascending: false })
                .order('created_at', { ascending: false });
            setNotices(noticeData || []);

            const { data: responseData } = await supabase.from('notice_responses').select('*');
            setResponses(responseData || []);

            // Stats Calculation - Increase limit for initial load and allow full fetch for statistics
            const logLimit = isFullFetch ? 10000 : 3000;
            const { data: rawLogs } = await supabase.from('logs').select('*').order('created_at', { ascending: false }).limit(logLimit);
            const logs = rawLogs ? [...rawLogs].reverse() : [];

            const userCurrentLocation = {};
            logs?.forEach(log => {
                if (log.type === 'CHECKIN' || log.type === 'MOVE') userCurrentLocation[log.user_id] = log.location_id;
                else if (log.type === 'CHECKOUT') userCurrentLocation[log.user_id] = null;
            });

            const adminIdsSet = new Set(userData?.filter(u =>
                u.name === 'admin' || u.user_group === '관리자' || u.role === 'admin'
            ).map(u => u.id) || []);

            // Occupancy Stats Calculation (Real-time) - Only count students
            const zStats = {};
            locData?.forEach(l => zStats[l.id] = 0);
            Object.entries(userCurrentLocation).forEach(([userId, locId]) => {
                if (locId && zStats[locId] !== undefined && !adminIdsSet.has(userId)) {
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
                    if (log.type === 'GUEST_ENTRY') {
                        vStats[log.location_id]++;
                    } else if (log.type === 'CHECKIN' || log.type === 'MOVE') {
                        locVisitors[log.location_id].add(log.user_id);
                    }
                }
            });

            // Merge student sets into counts
            Object.keys(locVisitors).forEach(locId => {
                vStats[locId] += locVisitors[locId].size;
            });

            setZoneStats(zStats);
            setDailyVisitStats(vStats);
            setCurrentLocations(userCurrentLocation);
            setAllLogs(logs || []);

            // Fetch School Logs for AdminLogs
            const { data: sLogs } = await supabase.from('school_logs').select('*, users(name), schools(name)').order('date', { ascending: false });
            setSchoolLogs(sLogs || []);

            return { users: userData || [], locations: locData || [], locationGroups: lgData || [], notices: noticeData || [], responses: responseData || [], allLogs: logs || [], schoolLogs: sLogs || [] };

        } catch (error) { console.error(error); }
        finally {
            setLoading(false);
            setIsStatsLoading(false);
        }
    };

    const handleForceCheckout = async (userId) => {
        if (!confirm('해당 회원을 강제 퇴실 처리하시겠습니까?')) return;
        try {
            const { error } = await supabase.from('logs').insert([{
                user_id: userId,
                type: 'CHECKOUT',
                location_id: null
            }]);

            if (error) throw error;
            fetchData();
            alert('퇴실 처리되었습니다.');
        } catch (err) {
            console.error(err);
            alert(`퇴실 처리 실패: ${err.message || '알 수 없는 오류'}`);
        }
    };

    const handleBatchCheckout = async (userIds) => {
        if (userIds.length === 0) return;
        if (!confirm(`현재 입실 중인 ${userIds.length}명 전원을 퇴실 처리하시겠습니까?`)) return;

        try {
            const checkoutLogs = userIds.map(uid => ({
                user_id: uid,
                type: 'CHECKOUT',
                location_id: null
            }));

            const { error } = await supabase.from('logs').insert(checkoutLogs);
            if (error) throw error;

            fetchData();
            alert('전원 퇴실 처리되었습니다.');
        } catch (err) {
            console.error(err);
            alert(`일괄 퇴실 실패: ${err.message}`);
        }
    };

    // Trigger full fetch when entering statistics
    useEffect(() => {
        if (activeMenu === 'STATISTICS') {
            fetchData(true);
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
    const syncDataRef = React.useRef({ users, allLogs, responses, notices, locations, schoolLogs });
    useEffect(() => {
        syncDataRef.current = { users, allLogs, responses, notices, locations, schoolLogs };
    }, [users, allLogs, responses, notices, locations, schoolLogs]);

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
            const { users, allLogs, responses, notices, locations, schoolLogs } = syncDataRef.current;

            await performFullSyncToGoogleSheets({
                webhookUrl,
                users,
                logs: allLogs,
                responses,
                notices,
                locations,
                schoolLogs,
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

    const handleLogout = () => {
        if (confirm("로그아웃 하시겠습니까?")) {
            localStorage.removeItem('admin_user');
            localStorage.removeItem('user');
            navigate('/');
        }
    };

    if (loading) return <div className="flex items-center justify-center h-screen text-gray-400 font-bold">로딩 중...</div>;

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
                    {activeMenu === 'STATUS' && (
                        <AdminStatus
                            users={users}
                            locations={locations}
                            zoneStats={zoneStats}
                            currentLocations={currentLocations}
                            handleBatchCheckout={handleBatchCheckout}
                            fetchData={fetchData}
                            allLogs={allLogs}
                            dailyVisitStats={dailyVisitStats}
                            setActiveMenu={setActiveMenu}
                            handleForceCheckout={handleForceCheckout}
                        />
                    )}
                    {activeMenu === 'CALENDAR' && (
                        <AdminCalendar notices={notices} fetchData={fetchData} />
                    )}
                    {activeMenu === 'PROGRAMS' && (
                        <AdminBoard mode="PROGRAM" notices={notices} fetchData={fetchData} users={users} currentLocations={currentLocations} />
                    )}
                    {activeMenu === 'BOARD' && (
                        <AdminBoard mode="NOTICE" notices={notices} fetchData={fetchData} users={users} currentLocations={currentLocations} />
                    )}
                    {activeMenu === 'GALLERY' && (
                        <AdminBoard mode="GALLERY" notices={notices} fetchData={fetchData} users={users} currentLocations={currentLocations} />
                    )}
                    {activeMenu === 'GUESTBOOK' && (
                        <AdminGuestbook />
                    )}
                    {activeMenu === 'USERS' && (
                        <AdminUsers users={users} allLogs={allLogs} locations={locations} fetchData={fetchData} />
                    )}
                    {activeMenu === 'SCHOOLS' && (
                        <AdminSchool users={users} fetchData={fetchData} />
                    )}
                    {activeMenu === 'CHALLENGES' && (
                        <AdminChallenges />
                    )}
                    {activeMenu === 'MESSAGES' && (
                        <AdminMessages users={users} />
                    )}
                    {activeMenu === 'STATISTICS' && (
                        <AdminStatistics logs={allLogs} schoolLogs={schoolLogs} locations={locations} locationGroups={locationGroups} users={users} notices={notices} responses={responses} isLoading={isStatsLoading} />
                    )}
                    {activeMenu === 'LOGS' && (
                        <AdminLogs allLogs={allLogs} schoolLogs={schoolLogs} users={users} locations={locations} notices={notices} fetchData={fetchData} />
                    )}
                    {activeMenu === 'REPORTS' && (
                        <AdminReport allLogs={allLogs} users={users} locations={locations} notices={notices} />
                    )}
                    {activeMenu === 'SETTINGS' && (
                        <AdminSettings currentAdmin={currentAdmin} locations={locations} locationGroups={locationGroups} notices={notices} fetchData={fetchData} users={users} allLogs={allLogs} responses={responses} schoolLogs={schoolLogs} />
                    )}
                </main>
            </div>
        </div>
    );
};

export default AdminDashboard;

