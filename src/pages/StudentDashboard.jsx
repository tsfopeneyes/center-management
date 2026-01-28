import React, { useEffect, useState } from 'react';
import { CATEGORIES, TAB_NAMES, RESPONSE_STATUS } from '../constants/appConstants';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '../supabaseClient';
import { Clock, Info, LogOut, CheckCircle, XCircle, HelpCircle, Search, MessageSquare, Send, X, ArrowLeft, Image as ImageIcon, Grid, Settings, User, Plus, Heart, ZoomIn, RotateCw, Home, FileText, MessageCircle, BookOpen, MoreHorizontal, Bookmark, Share2, ShieldCheck, Calendar, Edit2, Trash2, Save, Trash } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Microlink from '@microlink/react';
import { motion, AnimatePresence } from 'framer-motion';
import SunEditor from 'suneditor-react';
import 'suneditor/dist/css/suneditor.min.css';

import StudentChat from '../components/student/StudentChat';
import UserAvatar from '../components/common/UserAvatar';
import LinkPreview from '../components/common/LinkPreview';
import NoticeModal from '../components/student/NoticeModal';
import { stripHtml, extractUrls } from '../utils/textUtils';
import { formatToLocalISO } from '../utils/dateUtils';
import { subscribeToPush } from '../utils/pushUtils';
import getCroppedImg from '../utils/imageUtils';

import { useMessaging } from '../hooks/useMessaging';
import { useNotices } from '../hooks/useNotices';
import { useGuestbook } from '../hooks/useGuestbook';
import { useProfile } from '../hooks/useProfile';

// --- Global Helpers moved to utils ---

