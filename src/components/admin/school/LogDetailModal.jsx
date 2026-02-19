import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ClipboardList, X, Calendar, Clock, MapPin, Save, Trash2, User } from 'lucide-react';
import { supabase } from '../../../supabaseClient';

const MarkdownRenderer = ({ content }) => {
    if (!content) return <p className="text-gray-300 italic">내용이 없습니다.</p>;

    const SECTION_COLORS = {
        '근황': { border: 'border-indigo-500', bg: 'bg-indigo-50/30' },
        '스쿨처치': { border: 'border-emerald-500', bg: 'bg-emerald-50/30' },
        '기도제목': { border: 'border-amber-500', bg: 'bg-amber-50/30' },
        '추후방향': { border: 'border-rose-500', bg: 'bg-rose-50/30' },
        '향후 일정': { border: 'border-rose-500', bg: 'bg-rose-50/30' }
    };

    const lines = content.split('\n');
    return (
        <div className="space-y-3">
            {lines.map((line, idx) => {
                const trimmed = line.trim();
                // Bold Title: **Title**
                if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
                    const title = trimmed.replace(/\*\*/g, '');
                    const style = SECTION_COLORS[title] || { border: 'border-gray-400', bg: 'bg-gray-50/50' };

                    return (
                        <div key={idx} className={`text-[13px] font-black text-gray-900 mt-5 first:mt-0 mb-2 flex items-center gap-2 border-l-[3px] ${style.border} pl-3 ${style.bg} py-1.5 rounded-r-lg shadow-sm/10`}>
                            {title}
                        </div>
                    );
                }
                // Bullet Point: * text
                if (trimmed.startsWith('*')) {
                    return (
                        <div key={idx} className="flex gap-2.5 group ml-0.5 px-0.5">
                            <div className="mt-1.5 shrink-0 w-1 h-1 rounded-full bg-indigo-300" />
                            <p className="text-[12.5px] font-bold text-gray-700 leading-relaxed">
                                {trimmed.replace(/^\*/, '').trim()}
                            </p>
                        </div>
                    );
                }
                // Empty line
                if (trimmed === '') return <div key={idx} className="h-1" />;

                // Regular line
                return (
                    <p key={idx} className="text-[12.5px] font-bold text-gray-500 ml-4 pl-0.5 leading-relaxed">
                        {trimmed}
                    </p>
                );
            })}
        </div>
    );
};

