import assert from 'node:assert/strict';
import { verifiedSurveyProfile } from '../src/utils/publicSurveyAuth.js';

const profile = { id: 'profile-id', name: 'Test participant' };
const session = { user: { id: 'different-auth-user-id' } };
assert.equal(verifiedSurveyProfile({ status: 'authenticated', profile, session }), profile);
assert.equal(verifiedSurveyProfile({ status: 'refreshing', profile, session }), null);
assert.equal(verifiedSurveyProfile({ status: 'anonymous', profile, session }), null);
assert.equal(verifiedSurveyProfile({ status: 'authenticated', profile, session: null }), null);
console.log('Public survey authentication checks passed.');
