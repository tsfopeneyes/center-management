import assert from 'node:assert/strict';
import {createCredentialConfirmationService} from '../supabase/functions/_shared/credentialConfirmationService.mjs';

const profileId=crypto.randomUUID(),actorProfileId=crypto.randomUUID(),confirmationId=crypto.randomUUID();
let quota=true,allowed=true,created=0;
const quotaPurposes=[];
const service=createCredentialConfirmationService({lifetimeMs:300000,readiness:async()=>true,keyFor:async purpose=>{quotaPurposes.push(purpose);return 'a'.repeat(64);},
    limits:{async consumeLimit(_key,limit){assert.ok([50,10].includes(limit));return quota;}},async authorize(){return allowed?{actorProfileId,authUserId:crypto.randomUUID()}:null;},
    store:{async create(input){assert.equal(input.profileId,profileId);assert.equal(input.actorProfileId,actorProfileId);assert.equal(input.lifetimeMs,300000);created++;return {id:confirmationId,validUntil:600000};}}
});
const context={accessToken:'admin-token',clientKey:'trusted'};
assert.deepEqual(await service({protocol:1,profileId},context),{protocol:1,status:'reset_confirmed',confirmationId,validUntil:600000});
assert.deepEqual(quotaPurposes,['credential-client','credential-reset-account']);
quota=false;await assert.rejects(()=>service({protocol:1,profileId},context),error=>error.code==='try_later');quota=true;
allowed=false;await assert.rejects(()=>service({protocol:1,profileId},context),error=>error.code==='forbidden');
await assert.rejects(()=>service({protocol:1,profileId},{clientKey:'trusted'}),error=>error.code==='invalid_login');
await assert.rejects(()=>service({protocol:1,profileId},{accessToken:'admin-token'}),error=>error.code==='temporarily_unavailable');
assert.equal(created,1);
console.log('PASS reset confirmation service: current admin bearer, bounded lifetime/quota, server-generated confirmation only');
