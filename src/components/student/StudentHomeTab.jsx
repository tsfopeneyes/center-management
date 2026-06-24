import React from 'react';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { Share2, Bell, ShieldCheck, Settings, LogOut, AlertCircle, ChevronRight, User, Image as ImageIcon, Pin, QrCode, Home, Trophy, Calendar as LucideCalendar, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import UserAvatar from '../common/UserAvatar';
import ProgramCard from './ProgramCard';
import { startOfDay } from 'date-fns';
import { TAB_NAMES, CATEGORIES } from '../../constants/appConstants';
import { stripHtml } from '../../utils/textUtils';
import TodayOperatingWidget from './components/TodayOperatingWidget';

const StudentHomeTab = ({
    user,
    unreadNotificationCount,
    setShowProfileSettings,
    setShowNotificationsModal,
    handleShare,
    setShowEnlargedQr,
    navigate,
    adminSchedules,
    calendarCategories,
    dashboardConfig,
    totalHours,
    visitCount,
    programCount,
    setShowProgramHistory,
    handleTabChange,
    homePrograms,
    responses,
    openNoticeDetail,
    homeNotices,
    locationGroups,
    activeUserCountByGroup,
    handleLogout,
    dynamicChallenges,
    specialStats}) => {
    // 뱃지 관련 로직 제거됨

    return (
        <>
            {/* Premium Integrated Profile Card */}
            <header className="bg-primary-gradient px-3.5 py-4 text-white rounded-b-[2rem] shadow-2xl relative overflow-hidden mb-0 gpu-accelerated">
                {/* Subtle Decorative Elements */}
                <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-[60px] animate-float" />
                <div className="absolute bottom-[-10%] left-[-5%] w-48 h-48 bg-indigo-500/20 rounded-full blur-[50px] animate-float [animation-delay:-5s]" />

                <div className="relative z-10 max-w-sm sm:max-w-md mx-auto">
                    {/* Top Section: Avatar + Profile Info + 2x2 Stats Grid (가로 1열 고정 구조) */}
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between gap-3 mb-3">
                            {/* Profile Left: Avatar & Info */}
                            <div className="flex items-center gap-3">
                                <div className="relative shrink-0">
                                    <motion.div
                                        whileHover={{ scale: 1.03 }}
                                        whileTap={{ scale: 0.97 }}
                                        onClick={() => setShowProfileSettings(true)}
                                        className="cursor-pointer p-0.5 bg-white/20 backdrop-blur-md rounded-full shadow-lg ring-2 ring-white/10"
                                    >
                                        <UserAvatar user={user} size="w-14 h-14 sm:w-16 sm:h-16" textSize="text-lg sm:text-xl" />
                                    </motion.div>
                                </div>
                                <div className="flex flex-col min-w-0 justify-center">
                                    <p className="text-white/95 text-[10px] sm:text-[11px] font-black tracking-wider uppercase mb-0.5 select-none leading-none opacity-90">{user?.school || '더작은재단'}</p>
                                    <h1 className="text-[17px] sm:text-[20px] font-black tracking-tight leading-tight text-white whitespace-nowrap flex items-center gap-1">
                                        {user?.name} 님
                                        {user?.is_leader && <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="#FACC15" stroke="#FACC15" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-star"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>}
                                    </h1>
                                </div>
                            </div>

                            {/* Profile Right: Actions */}
                            <div className="flex items-center gap-1.5 shrink-0">
                                {/* Hyphen Badge */}
                                <button 
                                    onClick={() => handleTabChange(TAB_NAMES.HYPHEN)}
                                    className="flex items-center gap-1 bg-white/20 hover:bg-white/30 transition-colors backdrop-blur-md px-2.5 py-1 rounded-full border border-white/30 shadow-sm"
                                >
                                    <div className="w-4 h-4 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center text-white text-[9px] font-black shadow-sm leading-none shrink-0 border border-amber-300">H</div>
                                    <span className="font-extrabold text-[13px] sm:text-[14px] text-white tracking-tight">{user?.current_hyphen || 0}</span>
                                </button>
                                
                                {/* Settings Icon */}
                                <button 
                                    onClick={() => setShowProfileSettings(true)}
                                    className="p-1.5 bg-white/10 hover:bg-white/20 transition-colors rounded-full backdrop-blur-md border border-white/10 text-white/90 shadow-sm"
                                >
                                    <Settings size={16} />
                                </button>

                                {/* Logout Icon */}
                                <button 
                                    onClick={handleLogout}
                                    className="p-1.5 bg-white/10 hover:bg-red-500/80 transition-colors rounded-full backdrop-blur-md border border-white/10 text-white/90 hover:text-white shadow-sm"
                                >
                                    <LogOut size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Bottom Section: Text Summary (Compact) */}
                        <div className="flex items-center justify-center text-center -mt-3 mb-2.5">
                            <span className="text-white/95 text-[13.5px] sm:text-[14.5px] font-bold tracking-tight">
                                그동안 센터에서 <span className="text-yellow-300 font-black">{visitCount}번</span> 만났고, <span className="text-emerald-300 font-black">{programCount}개</span>의 활동을 함께했어요!
                            </span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Today's Closure Notification */}
            {(() => {
                const today = startOfDay(new Date());
                const todayClosure = adminSchedules.find(sch => {
                    const cat = calendarCategories.find(c => c.id === sch.category_id);
                    if (cat?.name !== '휴관') return false;
                    const start = startOfDay(new Date(sch.start_date));
                    const end = startOfDay(new Date(sch.end_date));
                    return today >= start && today <= end;
                });

                if (!todayClosure) return null;

                let closedSpaces = todayClosure.closed_spaces || [];
                try {
                    const parsed = JSON.parse(todayClosure.content);
                    if (parsed && typeof parsed === 'object' && parsed.closed_spaces) {
                        closedSpaces = parsed.closed_spaces;
                    }
                } catch (e) { }

                const isHyphenClosed = closedSpaces.includes('HYPHEN');
                const isEnofClosed = closedSpaces.includes('ENOF');

                let message = "오늘은 센터 전체 휴관일입니다 🏠";
                if (isHyphenClosed && !isEnofClosed) message = "오늘은 하이픈 휴관일입니다 ⛔";
                else if (!isHyphenClosed && isEnofClosed) message = "오늘은 이높플레이스 휴관일입니다 ⚠️";

                return (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mx-2.5 mt-4 p-4 rounded-2xl bg-red-50/80 backdrop-blur-md border border-red-100 shadow-sm flex items-center justify-center relative overflow-hidden"
                    >
                        <div className="flex items-center gap-2">
                            <AlertCircle size={18} strokeWidth={3} className="text-red-600 animate-pulse" />
                            <p className="text-red-700 font-black text-[15px] tracking-wide">{message}</p>
                        </div>
                    </motion.div>
                );
            })()}

            {/* Today Operating Widget */}
            <div className="px-3.5 mt-4">
                <TodayOperatingWidget />
            </div>

            <div className="p-2.5 pt-2.5 pb-10 space-y-2.5 relative z-0">
                {dashboardConfig.map((config) => {
                    if (!config.isVisible) return null;

                    switch (config.id) {
                        case 'stats':
                            // 통계는 이제 헤더 영역(프로필 카드 내부)에 통합되어 표시됩니다.
                            return null;

                        case 'programs':
                            return (
                                <div key="programs" className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                                    <h3 className="font-bold text-gray-800 mb-3 flex justify-between items-center text-sm">
                                        <span className="flex items-center gap-1">🔥 {config.label || '프로그램 신청'}</span>
                                        <button onClick={() => handleTabChange(TAB_NAMES.PROGRAMS)} className="text-[10px] text-blue-500 font-bold">더보기</button>
                                    </h3>
                                    <div className="flex gap-3 overflow-x-auto pb-3 -mx-4 px-4 snap-x" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                                        {homePrograms.slice(0, config.count || 10).map(p => (
                                            <div key={p.id} className="min-w-[160px] w-[160px] snap-start">
                                                <ProgramCard
                                                    program={{ ...p, responseStatus: responses[p.id] }}
                                                    onClick={openNoticeDetail}
                                                    compact={true}
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
                                        <span className="flex items-center gap-1">📢 {config.label || '공지사항'}</span>
                                        <button onClick={() => handleTabChange(TAB_NAMES.NOTICES)} className="text-[10px] text-blue-500 font-bold">더보기</button>
                                    </h3>
                                    <div className="space-y-4">
                                        {homeNotices.slice(0, config.count).map(n => (
                                            <motion.div
                                                key={n.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                onClick={() => openNoticeDetail(n)}
                                                className="bg-white p-4 rounded-2xl border-2 border-gray-100 shadow-sm btn-tactile cursor-pointer hover:shadow-md hover:border-blue-200 transition-all"
                                            >
                                                <div className="flex justify-between items-start mb-3">
                                                    <div className="flex items-center gap-2">
                                                        {n.is_sticky && (
                                                            <span className="flex items-center gap-1 px-2.5 py-1 bg-orange-100 text-orange-600 rounded-full text-[10px] font-black shadow-sm whitespace-nowrap shrink-0 animate-pulse">
                                                                <Pin size={10} className="fill-orange-600" /> 공지
                                                            </span>
                                                        )}
                                                        <h3 className={`font-extrabold text-sm leading-tight line-clamp-1 ${n.is_sticky ? 'text-orange-700' : 'text-gray-800'}`}>{n.title}</h3>
                                                    </div>
                                                    {n.is_recruiting && <span className="px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded-full text-[9px] font-black shrink-0">모집중</span>}
                                                </div>
                                                {(n.images?.length > 0 || n.image_url) && (
                                                    <div className="mb-3 rounded-2xl overflow-hidden aspect-square w-full bg-gray-200 border border-gray-100 relative shadow-inner">
                                                        <img src={n.images?.length > 0 ? n.images[0] : n.image_url} alt="thumbnail" className="w-full h-full object-cover" />
                                                        {n.images?.length > 1 && <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-full border border-white/10">+{n.images.length - 1}</div>}
                                                    </div>
                                                )}
                                                <p className="text-xs text-gray-500 line-clamp-2 mb-3 leading-relaxed font-medium">{stripHtml(n.content)}</p>
                                                <div className="flex justify-between items-center text-[10px] text-gray-400 border-t border-gray-200 pt-3 font-bold uppercase tracking-wider">
                                                    <span>{new Date(n.created_at).toLocaleDateString()}</span>
                                                    <span className="flex items-center gap-1 text-blue-500">상세보기 <ChevronRight size={10} /></span>
                                                </div>
                                            </motion.div>
                                        ))}
                                        {homeNotices.length === 0 && <p className="text-center py-4 text-gray-400 text-[10px]">등록된 공지사항이 없습니다</p>}
                                    </div>
                                </div>
                            );
                        default:
                            return null;
                    }
                })}

                {/* Real-time Space Status (공간현황) placed below everything */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-2 mt-2">
                    <h3 className="font-bold text-gray-800 mb-3 flex items-center text-sm gap-2">
                        🟢 {dashboardConfig.find(c => c.id === 'space_status')?.label || '실시간 공간 현황'}
                    </h3>
                    <div className="flex justify-around items-center">
                        {locationGroups
                            .filter(group => group && group.name && group.is_active !== false)
                            .sort((a, b) => {
                                const order = { '하이픈': 1, '이높플레이스': 2 };
                                const orderA = order[a.name] || 999;
                                const orderB = order[b.name] || 999;
                                return orderA - orderB;
                            })
                            .map((group, idx, filteredArr) => (
                                <React.Fragment key={group.id}>
                                    <div className="flex flex-col items-center flex-1">
                                        <p className="text-gray-400 text-[9px] mb-1 font-black uppercase tracking-wider">{group.name}</p>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-2xl font-black text-blue-600 tracking-tighter">
                                                {activeUserCountByGroup[group.id] || 0}
                                            </span>
                                            <span className="text-blue-300 text-[9px] font-black">명</span>
                                        </div>
                                    </div>
                                    {idx < filteredArr.length - 1 && (
                                        <div className="w-px h-8 bg-gray-100" />
                                    )}
                                </React.Fragment>
                            ))}
                    </div>
                </div>
            </div >

        </>
    );
};

export default React.memo(StudentHomeTab);
