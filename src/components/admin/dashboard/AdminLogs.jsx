import React, { useState, useMemo, useRef, useEffect } from 'react';
import { RefreshCw, FileSpreadsheet, MapPin, Calendar, Trash2, Filter, X, ClipboardList, Database, User as UserIcon } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import { exportLogsToExcel, exportVisitLogToExcel } from '../../../utils/exportUtils';
import RangeDatePicker from '../../common/RangeDatePicker';
import CheckboxFilter from '../../common/CheckboxFilter';


import VisitLogTable from './components/VisitLogTable';
import GuestLogTable from './components/GuestLogTable';
import StudentMeetLogTable from './components/StudentMeetLogTable';
import ProgramLogTable from './components/ProgramLogTable';
import SpaceLogTable from './components/SpaceLogTable';
import ManualEntryModal from './modals/ManualEntryModal';

import LogDetailModal from '../school/LogDetailModal';

import { useAdminLogs } from './hooks/useAdminLogs.jsx';
import { aggregateVisitSessions } from '../../../utils/visitUtils';
import { getWeekIdentifier, parseTimeRange } from '../../../utils/dateUtils';
import { isAdminOrStaff } from '../../../utils/userUtils';

const AdminLogs = ({ allLogs, schoolLogs = [], users, locations, notices, fetchData }) => {
    const hookData = useAdminLogs({ allLogs, schoolLogs, users, locations, notices, fetchData });
    const {
        logCategory, setLogCategory, selectedLogId, setSelectedLogId,
        visitNotes, setVisitNotes, startDate, setStartDate, endDate, setEndDate,
        visitFilters, setVisitFilters, selectedRows, setSelectedRows,
        isManualModalOpen, setIsManualModalOpen, manualEntry, setManualEntry,
        userSearchText, setUserSearchText, showUserResults, setShowUserResults,
        inputRefs, selection, setSelection, focusValRef,
        isWithinRange, parseLocationId, extractProgramInfo, formatShortTime, toggleFilter,
        visitSummaries, filteredVisitSummaries, filteredGuestSummaries, currentSummaries, filterOptions,
        processedSchoolLogs, filteredSchoolLogs, selectedSchoolLogs, programSummaries, filteredLogs,
        handleDeleteLog, handleDeleteProgramSummary, handleBulkDelete, handleSelectiveExport,
        handleSelectAll, handleRowSelect, handleManualSubmit, handleSaveNote, handleBulkSaveNote,
        handleNoteKeyDown, handleNotePaste, handleCellMouseDown, handleCellMouseEnter, isCellSelected
    } = hookData;
    return (
        <div className="space-y-4 md:space-y-6 animate-fade-in-up">
            <div className="p-4 md:p-10 bg-white rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm flex flex-col lg:flex-row gap-4 md:gap-6 items-start lg:items-center justify-between bg-gradient-to-r from-white to-blue-50/20">
                <div className="flex items-center justify-between w-full lg:w-auto">
                    <div>
                        <h2 className="text-xl md:text-3xl font-black text-gray-800 tracking-tighter flex items-center gap-2 md:gap-3">
                            <Database className="text-blue-600" size={24} md:size={32} />
                            로그 기록
                        </h2>
                        <p className="hidden md:block text-gray-500 text-sm font-medium mt-1">시스템 전체 이용 및 아카이빙 로그</p>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row flex-wrap items-center gap-2 md:gap-3 w-full lg:w-auto justify-end">
                    <div className="flex items-center gap-2 w-full sm:w-auto">
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
                                        space: [],
                                        duration: '',
                                        purpose: '',
                                        remarks: ''
                                    });
                                }}
                                className="p-2 md:p-2.5 bg-gray-100/80 text-gray-500 rounded-xl md:rounded-2xl hover:bg-red-50 hover:text-red-500 transition-all shadow-sm border border-gray-100 flex items-center justify-center gap-1 text-[10px] md:text-xs font-bold"
                                title="필터 초기화"
                            >
                                <X size={14} md:size={16} /> <span className="hidden sm:inline">초기화</span>
                            </button>
                        )}
                        {logCategory === 'VISIT' && selectedRows.size > 0 && (
                            <button
                                onClick={handleBulkDelete}
                                className="p-2 md:p-2.5 bg-red-50 text-red-600 rounded-xl md:rounded-2xl hover:bg-red-100 transition-all shadow-sm border border-red-100 flex items-center justify-center gap-1 text-[10px] md:text-xs font-bold whitespace-nowrap"
                            >
                                <Trash2 size={14} md:size={16} /> <span className="hidden sm:inline">삭제</span>({selectedRows.size})
                            </button>
                        )}
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
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
                            className="flex-1 sm:flex-none bg-green-50 text-green-600 border border-green-200 px-3 md:px-4 py-2 rounded-xl flex items-center justify-center gap-1.5 hover:bg-green-100 transition font-bold shadow-sm text-xs md:text-sm whitespace-nowrap"
                        >
                            <FileSpreadsheet size={16} md:size={18} /> 엑셀
                        </button>
                        <button onClick={fetchData} className="flex-1 sm:flex-none bg-white text-blue-600 border border-blue-200 px-3 md:px-4 py-2 rounded-xl flex items-center justify-center gap-1.5 hover:bg-blue-50 transition font-bold shadow-sm text-xs md:text-sm whitespace-nowrap">
                            <RefreshCw size={16} md:size={18} /> <span className="hidden sm:inline">새로고침</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Category Filter Tabs with Manual Entry Button */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex overflow-x-auto no-scrollbar bg-gray-100/50 p-1.5 rounded-2xl w-full md:w-fit border border-gray-100 shadow-inner gap-1">
                    <button
                        onClick={() => setLogCategory('VISIT')}
                        className={`whitespace-nowrap shrink-0 flex-1 md:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${logCategory === 'VISIT' ? 'bg-white text-blue-600 shadow-md transform scale-[1.02]' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <FileSpreadsheet size={16} className="shrink-0" /> 학생방문일지
                    </button>
                    <button
                        onClick={() => setLogCategory('GUEST')}
                        className={`whitespace-nowrap shrink-0 flex-1 md:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${logCategory === 'GUEST' ? 'bg-white text-indigo-600 shadow-md transform scale-[1.02]' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <UserIcon size={16} className="shrink-0" /> 게스트 방문일지
                    </button>
                    <button
                        onClick={() => setLogCategory('STUDENT')}
                        className={`whitespace-nowrap shrink-0 flex-1 md:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${logCategory === 'STUDENT' ? 'bg-white text-blue-600 shadow-md transform scale-[1.02]' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <ClipboardList size={16} className="shrink-0" /> 학생만남일지
                    </button>
                    <button
                        onClick={() => setLogCategory('PROGRAM')}
                        className={`whitespace-nowrap shrink-0 flex-1 md:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${logCategory === 'PROGRAM' ? 'bg-white text-blue-600 shadow-md transform scale-[1.02]' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Calendar size={16} className="shrink-0" /> 프로그램 참여
                    </button>
                    <button
                        onClick={() => setLogCategory('SPACE')}
                        className={`whitespace-nowrap shrink-0 flex-1 md:flex-none px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${logCategory === 'SPACE' ? 'bg-white text-blue-600 shadow-md transform scale-[1.02]' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <MapPin size={16} className="shrink-0" /> 공간 이용
                    </button>
                </div>

                {(logCategory === 'VISIT' || logCategory === 'GUEST') && (
                    <button
                        onClick={() => setIsManualModalOpen(true)}
                        className="w-full md:w-auto px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-extrabold shadow-lg shadow-blue-200 hover:bg-blue-700 transition flex items-center justify-center gap-2"
                    >
                        <Calendar size={18} /> 수기작성
                    </button>
                )}
            </div>

            <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden ${logCategory === 'VISIT' ? 'min-h-[500px]' : ''}`}>
                {logCategory === 'VISIT' && <VisitLogTable hookData={hookData} />}
                {logCategory === 'GUEST' && <GuestLogTable hookData={hookData} />}
                {logCategory === 'STUDENT' && <StudentMeetLogTable hookData={hookData} setSelectedLogId={setSelectedLogId} />}
            </div>
            {logCategory === 'PROGRAM' && <ProgramLogTable hookData={hookData} />}
            {logCategory === 'SPACE' && <SpaceLogTable hookData={hookData} users={users} locations={locations} notices={notices} />}
            <ManualEntryModal hookData={hookData} users={users} locations={locations} />
            {selectedLogId && (
                <LogDetailModal
                    logs={selectedSchoolLogs}
                    initialLogId={selectedLogId}
                    school={(() => {
                        const log = processedSchoolLogs.find(l => l.id === selectedLogId);
                        return {
                            name: log?.schoolName,
                            metadata: log?.schools, // Contains school id, name, etc.
                            students: users.filter(u => u.school === log?.schoolName) // Approximate student list
                        };
                    })()}
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

export default React.memo(AdminLogs, (prevProps, nextProps) => {
    // Basic shallow comparison for main data arrays 
    // This assumes they are immutable arrays coming from the parent (AdminDashboard)
    return prevProps.allLogs === nextProps.allLogs &&
        prevProps.schoolLogs === nextProps.schoolLogs &&
        prevProps.users === nextProps.users &&
        prevProps.locations === nextProps.locations &&
        prevProps.notices === nextProps.notices;
});
