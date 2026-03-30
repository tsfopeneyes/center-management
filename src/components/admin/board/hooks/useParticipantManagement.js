import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../../../../supabaseClient';
import { noticesApi } from '../../../../api/noticesApi';
import { hyphenApi } from '../../../../api/hyphenApi';
import { startOfDay } from 'date-fns';

const useParticipantManagement = (selectedNotice, onRefreshData) => {
    const [participantList, setParticipantList] = useState({ JOIN: [], DECLINE: [], UNDECIDED: [], WAITLIST: [] });
    const [pollModalResults, setPollModalResults] = useState(null);
    const [modalLoading, setModalLoading] = useState(false);
    
    // Walk-in search state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [showEntranceList, setShowEntranceList] = useState(false);
    const [lastAddedUser, setLastAddedUser] = useState(null);

    const fetchParticipants = useCallback(async (notice) => {
        if (!notice) return;
        setModalLoading(true);
        setPollModalResults(null);
        
        try {
            // Fetch normal RSVPs
            const { data, error } = await supabase
                .from('notice_responses')
                .select('status, is_attended, users(id, name, school, phone_back4)')
                .eq('notice_id', notice.id);
                
            if (error) throw error;
            
            const list = { JOIN: [], DECLINE: [], UNDECIDED: [], WAITLIST: [] };
            data?.forEach(r => {
                if (list[r.status]) {
                    list[r.status].push({ ...r.users, is_attended: r.is_attended });
                }
            });
            setParticipantList(list);

            // Fetch Poll Responses if applicable
            if (notice.is_poll) {
                const pollData = await noticesApi.fetchPollResponses(notice.id);
                const grouped = {};
                pollData?.forEach(resp => {
                    const optId = resp.option_id;
                    if (!grouped[optId]) grouped[optId] = [];
                    if (resp.users) {
                        grouped[optId].push(resp.users);
                    }
                });
                setPollModalResults(grouped);
            }
        } catch (err) {
            console.error(err);
            alert('명단 불러오기 실패: ' + err.message);
        } finally {
            setModalLoading(false);
        }
    }, []);

    const handleAttendanceToggle = async (userId, currentAttended) => {
        if (!selectedNotice) return;
        try {
            await noticesApi.updateAttendance(selectedNotice.id, userId, !currentAttended);
            
            // Hyphen Reward Logic
            if (selectedNotice.hyphen_reward && selectedNotice.hyphen_reward > 0) {
                const admin = JSON.parse(localStorage.getItem('admin_user'));
                const adminId = admin?.id || 'admin';
                if (!currentAttended) {
                    await hyphenApi.grantProgramReward(userId, selectedNotice.id, selectedNotice.hyphen_reward, adminId, selectedNotice.title);
                } else {
                    await hyphenApi.revokeProgramReward(userId, selectedNotice.title);
                }
            }

            setParticipantList(prev => {
                const next = { ...prev };
                next.JOIN = next.JOIN.map(u => u.id === userId ? { ...u, is_attended: !currentAttended } : u);
                return next;
            });
        } catch (err) {
            console.error(err);
            alert('출석 상태 변경 실패: ' + err.message);
        }
    };

    const handleDeleteParticipant = async (userId, userName) => {
        if (!selectedNotice) return;
        if (!window.confirm(`[${userName}] 학생의 신청 내역을 정말 삭제하시겠습니까?`)) return;
        try {
            await noticesApi.deleteResponse(selectedNotice.id, userId);
            setParticipantList(prev => {
                const next = { ...prev };
                next.JOIN = next.JOIN.filter(u => u.id !== userId);
                next.WAITLIST = next.WAITLIST.filter(u => u.id !== userId);
                return next;
            });
            if (onRefreshData) onRefreshData();
        } catch (err) {
            console.error('Failed to delete participant:', err);
            alert('삭제 실패: ' + err.message);
        }
    };

    const handleMarkAllAttended = async () => {
        if (!selectedNotice) return;
        if (!window.confirm('모든 신청 인원을 참석 처리하시겠습니까?')) return;
        try {
            await noticesApi.markAllAttended(selectedNotice.id);

            // Hyphen Reward Logic (Bulk)
            if (selectedNotice.hyphen_reward && selectedNotice.hyphen_reward > 0) {
                const admin = JSON.parse(localStorage.getItem('admin_user'));
                const adminId = admin?.id || 'admin';
                const newlyAttendedUsers = participantList.JOIN.filter(u => !u.is_attended);
                
                // Process sequentially to avoid slamming the DB (or use Promise.all if preferred, but sequential is safer for now)
                for (const u of newlyAttendedUsers) {
                    try {
                        await hyphenApi.grantProgramReward(u.id, selectedNotice.id, selectedNotice.hyphen_reward, adminId, selectedNotice.title);
                    } catch (e) {
                        console.error('Bulk reward error for user', u.id, e);
                    }
                }
            }

            setParticipantList(prev => {
                const next = { ...prev };
                next.JOIN = next.JOIN.map(u => ({ ...u, is_attended: true }));
                return next;
            });
        } catch (err) {
            console.error(err);
            alert('전체 참석 처리 실패: ' + err.message);
        }
    };

    const searchTimeoutRef = useRef(null);

    const handleUserSearch = (val) => {
        setSearchQuery(val);
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

        if (val.length < 2) {
            setSearchResults([]);
            return;
        }
        
        searchTimeoutRef.current = setTimeout(async () => {
            try {
                const users = await noticesApi.searchUsers(val);
                setSearchResults(users || []);
            } catch (err) {
                console.error(err);
            }
        }, 300);
    };

    const addWalkIn = async (user) => {
        if (!selectedNotice) return;
        try {
            await noticesApi.upsertResponse(selectedNotice.id, user.id, 'JOIN');
            await noticesApi.updateAttendance(selectedNotice.id, user.id, true);

            // Hyphen Reward Logic (Walk-in)
            if (selectedNotice.hyphen_reward && selectedNotice.hyphen_reward > 0) {
                const admin = JSON.parse(localStorage.getItem('admin_user'));
                const adminId = admin?.id || 'admin';
                await hyphenApi.grantProgramReward(user.id, selectedNotice.id, selectedNotice.hyphen_reward, adminId, selectedNotice.title);
            }

            // Optimistic Update & Immediate Feedback
            const newUser = { ...user, is_attended: true };
            if (!participantList.JOIN.some(u => u.id === user.id)) {
                setParticipantList(prev => ({ ...prev, JOIN: [newUser, ...prev.JOIN] }));
            }
            
            setSearchQuery('');
            setSearchResults([]);
            setLastAddedUser(user);
            setTimeout(() => setLastAddedUser(null), 3000);

            // Refresh poll stats if also a poll (rare but possible)
            await fetchParticipants(selectedNotice);
            if (onRefreshData) onRefreshData();
            
        } catch (err) {
            console.error(err);
            alert('추가 실패: ' + err.message);
        }
    };

    const addMultipleWalkIns = async (users) => {
        if (!selectedNotice || !users.length) return;
        try {
            // Process sequentially to be safe
            for (const user of users) {
                await noticesApi.upsertResponse(selectedNotice.id, user.id, 'JOIN');
                await noticesApi.updateAttendance(selectedNotice.id, user.id, true);
                
                if (selectedNotice.hyphen_reward && selectedNotice.hyphen_reward > 0) {
                    const admin = JSON.parse(localStorage.getItem('admin_user'));
                    const adminId = admin?.id || 'admin';
                    try {
                        await hyphenApi.grantProgramReward(user.id, selectedNotice.id, selectedNotice.hyphen_reward, adminId, selectedNotice.title);
                    } catch (e) {
                         console.error('Walk-in reward error for user', user.id, e);
                    }
                }
            }

            setParticipantList(prev => {
                const next = { ...prev };
                const newJoins = [];
                users.forEach(user => {
                    if (!next.JOIN.some(u => u.id === user.id)) {
                        newJoins.push({ ...user, is_attended: true });
                    }
                });
                next.JOIN = [...newJoins, ...next.JOIN];
                return next;
            });
            
            setSearchQuery('');
            setSearchResults([]);
            setLastAddedUser({ name: `${users[0].name} 등 ${users.length}명` });
            setTimeout(() => setLastAddedUser(null), 3000);

            await fetchParticipants(selectedNotice);
            if (onRefreshData) onRefreshData();
            
        } catch (err) {
            console.error(err);
            alert('다중 추가 실패: ' + err.message);
        }
    };

    const [activeSpaceUsers, setActiveSpaceUsers] = useState([]);

    const fetchActiveUsersInSpace = useCallback(async () => {
        try {
            const todayStartsStr = startOfDay(new Date()).toISOString();
            const { data: logsData, error } = await supabase
                .from('logs')
                .select(`
                    type, 
                    user_id,
                    location_id,
                    users (id, name, school, phone_back4, profile_image_url)
                `)
                .gte('created_at', todayStartsStr)
                .order('created_at', { ascending: true });
                
            if (error) throw error;
            
            const activeMap = new Map();
            logsData?.forEach(log => {
                if (!log.users) return;
                
                // Only consider logs from actual center spaces, or general IN/OUT
                if (log.location_id && String(log.location_id).includes('|')) return; // Probably program verification logs like 'notice_id|program_title'
                
                if (['CHECKIN', 'IN', 'MOVE'].includes(log.type)) {
                    activeMap.set(log.user_id, log.users);
                } else if (['CHECKOUT', 'OUT'].includes(log.type)) {
                    activeMap.delete(log.user_id);
                }
            });
            
            setActiveSpaceUsers(Array.from(activeMap.values()));
        } catch (err) {
            console.error('Failed to fetch active users in space:', err);
            setActiveSpaceUsers([]);
        }
    }, []);

    // Fetch active users when entrance list is opened
    useEffect(() => {
        if (showEntranceList) {
            fetchActiveUsersInSpace();
        }
    }, [showEntranceList, fetchActiveUsersInSpace]);

    return {
        participantList,
        pollModalResults,
        modalLoading,
        fetchParticipants,
        handleAttendanceToggle,
        handleDeleteParticipant,
        handleMarkAllAttended,
        // Walk-in controls
        searchQuery,
        setSearchQuery,
        searchResults,
        handleUserSearch,
        showEntranceList,
        setShowEntranceList,
        lastAddedUser,
        addWalkIn,
        addMultipleWalkIns,
        activeSpaceUsers
    };
};

export default useParticipantManagement;
