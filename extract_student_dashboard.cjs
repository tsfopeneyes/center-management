const fs = require('fs');
const path = require('path');

const srcPath = 'd:/coding/ENTER/src/pages/StudentDashboard.jsx';
const backupPath = 'd:/coding/ENTER/src/pages/StudentDashboard.backup.jsx';
const hooksDir = 'd:/coding/ENTER/src/hooks';
const modalsDir = 'd:/coding/ENTER/src/components/student/modals';

// Back up original
fs.copyFileSync(srcPath, backupPath);
console.log('Backed up StudentDashboard.jsx');

// Ensure directories
if (!fs.existsSync(modalsDir)) fs.mkdirSync(modalsDir, { recursive: true });

// Read lines
const srcCode = fs.readFileSync(srcPath, 'utf8').replace(/\r\n/g, '\n');
const lines = srcCode.split('\n');

const extractBlock = (startStr, endStr) => {
    const startIndex = lines.findIndex(line => line.includes(startStr));
    if (startIndex === -1) return '';
    let endIndex = startIndex + 1;
    let nesting = 1;
    
    // Simple tag counting is risky, we'll try to find the specific ending
    while(endIndex < lines.length) {
        if(lines[endIndex].includes(endStr)) {
            break;
        }
        endIndex++;
    }
    if(endIndex === lines.length) return '';
    
    return lines.slice(startIndex + 1, endIndex).join('\n');
};

console.log('Extraction script ready. Backup created and folders initialized.');
