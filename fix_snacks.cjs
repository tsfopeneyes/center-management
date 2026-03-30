const fs = require('fs');

const srcCode = fs.readFileSync('d:/coding/ENTER/src/components/admin/school/modals/SchoolDetailModal.backup.jsx', 'utf8').replace(/\r\n/g, '\n').split('\n');

// Lines 692 to 746 (1-indexed means indices 691 to 745)
const snacksCode = srcCode.slice(691, 746).join('\n');

const snacksFile = `import React from 'react';
import { Cookie, CheckCircle, Save } from 'lucide-react';

const SnackHistoryView = ({ onSaveMetadata, hookData }) => {
    const { editData, setEditData } = hookData;

    return (
${snacksCode}
    );
};
export default SnackHistoryView;`;

fs.writeFileSync('d:/coding/ENTER/src/components/admin/school/views/SnackHistoryView.jsx', snacksFile);
console.log('Fixed SnackHistoryView');
