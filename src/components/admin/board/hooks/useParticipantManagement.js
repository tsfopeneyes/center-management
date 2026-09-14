import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../../../../supabaseClient';
import { noticesApi } from '../../../../api/noticesApi';
import { haifnApi } from '../../../../api/haifnApi';
import { startOfDay } from 'date-fns';
import { MAX_PROGRAM_HAIFN_REWARD } from '../utils/constants';
import { getKstDateString, usesDailySessionRsvp } from '../../../../utils/dailyProgramSessions';
import { challengeMissionsApi } from '../../../../api/challengeMissionsApi';
import { programSessionsApi } from '../../../../api/programSessionsApi';

const useParticipantManagement = (selectedNotice, onRefreshData) => {
    const [participantList, setParticipantList] = useState({ JOIN: [], DECLINE: [], UNDECIDED: [], WAITLIST: [] });
    const [pollModalResults, setPollModalResults] = useState(null);
    const [modalLoading, setModalLoading] = useState(false);
    const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [availableDates, setAvailableDates] = useState([]);
    const [selectedSessionId, setSelectedSessionId] = useState(null);
    const [isLegacyParticipantView, setIsLegacyParticipantView] = useState(false);
    
    // Walk-in search state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [showEntranceList, setShowEntranceList] = useState(false);
    const [lastAddedUser, setLastAddedUser] = useState(null);
    const latestQueryDateRef = useRef(null);

    const getDefaultDate = (dates) => {
        if (!dates.length) return null;
        const today = getKstDateString();
        return dates.find(date => date >= today) || dates[dates.length - 1];
    };

    const fetchAvailableDates = useCallback(async (notice) => {
        if (!notice) return;
        try {
            const { data: sessions, error: sessionError } = await supabase
                .from('daily_program_sessions')
                .select('id, session_date, status, voided_at')
                .eq('notice_id', notice.id)
                .is('voided_at', null)
                .order('session_date', { ascending: true });
            if (sessionError) throw sessionError;

            const dates = (sessions || [])
                .map(session => session.session_date)
                .filter(Boolean);
            if (dates.length > 0) {
                setAvailableDates(dates);
                setSelectedDate(previous => dates.includes(previous) ? previous : (getDefaultDate(dates) || previous));
                return;
            }

            setAvailableDates([]);
            if (notice.is_recruiting !== false) return;

            const descPattern = `[오픈 프로그램 참여] ${notice.title}%`;
            const { data, error } = await supabase
                .from('haifn_transactions')
                .select('source_description')
                .eq('transaction_type', 'EARN')
                .like('source_description', descPattern);
            
            if (error) throw error;
            
            const uniqueDates = new Set();

            // Generate range of dates from start to end
            const start = notice.program_start_date || (notice.program_date ? notice.program_date.split('T')[0] : null);
            const end = notice.program_end_date || start;
            if (start) {
                try {
                    let current = new Date(start);
                    const endDate = new Date(end);
                    while (current <= endDate && !isNaN(current.getTime()) && !isNaN(endDate.getTime())) {
                        uniqueDates.add(current.toISOString().split('T')[0]);
                        current.setDate(current.getDate() + 1);
                    }
                } catch (e) {
                    console.error("Error generating date range:", e);
                }
            }
            
            data?.forEach(tx => {
                const match = tx.source_description.match(/\((\d{4}-\d{2}-\d{2})\)/);
                if (match) {
                    uniqueDates.add(match[1]);
                }
            });
            
            const sorted = Array.from(uniqueDates).sort();
            setAvailableDates(sorted);
            
            if (sorted.length > 0) {
                // If there are recorded dates, make sure selectedDate points to one of them
                setSelectedDate(prev => sorted.includes(prev) ? prev : getDefaultDate(sorted));
            } else if (notice.program_date) {
                // Default fallback if no participants yet
                const fallbackDate = notice.program_date.match(/\d{4}-\d{2}-\d{2}/) 
                    ? notice.program_date.match(/\d{4}-\d{2}-\d{2}/)[0] 
                    : new Date().toISOString().split('T')[0];
                setSelectedDate(fallbackDate);
            }
        } catch (err) {
            console.error("Failed to fetch available dates:", err);
        }
    }, []);

    useEffect(() => {
        if (selectedNotice) {
            fetchAvailableDates(selectedNotice);
        }
    }, [selectedNotice, fetchAvailableDates]);

    const fetchParticipants = useCallback(async (notice) => {
        if (!notice) return;
        
        const dateQuerying = selectedDate;
        latestQueryDateRef.current = dateQuerying;
        
        setModalLoading(true);
        setPollModalResults(null);
        
        try {
            const { data: session, error: sessionError } = await supabase
                .from('daily_program_sessions')
                .select('id')
                .eq('notice_id', notice.id)
                .eq('session_date', selectedDate)
                .is('voided_at', null)
                .maybeSingle();
            if (sessionError) throw sessionError;

            if (session) {

                if (latestQueryDateRef.current !== dateQuerying) return;

                setSelectedSessionId(session?.id || null);
                setIsLegacyParticipantView(false);
                const list = { JOIN: [], DECLINE: [], UNDECIDED: [], WAITLIST: [] };
                const responses = await programSessionsApi.fetchAdminParticipants(session.id);
                responses.forEach(response => {
                    if (!list[response.status] || !response.user) return;
                    list[response.status].push({
                        ...response.user,
                        is_attended: Boolean(response.is_attended),
                        application_answers: response.application_answers || {},
                        is_staff: false,
                    });
                });
                setParticipantList(list);
            } else if (usesDailySessionRsvp(notice)) {
                // 한 번 신청 방식에서 회차별 신청으로 전환한 프로그램은 첫 회차가
                // 생성되기 전까지 기존 프로그램 신청자를 그대로 보여준다.
                const { data, error } = await supabase
                    .from('notice_responses')
                    .select('status, is_attended, is_staff, application_answers, users(id, name, school, phone, phone_back4, is_leader)')
                    .eq('notice_id', notice.id)
                    .order('created_at', { ascending: true });
                if (error) throw error;
                if (latestQueryDateRef.current !== dateQuerying) return;

                setSelectedSessionId(null);
                setIsLegacyParticipantView((data || []).length > 0);
                const list = { JOIN: [], DECLINE: [], UNDECIDED: [], WAITLIST: [] };
                (data || []).forEach(response => {
                    if (!list[response.status] || !response.users) return;
                    list[response.status].push({
                        ...response.users,
                        is_attended: Boolean(response.is_attended),
                        is_staff: Boolean(response.is_staff),
                        application_answers: response.application_answers || {},
                    });
                });
                setParticipantList(list);
            } else if (notice.is_recruiting === false) {
                setSelectedSessionId(null);
                setIsLegacyParticipantView(false);
                // 오픈 프로그램 (날짜별 수동 관리)
                const dateStr = selectedDate;
                const descMatch = `[오픈 프로그램 참여] ${notice.title} (${dateStr})`;
                
                const { data, error } = await supabase
                    .from('haifn_transactions')
                    .select('user_id, users(id, name, school, phone, phone_back4, is_leader)')
                    .eq('source_description', descMatch)
                    .eq('transaction_type', 'EARN')
                    .order('created_at', { ascending: true });
                    
                if (latestQueryDateRef.current !== dateQuerying) {
                    // Stale query, ignore results to prevent race conditions
                    return;
                }
                if (error) throw error;
                
                const list = { JOIN: [], DECLINE: [], UNDECIDED: [], WAITLIST: [] };
                data?.forEach(tx => {
                    if (tx.users) {
                        list.JOIN.push({ 
                            ...tx.users, 
                            is_attended: true, 
                            is_staff: false
                        });
                    }
                });
                setParticipantList(list);
            } else {
                setSelectedSessionId(null);
                setIsLegacyParticipantView(false);
                // 신청 프로그램 (기존 동일)
                const challengeSubmissions = notice.is_challenge
                    ? await challengeMissionsApi.fetchSubmissions(notice.id, notice.challenge_format || 'OFFLINE')
                    : [];
                const { data, error } = await supabase
                    .from('notice_responses')
                    .select('status, is_attended, is_staff, application_answers, users(id, name, school, phone, phone_back4, is_leader)')
                    .eq('notice_id', notice.id)
                    .order('created_at', { ascending: true });
                    
                if (error) throw error;
                
                const list = { JOIN: [], DECLINE: [], UNDECIDED: [], WAITLIST: [] };
                data?.forEach(r => {
                    if (list[r.status]) {
                        list[r.status].push({ 
                            ...r.users, 
                            is_attended: r.is_attended, 
                            is_staff: r.is_staff,
                            application_answers: r.application_answers || {},
                            challenge_submissions: challengeSubmissions.filter(item => item.participant_id === r.users.id)
                        });
                    }
                });
                setParticipantList(list);
            }

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
            if (latestQueryDateRef.current === dateQuerying) {
                setModalLoading(false);
            }
        }
    }, [selectedDate]);

    const handleAttendanceToggle = async (userId, currentAttended) => {
        if (!selectedNotice) return;
        try {
            if (selectedSessionId) {
                if (!selectedSessionId) throw new Error('선택한 날짜의 회차를 찾을 수 없습니다.');
                const { error } = await supabase
                    .from('daily_program_session_responses')
                    .update({ is_attended: !currentAttended })
                    .eq('session_id', selectedSessionId)
                    .eq('user_id', userId);
                if (error) throw error;
                setParticipantList(previous => ({
                    ...previous,
                    JOIN: previous.JOIN.map(user => user.id === userId ? { ...user, is_attended: !currentAttended } : user),
                }));
            } else if (usesDailySessionRsvp(selectedNotice) && !isLegacyParticipantView) {
                throw new Error('먼저 선택한 날짜의 회차를 열어주세요.');
            } else if (selectedNotice.is_recruiting === false) {
                const dateStr = selectedDate;
                if (currentAttended) {
                    await haifnApi.revokeOpenProgramReward(userId, selectedNotice.title, dateStr);
                } else {
                    const admin = JSON.parse(localStorage.getItem('admin_user'));
                    const adminId = admin?.id || null;
                    await haifnApi.grantOpenProgramReward(userId, selectedNotice.id, Math.min(MAX_PROGRAM_HAIFN_REWARD, Number(selectedNotice.haifn_reward) || 0), adminId, selectedNotice.title, dateStr);
                }
                await fetchParticipants(selectedNotice);
            } else {
                await noticesApi.updateAttendance(selectedNotice.id, userId, !currentAttended);
                
                // Haifn Reward Logic
                if (selectedNotice.haifn_reward && selectedNotice.haifn_reward > 0) {
                    const admin = JSON.parse(localStorage.getItem('admin_user'));
                    const adminId = admin?.id || null;
                    if (!currentAttended) {
                        if (!selectedNotice.is_review_required) {
                            await haifnApi.grantProgramReward(userId, selectedNotice.id, selectedNotice.haifn_reward, adminId, selectedNotice.title);
                        }
                    } else {
                        await haifnApi.revokeProgramReward(userId, selectedNotice.title);
                    }
                }

                setParticipantList(prev => {
                    const next = { ...prev };
                    next.JOIN = next.JOIN.map(u => u.id === userId ? { ...u, is_attended: !currentAttended } : u);
                    return next;
                });
            }
        } catch (err) {
            console.error(err);
            alert('출석 상태 변경 실패: ' + err.message);
        }
    };

    const handleStaffToggle = async (userId, currentStaff) => {
        if (!selectedNotice) return;
        try {
            await noticesApi.updateStaffStatus(selectedNotice.id, userId, !currentStaff);
            setParticipantList(prev => {
                const next = { ...prev };
                next.JOIN = next.JOIN.map(u => u.id === userId ? { ...u, is_staff: !currentStaff } : u);
                return next;
            });
        } catch (err) {
            console.error(err);
            alert('스탭 상태 변경 실패: ' + err.message);
        }
    };

    const handleDeleteParticipant = async (userId, userName) => {
        if (!selectedNotice) return;
        if (!window.confirm(`[${userName}] 학생의 내역을 정말 삭제하시겠습니까?`)) return;
        try {
            if (selectedSessionId) {
                if (!selectedSessionId) throw new Error('선택한 날짜의 회차를 찾을 수 없습니다.');
                const { error } = await supabase
                    .from('daily_program_session_responses')
                    .update({ status: 'CANCELLED', cancelled_at: new Date().toISOString() })
                    .eq('session_id', selectedSessionId)
                    .eq('user_id', userId);
                if (error) throw error;
                await fetchParticipants(selectedNotice);
            } else if (usesDailySessionRsvp(selectedNotice) && !isLegacyParticipantView) {
                throw new Error('먼저 선택한 날짜의 회차를 열어주세요.');
            } else if (selectedNotice.is_recruiting === false) {
                const dateStr = selectedDate;
                await haifnApi.revokeOpenProgramReward(userId, selectedNotice.title, dateStr);
                await fetchParticipants(selectedNotice);
            } else {
                await noticesApi.deleteResponse(selectedNotice.id, userId);
                setParticipantList(prev => {
                    const next = { ...prev };
                    next.JOIN = next.JOIN.filter(u => u.id !== userId);
                    next.WAITLIST = next.WAITLIST.filter(u => u.id !== userId);
                    return next;
                });
            }
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
            if (selectedSessionId) {
                if (!selectedSessionId) throw new Error('선택한 날짜의 회차를 찾을 수 없습니다.');
                const { error } = await supabase
                    .from('daily_program_session_responses')
                    .update({ is_attended: true })
                    .eq('session_id', selectedSessionId)
                    .eq('status', 'JOIN');
                if (error) throw error;
                setParticipantList(previous => ({
                    ...previous,
                    JOIN: previous.JOIN.map(user => ({ ...user, is_attended: true })),
                }));
                return;
            }

            if (usesDailySessionRsvp(selectedNotice) && !isLegacyParticipantView) {
                throw new Error('먼저 선택한 날짜의 회차를 열어주세요.');
            }

            await noticesApi.markAllAttended(selectedNotice.id);

            // Haifn Reward Logic (Bulk)
            if (selectedNotice.haifn_reward && selectedNotice.haifn_reward > 0 && !selectedNotice.is_review_required) {
                const admin = JSON.parse(localStorage.getItem('admin_user'));
                const adminId = admin?.id || null;
                const newlyAttendedUsers = participantList.JOIN.filter(u => !u.is_attended);
                
                // Process sequentially to avoid slamming the DB
                for (const u of newlyAttendedUsers) {
                    try {
                        await haifnApi.grantProgramReward(u.id, selectedNotice.id, selectedNotice.haifn_reward, adminId, selectedNotice.title);
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
            if (selectedSessionId) {
                if (!selectedSessionId) throw new Error('선택한 날짜의 회차를 찾을 수 없습니다.');
                const { error } = await supabase
                    .from('daily_program_session_responses')
                    .upsert({
                        session_id: selectedSessionId,
                        user_id: user.id,
                        status: 'JOIN',
                        is_attended: true,
                        cancelled_at: null,
                    }, { onConflict: 'session_id,user_id' });
                if (error) throw error;
            } else if (usesDailySessionRsvp(selectedNotice) && !isLegacyParticipantView) {
                throw new Error('먼저 선택한 날짜의 회차를 열어주세요.');
            } else if (selectedNotice.is_recruiting === false) {
                const dateStr = selectedDate;
                const admin = JSON.parse(localStorage.getItem('admin_user'));
                const adminId = admin?.id || null;
                await haifnApi.grantOpenProgramReward(user.id, selectedNotice.id, Math.min(MAX_PROGRAM_HAIFN_REWARD, Number(selectedNotice.haifn_reward) || 0), adminId, selectedNotice.title, dateStr);
                
                // Optimistic Update & Immediate Feedback
                const newUser = { ...user, is_attended: true, is_staff: false };
                if (!participantList.JOIN.some(u => u.id === user.id)) {
                    setParticipantList(prev => ({ ...prev, JOIN: [newUser, ...prev.JOIN] }));
                }
            } else {
                await noticesApi.upsertResponse(selectedNotice.id, user.id, 'JOIN');
                await noticesApi.updateAttendance(selectedNotice.id, user.id, true);

                // Haifn Reward Logic (Walk-in)
                if (selectedNotice.haifn_reward && selectedNotice.haifn_reward > 0 && !selectedNotice.is_review_required) {
                    const admin = JSON.parse(localStorage.getItem('admin_user'));
                    const adminId = admin?.id || null;
                    await haifnApi.grantProgramReward(user.id, selectedNotice.id, selectedNotice.haifn_reward, adminId, selectedNotice.title);
                }

                // Optimistic Update & Immediate Feedback
                const newUser = { ...user, is_attended: true };
                if (!participantList.JOIN.some(u => u.id === user.id)) {
                    setParticipantList(prev => ({ ...prev, JOIN: [newUser, ...prev.JOIN] }));
                }
            }
            
            setSearchQuery('');
            setSearchResults([]);
            setLastAddedUser(user);
            setTimeout(() => setLastAddedUser(null), 3000);

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
            if (selectedSessionId) {
                if (!selectedSessionId) throw new Error('선택한 날짜의 회차를 찾을 수 없습니다.');
                const { error } = await supabase
                    .from('daily_program_session_responses')
                    .upsert(users.map(user => ({
                        session_id: selectedSessionId,
                        user_id: user.id,
                        status: 'JOIN',
                        is_attended: true,
                        cancelled_at: null,
                    })), { onConflict: 'session_id,user_id' });
                if (error) throw error;
            } else if (usesDailySessionRsvp(selectedNotice) && !isLegacyParticipantView) {
                throw new Error('먼저 선택한 날짜의 회차를 열어주세요.');
            } else if (selectedNotice.is_recruiting === false) {
                const dateStr = selectedDate;
                const admin = JSON.parse(localStorage.getItem('admin_user'));
                const adminId = admin?.id || null;
                for (const user of users) {
                    try {
                        await haifnApi.grantOpenProgramReward(user.id, selectedNotice.id, Math.min(MAX_PROGRAM_HAIFN_REWARD, Number(selectedNotice.haifn_reward) || 0), adminId, selectedNotice.title, dateStr);
                    } catch (e) {
                         console.error('Walk-in reward error for user', user.id, e);
                    }
                }

                setParticipantList(prev => {
                    const next = { ...prev };
                    const newJoins = [];
                    users.forEach(user => {
                        if (!next.JOIN.some(u => u.id === user.id)) {
                            newJoins.push({ ...user, is_attended: true, is_staff: false });
                        }
                    });
                    next.JOIN = [...newJoins, ...next.JOIN];
                    return next;
                });
            } else {
                for (const user of users) {
                    await noticesApi.upsertResponse(selectedNotice.id, user.id, 'JOIN');
                    await noticesApi.updateAttendance(selectedNotice.id, user.id, true);
                    
                    if (selectedNotice.haifn_reward && selectedNotice.haifn_reward > 0 && !selectedNotice.is_review_required) {
                        const admin = JSON.parse(localStorage.getItem('admin_user'));
                        const adminId = admin?.id || null;
                        try {
                            await haifnApi.grantProgramReward(user.id, selectedNotice.id, selectedNotice.haifn_reward, adminId, selectedNotice.title);
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
            }
            
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
                    users (id, name, school, phone, phone_back4, profile_image_url, is_leader)
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

    // Automatically refetch participants when selectedNotice or selectedDate changes
    useEffect(() => {
        if (selectedNotice) {
            fetchParticipants(selectedNotice);
        }
    }, [selectedNotice, selectedDate]);

    return {
        participantList,
        pollModalResults,
        modalLoading,
        fetchParticipants,
        handleAttendanceToggle,
        handleStaffToggle,
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
        activeSpaceUsers,
        selectedDate,
        setSelectedDate,
        availableDates
    };
};

export default useParticipantManagement;
