import assert from 'node:assert/strict';
import {verifiedReturnProfile} from '../src/auth/verifiedReturnProfile.js';

const profile={id:crypto.randomUUID(),name:'김학생'};
assert.deepEqual(verifiedReturnProfile({status:'restoring',profile}),{settling:true,profile:null});
assert.deepEqual(verifiedReturnProfile({status:'anonymous',profile}),{settling:false,profile:null});
assert.deepEqual(verifiedReturnProfile({status:'authenticated',profile}),{settling:false,profile});
assert.deepEqual(verifiedReturnProfile({status:'authenticated',profile:null}),{settling:false,profile:null});
console.log('PASS verified return profile: stale local profile cannot close survey login');
