import React from 'react';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { Share2, Bell, ShieldCheck, Settings, LogOut, AlertCircle, ChevronRight, User, Image as ImageIcon, Pin, QrCode } from 'lucide-react';
import UserAvatar from '../common/UserAvatar';
import ProgramCard from './ProgramCard';
import { startOfDay } from 'date-fns';
import { TAB_NAMES, CATEGORIES } from '../../constants/appConstants';
import { stripHtml } from '../../utils/textUtils';

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
}) => {
    return (
        <>
            {/* Compact Integrated Header */}
            {/* [COMPACT EFFICIENCY UI] - 여백을 최소화하여 데이터 밀도를 높임 */}
            <header className="bg-primary-gradient p-5 pt-7 pb-5 text-white rounded-b-[2.5rem] shadow-2xl relative overflow-hidden mb-0 gpu-accelerated">
                {/* Subtle Decorative Elements */}
                <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-[60px] animate-float" />
                <div className="absolute bottom-[-10%] left-[-5%] w-48 h-48 bg-indigo-500/20 rounded-full blur-[50px] animate-float [animation-delay:-5s]" />

                <div className="relative z-10 max-w-sm mx-auto">
                    {/* Compact Content Wrapper */}
                    <div className="flex flex-col gap-4">
                        {/* Top: Info & QR Row */}
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <motion.div
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setShowProfileSettings(true)}
                                    className="cursor-pointer p-0.5 bg-white/20 backdrop-blur-md rounded-full shadow-lg ring-2 ring-white/5 shrink-0"
                                >
                                    <UserAvatar user={user} size="w-16 h-16" textSize="text-xl" />
                                </motion.div>
                                <div className="flex flex-col min-w-0">
                                    <p className="text-white/60 text-[10px] font-black tracking-widest uppercase mb-0.5">{user?.school || 'WELCOME'}</p>
                                    <h1 className="text-xl sm:text-2xl font-black tracking-tight leading-tight text-white whitespace-nowrap flex items-center gap-2">
                                        {user?.name} 님!
                                        {user?.is_leader && <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="#FACC15" stroke="#FACC15" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-star"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>}
                                    </h1>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setShowNotificationsModal(true)}
                                    className="bg-white/10 hover:bg-white/20 p-2.5 rounded-full backdrop-blur-md transition-colors relative"
                                >
                                    <Bell size={18} className="text-white" />
                                    {unreadNotificationCount > 0 && (
                                        <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-indigo-500" />
                                    )}
                                </motion.button>
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleShare}
                                    className="bg-white/10 hover:bg-white/20 p-2.5 rounded-full backdrop-blur-md transition-colors"
                                >
                                    <Share2 size={18} className="text-white" />
                                </motion.button>
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setShowEnlargedQr(true)}
                                    className="bg-white p-2.5 rounded-full shadow-lg flex items-center justify-center cursor-pointer border-2 border-white/20"
                                >
                                    <QrCode size={18} className="text-blue-600" />
                                </motion.button>
                            </div>
                        </div>

                        {/* Bottom: Compact Action Buttons */}
                        <div className="flex gap-2">
                            {user?.role === 'admin' && (
                                <button
                                    onClick={() => navigate('/admin')}
                                    className="flex-1 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-xl transition-all btn-tactile border border-white/5 backdrop-blur-md"
                                >
                                    <ShieldCheck size={20} className="text-white" />
                                </button>
                            )}
                            <button
                                onClick={() => setShowProfileSettings(true)}
                                className="flex-1 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-xl transition-all btn-tactile border border-white/5 backdrop-blur-md"
                            >
                                <Settings size={20} className="text-white" />
                            </button>
                            <button
                                onClick={() => { localStorage.removeItem('user'); localStorage.removeItem('admin_user'); navigate('/'); }}
                                className="flex-1 h-10 flex items-center justify-center bg-white/10 hover:bg-red-500/30 rounded-xl transition-all btn-tactile border border-white/5 group backdrop-blur-md"
                            >
                                <LogOut size={20} className="text-white/80 group-hover:text-white" />
                            </button>
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

            <div className="p-2.5 pt-2.5 pb-10 space-y-2.5 relative z-0">
                {dashboardConfig.map((config) => {
                    if (!config.isVisible) return null;

                    switch (config.id) {
                        case 'stats':
                            return (
                                <div key="stats" className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-around mb-2">
                                    <div className="flex flex-col items-center flex-1">
                                        <p className="text-gray-400 text-[9px] mb-1 font-black uppercase tracking-wider">이용시간</p>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-2xl font-black text-blue-600 tracking-tighter">{totalHours}</span>
                                            <span className="text-blue-300 text-[9px] font-black">시간</span>
                                        </div>
                                    </div>

                                    <div className="w-px h-8 bg-gray-100" />

                                    <div className="flex flex-col items-center flex-1">
                                        <p className="text-gray-400 text-[9px] mb-1 font-black uppercase tracking-wider">방문 수</p>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-2xl font-black text-indigo-600 tracking-tighter">{visitCount}</span>
                                            <span className="text-indigo-200 text-[9px] font-black">일</span>
                                        </div>
                                    </div>

                                    <div className="w-px h-8 bg-gray-100" />

                                    <button onClick={() => setShowProgramHistory(true)} className="flex flex-col items-center flex-1 group active:scale-95 transition-transform">
                                        <p className="text-gray-400 text-[9px] mb-1 font-black uppercase tracking-wider flex items-center gap-1 group-hover:text-pink-400 transition-colors">
                                            프로그램 <ChevronRight size={8} />
                                        </p>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-2xl font-black text-pink-500 tracking-tighter">{programCount}</span>
                                            <span className="text-pink-200 text-[9px] font-black">회</span>
                                        </div>
                                    </button>
                                </div>
                            );

                        case 'programs':
                            return (
                                <div key="programs" className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                                    <h3 className="font-bold text-gray-800 mb-3 flex justify-between items-center text-sm">
                                        🔥 프로그램 신청
                                        <button onClick={() => handleTabChange(TAB_NAMES.PROGRAMS)} className="text-[10px] text-blue-500 font-bold">더보기</button>
                                    </h3>
                                    <div className="flex gap-3 overflow-x-auto pb-3 -mx-4 px-4 snap-x" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                                        {homePrograms.slice(0, config.count).map(p => (
                                            <div key={p.id} className="min-w-[240px] w-[240px] snap-center">
                                                <ProgramCard
                                                    program={{ ...p, responseStatus: responses[p.id] }}
                                                    onClick={openNoticeDetail}
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
                                        📢 공지사항
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
                        🟢 실시간 공간 현황
                    </h3>
                    <div className="flex justify-around items-center">
                        {locationGroups.map((group, idx) => (
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
                                {idx < locationGroups.length - 1 && (
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
