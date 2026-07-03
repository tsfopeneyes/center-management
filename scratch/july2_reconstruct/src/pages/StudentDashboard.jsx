import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Home, Calendar, BookOpen, Award, Store, MessageSquareHeart, Menu, X, Settings, ShieldCheck, LogOut, Bell, Share2, QrCode } from 'lucide-react';
import { TAB_NAMES } from '../constants/appConstants';
import { useStudentDashboard } from '../hooks/useStudentDashboard';

// Tabs
import StudentHomeTab from '../components/student/StudentHomeTab';
import StudentChallengesTab from '../components/student/StudentChallengesTab';
import StudentProgramsTab from '../components/student/StudentProgramsTab';
import StudentNoticesTab from '../components/student/StudentNoticesTab';
import StudentGuestbookTab from '../components/student/StudentGuestbookTab';
import StudentCalendarTab from '../components/student/StudentCalendarTab';
import CommunityTab from '../components/community/CommunityTab';
import StudentChat from '../components/student/StudentChat';
import StudentHyphenTab from '../components/student/StudentHyphenTab';
import StudentAzitTab from '../components/student/StudentAzitTab';
import { userApi } from '../api/userApi';
import { noticesApi } from '../api/noticesApi';
import UserAvatar from '../components/common/UserAvatar';

// Extracted Modals
import NoticeModal from '../components/student/NoticeModal';
import { BadgeModal } from '../components/student/BadgeComponents';
import ProfileSettingsModal from '../components/student/modals/ProfileSettingsModal';
import GuestbookWriteModal from '../components/student/modals/GuestbookWriteModal';
import GuestbookDetailModal from '../components/student/modals/GuestbookDetailModal';
import NotificationsModal from '../components/student/modals/NotificationsModal';
import ProgramHistoryModal from '../components/student/modals/ProgramHistoryModal';
import QRModal from '../components/student/modals/QRModal';
import VerificationWriteModal from '../components/student/modals/VerificationWriteModal';
import { useFCM } from '../hooks/useFCM';

