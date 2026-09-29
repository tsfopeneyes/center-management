import assert from 'node:assert/strict';
import { buildGuestRegistrationRequest } from '../src/features/programs/application/guestRegistrationRequest.js';

const form = {
    name: '  신청자  ', school: '서울고', phone: '010-1234-5678',
    birth: '2008-03-15', privacyConsent: true,
    guardianName: ' 보호자 ', guardianPhone: '010-5555-6666',
    guardianRelation: ' 부모 ', guardianConsent: true,
    customAnswers: { purpose: '참여' },
};
const whole = { id: 11, category: 'PROGRAM', is_recruiting: true,
    guest_properties: { application_scope: 'PROGRAM' } };
const wholeRequest = buildGuestRegistrationRequest(whole, null, form);
assert.equal(wholeRequest.noticeId, 11);
assert.equal(wholeRequest.sessionId, null);
assert.equal(wholeRequest.profile.name, '신청자');
assert.equal(wholeRequest.profile.school, '서울고등학교');
assert.equal(wholeRequest.profile.guardian_name, '보호자');
assert.deepEqual(wholeRequest.answers, { purpose: '참여' });

const session = { ...whole, guest_properties: {
    schedule_mode: 'RECURRING', application_scope: 'SESSION',
}, open_sessions: [{ id: 'session-one' }], today_session: { id: 'session-today' } };
assert.equal(buildGuestRegistrationRequest(session, 'session-one', form).sessionId, 'session-one');
assert.equal(buildGuestRegistrationRequest(session, 'session-one', form).noticeId, null);
assert.equal(buildGuestRegistrationRequest(session, null, form).sessionId, 'session-today');
assert.throws(() => buildGuestRegistrationRequest(session, 'stale-session', form), /다시 선택/);
assert.throws(() => buildGuestRegistrationRequest({ ...whole, id: 'bad' }, null, form), /프로그램 정보/);
console.log('guest registration request preserves identity and never silently switches a stale session');
