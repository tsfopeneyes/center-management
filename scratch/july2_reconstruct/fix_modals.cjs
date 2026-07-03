const fs = require('fs');
const dir = 'd:/coding/ENTER/src/components/admin/statistics/analytics/modals';
['MemberActivityModal.jsx', 'RoomMemberDetailModal.jsx', 'GuestVisitDetailModal.jsx'].forEach(f => {
  let c = fs.readFileSync(`${dir}/${f}`, 'utf8');
  c = c.replace(/\\n/g, '\n');
  fs.writeFileSync(`${dir}/${f}`, c);
});
console.log('Fixed');
