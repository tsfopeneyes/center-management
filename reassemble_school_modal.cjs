const fs = require('fs');
const path = require('path');

const srcPath = 'd:/coding/ENTER/src/components/admin/school/modals/SchoolDetailModal.backup.jsx';
const destPath = 'd:/coding/ENTER/src/components/admin/school/modals/SchoolDetailModal.jsx';

let code = fs.readFileSync(srcPath, 'utf8').replace(/\r\n/g, '\n');
const lines = code.split('\n');

const getBlock = (startStr, endStr) => {
    let start = -1, end = -1;
    for (let i = 0; i < lines.length; i++) {
        if (start === -1 && lines[i].includes(startStr)) start = i; 
        else if (start !== -1 && end === -1 && lines[i].includes(endStr)) {
            end = i;
            break;
        }
    }
    return lines.slice(start, end).join('\n');
};

const bottomModalsStr = code.substring(code.indexOf('{/* Log Entry Form Modal */}'));

const finalFile = `import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../../../../supabaseClient';
import { Search, Plus, Trash2, Edit2, Download, Copy, ExternalLink, Calendar, MapPin, CheckCircle, RefreshCw, Eye, MessageCircle, FileText, X, School, Flame, LayoutGrid, LayoutList, CheckCircle2, User, Users, ChevronRight, ChevronLeft, Grid, List, Star, Heart, Columns, Settings, ClipboardList, Save, Clock, Cookie } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import LogFormModal from '../LogFormModal';
import LogDetailModal from '../LogDetailModal';
import { useSchoolDetail } from '../hooks/useSchoolDetail';
import SchoolDetailSidebar from '../components/SchoolDetailSidebar';
import SchoolLogsView from '../views/SchoolLogsView';
import CallingForestView from '../views/CallingForestView';
import SnackHistoryView from '../views/SnackHistoryView';

const SchoolDetailModal = ({ school, logs, staffList, onClose, isSettingsMode, setIsSettingsMode, onSaveMetadata, onToggleLeader, refreshLogs, refreshDashboardData, allUsers }) => {
    if (!school) return null;

    const hookData = useSchoolDetail({ school, refreshLogs, refreshDashboardData });
    const { activeTab, setActiveTab, selectedLog, setSelectedLog, isLogFormOpen, setIsLogFormOpen } = hookData;

    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-2 md:p-8"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
                className="bg-white w-full max-w-6xl h-[95vh] rounded-[2.5rem] md:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="p-5 md:p-8 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3 md:gap-4 min-w-0">
                        <div className="w-10 h-10 md:w-14 md:h-14 bg-indigo-600 rounded-2xl md:rounded-3xl flex items-center justify-center text-white shadow-lg shrink-0">
                            <School size={20} className="md:w-7 md:h-7" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-lg md:text-2xl font-black text-gray-800 tracking-tighter truncate">{school.name}</h2>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md">Adolescent Member</span>
                                <span className="text-gray-300">|</span>
                                <span className="text-[10px] md:text-xs font-bold text-gray-400 truncate">{school.students.length}명의 소속 학생</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <div className="flex bg-gray-100/80 p-1 rounded-xl md:rounded-2xl mr-1 md:mr-4">
                            <button
                                onClick={() => setActiveTab('logs')}
                                className={\`px-3 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl text-xs md:text-sm font-black transition-all \${activeTab === 'logs' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}\`}
                            >
                                학교 현황
                            </button>
                            <button
                                onClick={() => setActiveTab('calling_forest')}
                                className={\`px-3 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl text-xs md:text-sm font-black transition-all \${activeTab === 'calling_forest' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}\`}
                            >
                                콜링포레스트
                            </button>
                            <button
                                onClick={() => setActiveTab('snacks')}
                                className={\`px-3 py-1.5 md:px-4 md:py-2 rounded-lg md:rounded-xl text-xs md:text-sm font-black transition-all \${activeTab === 'snacks' ? 'bg-white text-amber-500 shadow-sm' : 'text-gray-400 hover:text-gray-600'}\`}
                            >
                                간식
                            </button>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors hidden md:block">
                            <X size={24} />
                        </button>
                        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full text-gray-400 transition-colors md:hidden">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
                    <SchoolDetailSidebar 
                        school={school}
                        staffList={staffList}
                        isSettingsMode={isSettingsMode}
                        setIsSettingsMode={setIsSettingsMode}
                        onSaveMetadata={onSaveMetadata}
                        onToggleLeader={onToggleLeader}
                        hookData={hookData}
                    />

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-5 md:p-8 bg-white flex flex-col gap-6 md:gap-8">
                        {activeTab === 'logs' && <SchoolLogsView school={school} logs={logs} staffList={staffList} allUsers={allUsers} hookData={hookData} />}
                        {activeTab === 'calling_forest' && <CallingForestView school={school} logs={logs} hookData={hookData} />}
                        {activeTab === 'snacks' && <SnackHistoryView onSaveMetadata={onSaveMetadata} hookData={hookData} />}
                    </div>
                </div>

                ${bottomModalsStr}
`;

fs.writeFileSync(destPath, finalFile);
console.log('Successfully reassembled SchoolDetailModal.jsx!');
