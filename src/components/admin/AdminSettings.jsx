import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';
import { Settings, User, Camera, Save, Edit2, Trash2, Plus, ZoomIn, RotateCw, ExternalLink, Share2, Database, FileText } from 'lucide-react';
import Cropper from 'react-easy-crop';
import getCroppedImg from '../../utils/imageUtils';
import { backupLogsToGoogleSheets, uploadSummaryToNotion } from '../../utils/integrationUtils';
import { processAnalyticsData } from '../../utils/analyticsUtils';

const AdminSettings = ({ currentAdmin, locations, fetchData, users, allLogs }) => {
    // Profile State
    const [profileImage, setProfileImage] = useState(null);
    const [profilePreview, setProfilePreview] = useState(null);
    const [newAdminPassword, setNewAdminPassword] = useState('');
    const [confirmAdminPassword, setConfirmAdminPassword] = useState('');
    const [profileLoading, setProfileLoading] = useState(false);

    // Integration State
    const [gsWebhookUrl, setGsWebhookUrl] = useState(localStorage.getItem('gs_webhook_url') || '');
    const [notionApiKey, setNotionApiKey] = useState(localStorage.getItem('notion_api_key') || '');
    const [notionDbId, setNotionDbId] = useState(localStorage.getItem('notion_db_id') || '');
    const [isBackingUp, setIsBackingUp] = useState(false);
    const [isUploadingNotion, setIsUploadingNotion] = useState(false);

    // Location State
    const [tempLocationName, setTempLocationName] = useState('');
    const [editLocationId, setEditLocationId] = useState(null);

    // Cropper State
    const [showEditor, setShowEditor] = useState(false);
    const [editorImageSrc, setEditorImageSrc] = useState(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

    // Profile Logic
    const handleAdminProfileImageSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            setEditorImageSrc(URL.createObjectURL(file));
            setCrop({ x: 0, y: 0 });
            setZoom(1);
            setRotation(0);
            setShowEditor(true);
        }
    };

    const handleSaveCroppedImage = async () => {
        try {
            const croppedBlob = await getCroppedImg(editorImageSrc, croppedAreaPixels, rotation);
            const newFile = new File([croppedBlob], "admin_profile_cropped.jpg", { type: 'image/jpeg' });
            setProfileImage(newFile);
            setProfilePreview(URL.createObjectURL(newFile));
            setShowEditor(false);
        } catch (e) { console.error(e); alert('이미지 저장 실패'); }
    };

    const handleSaveAdminProfile = async () => {
        if (!currentAdmin) return;
        setProfileLoading(true);
        try {
            let imageUrl = currentAdmin.profile_image_url;
            if (profileImage) {
                const fileExt = profileImage.name.split('.').pop();
                const fileName = `admin_${currentAdmin.id}_${Date.now()}.${fileExt}`;
                const { error: uploadError } = await supabase.storage.from('notice-images').upload(fileName, profileImage);
                if (uploadError) throw uploadError;
                const { data: { publicUrl } } = supabase.storage.from('notice-images').getPublicUrl(fileName);
                imageUrl = publicUrl;
            }

            let updates = { profile_image_url: imageUrl };
            if (newAdminPassword) {
                if (newAdminPassword.length < 4) { alert('비밀번호는 4자리 이상이어야 합니다.'); setProfileLoading(false); return; }
                if (newAdminPassword !== confirmAdminPassword) { alert('비밀번호가 일치하지 않습니다.'); setProfileLoading(false); return; }
                updates.password = newAdminPassword;
            }

            const { error } = await supabase.from('users').update(updates).eq('id', currentAdmin.id);
            if (error) throw error;

            const updatedAdmin = { ...currentAdmin, ...updates };
            localStorage.setItem('admin_user', JSON.stringify(updatedAdmin));
            alert('프로필이 업데이트되었습니다.');
            setProfileImage(null);
            setNewAdminPassword('');
            setConfirmAdminPassword('');
            // Trigger parent update via window reload or callback? 
            // Better: dashboard should listen to localStorage or just reload. 
            // Or we can assume dashboard re-fetches user on mount, but currentAdmin prop needs update.
            // Since we can't update parent state easily without a handler, duplicate simple logic:
            window.location.reload();
        } catch (err) { console.error(err); alert('저장 실패: ' + err.message); } finally { setProfileLoading(false); }
    };

    // Location Logic
    const handleAddLocation = async () => {
        if (!tempLocationName) return;
        try {
            const { error } = await supabase.from('locations').insert([{ id: tempLocationName, name: tempLocationName }]);
            if (error) throw error;
            setTempLocationName('');
            fetchData();
        } catch (err) { alert('추가 실패'); }
    };

    const handleUpdateLocation = async (id, newName) => {
        if (!newName) return;
        try {
            const { error } = await supabase.from('locations').update({ name: newName }).eq('id', id);
            if (error) throw error;
            setEditLocationId(null);
            fetchData();
        } catch (err) { alert('수정 실패'); }
    };

    const handleDeleteLocation = async (id) => {
        if (!confirm('정말 삭제하시겠습니까?')) return;
        try {
            const { error } = await supabase.from('locations').delete().eq('id', id);
            if (error) throw error;
            fetchData();
        } catch (err) { alert('삭제 실패'); }
    };

    const handleSaveIntegrations = () => {
        localStorage.setItem('gs_webhook_url', gsWebhookUrl);
        localStorage.setItem('notion_api_key', notionApiKey);
        localStorage.setItem('notion_db_id', notionDbId);
        alert('연동 설정이 브라우저에 저장되었습니다.');
    };

    const handleGoogleSheetsBackup = async () => {
        if (!gsWebhookUrl) return alert('구글 시트 웹훅 URL을 입력해주세요.');
        if (!allLogs || allLogs.length === 0) return alert('백업할 로그가 없습니다.');

        setIsBackingUp(true);
        try {
            await backupLogsToGoogleSheets(gsWebhookUrl, allLogs, users, locations);
            alert('구글 시트 백업이 완료되었습니다.');
        } catch (err) {
            alert('백업 실패: ' + err.message);
        } finally {
            setIsBackingUp(false);
        }
    };

    const handleNotionUpload = async () => {
        if (!notionApiKey || !notionDbId) return alert('노션 API 키와 데이터베이스 ID를 입력해주세요.');

        setIsUploadingNotion(true);
        try {
            const analytics = processAnalyticsData(allLogs, locations, users, new Date(), 'MONTHLY');
            await uploadSummaryToNotion(notionApiKey, notionDbId, analytics);
            alert('노션 요약 업로드가 완료되었습니다.');
        } catch (err) {
            alert('노션 업로드 실패: ' + err.message + '\n\n*브라우저 CORS 정책으로 인해 실패할 수 있습니다. 운영 환경에선 서버리스 함수가 필요합니다.');
        } finally {
            setIsUploadingNotion(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in-up">
            <h2 className="text-xl md:text-2xl font-bold text-gray-800 p-4 bg-gray-50/50 rounded-2xl">설정</h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Profile Settings */}
                <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-base md:text-lg text-gray-700 mb-6 flex items-center gap-2"><User size={20} /> 관리자 프로필</h3>

                    <div className="flex flex-col items-center gap-6 mb-8">
                        <div className="relative group">
                            {profilePreview || currentAdmin?.profile_image_url ? (
                                <img src={profilePreview || currentAdmin.profile_image_url} alt="Profile" className="w-24 h-24 md:w-32 md:h-32 rounded-full object-cover border-4 border-gray-50 shadow-md" />
                            ) : (
                                <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-gray-100 flex items-center justify-center border-4 border-gray-50"><User size={40} className="text-gray-300" /></div>
                            )}
                            <label className="absolute bottom-0 right-0 p-2 md:p-3 bg-blue-600 text-white rounded-full cursor-pointer hover:bg-blue-700 shadow-lg transition transform hover:scale-110">
                                <Camera size={18} />
                                <input type="file" accept="image/*" className="hidden" onChange={handleAdminProfileImageSelect} />
                            </label>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] md:text-xs font-bold text-gray-500 mb-1 ml-1">새 비밀번호</label>
                            <input type="password" value={newAdminPassword} onChange={(e) => setNewAdminPassword(e.target.value)} placeholder="변경할 비밀번호 (4자리 이상)" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-500 transition text-sm" />
                        </div>
                        <div>
                            <label className="block text-[10px] md:text-xs font-bold text-gray-500 mb-1 ml-1">비밀번호 확인</label>
                            <input type="password" value={confirmAdminPassword} onChange={(e) => setConfirmAdminPassword(e.target.value)} placeholder="비밀번호 다시 입력" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-500 transition text-sm" />
                        </div>
                        <button onClick={handleSaveAdminProfile} disabled={profileLoading} className="w-full py-3.5 bg-gray-800 text-white rounded-xl font-bold hover:bg-black transition shadow-lg mt-2 disabled:bg-gray-400 text-sm">
                            {profileLoading ? '저장 중...' : '프로필 저장하기'}
                        </button>
                    </div>
                </div>
                {/* Location Management */}
                <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="font-bold text-base md:text-lg text-gray-700 mb-6 flex items-center gap-2"><Settings size={20} /> 공간(Zone) 관리</h3>

                    <div className="flex items-center gap-2 mb-6 w-full">
                        <input type="text" value={tempLocationName} onChange={e => setTempLocationName(e.target.value)} placeholder="새 공간 이름" className="flex-1 min-w-0 p-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 bg-gray-50 focus:bg-white transition text-sm h-[48px]" />
                        <button onClick={handleAddLocation} className="bg-blue-600 text-white px-6 rounded-xl font-bold hover:bg-blue-700 shadow-md text-sm whitespace-nowrap flex-shrink-0 h-[48px] flex items-center justify-center transition-all bg-gradient-to-r from-blue-600 to-blue-500">추가</button>
                    </div>

                    <div className="space-y-2 max-h-[300px] md:max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                        {locations.map(loc => (
                            <div key={loc.id} className="flex items-center justify-between p-3 md:p-4 bg-gray-50 rounded-xl group hover:border-blue-200 border border-transparent transition">
                                {editLocationId === loc.id ? (
                                    <input defaultValue={loc.name} autoFocus onBlur={(e) => handleUpdateLocation(loc.id, e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleUpdateLocation(loc.id, e.currentTarget.value)} className="flex-1 bg-white border border-blue-500 rounded px-2 py-1 outline-none text-sm font-bold" />
                                ) : (
                                    <span className="text-sm md:text-base text-gray-700 font-bold">{loc.name}</span>
                                )}
                                <div className="flex gap-1 md:gap-2 opacity-100 transition">
                                    <button onClick={() => setEditLocationId(loc.id)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={16} /></button>
                                    <button onClick={() => handleDeleteLocation(loc.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Integration Settings */}
            <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-gray-100 lg:col-span-2">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-base md:text-lg text-gray-700 flex items-center gap-2"><Share2 size={20} /> 외부 서비스 연동</h3>
                    <button onClick={handleSaveIntegrations} className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg font-bold hover:bg-blue-100 transition">설정 저장</button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Google Sheets */}
                    <div className="space-y-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <div className="flex items-center gap-2 text-green-600 font-bold mb-2">
                            <Database size={18} />
                            <span>Google Sheets 백업</span>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-1 ml-1">Apps Script Webhook URL</label>
                            <input
                                type="text"
                                value={gsWebhookUrl}
                                onChange={e => setGsWebhookUrl(e.target.value)}
                                placeholder="https://script.google.com/macros/s/.../exec"
                                className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-green-500 transition text-sm"
                            />
                        </div>
                        <button
                            onClick={handleGoogleSheetsBackup}
                            disabled={isBackingUp}
                            className="w-full py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition shadow-sm disabled:bg-gray-300 flex items-center justify-center gap-2 text-sm"
                        >
                            {isBackingUp ? '백업 중...' : <><Database size={16} /> 지금 시트로 백업하기</>}
                        </button>
                        <p className="text-[10px] text-gray-400 leading-relaxed">* 구글 앱스 스크립트를 통해 시트에 로그를 전송합니다.</p>
                    </div>

                    {/* Notion */}
                    <div className="space-y-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <div className="flex items-center gap-2 text-black font-bold mb-2">
                            <FileText size={18} />
                            <span>Notion 요약 업로드</span>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 mb-1 ml-1">Notion API Key</label>
                                <input
                                    type="password"
                                    value={notionApiKey}
                                    onChange={e => setNotionApiKey(e.target.value)}
                                    placeholder="secret_..."
                                    className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-gray-800 transition text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 mb-1 ml-1">Database ID</label>
                                <input
                                    type="text"
                                    value={notionDbId}
                                    onChange={e => setNotionDbId(e.target.value)}
                                    placeholder="32자리 ID"
                                    className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-gray-800 transition text-sm"
                                />
                            </div>
                        </div>
                        <button
                            onClick={handleNotionUpload}
                            disabled={isUploadingNotion}
                            className="w-full py-3 bg-gray-800 text-white rounded-xl font-bold hover:bg-black transition shadow-sm disabled:bg-gray-300 flex items-center justify-center gap-2 text-sm"
                        >
                            {isUploadingNotion ? '업로드 중...' : <><FileText size={16} /> 지금 노션으로 업로드</>}
                        </button>
                        <p className="text-[10px] text-gray-400 leading-relaxed">* 오늘 하루의 통계(방문자 등)를 노션 데이터베이스에 추가합니다.</p>
                    </div>
                </div>
            </div>

            {/* Cropper Modal */}
            {showEditor && (
                <div className="fixed inset-0 z-[60] bg-black flex flex-col animate-fade-in">
                    <div className="flex-1 relative bg-black">
                        <Cropper
                            image={editorImageSrc}
                            crop={crop}
                            zoom={zoom}
                            rotation={rotation}
                            aspect={1}
                            onCropChange={setCrop}
                            onCropComplete={setCroppedAreaPixels}
                            onZoomChange={setZoom}
                            onRotationChange={setRotation}
                            cropShape="round"
                        />
                    </div>
                    <div className="bg-gray-900 p-6 flex flex-col gap-4">
                        <div className="flex items-center gap-4"><span className="text-white text-xs w-10">Zoom</span><input type="range" value={zoom} min={1} max={3} step={0.1} onChange={(e) => setZoom(e.target.value)} className="flex-1" /></div>
                        <div className="flex items-center gap-4"><span className="text-white text-xs w-10">Rotate</span><input type="range" value={rotation} min={0} max={360} step={1} onChange={(e) => setRotation(e.target.value)} className="flex-1" /></div>
                        <div className="flex gap-3 justify-end mt-2">
                            <button onClick={() => setShowEditor(false)} className="px-6 py-2 text-white bg-gray-700 rounded-lg hover:bg-gray-600">취소</button>
                            <button onClick={handleSaveCroppedImage} className="px-6 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-500 font-bold">확인</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminSettings;
