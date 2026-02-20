import React, { useState } from 'react';
import { format } from 'date-fns';
import { supabase } from '../../supabaseClient';
import { Settings, User, Camera, Save, Edit2, Trash2, Plus, ZoomIn, RotateCw, ExternalLink, Share2, Database, FileText, ArrowUp, ArrowDown, Eye, EyeOff, Layout, ShieldAlert } from 'lucide-react';
import { CATEGORIES } from '../../constants/appConstants';
import Cropper from 'react-easy-crop';
import getCroppedImg, { compressImage } from '../../utils/imageUtils';
import { backupLogsToGoogleSheets, uploadSummaryToNotion, syncToGoogleSheets, bulkSyncToGoogleSheets, performFullSyncToGoogleSheets } from '../../utils/integrationUtils';
import { processAnalyticsData, processUserAnalytics, processProgramAnalytics } from '../../utils/analyticsUtils';
import { aggregateVisitSessions } from '../../utils/visitUtils';

const AdminSettings = ({ currentAdmin, locations, locationGroups = [], notices, fetchData, users, allLogs, responses = [], schoolLogs = [] }) => {
    const isMaster = currentAdmin?.is_master || currentAdmin?.name === 'Rok' || currentAdmin?.name === 'admin';

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
    const [kioskMasterPin, setKioskMasterPin] = useState(localStorage.getItem('kiosk_master_pin') || '1801');
    const [isBackingUp, setIsBackingUp] = useState(false);
    const [isUploadingNotion, setIsUploadingNotion] = useState(false);
    const [syncProgress, setSyncProgress] = useState('');

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

    // Dashboard Layout State
    const [dashboardConfig, setDashboardConfig] = useState([
        { id: 'stats', label: '활동 통계', isVisible: true, count: 3 },
        { id: 'programs', label: '프로그램 신청', isVisible: true, count: 3 },
        { id: 'notices', label: '공지사항', isVisible: true, count: 3 },
        { id: 'gallery', label: '갤러리', isVisible: true, count: 6 }
    ]);
    const [sidebarConfig, setSidebarConfig] = useState([
        { id: 'STATUS', label: '공간 현황', isVisible: true },
        { id: 'CALENDAR', label: '일정 관리', isVisible: true },
        { id: 'PROGRAMS', label: '프로그램 관리', isVisible: true },
        { id: 'BOARD', label: '공지사항', isVisible: true },
        { id: 'GALLERY', label: '사진첩', isVisible: true },
        { id: 'GUESTBOOK', label: '방명록', isVisible: true },
        { id: 'USERS', label: '이용자 관리', isVisible: true },
        { id: 'SCHOOLS', label: '학교 관리', isVisible: true },
        { id: 'CHALLENGES', label: '챌린지 관리', isVisible: true },
        { id: 'STATISTICS', label: '통계', isVisible: true },
        { id: 'LOGS', label: '로그', isVisible: true },
        { id: 'REPORTS', label: '운영 리포트', isVisible: true },
        { id: 'SETTINGS', label: '설정', isVisible: true }
    ]);
    const [configLoading, setConfigLoading] = useState(false);
    const [sidebarConfigLoading, setSidebarConfigLoading] = useState(false);

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
                // Apply automatic compression before upload
                const compressedFile = await compressImage(profileImage);
                const fileExt = compressedFile.name.split('.').pop();
                const fileName = `admin_${currentAdmin.id}_${Date.now()}.${fileExt}`;
                const { error: uploadError } = await supabase.storage.from('notice-images').upload(fileName, compressedFile);
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

    // Location Group Logic
    const [tempGroupName, setTempGroupName] = useState('');
    const [editGroupId, setEditGroupId] = useState(null);
    const [selectedGroupIdForLocation, setSelectedGroupIdForLocation] = useState('');

    const handleAddGroup = async () => {
        if (!tempGroupName) return;
        try {
            const { error } = await supabase.from('location_groups').insert([{ name: tempGroupName }]);
            if (error) throw error;
            setTempGroupName('');
            fetchData();
        } catch (err) { alert('그룹 추가 실패: ' + err.message); }
    };

    const handleUpdateGroup = async (id, newName) => {
        if (!newName) return;
        try {
            const { error } = await supabase.from('location_groups').update({ name: newName }).eq('id', id);
            if (error) throw error;
            setEditGroupId(null);
            fetchData();
        } catch (err) { alert('그룹 수정 실패: ' + err.message); }
    };

    const handleDeleteGroup = async (id) => {
        const hasLocations = locations.some(l => l.group_id === id);
        if (hasLocations) {
            alert('이 그룹에 속한 공간이 있습니다. 공간을 먼저 삭제하거나 이동해주세요.');
            return;
        }
        if (!confirm('정말 삭제하시겠습니까?')) return;
        try {
            const { error } = await supabase.from('location_groups').delete().eq('id', id);
            if (error) throw error;
            fetchData();
        } catch (err) { alert('그룹 삭제 실패: ' + err.message); }
    };

    // Location Logic
    const handleAddLocation = async () => {
        if (!tempLocationName || !selectedGroupIdForLocation) {
            alert('공간 이름과 소속 그룹을 모두 입력해주세요.');
            return;
        }
        try {
            const { error } = await supabase.from('locations').insert([{ id: tempLocationName, name: tempLocationName, group_id: selectedGroupIdForLocation }]);
            if (error) throw error;
            setTempLocationName('');
            fetchData();
        } catch (err) { alert('공간 추가 실패: ' + err.message); }
    };

    const handleUpdateLocation = async (id, newName) => {
        if (!newName) return;
        try {
            const { error } = await supabase.from('locations').update({ name: newName }).eq('id', id);
            if (error) throw error;
            setEditLocationId(null);
            fetchData();
        } catch (err) { alert('수정 실패: ' + err.message); }
    };

    const handleDeleteLocation = async (id) => {
        if (!confirm('정말 삭제하시겠습니까?')) return;
        try {
            const { error } = await supabase.from('locations').delete().eq('id', id);
            if (error) throw error;
            fetchData();
        } catch (err) { alert('삭제 실패: ' + err.message); }
    };

    const handleSaveIntegrations = () => {
        localStorage.setItem('gs_webhook_url', gsWebhookUrl);
        localStorage.setItem('notion_api_key', notionApiKey);
        localStorage.setItem('notion_db_id', notionDbId);
        localStorage.setItem('kiosk_master_pin', kioskMasterPin);
        alert('연동 및 보안 설정이 브라우저에 저장되었습니다.');
    };

    // Dashboard Layout Logic
    React.useEffect(() => {
        const fetchConfig = async () => {
            const { data } = await supabase
                .from('notices')
                .select('content')
                .eq('category', CATEGORIES.SYSTEM)
                .eq('title', 'STUDENT_DASHBOARD_CONFIG')
                .maybeSingle();

            if (data && data.content) {
                try {
                    const parsed = JSON.parse(data.content);
                    if (Array.isArray(parsed)) setDashboardConfig(parsed);
                } catch (e) { console.error(e); }
            }
        };
        fetchConfig();

        const fetchSidebarConfig = async () => {
            const { data } = await supabase
                .from('notices')
                .select('content')
                .eq('category', CATEGORIES.SYSTEM)
                .eq('title', 'ADMIN_SIDEBAR_CONFIG')
                .maybeSingle();

            if (data && data.content) {
                try {
                    const parsed = JSON.parse(data.content);
                    if (Array.isArray(parsed)) {
                        // Merge with defaults to handle new tabs
                        const merged = sidebarConfig.map(def => {
                            const found = parsed.find(p => p.id === def.id);
                            return found ? { ...def, ...found } : def;
                        });
                        // Add persistent order from parsed
                        const ordered = [
                            ...parsed.map(p => merged.find(m => m.id === p.id)).filter(Boolean),
                            ...merged.filter(m => !parsed.find(p => p.id === m.id))
                        ];
                        setSidebarConfig(ordered);
                    }
                } catch (e) { console.error(e); }
            }
        };
        fetchSidebarConfig();
    }, []);

    const handleMoveConfig = (index, direction) => {
        const newConfig = [...dashboardConfig];
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= newConfig.length) return;
        const temp = newConfig[index];
        newConfig[index] = newConfig[targetIndex];
        newConfig[targetIndex] = temp;
        setDashboardConfig(newConfig);
    };

    const handleUpdateConfig = (id, field, value) => {
        setDashboardConfig(prev => prev.map(item =>
            item.id === id ? { ...item, [field]: value } : item
        ));
    };

    const handleSaveDashboardConfig = async () => {
        setConfigLoading(true);
        try {
            const { data: existing } = await supabase
                .from('notices')
                .select('id')
                .eq('category', CATEGORIES.SYSTEM)
                .eq('title', 'STUDENT_DASHBOARD_CONFIG')
                .maybeSingle();

            const payload = {
                title: 'STUDENT_DASHBOARD_CONFIG',
                content: JSON.stringify(dashboardConfig),
                category: CATEGORIES.SYSTEM,
                is_sticky: false,
                is_recruiting: false
            };

            if (existing) {
                await supabase.from('notices').update(payload).eq('id', existing.id);
            } else {
                await supabase.from('notices').insert([payload]);
            }
            alert('대시보드 레이아웃 설정이 저장되었습니다.');
        } catch (err) {
            console.error(err);
            alert('저장 실패');
        } finally {
            setConfigLoading(false);
        }
    };

    const handleMoveSidebarConfig = (index, direction) => {
        const newConfig = [...sidebarConfig];
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= newConfig.length) return;
        const temp = newConfig[index];
        newConfig[index] = newConfig[targetIndex];
        newConfig[targetIndex] = temp;
        setSidebarConfig(newConfig);
    };

    const handleUpdateSidebarConfig = (id, field, value) => {
        setSidebarConfig(prev => prev.map(item =>
            item.id === id ? { ...item, [field]: value } : item
        ));
    };

    const handleSaveSidebarConfig = async () => {
        setSidebarConfigLoading(true);
        try {
            const { data: existing } = await supabase
                .from('notices')
                .select('id')
                .eq('category', CATEGORIES.SYSTEM)
                .eq('title', 'ADMIN_SIDEBAR_CONFIG')
                .maybeSingle();

            const payload = {
                title: 'ADMIN_SIDEBAR_CONFIG',
                content: JSON.stringify(sidebarConfig),
                category: CATEGORIES.SYSTEM,
                is_sticky: false,
                is_recruiting: false
            };

            if (existing) {
                await supabase.from('notices').update(payload).eq('id', existing.id);
            } else {
                await supabase.from('notices').insert([payload]);
            }
            alert('사이드바 설정이 저장되었습니다. 페이지 새로고침 시 적용됩니다.');
            window.location.reload();
        } catch (err) {
            console.error(err);
            alert('저장 실패');
        } finally {
            setSidebarConfigLoading(false);
        }
    };

    const handleGoogleSheetsBackup = async () => {
        if (!gsWebhookUrl) return alert('구글 시트 웹훅 URL을 입력해주세요.');

        setIsBackingUp(true);
        setSyncProgress('Supabase에서 최신 데이터를 불러오는 중...');
        try {
            // 0. 최신 데이터 불러오기
            const latest = await fetchData();
            const currentUsers = latest?.users || users;
            const currentLogs = latest?.allLogs || allLogs;
            const currentResponses = latest?.responses || responses;
            const currentNotices = latest?.notices || notices;
            const currentLocations = latest?.locations || locations;
            const currentSchoolLogs = latest?.schoolLogs || schoolLogs;

            setSyncProgress('전송용 데이터 준비 및 전송 중...');

            // 학생방문일지용 메모 데이터 별도 수집
            const { data: vNotes } = await supabase.from('visit_notes').select('*');

            await performFullSyncToGoogleSheets({
                webhookUrl: gsWebhookUrl,
                users: currentUsers,
                logs: currentLogs,
                responses: currentResponses,
                notices: currentNotices,
                locations: currentLocations,
                schoolLogs: currentSchoolLogs,
                visitNotes: vNotes,
                processUserAnalytics,
                processProgramAnalytics,
                processAnalyticsData,
                aggregateVisitSessions
            });

            setSyncProgress('');
            alert('모든 데이터가 구글 시트로 동기화되었습니다!\n(최신 회원가입자 정보 포함)');
        } catch (err) {
            console.error('Backup Error:', err);
            setSyncProgress('');
            alert('백업 실패: ' + err.message);
        } finally {
            setIsBackingUp(false);
            setSyncProgress('');
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
            <div className="p-6 md:p-10 bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between bg-gradient-to-r from-white to-blue-50/20">
                <div>
                    <h2 className="text-2xl md:text-3xl font-black text-gray-800 tracking-tighter flex items-center gap-3">
                        <Settings className="text-blue-600" size={32} />
                        시스템 설정
                    </h2>
                    <p className="text-gray-500 text-sm font-medium mt-1">센터 기본 정보 및 보안, 연동 설정 관리</p>
                </div>
            </div>

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
                {isMaster ? (
                    <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-6">
                        <h3 className="font-bold text-base md:text-lg text-gray-700 flex items-center gap-2"><Settings size={20} /> 공간(Zone) 관리</h3>

                        {/* Group Add */}
                        <div className="space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">공간 그룹 (지역) 추가</h4>
                            <div className="flex items-center gap-2">
                                <input type="text" value={tempGroupName} onChange={e => setTempGroupName(e.target.value)} placeholder="새 그룹 이름 (예: 하이픈)" className="flex-1 w-full min-w-0 p-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-blue-500 transition text-sm h-[40px]" />
                                <button onClick={handleAddGroup} className="bg-gray-800 text-white px-4 rounded-xl font-bold hover:bg-black shadow-sm text-sm whitespace-nowrap h-[40px] flex items-center justify-center transition-all">그룹 추가</button>
                            </div>
                        </div>

                        {/* Location Add */}
                        <div className="space-y-3 p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                            <h4 className="text-xs font-bold text-blue-600 uppercase tracking-widest">상세 공간 추가</h4>
                            <div className="flex flex-col gap-2">
                                <select
                                    className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-blue-500 transition text-sm h-[40px] font-bold text-gray-700"
                                    value={selectedGroupIdForLocation}
                                    onChange={(e) => setSelectedGroupIdForLocation(e.target.value)}
                                >
                                    <option value="" disabled>소속 그룹 선택</option>
                                    {locationGroups.map(g => (
                                        <option key={g.id} value={g.id}>{g.name}</option>
                                    ))}
                                </select>
                                <div className="flex items-center gap-2">
                                    <input type="text" value={tempLocationName} onChange={e => setTempLocationName(e.target.value)} placeholder="새 상세 공간 이름 (예: 2F 라운지)" className="flex-1 min-w-0 p-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-blue-500 transition text-sm h-[40px]" />
                                    <button onClick={handleAddLocation} className="bg-blue-600 text-white px-4 rounded-xl font-bold hover:bg-blue-700 shadow-sm text-sm whitespace-nowrap h-[40px] flex items-center justify-center transition-all">공간 추가</button>
                                </div>
                            </div>
                        </div>

                        {/* Location List by Group */}
                        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                            {/* Groups */}
                            {locationGroups.map(group => {
                                const groupLocations = locations.filter(l => l.group_id === group.id);
                                return (
                                    <div key={group.id} className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                        <div className="bg-gray-100 p-3 md:p-4 flex items-center justify-between group hover:bg-gray-200 transition">
                                            {editGroupId === group.id ? (
                                                <input defaultValue={group.name} autoFocus onBlur={(e) => handleUpdateGroup(group.id, e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleUpdateGroup(group.id, e.currentTarget.value)} className="flex-1 bg-white border border-gray-400 rounded px-2 py-1 outline-none text-sm font-bold" />
                                            ) : (
                                                <span className="text-sm md:text-base text-gray-800 font-extrabold flex items-center gap-2">
                                                    {group.name}
                                                    <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full font-bold">{groupLocations.length}</span>
                                                </span>
                                            )}
                                            <div className="flex gap-1">
                                                <button onClick={() => setEditGroupId(group.id)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-white rounded-lg transition"><Edit2 size={14} /></button>
                                                <button onClick={() => handleDeleteGroup(group.id)} className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-white rounded-lg transition"><Trash2 size={14} /></button>
                                            </div>
                                        </div>
                                        {/* Locations inside Group */}
                                        <div className="bg-white divide-y divide-gray-50">
                                            {groupLocations.length === 0 ? (
                                                <div className="p-4 text-xs text-center text-gray-400 font-bold">등록된 공간이 없습니다.</div>
                                            ) : (
                                                groupLocations.map(loc => (
                                                    <div key={loc.id} className="flex items-center justify-between p-3 pl-6 hover:bg-blue-50/50 transition group/loc">
                                                        {editLocationId === loc.id ? (
                                                            <input defaultValue={loc.name} autoFocus onBlur={(e) => handleUpdateLocation(loc.id, e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleUpdateLocation(loc.id, e.currentTarget.value)} className="flex-1 bg-white border border-blue-300 rounded px-2 py-1 outline-none text-sm font-bold" />
                                                        ) : (
                                                            <span className="text-sm text-gray-600 font-bold">{loc.name}</span>
                                                        )}
                                                        <div className="flex gap-1 opacity-0 group-hover/loc:opacity-100 transition">
                                                            <button onClick={() => setEditLocationId(loc.id)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-100 rounded-lg"><Edit2 size={14} /></button>
                                                            <button onClick={() => handleDeleteLocation(loc.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Unassigned Locations */}
                            {locations.filter(l => !l.group_id).length > 0 && (
                                <div className="border border-orange-200 rounded-xl overflow-hidden shadow-sm">
                                    <div className="bg-orange-50 p-3 md:p-4 flex items-center justify-between">
                                        <span className="text-sm md:text-base text-orange-800 font-extrabold">소속 없는 공간</span>
                                        <span className="text-xs bg-orange-200 text-orange-800 px-2 py-0.5 rounded-full font-bold">{locations.filter(l => !l.group_id).length}</span>
                                    </div>
                                    <div className="bg-white divide-y divide-gray-50">
                                        {locations.filter(l => !l.group_id).map(loc => (
                                            <div key={loc.id} className="flex items-center justify-between p-3 pl-6 hover:bg-orange-50/50 transition group/loc">
                                                {editLocationId === loc.id ? (
                                                    <input defaultValue={loc.name} autoFocus onBlur={(e) => handleUpdateLocation(loc.id, e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleUpdateLocation(loc.id, e.currentTarget.value)} className="flex-1 bg-white border border-orange-300 rounded px-2 py-1 outline-none text-sm font-bold" />
                                                ) : (
                                                    <span className="text-sm text-gray-600 font-bold">{loc.name}</span>
                                                )}
                                                <div className="flex gap-1 opacity-0 group-hover/loc:opacity-100 transition">
                                                    <button onClick={() => setEditLocationId(loc.id)} className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-100 rounded-lg"><Edit2 size={14} /></button>
                                                    <button onClick={() => handleDeleteLocation(loc.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center py-12">
                        <Settings size={48} className="text-gray-200 mb-4" />
                        <h3 className="font-bold text-gray-400">마스터 권한이 필요한 메뉴입니다</h3>
                        <p className="text-xs text-gray-400 mt-2">공간 관리 및 시스템 설정은 마스터 계정만 가능합니다.</p>
                    </div>
                )}
            </div>

            {/* Integration & Layout Settings (Master Only) */}
            {isMaster && (
                <>
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
                                    {isBackingUp ? '동기화 중...' : <><Database size={16} /> 모든 데이터 시트 동기화</>}
                                </button>
                                {syncProgress && (
                                    <p className="text-xs text-blue-600 font-bold animate-pulse text-center">{syncProgress}</p>
                                )}
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

                            {/* Kiosk Master Pin */}
                            <div className="space-y-4 p-4 bg-blue-50/50 rounded-2xl border border-blue-100 md:col-span-2">
                                <div className="flex items-center gap-2 text-blue-600 font-bold mb-2">
                                    <ShieldAlert size={18} />
                                    <span>키오스크 보안 설정</span>
                                </div>
                                <div className="flex flex-col md:flex-row items-end gap-4">
                                    <div className="flex-1 w-full">
                                        <label className="block text-[10px] font-bold text-gray-500 mb-1 ml-1">키오스크 마스터 핀 (4자리 숫자)</label>
                                        <input
                                            type="password"
                                            maxLength="4"
                                            value={kioskMasterPin}
                                            onChange={e => setKioskMasterPin(e.target.value.replace(/[^0-9]/g, ''))}
                                            placeholder="1801"
                                            className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:border-blue-500 transition text-sm font-mono tracking-widest"
                                        />
                                    </div>
                                    <button
                                        onClick={handleSaveIntegrations}
                                        className="w-full md:w-auto px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition shadow-sm text-sm"
                                    >
                                        마스터 핀 저장
                                    </button>
                                </div>
                                <p className="text-[10px] text-gray-400 leading-relaxed">* 키오스크 진입 및 설정 변경 시 필요한 비밀번호입니다. 유출되지 않도록 주의하세요.</p>
                            </div>
                        </div>
                    </div>

                    {/* Dashboard Layout Customization */}
                    <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-base md:text-lg text-gray-700 flex items-center gap-2"><Layout size={20} /> 학생 대시보드 레이아웃 설정</h3>
                            <button
                                onClick={handleSaveDashboardConfig}
                                disabled={configLoading}
                                className="text-xs bg-blue-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-blue-700 transition shadow-md disabled:bg-gray-300"
                            >
                                {configLoading ? '저장 중...' : '레이아웃 저장'}
                            </button>
                        </div>

                        <div className="space-y-3">
                            {dashboardConfig.map((item, index) => (
                                <div key={item.id} className={`flex items-center justify-between p-4 rounded-2xl border transition ${item.isVisible ? 'bg-white border-gray-100 shadow-sm' : 'bg-gray-50 border-transparent opacity-60'}`}>
                                    <div className="flex items-center gap-4">
                                        <div className="flex flex-col gap-1">
                                            <button
                                                onClick={() => handleMoveConfig(index, -1)}
                                                disabled={index === 0}
                                                className="p-1 text-gray-400 hover:text-blue-600 disabled:opacity-0"
                                            ><ArrowUp size={16} /></button>
                                            <button
                                                onClick={() => handleMoveConfig(index, 1)}
                                                disabled={index === dashboardConfig.length - 1}
                                                className="p-1 text-gray-400 hover:text-blue-600 disabled:opacity-0"
                                            ><ArrowDown size={16} /></button>
                                        </div>
                                        <div>
                                            <span className="font-bold text-gray-700 block">{item.label}</span>
                                            <span className="text-[10px] text-gray-400 uppercase font-bold">{item.id}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-gray-500">노출 개수</span>
                                            <input
                                                type="number"
                                                min="1"
                                                max="20"
                                                value={item.count}
                                                onChange={(e) => handleUpdateConfig(item.id, 'count', parseInt(e.target.value) || 1)}
                                                className="w-16 p-2 bg-gray-50 border border-gray-100 rounded-lg text-center text-sm font-bold outline-none focus:border-blue-500"
                                            />
                                        </div>
                                        <button
                                            onClick={() => handleUpdateConfig(item.id, 'isVisible', !item.isVisible)}
                                            className={`p-2.5 rounded-xl transition-all ${item.isVisible ? 'bg-blue-50 text-blue-600 shadow-sm' : 'bg-gray-200 text-gray-500'}`}
                                        >
                                            {item.isVisible ? <Eye size={18} /> : <EyeOff size={18} />}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <p className="mt-4 text-[10px] text-gray-400 leading-relaxed">* 학생 대시보드 홈 탭에 표시되는 섹션의 순서와 노출 개수를 설정합니다. 상하 화살표로 순서를 변경하세요.</p>
                    </div>

                    {/* Admin Sidebar Layout Customization */}
                    <div className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-base md:text-lg text-gray-700 flex items-center gap-2"><Layout size={20} /> 관리자 사이드바 메뉴 설정</h3>
                            <button
                                onClick={handleSaveSidebarConfig}
                                disabled={sidebarConfigLoading}
                                className="text-xs bg-blue-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-blue-700 transition shadow-md disabled:bg-gray-300"
                            >
                                {sidebarConfigLoading ? '저장 중...' : '사이드바 저장'}
                            </button>
                        </div>

                        <div className="space-y-3">
                            {sidebarConfig.map((item, index) => (
                                <div key={item.id} className={`flex items-center justify-between p-4 rounded-2xl border transition ${item.isVisible ? 'bg-white border-gray-100 shadow-sm' : 'bg-gray-50 border-transparent opacity-60'}`}>
                                    <div className="flex items-center gap-4">
                                        <div className="flex flex-col gap-1">
                                            <button
                                                onClick={() => handleMoveSidebarConfig(index, -1)}
                                                disabled={index === 0}
                                                className="p-1 text-gray-400 hover:text-blue-600 disabled:opacity-0"
                                            ><ArrowUp size={16} /></button>
                                            <button
                                                onClick={() => handleMoveSidebarConfig(index, 1)}
                                                disabled={index === sidebarConfig.length - 1}
                                                className="p-1 text-gray-400 hover:text-blue-600 disabled:opacity-0"
                                            ><ArrowDown size={16} /></button>
                                        </div>
                                        <div>
                                            <span className="font-bold text-gray-700 block">{item.label}</span>
                                            <span className="text-[10px] text-gray-400 uppercase font-bold">{item.id}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-6">
                                        <button
                                            onClick={() => handleUpdateSidebarConfig(item.id, 'isVisible', !item.isVisible)}
                                            className={`p-2.5 rounded-xl transition-all ${item.isVisible ? 'bg-blue-50 text-blue-600 shadow-sm' : 'bg-gray-200 text-gray-500'}`}
                                        >
                                            {item.isVisible ? <Eye size={18} /> : <EyeOff size={18} />}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <p className="mt-4 text-[10px] text-gray-400 leading-relaxed">* 관리자 메뉴의 순서와 노출 여부를 설정합니다. 상하 화살표로 순서를 변경하세요.</p>
                    </div>
                </>
            )}

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
