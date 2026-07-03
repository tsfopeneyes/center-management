const fs = require('fs');
const path = require('path');

const analyticsTabPath = 'd:/coding/ENTER/src/components/AnalyticsTab.jsx';
const modalsDir = 'd:/coding/ENTER/src/components/admin/statistics/analytics/modals';

let originalCode = fs.readFileSync(analyticsTabPath, 'utf8');

const regexMemberActivity = /const MemberActivityModal = \(\{.*?\}\) => \{[\s\S]*?(?=const RoomMemberDetailModal)/;
const regexRoomMember = /const RoomMemberDetailModal = \(\{.*?\}\) => \{[\s\S]*?(?=const GuestVisitDetailModal)/;
const regexGuestVisit = /const GuestVisitDetailModal = \(\{.*?\}\) => \{[\s\S]*?(?=export default AnalyticsTab;)/;

const matchMember = originalCode.match(regexMemberActivity);
const matchRoom = originalCode.match(regexRoomMember);
const matchGuest = originalCode.match(regexGuestVisit);

if(matchMember && matchRoom && matchGuest) {
    const importTop = `import React, { useState, useMemo } from 'react';
import { Award, MapPin, Users } from 'lucide-react';
import { format, endOfMonth, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';
`;

    fs.writeFileSync(path.join(modalsDir, 'MemberActivityModal.jsx'), importTop + '\\n' + matchMember[0].trim() + '\\n\\nexport default MemberActivityModal;\\n');
    fs.writeFileSync(path.join(modalsDir, 'RoomMemberDetailModal.jsx'), importTop + '\\n' + matchRoom[0].trim() + '\\n\\nexport default RoomMemberDetailModal;\\n');
    fs.writeFileSync(path.join(modalsDir, 'GuestVisitDetailModal.jsx'), importTop + '\\n' + matchGuest[0].trim() + '\\n\\nexport default GuestVisitDetailModal;\\n');

    // Remove them from AnalyticsTab
    let newCode = originalCode.replace(matchMember[0], '');
    newCode = newCode.replace(matchRoom[0], '');
    newCode = newCode.replace(matchGuest[0], '');

    // Add imports to AnalyticsTab
    const modalImports = `
import MemberActivityModal from './admin/statistics/analytics/modals/MemberActivityModal';
import RoomMemberDetailModal from './admin/statistics/analytics/modals/RoomMemberDetailModal';
import GuestVisitDetailModal from './admin/statistics/analytics/modals/GuestVisitDetailModal';
`;
    // Find import { useAnalytics } and inject right after
    newCode = newCode.replace("import { useAnalytics } from './admin/statistics/analytics/hooks/useAnalytics.jsx';", "import { useAnalytics } from './admin/statistics/analytics/hooks/useAnalytics.jsx';" + modalImports);

    fs.writeFileSync(analyticsTabPath, newCode);
    console.log('Modals extracted successfully.');
} else {
    console.log('Failed to match modals regex.');
}
