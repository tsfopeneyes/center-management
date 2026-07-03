const fs = require('fs');
const path = require('path');

const analyticsTabPath = 'd:/coding/ENTER/src/components/AnalyticsTab.jsx';
const hookDir = 'd:/coding/ENTER/src/components/admin/statistics/analytics/hooks';
const viewsDir = 'd:/coding/ENTER/src/components/admin/statistics/analytics/views';
const componentsDir = 'd:/coding/ENTER/src/components/admin/statistics/analytics/components';
const modalsDir = 'd:/coding/ENTER/src/components/admin/statistics/analytics/modals';

[hookDir, viewsDir, componentsDir, modalsDir].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

let originalCode = fs.readFileSync(analyticsTabPath, 'utf8');

const lines = originalCode.split('\n');

// Find the component start
const componentStartIdx = lines.findIndex(l => l.includes('const AnalyticsTab = ({'));

// We will extract state and memo definitions up to `if (isLoading) return <Skeleton />;`
const renderStartIdx = lines.findIndex(l => l.includes('if (isLoading) return <Skeleton />;'));

if (componentStartIdx !== -1 && renderStartIdx !== -1) {
    const hookLines = lines.slice(componentStartIdx + 1, renderStartIdx);
    
    // Create useAnalytics content
    const hookContent = `import { useState, useMemo } from 'react';
import { processAnalyticsData, processProgramAnalytics, processUserAnalytics } from '../../../../utils/analyticsUtils';

export const useAnalytics = ({ logs, schoolLogs, locations, locationGroups = [], users, notices, responses }) => {
${hookLines.join('\n').replace(/^\s{4}/gm, '')}
    
    return {
        selectedYear, setSelectedYear,
        selectedMonth, setSelectedMonth,
        selectedDay, setSelectedDay,
        periodType, setPeriodType,
        selectedLocationGroupId, setSelectedLocationGroupId,
        viewMode, setViewMode,
        showGuestModal, setShowGuestModal,
        seucheoRegion, setSeucheoRegion,
        isManagerModalOpen, setIsManagerModalOpen,
        selectedMemberForCalendar, setSelectedMemberForCalendar,
        selectedRoomDetails, setSelectedRoomDetails,
        userSort, setUserSort,
        userSearch, setUserSearch,
        programFilter, setProgramFilter,
        
        filteredLocations,
        filteredLogsForSpace,
        spaceData,
        rawProgramData,
        programData,
        rawUserData,
        userData,
        
        handleSort
    };
};
`;

    // Write hook file
    fs.writeFileSync(path.join(hookDir, 'useAnalytics.jsx'), hookContent);

    // Replace logic inside AnalyticsTab with hook call
    const replacementVariables = `
        selectedYear, setSelectedYear,
        selectedMonth, setSelectedMonth,
        selectedDay, setSelectedDay,
        periodType, setPeriodType,
        selectedLocationGroupId, setSelectedLocationGroupId,
        viewMode, setViewMode,
        showGuestModal, setShowGuestModal,
        seucheoRegion, setSeucheoRegion,
        isManagerModalOpen, setIsManagerModalOpen,
        selectedMemberForCalendar, setSelectedMemberForCalendar,
        selectedRoomDetails, setSelectedRoomDetails,
        userSort, setUserSort,
        userSearch, setUserSearch,
        programFilter, setProgramFilter,
        
        filteredLocations,
        filteredLogsForSpace,
        spaceData,
        rawProgramData,
        programData,
        rawUserData,
        userData,
        
        handleSort
    `;
    
    const replacementCode = `
    const hookData = useAnalytics({ logs, schoolLogs, locations, locationGroups, users, notices, responses });
    const { ${replacementVariables.split(',').map(v => v.trim()).filter(Boolean).join(', ')} } = hookData;
`;
    
    lines.splice(componentStartIdx + 1, renderStartIdx - componentStartIdx - 1, replacementCode);

    // Also we need to inject the import for `useAnalytics` at the top
    lines.splice(1, 0, `import { useAnalytics } from './admin/statistics/analytics/hooks/useAnalytics.jsx';`);

    fs.writeFileSync(analyticsTabPath, lines.join('\n'));
    console.log('useAnalytics hook extracted successfully.');
} else {
    console.log('Failed to identify extraction bounds.');
}
