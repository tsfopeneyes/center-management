const fs = require('fs');
const path = require('path');

const srcPath = 'd:/coding/ENTER/src/components/admin/school/modals/SchoolDetailModal.backup.jsx';
let code = fs.readFileSync(srcPath, 'utf8').replace(/\r\n/g, '\n');
const lines = code.split('\n');

const extractBlock = (startStr, endStr) => {
    let start = -1, end = -1;
    for (let i = 0; i < lines.length; i++) {
        if (start === -1 && lines[i].includes(startStr)) start = i + 1; // get inside the condition
        else if (start !== -1 && end === -1 && lines[i].includes(endStr)) {
            end = i;
            break;
        }
    }
    return lines.slice(start, end).join('\n');
};

const viewsDir = 'd:/coding/ENTER/src/components/admin/school/views';

// 1. SchoolLogsView
const logsStart = "{activeTab === 'logs' && (";
const logsEnd = "                        {activeTab === 'calling_forest' && (";
// Since logs ends precisely before calling_forest, let's find the closing tag `)}` before calling_forest
let logsCode = extractBlock(logsStart, "                        {activeTab === 'calling_forest' && (");
// Trim the trailing `)}` from the extraction
logsCode = logsCode.substring(0, logsCode.lastIndexOf(')}')).trim();

const logsFile = `import React from 'react';
import { ClipboardList, Plus, ChevronRight, FileText } from 'lucide-react';

const SchoolLogsView = ({ school, logs, staffList, allUsers, hookData }) => {
    const { isInfoCollapsed, setIsLogFormOpen, setSelectedLog } = hookData;
    
    const handleRowClick = (log) => {
        setSelectedLog(log);
    };

    return (
${logsCode}
    );
};
export default SchoolLogsView;`;
fs.writeFileSync(path.join(viewsDir, 'SchoolLogsView.jsx'), logsFile);

// 2. CallingForestView
let forestCode = extractBlock("{activeTab === 'calling_forest' && (", "                        {activeTab === 'snacks' && (");
forestCode = forestCode.substring(0, forestCode.lastIndexOf(')}')).trim();

const forestFile = `import React from 'react';
import { User, ChevronRight, FileText, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CallingForestView = ({ school, logs, hookData }) => {
    const { 
        callingForestData, expandedForestStudent, setExpandedForestStudent,
        handleUnlinkLog, handleToggleManualProgress, setSelectorState, setSelectedLog
    } = hookData;

    return (
${forestCode}
    );
};
export default CallingForestView;`;
fs.writeFileSync(path.join(viewsDir, 'CallingForestView.jsx'), forestFile);

// 3. SnackHistoryView
let snacksCode = extractBlock("{activeTab === 'snacks' && (", "                    </div>");
// The end block condition `</div>` corresponds to line 748, the closing div for the Main Workspace
snacksCode = snacksCode.substring(0, snacksCode.lastIndexOf(')}')).trim();

const snacksFile = `import React from 'react';
import { Cookie, CheckCircle, Save } from 'lucide-react';

const SnackHistoryView = ({ onSaveMetadata, hookData }) => {
    const { editData, setEditData } = hookData;

    return (
${snacksCode}
    );
};
export default SnackHistoryView;`;
fs.writeFileSync(path.join(viewsDir, 'SnackHistoryView.jsx'), snacksFile);

console.log("Extracted all 3 views!");
