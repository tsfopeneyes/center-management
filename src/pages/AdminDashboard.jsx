import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

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
import { Menu, X as CloseIcon } from 'lucide-react';
import { subscribeToPush } from '../utils/pushUtils';

const AdminDashboard = () => {
    const navigate = useNavigate();

    // Auth & Data State
    const [currentAdmin, setCurrentAdmin] = useState(null);
    const [activeMenu, setActiveMenu] = useState('STATUS'); // STATUS, BOARD, GALLERY, USERS, STATISTICS, LOGS, SETTINGS
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    // Data
    const [users, setUsers] = useState([]);
    const [locations, setLocations] = useState([]);
    const [notices, setNotices] = useState([]);
    const [allLogs, setAllLogs] = useState([]);
    const [responses, setResponses] = useState([]);
    const [zoneStats, setZoneStats] = useState({});
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

        // Realtime Subscription
        const subscription = supabase
            .channel('public:updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'logs' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notice_responses' }, () => fetchData())
            .subscribe();

        return () => {
            supabase.removeChannel(subscription);
        };
    }, [navigate]);

    const fetchData = async () => {
        try {
            const { data: userData } = await supabase.from('users').select('*').order('name');
            setUsers(userData || []);

            const { data: locData } = await supabase.from('locations').select('*').order('id');
            setLocations(locData || []);

            const { data: noticeData } = await supabase.from('notices').select('*')
                .order('is_sticky', { ascending: false })
                .order('created_at', { ascending: false });
            setNotices(noticeData || []);

            const { data: responseData } = await supabase.from('notice_responses').select('*');
            setResponses(responseData || []);

            // Stats Calculation
            const { data: logs } = await supabase.from('logs').select('*').order('created_at', { ascending: true });

            const userCurrentLocation = {};
            logs?.forEach(log => {
                if (log.type === 'CHECKIN') userCurrentLocation[log.user_id] = log.location_id;
                else if (log.type === 'MOVE') userCurrentLocation[log.user_id] = log.location_id;
                else if (log.type === 'CHECKOUT') userCurrentLocation[log.user_id] = null;
            });

            const zStats = {};
            locData?.forEach(l => zStats[l.id] = 0);
            Object.values(userCurrentLocation).forEach(locId => {
                if (locId && zStats[locId] !== undefined) zStats[locId]++;
            });

            setZoneStats(zStats);
            setCurrentLocations(userCurrentLocation);
            setAllLogs(logs || []);

            return { users: userData || [], locations: locData || [], notices: noticeData || [], responses: responseData || [], allLogs: logs || [] };

        } catch (error) { console.error(error); }
        finally { setLoading(false); }
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
            />

            {/* Main Content */}
            <div className="flex-1 md:ml-64 min-w-0">
                {/* Mobile Header */}
                <header className="md:hidden bg-white border-b border-gray-100 p-4 sticky top-0 z-10 flex justify-between items-center">
                    <h1 className="text-lg font-extrabold text-blue-600 tracking-tight">SCI CENTER <span className="text-gray-400 text-[10px] ml-1 uppercase">Admin</span></h1>
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="p-2 text-gray-500 hover:bg-gray-50 rounded-lg transition-colors border border-gray-100 shadow-sm"
                    >
                        {isMenuOpen ? <CloseIcon size={20} /> : <Menu size={20} />}
                    </button>
                </header>

                <div className="p-4 md:p-8">
                    {activeMenu === 'STATUS' && (
                        <AdminStatus
                            users={users}
                            locations={locations}
                            zoneStats={zoneStats}
                            currentLocations={currentLocations}
                            handleForceCheckout={handleForceCheckout}
                            handleBatchCheckout={handleBatchCheckout}
                            fetchData={fetchData}
                            setActiveMenu={setActiveMenu}
                        />
                    )}
                    {activeMenu === 'PROGRAMS' && (
                        <AdminBoard mode="PROGRAM" notices={notices} fetchData={fetchData} />
                    )}
                    {activeMenu === 'BOARD' && (
                        <AdminBoard mode="NOTICE" notices={notices} fetchData={fetchData} />
                    )}
                    {activeMenu === 'GALLERY' && (
                        <AdminBoard mode="GALLERY" notices={notices} fetchData={fetchData} />
                    )}
                    {activeMenu === 'GUESTBOOK' && (
                        <AdminGuestbook />
                    )}
                    {activeMenu === 'USERS' && (
                        <AdminUsers users={users} allLogs={allLogs} locations={locations} fetchData={fetchData} />
                    )}
                    {activeMenu === 'MESSAGES' && (
                        <AdminMessages users={users} />
                    )}
                    {activeMenu === 'STATISTICS' && (
                        <AdminStatistics logs={allLogs} locations={locations} users={users} notices={notices} responses={responses} />
                    )}
                    {activeMenu === 'LOGS' && (
                        <AdminLogs allLogs={allLogs} users={users} locations={locations} notices={notices} fetchData={fetchData} />
                    )}
                    {activeMenu === 'REPORTS' && (
                        <AdminReport />
                    )}
                    {activeMenu === 'SETTINGS' && (
                        <AdminSettings currentAdmin={currentAdmin} locations={locations} notices={notices} fetchData={fetchData} users={users} allLogs={allLogs} responses={responses} />
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
