import React from 'react';
import { User, ChevronRight, FileText, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CallingForestView = ({ school, logs, hookData }) => {
    const { 
        callingForestData, expandedForestStudent, setExpandedForestStudent,
        handleUnlinkLog, handleToggleManualProgress, setSelectorState, setSelectedLog
    } = hookData;

    return (
<div className="animate-fade-in space-y-4">
                                <div className="bg-green-50/50 rounded-2xl p-4 border border-green-100 flex items-center gap-3">
                                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
                                    </div>
                                    <p className="text-sm font-bold text-green-800">학생 이름 클릭시 1주차~6주차 진행 상황을 기록하고 사역일지와 연결할 수 있습니다.</p>
                                </div>
                                <div className="space-y-3">
                                    {school.students.filter(s => s.is_leader).map(student => (
                                        <div key={student.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                                            <button
                                                onClick={() => setExpandedForestStudent(expandedForestStudent === student.id ? null : student.id)}
                                                className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-gray-50 overflow-hidden flex items-center justify-center shrink-0">
                                                        {student.profile_image_url ? <img src={student.profile_image_url} className="w-full h-full object-cover" /> : <User size={16} className="text-gray-300" />}
                                                    </div>
                                                    <div className="text-left">
                                                        <p className="font-black text-gray-800 flex items-center gap-1.5">{student.name}
                                                            <span className="text-[10px] font-bold text-gray-400">[{student.birth || '생일 미상'}]</span>
                                                        </p>
                                                        <div className="flex gap-1 mt-1">
                                                            {[1, 2, 3, 4, 5, 6].map(w => {
                                                                const isCompleted = callingForestData.some(d => d.student_id === student.id && d.week_number === w);
                                                                return (
                                                                    <div key={w} className={`w-3 h-3 rounded-full ${isCompleted ? 'bg-green-500' : 'bg-gray-200'}`} title={`${w}주차`} />
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                                <ChevronRight size={20} className={`text-gray-400 transition-transform ${expandedForestStudent === student.id ? 'rotate-90' : ''}`} />
                                            </button>

                                            <AnimatePresence>
                                                {expandedForestStudent === student.id && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        className="overflow-hidden"
                                                    >
                                                        <div className="p-4 bg-gray-50/50 border-t border-gray-100 space-y-2">
                                                            {[1, 2, 3, 4, 5, 6].map(week => {
                                                                const progress = callingForestData.find(d => d.student_id === student.id && d.week_number === week);
                                                                return (
                                                                    <div key={week} className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                                                                        <div className="flex items-center gap-3">
                                                                            <span className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center text-green-700 font-black text-xs">{week}주</span>
                                                                            {progress ? (
                                                                                progress.log_id ? (
                                                                                    <button
                                                                                        onClick={() => {
                                                                                            const theLog = logs.find(l => l.id === progress.log_id);
                                                                                            if (theLog) setSelectedLog(theLog);
                                                                                        }}
                                                                                        className="flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors"
                                                                                    >
                                                                                        <FileText size={14} />
                                                                                        연결된 일지 보기
                                                                                    </button>
                                                                                ) : (
                                                                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm font-bold">
                                                                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                                                                        수동 체크됨
                                                                                    </div>
                                                                                )
                                                                            ) : (
                                                                                <span className="text-sm font-bold text-gray-400">진행 기록 없음</span>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            {progress ? (
                                                                                <button
                                                                                    onClick={() => handleUnlinkLog(progress.id)}
                                                                                    className="p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-md transition-colors text-xs font-bold"
                                                                                >
                                                                                    {progress.log_id ? '연결 해제' : '체크 취소'}
                                                                                </button>
                                                                            ) : (
                                                                                <>
                                                                                    <button
                                                                                        onClick={() => handleToggleManualProgress(student, week)}
                                                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 hover:bg-green-100 border border-green-100 text-green-600 text-xs font-black rounded-lg transition-all"
                                                                                    >
                                                                                        체크
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={() => setSelectorState({ isOpen: true, student, week })}
                                                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-white border border-gray-200 hover:border-indigo-300 text-gray-600 hover:text-indigo-600 text-xs font-black rounded-lg transition-all"
                                                                                    >
                                                                                        <Plus size={14} /> 일지 연결
                                                                                    </button>
                                                                                </>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    ))}
                                    {school.students.filter(s => s.is_leader).length === 0 && (
                                        <div className="p-10 text-center text-gray-400 font-bold bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                                            지정된 학생 리더가 없습니다.
                                        </div>
                                    )}
                                </div>
                            </div>
    );
};
export default CallingForestView;