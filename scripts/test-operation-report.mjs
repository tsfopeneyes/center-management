import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as dates from 'date-fns';
import { buildOperationProgramStats } from '../src/utils/operationProgramStats.js';
const context=vm.createContext({...dates,console,buildOperationProgramStats,supabase:{},isCurrentProgramAttendee:()=>false});
for(const file of ['src/utils/userUtils.js','src/utils/dateUtils.js','src/utils/visitUtils.js','src/utils/analyticsUtils.js']){
    const source=fs.readFileSync(file,'utf8').replace(/^import .*;\r?\n/gm,'').replaceAll('export const ','const ');
    vm.runInContext(source,context,{filename:file});
}
vm.runInContext('globalThis.reportFn = analyticsUtils.processOperationReport;',context);
const users=[{id:'youth_id',user_group:'청소년'},{id:'guest_id',user_group:'게스트'}];
const locations=[{id:'center_room_one',name:'테스트 공간'}];
const logs=users.flatMap(user=>['01','02'].flatMap(day=>[
    {user_id:user.id,location_id:locations[0].id,type:'CHECKIN',created_at:`2026-09-${day}T10:00:00+09:00`},
    {user_id:user.id,location_id:locations[0].id,type:'CHECKOUT',created_at:`2026-09-${day}T11:00:00+09:00`},
]));
const report=context.reportFn(logs,users,locations,[],[],new Date(2026,8,1),new Date(2026,8,30),'ALL');
assert.equal(report.totalUnique,1);
assert.equal(report.spaceResults[0].visitCount,2);
assert.equal(report.spaceResults[0].totalDuration,120);
assert.equal(report.spaceResults[0].retentionRate,'100.0');
assert.equal(report.monthlyMetrics.retentionRate,'100.0');
assert.equal(report.guestResults[locations[0].id].visitCount,2);
assert.equal(report.guestResults[locations[0].id].totalDuration,120);
const empty=context.reportFn([],users,locations,[],[],new Date(2026,8,1),new Date(2026,8,30),'ALL');
assert.equal(empty.totalUnique,0);
console.log('Monthly report with underscores in user/space IDs, visits, durations, retention, guests and empty data passed');