const StudentDashboard = () => {
    console.log("StudentDashboard Mounted");
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState(TAB_NAMES.HOME);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);

    // Hooks
    const { user, setUser, totalHours, fetchStats, updateProfile, loading: profileLoadingState } = useProfile(null);
    const { notices, responses, fetchNotices, handleResponse } = useNotices(user?.id);
    const { messages, unreadCount, markAsRead } = useMessaging(user?.id);
    const { guestPosts, uploading: uploadingGuest, handleCreatePost, fetchComments: fetchGuestCommentsData, handlePostComment: handleGuestCommentSubmit } = useGuestbook(user?.id);

    // UI-Specific State (Not in hooks)
    const [selectedNotice, setSelectedNotice] = useState(null);
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState('');

    const [showGuestWrite, setShowGuestWrite] = useState(false);
    const [newGuestPost, setNewGuestPost] = useState({ content: '', image: null, preview: null });
    const [selectedGuestPost, setSelectedGuestPost] = useState(null);
    const [guestComments, setGuestComments] = useState([]);
    const [newGuestComment, setNewGuestComment] = useState('');

    const [showProfileSettings, setShowProfileSettings] = useState(false);
    const [profileImage, setProfileImage] = useState(null);
    const [profilePreview, setProfilePreview] = useState(null);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [showCropModal, setShowCropModal] = useState(false);
    const [photoURL, setPhotoURL] = useState(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);




    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (!storedUser) {
            alert('로그인이 필요합니다.');
            navigate('/');
            return;
        }
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        fetchStats(parsedUser.id);
        subscribeToPush(parsedUser.id);
        setLoading(false);
    }, [navigate, fetchStats, setUser]);

    // Deep-linking: Open notice from URL query param
    useEffect(() => {
        if (notices.length > 0) {
            const params = new URLSearchParams(window.location.search);
            const noticeId = params.get('noticeId');
            if (noticeId) {
                const target = notices.find(n => n.id === noticeId);
                if (target) {
                    openNoticeDetail(target);
                    // Clear the query param without refresh to keep URL clean
                    window.history.replaceState({}, '', window.location.pathname);
                }
            }
        }
    }, [notices]);

    const handlePostComment = async (e) => {
        e.preventDefault();
        if (!newComment.trim()) return;
        try {
            const { error } = await supabase.from('comments').insert([{
                notice_id: selectedNotice.id,
                user_id: user.id,
                content: newComment
            }]);
            if (error) throw error;
            setNewComment('');
            // Fetch updated comments
            const { data } = await supabase
                .from('comments')
                .select('*, users(name)')
                .eq('notice_id', selectedNotice.id)
                .order('created_at', { ascending: true });
            setComments(data || []);
        } catch (err) { alert('댓글 작성 실패'); }
    };

    const openNoticeDetail = async (notice) => {
        setSelectedNotice(notice);
        try {
            const { data } = await supabase
                .from('comments')
                .select('*, users(name)')
                .eq('notice_id', notice.id)
                .order('created_at', { ascending: true });
            setComments(data || []);
        } catch (err) { console.error(err); }
    };

    const handleCreateGuestPost = async () => {
        const success = await handleCreatePost(newGuestPost.content, newGuestPost.image);
        if (success) {
            setShowGuestWrite(false);
            setNewGuestPost({ content: '', image: null, preview: null });
        }
    };

    const openGuestPostDetail = async (post) => {
        setSelectedGuestPost(post);
        const data = await fetchGuestCommentsData(post.id);
        setGuestComments(data);
    };

    const handlePostGuestCommentData = async (e) => {
        e.preventDefault();
        const success = await handleGuestCommentSubmit(selectedGuestPost.id, newGuestComment);
        if (success) {
            setNewGuestComment('');
            const data = await fetchGuestCommentsData(selectedGuestPost.id);
            setGuestComments(data);
        }
    };

    const handleGuestFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            setNewGuestPost(prev => ({
                ...prev,
                image: file,
                preview: URL.createObjectURL(file)
            }));
        }
    };




    if (loading) return <div className="p-8 text-center text-gray-500">로딩 중...</div>;
    if (!user) {
        console.log("User state is null");
        return <div className="p-8 text-center text-red-500">사용자 정보를 불러오지 못했습니다. 다시 로그인해주세요.</div>;
    }





    // Filter Notices
    const filteredNotices = notices.filter(n =>
        n.category === CATEGORIES.NOTICE &&
        (n.title.toLowerCase().includes(searchQuery.toLowerCase()) || n.content.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const galleryNotices = notices.filter(n =>
        n.category === CATEGORIES.GALLERY &&
        (n.title.toLowerCase().includes(searchQuery.toLowerCase()) || n.content.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const filteredPrograms = notices.filter(n =>
        n.category === CATEGORIES.PROGRAM &&
        (n.title.toLowerCase().includes(searchQuery.toLowerCase()) || n.content.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const homeNotices = filteredNotices.slice(0, 3);
    const homePrograms = filteredPrograms.slice(0, 3);
    const homeGallery = notices.filter(n => n.category === CATEGORIES.GALLERY).slice(0, 3);



    const handleProfileImageSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            setPhotoURL(URL.createObjectURL(file));
            setShowCropModal(true);
            // Reset Cropper
            setZoom(1);
            setRotation(0);
            setCrop({ x: 0, y: 0 });
        }
    };

    const onCropComplete = (croppedArea, croppedAreaPixels) => {
        setCroppedAreaPixels(croppedAreaPixels);
    };

    const handleCropSave = async () => {
        try {
            const croppedImageBlob = await getCroppedImg(photoURL, croppedAreaPixels, rotation);
            const file = new File([croppedImageBlob], "profile_cropped.jpg", { type: "image/jpeg" });

            setProfileImage(file);
            setProfilePreview(URL.createObjectURL(file));
            setShowCropModal(false);
        } catch (e) {
            console.error(e);
            alert('이미지 크롭 실패');
        }
    };

    const handleSaveProfile = async () => {
        const result = await updateProfile({
            password: newPassword
        }, profileImage);

        if (result.success) {
            alert('프로필이 업데이트되었습니다.');
            setShowProfileSettings(false);
            setProfileImage(null);
            setNewPassword('');
            setConfirmPassword('');
        } else {
            alert('프로필 저장 실패: ' + result.error);
        }
    };


    return (
        <div className="w-full md:max-w-lg mx-auto min-h-screen bg-gray-50 pb-20 font-sans">
            {/* Main Content */}
            <div className="p-4 pt-4">
            </div>

            {/* Modals & Overlays */}
            <AnimatePresence>
                {selectedNotice && (
                    <NoticeModal
                        key={selectedNotice.id}
                        notice={selectedNotice}
                        onClose={() => setSelectedNotice(null)}
                        user={user}
                        responses={responses}
                        onResponse={handleResponse}
                        comments={comments}
                        newComment={newComment}
                        setNewComment={setNewComment}
                        onPostComment={handlePostComment}
                    />
                )}

                {/* Profile Settings Modal */}
                {showProfileSettings && (
                    <motion.div
                        key="profile-settings"
                        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="fixed inset-0 z-50 bg-white flex flex-col sm:rounded-t-3xl sm:top-10 shadow-2xl"
                    >
                        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-20">
                            <button onClick={() => setShowProfileSettings(false)} className="p-2 hover:bg-gray-100 rounded-full">
                                <X size={24} className="text-gray-600" />
                            </button>
                            <h3 className="font-bold text-lg">프로필 설정</h3>
                            <button onClick={handleSaveProfile} disabled={profileLoadingState} className="text-blue-600 font-bold px-2 disabled:text-gray-300">
                                {profileLoadingState ? '...' : '저장'}
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-8">
                            <div className="flex flex-col items-center gap-4">
                                <div className="relative">
                                    {profilePreview || user.profile_image_url ? (
                                        <img src={profilePreview || user.profile_image_url} alt="Profile" className="w-32 h-32 rounded-full object-cover border-4 border-gray-50 shadow-sm" />
                                    ) : (
                                        <div className="w-32 h-32 rounded-full bg-gray-100 flex items-center justify-center">
                                            <User size={48} className="text-gray-300" />
                                        </div>
                                    )}
                                    <label className="absolute bottom-0 right-0 p-2 bg-blue-600 text-white rounded-full cursor-pointer hover:bg-blue-700 shadow-md transition">
                                        <ImageIcon size={16} />
                                        <input type="file" accept="image/*" className="hidden" onChange={handleProfileImageSelect} />
                                    </label>
                                </div>
                                <p className="text-sm text-gray-400">프로필 사진을 변경하려면 카메라 아이콘을 누르세요</p>
                            </div>
                            <div className="space-y-4">
                                <h4 className="font-bold text-gray-800 border-b pb-2">비밀번호 변경</h4>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1 ml-1">새 비밀번호 (4자리 이상)</label>
                                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="변경할 비밀번호를 입력하세요" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1 ml-1">새 비밀번호 확인</label>
                                    <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="비밀번호를 다시 입력하세요" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Guestbook Write Modal */}
                {showGuestWrite && (
                    <motion.div
                        key="guest-write"
                        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="fixed inset-0 z-50 bg-white flex flex-col sm:rounded-t-3xl sm:top-20 shadow-2xl"
                    >
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                            <button onClick={() => setShowGuestWrite(false)} className="text-gray-500 font-bold px-2">취소</button>
                            <h3 className="font-bold text-lg">새 글 쓰기</h3>
                            <button onClick={handleCreateGuestPost} disabled={uploadingGuest} className="text-blue-600 font-bold px-2 disabled:text-gray-300">
                                {uploadingGuest ? '...' : '완료'}
                            </button>
                        </div>
                        <div className="p-4 flex-1">
                            <textarea value={newGuestPost.content} onChange={e => setNewGuestPost({ ...newGuestPost, content: e.target.value })} placeholder="무슨 생각을 하고 계신가요?" className="w-full h-40 text-lg outline-none resize-none placeholder:text-gray-300" />
                            {newGuestPost.preview ? (
                                <div className="relative rounded-xl overflow-hidden shadow-sm inline-block">
                                    <img src={newGuestPost.preview} alt="preview" className="max-h-60 rounded-xl" />
                                    <button onClick={() => setNewGuestPost({ ...newGuestPost, image: null, preview: null })} className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1"><X size={14} /></button>
                                </div>
                            ) : (
                                <label className="inline-flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition">
                                    <ImageIcon className="text-gray-400" />
                                    <span className="text-xs text-gray-400 mt-1">사진 추가</span>
                                    <input type="file" accept="image/*" className="hidden" onChange={handleGuestFileSelect} />
                                </label>
                            )}
                        </div>
                    </motion.div>
                )}

                {/* Guestbook Detail Modal */}
                {selectedGuestPost && (
                    <motion.div
                        key="guest-detail"
                        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="fixed inset-0 z-50 bg-white flex flex-col sm:rounded-t-3xl sm:top-10 shadow-2xl"
                    >
                        <div className="p-4 border-b border-gray-100 flex items-center gap-2 bg-white sticky top-0 z-20">
                            <button onClick={() => setSelectedGuestPost(null)} className="p-2 hover:bg-gray-100 rounded-full">
                                <ArrowLeft size={24} className="text-gray-600" />
                            </button>
                            <h3 className="font-bold text-lg">상세보기</h3>
                        </div>
                        <div className="flex-1 overflow-y-auto pb-20">
                            <div className="p-4">
                                <div className="flex items-center gap-3 mb-4">
                                    <UserAvatar user={selectedGuestPost.users} size="w-10 h-10" />
                                    <div>
                                        <div className="font-bold text-gray-800 text-sm">{selectedGuestPost.users?.name}</div>
                                        <div className="text-xs text-gray-400">{new Date(selectedGuestPost.created_at).toLocaleString()}</div>
                                    </div>
                                </div>
                                <p className="text-gray-800 text-base mb-4 whitespace-pre-wrap leading-relaxed">{selectedGuestPost.content}</p>
                                {selectedGuestPost.image_url && (
                                    <div className="rounded-xl overflow-hidden mb-4 shadow-sm border border-gray-50 text-center">
                                        <img src={selectedGuestPost.image_url} alt="post" className="max-h-80 mx-auto" />
                                    </div>
                                )}
                            </div>
                            <div className="border-t border-gray-100 p-4">
                                <h4 className="font-bold text-sm text-gray-600 mb-3">댓글</h4>
                                <div className="space-y-3">
                                    {guestComments.map(c => (
                                        <div key={c.id} className="bg-gray-50 p-3 rounded-2xl">
                                            <div className="flex justify-between items-baseline mb-1">
                                                <div className="flex items-center gap-2">
                                                    <UserAvatar user={c.users} size="w-4 h-4" textSize="text-[8px]" />
                                                    <span className="font-bold text-sm text-gray-800">{c.users?.name}</span>
                                                </div>
                                                <span className="text-[10px] text-gray-400">{new Date(c.created_at).toLocaleDateString()}</span>
                                            </div>
                                            <p className="text-sm text-gray-600 ml-6">{c.content}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="p-4 border-t border-gray-100 bg-white sticky bottom-0">
                            <form onSubmit={handlePostGuestCommentData} className="flex gap-2">
                                <input type="text" value={newGuestComment} onChange={(e) => setNewGuestComment(e.target.value)} placeholder="댓글을 남겨주세요..." className="flex-1 bg-gray-100 rounded-full px-5 py-3 text-sm outline-none focus:ring-2 focus:ring-green-500 transition" />
                                <button type="submit" disabled={!newGuestComment.trim()} className="bg-green-600 text-white p-3 rounded-full hover:bg-green-700 disabled:bg-gray-300 transition active:scale-90">
                                    <Send size={18} />
                                </button>
                            </form>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Cropper Modal */}
            {showCropModal && (
                <div className="fixed inset-0 z-[60] bg-black flex flex-col animate-fade-in">
                    <div className="flex-1 relative bg-black">
                        <Cropper
                            image={photoURL}
                            crop={crop}
                            zoom={zoom}
                            rotation={rotation}
                            aspect={1}
                            onCropChange={setCrop}
                            onCropComplete={onCropComplete}
                            onZoomChange={setZoom}
                            onRotationChange={setRotation}
                            cropShape="round"
                            showGrid={false}
                        />
                    </div>
                    <div className="bg-gray-900 p-6 flex flex-col gap-4">
                        <div className="flex items-center gap-4">
                            <ZoomIn className="text-gray-400" size={20} />
                            <span className="text-white text-xs w-10">Zoom</span>
                            <input
                                type="range"
                                value={zoom}
                                min={1}
                                max={3}
                                step={0.1}
                                onChange={(e) => setZoom(e.target.value)}
                                className="flex-1 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>
                        <div className="flex items-center gap-4">
                            <RotateCw className="text-gray-400" size={20} />
                            <span className="text-white text-xs w-10">Rot</span>
                            <input
                                type="range"
                                value={rotation}
                                min={0}
                                max={360}
                                step={1}
                                onChange={(e) => setRotation(e.target.value)}
                                className="flex-1 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>
                        <div className="flex gap-3 justify-end mt-2">
                            <button
                                onClick={() => setShowCropModal(false)}
                                className="px-6 py-3 text-white bg-gray-700 rounded-xl hover:bg-gray-600 transition font-bold"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleCropSave}
                                className="px-6 py-3 text-white bg-blue-600 rounded-xl hover:bg-blue-500 font-bold transition shadow-lg shadow-blue-900/20"
                            >
                                완료
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === TAB_NAMES.HOME && (
                <>
                    {/* Header */}
                    <header className="bg-blue-600 p-6 text-white rounded-b-3xl shadow-lg relative overflow-hidden">
                        <div className="relative z-0 flex justify-between items-start">
                            <div className="flex items-center gap-4">
                                <div onClick={() => setShowProfileSettings(true)} className="cursor-pointer hover:opacity-90 transition">
                                    <UserAvatar user={user} size="w-14 h-14" textSize="text-xl" />
                                </div>
                                <div>
                                    <p className="text-blue-100 text-sm mb-1">{user.school}</p>
                                    <h1 className="text-2xl font-bold whitespace-nowrap">{user.name}님!</h1>
                                </div>
                            </div>
                            <div className="flex gap-3 ml-2">
                                {user?.role === 'admin' && (
                                    <button onClick={() => navigate('/admin')} className="p-2.5 bg-blue-500/50 rounded-xl text-white hover:bg-white hover:text-blue-600 transition flex items-center gap-1.5 shadow-sm">
                                        <ShieldCheck size={18} />
                                        <span className="text-[10px] font-bold">Admin</span>
                                    </button>
                                )}
                                <button
                                    onClick={() => setActiveTab(TAB_NAMES.MESSAGES)}
                                    className="relative p-2.5 bg-blue-500/50 rounded-xl text-white hover:bg-blue-400 transition shadow-sm"
                                >
                                    <MessageCircle size={18} />
                                    {unreadCount > 0 && (
                                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                                    )}
                                </button>
                                <button onClick={() => setShowProfileSettings(true)} className="p-2.5 bg-blue-500/50 rounded-xl text-white hover:bg-blue-500 transition shadow-sm">
                                    <Settings size={18} />
                                </button>
                                <button onClick={() => { localStorage.removeItem('user'); localStorage.removeItem('admin_user'); navigate('/'); }} className="p-2.5 bg-blue-500/50 rounded-xl hover:bg-red-500/50 transition shadow-sm">
                                    <LogOut size={18} />
                                </button>
                            </div>
                        </div>
                    </header>

                    <div className="p-4 space-y-6 -mt-4 relative z-0">
                        {/* QR */}
                        <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100 text-center">
                            <div className="flex justify-center mb-4">
                                <div className="p-2 bg-white rounded-xl border border-gray-100">
                                    <QRCodeSVG value={user.phone_back4 || '0000'} size={140} level="H" />
                                </div>
                            </div>
                            <p className="text-xl font-mono font-bold text-gray-800 tracking-[0.2em]">{user.phone_back4}</p>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                                <p className="text-gray-400 text-[10px] mb-1">올해 누적 이용</p>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-bold text-blue-600">{totalHours}</span>
                                    <span className="text-gray-400 text-xs font-bold">시간</span>
                                </div>
                            </div>
                            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                                <p className="text-gray-400 text-[10px] mb-1">참여 프로그램</p>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-bold text-indigo-600">
                                        {Object.values(responses).filter(s => s === RESPONSE_STATUS.JOIN || s === RESPONSE_STATUS.WAITLIST).length}
                                    </span>
                                    <span className="text-gray-400 text-xs font-bold">건</span>
                                </div>
                            </div>
                        </div>

                        {/* Center Program Application (Was Popular Programs) */}
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                            <h3 className="font-bold text-gray-800 mb-4 flex justify-between items-center text-sm md:text-base">
                                🔥 센터 프로그램 신청
                                <button onClick={() => setActiveTab(TAB_NAMES.PROGRAMS)} className="text-xs text-blue-500 font-bold">전체보기</button>
                            </h3>
                            <div className="space-y-3">
                                {homePrograms.map(p => (
                                    <div key={p.id} onClick={() => openNoticeDetail(p)} className="flex items-center gap-3 p-2 bg-gray-50/50 rounded-xl hover:bg-blue-50 border border-transparent hover:border-blue-100 transition cursor-pointer">
                                        {p.image_url ? (
                                            <img src={p.image_url} alt="" className="w-12 h-12 rounded-lg object-cover bg-gray-200" />
                                        ) : (
                                            <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center font-bold text-blue-500 text-xs">P</div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-gray-800 truncate">{p.title}</p>
                                            <p className="text-[10px] text-gray-400 mt-0.5">{new Date(p.created_at).toLocaleDateString()}</p>
                                        </div>
                                        <button className="p-1.5 text-blue-500 hover:bg-blue-100 rounded-lg transition"><Plus size={16} /></button>
                                    </div>
                                ))}
                                {homePrograms.length === 0 && <p className="text-center py-4 text-gray-400 text-xs">등록된 프로그램이 없습니다.</p>}
                            </div>
                        </div>

                        {/* Board (Was Recent Notices) */}
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                            <h3 className="font-bold text-gray-800 mb-4 flex justify-between items-center">
                                게시판
                                <button onClick={() => setActiveTab(TAB_NAMES.BOARD)} className="text-xs text-blue-500">더보기</button>
                            </h3>
                            <ul className="space-y-3">
                                {homeNotices.slice(0, 3).map(n => (
                                    <li key={n.id} onClick={() => openNoticeDetail(n)} className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-2 -mx-2 rounded-lg transition">
                                        {n.is_sticky ? (
                                            <div className="px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded text-[10px] font-bold whitespace-nowrap">공지</div>
                                        ) : (
                                            <div className={`w-2 h-2 rounded-full ${n.is_recruiting ? 'bg-red-500' : 'bg-blue-500'}`} />
                                        )}
                                        <span className="flex-1 text-sm text-gray-700 truncate">{n.title}</span>
                                        {(n.images?.length > 0 || n.image_url) && <ImageIcon size={12} className="text-gray-400" />}
                                        <span className="text-xs text-gray-400">{new Date(n.created_at).toLocaleDateString()}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Gallery (Was Latest Gallery) */}
                        {homeGallery.length > 0 && (
                            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                                <h3 className="font-bold text-gray-800 mb-4 flex justify-between items-center">
                                    갤러리
                                    <button onClick={() => setActiveTab(TAB_NAMES.GALLERY)} className="text-xs text-pink-500">더보기</button>
                                </h3>
                                <div className="grid grid-cols-3 gap-1 rounded-xl overflow-hidden">
                                    {homeGallery.map(n => {
                                        const thumb = n.images?.length > 0 ? n.images[0] : n.image_url;
                                        if (!thumb) return null;
                                        return (
                                            <div key={n.id} onClick={() => openNoticeDetail(n)} className="relative aspect-square bg-gray-100 overflow-hidden cursor-pointer group">
                                                <img src={thumb} alt={n.title} className="w-full h-full object-cover transition duration-300 group-hover:scale-110" />
                                                {n.images?.length > 1 && (
                                                    <div className="absolute top-1 right-1 bg-black/50 text-white p-0.5 rounded-full">
                                                        <ImageIcon size={10} />
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}

            {activeTab === TAB_NAMES.PROGRAMS && (
                <div className="p-4 pt-8 pb-20">
                    <h1 className="text-2xl font-bold text-gray-800 mb-2">센터 프로그램</h1>
                    <p className="text-gray-500 text-sm mb-6">다양한 프로그램에 참여해보세요!</p>

                    <div className="relative mb-6">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="프로그램 검색..." className="w-full pl-12 p-4 bg-white border border-gray-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>

                    <div className="space-y-4">
                        {filteredPrograms.length === 0 ? (
                            <div className="text-center py-20 text-gray-400">진행 중인 프로그램이 없습니다.</div>
                        ) : (
                            filteredPrograms.map(n => (
                                <div key={n.id} onClick={() => openNoticeDetail(n)} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 active:scale-[0.98] transition-all cursor-pointer">
                                    {(n.image_url || n.images?.[0]) && (
                                        <div className="h-40 w-full overflow-hidden">
                                            <img src={n.image_url || n.images[0]} alt="" className="w-full h-full object-cover" />
                                        </div>
                                    )}
                                    <div className="p-4">
                                        <div className="flex gap-2 mb-2">
                                            {n.is_sticky && <span className="px-2 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold rounded">📢 중요</span>}
                                            {n.is_recruiting && <span className="px-2 py-0.5 bg-green-100 text-green-600 text-[10px] font-bold rounded">모집중</span>}
                                        </div>
                                        <h3 className="font-bold text-gray-800 mb-1">{n.title}</h3>
                                        <p className="text-xs text-gray-500 line-clamp-2 mb-4">{stripHtml(n.content)}</p>
                                        <div className="flex justify-between items-center text-[10px] text-gray-400 pt-3 border-t border-gray-50">
                                            <span>{new Date(n.created_at).toLocaleDateString()}</span>
                                            <span className="text-blue-500 font-bold">자세히 보기</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {activeTab === TAB_NAMES.BOARD && (
                <div className="p-4 pt-8">
                    <h1 className="text-2xl font-bold text-gray-800 mb-6">공지사항 게시판</h1>
                    <div className="relative mb-6">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="검색어를 입력하세요..." className="w-full pl-12 p-4 bg-white border border-gray-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div className="space-y-3">
                        {homeNotices.length === 0 ? <div className="text-center py-10 text-gray-400">검색 결과가 없습니다.</div> :
                            homeNotices.filter(n => n.title.includes(searchQuery)).map(n => (
                                <div key={n.id} onClick={() => openNoticeDetail(n)} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 active:scale-95 transition cursor-pointer">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-2 mb-1">
                                            {n.is_sticky && <span className="px-2 py-0.5 bg-orange-100 text-orange-600 rounded-full text-[10px] font-bold shadow-sm">📌 공지</span>}
                                            <h3 className="font-bold text-gray-800 line-clamp-1">{n.title}</h3>
                                        </div>
                                        {n.is_recruiting && <span className="px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded-full text-[10px] font-bold shadow-sm">모집중</span>}
                                    </div>
                                    {/* Thumbnail */}
                                    {(n.images?.length > 0 || n.image_url) && (
                                        <div className="mb-3 rounded-lg overflow-hidden h-32 bg-gray-50 border border-gray-100 relative">
                                            <img src={n.images?.length > 0 ? n.images[0] : n.image_url} alt="thumbnail" className="w-full h-full object-cover" />
                                            {n.images?.length > 1 && <div className="absolute bottom-2 right-2 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full">+{n.images.length - 1}</div>}
                                        </div>
                                    )}
                                    <p className="text-sm text-gray-500 line-clamp-2 mb-3">{stripHtml(n.content)}</p>
                                    <div className="flex justify-between items-center text-xs text-gray-400 border-t border-gray-50 pt-3">
                                        <span>{new Date(n.created_at).toLocaleDateString()}</span>
                                        <span className="flex items-center gap-1">상세보기 <ArrowLeft size={12} className="rotate-180" /></span>
                                    </div>
                                </div>
                            ))
                        }
                    </div>
                </div>
            )}

            {activeTab === TAB_NAMES.GALLERY && (
                <div className="p-0 pt-8 pb-20">
                    <div className="px-4 mb-4">
                        <h1 className="text-2xl font-bold text-gray-800">스처 갤러리 📸</h1>
                        <p className="text-gray-500 text-sm mt-1">우리들의 추억을 모아보세요</p>
                    </div>

                    <div className="grid grid-cols-3 gap-0.5">
                        {galleryNotices.map(n => {
                            const thumb = n.images?.length > 0 ? n.images[0] : n.image_url;
                            if (!thumb) return null;
                            return (
                                <div key={n.id} onClick={() => openNoticeDetail(n)} className="relative aspect-square bg-gray-100 overflow-hidden cursor-pointer group">
                                    <img src={thumb} alt={n.title} className="w-full h-full object-cover transition duration-300 group-hover:scale-110" />
                                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                        {n.images?.length > 1 && <ImageIcon className="text-white drop-shadow-md" size={20} />}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                    {galleryNotices.length === 0 && <div className="text-center py-20 text-gray-400 text-sm">등록된 사진이 없습니다.</div>}
                </div>
            )}
            {activeTab === TAB_NAMES.MESSAGES && (
                <StudentChat currentUser={user} onRefreshUnread={() => { }} />
            )}


            {activeTab === TAB_NAMES.GUESTBOOK && (
                <div className="p-4 pt-8 pb-24 relative min-h-screen">
                    <h1 className="text-2xl font-bold text-gray-800 mb-2">방명록 👋</h1>
                    <p className="text-gray-500 text-sm mb-6">자유롭게 글과 사진을 남겨주세요</p>

                    <div className="space-y-6">
                        {guestPosts.map(post => (
                            <div key={post.id} className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100" onClick={() => openGuestPostDetail(post)}>
                                <div className="flex items-center gap-3 mb-3">
                                    <UserAvatar user={post.users} />
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-gray-800">{post.users?.name}</p>
                                        <p className="text[10px] text-gray-400">{new Date(post.created_at).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <p className="text-sm text-gray-700 mb-3 whitespace-pre-wrap line-clamp-3">
                                    {post.content}
                                    {extractUrls(post.content).map((url, i) => (
                                        <LinkPreview key={i} url={url} size="small" />
                                    ))}
                                </p>
                                {post.image_url && (
                                    <div className="rounded-2xl overflow-hidden mb-3 border border-gray-50 shadow-sm aspect-video">
                                        <img src={post.image_url} alt="user upload" className="w-full h-full object-cover" />
                                    </div>
                                )}
                                <div className="flex justify-end gap-2 text-gray-400 text-xs font-bold">
                                    <button className="flex items-center gap-1 hover:text-green-600 transition">
                                        <MessageSquare size={14} /> 댓글 달기
                                    </button>
                                </div>
                            </div>
                        ))}
                        {guestPosts.length === 0 && <div className="text-center py-20 text-gray-400">첫 방명록의 주인공이 되어보세요!</div>}
                    </div>

                    {/* Floating Action Button */}
                    <button
                        onClick={() => setShowGuestWrite(true)}
                        className="fixed bottom-24 right-6 w-14 h-14 bg-green-600 text-white rounded-full shadow-lg shadow-green-300 flex items-center justify-center hover:scale-105 active:scale-95 transition z-40"
                    >
                        <Plus size={28} strokeWidth={2.5} />
                    </button>
                </div>
            )}

            {/* Bottom Navigation */}
            <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full md:max-w-lg bg-white/80 backdrop-blur-md border-t border-gray-100 flex justify-around items-center px-2 py-3 z-40 safe-area-bottom shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
                <button onClick={() => setActiveTab(TAB_NAMES.HOME)} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition flex-1 ${activeTab === TAB_NAMES.HOME ? 'text-gray-900' : 'text-gray-300'}`}>
                    <Home size={26} strokeWidth={activeTab === TAB_NAMES.HOME ? 2.5 : 2} />
                    <span className={`text-[10px] font-bold ${activeTab === TAB_NAMES.HOME ? 'text-gray-900' : 'text-gray-400'}`}>홈</span>
                </button>
                <button onClick={() => setActiveTab(TAB_NAMES.PROGRAMS)} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition flex-1 ${activeTab === TAB_NAMES.PROGRAMS ? 'text-blue-600' : 'text-gray-300'}`}>
                    <BookOpen size={26} strokeWidth={activeTab === TAB_NAMES.PROGRAMS ? 2.5 : 2} />
                    <span className={`text-[10px] font-bold ${activeTab === TAB_NAMES.PROGRAMS ? 'text-blue-600' : 'text-gray-400'}`}>프로그램</span>
                </button>
                <button onClick={() => setActiveTab(TAB_NAMES.BOARD)} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition flex-1 ${activeTab === TAB_NAMES.BOARD ? 'text-gray-900' : 'text-gray-300'}`}>
                    <FileText size={26} strokeWidth={activeTab === TAB_NAMES.BOARD ? 2.5 : 2} />
                    <span className={`text-[10px] font-bold ${activeTab === TAB_NAMES.BOARD ? 'text-gray-900' : 'text-gray-400'}`}>게시판</span>
                </button>
                <button onClick={() => setActiveTab(TAB_NAMES.GALLERY)} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition flex-1 ${activeTab === TAB_NAMES.GALLERY ? 'text-gray-900' : 'text-gray-300'}`}>
                    <ImageIcon size={26} strokeWidth={activeTab === TAB_NAMES.GALLERY ? 2.5 : 2} />
                    <span className={`text-[10px] font-bold ${activeTab === TAB_NAMES.GALLERY ? 'text-gray-900' : 'text-gray-400'}`}>갤러리</span>
                </button>
                <button onClick={() => setActiveTab(TAB_NAMES.GUESTBOOK)} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition flex-1 ${activeTab === TAB_NAMES.GUESTBOOK ? 'text-gray-900' : 'text-gray-300'}`}>
                    <MessageSquare size={26} strokeWidth={activeTab === TAB_NAMES.GUESTBOOK ? 2.5 : 2} />
                    <span className={`text-[10px] font-bold ${activeTab === TAB_NAMES.GUESTBOOK ? 'text-gray-900' : 'text-gray-400'}`}>방명록</span>
                </button>
            </div>
        </div>
    );
};





export default StudentDashboard;
