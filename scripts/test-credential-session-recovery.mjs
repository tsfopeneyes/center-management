import assert from 'node:assert/strict';
import {recoverCredentialSession} from '../src/auth/credentialSessionRecovery.js';

const removed=[];let signOuts=0;
const deps={auth:{async signOut(options){signOuts++;assert.deepEqual(options,{scope:'local'});}},storage:{removeItem(key){removed.push(key);}}};
assert.equal(await recoverCredentialSession({code:'invalid_request'},deps),false);
assert.equal(signOuts,0);
assert.equal(await recoverCredentialSession({code:'invalid_login'},deps),true);
assert.equal(signOuts,1);
assert.deepEqual(removed,['user','admin_user']);
assert.equal(await recoverCredentialSession({message:'account_changed'},{...deps,auth:{async signOut(){throw Error('already gone');}}}),true);
console.log('PASS credential session recovery: stale password-change sessions are cleared locally for a clean login');
