import React, { useState, useMemo, useRef, useEffect } from 'react';
import { RefreshCw, FileSpreadsheet, MapPin, Calendar, Trash2, Filter, X, ClipboardList, Database } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { exportLogsToExcel, exportVisitLogToExcel } from '../../utils/exportUtils';
import RangeDatePicker from '../common/RangeDatePicker';
import CheckboxFilter from '../common/CheckboxFilter';


import LogDetailModal from './school/LogDetailModal';

import { aggregateVisitSessions } from '../../utils/visitUtils';

import { getWeekIdentifier, parseTimeRange } from '../../utils/dateUtils';

const AdminLogs = ({ allLogs, schoolLogs = [], users, locations, notices, fetchData }) => {
    const [logCategory, setLogCategory] = useState('VISIT'); // VISIT, SPACE, PROGRAM, STUDENT
    const [selectedLogId, setSelectedLogId] = useState(null);


    const [visitNotes, setVisitNotes] = useState({}); // { 'userId_date': { purpose, remarks } }
    const inputRefs = useRef({}); // { 'rowIdx-field': ref }
    const [selection, setSelection] = useState({ startIdx: null, endIdx: null, field: null, isDragging: false });

    // Date Filtering State
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const toggleFilter = (field, value) => {
        setVisitFilters(prev => {
            const current = prev[field] || [];
            const next = current.includes(value)
                ? current.filter(v => v !== value)
                : [...current, value];
            return { ...prev, [field]: next };
        });
    };

    const isWithinRange = (dateStr) => {
        if (!dateStr) return true;
        // Ensure we compare based on local date part YYYY-MM-DD
        const target = dateStr.includes('T') || dateStr.includes(' ')
            ? new Date(dateStr).toLocaleDateString('en-CA')
            : dateStr;
        if (startDate && target < startDate) return false;
        if (endDate && target > endDate) return false;
        return true;
    };

    const parseLocationId = (locId) => {
        if (!locId) return { id: '', title: '', date: '', time: '', location: '' };
        if (locId.includes('|')) {
            const [id, title, date, time, location] = locId.split('|');
            return { id, title, date, time, location: location || '' };
        }
        // Legacy support for colon
        if (locId.includes(':')) {
            const [id, ...rest] = locId.split(':');
            return { id: locId, title: '', date: '', time: '', location: '' };
        }
        return { id: locId, title: '', date: '', time: '', location: '' };
    };

    const extractProgramInfo = (content) => {
        const info = { date: '', duration: '', location: '', cleanContent: content };
        if (!content) return info;
        const infoBlockRegex = /<div style="background-color: #f8fafc;[\s\S]*?<\/div>/;
        const match = content.match(infoBlockRegex);
        if (match) {
            const block = match[0];
            const locationMatch = block.match(/📍 장소:<\/strong>\s*([^<]+)/);
            if (locationMatch) info.location = locationMatch[1].trim() === '미정' ? '' : locationMatch[1].trim();
        }
        return info;
    };

    const formatShortTime = (rawDate, rawTime, fallbackTime) => {
        // rawDate can be 'YYYY-MM-DD' or ISO 'YYYY-MM-DDTHH:mm:ss.sssZ'
        // Prioritize ISO if available
        let dateObj;
        if (rawDate && rawDate.includes('T')) {
            dateObj = new Date(rawDate);
        } else if (rawDate && rawTime) {
            dateObj = new Date(`${rawDate}T${rawTime}`);
        } else if (rawDate) {
            dateObj = new Date(rawDate);
        } else {
            dateObj = new Date(fallbackTime);
        }

        if (isNaN(dateObj.getTime())) dateObj = new Date(fallbackTime);

        const y = String(dateObj.getFullYear()).slice(2);
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        const hour = dateObj.getHours();
        const min = String(dateObj.getMinutes()).padStart(2, '0');
        const ampm = hour >= 12 ? 'pm' : 'am';
        const displayHour = hour % 12 || 12;

        return `${y}.${m}.${d} ${ampm} ${displayHour}:${min}`;
    };

    // Processed School Logs for Student Meeting Log Tab
    const processedSchoolLogs = useMemo(() => {
        if (!schoolLogs) return [];
        return schoolLogs.map(log => {
            const timeInfo = parseTimeRange(log.time_range);
            const hasStudentLeader = log.participant_ids?.some(pid => {
                const u = users.find(user => user.id === pid);
                return u?.is_leader;
            });

            return {
                ...log,
                weekId: getWeekIdentifier(log.date),
                category: hasStudentLeader ? '학생리더만남' : '학생만남',
                schoolName: log.schools?.name || log.users?.school || '-',
                participantCount: log.participant_ids?.length || 0,
                startTime: timeInfo.start,
                endTime: timeInfo.end,
                durationStr: timeInfo.durationStr,
                durationMin: timeInfo.durationMin,
                facilitatorNames: log.facilitator_ids?.map(fid => users.find(u => u.id === fid)?.name).filter(Boolean).join(', ') || ''
            };
        });
    }, [schoolLogs, users, locations]);

    const filteredSchoolLogs = useMemo(() => {
        return processedSchoolLogs.filter(log => {
            if (!isWithinRange(log.date)) return false;
            return true;
        });
    }, [processedSchoolLogs, startDate, endDate]);

    // Visit Log Column Filters
    const [visitFilters, setVisitFilters] = useState({
        weekIds: [], // array
        dates: [],   // array
        days: [],    // array
        school: '',
        name: '',
        age: '',      // new
        space: '',   // new
        duration: '', // new
        purpose: '',
        remarks: ''
    });

    const [selectedRows, setSelectedRows] = useState(new Set()); // new
    const [isManualModalOpen, setIsManualModalOpen] = useState(false); // new
    const [manualEntry, setManualEntry] = useState({
        userId: '',
        date: new Date().toLocaleDateString('en-CA'),
        startTime: '14:00',
        endTime: '16:00',
        locationId: ''
    });
    const [userSearchText, setUserSearchText] = useState('');
    const [showUserResults, setShowUserResults] = useState(false); // new



    const programSummaries = useMemo(() => {
        const prgLogs = allLogs.filter(log => log.type.startsWith('PRG_'));
        const groups = {};

        prgLogs.forEach(log => {
            const { id: prgId, title: prgTitle, date, time, location } = parseLocationId(log.location_id);
            // Group by ID + Minute to catch logs from same batch
            const timeKey = new Date(log.created_at).toISOString().slice(0, 16);
            const groupKey = `${prgId}_${timeKey}`;

            if (!groups[groupKey]) {
                const notice = notices?.find(n => n.id === prgId);
                const actualDate = date || notice?.program_date;
                const actualTime = time || ''; // Time might be inside actualDate if it's ISO

                // Construct sortable timestamp
                let sortTime;
                if (actualDate) {
                    sortTime = new Date(actualDate).getTime();
                    // If actualDate was just YYYY-MM-DD and we have actualTime
                    if (actualDate.length <= 10 && actualTime) {
                        sortTime = new Date(`${actualDate}T${actualTime}`).getTime();
                    }
                } else {
                    sortTime = new Date(log.created_at).getTime();
                }

                const info = notice ? extractProgramInfo(notice.content) : null;
                groups[groupKey] = {
                    id: groupKey,
                    prgId,
                    prgTitle: prgTitle || notice?.title || '삭제된 프로그램',
                    prgLocation: location || info?.location || '',
                    prgType: notice?.program_type || 'CENTER',
                    displayTime: formatShortTime(actualDate, actualTime, log.created_at),
                    sortTime,
                    type: (log.type === 'PRG_CANCELLED' || log.type === 'PRG_CANCEL_SYSTEM') ? 'CANCELLED' : 'COMPLETED',
                    attendees: [],
                    absentees: [],
                    cancelled: [],
                    logIds: []
                };
            }

            groups[groupKey].logIds.push(log.id);

            const user = users.find(u => u.id === log.user_id);
            if (user) {
                const participantInfo = { name: user.name, type: log.type };
                if (log.type === 'PRG_ATTENDED') groups[groupKey].attendees.push(participantInfo);
                else if (log.type === 'PRG_ABSENT') groups[groupKey].absentees.push(participantInfo);
                else if (log.type === 'PRG_CANCELLED') groups[groupKey].cancelled.push(participantInfo);
            }
        });

        return Object.values(groups)
            .filter(g => {
                const datePart = new Date(g.sortTime).toISOString().split('T')[0];
                return isWithinRange(datePart);
            })
            .sort((a, b) => b.sortTime - a.sortTime);
    }, [allLogs, notices, users, startDate, endDate]);

    const handleDeleteLog = async (id) => {
        if (!confirm('해당 로그(들)를 삭제하시겠습니까?')) return;
        const ids = Array.isArray(id) ? id : [id];
        try {
            const { error } = await supabase.from('logs').delete().in('id', ids);
            if (error) throw error;
            setSelectedRows(new Set());
            fetchData();
        } catch (err) { alert('삭제 실패: ' + err.message); }
    };

    const handleDeleteProgramSummary = async (ids) => {
        if (!confirm('이 프로그램의 모든 참여 기록을 삭제하시겠습니까?')) return;
        try {
            const { error } = await supabase.from('logs').delete().in('id', ids);
            if (error) throw error;
            fetchData();
        } catch (err) { alert('삭제 실패: ' + err.message); }
    };

    const handleBulkDelete = () => {
        if (selectedRows.size === 0) return;
        const allLogIds = [];
        selectedRows.forEach(rowId => {
            const row = filteredVisitSummaries.find(s => s.id === rowId);
            if (row && row.rawLogs) {
                allLogIds.push(...row.rawLogs.map(l => l.id));
            }
        });
        if (allLogIds.length === 0) {
            alert('삭제할 수 있는 로그 데이터가 없습니다.');
            return;
        }
        handleDeleteLog(allLogIds);
    };

    const handleSelectiveExport = () => {
        if (selectedRows.size === 0) {
            exportVisitLogToExcel(filteredVisitSummaries, visitNotes);
            return;
        }
        const selectedSummaries = filteredVisitSummaries.filter(s => selectedRows.has(s.id));
        exportVisitLogToExcel(selectedSummaries, visitNotes);
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedRows(new Set(filteredVisitSummaries.map(s => s.id)));
        } else {
            setSelectedRows(new Set());
        }
    };

    const handleRowSelect = (id) => {
        setSelectedRows(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleManualSubmit = async (e) => {
        e.preventDefault();
        if (!manualEntry.userId || !manualEntry.locationId || !manualEntry.startTime || !manualEntry.endTime) {
            alert('모든 필드를 입력해주세요.');
            return;
        }

        try {
            const startTimestamp = `${manualEntry.date}T${manualEntry.startTime}:00+09:00`;
            const endTimestamp = `${manualEntry.date}T${manualEntry.endTime}:00+09:00`;

            // Insert CHECKIN and CHECKOUT logs
            const { error: error1 } = await supabase.from('logs').insert({
                user_id: manualEntry.userId,
                type: 'CHECKIN',
                location_id: manualEntry.locationId,
                created_at: startTimestamp
            });
            if (error1) throw error1;

            const { error: error2 } = await supabase.from('logs').insert({
                user_id: manualEntry.userId,
                type: 'CHECKOUT',
                location_id: manualEntry.locationId,
                created_at: endTimestamp
            });
            if (error2) throw error2;

            alert('수기 방문 기록이 저장되었습니다.');
            setIsManualModalOpen(false);
            setManualEntry({
                userId: '',
                date: new Date().toLocaleDateString('en-CA'),
                startTime: '14:00',
                endTime: '16:00',
                locationId: ''
            });
            setUserSearchText('');
            fetchData();
        } catch (err) {
            console.error(err);
            alert('저장 실패: ' + err.message);
        }
    };

    const visitSummaries = useMemo(() => {
        const aggregated = aggregateVisitSessions(allLogs, users, locations, startDate, endDate);

        // Calculate unique options for checkboxes from the aggregated (but not yet column-filtered) data
        const uniqueOptions = {
            weekIds: [...new Set(aggregated.map(s => s.weekId))].sort().reverse(),
            dates: [...new Set(aggregated.map(s => s.date))].sort().reverse(),
            days: ['월', '화', '수', '목', '금', '토', '일']
        };

        const filtered = aggregated.filter(summary => {
            const noteKey = `${summary.userId}_${summary.date}`;
            const note = visitNotes[noteKey] || {};

            const matchFilter = (val, filter) => !filter || val.toLowerCase().includes(filter.toLowerCase());
            const matchArray = (val, arr) => !arr || arr.length === 0 || arr.includes(val);

            return matchArray(summary.weekId, visitFilters.weekIds) &&
                matchArray(summary.date, visitFilters.dates) &&
                matchArray(summary.dayOfWeek, visitFilters.days) &&
                matchFilter(summary.school, visitFilters.school) &&
                matchFilter(summary.name, visitFilters.name) &&
                matchFilter(summary.age?.toString() || '', visitFilters.age) &&
                matchFilter(summary.usedSpaces, visitFilters.space) &&
                matchFilter(summary.durationMin?.toString() || '', visitFilters.duration) &&
                matchFilter(note.purpose || '', visitFilters.purpose) &&
                matchFilter(note.remarks || '', visitFilters.remarks);
        });

        return {
            data: filtered.sort((a, b) => b.sortTime - a.sortTime),
            options: uniqueOptions
        };
    }, [allLogs, users, locations, startDate, endDate, visitFilters, visitNotes]);

    // Convenience alias
    const filteredVisitSummaries = visitSummaries.data;
    const filterOptions = visitSummaries.options;

    const handleSaveNote = async (userId, date, field, value) => {
        try {
            const key = `${userId}_${date}`;
            const { error } = await supabase.from('visit_notes').upsert({
                user_id: userId,
                visit_date: date,
                [field]: value,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id,visit_date' });

            if (error) throw error;

            setVisitNotes(prev => ({
                ...prev,
                [key]: { ...prev[key], [field]: value }
            }));
        } catch (err) {
            console.error(err);
            alert('저장 실패: ' + err.message);
        }
    };

    const handleBulkSaveNote = async (summaries, field, value) => {
        try {
            const updates = summaries.map(s => ({
                user_id: s.userId,
                visit_date: s.date,
                [field]: value,
                updated_at: new Date().toISOString()
            }));

            const { error } = await supabase.from('visit_notes').upsert(updates, { onConflict: 'user_id,visit_date' });
            if (error) throw error;

            setVisitNotes(prev => {
                const next = { ...prev };
                summaries.forEach(s => {
                    const key = `${s.userId}_${s.date}`;
                    next[key] = { ...next[key], [field]: value };
                });
                return next;
            });
        } catch (err) {
            console.error(err);
            alert('일괄 저장 실패: ' + err.message);
        }
    };

    const handleNoteKeyDown = (e, rowIdx, field) => {
        if (e.key === 'Enter' || e.key === 'ArrowDown') {
            e.preventDefault();
            const nextRef = inputRefs.current[`${rowIdx + 1}-${field}`];
            if (nextRef) nextRef.focus();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prevRef = inputRefs.current[`${rowIdx - 1}-${field}`];
            if (prevRef) prevRef.focus();
        } else if ((e.key === 'Delete' || e.key === 'Backspace') && selection.startIdx !== null && selection.endIdx !== null) {
            const min = Math.min(selection.startIdx, selection.endIdx);
            const max = Math.max(selection.startIdx, selection.endIdx);
            if (min !== max) {
                e.preventDefault();
                const selectedRows = filteredVisitSummaries.slice(min, max + 1);
                handleBulkSaveNote(selectedRows, selection.field, '');
            }
        }
    };

    const handleNotePaste = (e, rowIdx, field) => {
        if (selection.startIdx !== null && selection.endIdx !== null) {
            const min = Math.min(selection.startIdx, selection.endIdx);
            const max = Math.max(selection.startIdx, selection.endIdx);
            if (min !== max) {
                e.preventDefault();
                const pastedText = e.clipboardData.getData('text');
                const selectedRows = filteredVisitSummaries.slice(min, max + 1);
                handleBulkSaveNote(selectedRows, selection.field, pastedText);
            }
        }
    };

    const handleCellMouseDown = (idx, field) => {
        setSelection({ startIdx: idx, endIdx: idx, field, isDragging: true });
    };

    const handleCellMouseEnter = (idx, field) => {
        if (selection.isDragging && selection.field === field) {
            setSelection(prev => ({ ...prev, endIdx: idx }));
        }
    };

    useEffect(() => {
        const handleGlobalMouseUp = () => {
            setSelection(prev => ({ ...prev, isDragging: false }));
        };
        window.addEventListener('mouseup', handleGlobalMouseUp);
        return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }, []);

    const isCellSelected = (idx, field) => {
        if (selection.startIdx === null || selection.endIdx === null || selection.field !== field) return false;
        const min = Math.min(selection.startIdx, selection.endIdx);
        const max = Math.max(selection.startIdx, selection.endIdx);
        return idx >= min && idx <= max;
    };

    // Auto-fetch notes on mount/change
    React.useEffect(() => {
        const fetchNotes = async () => {
            const { data, error } = await supabase.from('visit_notes').select('*');
            if (data) {
                const mapped = {};
                data.forEach(n => {
                    mapped[`${n.user_id}_${n.visit_date}`] = n;
                });
                setVisitNotes(mapped);
            }
        };
        fetchNotes();
    }, []);

    const filteredLogs = useMemo(() => {
        if (logCategory === 'SPACE') {
            return allLogs.filter(log => {
                const matchesType = ['CHECKIN', 'CHECKOUT', 'MOVE'].includes(log.type);
                const datePart = new Date(log.created_at).toLocaleDateString('en-CA');
                return matchesType && isWithinRange(datePart);
            });
        }
        return [];
    }, [allLogs, logCategory, startDate, endDate]);

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="p-6 md:p-10 bg-white rounded-3xl border border-gray-100 shadow-sm flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between bg-gradient-to-r from-white to-blue-50/20">
                <div>
                    <h2 className="text-2xl md:text-3xl font-black text-gray-800 tracking-tighter flex items-center gap-3">
                        <Database className="text-blue-600" size={32} />
                        로그 기록
                    </h2>
                    <p className="text-gray-500 text-sm font-medium mt-1">시스템 전체 이용 및 아카이빙 로그</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <div className="flex items-center gap-2">
                        <RangeDatePicker
                            startDate={startDate}
                            endDate={endDate}
                            onRangeChange={(s, e) => {
                                setStartDate(s);
                                setEndDate(e);
                            }}
                        />
                        {(startDate || endDate || Object.values(visitFilters).some(v => v)) && (
                            <button
                                onClick={() => {
                                    setStartDate('');
                                    setEndDate('');
                                    setVisitFilters({
                                        weekIds: [],
                                        dates: [],
                                        days: [],
                                        school: '',
                                        name: '',
                                        age: '',
                                        space: '',
                                        duration: '',
                                        purpose: '',
                                        remarks: ''
                                    });
                                }}
                                className="p-2.5 bg-gray-100/80 text-gray-500 rounded-2xl hover:bg-red-50 hover:text-red-500 transition-all shadow-sm border border-gray-100 flex items-center justify-center gap-1.5 text-xs font-bold"
                                title="필터 초기화"
                            >
                                <X size={16} /> 초기화
                            </button>
                        )}
                        {logCategory === 'VISIT' && selectedRows.size > 0 && (
                            <button
                                onClick={handleBulkDelete}
                                className="p-2.5 bg-red-50 text-red-600 rounded-2xl hover:bg-red-100 transition-all shadow-sm border border-red-100 flex items-center justify-center gap-1.5 text-xs font-bold"
                            >
                                <Trash2 size={16} /> 선택 삭제 ({selectedRows.size})
                            </button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => {
                                if (logCategory === 'VISIT') {
                                    handleSelectiveExport();
                                } else {
                                    const filtered = allLogs.filter(log => {
                                        const datePart = new Date(log.created_at).toISOString().split('T')[0];
                                        return isWithinRange(datePart);
                                    });
                                    exportLogsToExcel(filtered, users, locations, notices);
                                }
                            }}
                            className="bg-green-50 text-green-600 border border-green-200 px-4 py-2 rounded-xl flex items-center justify-center gap-2 hover:bg-green-100 transition font-bold shadow-sm text-sm"
                        >
                            <FileSpreadsheet size={18} /> {logCategory === 'VISIT' && selectedRows.size > 0 ? `선택 내보내기 (${selectedRows.size})` : '엑셀 저장'}
                        </button>
                        <button onClick={fetchData} className="bg-white text-blue-600 border border-blue-200 px-4 py-2 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-50 transition font-bold shadow-sm text-sm">
                            <RefreshCw size={18} /> 새로고침
                        </button>
                    </div>
                </div>
            </div>

            {/* Category Filter Tabs with Manual Entry Button */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex bg-gray-100/50 p-1.5 rounded-2xl w-full md:w-fit border border-gray-100 shadow-inner">
                    <button
                        onClick={() => setLogCategory('VISIT')}
                        className={`flex-1 md:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${logCategory === 'VISIT' ? 'bg-white text-blue-600 shadow-md transform scale-[1.02]' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <FileSpreadsheet size={16} /> 학생방문일지
                    </button>
                    <button
                        onClick={() => setLogCategory('SPACE')}
                        className={`flex-1 md:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${logCategory === 'SPACE' ? 'bg-white text-blue-600 shadow-md transform scale-[1.02]' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <MapPin size={16} /> 공간 이용
                    </button>
                    <button
                        onClick={() => setLogCategory('PROGRAM')}
                        className={`flex-1 md:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${logCategory === 'PROGRAM' ? 'bg-white text-blue-600 shadow-md transform scale-[1.02]' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Calendar size={16} /> 프로그램 참여
                    </button>
                    <button
                        onClick={() => setLogCategory('STUDENT')}
                        className={`flex-1 md:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${logCategory === 'STUDENT' ? 'bg-white text-blue-600 shadow-md transform scale-[1.02]' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <ClipboardList size={16} /> 학생만남일지
                    </button>
                </div>

                {logCategory === 'VISIT' && (
                    <button
                        onClick={() => setIsManualModalOpen(true)}
                        className="w-full md:w-auto px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-extrabold shadow-lg shadow-blue-200 hover:bg-blue-700 transition flex items-center justify-center gap-2"
                    >
                        <Calendar size={18} /> 수기작성
                    </button>
                )}
            </div>

            <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden ${logCategory === 'VISIT' ? 'min-h-[500px]' : ''}`}>
                {logCategory === 'VISIT' && (
                    <div className={`overflow-x-auto custom-scrollbar ${selection.isDragging ? 'select-none' : ''}`} style={{ minHeight: '500px' }}>
                        <table className="w-full text-left border-collapse min-w-[1300px]">
                            {/* ... Visit Table Content ... */}
                            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider font-semibold">
                                <tr className="border-b border-gray-100">
                                    <th className="p-3 pl-6 w-10">
                                        <input
                                            type="checkbox"
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            onChange={handleSelectAll}
                                            checked={filteredVisitSummaries.length > 0 && selectedRows.size === filteredVisitSummaries.length}
                                        />
                                    </th>
                                    <th className="p-3">
                                        <CheckboxFilter
                                            label="주차구분"
                                            options={filterOptions.weekIds}
                                            selectedValues={visitFilters.weekIds}
                                            onToggle={(val) => toggleFilter('weekIds', val)}
                                            onSelectAll={() => setVisitFilters(prev => ({ ...prev, weekIds: filterOptions.weekIds }))}
                                            onClear={() => setVisitFilters(prev => ({ ...prev, weekIds: [] }))}
                                        />
                                    </th>
                                    <th className="p-3">
                                        <CheckboxFilter
                                            label="날짜"
                                            options={filterOptions.dates}
                                            selectedValues={visitFilters.dates}
                                            onToggle={(val) => toggleFilter('dates', val)}
                                            onSelectAll={() => setVisitFilters(prev => ({ ...prev, dates: filterOptions.dates }))}
                                            onClear={() => setVisitFilters(prev => ({ ...prev, dates: [] }))}
                                        />
                                    </th>
                                    <th className="p-3">
                                        <CheckboxFilter
                                            label="요일"
                                            options={filterOptions.days}
                                            selectedValues={visitFilters.days}
                                            onToggle={(val) => toggleFilter('days', val)}
                                            onSelectAll={() => setVisitFilters(prev => ({ ...prev, days: filterOptions.days }))}
                                            onClear={() => setVisitFilters(prev => ({ ...prev, days: [] }))}
                                        />
                                    </th>
                                    <th className="p-3">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-1">
                                                <span>학교</span>
                                                {visitFilters.school && <Filter size={10} className="text-blue-500" />}
                                            </div>
                                            <input
                                                className={`font-normal border rounded px-1.5 py-0.5 text-[10px] w-full bg-white outline-none transition-colors ${visitFilters.school ? 'border-blue-400 focus:border-blue-500' : 'border-gray-200 focus:border-blue-400'}`}
                                                placeholder="검색..."
                                                value={visitFilters.school}
                                                onChange={(e) => setVisitFilters(prev => ({ ...prev, school: e.target.value }))}
                                            />
                                        </div>
                                    </th>
                                    <th className="p-3">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-1">
                                                <span>나이</span>
                                                {visitFilters.age && <Filter size={10} className="text-blue-500" />}
                                            </div>
                                            <input
                                                className={`font-normal border rounded px-1.5 py-0.5 text-[10px] w-full bg-white outline-none transition-colors ${visitFilters.age ? 'border-blue-400 focus:border-blue-500' : 'border-gray-200 focus:border-blue-400'}`}
                                                placeholder="검색..."
                                                value={visitFilters.age}
                                                onChange={(e) => setVisitFilters(prev => ({ ...prev, age: e.target.value }))}
                                            />
                                        </div>
                                    </th>
                                    <th className="p-3">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-1">
                                                <span>이름</span>
                                                {visitFilters.name && <Filter size={10} className="text-blue-500" />}
                                            </div>
                                            <input
                                                className={`font-normal border rounded px-1.5 py-0.5 text-[10px] w-full bg-white outline-none transition-colors ${visitFilters.name ? 'border-blue-400 focus:border-blue-500' : 'border-gray-200 focus:border-blue-400'}`}
                                                placeholder="검색..."
                                                value={visitFilters.name}
                                                onChange={(e) => setVisitFilters(prev => ({ ...prev, name: e.target.value }))}
                                            />
                                        </div>
                                    </th>
                                    <th className="p-3">시작시간</th>
                                    <th className="p-3">끝시간</th>
                                    <th className="p-3">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-1">
                                                <span>사용공간</span>
                                                {visitFilters.space && <Filter size={10} className="text-blue-500" />}
                                            </div>
                                            <input
                                                className={`font-normal border rounded px-1.5 py-0.5 text-[10px] w-full bg-white outline-none transition-colors ${visitFilters.space ? 'border-blue-400 focus:border-blue-500' : 'border-gray-200 focus:border-blue-400'}`}
                                                placeholder="검색..."
                                                value={visitFilters.space}
                                                onChange={(e) => setVisitFilters(prev => ({ ...prev, space: e.target.value }))}
                                            />
                                        </div>
                                    </th>
                                    <th className="p-3">센터타임</th>
                                    <th className="p-3">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-1">
                                                <span>센터타임(분)</span>
                                                {visitFilters.duration && <Filter size={10} className="text-blue-500" />}
                                            </div>
                                            <input
                                                className={`font-normal border rounded px-1.5 py-0.5 text-[10px] w-full bg-white outline-none transition-colors ${visitFilters.duration ? 'border-blue-400 focus:border-blue-500' : 'border-gray-200 focus:border-blue-400'}`}
                                                placeholder="검색..."
                                                value={visitFilters.duration}
                                                onChange={(e) => setVisitFilters(prev => ({ ...prev, duration: e.target.value }))}
                                            />
                                        </div>
                                    </th>
                                    <th className="p-3">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-1">
                                                <span>방문목적</span>
                                                {visitFilters.purpose && <Filter size={10} className="text-blue-500" />}
                                            </div>
                                            <input
                                                className={`font-normal border rounded px-1.5 py-0.5 text-[10px] w-full bg-white outline-none transition-colors ${visitFilters.purpose ? 'border-blue-400 focus:border-blue-500' : 'border-gray-200 focus:border-blue-400'}`}
                                                placeholder="검색..."
                                                value={visitFilters.purpose}
                                                onChange={(e) => setVisitFilters(prev => ({ ...prev, purpose: e.target.value }))}
                                            />
                                        </div>
                                    </th>
                                    <th className="p-3 pr-6">
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-1">
                                                <span>비고</span>
                                                {visitFilters.remarks && <Filter size={10} className="text-blue-500" />}
                                            </div>
                                            <input
                                                className={`font-normal border rounded px-1.5 py-0.5 text-[10px] w-full bg-white outline-none transition-colors ${visitFilters.remarks ? 'border-blue-400 focus:border-blue-500' : 'border-gray-200 focus:border-blue-400'}`}
                                                placeholder="검색..."
                                                value={visitFilters.remarks}
                                                onChange={(e) => setVisitFilters(prev => ({ ...prev, remarks: e.target.value }))}
                                            />
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {filteredVisitSummaries.length === 0 ? (
                                    <tr><td colSpan="13" className="p-10 text-center text-gray-400 font-bold italic">기록이 없습니다.</td></tr>
                                ) : (
                                    filteredVisitSummaries.map((summary, idx) => {
                                        const noteKey = `${summary.userId}_${summary.date}`;
                                        const note = visitNotes[noteKey] || {};

                                        return (
                                            <tr key={summary.id} className={`hover:bg-gray-50 transition border-l-4 border-l-blue-400 ${selectedRows.has(summary.id) ? 'bg-blue-50/30' : ''}`}>
                                                <td className="p-3 pl-6 text-center">
                                                    <input
                                                        type="checkbox"
                                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                        checked={selectedRows.has(summary.id)}
                                                        onChange={() => handleRowSelect(summary.id)}
                                                    />
                                                </td>
                                                <td className="p-3 font-mono text-[11px] text-gray-500">{summary.weekId}</td>
                                                <td className="p-3 whitespace-nowrap">{summary.date}</td>
                                                <td className="p-3">{summary.dayOfWeek}</td>
                                                <td className="p-3 whitespace-nowrap">{summary.school}</td>
                                                <td className="p-3">{summary.age}</td>
                                                <td className="p-3 font-bold text-gray-800">{summary.name}</td>
                                                <td className="p-3 font-mono text-xs">{summary.startTime}</td>
                                                <td className="p-3 font-mono text-xs">{summary.endTime}</td>
                                                <td className="p-3">
                                                    <span className="text-[11px] text-gray-600 line-clamp-2 leading-tight" title={summary.usedSpaces}>
                                                        {summary.usedSpaces}
                                                    </span>
                                                </td>
                                                <td className="p-3 font-mono text-xs text-blue-600 font-bold">{summary.durationStr}</td>
                                                <td className="p-3 text-xs text-gray-500">{summary.durationMin}</td>
                                                <td className={`p-1 min-w-[150px] transition-colors ${isCellSelected(idx, 'purpose') ? 'bg-blue-100/50' : ''}`}>
                                                    <input
                                                        ref={el => inputRefs.current[`${idx}-purpose`] = el}
                                                        className={`w-full p-2 bg-transparent border-none outline-none focus:bg-blue-50/50 focus:ring-1 focus:ring-blue-100 rounded text-xs text-blue-700 font-medium transition-all ${isCellSelected(idx, 'purpose') ? 'placeholder-blue-300' : ''}`}
                                                        placeholder="방문목적..."
                                                        value={visitNotes[`${summary.userId}_${summary.date}`]?.purpose || ''}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setVisitNotes(prev => ({
                                                                ...prev,
                                                                [`${summary.userId}_${summary.date}`]: { ...prev[`${summary.userId}_${summary.date}`], purpose: val }
                                                            }));
                                                        }}
                                                        onBlur={(e) => {
                                                            const original = visitNotes[`${summary.userId}_${summary.date}`]?.purpose || '';
                                                            if (e.target.value !== original) {
                                                                handleSaveNote(summary.userId, summary.date, 'purpose', e.target.value);
                                                            }
                                                        }}
                                                        onKeyDown={(e) => handleNoteKeyDown(e, idx, 'purpose')}
                                                        onPaste={(e) => handleNotePaste(e, idx, 'purpose')}
                                                        onMouseDown={() => handleCellMouseDown(idx, 'purpose')}
                                                        onMouseEnter={() => handleCellMouseEnter(idx, 'purpose')}
                                                    />
                                                </td>
                                                <td className={`p-1 pr-6 min-w-[150px] transition-colors ${isCellSelected(idx, 'remarks') ? 'bg-blue-100/50' : ''}`}>
                                                    <input
                                                        ref={el => inputRefs.current[`${idx}-remarks`] = el}
                                                        className={`w-full p-2 bg-transparent border-none outline-none focus:bg-gray-100/50 focus:ring-1 focus:ring-gray-200 rounded text-xs text-gray-500 transition-all ${isCellSelected(idx, 'remarks') ? 'placeholder-blue-300' : ''}`}
                                                        placeholder="비고..."
                                                        value={visitNotes[`${summary.userId}_${summary.date}`]?.remarks || ''}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setVisitNotes(prev => ({
                                                                ...prev,
                                                                [`${summary.userId}_${summary.date}`]: { ...prev[`${summary.userId}_${summary.date}`], remarks: val }
                                                            }));
                                                        }}
                                                        onBlur={(e) => {
                                                            const original = visitNotes[`${summary.userId}_${summary.date}`]?.remarks || '';
                                                            if (e.target.value !== original) {
                                                                handleSaveNote(summary.userId, summary.date, 'remarks', e.target.value);
                                                            }
                                                        }}
                                                        onKeyDown={(e) => handleNoteKeyDown(e, idx, 'remarks')}
                                                        onPaste={(e) => handleNotePaste(e, idx, 'remarks')}
                                                        onMouseDown={() => handleCellMouseDown(idx, 'remarks')}
                                                        onMouseEnter={() => handleCellMouseEnter(idx, 'remarks')}
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {logCategory === 'STUDENT' && (
                    <div className="overflow-x-auto custom-scrollbar" style={{ minHeight: '500px' }}>
                        <table className="w-full text-left border-collapse min-w-[1000px]">
                            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider font-semibold">
                                <tr className="border-b border-gray-100">
                                    <th className="p-3 pl-6">Week ID</th>
                                    <th className="p-3">날짜</th>
                                    <th className="p-3 text-center">구분</th>
                                    <th className="p-3">학교</th>
                                    <th className="p-3 text-center">인원수</th>
                                    <th className="p-3 text-center">시작시간</th>
                                    <th className="p-3 text-center">끝시간</th>
                                    <th className="p-3 text-center">스쳐타임</th>
                                    <th className="p-3 text-center">스쳐타임(분)</th>
                                    <th className="p-3 pr-6">참여팀원</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {filteredSchoolLogs.length === 0 ? (
                                    <tr><td colSpan="10" className="p-10 text-center text-gray-400 font-bold italic">기록이 없습니다.</td></tr>
                                ) : (
                                    filteredSchoolLogs.map((log) => (
                                        <tr
                                            key={log.id}
                                            onClick={() => setSelectedLogId(log.id)}
                                            className="hover:bg-gray-50 transition border-l-4 border-l-transparent hover:border-l-indigo-400 cursor-pointer"
                                        >
                                            <td className="p-3 pl-6 font-mono text-[11px] text-gray-500">{log.weekId}</td>
                                            <td className="p-3 whitespace-nowrap">{log.date}</td>
                                            <td className="p-3 text-center text-indigo-600 font-bold text-xs">
                                                <span className={`bg-indigo-50/80 px-2 py-1 rounded-md ${log.category === '학생만남' ? 'text-gray-600 bg-gray-100' : ''}`}>{log.category}</span>
                                            </td>
                                            <td className="p-3 font-bold text-gray-800">{log.schoolName}</td>
                                            <td className="p-3 text-center">{log.participantCount}명</td>
                                            <td className="p-3 font-mono text-xs text-center">{log.startTime}</td>
                                            <td className="p-3 font-mono text-xs text-center">{log.endTime}</td>
                                            <td className="p-3 font-mono text-xs text-center bg-gray-50 rounded text-gray-600">{log.durationStr}</td>
                                            <td className="p-3 text-center font-bold text-blue-600">{log.durationMin}분</td>
                                            <td className="p-3 pr-6 text-gray-600 font-medium whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]" title={log.facilitatorNames}>{log.facilitatorNames}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            {logCategory === 'PROGRAM' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider font-semibold">
                            <tr>
                                <th className="p-4 pl-6 whitespace-nowrap">프로그램 일정</th>
                                <th className="p-4">프로그램명</th>
                                <th className="p-4 text-center">분류</th>
                                <th className="p-4">유형</th>
                                <th className="p-4">참여 현황</th>
                                <th className="p-4">명단</th>
                                <th className="p-4 pr-6 text-center">관리</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {programSummaries.length === 0 ? (
                                <tr><td colSpan="7" className="p-10 text-center text-gray-400 font-bold italic">기록이 없습니다.</td></tr>
                            ) : (
                                programSummaries.map((summary) => (
                                    <tr key={summary.id} className="hover:bg-gray-50 transition group border-l-4 border-l-indigo-400">
                                        <td className="p-4 pl-6 text-indigo-600 font-mono text-[10px] md:text-xs whitespace-nowrap font-bold">
                                            {summary.displayTime}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col items-start justify-center gap-0.5">
                                                <span className="font-bold text-gray-700 truncate max-w-[180px] leading-tight">
                                                    {summary.prgTitle}
                                                </span>
                                                {summary.prgLocation && (
                                                    <span className="text-[10px] text-gray-400 font-bold leading-tight">({summary.prgLocation})</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${summary.prgType === 'CENTER' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                                                {summary.prgType === 'CENTER' ? '센터' : '스처'}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <span className={`inline-block px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap text-center min-w-[50px] ${summary.type === 'COMPLETED' ? 'text-indigo-600 bg-indigo-50' : 'text-orange-600 bg-orange-50'}`}>
                                                {summary.type === 'COMPLETED' ? '완료' : '취소'}
                                            </span>
                                        </td>
                                        <td className="p-4 whitespace-nowrap">
                                            {summary.type === 'COMPLETED' ? (
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-blue-600 font-bold text-xs ring-1 ring-blue-100 bg-blue-50/50 px-2 py-0.5 rounded-md inline-block w-fit">참석: {summary.attendees.length}명</span>
                                                    <span className="text-gray-400 text-[10px] pl-1">미참석: {summary.absentees.length}명</span>
                                                </div>
                                            ) : (
                                                <span className="text-orange-600 font-bold text-xs ring-1 ring-orange-100 bg-orange-50/50 px-2 py-1 rounded-md">신청자: {summary.cancelled.length}명</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-xs text-gray-500 min-w-[250px]">
                                            <div className="flex flex-wrap gap-1.5 max-w-[400px]">
                                                {(summary.type === 'COMPLETED' ? [...summary.attendees, ...summary.absentees] : summary.cancelled).map((person, i) => (
                                                    <span key={i} className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${person.type === 'PRG_ATTENDED' ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : 'bg-gray-100/80 border-gray-200 text-gray-500'}`}>
                                                        {person.name}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="p-4 pr-6 text-center">
                                            <button
                                                onClick={() => handleDeleteProgramSummary(summary.logIds)}
                                                className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {logCategory === 'SPACE' && (
                <>
                    <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider font-semibold">
                                <tr>
                                    <th className="p-4 pl-6">시간</th>
                                    <th className="p-4">이름</th>
                                    <th className="p-4">종류</th>
                                    <th className="p-4 pr-6">위치 / 프로그램 상세</th>
                                    <th className="p-4 pr-6 text-center">관리</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-sm">
                                {(filteredLogs && filteredLogs.length === 0) ? (
                                    <tr><td colSpan="5" className="p-10 text-center text-gray-400 font-bold italic">기록이 없습니다.</td></tr>
                                ) : (
                                    [...filteredLogs].reverse().slice(0, 100).map((log) => {
                                        const user = users.find(u => u.id === log.user_id);
                                        const location = locations.find(l => l.id === log.location_id);
                                        const { title: prgTitle } = parseLocationId(log.location_id);
                                        const notice = notices?.find(n => n.id === parseLocationId(log.location_id).id);

                                        let typeLabel = '';
                                        let typeColor = '';

                                        switch (log.type) {
                                            case 'CHECKIN': typeLabel = '입실'; typeColor = 'text-green-600 bg-green-50'; break;
                                            case 'CHECKOUT': typeLabel = '퇴실'; typeColor = 'text-red-500 bg-red-50'; break;
                                            case 'MOVE': typeLabel = '이동'; typeColor = 'text-blue-600 bg-blue-50'; break;
                                            case 'PRG_COMPLETED': typeLabel = '완료'; typeColor = 'text-indigo-600 bg-indigo-50'; break;
                                            case 'PRG_CANCELLED': typeLabel = '취소'; typeColor = 'text-orange-600 bg-orange-50'; break;
                                            default: typeLabel = log.type; typeColor = 'text-gray-600 bg-gray-100';
                                        }

                                        const isProgramType = log.type.startsWith('PRG_');

                                        return (
                                            <tr key={log.id} className={`hover:bg-gray-50 transition group ${isProgramType ? 'border-l-4 border-l-indigo-400' : ''}`}>
                                                <td className="p-4 pl-6 text-gray-500 font-mono text-xs">
                                                    {new Date(log.created_at).toLocaleString()}
                                                </td>
                                                <td className="p-4 font-bold text-gray-700 whitespace-nowrap">
                                                    {user ? user.name : '알 수 없음'}
                                                </td>
                                                <td className="p-4">
                                                    <span className={`inline-block px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap text-center min-w-[50px] ${typeColor}`}>
                                                        {typeLabel}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-gray-600 font-bold max-w-[200px] truncate">
                                                    {isProgramType ? (prgTitle || (notice ? notice.title : '삭제된 프로그램')) : (location ? location.name : '-')}
                                                </td>
                                                <td className="p-4 pr-6 text-center">
                                                    <button
                                                        onClick={() => handleDeleteLog(log.id)}
                                                        className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="md:hidden bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100">
                        {(filteredLogs && filteredLogs.length === 0) ? (
                            <div className="p-10 text-center text-gray-400 text-sm font-bold italic">기록이 없습니다.</div>
                        ) : (
                            [...filteredLogs].reverse().slice(0, 50).map((log) => {
                                const user = users.find(u => u.id === log.user_id);
                                const location = locations.find(l => l.id === log.location_id);
                                const { title: prgTitle } = parseLocationId(log.location_id);
                                const notice = notices?.find(n => n.id === parseLocationId(log.location_id).id);

                                let typeLabel = '';
                                let typeColor = '';

                                switch (log.type) {
                                    case 'CHECKIN': typeLabel = '입실'; typeColor = 'text-green-600 bg-green-50'; break;
                                    case 'CHECKOUT': typeLabel = '퇴실'; typeColor = 'text-red-500 bg-red-50'; break;
                                    case 'MOVE': typeLabel = '이동'; typeColor = 'text-blue-600 bg-blue-50'; break;
                                    case 'PRG_COMPLETED': typeLabel = '완료'; typeColor = 'text-indigo-600 bg-indigo-50'; break;
                                    case 'PRG_CANCELLED': typeLabel = '취소'; typeColor = 'text-orange-600 bg-orange-50'; break;
                                    default: typeLabel = log.type; typeColor = 'text-gray-600 bg-gray-100';
                                }

                                const isProgramType = log.type.startsWith('PRG_');

                                return (
                                    <div key={log.id} className={`p-4 space-y-2 relative ${isProgramType ? 'bg-indigo-50/20 border-l-4 border-l-indigo-400' : ''}`}>
                                        <button
                                            onClick={() => handleDeleteLog(log.id)}
                                            className="absolute top-4 right-4 p-1.5 text-gray-300 hover:text-red-500 rounded-lg transition"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                        <div className="flex justify-between items-center pr-8">
                                            <span className="font-bold text-gray-800">{user ? user.name : '알 수 없음'}</span>
                                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${typeColor}`}>
                                                {typeLabel}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-gray-400">{new Date(log.created_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                                            <span className={`text-gray-800 font-bold truncate max-w-[150px] ${isProgramType ? 'text-indigo-600' : ''}`}>
                                                {isProgramType ? (prgTitle || (notice ? notice.title : '삭제된 프로그램')) : (location ? location.name : '-')}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </>
            )}

            {/* Manual Entry Modal */}
            {
                isManualModalOpen && (
                    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                        <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col">
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                <div>
                                    <h3 className="text-xl font-extrabold text-gray-800">방문 기록 수기작성</h3>
                                    <p className="text-xs text-gray-400 font-bold">오프라인 방문 데이터를 수동으로 입력합니다.</p>
                                </div>
                                <button onClick={() => setIsManualModalOpen(false)} className="p-2 hover:bg-white rounded-full transition text-gray-400">
                                    <X size={24} />
                                </button>
                            </div>

                            <form onSubmit={handleManualSubmit} className="p-6 space-y-4">
                                {/* Member Selection */}
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-gray-500 flex items-center gap-1"><RefreshCw size={12} /> 회원 선택</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="이름 또는 학교 검색..."
                                            value={userSearchText}
                                            onChange={(e) => {
                                                setUserSearchText(e.target.value);
                                                setShowUserResults(true);
                                            }}
                                            onFocus={() => setShowUserResults(true)}
                                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-400 focus:bg-white transition-all text-sm font-bold"
                                        />
                                        {showUserResults && userSearchText && (
                                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-[160px] overflow-y-auto z-10 custom-scrollbar">
                                                {users.filter(u =>
                                                    u.name.includes(userSearchText) || (u.school && u.school.includes(userSearchText))
                                                ).map(u => (
                                                    <button
                                                        key={u.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setManualEntry({ ...manualEntry, userId: u.id });
                                                            setUserSearchText(`${u.name} (${u.school || '-'})`);
                                                            setShowUserResults(false);
                                                        }}
                                                        className="w-full p-2.5 text-left hover:bg-blue-50 transition border-b border-gray-50 last:border-0 flex justify-between items-center"
                                                    >
                                                        <span className="font-bold text-gray-700 text-sm">{u.name}</span>
                                                        <span className="text-[10px] text-gray-400 font-bold">{u.school} | {u.birth}</span>
                                                    </button>
                                                ))}
                                                {users.filter(u => u.name.includes(userSearchText) || (u.school && u.school.includes(userSearchText))).length === 0 && (
                                                    <div className="p-4 text-center text-xs text-gray-400">검색 결과가 없습니다.</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-gray-500">방문 날짜</label>
                                        <input
                                            type="date"
                                            value={manualEntry.date}
                                            onChange={(e) => setManualEntry({ ...manualEntry, date: e.target.value })}
                                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-400 focus:bg-white transition-all text-sm font-bold"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-gray-500">사용 공간</label>
                                        <select
                                            value={manualEntry.locationId}
                                            onChange={(e) => setManualEntry({ ...manualEntry, locationId: e.target.value })}
                                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-400 focus:bg-white transition-all text-sm font-bold appearance-none"
                                            required
                                        >
                                            <option value="">장소 선택...</option>
                                            {locations.map(loc => (
                                                <option key={loc.id} value={loc.id}>{loc.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-gray-500">시작 시간</label>
                                        <input
                                            type="time"
                                            value={manualEntry.startTime}
                                            onChange={(e) => setManualEntry({ ...manualEntry, startTime: e.target.value })}
                                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-400 focus:bg-white transition-all text-sm font-bold"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-gray-500">종료 시간</label>
                                        <input
                                            type="time"
                                            value={manualEntry.endTime}
                                            onChange={(e) => setManualEntry({ ...manualEntry, endTime: e.target.value })}
                                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-400 focus:bg-white transition-all text-sm font-bold"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="pt-4 flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsManualModalOpen(false)}
                                        className="flex-1 py-3 bg-gray-100 text-gray-500 rounded-2xl font-bold hover:bg-gray-200 transition"
                                    >
                                        취소
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-[2] py-3 bg-blue-600 text-white rounded-2xl font-extrabold hover:bg-blue-700 transition shadow-lg shadow-blue-100"
                                    >
                                        저장하기
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
            {selectedLogId && (
                <LogDetailModal
                    logs={filteredSchoolLogs}
                    initialLogId={selectedLogId}
                    school={{ students: [] }}
                    allUsers={users}
                    onClose={() => setSelectedLogId(null)}
                    onRefresh={fetchData}
                    onDelete={(id) => {
                        if (confirm('정말 삭제하시겠습니까?')) {
                            supabase.from('school_logs').delete().eq('id', id).then(({ error }) => {
                                if (!error) {
                                    fetchData();
                                    setSelectedLogId(null);
                                } else {
                                    alert('삭제 실패');
                                }
                            });
                        }
                    }}
                />
            )}
        </div >
    );
};

export default AdminLogs;
