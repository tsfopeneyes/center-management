import assert from 'node:assert/strict';
import {resolveTemporaryPasswordCandidate} from '../src/auth/temporaryPasswordCandidate.js';

const id=crypto.randomUUID();
const loaded={id,name:'박루아',school:'테스트학교',user_group:'재학생'};
let lookups=0;
assert.equal(await resolveTemporaryPasswordCandidate(loaded,async()=>{lookups++;return [];}),loaded);
assert.equal(lookups,0);
assert.deepEqual(await resolveTemporaryPasswordCandidate({name:'박루아'},async name=>{
    lookups++;assert.equal(name,'박루아');return [loaded];
}),loaded);
assert.equal(lookups,1);
await assert.rejects(()=>resolveTemporaryPasswordCandidate({name:'박루아'},async()=>[]),error=>error.code==='account_changed');
await assert.rejects(()=>resolveTemporaryPasswordCandidate({name:'박루아'},async()=>[loaded,{...loaded,id:crypto.randomUUID()}]),error=>error.code==='account_changed');
assert.match(id,/^[0-9a-f-]+$/i);
console.log('PASS temporary password candidate: direct name login resolves exactly one protected profile id');
