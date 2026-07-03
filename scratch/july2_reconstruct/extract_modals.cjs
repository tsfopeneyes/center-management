const fs = require('fs');
const backupPath = 'd:/coding/ENTER/src/pages/StudentDashboard.backup.jsx';
const lines = fs.readFileSync(backupPath, 'utf8').replace(/\r\n/g, '\n').split('\n');

const getLines = (start, end) => lines.slice(start - 1, end).join('\n');

// 1. ProfileSettingsModal
const profileCode = getLines(654, 696);
const cropCode = getLines(968, 1026);
fs.writeFileSync('d:/coding/ENTER/src/components/student/modals/ProfileSettingsModal.jsx', 
`import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Image as ImageIcon, ZoomIn, RotateCw } from 'lucide-react';
import Cropper from 'react-easy-crop';
import getCroppedImg from '../../../utils/imageUtils';

const ProfileSettingsModal = ({ 
    user, 
    setShowProfileSettings, 
    updateProfile, 
    profileLoadingState 
}) => {
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

    const handleProfileImageSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            setPhotoURL(URL.createObjectURL(file));
            setShowCropModal(true);
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
        const updates = {};
        if (newPassword) {
            if (newPassword.length < 4) {
                alert('비밀번호는 4자리 이상이어야 합니다.');
                return;
            }
            if (newPassword !== confirmPassword) {
                alert('비밀번호 확인이 일치하지 않습니다.');
                return;
            }
            updates.password = newPassword;
        }

        const result = await updateProfile(updates, profileImage);

        if (result.success) {
            alert('프로필이 업데이트되었습니다.');
            setShowProfileSettings(false);
        } else {
            alert('프로필 저장 실패: ' + result.error);
        }
    };

    return (
        <>
            <motion.div
                key="profile-settings"
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="fixed inset-0 z-[110] bg-white flex flex-col sm:rounded-t-3xl sm:top-10 shadow-2xl pb-20"
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
                            {profilePreview || user?.profile_image_url ? (
                                <img src={profilePreview || user?.profile_image_url} alt="Profile" className="w-32 h-32 rounded-full object-cover border-4 border-gray-50 shadow-sm" />
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
                            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="변경할 비밀번호를 입력하세요" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-base" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 ml-1">새 비밀번호 확인</label>
                            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="비밀번호를 다시 입력하세요" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-base" />
                        </div>
                    </div>
                </div>
            </motion.div>

            {showCropModal && (
${cropCode}
            )}
        </>
    );
};
export default ProfileSettingsModal;
`);

// 2. GuestbookWriteModal
fs.writeFileSync('d:/coding/ENTER/src/components/student/modals/GuestbookWriteModal.jsx', 
`import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Image as ImageIcon } from 'lucide-react';

const GuestbookWriteModal = ({ setShowGuestWrite, handleCreatePost, uploadingGuest }) => {
    const [newGuestPost, setNewGuestPost] = useState({ content: '', images: [], previews: [] });

    const handleCreateGuestPost = async () => {
        if (!newGuestPost.content.trim() && newGuestPost.images.length === 0) return;
        const success = await handleCreatePost(newGuestPost.content, newGuestPost.images);
        if (success) {
            setNewGuestPost({ content: '', images: [], previews: [] });
            setShowGuestWrite(false);
        }
    };

    const handleGuestFileSelect = (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            const newPreviews = files.map(file => URL.createObjectURL(file));
            setNewGuestPost(prev => ({
                ...prev,
                images: [...prev.images, ...files],
                previews: [...prev.previews, ...newPreviews]
            }));
        }
    };

    return (
${getLines(701, 744)}
    );
};
export default GuestbookWriteModal;
`);

// 3. GuestbookDetailModal
fs.writeFileSync('d:/coding/ENTER/src/components/student/modals/GuestbookDetailModal.jsx', 
`import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Trash2, Trash, Send } from 'lucide-react';
import UserAvatar from '../../common/UserAvatar';

const GuestbookDetailModal = ({ 
    selectedGuestPost, 
    guestComments, 
    user, 
    onDeleteGuestPost, 
    onDeleteGuestComment, 
    handleGuestCommentSubmit,
    fetchGuestCommentsData,
    setGuestComments,
    setSelectedGuestPost
}) => {
    const [newGuestComment, setNewGuestComment] = useState('');

    const handlePostGuestCommentData = async (e) => {
        e.preventDefault();
        const success = await handleGuestCommentSubmit(selectedGuestPost.id, newGuestComment);
        if (success) {
            setNewGuestComment('');
            const data = await fetchGuestCommentsData(selectedGuestPost.id);
            setGuestComments(data);
        }
    };

    const handleDeletePost = async (id) => {
        await onDeleteGuestPost(id);
    };

    return (
        <>
            <div className="fixed inset-0 z-[105] bg-black/20 backdrop-blur-sm" onClick={() => setSelectedGuestPost(null)}></div>
${getLines(749, 830)}
        </>
    );
};
export default GuestbookDetailModal;
`);

// 4. NotificationsModal
fs.writeFileSync('d:/coding/ENTER/src/components/student/modals/NotificationsModal.jsx', 
`import React from 'react';
import { motion } from 'framer-motion';
import { X, Bell } from 'lucide-react';

const NotificationsModal = ({ notifications, setShowNotificationsModal, markNotificationsAsRead }) => {
    return (
${getLines(868, 919)}
    );
};
export default NotificationsModal;
`);

// 5. ProgramHistoryModal
fs.writeFileSync('d:/coding/ENTER/src/components/student/modals/ProgramHistoryModal.jsx', 
`import React from 'react';
import { motion } from 'framer-motion';
import { X, CheckCircle } from 'lucide-react';

const ProgramHistoryModal = ({ attendedProgramsList, setShowProgramHistory }) => {
    return (
${getLines(923, 962)}
    );
};
export default ProgramHistoryModal;
`);

// 6. QRModal
fs.writeFileSync('d:/coding/ENTER/src/components/student/modals/QRModal.jsx', 
`import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

const QRModal = ({ user, setShowEnlargedQr }) => {
    return (
${getLines(835, 864)}
    );
};
export default QRModal;
`);

console.log('Successfully generated all 6 modals inside src/components/student/modals/');
