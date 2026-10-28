import assert from 'node:assert/strict';
import { schoolStudentCount, schoolStudentHeatPoints } from '../src/utils/schoolMapStudents.js';
const group = (lat, lng, youth, graduates = 0) => ({ metadata: { map_latitude: lat, map_longitude: lng }, students: [
    ...Array.from({ length: youth }, () => ({ user_group: '청소년' })),
    ...Array.from({ length: graduates }, () => ({ user_group: '졸업생' })),
    { user_group: 'STAFF' }, { user_group: '게스트' },
] });
assert.equal(schoolStudentCount(group(37.5, 127.1, 5, 50)), 5);
assert.equal(schoolStudentCount({}), 0);
assert.deepEqual(schoolStudentHeatPoints([
    group(37.5, 127.1, 5, 50), group(37.5, 127.1, 3), group(37.6, 127.2, 2),
    group(37.7, 127.3, 0, 30), group(null, null, 10),
]), [{ lat: 37.5, lng: 127.1, students: 8 }, { lat: 37.6, lng: 127.2, students: 2 }]);
console.log('Passed: youth only; graduates, staff and guests excluded; zero students and missing coordinates excluded; shared coordinates aggregate exact youth counts.');
