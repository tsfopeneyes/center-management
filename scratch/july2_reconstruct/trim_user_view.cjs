const fs = require('fs');
const path = require('path');

const userViewPath = 'd:/coding/ENTER/src/components/admin/statistics/analytics/views/UserAnalyticsView.jsx';

let code = fs.readFileSync(userViewPath, 'utf8');
const lines = code.split('\n');

// Keep lines 0-12 (imports + header), lines 472-531 (actual User View div), and lines 534-538 (footer).
// Note: array is 0-indexed.
// 0 to 12 -> lines[0...12]
// 472 to 531 -> lines[472...531]
// 534 to 538 -> lines[534...538]

const newLines = [
    ...lines.slice(0, 13),
    ...lines.slice(472, 532),
    ...lines.slice(534)
];

fs.writeFileSync(userViewPath, newLines.join('\n'));
console.log('UserAnalyticsView trimmed manually.');
