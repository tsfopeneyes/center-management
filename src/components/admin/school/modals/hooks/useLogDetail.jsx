import { useState } from 'react';
import { supabase } from '../../../../../supabaseClient';

export const useLogDetail = (onRefresh) => {
    const [editingLogs, setEditingLogs] = useState({});
    const [savingId, setSavingId] = useState(null);
    const [searchTerm, setSearchTerm] = useState({});
    const [facilitatorSearchTerm, setFacilitatorSearchTerm] = useState({});

    const handleSaveEdit = async (logId) => {
        const editData = editingLogs[logId];
        if (!editData) return;

        setSavingId(logId);
        try {
            const time_range = `${editData.start_time || ''}~${editData.end_time || ''}`;
            const { error } = await supabase.from('school_logs').update({
                date: editData.date,
                time_range: time_range,
                location: editData.location,
                participant_ids: editData.participant_ids || [],
                facilitator_ids: editData.facilitator_ids || [],
                content: editData.content
            }).eq('id', logId);

            if (error) throw error;

            setEditingLogs(prev => {
                const next = { ...prev };
                delete next[logId];
                return next;
            });
            await onRefresh();
            alert('저장되었습니다.');
        } catch (err) {
            alert('저장 실패: ' + err.message);
        } finally {
            setSavingId(null);
        }
    };

    const handleKeyDown = (e, logId) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const { selectionStart, selectionEnd, value } = e.target;
            const newValue = value.substring(0, selectionStart) + '\n* ' + value.substring(selectionEnd);

            setEditingLogs(prev => ({
                ...prev,
                [logId]: { ...prev[logId], content: newValue }
            }));

            setTimeout(() => {
                e.target.selectionStart = e.target.selectionEnd = selectionStart + 3;
            }, 0);
        }
    };

    const toggleParticipant = (logId, studentId) => {
        setEditingLogs(prev => {
            const current = prev[logId].participant_ids || [];
            return {
                ...prev,
                [logId]: {
                    ...prev[logId],
                    participant_ids: current.includes(studentId)
                        ? current.filter(id => id !== studentId)
                        : [...current, studentId]
                }
            };
        });
    };

    const toggleFacilitator = (logId, staffId) => {
        setEditingLogs(prev => {
            const current = prev[logId].facilitator_ids || [];
            return {
                ...prev,
                [logId]: {
                    ...prev[logId],
                    facilitator_ids: current.includes(staffId)
                        ? current.filter(id => id !== staffId)
                        : [...current, staffId]
                }
            };
        });
    };

    const startEditing = (log) => {
        const [start_time = '', end_time = ''] = (log.time_range || '').split('~');
        setEditingLogs(prev => ({
            ...prev,
            [log.id]: {
                ...log,
                start_time: start_time.trim(),
                end_time: end_time.trim(),
                participant_ids: log.participant_ids || [],
                facilitator_ids: log.facilitator_ids || []
            }
        }));
        setSearchTerm(prev => ({ ...prev, [log.id]: '' }));
        setFacilitatorSearchTerm(prev => ({ ...prev, [log.id]: '' }));
    };

    const cancelEditing = (logId) => {
        setEditingLogs(prev => {
            const next = { ...prev };
            delete next[logId];
            return next;
        });
    };

    return {
        editingLogs, setEditingLogs,
        savingId,
        searchTerm, setSearchTerm,
        facilitatorSearchTerm, setFacilitatorSearchTerm,
        handleSaveEdit, handleKeyDown,
        toggleParticipant, toggleFacilitator,
        startEditing, cancelEditing
    };
};