const StudentDashboard = () => {
    const hookData = useStudentDashboard();
    
    // 푸쉬 알림 권한 획득 및 토큰 저장 훅 실행
    useFCM(hookData.user);

    // Destructure everything used in the JSX
    const {
        loading, user, activeTab, setActiveTab,
        showProfileSettings, setShowProfileSettings,
        showGuestWrite, setShowGuestWrite,
        selectedGuestPost, setSelectedGuestPost,
        showProgramHistory, setShowProgramHistory,
        showEnlargedQr, setShowEnlargedQr,
        showNotificationsModal, setShowNotificationsModal,
        selectedBadge, setSelectedBadge,
        noticeContext, setNoticeContext, selectedNotice, setSelectedNotice,
        comments, newComment, setNewComment, handlePostComment, handleDeleteComment,
        handleShare, handleTabChange, openNoticeDetail, markNotificationsAsRead, handleLogout,
        notices, responses, responseDetails, handleResponse, fetchNotices, filteredNotices, filteredPrograms, allPrograms,
        homeNotices, homePrograms, studentRegion, locationGroups, activeUserCountByGroup,
        totalHours, visitCount, programCount, attendedProgramsList,
        challengeCategories, dynamicChallenges, specialStats,
        adminSchedules, calendarCategories, dashboardConfig, tabConfig,
        notifications, unreadNotificationCount, updateProfile, profileLoadingState,
        guestPosts, uploadingGuest, handleCreatePost, fetchGuestCommentsData, handleGuestCommentSubmit, handleDeleteGuestPost, handleDeleteGuestComment
    } = hookData;

    const [showVerificationWrite, setShowVerificationWrite] = useState(false);
    const [editVerificationPost, setEditVerificationPost] = useState(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [showMenuDrawer, setShowMenuDrawer] = useState(false);
    const [hideMainHeader, setHideMainHeader] = useState(false);

    const navigate = useNavigate();

    // B안: 뒤로가기 시 이전 탭으로 화면 전환을 위해 History API 연동 (학생용)
    useEffect(() => {
        // 첫 진입 시 현재 상태를 히스토리에 기재
        window.history.replaceState({ tab: activeTab }, '');

        const handlePopState = (event) => {
            if (event.state && event.state.tab) {
                handleTabChange(event.state.tab);
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    // activeTab이 변경될 때마다 새로운 히스토리 항목 추가 (동일한 탭 연속 중복 추가 방지)
    useEffect(() => {
        if (window.history.state?.tab !== activeTab) {
            window.history.pushState({ tab: activeTab }, '');
        }
    }, [activeTab]);

    useEffect(() => {
        setHideMainHeader(false);
    }, [activeTab]);

    // 탭 트랜지션 및 스와이프 내비게이션 핸들러
    const [direction, setDirection] = useState(0);
    const [touchStartX, setTouchStartX] = useState(null);
    const [touchEndX, setTouchEndX] = useState(null);
    const [touchStartY, setTouchStartY] = useState(null);
    const [touchEndY, setTouchEndY] = useState(null);

    const activeVisibleTabs = (tabConfig || []).filter(t => t.isVisible);
    const TAB_SEQUENCE = activeVisibleTabs.length > 0 
        ? activeVisibleTabs.map(t => t.id)
        : [TAB_NAMES.HOME, TAB_NAMES.CHALLENGES, TAB_NAMES.PROGRAMS, TAB_NAMES.CALENDAR, TAB_NAMES.AZIT, TAB_NAMES.HYPHEN];

    const tabIconMap = {
        [TAB_NAMES.HOME]: { icon: Home, defaultLabel: '홈' },
        [TAB_NAMES.CHALLENGES]: { icon: Award, defaultLabel: '챌린지' },
        [TAB_NAMES.PROGRAMS]: { icon: BookOpen, defaultLabel: '프로그램', activeColor: 'text-blue-600' },
        [TAB_NAMES.CALENDAR]: { icon: Calendar, defaultLabel: '캘린더' },
        [TAB_NAMES.AZIT]: { icon: MessageSquareHeart, defaultLabel: '커뮤니티' },
        [TAB_NAMES.HYPHEN]: { icon: Store, defaultLabel: '하이픈' }
    };
    const visibleTabs = (tabConfig || [])
        .filter(t => t.isVisible)
        .map(t => {
            const mapItem = tabIconMap[t.id];
            if (!mapItem) return null;
            return {
                id: t.id,
                icon: mapItem.icon,
                label: t.label || mapItem.defaultLabel,
                activeColor: mapItem.activeColor
            };
        })
        .filter(Boolean);

    const defaultTabsList = [
        { id: TAB_NAMES.HOME, icon: Home, label: '홈' },
        { id: TAB_NAMES.CHALLENGES, icon: Award, label: '챌린지' },
        { id: TAB_NAMES.PROGRAMS, icon: BookOpen, label: '프로그램', activeColor: 'text-blue-600' },
        { id: TAB_NAMES.CALENDAR, icon: Calendar, label: '캘린더' },
        { id: TAB_NAMES.AZIT, icon: MessageSquareHeart, label: '커뮤니티' },
        { id: TAB_NAMES.HYPHEN, icon: Store, label: '하이픈' }
    ];

    const navigationTabs = visibleTabs.length > 0 ? visibleTabs : defaultTabsList;

    const handleTabNavigation = (newTab) => {
        if (newTab === activeTab) return;
        const currentIndex = TAB_SEQUENCE.indexOf(activeTab);
        const newIndex = TAB_SEQUENCE.indexOf(newTab);
        
        let dir = newIndex > currentIndex ? 1 : -1;
        // 배열에 없는 탭(예: 공지사항 등)에서 이동할 땐 기본 우측 슬라이드
        if (currentIndex === -1 || newIndex === -1) dir = 1;
        
        setDirection(dir);
        handleTabChange(newTab);
    };

    const tabVariants = {
        enter: (direction) => ({
            x: direction > 0 ? '20%' : '-20%',
            opacity: 0,
        }),
        center: {
            x: 0,
            opacity: 1,
        },
        exit: (direction) => ({
            x: direction < 0 ? '20%' : '-20%',
            opacity: 0,
        })
    };

    const onTouchStart = (e) => {
        // 좌우 스크롤 객체나 입력창, 이모지 피커 등을 터치한 경우 스와이프 무시
        if (e.target.closest('.no-swipe, .overflow-x-auto, .overflow-x-scroll, .em-emoji-picker, textarea, input, button')) return;
        setTouchEndX(null);
        setTouchEndY(null);
        setTouchStartX(e.targetTouches[0].clientX);
        setTouchStartY(e.targetTouches[0].clientY);
    };

    const onTouchMove = (e) => {
        setTouchEndX(e.targetTouches[0].clientX);
        setTouchEndY(e.targetTouches[0].clientY);
    };

    const onTouchEnd = () => {
        if (!touchStartX || !touchEndX || !touchStartY || !touchEndY) return;

        const distanceX = touchStartX - touchEndX;
        const distanceY = touchStartY - touchEndY;
        
        // 민감도 조절: X축 거리가 70px 이상일 때 스와이프로 인정
        const minSwipeDistance = 70;

        // Y축 스크롤(세로)보다 X축 스와이프(가로)가 더 크면서, 최소 거리 조건을 만족할 때
        if (Math.abs(distanceX) > Math.abs(distanceY) && Math.abs(distanceX) > minSwipeDistance) {
            const isLeftSwipe = distanceX > minSwipeDistance;
            
            const currentIndex = TAB_SEQUENCE.indexOf(activeTab);
            if (currentIndex === -1) return;

            // 좌측 스와이프(손가락을 왼쪽으로 밈) -> 오른쪽 탭으로 이동
            if (isLeftSwipe && currentIndex < TAB_SEQUENCE.length - 1) {
                handleTabNavigation(TAB_SEQUENCE[currentIndex + 1]);
            } 
            // 우측 스와이프(손가락을 오른쪽으로 밈) -> 왼쪽 탭으로 이동
            else if (!isLeftSwipe && currentIndex > 0) {
                handleTabNavigation(TAB_SEQUENCE[currentIndex - 1]);
            }
        }
        
        setTouchStartX(null);
        setTouchEndX(null);
        setTouchStartY(null);
        setTouchEndY(null);
    };

    // 탭 변경 시 화면 스크롤을 최상단으로 이동
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [activeTab]);

    const openGuestPostDetail = async (post) => {
        hookData.setSelectedGuestPost(post);
        const data = await hookData.fetchGuestCommentsData(post.id);
        hookData.setGuestComments(data);
    };

    const handleDeletePostWrapper = async (postId) => {
        if (!window.confirm("정말로 삭제하시겠습니까? 지급된 하이픈도 반환됩니다.")) return;
        const success = await hookData.handleDeleteGuestPost(postId);
        if (success) {
            hookData.setSelectedGuestPost(null);
            userApi.fetchUser(user.id).then(u => {
                if (u) hookData.setUser(prev => ({ ...prev, ...u }));
            });
            setRefreshTrigger(prev => prev + 1);
        }
    };

    if (loading || !user) {
        return (
            <div className="w-full md:max-w-lg mx-auto min-h-screen bg-tossGrey50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-tossBlue border-t-transparent rounded-full animate-spin" />
                    <p className="text-gray-400 font-bold animate-pulse">정보를 불러오는 중...</p>
                </div>
            </div>
        );
    }

    return (
        <div 
            className="w-full md:max-w-lg mx-auto min-h-screen bg-tossGrey50 pb-20 font-sans transition-all duration-300 pt-[max(env(safe-area-inset-top),0px)]"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
        >
            
            {/* Verification Write Modal */}
            {showVerificationWrite && (
                <VerificationWriteModal
                    setShowVerificationWrite={setShowVerificationWrite}
                    handleCreatePost={hookData.handleCreatePost}
                    handleUpdatePost={hookData.handleUpdatePost}
                    uploadingGuest={hookData.uploadingGuest}
                    editPost={editVerificationPost}
                    onSuccess={() => {
                        setEditVerificationPost(null);
                        setShowVerificationWrite(false);
                        userApi.fetchUser(user.id).then(u => {
                            if (u) hookData.setUser(prev => ({ ...prev, ...u }));
                        });
                        setRefreshTrigger(prev => prev + 1);
                    }}
                />
            )}

            {/* Modals & Overlays */}
            <AnimatePresence>
                {selectedNotice && (
                    <NoticeModal
                        key={selectedNotice.id}
                        notice={selectedNotice}
                        context={noticeContext}
                        onClose={() => { setSelectedNotice(null); setNoticeContext(null); }}
                        user={user}
                        responses={responses}
                        onResponse={handleResponse}
                        comments={comments}
                        newComment={newComment}
                        setNewComment={setNewComment}
                        onPostComment={handlePostComment}
                        onDeleteComment={handleDeleteComment}
                        onUpdate={async (updatedNotice) => {
                            try {
                                await noticesApi.update(updatedNotice.id, updatedNotice);
                                alert('성공적으로 수정되었습니다.');
                                fetchNotices();
                                setSelectedNotice({ ...selectedNotice, ...updatedNotice });
                            } catch (e) {
                                console.error(e);
                                alert('수정 중 오류가 발생했습니다.');
                            }
                        }}
                        onDelete={async (noticeId) => {
                            if (window.confirm('정말로 이 게시물을 삭제하시겠습니까?')) {
                                try {
                                    await noticesApi.delete(noticeId);
                                    alert('성공적으로 삭제되었습니다.');
                                    fetchNotices();
                                    setSelectedNotice(null);
                                } catch (e) {
                                    console.error(e);
                                    alert('삭제 중 오류가 발생했습니다.');
                                }
                            }
                        }}
                    />
                )}

                {selectedBadge && (
                    <BadgeModal
                        badge={selectedBadge}
                        stats={{ visitCount, programCount, specialStats }}
                        onClose={() => setSelectedBadge(null)}
                    />
                )}

                {showProfileSettings && (
                    <ProfileSettingsModal 
                        user={user}
                        setShowProfileSettings={setShowProfileSettings}
                        updateProfile={updateProfile}
                        profileLoadingState={profileLoadingState}
                    />
                )}

                {showGuestWrite && (
                    <GuestbookWriteModal 
                        setShowGuestWrite={setShowGuestWrite}
                        handleCreatePost={handleCreatePost}
                        uploadingGuest={uploadingGuest}
                    />
                )}

                {selectedGuestPost && (
                    <GuestbookDetailModal 
                        selectedGuestPost={hookData.selectedGuestPost}
                        guestComments={hookData.guestComments || []}
                        fetchGuestCommentsData={hookData.fetchGuestCommentsData}
                        user={user}
                        onDeleteGuestPost={handleDeletePostWrapper}
                        onDeleteGuestComment={hookData.handleDeleteGuestComment}
                        handleGuestCommentSubmit={hookData.handleGuestCommentSubmit}
                        setGuestComments={hookData.setGuestComments} 
                        setSelectedGuestPost={hookData.setSelectedGuestPost}
                        onEditPost={(post) => {
                            hookData.setSelectedGuestPost(null);
                            setEditVerificationPost(post);
                            setShowVerificationWrite(true);
                        }}
                    />
                )}

                {showEnlargedQr && (
                    <QRModal 
                        user={user} 
                        setShowEnlargedQr={setShowEnlargedQr} 
                    />
                )}

                {showNotificationsModal && (
                    <NotificationsModal 
                        notifications={notifications}
                        setShowNotificationsModal={setShowNotificationsModal}
                        markNotificationsAsRead={markNotificationsAsRead}
                    />
                )}

                {showProgramHistory && (
                    <ProgramHistoryModal 
                        attendedProgramsList={attendedProgramsList}
                        setShowProgramHistory={setShowProgramHistory}
                    />
                )}

                {showMenuDrawer && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            key="menu-drawer-backdrop"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowMenuDrawer(false)}
                            className="fixed inset-0 bg-black/40 z-[200] backdrop-blur-[2px]"
                        />

                        {/* Drawer Panel */}
                        <motion.div
                            key="menu-drawer-panel"
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'tween', duration: 0.25, ease: 'easeInOut' }}
                            className="fixed top-0 bottom-0 left-0 md:left-[calc(50vw-256px)] w-64 bg-white z-[210] shadow-toss-elevated flex flex-col pt-[max(env(safe-area-inset-top),16px)] pb-[max(env(safe-area-inset-bottom),16px)] border-r border-tossGrey200"
                        >
                            {/* Drawer Header */}
                            <div className="p-4 border-b border-tossGrey100 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-tossBlueLight flex items-center justify-center text-tossBlue">
                                        <Home size={16} />
                                    </div>
                                    <span className="font-bold text-tossBlue tracking-tight text-sm select-none">SCI CENTER</span>
                                </div>
                                <motion.button
                                    whileTap={{ scale: 0.9 }}
                                    onClick={() => setShowMenuDrawer(false)}
                                    className="p-1.5 text-tossGrey500 hover:text-tossGrey800 hover:bg-tossGrey100 rounded-lg transition-colors"
                                >
                                    <X size={20} />
                                </motion.button>
                            </div>

                            {/* Mini Profile */}
                            <div className="p-5 bg-tossGrey50 border-b border-tossGrey100 flex items-center gap-3">
                                <div className="shrink-0 ring-2 ring-white shadow-toss-subtle rounded-full">
                                    <UserAvatar user={user} size="w-12 h-12" textSize="text-md" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] text-tossGrey500 font-bold tracking-wider uppercase mb-0.5">{user?.school || 'WELCOME'}</p>
                                    <h3 className="font-bold text-tossGrey900 text-sm flex items-center gap-1">
                                        {user?.name} 님
                                        {user?.is_leader && <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="#FACC15" stroke="#FACC15" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-star"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>}
                                    </h3>
                                </div>
                            </div>

                            {/* Menu Body */}
                            <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                                <p className="px-4 py-1 text-[10px] text-tossGrey500 font-bold tracking-wider uppercase">바로가기</p>
                                
                                {navigationTabs.map((tab) => {
                                    const IconComponent = tab.icon;
                                    const isActive = activeTab === tab.id;
                                    return (
                                        <button
                                            key={`drawer-tab-${tab.id}`}
                                            onClick={() => {
                                                handleTabNavigation(tab.id);
                                                setShowMenuDrawer(false);
                                            }}
                                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-toss-lg text-left font-bold text-sm transition-all ${
                                                isActive
                                                    ? 'bg-tossBlueLight text-tossBlue'
                                                    : 'text-tossGrey700 hover:bg-tossGrey100'
                                            }`}
                                        >
                                            <IconComponent size={18} className={isActive ? 'text-tossBlue' : 'text-tossGrey500'} />
                                            <span>{tab.label}</span>
                                        </button>
                                    );
                                })}

                                <div className="h-px bg-tossGrey100 my-2" />
                                <p className="px-4 py-1 text-[10px] text-tossGrey500 font-bold tracking-wider uppercase">사용자 설정</p>

                                <button
                                    onClick={() => {
                                        setShowProfileSettings(true);
                                        setShowMenuDrawer(false);
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-3 rounded-toss-lg text-left font-bold text-sm text-tossGrey700 hover:bg-tossGrey100 transition-all"
                                >
                                    <Settings size={18} className="text-tossGrey500" />
                                    <span>설정</span>
                                </button>

                                {user?.role === 'admin' && (
                                    <button
                                        onClick={() => {
                                            navigate('/admin');
                                            setShowMenuDrawer(false);
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-3 rounded-toss-lg text-left font-bold text-sm text-tossBlue hover:bg-tossBlueLight transition-all"
                                    >
                                        <ShieldCheck size={18} className="text-tossBlue" />
                                        <span>관리자 페이지</span>
                                    </button>
                                )}
                            </div>

                            {/* Menu Footer */}
                            <div className="p-4 border-t border-tossGrey100">
                                <button
                                    onClick={() => {
                                        setShowMenuDrawer(false);
                                        handleLogout();
                                    }}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 border border-tossError/20 text-tossError rounded-toss-lg font-bold text-sm hover:bg-tossError/5 transition-colors"
                                >
                                    <LogOut size={16} />
                                    <span>로그아웃</span>
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                    key={activeTab}
                    custom={direction}
                    variants={tabVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{
                        x: { type: "tween", duration: 0.25, ease: "easeOut" },
                        opacity: { duration: 0.2 }
                    }}
                    className="w-full"
                >
                    {activeTab === TAB_NAMES.HOME && (
                <StudentHomeTab
                    user={user}
                    unreadNotificationCount={unreadNotificationCount}
                    setShowProfileSettings={setShowProfileSettings}
                    setShowNotificationsModal={setShowNotificationsModal}
                    handleShare={handleShare}
                    setShowEnlargedQr={setShowEnlargedQr}
                    navigate={navigate}
                    adminSchedules={adminSchedules}
                    calendarCategories={calendarCategories}
                    dashboardConfig={dashboardConfig}
                    totalHours={totalHours}
                    visitCount={visitCount}
                    programCount={programCount}
                    setShowProgramHistory={setShowProgramHistory}
                    handleTabChange={handleTabChange}
                    handleLogout={handleLogout}
                    homePrograms={homePrograms}
                    responses={responses}
                    openNoticeDetail={openNoticeDetail}
                    homeNotices={homeNotices}
                    locationGroups={locationGroups}
                    activeUserCountByGroup={activeUserCountByGroup}
                    dynamicChallenges={dynamicChallenges}
                    specialStats={specialStats}
                    studentRegion={studentRegion}
                />
            )}

            {activeTab === TAB_NAMES.CHALLENGES && (
                <StudentChallengesTab
                    dynamicChallenges={dynamicChallenges}
                    challengeCategories={challengeCategories}
                    visitCount={visitCount}
                    programCount={programCount}
                    specialStats={specialStats}
                    setSelectedBadge={setSelectedBadge}
                />
            )}

            {activeTab === TAB_NAMES.PROGRAMS && (
                <StudentProgramsTab
                    filteredPrograms={filteredPrograms}
                    allPrograms={allPrograms}
                    responses={responses}
                    responseDetails={responseDetails}
                    openNoticeDetail={openNoticeDetail}
                />
            )}

            {activeTab === TAB_NAMES.NOTICES && (
                <StudentNoticesTab
                    filteredNotices={filteredNotices}
                    openNoticeDetail={openNoticeDetail}
                />
            )}

            {activeTab === TAB_NAMES.MESSAGES && (
                <StudentChat currentUser={user} onRefreshUnread={() => { }} onSubViewToggle={setHideMainHeader} />
            )}

            {activeTab === TAB_NAMES.GUESTBOOK && (
                <StudentGuestbookTab
                    guestPosts={guestPosts}
                    openGuestPostDetail={openGuestPostDetail}
                    setShowGuestWrite={setShowGuestWrite}
                />
            )}

            {activeTab === TAB_NAMES.CALENDAR && (
                <StudentCalendarTab
                    adminSchedules={adminSchedules}
                    notices={filteredPrograms}
                    calendarCategories={calendarCategories}
                    openNoticeDetail={openNoticeDetail}
                    studentRegion={studentRegion}
                />
            )}

            {activeTab === TAB_NAMES.COMMUNITY && (
                <CommunityTab user={user} />
            )}

            {activeTab === TAB_NAMES.AZIT && (
                <StudentAzitTab user={user} />
            )}

            {activeTab === TAB_NAMES.HYPHEN && (
                <StudentHyphenTab 
                    user={user} 
                    handleCreatePost={hookData.handleCreatePost}
                    handleUpdatePost={hookData.handleUpdatePost}
                    handleDeleteGuestPost={hookData.handleDeleteGuestPost}
                    uploadingGuest={hookData.uploadingGuest}
                    openGuestPostDetail={openGuestPostDetail}
                    setShowVerificationWrite={setShowVerificationWrite}
                    setEditVerificationPost={setEditVerificationPost}
                    refreshTrigger={refreshTrigger}
                    notifyParentRefresh={() => {
                        userApi.fetchUser(user.id).then(u => {
                            if (u) hookData.setUser(prev => ({ ...prev, ...u }));
                        });
                    }}
                />
            )}
                </motion.div>
            </AnimatePresence>

            {/* Bottom Navigation */}
            <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full md:max-w-lg bg-white border-t border-tossGrey200 flex justify-around items-center px-4 py-3 z-[120] safe-area-bottom">
                {navigationTabs.map((tab) => (
                    <motion.button
                        key={tab.id}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleTabNavigation(tab.id)}
                        className={`flex flex-col items-center gap-1 p-2 transition-all duration-300 flex-1 relative btn-tactile ${activeTab === tab.id ? 'text-tossBlue' : 'text-tossGrey400'}`}
                    >
                        <tab.icon size={22} strokeWidth={activeTab === tab.id ? 2.2 : 1.8} />
                        <span className={`text-[11px] font-medium tracking-tight mt-1 ${activeTab === tab.id ? 'text-tossBlue' : 'text-tossGrey500'}`}>
                            {tab.label}
                        </span>
                        {activeTab === tab.id && (
                            <motion.div
                                layoutId="activeTabPill"
                                className="absolute -top-1 w-1.5 h-1.5 rounded-full bg-tossBlue"
                            />
                        )}
                    </motion.button>
                ))}
            </div>
        </div>
    );
};

export default StudentDashboard;
