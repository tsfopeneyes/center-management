const fs = require('fs');
const path = require('path');

const tabPath = 'd:/coding/ENTER/src/components/AnalyticsTab.orig.jsx';
const viewsDir = 'd:/coding/ENTER/src/components/admin/statistics/analytics/views';

let code = fs.readFileSync(tabPath, 'utf8');
const lines = code.split('\n');

let idxUserStart = -1, idxUserEnd = -1;

for (let i=0; i<lines.length; i++) {
    const l = lines[i];
    if (l.includes(") : (") && !l.includes("?") && idxUserStart === -1) {
        idxUserStart = i + 1;
    }
    if (l.includes('{/* Member Activity Calendar Modal */}')) {
        idxUserEnd = i - 2;
    }
}

const extract = (name, start, end) => {
    if (start === -1 || end === -1 || start > end) return console.error('Failed ' + name, start, end);
    let block = lines.slice(start, end + 1).join('\n');

    let importBlock = "import React from 'react';\nimport { Calendar, Users, Clock, MapPin, Award, ArrowUp, ArrowDown, Search } from 'lucide-react';\nimport { format, parseISO } from 'date-fns';\nimport { ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Line } from 'recharts';\nimport { getKSTWeekOfMonth } from '../../../../../utils/dateUtils';\n";

    let destructureHook = "    const { selectedYear, setSelectedYear, selectedMonth, setSelectedMonth, selectedDay, setSelectedDay, periodType, setPeriodType, selectedLocationGroupId, setSelectedLocationGroupId, viewMode, setViewMode, showGuestModal, setShowGuestModal, seucheoRegion, setSeucheoRegion, isManagerModalOpen, setIsManagerModalOpen, selectedMemberForCalendar, setSelectedMemberForCalendar, selectedRoomDetails, setSelectedRoomDetails, userSort, setUserSort, userSearch, setUserSearch, programFilter, setProgramFilter, filteredLocations, filteredLogsForSpace, spaceData, rawProgramData, programData, rawUserData, userData, handleSort } = hookData;\n";

    let fileContent = importBlock + "\nconst " + name + " = ({ hookData, users, schoolLogs }) => {\n" + destructureHook + "\n    if (!hookData) return null;\n\n    return (\n        <>\n" + block + "\n        </>\n    );\n};\n\nexport default " + name + ";\n";
    
    fs.writeFileSync(path.join(viewsDir, name + '.jsx'), fileContent);
    console.log(name + ' extracted.');
};

extract('UserAnalyticsView', idxUserStart, idxUserEnd);
