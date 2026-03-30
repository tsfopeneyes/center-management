const fs = require('fs');

const tabPath = 'd:/coding/ENTER/src/components/AnalyticsTab.jsx'; 
const outPath = 'd:/coding/ENTER/src/components/admin/statistics/analytics/views/UserAnalyticsView.jsx';

let code = fs.readFileSync(tabPath, 'utf8');
code = code.replace(/\r\n/g, '\n');
const lines = code.split('\n');

// 0-indexed. lines 881 to 940 are indices 880 to 939, meaning slice(880, 940)
const block = lines.slice(880, 940).join('\n');

let importBlock = "import React from 'react';\nimport { Calendar, Users, Clock, MapPin, Award, ArrowUp, ArrowDown, Search } from 'lucide-react';\nimport { format, parseISO } from 'date-fns';\nimport { ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, Line } from 'recharts';\nimport { getKSTWeekOfMonth } from '../../../../../utils/dateUtils';\n";
let destructureHook = "    const { selectedYear, setSelectedYear, selectedMonth, setSelectedMonth, selectedDay, setSelectedDay, periodType, setPeriodType, selectedLocationGroupId, setSelectedLocationGroupId, viewMode, setViewMode, showGuestModal, setShowGuestModal, seucheoRegion, setSeucheoRegion, isManagerModalOpen, setIsManagerModalOpen, selectedMemberForCalendar, setSelectedMemberForCalendar, selectedRoomDetails, setSelectedRoomDetails, userSort, setUserSort, userSearch, setUserSearch, programFilter, setProgramFilter, filteredLocations, filteredLogsForSpace, spaceData, rawProgramData, programData, rawUserData, userData, handleSort } = hookData;\n";
let fileContent = importBlock + "\nconst UserAnalyticsView = ({ hookData, users, schoolLogs }) => {\n" + destructureHook + "\n    if (!hookData) return null;\n\n    return (\n        <>\n" + block + "\n        </>\n    );\n};\n\nexport default UserAnalyticsView;\n";

fs.writeFileSync(outPath, fileContent);
console.log('UserAnalyticsView carefully extracted from HEAD.');
