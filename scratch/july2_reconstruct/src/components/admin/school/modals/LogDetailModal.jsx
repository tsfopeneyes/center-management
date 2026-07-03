import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ClipboardList, X } from 'lucide-react';
import { useLogDetail } from './hooks/useLogDetail';
import LogCard from '../components/LogCard';

const LogDetailModal = ({ logs, initialLogId, school, onClose, onRefresh, onDelete, allUsers, staffList }) => {
    const scrollContainerRef = useRef(null);
    const logRefs = useRef({});
    
    const {
        editingLogs, setEditingLogs,
        savingId,
        searchTerm, setSearchTerm,
        facilitatorSearchTerm, setFacilitatorSearchTerm,
        handleSaveEdit, handleKeyDown,
        toggleParticipant, toggleFacilitator,
        startEditing, cancelEditing
    } = useLogDetail(onRefresh);

    useEffect(() => {
        if (initialLogId && logRefs.current[initialLogId]) {
            setTimeout(() => {
                logRefs.current[initialLogId].scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        }
    }, [initialLogId]);

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

                {/* Content */}
                <div ref={scrollContainerRef} className="flex-1 overflow-y-auto custom-scrollbar bg-gray-50/50">
                    <div className="p-4 md:p-8 space-y-8">
                        {logs.map((log, index) => (
                            <LogCard
                                key={log.id}
                                log={log}
                                index={index}
                                totalLogs={logs.length}
                                school={school}
                                allUsers={allUsers}
                                staffList={staffList}
                                onDelete={onDelete}
                                isEditing={editingLogs[log.id] !== undefined}
                                editData={editingLogs[log.id] || {}}
                                sTerm={searchTerm[log.id] || ''}
                                fTerm={facilitatorSearchTerm[log.id] || ''}
                                setEditingLogs={setEditingLogs}
                                setSearchTerm={setSearchTerm}
                                setFacilitatorSearchTerm={setFacilitatorSearchTerm}
                                handleSaveEdit={handleSaveEdit}
                                handleKeyDown={handleKeyDown}
                                toggleParticipant={toggleParticipant}
                                toggleFacilitator={toggleFacilitator}
                                startEditing={startEditing}
                                cancelEditing={cancelEditing}
                                savingId={savingId}
                                logRef={el => logRefs.current[log.id] = el}
                            />
                        ))}
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
};

export default LogDetailModal;