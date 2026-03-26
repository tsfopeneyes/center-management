import React from 'react';
import { Tablet, RotateCw, Activity, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AdminStatusHeader = ({
    activeUserCount,
    isPast10PM,
    currentLocations,
    adminIdsSet,
    handleBatchCheckout,
    fetchData
}) => {
    const navigate = useNavigate();

    const handleKioskMode = () => {
        if (window.confirm('보안을 위해 로그아웃 후 키오스크 모드로 전환하시겠습니까?\n(예 클릭 시 로그아웃 후 이동하며, 학생들이 관리자 페이지로 접근하는 것을 방지합니다.)')) {
            localStorage.removeItem('user');
            localStorage.removeItem('admin_user');
            navigate('/kiosk');
        }
    };

    return (
        <div className="p-4 md:p-10 bg-white rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 md:gap-6 items-start md:items-center justify-between bg-gradient-to-r from-white to-blue-50/20">
            <div className="flex items-center justify-between w-full md:w-auto">
                <div>
                    <h2 className="text-xl md:text-3xl font-black text-gray-800 tracking-tighter flex items-center gap-2 md:gap-3">
                        <Activity className="text-blue-600" size={24} md:size={32} />
                        이용 현황
                    </h2>
                    <p className="hidden md:block text-gray-500 text-sm font-medium mt-1">실시간 공간 이용 현황 및 입실자 관리</p>
                </div>

                <div className="md:hidden flex gap-2">
                    <button onClick={fetchData} className="p-2.5 bg-white text-green-600 border border-green-100 rounded-xl transition-all shadow-sm">
                        <RotateCw size={18} />
                    </button>
                    <button
                        onClick={handleKioskMode}
                        className="p-2.5 bg-primary-gradient text-white rounded-xl transition-all shadow-md"
                    >
                        <Tablet size={18} />
                    </button>
                </div>
            </div>

            <div className="flex flex-wrap gap-2 md:gap-3 w-full md:w-auto">
                {activeUserCount > 0 && (
                    <button
                        onClick={() => handleBatchCheckout(Object.keys(currentLocations).filter(uid =>
                            currentLocations[uid] && !adminIdsSet.has(uid)
                        ))}
                        className={`flex-1 md:flex-none px-4 md:px-5 py-2.5 md:py-3 rounded-xl md:rounded-2xl flex items-center justify-center gap-1.5 transition-all font-black shadow-lg border text-xs md:text-sm ${isPast10PM
                            ? 'bg-red-600 text-white border-red-700 hover:bg-red-700 animate-pulse'
                            : 'bg-white text-orange-600 border-orange-100 hover:bg-orange-50'
                            }`}
                    >
                        <LogOut size={16} md:size={18} /> <span className="uppercase tracking-wider">전원 퇴실</span>
                    </button>
                )}
                <button onClick={fetchData} className="hidden md:flex flex-1 md:flex-none bg-white text-green-600 border border-green-100 px-5 py-3 rounded-2xl items-center justify-center gap-2 hover:bg-green-50 transition-all font-black shadow-lg">
                    <RotateCw size={18} /> <span className="text-xs uppercase tracking-wider">새로고침</span>
                </button>
                <button
                    onClick={handleKioskMode}
                    className="hidden md:flex flex-1 md:flex-none bg-primary-gradient text-white px-6 py-3 rounded-2xl items-center justify-center gap-2 hover:opacity-90 transition-all shadow-xl font-black"
                >
                    <Tablet size={20} /> <span className="text-xs uppercase tracking-wider">키오스크</span>
                </button>
            </div>
        </div>
    );
};

export default AdminStatusHeader;
