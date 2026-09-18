import assert from 'node:assert/strict';
import { getHomeEntry } from '../src/auth/homeEntry.js';

const staff = profile => profile.account_role === 'admin' || profile.account_role === 'master';
const session = { access_token: 'fixture' };
for (const status of ['initializing', 'restoring', 'refreshing']) {
    assert.equal(getHomeEntry({ status, session, profile: { id: 'cached', account_role: 'admin' } }, false, staff), 'waiting');
}
assert.equal(getHomeEntry({ status: 'authenticated', profile: { id: 'admin', account_role: 'admin' } }, false, staff), 'admin');
assert.equal(getHomeEntry({ status: 'authenticated', profile: { id: 'child', account_role: 'member' } }, false, staff), 'student');
assert.equal(getHomeEntry({ status: 'offline', session, profile: { id: 'cached' } }, false, staff), 'retry');
assert.equal(getHomeEntry({ status: 'anonymous', profile: { id: 'stale', account_role: 'admin' } }, false, staff), 'landing');
assert.equal(getHomeEntry({ status: 'authenticated', profile: { id: 'child' } }, true, staff), 'landing');
console.log('PASS home entry: admin/student direct entry, session wait/retry, stale profile and special return');
