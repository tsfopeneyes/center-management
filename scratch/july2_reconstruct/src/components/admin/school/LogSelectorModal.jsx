import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { FileText, Search, Calendar, ChevronRight, X, Filter } from 'lucide-react';

const LogSelectorModal = ({ student, schoolLogs, onClose, onSelect }) => {
    const [searchTerm, setSearchTerm] = useState('');

    // Filter logs where the student is a participant
    const studentLogs = useMemo(() => {
        if (!student || !schoolLogs) return [];
        return schoolLogs.filter(log => log.participant_ids?.includes(student.id))
            .filter(log =>
                (log.content && log.content.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (log.date && log.date.includes(searchTerm))
            )
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    }, [schoolLogs, student, searchTerm]);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.95, y: 10 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 10 }}
                className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center">
                            <FileText size={20} />
                        </div>
                        <div>
                            <h3 className="font-black text-gray-800 text-lg">기존 사역일지 연결</h3>
                            <p className="text-xs font-bold text-gray-500">[{student?.name}] 학생이 참여한 일지 목록</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4 border-b border-gray-100 shrink-0">
                    <div className="relative">
                        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="내용 또는 날짜 검색..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-bold text-gray-700 transition-all"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {studentLogs.length > 0 ? (
                        studentLogs.map(log => (
                            <button
                                key={log.id}
                                onClick={() => onSelect(log)}
                                className="w-full text-left p-4 bg-white border border-gray-100 rounded-2xl hover:border-indigo-300 hover:shadow-md transition-all group relative overflow-hidden"
                            >
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />

                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-1.5 text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                                        <Calendar size={12} />
                                        {log.date}
                                    </div>
                                    <ChevronRight size={16} className="text-gray-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-transform" />
                                </div>
                                <p className="text-sm font-bold text-gray-800 line-clamp-2 leading-relaxed">
                                    {log.content?.replace(/[\*\#\-]/g, ' ').substring(0, 150) || '내용 없음'}
                                </p>
                            </button>
                        ))
                    ) : (
                        <div className="py-12 flex flex-col items-center justify-center text-center">
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mb-3">
                                <Search size={24} />
                            </div>
                            <p className="text-gray-500 font-bold mb-1">검색된 사역일지가 없습니다.</p>
                            <p className="text-xs text-gray-400">참여자로 등록된 사역일지가 필요한 기능입니다.</p>
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
};

export default LogSelectorModal;
