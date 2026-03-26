import React, { useState } from 'react';
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
                <div className="fixed inset-0 z-[110] bg-black flex flex-col animate-fade-in pb-20">
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
        </>
    );
};
export default ProfileSettingsModal;