const LogDetailModal = ({ logs, initialLogId, school, onClose, onRefresh, onDelete, allUsers }) => {
    const scrollContainerRef = useRef(null);
    const logRefs = useRef({});
    const [editingContent, setEditingContent] = useState({}); // { logId: content }
    const [savingId, setSavingId] = useState(null);

    useEffect(() => {
        if (initialLogId && logRefs.current[initialLogId]) {
            setTimeout(() => {
                logRefs.current[initialLogId].scrollIntoView({ behavior: 'auto', block: 'start' });
            }, 100);
        }
    }, [initialLogId]);

    const handleSaveEdit = async (logId) => {
        const content = editingContent[logId];
        if (content === undefined) return;

        setSavingId(logId);
        try {
            await supabase.from('school_logs').update({ content }).eq('id', logId);
            setEditingContent(prev => {
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

            setEditingContent(prev => ({
                ...prev,
                [logId]: newValue
            }));

            setTimeout(() => {
                e.target.selectionStart = e.target.selectionEnd = selectionStart + 3;
            }, 0);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-0 md:p-8"
            onClick={onClose}
        >
            <motion.div
                initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="bg-white w-full max-w-2xl h-full md:h-[90vh] md:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header - Fixed */}
                <div className="p-6 md:p-8 border-b border-gray-100 bg-white/80 backdrop-blur-md flex justify-between items-center shrink-0 z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                            <ClipboardList size={20} />
                        </div>
                        <h3 className="text-xl font-black text-gray-800 tracking-tighter">사역 일지 기록 피드</h3>
                    </div>
                    <button onClick={onClose} className="p-3 bg-gray-100 text-gray-500 rounded-full hover:bg-gray-200 transition-all">
                        <X size={20} />
                    </button>
                </div>

                <div ref={scrollContainerRef} className="flex-1 overflow-y-auto custom-scrollbar bg-gray-50/50">
                    <div className="p-4 md:p-8 space-y-8">
                        {logs.map((log, index) => {
                            const isEditing = editingContent[log.id] !== undefined;
                            const currentContent = isEditing ? editingContent[log.id] : log.content;

                            return (
                                <div
                                    key={log.id}
                                    ref={el => logRefs.current[log.id] = el}
                                    className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden scroll-mt-24"
                                >
                                    {/* Log Item Header */}
                                    <div className="p-6 md:p-8 border-b border-gray-50 bg-gray-50/30 flex justify-between items-start">
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center gap-2 text-indigo-600 font-extrabold text-base">
                                                    <Calendar size={20} />
                                                    {log.date}
                                                </div>
                                                <div className="px-3 py-1 bg-indigo-100/50 rounded-lg text-xs font-black text-indigo-600">
                                                    {index + 1}번째 일지
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-4 items-center">
                                                <div className="flex items-center gap-2 text-gray-400 font-bold text-sm">
                                                    <Clock size={16} />
                                                    {log.time_range}
                                                </div>
                                                <div className="flex items-center gap-1.5 text-gray-400 text-sm font-bold">
                                                    <MapPin size={14} />
                                                    {log.location || '장소 미입력'}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            {isEditing && (
                                                <button
                                                    onClick={() => handleSaveEdit(log.id)}
                                                    disabled={savingId === log.id}
                                                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
                                                >
                                                    <Save size={14} />
                                                    저장
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
                                        {/* Participants */}
                                        <div className="space-y-3">
                                            <h4 className="text-[10px] text-gray-400 font-black uppercase tracking-widest ml-1">참여자</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {log.participant_ids?.length > 0 ? (
                                                    log.participant_ids.map(pid => {
                                                        const student = school.students.find(s => s.id === pid) || allUsers?.find(u => u.id === pid);
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
                                        </div>

                                        {/* Content Area - View/Edit Toggle */}
                                        <div className="space-y-3 relative group">
                                            <h4 className="text-[10px] text-gray-400 font-black uppercase tracking-widest ml-1 flex items-center justify-between">
                                                <span>사역 내용</span>
                                                {isEditing ? (
                                                    <div className="flex gap-2">
                                                        <span className="text-[9px] text-indigo-400 animate-pulse">편집 중...</span>
                                                        <button
                                                            onClick={() => {
                                                                setEditingContent(prev => {
                                                                    const next = { ...prev };
                                                                    delete next[log.id];
                                                                    return next;
                                                                });
                                                            }}
                                                            className="text-[9px] text-gray-400 hover:text-red-500 font-black"
                                                        >
                                                            취소
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="text-[9px] text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">클릭하여 수정</span>
                                                )}
                                            </h4>

                                            {isEditing ? (
                                                <textarea
                                                    autoFocus
                                                    value={currentContent}
                                                    onKeyDown={(e) => handleKeyDown(e, log.id)}
                                                    onChange={(e) => {
                                                        setEditingContent(prev => ({ ...prev, [log.id]: e.target.value }));
                                                    }}
                                                    className="w-full p-6 rounded-[2rem] font-bold text-[13px] leading-relaxed transition-all outline-none resize-none min-h-[400px] bg-white border-2 border-indigo-400 shadow-xl"
                                                    placeholder="내용을 입력하세요..."
                                                />
                                            ) : (
                                                <div
                                                    onClick={() => setEditingContent(prev => ({ ...prev, [log.id]: log.content || '' }))}
                                                    className="w-full p-6 rounded-[2rem] bg-gray-50/50 border border-transparent hover:bg-white hover:border-gray-100 hover:shadow-lg transition-all cursor-text min-h-[100px]"
                                                >
                                                    <MarkdownRenderer content={log.content} />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default LogDetailModal;
