import { useState, useEffect } from 'react';
import { supabase } from '../../../../supabaseClient';
import getCroppedImg, { compressImage } from '../../../../utils/imageUtils';
import { hashPassword } from '../../../../utils/hashUtils';
import { CATEGORIES } from '../../../../constants/appConstants';
import { uploadSummaryToNotion, performFullSyncToGoogleSheets } from '../../../../utils/integrationUtils';
import { processAnalyticsData, processUserAnalytics, processProgramAnalytics } from '../../../../utils/analyticsUtils';
import { aggregateVisitSessions } from '../../../../utils/visitUtils';

const useAdminSettings = ({ currentAdmin, locations, locationGroups, fetchData, users, allLogs, responses, schoolLogs, notices }) => {
    // 1. Profile State
    const [profileImage, setProfileImage] = useState(null);
    const [profilePreview, setProfilePreview] = useState(null);
    const [newAdminPassword, setNewAdminPassword] = useState('');
    const [confirmAdminPassword, setConfirmAdminPassword] = useState('');
    const [profileLoading, setProfileLoading] = useState(false);

    // Cropper State
    const [showEditor, setShowEditor] = useState(false);
    const [editorImageSrc, setEditorImageSrc] = useState(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

    // 2. Integration State
    const [gsWebhookUrl, setGsWebhookUrl] = useState(localStorage.getItem('gs_webhook_url') || '');
    const [notionApiKey, setNotionApiKey] = useState(localStorage.getItem('notion_api_key') || '');
    const [notionDbId, setNotionDbId] = useState(localStorage.getItem('notion_db_id') || '');
    const [kioskMasterPin, setKioskMasterPin] = useState(localStorage.getItem('kiosk_master_pin') || '1801');
    const [isBackingUp, setIsBackingUp] = useState(false);
    const [isUploadingNotion, setIsUploadingNotion] = useState(false);
    const [syncProgress, setSyncProgress] = useState('');
    const [isBadgeSystemEnabled, setIsBadgeSystemEnabled] = useState(true);

    // 3. Location State
    const [tempGroupName, setTempGroupName] = useState('');
    const [editGroupId, setEditGroupId] = useState(null);
    const [selectedGroupIdForLocation, setSelectedGroupIdForLocation] = useState('');
    const [tempLocationName, setTempLocationName] = useState('');
    const [editLocationId, setEditLocationId] = useState(null);

    // 4. Layout State
    const [dashboardConfig, setDashboardConfig] = useState([
        { id: 'stats', label: '활동 통계', isVisible: true, count: 3 },
        { id: 'programs', label: '프로그램 신청', isVisible: true, count: 3 },
        { id: 'notices', label: '공지사항', isVisible: true, count: 3 }
    ]);
    const [sidebarConfig, setSidebarConfig] = useState([
        { id: 'STATUS', label: '공간 현황', isVisible: true },
        { id: 'CALENDAR', label: '일정 관리', isVisible: true },
        { id: 'PROGRAMS', label: '프로그램 관리', isVisible: true },
        { id: 'BOARD', label: '공지사항', isVisible: true },
        { id: 'USERS', label: '이용자 관리', isVisible: true },
        { id: 'SCHOOLS', label: '학교 관리', isVisible: true },
        { id: 'BADGES', label: '뱃지 관리', isVisible: true },
        { id: 'STATISTICS', label: '통계', isVisible: true },
        { id: 'LOGS', label: '로그', isVisible: true },
        { id: 'REPORTS', label: '운영 리포트', isVisible: true },
        { id: 'SETTINGS', label: '설정', isVisible: true }
    ]);
    const [tabConfig, setTabConfig] = useState([
        { id: 'home', label: '홈', isVisible: true },
        { id: 'badges', label: '뱃지', isVisible: true },
        { id: 'programs', label: '센터', isVisible: true },
        { id: 'calendar', label: '캘린더', isVisible: true },
        { id: 'azit', label: '커뮤니티', isVisible: true },
        { id: 'hyphen', label: '하이픈', isVisible: true }
    ]);
    const [configLoading, setConfigLoading] = useState(false);
    const [sidebarConfigLoading, setSidebarConfigLoading] = useState(false);
    const [tabConfigLoading, setTabConfigLoading] = useState(false);

    // 5. Operating Hours State
    const defaultHours = {
        monday: { isOpen: false, open: '10:00', close: '19:00', label: '월요일' },
        tuesday: { isOpen: true, open: '10:00', close: '19:00', label: '화요일' },
        wednesday: { isOpen: true, open: '10:00', close: '19:00', label: '수요일' },
        thursday: { isOpen: true, open: '10:00', close: '19:00', label: '목요일' },
        friday: { isOpen: true, open: '10:00', close: '19:00', label: '금요일' },
        saturday: { isOpen: true, open: '10:00', close: '19:00', label: '토요일' },
        sunday: { isOpen: false, open: '10:00', close: '19:00', label: '일요일' }
    };
    const [operatingHours, setOperatingHours] = useState(defaultHours);
    const [hoursLoading, setHoursLoading] = useState(false);

    // 6. Staff Presence Config State
    const [selectedStaffConfig, setSelectedStaffConfig] = useState({ "하이픈": [], "이높플레이스": [] });
    const [staffSaving, setStaffSaving] = useState(false);


    // --- EFFECT: Load Layout Configurations ---
    useEffect(() => {
        const loadConfigs = async () => {
            const { data: dbData } = await supabase
                .from('notices')
                .select('content')
                .eq('category', CATEGORIES.SYSTEM)
                .eq('title', 'STUDENT_DASHBOARD_CONFIG')
                .maybeSingle();

            if (dbData?.content) {
                try {
                    const parsed = JSON.parse(dbData.content);
                    // Filter out GALLERY if it exists in old configs
                    if (Array.isArray(parsed)) setDashboardConfig(parsed.filter(c => c.id !== 'gallery'));
                } catch (e) { console.error(e); }
            }

            const { data: sbData } = await supabase
                .from('notices')
                .select('content')
                .eq('category', CATEGORIES.SYSTEM)
                .eq('title', 'ADMIN_SIDEBAR_CONFIG')
                .maybeSingle();

            if (sbData?.content) {
                try {
                    const parsed = JSON.parse(sbData.content);
                    if (Array.isArray(parsed)) {
                        const filteredParsed = parsed.filter(c => c.id !== 'GALLERY');
                        const merged = sidebarConfig.map(def => {
                            const found = filteredParsed.find(p => p.id === def.id);
                            let mergedItem = found ? { ...def, ...found } : def;
                            if (mergedItem.id === 'BADGES') mergedItem.label = '뱃지 관리';
                            if (mergedItem.id === 'badges') mergedItem.label = '뱃지';
                            return mergedItem;
                        });
                        const ordered = [
                            ...filteredParsed.map(p => merged.find(m => m.id === p.id)).filter(Boolean),
                            ...merged.filter(m => !filteredParsed.find(p => p.id === m.id))
                        ];
                        setSidebarConfig(ordered.filter(c => c.id !== 'GALLERY'));
                    }
                } catch (e) { console.error(e); }
            }

            const { data: tabData } = await supabase
                .from('notices')
                .select('content')
                .eq('category', CATEGORIES.SYSTEM)
                .eq('title', 'STUDENT_TAB_CONFIG')
                .maybeSingle();

            if (tabData?.content) {
                try {
                    const parsed = JSON.parse(tabData.content);
                    if (Array.isArray(parsed)) {
                        const defaultTabs = [
                            { id: 'home', label: '홈', isVisible: true },
                            { id: 'badges', label: '뱃지', isVisible: true },
                            { id: 'programs', label: '센터', isVisible: true },
                            { id: 'calendar', label: '캘린더', isVisible: true },
                            { id: 'azit', label: '커뮤니티', isVisible: true },
                            { id: 'hyphen', label: '하이픈', isVisible: true }
                        ];
                        const merged = defaultTabs.map(def => {
                            const found = parsed.find(p => p.id === def.id);
                            let mergedItem = found ? { ...def, ...found } : def;
                            if (mergedItem.id === 'badges') mergedItem.label = '뱃지';
                            return mergedItem;
                        });
                        const ordered = [
                            ...parsed.map(p => merged.find(m => m.id === p.id)).filter(Boolean),
                            ...merged.filter(m => !parsed.find(p => p.id === m.id))
                        ];
                        setTabConfig(ordered);
                    }
                } catch (e) { console.error(e); }
            }
            const { data: hoursData } = await supabase
                .from('notices')
                .select('content')
                .eq('category', CATEGORIES.SYSTEM)
                .eq('title', 'OPERATING_HOURS_CONFIG')
                .maybeSingle();

            if (hoursData?.content) {
                try {
                    const parsed = JSON.parse(hoursData.content);
                    setOperatingHours(prev => ({ ...prev, ...parsed }));
                } catch (e) { console.error(e); }
            }

            const { data: staffData } = await supabase
                .from('notices')
                .select('content')
                .eq('category', CATEGORIES.SYSTEM)
                .eq('title', 'STAFF_PRESENCE_CONFIG')
                .maybeSingle();

            if (staffData?.content) {
                try {
                    const parsed = JSON.parse(staffData.content);
                    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                        setSelectedStaffConfig(parsed);
                    } else if (Array.isArray(parsed)) {
                        // Legacy fallback
                        setSelectedStaffConfig({
                            "하이픈": parsed,
                            "이높플레이스": parsed
                        });
                    }
                } catch (e) { 
                    console.error(e);
                    setSelectedStaffConfig({ "하이픈": [], "이높플레이스": [] });
                }
            }

            const { data: badgeData } = await supabase
                .from('notices')
                .select('content')
                .eq('category', CATEGORIES.SYSTEM)
                .eq('title', 'BADGE_SYSTEM_CONFIG')
                .maybeSingle();

            if (badgeData?.content) {
                try {
                    const parsed = JSON.parse(badgeData.content);
                    setIsBadgeSystemEnabled(parsed.enabled !== false);
                } catch (e) { console.error(e); }
            }

        };
        loadConfigs();
    }, []);

    // --- Profile Logics ---
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
        } catch (e) {
            console.error(e);
            alert('이미지 저장 실패');
        }
    };

    const handleSaveAdminProfile = async () => {
        if (!currentAdmin) return;
        setProfileLoading(true);
        try {
            let imageUrl = currentAdmin.profile_image_url;
            if (profileImage) {
                const compressedFile = await compressImage(profileImage);
                const fileExt = compressedFile.name.split('.').pop();
                const fileName = `admin_${currentAdmin.id}_${Date.now()}.${fileExt}`;
                const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, compressedFile);
                if (uploadError) throw uploadError;
                const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
                imageUrl = publicUrl;
            }

            let updates = { profile_image_url: imageUrl };
            if (newAdminPassword) {
                if (newAdminPassword.length < 4) { alert('비밀번호는 4자리 이상이어야 합니다.'); setProfileLoading(false); return; }
                if (newAdminPassword !== confirmAdminPassword) { alert('비밀번호가 일치하지 않습니다.'); setProfileLoading(false); return; }
                const hashedPassword = await hashPassword(newAdminPassword);
                updates.password = hashedPassword;
            }

            const { error } = await supabase.from('users').update(updates).eq('id', currentAdmin.id);
            if (error) throw error;

            const updatedAdmin = { ...currentAdmin, ...updates };
            localStorage.setItem('admin_user', JSON.stringify(updatedAdmin));
            alert('프로필이 업데이트되었습니다.');
            setProfileImage(null);
            setNewAdminPassword('');
            setConfirmAdminPassword('');
            window.location.reload();
        } catch (err) {
            console.error(err);
            alert('저장 실패: ' + err.message);
        } finally {
            setProfileLoading(false);
        }
    };

    // --- Location Logics ---
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

    const handleToggleGroupStatus = async (id, currentStatus) => {
        try {
            const newStatus = currentStatus === false ? true : false;
            const { error } = await supabase.from('location_groups').update({ is_active: newStatus }).eq('id', id);
            if (error) throw error;
            fetchData();
        } catch (err) { alert('그룹 상태 변경 실패: ' + err.message); }
    };

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

    const handleToggleLocationStatus = async (id, currentStatus) => {
        try {
            const newStatus = currentStatus === false ? true : false;
            const { error } = await supabase.from('locations').update({ is_active: newStatus }).eq('id', id);
            if (error) throw error;
            fetchData();
        } catch (err) { alert('상태 변경 실패: ' + err.message); }
    };

    // --- Integration Logics ---
    const handleSaveIntegrations = async () => {
        localStorage.setItem('gs_webhook_url', gsWebhookUrl);
        localStorage.setItem('notion_api_key', notionApiKey);
        localStorage.setItem('notion_db_id', notionDbId);
        localStorage.setItem('kiosk_master_pin', kioskMasterPin);
        
        try {
            const { data: existing } = await supabase
                .from('notices')
                .select('id')
                .eq('category', CATEGORIES.SYSTEM)
                .eq('title', 'BADGE_SYSTEM_CONFIG')
                .maybeSingle();
                
            const contentJson = JSON.stringify({ enabled: isBadgeSystemEnabled });
            
            if (existing?.id) {
                await supabase
                    .from('notices')
                    .update({ content: contentJson })
                    .eq('id', existing.id);
            } else {
                await supabase
                    .from('notices')
                    .insert([{
                        title: 'BADGE_SYSTEM_CONFIG',
                        content: contentJson,
                        category: CATEGORIES.SYSTEM,
                        is_recruiting: false,
                        is_sticky: false,
                        send_push: false
                    }]);
            }
        } catch (e) {
            console.error("Failed to save BADGE_SYSTEM_CONFIG:", e);
        }
        
        alert('연동 및 보안 설정이 저장되었습니다.');
    };

    const handleGoogleSheetsBackup = async () => {
        if (!gsWebhookUrl) return alert('구글 시트 웹훅 URL을 입력해주세요.');

        setIsBackingUp(true);
        setSyncProgress('Supabase에서 최신 데이터를 불러오는 중...');
        try {
            const latest = await fetchData();
            const currentUsers = latest?.users || users;
            const currentLogs = latest?.allLogs || allLogs;
            const currentResponses = latest?.responses || responses;
            const currentNotices = latest?.notices || notices;
            const currentLocations = latest?.locations || locations;
            const currentSchoolLogs = latest?.schoolLogs || schoolLogs;

            setSyncProgress('전송용 데이터 준비 및 전송 중...');

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

    // --- Config Logics ---
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

    const handleMoveTabConfig = (index, direction) => {
        const newConfig = [...tabConfig];
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= newConfig.length) return;
        const temp = newConfig[index];
        newConfig[index] = newConfig[targetIndex];
        newConfig[targetIndex] = temp;
        setTabConfig(newConfig);
    };

    const handleUpdateTabConfig = (id, field, value) => {
        setTabConfig(prev => prev.map(item =>
            item.id === id ? { ...item, [field]: value } : item
        ));
    };

    const handleSaveTabConfig = async () => {
        setTabConfigLoading(true);
        try {
            const { data: existing } = await supabase
                .from('notices')
                .select('id')
                .eq('category', CATEGORIES.SYSTEM)
                .eq('title', 'STUDENT_TAB_CONFIG')
                .maybeSingle();

            const payload = {
                title: 'STUDENT_TAB_CONFIG',
                content: JSON.stringify(tabConfig),
                category: CATEGORIES.SYSTEM,
                is_sticky: false,
                is_recruiting: false
            };

            if (existing) {
                await supabase.from('notices').update(payload).eq('id', existing.id);
            } else {
                await supabase.from('notices').insert([payload]);
            }
            alert('학생 하단 탭 메뉴 설정이 저장되었습니다.');
        } catch (err) {
            console.error(err);
            alert('저장 실패');
        } finally {
            setTabConfigLoading(false);
        }
    };

    const handleUpdateOperatingHours = (day, field, value) => {
        setOperatingHours(prev => ({
            ...prev,
            [day]: { ...prev[day], [field]: value }
        }));
    };

    const handleSaveOperatingHours = async () => {
        setHoursLoading(true);
        try {
            const { data: existing } = await supabase
                .from('notices')
                .select('id')
                .eq('category', CATEGORIES.SYSTEM)
                .eq('title', 'OPERATING_HOURS_CONFIG')
                .maybeSingle();

            const payload = {
                title: 'OPERATING_HOURS_CONFIG',
                content: JSON.stringify(operatingHours),
                category: CATEGORIES.SYSTEM,
                is_sticky: false,
                is_recruiting: false
            };

            if (existing) {
                await supabase.from('notices').update(payload).eq('id', existing.id);
            } else {
                await supabase.from('notices').insert([payload]);
            }
            alert('기본 운영 시간 설정이 저장되었습니다.');
        } catch (err) {
            console.error(err);
            alert('운영 시간 저장 실패');
        } finally {
            setHoursLoading(false);
        }
    };

    const handleSaveStaffPresenceConfig = async (staffConfig) => {
        setStaffSaving(true);
        try {
            const { data: existing } = await supabase
                .from('notices')
                .select('id')
                .eq('category', CATEGORIES.SYSTEM)
                .eq('title', 'STAFF_PRESENCE_CONFIG')
                .maybeSingle();

            const payload = {
                title: 'STAFF_PRESENCE_CONFIG',
                content: JSON.stringify(staffConfig),
                category: CATEGORIES.SYSTEM,
                is_sticky: false,
                is_recruiting: false
            };

            if (existing) {
                await supabase.from('notices').update(payload).eq('id', existing.id);
            } else {
                await supabase.from('notices').insert([payload]);
            }
            setSelectedStaffConfig(staffConfig);
            alert('스탭 설정이 저장되었습니다.');
        } catch (err) {
            console.error(err);
            alert('스탭 설정 저장 실패');
        } finally {
            setStaffSaving(false);
        }
    };

    return {
        profileImage, setProfileImage,
        profilePreview, setProfilePreview,
        newAdminPassword, setNewAdminPassword,
        confirmAdminPassword, setConfirmAdminPassword,
        profileLoading,
        showEditor, setShowEditor,
        editorImageSrc, setEditorImageSrc,
        crop, setCrop,
        zoom, setZoom,
        rotation, setRotation,
        croppedAreaPixels, setCroppedAreaPixels,
        handleAdminProfileImageSelect, handleSaveCroppedImage, handleSaveAdminProfile,

        gsWebhookUrl, setGsWebhookUrl,
        notionApiKey, setNotionApiKey,
        notionDbId, setNotionDbId,
        kioskMasterPin, setKioskMasterPin,
        isBackingUp, isUploadingNotion, syncProgress,
        handleSaveIntegrations, handleGoogleSheetsBackup, handleNotionUpload,

        tempGroupName, setTempGroupName,
        editGroupId, setEditGroupId,
        selectedGroupIdForLocation, setSelectedGroupIdForLocation,
        tempLocationName, setTempLocationName,
        editLocationId, setEditLocationId,
        handleAddGroup, handleUpdateGroup, handleDeleteGroup, handleToggleGroupStatus,
        handleAddLocation, handleUpdateLocation, handleDeleteLocation,
        handleToggleLocationStatus,

        dashboardConfig, sidebarConfig, tabConfig,
        configLoading, sidebarConfigLoading, tabConfigLoading,
        handleMoveConfig, handleUpdateConfig, handleSaveDashboardConfig,
        handleMoveSidebarConfig, handleUpdateSidebarConfig, handleSaveSidebarConfig,
        handleMoveTabConfig, handleUpdateTabConfig, handleSaveTabConfig,

        operatingHours, hoursLoading,
        handleUpdateOperatingHours, handleSaveOperatingHours,
        
        isBadgeSystemEnabled, setIsBadgeSystemEnabled,

        selectedStaffConfig, staffSaving,
        handleSaveStaffPresenceConfig
    };
};

export default useAdminSettings;
