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
    specialStats,
    studentRegion
}) => {
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
                                {user?.role === 'admin' ? (
                                    <button 
                                        onClick={() => navigate('/admin')}
                                        className="flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all px-3 py-1.5 rounded-full border border-blue-400/20 shadow-md text-white font-extrabold text-[12px] group"
                                    >
                                        <ShieldCheck size={14} className="text-white shrink-0 group-hover:scale-110 transition-transform" />
                                        <span>관리자 모드</span>
                                    </button>
                                ) : (
                                    <button 
                                        onClick={() => handleTabChange(TAB_NAMES.HYPHEN)}
                                        className="flex items-center gap-1 bg-white/20 hover:bg-white/30 transition-colors backdrop-blur-md px-2.5 py-1 rounded-full border border-white/30 shadow-sm"
                                    >
                                        <div className="w-4 h-4 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center text-white text-[9px] font-black shadow-sm leading-none shrink-0 border border-amber-300">H</div>
                                        <span className="font-extrabold text-[13px] sm:text-[14px] text-white tracking-tight">{user?.current_hyphen || 0}</span>
                                    </button>
                                )}
                                
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

            {/* Main Content Area: Aligned Stack */}
            <div className="px-4 py-4 pb-28 space-y-4 relative z-0">
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
                            className="p-4 rounded-[24px] bg-red-50/80 backdrop-blur-md border border-red-100 shadow-sm flex items-center justify-center relative overflow-hidden"
                        >
                            <div className="flex items-center gap-2">
                                <AlertCircle size={18} strokeWidth={3} className="text-red-600 animate-pulse" />
                                <p className="text-red-700 font-black text-[15px] tracking-wide">{message}</p>
                            </div>
                        </motion.div>
                    );
                })()}

                {/* Today Operating Widget */}
                <TodayOperatingWidget studentRegion={studentRegion} />

                {/* Dynamic Dashboard Widgets */}
                {dashboardConfig.map((config) => {
                    if (!config.isVisible) return null;

                    switch (config.id) {
                        case 'stats':
                            // 통계는 이제 헤더 영역(프로필 카드 내부)에 통합되어 표시됩니다.
                            return null;

                        case 'programs':
                            return (
                                <div key="programs" className="bg-white p-5 rounded-[24px] border border-gray-100 shadow-[0_4px_16px_rgba(0,0,0,0.02)]">
                                    <h3 className="font-extrabold text-gray-800 mb-3.5 flex justify-between items-center text-sm">
                                        <span className="flex items-center gap-1.5 text-slate-800">🔥 {config.label || '프로그램 신청'}</span>
                                        <button onClick={() => handleTabChange(TAB_NAMES.PROGRAMS)} className="text-[11px] text-blue-500 font-extrabold px-2 py-1 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">더보기</button>
                                    </h3>
                                    <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 snap-x no-swipe" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                                        {homePrograms.slice(0, config.count || 10).map(p => (
                                            <div key={p.id} className="min-w-[160px] w-[160px] snap-start">
                                                <ProgramCard
                                                    program={{ ...p, responseStatus: responses[p.id] }}
                                                    onClick={openNoticeDetail}
                                                    compact={true}
                                                />
                                            </div>
                                        ))}
                                        {homePrograms.length === 0 && <p className="text-center py-6 text-gray-400 text-xs w-full">신청 가능한 프로그램이 없습니다</p>}
                                    </div>
                                </div>
                            );
                        case 'notices':
                            return (
                                <div key="notices" className="bg-white p-5 rounded-[24px] border border-gray-100 shadow-[0_4px_16px_rgba(0,0,0,0.02)]">
                                    <h3 className="font-extrabold text-gray-800 mb-2 flex justify-between items-center text-sm">
                                        <span className="flex items-center gap-1.5 text-slate-800">📢 {config.label || '공지사항'}</span>
                                        <button onClick={() => handleTabChange(TAB_NAMES.NOTICES)} className="text-[11px] text-blue-500 font-extrabold px-2 py-1 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">더보기</button>
                                    </h3>
                                    <div className="divide-y divide-gray-50">
                                        {homeNotices.slice(0, config.count).map(n => (
                                            <motion.div
                                                key={n.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                onClick={() => openNoticeDetail(n)}
                                                className="py-3.5 first:pt-2 last:pb-0 cursor-pointer group flex justify-between items-start gap-4"
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                                        {n.is_sticky && (
                                                            <span className="flex items-center gap-0.5 px-2 py-0.5 bg-orange-50 text-orange-600 rounded-full text-[9px] font-black shadow-sm whitespace-nowrap shrink-0 animate-pulse">
                                                                <Pin size={8} className="fill-orange-600" /> 공지
                                                            </span>
                                                        )}
                                                        {n.is_recruiting && (
                                                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full text-[9px] font-black shrink-0">
                                                                모집중
                                                            </span>
                                                        )}
                                                        <span className="text-[10px] text-gray-400 font-bold">{new Date(n.created_at).toLocaleDateString()}</span>
                                                    </div>
                                                    <h4 className="font-extrabold text-sm text-gray-800 group-hover:text-blue-600 transition-colors line-clamp-1 mb-1 leading-snug">{n.title}</h4>
                                                    <p className="text-xs text-gray-500 font-medium line-clamp-2 leading-relaxed">{stripHtml(n.content)}</p>
                                                </div>
                                                
                                                {(n.images?.length > 0 || n.image_url) && (
                                                    <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gray-50 shrink-0 border border-gray-100 relative shadow-inner">
                                                        <img src={n.images?.length > 0 ? n.images[0] : n.image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                                    </div>
                                                )}
                                            </motion.div>
                                        ))}
                                        {homeNotices.length === 0 && <p className="text-center py-6 text-gray-400 text-xs">등록된 공지사항이 없습니다</p>}
                                    </div>
                                </div>
                            );
                        default:
                            return null;
                    }
                })}

                {/* Real-time Space Status (공간현황) placed below everything */}
                <div className="bg-white p-5 rounded-[24px] border border-gray-100 shadow-[0_4px_16px_rgba(0,0,0,0.02)]">
                    <h3 className="font-extrabold text-gray-800 mb-3.5 flex items-center text-sm gap-1.5 text-slate-800">
                        <span>🟢</span>
                        <span>{dashboardConfig.find(c => c.id === 'space_status')?.label || '실시간 공간 현황'}</span>
                    </h3>
                    <div className="flex justify-around items-center bg-gray-50/50 p-4 rounded-2xl border border-gray-100/50">
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
                                        <p className="text-gray-400 text-[10px] mb-1 font-black uppercase tracking-wider">{group.name}</p>
                                        <div className="flex items-baseline gap-0.5">
                                            <span className="text-2xl font-black text-blue-600 tracking-tighter">
                                                {activeUserCountByGroup[group.id] || 0}
                                            </span>
                                            <span className="text-blue-400 text-[10px] font-extrabold">명</span>
                                        </div>
                                    </div>
                                    {idx < filteredArr.length - 1 && (
                                        <div className="w-px h-8 bg-gray-200" />
                                    )}
                                </React.Fragment>
                            ))}
                    </div>
                </div>
            </div>

        </>
    );
};

export default React.memo(StudentHomeTab);
