import React from 'react';
import { Calendar, Clock, MapPin, Save, Trash2 } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';

const LogCard = ({
    log, index, totalLogs, school, allUsers, staffList, onDelete,
    isEditing, editData,
    sTerm, fTerm,
    setEditingLogs, setSearchTerm, setFacilitatorSearchTerm,
    handleSaveEdit, handleKeyDown,
    toggleParticipant, toggleFacilitator,
    startEditing, cancelEditing, savingId, logRef
}) => {
    const currentContent = isEditing ? editData.content : log.content;
    const filteredStudents = (school?.students || []).filter(s =>
        s.name.includes(sTerm) || s.phone?.includes(sTerm)
    );

    return (
        <div ref={logRef} className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden scroll-mt-24">
            {/* Header / Meta Info */}
            <div className="p-6 md:p-8 border-b border-gray-50 bg-gray-50/30 flex justify-between items-start">
                <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-3">
                        {isEditing ? (
                            <input
                                type="date"
                                value={editData.date || ''}
                                onChange={e => setEditingLogs(prev => ({ ...prev, [log.id]: { ...prev[log.id], date: e.target.value } }))}
                                className="px-3 py-1.5 bg-white border border-indigo-200 rounded-lg text-sm font-bold text-gray-700 outline-none focus:border-indigo-500 transition-colors shadow-sm"
                            />
                        ) : (
                            <div className="flex items-center gap-2 text-indigo-600 font-extrabold text-base">
                                <Calendar size={20} />
                                {log.date}
                            </div>
                        )}
                        <div className="px-3 py-1 bg-indigo-100/50 rounded-lg text-xs font-black text-indigo-600">
                            {totalLogs - index}번째 일지
                        </div>
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
                        {isEditing ? (
                            <div className="flex items-center gap-2">
                                <input
                                    type="time"
                                    value={editData.start_time || ''}
                                    onChange={e => setEditingLogs(prev => ({ ...prev, [log.id]: { ...prev[log.id], start_time: e.target.value } }))}
                                    className="px-2 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs font-bold text-gray-700 outline-none focus:border-indigo-500 shadow-sm"
                                />
                                <span className="text-gray-400 font-bold">~</span>
                                <input
                                    type="time"
                                    value={editData.end_time || ''}
                                    onChange={e => setEditingLogs(prev => ({ ...prev, [log.id]: { ...prev[log.id], end_time: e.target.value } }))}
                                    className="px-2 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs font-bold text-gray-700 outline-none focus:border-indigo-500 shadow-sm"
                                />
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-gray-400 font-bold text-sm">
                                <Clock size={16} />
                                {log.time_range}
                            </div>
                        )}

                        {isEditing ? (
                            <input
                                type="text"
                                placeholder="장소 입력..."
                                value={editData.location || ''}
                                onChange={e => setEditingLogs(prev => ({ ...prev, [log.id]: { ...prev[log.id], location: e.target.value } }))}
                                className="flex-1 max-w-[200px] px-3 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs font-bold text-gray-700 outline-none focus:border-indigo-500 shadow-sm"
                            />
                        ) : (
                            <div className="flex items-center gap-1.5 text-gray-400 text-sm font-bold">
                                <MapPin size={14} />
                                {log.location || '장소 미입력'}
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex gap-2 shrink-0 ml-4">
                    {isEditing ? (
                        <button
                            onClick={() => handleSaveEdit(log.id)}
                            disabled={savingId === log.id}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
                        >
                            <Save size={14} />
                            저장
                        </button>
                    ) : (
                        <button
                            onClick={() => startEditing(log)}
                            className="p-3 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                        </button>
                    )}
                    <button
                        onClick={() => onDelete(log.id)}
                        className="p-3 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    >
                        <Trash2 size={20} />
                    </button>
                </div>
            </div>

            <div className="p-6 md:p-8 space-y-8">
                {/* Facilitators Area */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h4 className="text-[10px] text-gray-400 font-black uppercase tracking-widest ml-1">진행자</h4>
                        {isEditing && (
                            <div className="relative w-1/2 max-w-[160px]">
                                <svg className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                <input
                                    type="text"
                                    placeholder="진행자 검색..."
                                    value={fTerm}
                                    onChange={e => setFacilitatorSearchTerm(prev => ({ ...prev, [log.id]: e.target.value }))}
                                    className="w-full pl-6 pr-2 py-1.5 bg-white border border-indigo-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 transition-all shadow-sm"
                                />
                            </div>
                        )}
                    </div>

                    {isEditing ? (
                        <div className="flex flex-wrap gap-2 relative border border-gray-100 p-3 rounded-2xl bg-gray-50/50">
                            {(staffList || []).filter(s => school.metadata?.manager_ids?.includes(s.id)).map(staff => (
                                <button
                                    key={staff.id}
                                    onClick={() => toggleFacilitator(log.id, staff.id)}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all border ${editData.facilitator_ids?.includes(staff.id) ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-gray-500 border-indigo-100 hover:bg-indigo-50'}`}
                                >
                                    <span>{staff.name}</span>
                                </button>
                            ))}
                            {(!staffList?.some(s => school.metadata?.manager_ids?.includes(s.id))) && (
                                <div className="text-xs text-gray-300 font-bold px-2 py-1 flex-1">지정된 매니저 없음</div>
                            )}
                            {isEditing && fTerm && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-xl z-20 p-2 max-h-[160px] overflow-y-auto no-scrollbar">
                                    {(staffList || []).filter(s => !school.metadata?.manager_ids?.includes(s.id) && s.name.toLowerCase().includes(fTerm.toLowerCase())).map(staff => (
                                        <button
                                            key={staff.id}
                                            onClick={() => {
                                                toggleFacilitator(log.id, staff.id);
                                                setFacilitatorSearchTerm(prev => ({ ...prev, [log.id]: '' }));
                                            }}
                                            className="w-full flex items-center gap-2 p-2 hover:bg-gray-50 rounded-lg text-left text-sm font-bold text-gray-700"
                                        >
                                            <span>{staff.name}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {log.facilitator_ids?.length > 0 ? (
                                log.facilitator_ids.map(fid => {
                                    const staff = staffList?.find(s => s.id === fid) || allUsers?.find(u => u.id === fid);
                                    return (
                                        <div key={fid} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50/50 border border-indigo-100 rounded-xl text-indigo-700">
                                            <span className="text-xs font-bold">{staff?.name || '정보 없음'}</span>
                                        </div>
                                    );
                                })
                            ) : (
                                <p className="text-xs text-gray-300 font-bold italic">진행자 기록 없음</p>
                            )}
                        </div>
                    )}
                </div>

                {/* Participants Area */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h4 className="text-[10px] text-gray-400 font-black uppercase tracking-widest ml-1">참여자</h4>
                        {isEditing && (
                            <div className="relative w-1/2 max-w-[160px]">
                                <svg className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                <input
                                    type="text"
                                    placeholder="학생 검색..."
                                    value={sTerm}
                                    onChange={e => setSearchTerm(prev => ({ ...prev, [log.id]: e.target.value }))}
                                    className="w-full pl-6 pr-2 py-1.5 bg-white border border-indigo-200 rounded-xl text-xs font-bold outline-none focus:border-indigo-500 transition-all shadow-sm"
                                />
                            </div>
                        )}
                    </div>

                    {isEditing ? (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 md:gap-2 max-h-[140px] md:max-h-[160px] overflow-y-auto no-scrollbar border border-gray-100 rounded-2xl bg-gray-50/50 p-3">
                            {filteredStudents.map(student => (
                                <button
                                    key={student.id}
                                    onClick={() => toggleParticipant(log.id, student.id)}
                                    className={`flex items-center justify-center p-1.5 md:p-2 rounded-xl text-[10px] font-black transition-all border ${editData.participant_ids?.includes(student.id) ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
                                >
                                    <span className="truncate">{student.name}</span>
                                </button>
                            ))}
                            {filteredStudents.length === 0 && (
                                <div className="col-span-full text-center text-xs text-gray-400 font-bold py-2">검색 결과가 없습니다.</div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {log.participant_ids?.length > 0 ? (
                                log.participant_ids.map(pid => {
                                    const student = school.students?.find(s => s.id === pid) || allUsers?.find(u => u.id === pid);
                                    return (
                                        <div key={pid} className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl">
                                            <div className="w-5 h-5 rounded-lg bg-gray-200 flex items-center justify-center text-[9px] font-black text-gray-500">
                                                {student?.name?.charAt(0)}
                                            </div>
                                            <span className="text-xs font-bold text-gray-700">{student?.name || '정보 없음'}</span>
                                        </div>
                                    );
                                })
                            ) : (
                                <p className="text-xs text-gray-300 font-bold italic">참여자 기록 없음</p>
                            )}
                        </div>
                    )}
                </div>

                {/* Content Area */}
                <div className="space-y-3 relative group">
                    <h4 className="text-[10px] text-gray-400 font-black uppercase tracking-widest ml-1 flex items-center justify-between">
                        <span>사역 내용</span>
                        {isEditing && (
                            <div className="flex gap-2">
                                <span className="text-[9px] text-indigo-400 animate-pulse">편집 중...</span>
                                <button
                                    onClick={() => cancelEditing(log.id)}
                                    className="text-[9px] text-gray-400 hover:text-red-500 font-black"
                                >
                                    취소
                                </button>
                            </div>
                        )}
                    </h4>

                    {isEditing ? (
                        <textarea
                            value={currentContent}
                            onKeyDown={(e) => handleKeyDown(e, log.id)}
                            onChange={(e) => {
                                setEditingLogs(prev => ({
                                    ...prev,
                                    [log.id]: { ...prev[log.id], content: e.target.value }
                                }));
                            }}
                            className="w-full p-6 rounded-[2rem] font-bold text-[13px] leading-relaxed transition-all outline-none resize-none min-h-[400px] bg-white border-2 border-indigo-400 shadow-xl"
                            placeholder="내용을 입력하세요..."
                        />
                    ) : (
                        <div className="w-full p-6 rounded-[2rem] bg-gray-50/50 border border-transparent hover:bg-white hover:border-gray-100 hover:shadow-lg transition-all cursor-default min-h-[100px]">
                            <MarkdownRenderer content={log.content} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LogCard;
