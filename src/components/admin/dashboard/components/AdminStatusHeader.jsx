import React from 'react';
import { Tablet, RotateCw, Activity, LogOut, Bell, BellOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AdminPageHeader from '../../common/AdminPageHeader';

const AdminStatusHeader = ({
    activeUserCount,
    isPast10PM,
    currentLocations,
    adminIdsSet,
    handleBatchCheckout,
    fetchData,
    isAlertEnabled,
    handleToggleAlert
}) => {
    const navigate = useNavigate();

    const handleKioskMode = () => {
        if (window.confirm('보안을 위해 로그아웃 후 키오스크 모드로 전환하시겠습니까?\n(예 클릭 시 로그아웃 후 이동하며, 학생들이 관리자 페이지로 접근하는 것을 방지합니다.)')) {
            localStorage.removeItem('user');
            localStorage.removeItem('admin_user');
            navigate('/kiosk');
        }
    };

    const actions = (
        <>
            {activeUserCount > 0 && (
                <button
                    onClick={() => handleBatchCheckout(Object.keys(currentLocations).filter(uid =>
                        currentLocations[uid]?.locId && !adminIdsSet.has(uid)
                    ))}
                    className={`flex-1 md:flex-none px-4 md:px-5 py-2.5 md:py-3 rounded-xl md:rounded-2xl flex items-center justify-center gap-1.5 transition-all font-black shadow-lg border text-xs md:text-sm ${isPast10PM
                        ? 'bg-red-600 text-white border-red-700 hover:bg-red-700 animate-pulse'
                        : 'bg-white text-orange-600 border-orange-100 hover:bg-orange-50'
                        }`}
                >
                    <LogOut size={16} md:size={18} /> <span className="uppercase tracking-wider">전원 퇴실</span>
                </button>
            )}
            
            {/* Desktop Notification Toggle */}
            <button
                onClick={() => handleToggleAlert(!isAlertEnabled)}
                className={`hidden md:flex flex-1 md:flex-none px-5 py-3 rounded-2xl items-center justify-center gap-2 transition-all font-black shadow-lg border text-xs md:text-sm ${
                    isAlertEnabled
                        ? 'bg-[#3182f6] text-white border-[#1b64da] hover:bg-[#1b64da]'
                        : 'bg-white text-[#4e5968] border-gray-100 hover:bg-gray-50'
                }`}
            >
                {isAlertEnabled ? <Bell size={18} /> : <BellOff size={18} />}
                <span className="uppercase tracking-wider">체크인 알림 {isAlertEnabled ? 'ON' : 'OFF'}</span>
            </button>

            <div className="md:hidden flex gap-2 w-full md:w-auto">
                <button
                    onClick={() => handleToggleAlert(!isAlertEnabled)}
                    className={`flex-1 p-2.5 rounded-xl border transition-all flex items-center justify-center ${
                        isAlertEnabled ? 'bg-[#3182f6] text-white border-[#1b64da]' : 'bg-white text-[#4e5968] border-gray-100'
                    }`}
                >
                    {isAlertEnabled ? <Bell size={18} /> : <BellOff size={18} />}
                </button>
                <button onClick={fetchData} className="flex-1 p-2.5 bg-white text-green-600 border border-green-100 rounded-xl transition-all shadow-sm flex items-center justify-center">
                    <RotateCw size={18} />
                </button>
                <button
                    onClick={handleKioskMode}
                    className="flex-1 p-2.5 bg-primary-gradient text-white rounded-xl transition-all shadow-md flex items-center justify-center"
                >
                    <Tablet size={18} />
                </button>
            </div>
            <button onClick={fetchData} className="hidden md:flex flex-1 md:flex-none bg-white text-green-600 border border-green-100 px-5 py-3 rounded-2xl items-center justify-center gap-2 hover:bg-green-50 transition-all font-black shadow-lg">
                <RotateCw size={18} /> <span className="text-xs uppercase tracking-wider">새로고침</span>
            </button>
            <button
                onClick={handleKioskMode}
                className="hidden md:flex flex-1 md:flex-none bg-primary-gradient text-white px-6 py-3 rounded-2xl items-center justify-center gap-2 hover:opacity-90 transition-all shadow-xl font-black"
            >
                <Tablet size={20} /> <span className="text-xs uppercase tracking-wider">키오스크</span>
            </button>
        </>
    );

    return (
        <AdminPageHeader
            title="이용 현황"
            subtitle="실시간 공간 이용 현황 및 입실자 관리"
            icon={<Activity />}
            actions={actions}
        />
    );
};

export default AdminStatusHeader;
