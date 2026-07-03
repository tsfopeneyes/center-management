import { useState, useEffect } from 'react';
import { supabase } from '../../../../supabaseClient';

export const useSchoolDetail = ({ school, refreshLogs, refreshDashboardData }) => {
    // 1. Edit Data State (for School Info)
    const [editData, setEditData] = useState({
        region: '',
        club_type: '',
        club_name: '',
        manager_ids: [],
        teacher_name: '',
        meeting_time: '',
        snack_history: Array.from({ length: 10 }, () => ({ date: '', type: '' }))
    });

    useEffect(() => {
        if (school) {
            setEditData({
                region: school.metadata?.region || '',
                club_type: school.metadata?.club_type || '',
                club_name: school.metadata?.club_name || '',
                manager_ids: school.metadata?.manager_ids || [],
                teacher_name: school.metadata?.teacher_name || '',
                meeting_time: school.metadata?.meeting_time || '',
                snack_history: Array.from({ length: 10 }, (_, i) => (school.metadata?.snack_history && school.metadata.snack_history[i]) || { date: '', type: '' })
            });
        }
    }, [school]);

    // 2. UI View States
    const [activeTab, setActiveTab] = useState('logs');
    const [isInfoCollapsed, setIsInfoCollapsed] = useState(window.innerWidth < 1024);
    
    // 3. Modals and Logs Interaction States
    const [isLogFormOpen, setIsLogFormOpen] = useState(false);
    const [selectedLog, setSelectedLog] = useState(null);
    const [selectedStudent, setSelectedStudent] = useState(null);

    // 4. Temporary Student State & Handlers
    const [isAddTempStudentModalOpen, setIsAddTempStudentModalOpen] = useState(false);
    const [newTempStudentName, setNewTempStudentName] = useState('');
    const [newTempStudentPhone, setNewTempStudentPhone] = useState('');
    const [addingTempStudent, setAddingTempStudent] = useState(false);

    const handleAddTempStudent = async () => {
        if (!newTempStudentName.trim()) return;
        setAddingTempStudent(true);
        try {
            let phoneVal = '미가입';
            let phoneBack4Val = '미가입';
            if (newTempStudentPhone.trim()) {
                phoneVal = newTempStudentPhone.trim();
                phoneBack4Val = phoneVal.length >= 4 ? phoneVal.slice(-4) : phoneVal;
            }

            const { error } = await supabase.from('users').insert([{
                name: newTempStudentName.trim(),
                school: school.name,
                user_group: '청소년',
                phone: phoneVal,
                phone_back4: phoneBack4Val,
                status: 'approved',
                preferences: { is_temporary: true }
            }]);
            
            if (error) throw error;
            
            setIsAddTempStudentModalOpen(false);
            setNewTempStudentName('');
            setNewTempStudentPhone('');
            
            if (refreshLogs) await refreshLogs();
            if (refreshDashboardData) await refreshDashboardData();
        } catch (err) {
            alert('임시 학생 추가 실패: ' + err.message);
        } finally {
            setAddingTempStudent(false);
        }
    };

    // 5. Calling Forest (Progress) Data & Handlers
    const [callingForestData, setCallingForestData] = useState([]);
    const [expandedForestStudent, setExpandedForestStudent] = useState(null);
    const [selectorState, setSelectorState] = useState({ isOpen: false, student: null, week: null });

    const fetchCallingForestData = async () => {
        if (!school?.students?.length) return;
        const studentIds = school.students.map(s => s.id);
        const { data, error } = await supabase
            .from('calling_forest_progress')
            .select('*')
            .in('student_id', studentIds);
            
        if (!error && data) {
            setCallingForestData(data);
        }
    };

    useEffect(() => {
        if (activeTab === 'calling_forest' && school) {
            fetchCallingForestData();
        }
    }, [activeTab, school]);

    const handleLinkLog = async (log) => {
        try {
            const { student, week } = selectorState;
            const existingProgress = callingForestData.find(d => d.student_id === student.id && d.week_number === week);

            if (existingProgress) {
                await supabase.from('calling_forest_progress').update({ log_id: log.id }).eq('id', existingProgress.id);
            } else {
                await supabase.from('calling_forest_progress').insert([{
                    student_id: student.id,
                    week_number: week,
                    log_id: log.id
                }]);
            }
            fetchCallingForestData();
            setSelectorState({ isOpen: false, student: null, week: null });
        } catch (error) {
            alert('로그 연결 중 오류가 발생했습니다.');
        }
    };

    const handleToggleManualProgress = async (student, week) => {
        try {
            const existingProgress = callingForestData.find(d => d.student_id === student.id && d.week_number === week);
            if (existingProgress) return;
            
            await supabase.from('calling_forest_progress').insert([{
                student_id: student.id,
                week_number: week,
                log_id: null
            }]);
            
            fetchCallingForestData();
        } catch (error) {
            alert('진행 상태 변경 중 오류가 발생했습니다.');
        }
    };

    const handleUnlinkLog = async (progressId) => {
        if (!window.confirm('연결을 해제하시겠습니까?')) return;
        try {
            await supabase.from('calling_forest_progress').delete().eq('id', progressId);
            fetchCallingForestData();
        } catch (error) {
            alert('연결 해제 중 오류가 발생했습니다.');
        }
    };

    const handleRowClick = (log) => {
        setSelectedLog(log);
    };

    return {
        // States
        editData, setEditData,
        activeTab, setActiveTab,
        isInfoCollapsed, setIsInfoCollapsed,
        isLogFormOpen, setIsLogFormOpen,
        selectedLog, setSelectedLog,
        selectedStudent, setSelectedStudent,
        isAddTempStudentModalOpen, setIsAddTempStudentModalOpen,
        newTempStudentName, setNewTempStudentName,
        newTempStudentPhone, setNewTempStudentPhone,
        addingTempStudent, setAddingTempStudent,
        callingForestData, setCallingForestData,
        expandedForestStudent, setExpandedForestStudent,
        selectorState, setSelectorState,
        
        // Actions
        handleAddTempStudent,
        fetchCallingForestData,
        handleLinkLog,
        handleToggleManualProgress,
        handleUnlinkLog,
        handleRowClick
    };
};
