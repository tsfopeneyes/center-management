import { useState, useCallback } from 'react';
import { supabase } from '../../../../supabaseClient';
import { noticesApi } from '../../../../api/noticesApi';

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

    const handleUserSearch = async (val) => {
        setSearchQuery(val);
        if (val.length < 2) {
            setSearchResults([]);
            return;
        }
        try {
            const users = await noticesApi.searchUsers(val);
            setSearchResults(users || []);
        } catch (err) {
            console.error(err);
        }
    };

    const addWalkIn = async (user) => {
        if (!selectedNotice) return;
        try {
            await noticesApi.upsertResponse(selectedNotice.id, user.id, 'JOIN');
            await noticesApi.updateAttendance(selectedNotice.id, user.id, true);

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
        addWalkIn
    };
};

export default useParticipantManagement;
