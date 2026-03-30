const fs = require('fs');
const path = require('path');

const tabPath = 'd:/coding/ENTER/src/components/AnalyticsTab.jsx';
const viewsDir = 'd:/coding/ENTER/src/components/admin/statistics/analytics/views';

let code = fs.readFileSync(tabPath, 'utf8');
code = code.replace(/\r\n/g, '\n');
const lines = code.split('\n');

let idxSpaceStart = -1, idxSpaceEnd = -1;
let idxProgStart = -1, idxProgEnd = -1;
let idxUserStart = -1, idxUserEnd = -1;

for (let i=0; i<lines.length; i++) {
    const l = lines[i];
    if (l.includes("{viewMode === 'SPACE' ? (")) {
        idxSpaceStart = i + 1;
    }
    if (l.includes(") : viewMode === 'PROGRAM' ? (")) {
        idxSpaceEnd = i - 1;
        idxProgStart = i + 1;
    }
    if (l.includes(") : viewMode === 'SEUCHEO' ? (")) {
        idxProgEnd = i - 1;
    }
    if (l.includes(") : (") && !l.includes("?")) {
        // Find User start!
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

extract('SpaceAnalyticsView', idxSpaceStart, idxSpaceEnd);
extract('ProgramAnalyticsView', idxProgStart, idxProgEnd);
extract('UserAnalyticsView', idxUserStart, idxUserEnd);
