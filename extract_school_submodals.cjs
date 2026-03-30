const fs = require('fs');
const srcPath = 'd:/coding/ENTER/src/components/admin/school/modals/SchoolDetailModal.jsx';
const lines = fs.readFileSync(srcPath, 'utf8').replace(/\r\n/g, '\n').split('\n');
const getLines = (start, end) => lines.slice(start - 1, end).join('\n');

// Standard imports for these Modals
const modalImports = `import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, Trash2, Edit2, Download, Copy, ExternalLink, Calendar, MapPin, CheckCircle, RefreshCw, Eye, MessageCircle, FileText, X, School, Flame, LayoutGrid, LayoutList, CheckCircle2, User, Users, ChevronRight, ChevronLeft, Grid, List, Star, Heart, Columns, Settings, ClipboardList, Save, Clock, Cookie } from 'lucide-react';
import { supabase } from '../../../../supabaseClient';
`;

// Extract LogFormModal
const logFormModalCode = modalImports + '\n' + getLines(267, 566);
fs.writeFileSync('d:/coding/ENTER/src/components/admin/school/modals/LogFormModal.jsx', logFormModalCode);

// Extract LogDetailModal (including MarkdownRenderer)
const logDetailModalCode = modalImports + '\n' + getLines(568, 1039) + '\nexport default LogDetailModal;';
fs.writeFileSync('d:/coding/ENTER/src/components/admin/school/modals/LogDetailModal.jsx', logDetailModalCode);

// Extract StudentDetailModal
const studentDetailModalCode = modalImports + '\n' + getLines(1040, 1343);
fs.writeFileSync('d:/coding/ENTER/src/components/admin/school/modals/StudentDetailModal.jsx', studentDetailModalCode);

// Reassemble SchoolDetailModal
const orchestratorImports = getLines(1, 10) + `
import LogFormModal from './LogFormModal';
import LogDetailModal from './LogDetailModal';
import StudentDetailModal from './StudentDetailModal';
import LogSelectorModal from '../LogSelectorModal';
`;

const hookDestructuring = `    const { 
        activeTab, setActiveTab, 
        selectedLog, setSelectedLog, 
        isLogFormOpen, setIsLogFormOpen,
        selectedStudent, setSelectedStudent,
        selectorState, setSelectorState,
        handleLinkLog,
        isAddTempStudentModalOpen, setIsAddTempStudentModalOpen,
        newTempStudentName, setNewTempStudentName,
        newTempStudentPhone, setNewTempStudentPhone,
        addingTempStudent, handleAddTempStudent
    } = hookData;`;

let orchestratorBody = getLines(11, 266);
orchestratorBody = orchestratorBody.replace(
    "const { activeTab, setActiveTab, selectedLog, setSelectedLog, isLogFormOpen, setIsLogFormOpen } = hookData;",
    hookDestructuring
);

const finalOrchestratorCode = orchestratorImports + orchestratorBody;
fs.writeFileSync('d:/coding/ENTER/src/components/admin/school/modals/SchoolDetailModal.jsx', finalOrchestratorCode);

console.log('Successfully extracted LogFormModal, LogDetailModal, and StudentDetailModal.');
console.log('Cleaned up SchoolDetailModal.jsx to 266 lines.');
