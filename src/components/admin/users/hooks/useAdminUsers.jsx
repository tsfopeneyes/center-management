import { useState, useMemo, useEffect } from 'react';
import { supabase } from '../../../../supabaseClient';
import { getUserCategory } from '../../../../utils/userCategory';
import { hashPassword } from '../../../../utils/hashUtils';
import { getAccountAuthClient, isAccountAuthEnabled } from '../../../../auth/accountAuthRuntime';
import { listPendingGuestLinks } from '../../../../api/userMergeApi';
import { isAdminOrStaff, isMasterStaff } from '../../../../utils/userUtils';
import { buildSchoolLookup, resolveUserSchool } from '../../../../utils/userSchoolUtils';

const useAdminUsers = ({ users, allLogs, locations, fetchData, currentAdmin }) => {
    // 1. Search & Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [filterGroup, setFilterGroup] = useState('ALL');
    const [filterRegion, setFilterRegion] = useState('ALL');
    const [excludeLeaders, setExcludeLeaders] = useState(false);
    const [showOnlyNonSchoolChurch, setShowOnlyNonSchoolChurch] = useState(false);
    const [showOnlyNew3Months, setShowOnlyNew3Months] = useState(false);

    // 2. Selection & Bulk Update State
    const [selectedUserIds, setSelectedUserIds] = useState(new Set());
    const [bulkTargetGroup, setBulkTargetGroup] = useState('졸업생');
    const [sendingBulk, setSendingBulk] = useState(false);

    // 3. Modal Opening State
    const [editingUser, setEditingUser] = useState(null);
    const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
    const [notificationModalOpen, setNotificationModalOpen] = useState(false);
    const [viewerImage, setViewerImage] = useState(null);
    const [linkReviews,setLinkReviews]=useState(new Map());
    const [schools, setSchools] = useState([]);
    useEffect(()=>{let active=true;if(!isAccountAuthEnabled()){setLinkReviews(new Map());return()=>{active=false;};}
        listPendingGuestLinks().then(reviews=>{if(!active)return;const mapped=new Map();for(const review of reviews){
            mapped.set(review.newProfileId,review);for(const candidate of review.candidates||[])mapped.set(candidate.profileId,review);}setLinkReviews(mapped);
        }).catch(()=>{if(active)setLinkReviews(new Map());});return()=>{active=false;};},[users]);

    useEffect(() => {
        let active = true;
        supabase.from('schools').select('id,name,region').then(({ data, error }) => {
            if (!active) return;
            if (error) {
                console.error('Failed to load schools for user regions:', error);
                setSchools([]);
                return;
            }
            setSchools(data || []);
        });
        return () => { active = false; };
    }, [users]);

    const usersWithSchool = useMemo(() => {
        const schoolLookup = buildSchoolLookup(schools);

        return (users || []).map(user => {
            const resolved = resolveUserSchool(user, schoolLookup);
            return {
                ...user,
                school_id: resolved.schoolId,
                schoolRecord: resolved.school,
                schoolRegion: resolved.region,
                schoolDisplayName: resolved.schoolName
            };
        });
    }, [users, schools]);

    // Filter Logic
    const filteredUsers = useMemo(() => {
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

        const checkIsNew3M = (u) => {
            if (!u || !u.created_at) return false;
            const dt = new Date(u.created_at);
            return !isNaN(dt.getTime()) && dt >= threeMonthsAgo;
        };

        const isGuestOrTemporary = (user) => !isAdminOrStaff(user) && (
            user.user_group === '게스트'
            || user.user_group === '미가입'
            || user.preferences?.is_temporary === true
        );

        const needsGuestLinkReview = (user) => {
            const review = linkReviews.get(user.id);
            return Boolean(review) && isGuestOrTemporary(user) && review.newProfileId !== user.id;
        };

        const rawFiltered = usersWithSchool.filter(user => {
            if (user.status === 'withdrawn') return false;
            // Calculate Age from YYMMDD
            let age = '';
            if (user.birth && user.birth.length === 6) {
                const yy = parseInt(user.birth.substring(0, 2));
                const currentYear = new Date().getFullYear();
                const fullYear = yy <= 40 ? 2000 + yy : 1900 + yy;
                age = (currentYear - fullYear + 1).toString();
            }

            const normalizedSearch = searchTerm.trim().toLocaleLowerCase('ko-KR');
            const cleanSearch = normalizedSearch.replace(/세|살/g, '');
            const matchesAge = age && age.includes(cleanSearch);
            const matchesText = (value) => String(value || '').toLocaleLowerCase('ko-KR').includes(normalizedSearch);

            const matchesSearch =
                matchesText(user.name) ||
                matchesText(user.phone_back4) ||
                matchesText(user.school) ||
                matchesText(user.church) ||
                matchesText(user.user_group) || matchesText(getUserCategory(user)) ||
                matchesText(user.role) ||
                (age && age === cleanSearch) || matchesAge;

            const isGuestOrTemp = isGuestOrTemporary(user);
            const isNew3M = checkIsNew3M(user);

            const matchesGroup = filterGroup === 'ALL'
                ? !isGuestOrTemp
                : filterGroup === 'NEW_3M'
                    ? isNew3M && !isGuestOrTemp
                    : filterGroup === 'LEADER'
                        ? getUserCategory(user) === '리더'
                        : filterGroup === 'TEMP_GUEST'
                            ? getUserCategory(user) === '게스트'
                            : getUserCategory(user) === filterGroup && !isGuestOrTemp;

            const isExcludedLeader = excludeLeaders && user.is_leader === true;
            const isNonSchoolChurchFilter = showOnlyNonSchoolChurch && user.preferences?.is_school_church === true;
            const isNew3MFilterMismatch = showOnlyNew3Months && !isNew3M;
            const matchesRegion = filterRegion === 'ALL' || user.schoolRegion === filterRegion;
            return matchesSearch && matchesGroup && matchesRegion && !isExcludedLeader && !isNonSchoolChurchFilter && !isNew3MFilterMismatch;
        }).sort((a, b) => {
            const isAGuestLinkReview = needsGuestLinkReview(a);
            const isBGuestLinkReview = needsGuestLinkReview(b);

            if (isAGuestLinkReview && !isBGuestLinkReview) return -1;
            if (!isAGuestLinkReview && isBGuestLinkReview) return 1;

            const isAPending = a.status === 'pending';
            const isBPending = b.status === 'pending';

            if (isAPending && !isBPending) return -1;
            if (!isAPending && isBPending) return 1;

            const nameA = a.name || '';
            const nameB = b.name || '';
            const isAKorean = /^[가-힣]/.test(nameA);
            const isBKorean = /^[가-힣]/.test(nameB);

            if (isAKorean && !isBKorean) return -1;
            if (!isAKorean && isBKorean) return 1;

            return nameA.localeCompare(nameB, 'ko-KR');
        });

        return rawFiltered.map(user => {
            const userLogs = (allLogs || []).filter(l => l.user_id === user.id);
            const latestLog = [...userLogs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

            let lastActiveTime = null;
            let hasWebRecord = false;
            if (user.preferences?.last_web_login_at) {
                lastActiveTime = new Date(user.preferences.last_web_login_at);
                hasWebRecord = true;
            }

            let formatted = '기록 없음';
            if (lastActiveTime) {
                const todayStr = new Date().toLocaleDateString('ko-KR');
                const targetStr = lastActiveTime.toLocaleDateString('ko-KR');
                if (todayStr === targetStr) {
                    formatted = `오늘 ${lastActiveTime.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
                } else {
                    const m = lastActiveTime.getMonth() + 1;
                    const d = lastActiveTime.getDate();
                    const hh = String(lastActiveTime.getHours()).padStart(2, '0');
                    const mm = String(lastActiveTime.getMinutes()).padStart(2, '0');
                    formatted = `${m}/${d} ${hh}:${mm}`;
                }
            }

            return {
                ...user,
                needsLinkReview:linkReviews.has(user.id),linkReview:linkReviews.get(user.id)||null,
                isNew3M: checkIsNew3M(user),
                lastActiveAt: lastActiveTime ? lastActiveTime.toISOString() : null,
                lastActiveFormatted: formatted,
                hasWebRecord
            };
        });
    }, [usersWithSchool, searchTerm, filterGroup, filterRegion, excludeLeaders, showOnlyNonSchoolChurch, showOnlyNew3Months, allLogs,linkReviews]);

    // Selection Logic
    const toggleSelectAll = () => {
        if (selectedUserIds.size === filteredUsers.length) {
            setSelectedUserIds(new Set());
        } else {
            setSelectedUserIds(new Set(filteredUsers.map(u => u.id)));
        }
    };

    const toggleSelectUser = (id) => {
        const newSet = new Set(selectedUserIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedUserIds(newSet);
    };

    // Handlers
    const handleBulkUpdateGroup = async (newGroup) => {
        if (selectedUserIds.size === 0) return;
        if (!confirm(`선택한 ${selectedUserIds.size}명의 그룹을 '${newGroup}'(으)로 변경하시겠습니까?`)) return;

        setSendingBulk(true);
        try {
            const { error } = await supabase
                .from('users')
                .update({ user_group: newGroup })
                .in('id', Array.from(selectedUserIds));

            if (error) throw error;

            alert('일괄 변경이 완료되었습니다.');
            setSelectedUserIds(new Set());
            fetchData();
        } catch (err) {
            console.error(err);
            alert('일괄 변경 실패: ' + err.message);
        } finally {
            setSendingBulk(false);
        }
    };

    const handleDeleteUser = async (targetUser) => {
        if (!targetUser) return false;
        const currentUser = JSON.parse(localStorage.getItem('user'));
        if (currentUser && currentUser.id === targetUser.id) {
            alert('본인 계정은 삭제할 수 없습니다.');
            return false;
        }

        if (!confirm(`정말 '${targetUser.name}' 이용자를 삭제하시겠습니까?\n로그인 정보와 이름·연락처 등 개인정보는 삭제되며 복구할 수 없습니다.\n출결·프로그램 참여 등 운영 기록은 개인을 식별할 수 없는 형태로 보존됩니다.`)) return false;
        try {
            if (isAccountAuthEnabled()) await getAccountAuthClient().members.withdraw({ profileId: targetUser.id });
            else {
                const label = `삭제된 회원 (${targetUser.id.slice(0, 8)})`;
                const { error } = await supabase.from('users').update({
                    name: label, gender: null, school: null, church: null, birth: null, phone: '',
                    phone_back4: '', password: null, guardian_name: null, guardian_phone: null,
                    guardian_relation: null, profile_image_url: null, fcm_token: null, bio: null,
                    grade: null, memo: null,
                    auth_user_id: null, status: 'withdrawn',
                    preferences: { withdrawn_at: new Date().toISOString(), anonymized: true }
                }).eq('id', targetUser.id);
                if (error) throw error;
            }
            alert('회원이 삭제되었습니다.');
            setEditingUser(null);
            fetchData();
            return true;
        } catch (err) {
            console.error(err);
            const errorCode=err?.code||err?.message;
            const message=errorCode==='cannot_withdraw_self'
                ?'현재 로그인한 본인 계정은 삭제할 수 없습니다.'
                :errorCode==='protected_staff_account'
                    ?'최고관리자만 다른 관리자 계정을 삭제할 수 있습니다.'
                    :errorCode==='last_master_account'
                        ?'마지막 최고관리자 계정은 삭제할 수 없습니다.'
                    :errorCode==='staff_access_changed'||errorCode==='forbidden'
                        ?'관리자 권한이 변경되었습니다. 다시 로그인한 뒤 시도해주세요.'
                :err?.code==='invalid_login'||err?.message==='invalid_login'
                    ?'관리자 로그인 확인이 필요합니다. 다시 로그인한 뒤 시도해주세요.'
                    :err?.message||'이용자 삭제를 완료하지 못했습니다.';
            alert('삭제 실패: '+message);
            return false;
        }
    };

    const handleRemoveAdminRole = async (targetUser) => {
        if (!targetUser || !isAccountAuthEnabled()) return false;
        if (!isMasterStaff(currentAdmin)) {
            alert('최고관리자만 관리자 권한을 해제할 수 있습니다.');
            return false;
        }
        if (currentAdmin.id === targetUser.id) {
            alert('현재 로그인한 본인의 최고관리자 권한은 이 화면에서 해제할 수 없습니다.');
            return false;
        }
        if (!confirm(`'${targetUser.name}' 계정의 관리자 권한을 해제하고 일반 이용자로 변경하시겠습니까?`)) return false;
        try {
            await getAccountAuthClient().members.setRole({
                profileId: targetUser.id,
                targetRole: 'member',
                reason: 'remove_admin_before_withdrawal'
            });
            alert('관리자 권한을 해제했습니다. 이제 이 계정을 삭제할 수 있습니다.');
            setEditingUser(current => current?.id === targetUser.id
                ? { ...current, account_role: 'member' }
                : current);
            await fetchData();
            return true;
        } catch (err) {
            console.error(err);
            const code = err?.code || err?.message;
            const message = code === 'forbidden'
                ? '현재 로그인한 계정에 최고관리자 권한이 없거나, 마지막 최고관리자 권한은 해제할 수 없습니다.'
                : code === 'account_changed'
                    ? '계정 상태가 변경되었습니다. 새로고침 후 다시 시도해주세요.'
                    : err?.message || '최고관리자 권한과 계정 상태를 확인해주세요.';
            alert('권한 변경 실패: ' + message);
            return false;
        }
    };

    const handleResetPassword = async (targetUser) => {
        if (!targetUser) return;
        let phoneBack4 = targetUser.phone_back4;
        if (!phoneBack4 && targetUser.phone) {
            const parts = targetUser.phone.split('-');
            phoneBack4 = parts[parts.length - 1];
        }
        if (!phoneBack4 || phoneBack4.length !== 4) {
            alert('비밀번호 초기화를 위한 휴대폰 번호(뒷4자리) 정보가 올바르지 않습니다.');
            return;
        }
        if (!confirm(`'${targetUser.name}' 회원의 비밀번호를 휴대폰 뒷 4자리(${phoneBack4})로 초기화하시겠습니까?`)) return;

        try {
            if (isAccountAuthEnabled()) {
                await getAccountAuthClient().adminReset({ profileId: targetUser.id });
                alert('비밀번호가 초기화되었습니다. 회원은 임시 비밀번호로 로그인한 뒤 새 비밀번호를 설정할 수 있습니다.');
                return;
            }
            const hashedPassword = await hashPassword(phoneBack4);
            const { error } = await supabase.from('users').update({
                password: hashedPassword
            }).eq('id', targetUser.id);

            if (error) throw error;
            alert('비밀번호가 초기화되었습니다.');
        } catch (err) {
            console.error(err);
            alert('초기화 실패: ' + err.message);
        }
    };

    const handleApproveUser = async (user) => {
        if (!confirm(`'${user.name}' 회원을 정식 회원으로 승인하시겠습니까?`)) return;
        try {
            const { error } = await supabase.from('users').update({ status: 'approved' }).eq('id', user.id);
            if (error) throw error;
            alert('회원 승인이 완료되었습니다.');
            fetchData();
        } catch (err) { alert('승인 실패'); }
    };

    // Calculate specific user stats for the active editing modal
    const getUserStats = (userId) => {
        if (!userId || !allLogs) return null;
        const userLogs = allLogs.filter(log => log.user_id === userId);
        const now = new Date();
        const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
        const oneMonthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

        let weeklyHours = 0, monthlyHours = 0, totalHours = 0;
        const locationCounts = {};
        const sortedLogs = [...userLogs].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        let lastCheckIn = null;

        sortedLogs.forEach(log => {
            if (log.type === 'CHECKIN') {
                lastCheckIn = new Date(log.created_at);
                if (log.location_id) locationCounts[log.location_id] = (locationCounts[log.location_id] || 0) + 1;
            } else if (log.type === 'CHECKOUT' && lastCheckIn) {
                const checkOut = new Date(log.created_at);
                const duration = (checkOut - lastCheckIn) / (1000 * 60 * 60);
                if (duration > 0 && duration < 24) {
                    totalHours += duration;
                    if (checkOut >= oneWeekAgo) weeklyHours += duration;
                    if (checkOut >= oneMonthAgo) monthlyHours += duration;
                }
                lastCheckIn = null;
            } else if (log.type === 'MOVE') {
                if (log.location_id) locationCounts[log.location_id] = (locationCounts[log.location_id] || 0) + 1;
            }
        });

        const topLocId = Object.keys(locationCounts).reduce((a, b) => locationCounts[a] > locationCounts[b] ? a : b, null);
        const topLocation = (locations || []).find(l => l.id === topLocId)?.name || '-';

        return { weekly: Math.round(weeklyHours), monthly: Math.round(monthlyHours), total: Math.round(totalHours), topLocation };
    };

    return {
        // State
        searchTerm, setSearchTerm,
        filterGroup, setFilterGroup,
        filterRegion, setFilterRegion,
        excludeLeaders, setExcludeLeaders,
        showOnlyNonSchoolChurch, setShowOnlyNonSchoolChurch,
        showOnlyNew3Months, setShowOnlyNew3Months,
        selectedUserIds, setSelectedUserIds,
        bulkTargetGroup, setBulkTargetGroup,
        sendingBulk,
        editingUser, setEditingUser,
        isMergeModalOpen, setIsMergeModalOpen,
        notificationModalOpen, setNotificationModalOpen,
        viewerImage, setViewerImage,
        
        // Data Outputs
        filteredUsers,
        getUserStats,
        
        // Handlers
        toggleSelectAll,
        toggleSelectUser,
        handleBulkUpdateGroup,
        handleDeleteUser,
        handleRemoveAdminRole,
        handleResetPassword,
        handleApproveUser
    };
};

export default useAdminUsers;
