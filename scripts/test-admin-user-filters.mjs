import assert from 'node:assert/strict';
import { defaultUserFilters as defaults, matchesAdminUser as match, monthsBefore, estimatedSchoolGrade, buildLastCenterVisits, schoolChurchState, userFilterChips } from '../src/utils/adminUserFilters.js';
const now = new Date('2026-10-26T12:00:00+09:00');
const teen = { id: 'teen', name: '검증학생', user_group: '청소년', schoolRegion: '강동', created_at: '2026-09-26T00:00:00+09:00', preferences: { is_school_church: true } };
const users = [teen, { ...teen, id: 'leader', is_leader: true }, { ...teen, id: 'graduate', user_group: '졸업생', preferences: { is_school_church: false } }, { ...teen, id: 'unknown', preferences: {} }, { ...teen, id: 'guest', user_group: '게스트' }, { ...teen, id: 'withdrawn', status: 'withdrawn' }];
const ids = patch => users.filter(user => match(user, { ...defaults(), ...patch }, '', now)).map(user => user.id);
assert.deepEqual(ids({groups:['청소년'], schoolChurch:'YES'}), ['teen','leader']);
assert.deepEqual(ids({groups:['청소년'], leader:'YES'}), ['leader']);
assert.deepEqual(ids({groups:['청소년','졸업생'], schoolChurch:'NO'}), ['graduate','unknown']);
assert.deepEqual(ids({schoolChurch:'NO'}), ['graduate','unknown']);
assert.equal(ids({}).includes('guest'), false);
assert.deepEqual(ids({groups:['게스트']}), ['guest']);
assert.deepEqual(ids({groups:['청소년','게스트']}), ['teen','leader','unknown','guest']);
for (const guest of [
    {...teen, user_group:'게스트', is_leader:true},
    {...teen, preferences:{is_temporary:true}},
    {...teen, name:'검증 (guest)'},
]) {
    assert.equal(match(guest, defaults(), '', now), false);
    assert.equal(match(guest, {...defaults(), region:'강동'}, '검증', now), false);
    assert.equal(match(guest, {...defaults(), groups:['게스트']}, '', now), true);
}
assert.equal(match({...teen, user_group:'STAFF'}, defaults(), '', now), true);
assert.equal(ids({}).includes('withdrawn'), false);
assert.equal(schoolChurchState({preferences:{is_school_church:null}}), 'NO');
assert.equal(match(teen, {...defaults(), joined:'CUSTOM',start:'2026-09-26',end:'2026-09-26'}, '',now), true);
assert.equal(match({...teen,created_at:'2026-09-25T15:00:00Z'}, {...defaults(),joined:'CUSTOM', start:'2026-09-26',end:'2026-09-26'},'',now),true);
assert.equal(match(teen, {...defaults(), joined:'CUSTOM',start:'2026-10-01',end:'2026-09-01'},'',now),false);
assert.equal(match({...teen,created_at:null}, {...defaults(),joined:'1M'},'',now),false);
assert.equal(match(teen, {...defaults(),joined:'1M'},'',now),true);
assert.equal(match({...teen,created_at:'2026-09-25T14:59:59Z'}, {...defaults(),joined:'1M'},'',now),false);
assert.equal(monthsBefore('2026-03-31',1),'2026-02-28');
assert.equal(monthsBefore('2024-03-31',1),'2024-02-29');
assert.equal(match(teen, {...defaults(),region:'강서'},'',now),false);
assert.equal(userFilterChips({...defaults(),groups:['청소년'],schoolChurch:'YES'},'학교').length,3);
console.log('PASS: combined filters, leaders, multiple groups, unknown values, guest scope, Korea date boundaries, month ends, chips');

assert.equal(estimatedSchoolGrade('130101',now),'중1');
assert.equal(estimatedSchoolGrade('081231',now),'고3');
assert.equal(estimatedSchoolGrade('131301',now),null);
assert.equal(estimatedSchoolGrade('',now),null);
assert.equal(estimatedSchoolGrade('130101',new Date('2027-02-28T12:00:00+09:00')),'중1');
assert.equal(estimatedSchoolGrade('130101',new Date('2027-03-01T00:00:00+09:00')),'중2');
const visits=buildLastCenterVisits([
    {user_id:'teen',type:'CHECKIN',created_at:'2026-09-26T15:00:00Z'},
    {user_id:'old',type:'CHECKIN',created_at:'2026-09-26T14:59:59Z'},
    {user_id:'guest',type:'GUEST_ENTRY',created_at:'2026-10-26T00:00:00Z'},
    {user_id:'login',type:'WEB_LOGIN',created_at:'2026-10-26T00:00:00Z'},
    {user_id:'future',type:'CHECKIN',created_at:'2027-01-01T00:00:00Z'},
    {user_id:'invalid',type:'CHECKIN',created_at:'invalid'}
],now);
assert.equal(visits.get('teen'),'2026-09-27');
assert.equal(visits.has('future'),false);
assert.equal(visits.has('invalid'),false);
const matchVisit=(id,visit)=>match({...teen,id},{...defaults(),visit},'',now,visits);
assert.equal(matchVisit('teen','30D'),true);
assert.equal(matchVisit('old','30D'),false);
assert.equal(matchVisit('old','OLD_30D'),true);
assert.equal(matchVisit('teen','OLD_30D'),false);
assert.equal(matchVisit('missing','OLD_30D'),false);
assert.equal(matchVisit('missing','NONE'),true);
assert.equal(matchVisit('login','NONE'),true);
assert.equal(matchVisit('guest','7D'),true);
assert.equal(match({...teen,birth:'130101'},{...defaults(),grades:['중1','고3'],visit:'30D'},'',now,visits),true);
assert.equal(match({...teen,birth:'120101'},{...defaults(),grades:['중1','고3']},'',now,visits),false);
assert.equal(userFilterChips({...defaults(),grades:['중1','고3'],visit:'30D'},'').length,3);
console.log('PASS: school-age cohorts, March rollover, invalid birthdays, visit boundaries, guest entries, future records, login exclusion, combined filters');
