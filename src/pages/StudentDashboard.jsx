import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Home, Calendar, BookOpen, Award, Store, MessageSquareHeart } from 'lucide-react';
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
        notices, responses, responseDetails, handleResponse, filteredNotices, filteredPrograms, allPrograms,
        homeNotices, homePrograms, studentRegion, locationGroups, activeUserCountByGroup,
        totalHours, visitCount, programCount, attendedProgramsList,
        challengeCategories, dynamicChallenges, specialStats,
        adminSchedules, calendarCategories, dashboardConfig,
        notifications, unreadNotificationCount, updateProfile, profileLoadingState,
        guestPosts, uploadingGuest, handleCreatePost, fetchGuestCommentsData, handleGuestCommentSubmit, handleDeleteGuestPost, handleDeleteGuestComment
    } = hookData;

    const [showVerificationWrite, setShowVerificationWrite] = useState(false);
    const [editVerificationPost, setEditVerificationPost] = useState(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const navigate = useNavigate();

    // 탭 트랜지션 및 스와이프 내비게이션 핸들러
    const [direction, setDirection] = useState(0);
    const [touchStartX, setTouchStartX] = useState(null);
    const [touchEndX, setTouchEndX] = useState(null);
    const [touchStartY, setTouchStartY] = useState(null);
    const [touchEndY, setTouchEndY] = useState(null);

    const TAB_SEQUENCE = [
        TAB_NAMES.HOME,
        TAB_NAMES.CHALLENGES,
        TAB_NAMES.PROGRAMS,
        TAB_NAMES.CALENDAR,
        TAB_NAMES.AZIT, // 커뮤니티 (Azit)
        TAB_NAMES.HYPHEN // 하이픈
    ];

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
            <div className="w-full md:max-w-lg mx-auto min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-gray-400 font-bold animate-pulse">정보를 불러오는 중...</p>
                </div>
            </div>
        );
    }

    return (
        <div 
            className="w-full md:max-w-lg mx-auto min-h-screen bg-gray-50 pb-20 font-sans pt-[max(env(safe-area-inset-top),10px)]"
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
                <StudentChat currentUser={user} onRefreshUnread={() => { }} />
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
            <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full md:max-w-lg bg-white/95 backdrop-blur-xl border-t border-gray-100 flex justify-around items-center px-4 py-3 z-[120] safe-area-bottom shadow-[0_-10px_30px_rgba(0,0,0,0.08)] rounded-t-[2.5rem]">
                {[
                    { id: TAB_NAMES.HOME, icon: Home, label: '홈' },
                    { id: TAB_NAMES.CHALLENGES, icon: Award, label: '챌린지' },
                    { id: TAB_NAMES.PROGRAMS, icon: BookOpen, label: '프로그램', activeColor: 'text-blue-600' },
                    { id: TAB_NAMES.CALENDAR, icon: Calendar, label: '캘린더' },
                    { id: TAB_NAMES.AZIT, icon: MessageSquareHeart, label: '커뮤니티' },
                    { id: TAB_NAMES.HYPHEN, icon: Store, label: '하이픈' },
                ].map((tab) => (
                    <motion.button
                        key={tab.id}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleTabNavigation(tab.id)}
                        className={`flex flex-col items-center gap-1.5 p-2 rounded-2xl transition-all duration-300 flex-1 relative btn-tactile ${activeTab === tab.id ? (tab.activeColor || 'text-gray-900') : 'text-gray-300'}`}
                    >
                        <tab.icon size={24} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
                        <span className={`text-[10px] font-black tracking-tight ${activeTab === tab.id ? (tab.activeColor || 'text-gray-900') : 'text-gray-400'}`}>
                            {tab.label}
                        </span>
                        {activeTab === tab.id && (
                            <motion.div
                                layoutId="activeTabPill"
                                className={`absolute -top-1 w-1.5 h-1.5 rounded-full ${tab.activeColor ? 'bg-blue-600' : 'bg-gray-900'}`}
                            />
                        )}
                    </motion.button>
                ))}
            </div>
        </div>
    );
};

export default StudentDashboard;
