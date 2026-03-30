const fs = require('fs');
const path = require('path');

const tabPath = 'd:/coding/ENTER/src/components/AnalyticsTab.jsx';
const viewsDir = 'd:/coding/ENTER/src/components/admin/statistics/analytics/views';

let code = fs.readFileSync(tabPath, 'utf8');
code = code.replace(/\\r\\n/g, '\\n');
const lines = code.split('\\n');

const extract = (name, startLine, endLine) => {
    // startLine and endLine are 1-indexed (e.g. 371) => array index startLine-1
    let block = lines.slice(startLine - 1, endLine).join('\\n');

    let importBlock = "import React from 'react';\\nimport { Calendar, Users, Clock, MapPin, Award, ArrowUp, ArrowDown, Search } from 'lucide-react';\\nimport { format, parseISO } from 'date-fns';\\nimport { ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Line } from 'recharts';\\n";
    let destructureHook = "    const { selectedYear, setSelectedYear, selectedMonth, setSelectedMonth, selectedDay, setSelectedDay, periodType, setPeriodType, selectedLocationGroupId, setSelectedLocationGroupId, viewMode, setViewMode, showGuestModal, setShowGuestModal, seucheoRegion, setSeucheoRegion, isManagerModalOpen, setIsManagerModalOpen, selectedMemberForCalendar, setSelectedMemberForCalendar, selectedRoomDetails, setSelectedRoomDetails, userSort, setUserSort, userSearch, setUserSearch, programFilter, setProgramFilter, filteredLocations, filteredLogsForSpace, spaceData, rawProgramData, programData, rawUserData, userData, handleSort } = hookData;\\n";

    let fileContent = importBlock + "\\nconst " + name + " = ({ hookData, users, schoolLogs }) => {\\n" + destructureHook + "\\n    if (!hookData) return null;\\n\\n    return (\\n        <>\\n" + block + "\\n        </>\\n    );\\n};\\n\\nexport default " + name + ";\\n";
    
    fs.writeFileSync(path.join(viewsDir, name + '.jsx'), fileContent);
    console.log(name + ' extracted.');
};

// Based on deterministic Line Indexes from view_file!
extract('SpaceAnalyticsView', 371, 684);
extract('ProgramAnalyticsView', 686, 754);
extract('UserAnalyticsView', 764, 824);

// Now reassemble AnalyticsTab.jsx
const replacement = "            {/* Filter Section */}\\n            <AnalyticsFilter hookData={hookData} />\\n            {/* Summary Cards */}\\n            {viewMode !== 'SEUCHEO' && <AnalyticsKPICards hookData={hookData} users={users} />}\\n\\n            {viewMode === 'SPACE' && <SpaceAnalyticsView hookData={hookData} />}\\n            {viewMode === 'PROGRAM' && <ProgramAnalyticsView hookData={hookData} />}\\n            {viewMode === 'SEUCHEO' && (\\n                <SeucheoTimeAnalytics\\n                    schoolLogs={schoolLogs}\\n                    users={users}\\n                    periodType={hookData.periodType}\\n                    selectedDate={new Date(hookData.selectedYear, hookData.selectedMonth, hookData.selectedDay)}\\n                    regionFilter={hookData.seucheoRegion}\\n                />\\n            )}\\n            {viewMode === 'USER' && <UserAnalyticsView hookData={hookData} />}";

// Lines 24 to 824 should be replaced. 
// lines array index 23 to 823.
lines.splice(23, 824 - 24 + 1, replacement);

const newImports = "\\nimport AnalyticsFilter from './admin/statistics/analytics/components/AnalyticsFilter';\\nimport AnalyticsKPICards from './admin/statistics/analytics/components/AnalyticsKPICards';\\nimport SpaceAnalyticsView from './admin/statistics/analytics/views/SpaceAnalyticsView';\\nimport ProgramAnalyticsView from './admin/statistics/analytics/views/ProgramAnalyticsView';\\nimport UserAnalyticsView from './admin/statistics/analytics/views/UserAnalyticsView';\\n";

const finalCode = lines.join('\\n').replace("import { useAnalytics } from './admin/statistics/analytics/hooks/useAnalytics.jsx';", "import { useAnalytics } from './admin/statistics/analytics/hooks/useAnalytics.jsx';" + newImports);

fs.writeFileSync(tabPath, finalCode);
console.log('AnalyticsTab.jsx successfully reassembled.');
