const fs = require('fs');
const path = require('path');

const tabPath = 'd:/coding/ENTER/src/components/AnalyticsTab.jsx';
const compDir = 'd:/coding/ENTER/src/components/admin/statistics/analytics/components';
const viewsDir = 'd:/coding/ENTER/src/components/admin/statistics/analytics/views';

let code = fs.readFileSync(tabPath, 'utf8');
code = code.replace(/\\r\\n/g, '\\n'); // normalize
const lines = code.split('\\n');

let idxFilterStart = -1, idxFilterEnd = -1;
let idxCardsStart = -1, idxCardsEnd = -1;
let idxSpaceStart = -1, idxSpaceEnd = -1;
let idxProgStart = -1, idxProgEnd = -1;
let idxUserStart = -1, idxUserEnd = -1;

for (let i=0; i<lines.length; i++) {
    const l = lines[i];
    if (l.includes('{/* Filter Section */}')) idxFilterStart = i;
    if (l.includes('{/* Summary Cards */}')) {
        idxFilterEnd = i - 1;
        idxCardsStart = i;
    }
    if (l.includes("{viewMode === 'SPACE' ? (") || l.includes('viewMode === "SPACE"')) {
        idxCardsEnd = i - 1;
        idxSpaceStart = i + 1;
    }
    if (l.includes(") : viewMode === 'PROGRAM' ? (")) {
        idxSpaceEnd = i - 1;
        idxProgStart = i + 1;
    }
    if (l.includes(") : viewMode === 'SEUCHEO' ? (")) {
        idxProgEnd = i - 1;
    }
    if (l.includes(") : (")) {
        idxUserStart = i + 1;
    }
    if (l.includes('{/* Member Activity Calendar Modal */}')) {
        idxUserEnd = i - 2;
    }
}

console.log("BOUNDARIES:", { idxFilterStart, idxFilterEnd, idxCardsStart, idxCardsEnd, idxSpaceStart, idxSpaceEnd, idxProgStart, idxProgEnd, idxUserStart, idxUserEnd });

const extract = (name, start, end, dir) => {
    if (start === -1 || end === -1 || start > end) return console.error('Failed ' + name);
    let block = lines.slice(start, end + 1).join('\\n');

    let importBlock = "import React from 'react';\\nimport { Calendar, Users, Clock, MapPin, Award, ArrowUp, ArrowDown, Search } from 'lucide-react';\\nimport { format, parseISO } from 'date-fns';\\nimport { ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Line } from 'recharts';\\nimport { getKSTWeekOfMonth } from '../../../../../utils/dateUtils';\\n";

    let destructureHook = "    const { selectedYear, setSelectedYear, selectedMonth, setSelectedMonth, selectedDay, setSelectedDay, periodType, setPeriodType, selectedLocationGroupId, setSelectedLocationGroupId, viewMode, setViewMode, showGuestModal, setShowGuestModal, seucheoRegion, setSeucheoRegion, isManagerModalOpen, setIsManagerModalOpen, selectedMemberForCalendar, setSelectedMemberForCalendar, selectedRoomDetails, setSelectedRoomDetails, userSort, setUserSort, userSearch, setUserSearch, programFilter, setProgramFilter, filteredLocations, filteredLogsForSpace, spaceData, rawProgramData, programData, rawUserData, userData, handleSort } = hookData;\\n";

    let fileContent = importBlock + "\\nconst " + name + " = ({ hookData, users, schoolLogs }) => {\\n" + destructureHook + "\\n    if (!hookData) return null;\\n\\n    return (\\n        <>\\n" + block + "\\n        </>\\n    );\\n};\\n\\nexport default " + name + ";\\n";
    
    fs.writeFileSync(path.join(dir, name + '.jsx'), fileContent);
    console.log(name + ' extracted.');
    return block;
};

if (idxFilterStart !== -1 && idxUserEnd !== -1 && idxProgStart !== -1 && idxSpaceStart !== -1) {
    extract('AnalyticsFilter', idxFilterStart, idxFilterEnd, compDir);
    extract('AnalyticsKPICards', idxCardsStart, idxCardsEnd, compDir);
    extract('SpaceAnalyticsView', idxSpaceStart, idxSpaceEnd, viewsDir);
    extract('ProgramAnalyticsView', idxProgStart, idxProgEnd, viewsDir);
    extract('UserAnalyticsView', idxUserStart, idxUserEnd, viewsDir);

    const replacement = "            <AnalyticsFilter hookData={hookData} />\\n            {viewMode !== 'SEUCHEO' && <AnalyticsKPICards hookData={hookData} />}\\n            {viewMode === 'SPACE' && <SpaceAnalyticsView hookData={hookData} />}\\n            {viewMode === 'PROGRAM' && <ProgramAnalyticsView hookData={hookData} />}\\n            {viewMode === 'SEUCHEO' && (\\n                <SeucheoTimeAnalytics\\n                    schoolLogs={schoolLogs}\\n                    users={users}\\n                    periodType={hookData.periodType}\\n                    selectedDate={new Date(hookData.selectedYear, hookData.selectedMonth, hookData.selectedDay)}\\n                    regionFilter={hookData.seucheoRegion}\\n                />\\n            )}\\n            {viewMode === 'USER' && <UserAnalyticsView hookData={hookData} />}";

    lines.splice(idxFilterStart, idxUserEnd - idxFilterStart + 1, replacement);

    const newImports = "\\nimport AnalyticsFilter from './admin/statistics/analytics/components/AnalyticsFilter';\\nimport AnalyticsKPICards from './admin/statistics/analytics/components/AnalyticsKPICards';\\nimport SpaceAnalyticsView from './admin/statistics/analytics/views/SpaceAnalyticsView';\\nimport ProgramAnalyticsView from './admin/statistics/analytics/views/ProgramAnalyticsView';\\nimport UserAnalyticsView from './admin/statistics/analytics/views/UserAnalyticsView';\\n";
    
    const finalCode = lines.join('\\n').replace("import { useAnalytics } from './admin/statistics/analytics/hooks/useAnalytics.jsx';", "import { useAnalytics } from './admin/statistics/analytics/hooks/useAnalytics.jsx';" + newImports);
    
    fs.writeFileSync(tabPath, finalCode);
    console.log('AnalyticsTab.jsx successfully reassembled.');
} else {
    console.log('Could not find all blocks:', { idxFilterStart, idxCardsStart, idxSpaceStart, idxProgStart, idxUserStart });
}
