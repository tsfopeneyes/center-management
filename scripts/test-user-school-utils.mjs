import assert from 'node:assert/strict';
import { buildSchoolLookup, resolveUserSchool } from '../src/utils/userSchoolUtils.js';

const schools = [
    { id: 'gd', name: '강동고등학교', region: '강동' },
    { id: 'gs', name: '강서여자고등학교', region: '강서' },
    { id: 'none', name: '지역미정고등학교', region: null },
    { id: 'dup1', name: '중복고등학교', region: '강동' },
    { id: 'dup2', name: '중복고', region: '강서' }
];
const lookup = buildSchoolLookup(schools);

assert.deepEqual(resolveUserSchool({ school_id: 'gs', school: '과거학교명' }, lookup), {
    school: schools[1], schoolId: 'gs', schoolName: '강서여자고등학교', region: '강서'
});
assert.equal(resolveUserSchool({ school: '강동고' }, lookup).schoolId, 'gd');
assert.equal(resolveUserSchool({ school: '미등록학교' }, lookup).region, '미지정');
assert.equal(resolveUserSchool({ school: '중복고등학교' }, lookup).schoolId, null);
assert.equal(resolveUserSchool({ school_id: 'none' }, lookup).region, '미지정');

console.log('user-school utilities: all checks passed');

