const fs = require('fs');

const filesToFix = [
  'd:/coding/ENTER/src/components/AnalyticsTab.jsx',
  'd:/coding/ENTER/src/components/admin/statistics/analytics/views/SpaceAnalyticsView.jsx',
  'd:/coding/ENTER/src/components/admin/statistics/analytics/views/ProgramAnalyticsView.jsx',
  'd:/coding/ENTER/src/components/admin/statistics/analytics/views/UserAnalyticsView.jsx'
];

filesToFix.forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  c = c.replace(/\\n/g, '\n');
  fs.writeFileSync(f, c);
});
console.log('Fixed literal newlines');
