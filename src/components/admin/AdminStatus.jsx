import React, { useState } from 'react';
import { Settings, Tablet, RotateCw, X, Users, LogOut, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import UserAvatar from '../common/UserAvatar';

const AdminStatus = ({
    users,
    locations,
    zoneStats,
    currentLocations,
    handleForceCheckout,
    handleBatchCheckout,
    fetchData,
    setActiveMenu,
    allLogs = [],
    dailyVisitStats = {}
}) => {
    const navigate = useNavigate();
    const [locationTab, setLocationTab] = useState('ALL'); // ALL, HYPHEN, ENOF

    // 10 PM Check
    const isPast10PM = new Date().getHours() >= 22;
    const adminIdsSet = new Set(users.filter(u =>
        u.name === 'admin' || u.user_group === '관리자' || u.role === 'admin'
    ).map(u => u.id));
    const activeUserCount = Object.keys(currentLocations).filter(uid =>
        currentLocations[uid] && !adminIdsSet.has(uid)
    ).length;

    // Zone Detail Modal State
    const [zoneDetailModal, setZoneDetailModal] = useState({ isOpen: false, locationId: null, locationName: '', activeUsers: [] });

    // Filter Locations
    const getFilteredLocations = () => {
        if (locationTab === 'ALL') return locations;
        if (locationTab === 'HYPHEN') {
            return locations.filter(loc =>
                loc.name.includes('라운지') ||
                loc.name.includes('워크숍') ||
                loc.name.includes('회의실') ||
                loc.name.includes('멤버십') ||
                loc.name.includes('맴버십') ||
                loc.name.includes('고백')
            );
        }
        if (locationTab === 'ENOF') {
            return locations.filter(loc => loc.name.includes('이높'));
        }
        return locations;
    };
    const filteredLocations = getFilteredLocations();

    // Calculate Total Active
    const totalActive = filteredLocations.reduce((sum, loc) => sum + (zoneStats[loc.id] || 0), 0);

    // Get Active Users List for Table
    const activeUsersList = users.filter(u => {
        const isAdmin = u.name === 'admin' || u.user_group === '관리자' || u.role === 'admin';
        if (isAdmin) return false;
        const locId = currentLocations[u.id];
        if (!locId) return false;
        return filteredLocations.some(l => l.id === locId);
    }).map(u => ({
        ...u,
        currentLocationName: locations.find(l => l.id === currentLocations[u.id])?.name || 'Unknown'
    }));

    const handleZoneClick = (location) => {
        // Find users currently in this location
        const activeUserIds = Object.keys(currentLocations).filter(uid =>
            currentLocations[uid] === location.id && !adminIdsSet.has(uid)
        );
        const activeUsers = users.filter(u => activeUserIds.includes(u.id));

        setZoneDetailModal({
            isOpen: true,
            locationId: location.id,
            locationName: location.name,
            activeUsers: activeUsers
        });
    };

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="p-6 md:p-10 bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-6 items-start md:items-center justify-between bg-gradient-to-r from-white to-blue-50/20">
                <div>
                    <h2 className="text-2xl md:text-3xl font-black text-gray-800 tracking-tighter flex items-center gap-3">
                        <Activity className="text-blue-600" size={32} />
                        이용 현황
                    </h2>
                    <p className="text-gray-500 text-sm font-medium mt-1">실시간 공간 이용 현황 및 입실자 관리</p>
                </div>
                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    {activeUserCount > 0 && (
                        <button
                            onClick={() => handleBatchCheckout(Object.keys(currentLocations).filter(uid =>
                                currentLocations[uid] && !adminIdsSet.has(uid)
                            ))}
                            className={`flex-1 md:flex-none px-5 py-3 rounded-2xl flex items-center justify-center gap-2 transition-all font-black shadow-lg border btn-tactile ${isPast10PM
                                ? 'bg-red-600 text-white border-red-700 hover:bg-red-700 animate-pulse'
                                : 'bg-white text-orange-600 border-orange-100 hover:bg-orange-50'
                                }`}
                        >
                            <LogOut size={18} /> <span className="text-xs uppercase tracking-wider">전원 퇴실</span>
                        </button>
                    )}
                    <button onClick={fetchData} className="flex-1 md:flex-none bg-white text-green-600 border border-green-100 px-5 py-3 rounded-2xl flex items-center justify-center gap-2 hover:bg-green-50 transition-all font-black shadow-lg btn-tactile">
                        <RotateCw size={18} /> <span className="text-xs uppercase tracking-wider">새로고침</span>
                    </button>
                    <button
                        onClick={() => {
                            if (window.confirm('보안을 위해 로그아웃 후 키오스크 모드로 전환하시겠습니까?\n(예 클릭 시 로그아웃 후 이동하며, 학생들이 관리자 페이지로 접근하는 것을 방지합니다.)')) {
                                localStorage.removeItem('user');
                                localStorage.removeItem('admin_user');
                                navigate('/kiosk');
                            }
                        }}
                        className="flex-1 md:flex-none bg-primary-gradient text-white px-6 py-3 rounded-2xl flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-xl font-black btn-tactile"
                    >
                        <Tablet size={20} /> <span className="text-xs uppercase tracking-wider">키오스크</span>
                    </button>
                </div>
            </div>

            {/* Zone Overview */}
            <section>
                <div className="flex justify-between items-center mb-6 overflow-x-auto no-scrollbar py-1">
                    <div className="flex gap-2 mr-4">
                        {['ALL:전체 보기', 'HYPHEN:하이픈', 'ENOF:이높플레이스'].map(tab => {
                            const [id, label] = tab.split(':');
                            return (
                                <button
                                    key={id}
                                    onClick={() => setLocationTab(id)}
                                    className={`px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition flex-shrink-0 ${locationTab === id ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                                >
                                    {label}
                                </button>
                            )
                        })}
                    </div>
                    <button onClick={() => setActiveMenu('SETTINGS')} className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-200 flex items-center gap-1 font-bold whitespace-nowrap flex-shrink-0 shadow-sm border border-gray-100">
                        <Settings size={14} /> 공간 관리
                    </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-8">
                    {/* Total Count Card */}
                    <div className="bg-primary-gradient p-5 md:p-8 rounded-[2rem] md:rounded-[2.5rem] shadow-2xl shadow-blue-500/20 text-white flex flex-col justify-center relative overflow-hidden min-h-[140px] md:min-h-[180px] btn-tactile">
                        <div className="absolute right-0 top-0 w-32 h-32 bg-white/20 rounded-full -mr-16 -mt-16 blur-3xl animate-float opacity-50" />
                        <h3 className="text-blue-100 text-[10px] md:text-sm font-black mb-1 uppercase tracking-widest opacity-90">Total Active</h3>
                        <p className="text-4xl md:text-6xl font-black tracking-tighter tabular-nums">{totalActive}<span className="text-base md:text-xl text-blue-200 ml-1 md:ml-2 font-black uppercase">명</span></p>
                        <div className="mt-2 md:mt-4 flex items-center gap-2 bg-white/20 w-fit px-3 py-1.5 md:px-4 md:py-2 rounded-2xl backdrop-blur-md border border-white/10">
                            <span className="w-2 md:w-2.5 h-2 md:h-2.5 rounded-full bg-blue-200 animate-pulse" />
                            <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest">Live Status</span>
                        </div>
                    </div>

                    {/* Zone Cards */}
                    {filteredLocations.map(loc => (
                        <div
                            key={loc.id}
                            onClick={() => handleZoneClick(loc)}
                            className="glass-card p-5 md:p-8 rounded-[2rem] md:rounded-[2.5rem] text-left cursor-pointer hover:border-blue-500 transition-all duration-500 btn-tactile group flex flex-col justify-between min-h-[140px] md:min-h-[180px]"
                        >
                            <div className="flex justify-between items-start mb-4 md:mb-6">
                                <h3 className="text-gray-400 text-[10px] md:text-sm font-black group-hover:text-blue-600 break-keep leading-tight transition-colors uppercase tracking-widest">{loc.name}</h3>
                                <div className="text-gray-300 group-hover:text-blue-500 bg-gray-50/50 group-hover:bg-blue-50 p-2 md:p-3 rounded-2xl transition-all duration-300 shrink-0 shadow-inner">
                                    <Users size={16} className="md:w-[22px] md:h-[22px]" />
                                </div>
                            </div>
                            <div className="flex flex-col">
                                <p className="text-4xl md:text-5xl font-black text-gray-800 group-hover:text-blue-600 transition-colors tracking-tighter tabular-nums">{zoneStats[loc.id] || 0}<span className="text-xs md:text-sm font-bold text-gray-400 ml-1 md:ml-2">명</span></p>
                                <div className="flex items-center gap-1.5 mt-2 md:mt-4 bg-gray-50 group-hover:bg-blue-50 w-fit px-3 py-1 md:px-4 md:py-1.5 rounded-2xl transition-colors border border-transparent group-hover:border-blue-100 shadow-sm">
                                    <p className="text-[9px] md:text-[11px] font-black text-gray-400 group-hover:text-blue-500 transition-colors uppercase tracking-widest">Today {dailyVisitStats[loc.id] || 0}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Realtime User List */}
            <section className="bg-white rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/20">
                    <h3 className="font-black text-xl text-gray-800 tracking-tight">실시간 입실 현황</h3>
                    <span className="text-[11px] font-black text-blue-600 bg-blue-50 px-4 py-1.5 rounded-full shadow-sm uppercase tracking-widest border border-blue-100">Total {activeUsersList.length}</span>
                </div>

                {activeUsersList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-28 text-gray-300 font-bold">
                        <p>현재 입실 중인 이용자가 없습니다.</p>
                    </div>
                ) : (
                    <>
                        {/* Desktop Table View */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50/50 text-gray-400 text-[11px] uppercase tracking-widest font-black border-b border-gray-50">
                                    <tr>
                                        <th className="p-6 pl-10">이름</th>
                                        <th className="p-6">현재 위치</th>
                                        <th className="p-6">학교</th>
                                        <th className="p-6">그룹</th>
                                        <th className="p-6 pr-10 text-right">관리</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 text-sm">
                                    {activeUsersList.map(user => (
                                        <tr key={user.id} className="hover:bg-blue-50/20 transition-all duration-300 group">
                                            <td className="p-6 pl-10 font-bold text-gray-700 flex items-center gap-3">
                                                <UserAvatar user={user} size="w-10 h-10" textSize="text-sm" />
                                                {user.name}
                                                {user.is_leader && <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#FACC15" stroke="#FACC15" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-star"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>}
                                            </td>
                                            <td className="p-6 text-blue-600 font-black">{user.currentLocationName}</td>
                                            <td className="p-6 text-gray-500 font-medium">{user.school || '-'}</td>
                                            <td className="p-6">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight ${user.user_group === '졸업생' ? 'bg-gray-100 text-gray-600' :
                                                    user.user_group === '일반인' ? 'bg-orange-100 text-orange-600' :
                                                        'bg-blue-100 text-blue-600'
                                                    }`}>
                                                    {user.user_group || '재학생'}
                                                </span>
                                            </td>
                                            <td className="p-6 pr-10 text-right">
                                                <button
                                                    onClick={() => handleForceCheckout(user.id)}
                                                    className="px-4 py-2 bg-white border border-red-100 text-red-500 text-[11px] font-black rounded-xl hover:bg-red-500 hover:text-white hover:border-red-500 transition-all duration-300 shadow-sm"
                                                >
                                                    강제 퇴실
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="md:hidden divide-y divide-gray-100">
                            {activeUsersList.map(user => (
                                <div key={user.id} className="p-4 active:bg-gray-50 transition flex items-center justify-between gap-4">
                                    <UserAvatar user={user} size="w-10 h-10" textSize="text-xs" />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-gray-800 text-base truncate flex items-center gap-1">
                                                {user.name}
                                                {user.is_leader && <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#FACC15" stroke="#FACC15" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-star"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 ${user.user_group === '졸업생' ? 'bg-gray-100 text-gray-500' :
                                                user.user_group === '일반인' ? 'bg-orange-100 text-orange-600' :
                                                    'bg-blue-50 text-blue-500'
                                                }`}>
                                                {user.user_group || '재학생'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                            <span className="bg-blue-50 text-blue-600 font-bold px-1.5 py-0.5 rounded">{user.currentLocationName}</span>
                                            <span className="truncate">{user.school}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleForceCheckout(user.id)}
                                        className="bg-red-50 text-red-500 border border-red-100 px-3 py-2 rounded-xl transition font-bold text-xs flex-shrink-0 active:bg-red-500 active:text-white active:border-red-500 shadow-sm"
                                    >
                                        퇴실
                                    </button>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </section>

            {/* Zone Detail Modal */}
            {zoneDetailModal.isOpen && (
                <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden max-h-[80vh] flex flex-col">
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-blue-50">
                            <div>
                                <h3 className="font-bold text-blue-800 text-lg">{zoneDetailModal.locationName}</h3>
                                <p className="text-xs text-blue-500">현재 이용자 명단 ({zoneDetailModal.activeUsers.length}명)</p>
                            </div>
                            <button onClick={() => setZoneDetailModal({ ...zoneDetailModal, isOpen: false })}><X size={20} className="text-blue-300 hover:text-blue-500" /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {zoneDetailModal.activeUsers.length === 0 ? (
                                <div className="text-center py-10 text-gray-400 text-sm">현재 이용자가 없습니다.</div>
                            ) : (
                                zoneDetailModal.activeUsers.map(u => (
                                    <div key={u.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                                        <div className="flex items-center gap-2">
                                            <div>
                                                <span className="font-bold text-gray-700 flex items-center gap-1">
                                                    {u.name}
                                                    {u.is_leader && <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="#FACC15" stroke="#FACC15" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-star"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>}
                                                </span>
                                                <span className="text-xs text-gray-500 ml-1">({u.school})</span>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${u.user_group === '졸업생' ? 'bg-gray-200 text-gray-600' :
                                                u.user_group === '일반인' ? 'bg-orange-100 text-orange-600' :
                                                    'bg-white border border-gray-100 text-blue-500'
                                                }`}>
                                                {u.user_group || '재학생'}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => handleForceCheckout(u.id)}
                                            className="text-[10px] bg-white text-red-500 border border-red-100 px-2 py-1.5 rounded-lg hover:bg-red-500 hover:text-white transition whitespace-nowrap font-bold"
                                        >
                                            퇴실
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminStatus;
