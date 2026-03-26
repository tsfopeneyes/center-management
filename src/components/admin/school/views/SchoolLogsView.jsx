import React from 'react';
import { ClipboardList, Plus, ChevronRight, FileText } from 'lucide-react';

const SchoolLogsView = ({ school, logs, staffList, allUsers, hookData }) => {
    const { isInfoCollapsed, setIsLogFormOpen, setSelectedLog } = hookData;
    
    const handleRowClick = (log) => {
        setSelectedLog(log);
    };

    return (
<>
                                {/* Status Cards (Only show on PC or when EXpanded if you want, but for now just merging into foldable section on mobile) */}
                                <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0 transition-all duration-300 ${isInfoCollapsed ? 'hidden lg:grid' : 'grid'}`}>
                                    <div className="p-6 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-[2rem] text-white shadow-xl shadow-indigo-100 flex lg:flex-col items-center lg:items-start justify-between">
                                        <p className="text-[10px] font-black text-white/60 uppercase tracking-widest mb-1">소속 학생수</p>
                                        <p className="text-2xl md:text-3xl font-black">{school.students.length}<span className="text-sm font-bold ml-1 opacity-60">명</span></p>
                                    </div>
                                    <div className="p-6 bg-white border border-gray-100 rounded-[2rem] shadow-sm flex lg:flex-col items-center lg:items-start justify-between">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">총 기록 건수</p>
                                        <p className="text-2xl md:text-3xl font-black text-gray-800">{logs.length}<span className="text-sm font-bold ml-1 text-gray-400">건</span></p>
                                    </div>
                                    <div className="p-6 bg-white border border-gray-100 rounded-[2rem] shadow-sm flex lg:flex-col items-center lg:items-start justify-between">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">최근 활동일</p>
                                        <p className="text-lg md:text-xl font-black text-gray-800 mt-0 lg:mt-2">{logs[0] ? logs[0].date : '-'}</p>
                                    </div>
                                </div>

                                {/* Logs Section Header */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
                                    <h3 className="font-black text-gray-800 flex items-center gap-2 text-lg">
                                        <ClipboardList className="text-indigo-600" size={24} />
                                        학교 사역 일지
                                    </h3>
                                    <button
                                        onClick={() => setIsLogFormOpen(true)}
                                        className="px-6 py-4 md:py-3.5 bg-indigo-600 text-white rounded-2xl font-black text-sm md:text-xs shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 active:scale-95"
                                    >
                                        <Plus size={18} /> 새로운 사역일지 입력
                                    </button>
                                </div>

                                {/* Enhanced Table Header (PC Only) */}
                                <div className="hidden lg:flex items-center gap-4 px-6 py-4 bg-gray-50/80 rounded-2xl text-[11px] font-black text-gray-400 uppercase tracking-widest border border-gray-100">
                                    <div className="w-[180px] shrink-0 text-center">날짜 및 시간</div>
                                    <div className="flex-1 min-w-0">참여자</div>
                                    <div className="w-[120px] shrink-0 text-center">장소</div>
                                    <div className="w-[80px] shrink-0 text-center">작성자</div>
                                </div>

                                {/* Logs List - Refined Card UI */}
                                <div className="space-y-4">
                                    {logs.map(log => (
                                        <div
                                            key={log.id}
                                            onClick={() => handleRowClick(log)}
                                            className="flex items-center gap-4 px-6 py-4 bg-white border border-gray-100 rounded-xl hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group animate-fade-in relative overflow-hidden"
                                        >
                                            {/* Left Accent Bar on Hover */}
                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />

                                            {/* Date & Time (Fixed Width, Single Line) */}
                                            <div className="flex items-center justify-center gap-2 shrink-0 w-[180px]">
                                                <span className="text-[12px] font-black text-indigo-600 whitespace-nowrap">{log.date}</span>
                                                <div className="w-[1px] h-3 bg-gray-200"></div>
                                                <span className="text-[11px] text-gray-400 font-bold whitespace-nowrap overflow-hidden text-ellipsis">{log.time_range}</span>
                                            </div>

                                            {/* Participants & Facilitators (Flexible Width) */}
                                            <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-hidden">
                                                {/* Facilitators */}
                                                {log.facilitator_ids?.map(fid => {
                                                    const staff = staffList.find(s => s.id === fid);
                                                    return staff ? (
                                                        <span key={fid} className="shrink-0 px-2 py-0.5 bg-indigo-600 rounded text-[10px] font-bold text-white whitespace-nowrap">
                                                            {staff.name}
                                                        </span>
                                                    ) : null;
                                                })}

                                                {/* Students */}
                                                <div className="flex items-center gap-1.5 overflow-hidden">
                                                    {log.participant_ids?.length > 0 ? (
                                                        log.participant_ids.map(pid => {
                                                            const student = school.students.find(s => s.id === pid) || (allUsers || []).find(u => u.id === pid);
                                                            return student ? (
                                                                <span key={pid} className="shrink-0 text-[11px] text-gray-500 font-bold whitespace-nowrap hover:text-indigo-600">
                                                                    {student.name}
                                                                </span>
                                                            ) : null;
                                                        })
                                                    ) : (
                                                        (!log.facilitator_ids || log.facilitator_ids.length === 0) && (
                                                            <span className="text-[10px] text-gray-300 font-bold">참여자 없음</span>
                                                        )
                                                    )}
                                                </div>
                                            </div>

                                            {/* Location (Text Only, Truncate) */}
                                            <div className="w-[120px] shrink-0 text-center hidden md:block">
                                                <div className="text-[11px] text-gray-400 font-bold truncate px-2">
                                                    {log.location || '-'}
                                                </div>
                                            </div>

                                            {/* Author */}
                                            <div className="w-[80px] shrink-0 flex justify-center items-center">
                                                <span className="text-[11px] font-bold text-gray-500">
                                                    {log.author_id ? ((allUsers || []).find(u => u.id === log.author_id)?.name || '알수없음') : '-'}
                                                </span>
                                            </div>

                                            {/* Arrow Icon */}
                                            <ChevronRight size={14} className="text-gray-300 shrink-0 group-hover:text-indigo-500 transition-colors" />
                                        </div>))}

                                    {logs.length === 0 && (
                                        <div className="p-20 text-center flex flex-col items-center justify-center gap-4 bg-gray-50/30 rounded-[3rem] border-2 border-dashed border-gray-100">
                                            <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center text-gray-200 shadow-sm">
                                                <FileText size={32} />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-gray-400 font-black">기록된 사역 일지가 없습니다</p>
                                                <p className="text-xs text-gray-300 font-bold">새로운 사역일지를 작성하여 데이터를 기록해 보세요</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
    );
};
export default SchoolLogsView;