import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../src/pages/PublicProgramDetail.jsx', import.meta.url), 'utf8');

assert.match(page, /const hasStudentDashboard = Boolean\(loggedInUser && loggedInUser\.user_group !== '게스트'\)/);
assert.match(page, /const openApplicationStatus = \(\) => \{\s*if \(hasStudentDashboard\) navigate\('\/student'\);\s*else setIsSuccessModalOpen\(true\);/);
assert.match(page, /if \(isRegistered\) openApplicationStatus\(\)/);
assert.match(page, /if \(hasStudentDashboard\) localStorage\.setItem\('pendingProgramJoin', id\);\s*openApplicationStatus\(\);/);
assert.match(page, /setIsSuccessModalOpen\(false\);\s*if \(hasStudentDashboard\) navigate\('\/student'\);/);
assert.match(page, /hasStudentDashboard\s*\? \(shouldSuggestGuestConversion[\s\S]*: \(shouldSuggestGuestConversion \? '다음에 전환하기' : '확인'\)/);

console.log('guest application success stays on the public detail; verified members keep dashboard navigation');
