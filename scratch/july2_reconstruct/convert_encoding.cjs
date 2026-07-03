const fs = require('fs');
let content = fs.readFileSync('d:/coding/ENTER/src/components/AnalyticsTab.orig.jsx', 'utf16le');
fs.writeFileSync('d:/coding/ENTER/src/components/AnalyticsTab.orig.jsx', content, 'utf8');
console.log('Converted to utf8');
