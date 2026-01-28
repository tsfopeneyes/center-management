import React, { useState } from 'react';
import { Settings, Tablet, RotateCw, X, Users, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AdminStatus = ({
    users,
    locations,
    zoneStats,
    currentLocations,
    handleForceCheckout,
    handleBatchCheckout,
    fetchData,
    setActiveMenu
}) => {
    const navigate = useNavigate();
    const [locationTab, setLocationTab] = useState('ALL'); // ALL, HYPHEN, ENOF

    // 10 PM Check
    const isPast10PM = new Date().getHours() >= 22;
    const activeUserCount = Object.keys(currentLocations).filter(uid => currentLocations[uid]).length;

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
                loc.name.includes('맴버십')
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
        const locId = currentLocations[u.id];
        if (!locId) return false;
        return filteredLocations.some(l => l.id === locId);
    }).map(u => ({
        ...u,
        currentLocationName: locations.find(l => l.id === currentLocations[u.id])?.name || 'Unknown'
    }));

    const handleZoneClick = (location) => {
        // Find users currently in this location
        const activeUserIds = Object.keys(currentLocations).filter(uid => currentLocations[uid] === location.id);
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
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-gray-50/50 p-4 rounded-2xl gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">이용 현황</h2>
                    <p className="text-gray-500 text-sm">실시간 공간 이용 현황 및 입실자 관리</p>
                </div>
                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    {activeUserCount > 0 && (
                        <button
                            onClick={() => handleBatchCheckout(Object.keys(currentLocations).filter(uid => currentLocations[uid]))}
                            className={`flex-1 md:flex-none px-4 py-2 rounded-xl flex items-center justify-center gap-2 transition font-bold shadow-sm border ${isPast10PM
                                ? 'bg-red-600 text-white border-red-700 hover:bg-red-700 animate-pulse'
                                : 'bg-white text-orange-600 border-orange-200 hover:bg-orange-50'
                                }`}
                        >
                            <LogOut size={18} /> <span className="text-sm">전원 퇴실</span>
                        </button>
                    )}
                    <button onClick={fetchData} className="flex-1 md:flex-none bg-white text-green-600 border border-green-200 px-4 py-2 rounded-xl flex items-center justify-center gap-2 hover:bg-green-50 transition font-bold shadow-sm">
                        <RotateCw size={18} /> <span className="text-sm">새로고침</span>
                    </button>
                    <button onClick={() => navigate('/checkin')} className="flex-1 md:flex-none bg-indigo-600 text-white px-5 py-2 rounded-xl flex items-center justify-center gap-2 hover:bg-indigo-700 transition shadow-lg font-bold">
                        <Tablet size={20} /> <span className="text-sm">키오스크</span>
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

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                    {/* Total Count Card */}
                    <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100 text-left flex flex-col justify-center">
                        <h3 className="text-gray-400 text-xs md:text-sm font-bold mb-1 md:mb-2">현재 입실 인원</h3>
                        <p className="text-3xl md:text-4xl font-extrabold text-blue-600">{totalActive}<span className="text-base md:text-lg text-gray-400 ml-1 font-medium">명</span></p>
                    </div>

                    {/* Zone Cards */}
                    {filteredLocations.map(loc => (
                        <div
                            key={loc.id}
                            onClick={() => handleZoneClick(loc)}
                            className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-gray-100 text-left cursor-pointer hover:border-blue-500 hover:shadow-md transition active:scale-95 group flex flex-col justify-between h-30 md:h-36"
                        >
                            <div className="flex justify-between items-start">
                                <h3 className="text-gray-500 text-xs md:text-sm font-bold group-hover:text-blue-600 w-full pr-2 break-keep leading-tight line-clamp-2">{loc.name}</h3>
                                <div className="text-gray-200 group-hover:text-blue-200 bg-gray-50 group-hover:bg-blue-50 p-1 md:p-1.5 rounded-lg transition">
                                    <Users size={14} />
                                </div>
                            </div>
                            <p className="text-2xl md:text-3xl font-bold text-gray-800 group-hover:text-blue-600 self-start mt-auto">{zoneStats[loc.id] || 0}<span className="text-xs md:text-sm font-normal text-gray-400 ml-1">명</span></p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Realtime User List */}
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/30">
                    <h3 className="font-bold text-lg text-gray-800">실시간 입실 현황</h3>
                    <span className="text-[10px] md:text-xs font-bold text-gray-400 bg-white border border-gray-100 px-2.5 py-1 rounded-full shadow-sm">Total {activeUsersList.length}</span>
                </div>

                {activeUsersList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400 text-sm">
                        <p>현재 입실 중인 이용자가 없습니다.</p>
                    </div>
                ) : (
                    <>
                        {/* Desktop Table View */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider font-semibold">
                                    <tr>
                                        <th className="p-4 pl-6">이름</th>
                                        <th className="p-4">현재 위치</th>
                                        <th className="p-4">학교</th>
                                        <th className="p-4">그룹</th>
                                        <th className="p-4 pr-6 text-right">관리</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-sm">
                                    {activeUsersList.map(user => (
                                        <tr key={user.id} className="hover:bg-blue-50/30 transition">
                                            <td className="p-4 pl-6 font-bold text-gray-700">{user.name}</td>
                                            <td className="p-4 text-blue-600 font-bold">{user.currentLocationName}</td>
                                            <td className="p-4 text-gray-500">{user.school}</td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${user.user_group === '졸업생' ? 'bg-gray-200 text-gray-600' :
                                                    user.user_group === '일반인' ? 'bg-orange-100 text-orange-600' :
                                                        'bg-blue-100 text-blue-600'
                                                    }`}>
                                                    {user.user_group || '재학생'}
                                                </span>
                                            </td>
                                            <td className="p-4 pr-6 text-right">
                                                <button
                                                    onClick={() => handleForceCheckout(user.id)}
                                                    className="text-xs bg-white text-red-500 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-500 hover:text-white transition font-bold shadow-sm"
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
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-gray-800 text-base truncate">{user.name}</span>
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
                                                <span className="font-bold text-gray-700">{u.name}</span>
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
