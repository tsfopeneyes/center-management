import assert from 'node:assert/strict';
import {createCredentialConfirmationStore} from '../supabase/functions/_shared/credentialConfirmationStore.mjs';

const calls=[];
const client={
    async query(text,values){calls.push({text,values});return {rows:[]};},
    release(error){assert.equal(error,undefined);}
};
const store=createCredentialConfirmationStore({async connect(){return client;}});
const id=crypto.randomUUID(),profileId=crypto.randomUUID(),actorProfileId=crypto.randomUUID();
const before=Date.now();
const result=await store.create({id,profileId,actorProfileId,lifetimeMs:300000});
assert.equal(result.id,id);
assert.ok(result.validUntil>=before+300000&&result.validUntil<=Date.now()+300000);
const insert=calls.find(call=>/INSERT INTO account_security\.credential_confirmations/.test(call.text));
assert.ok(insert);
assert.doesNotMatch(insert.text,/RETURNING/i);
assert.deepEqual(insert.values,[id,profileId,actorProfileId,300000]);
assert.equal(calls.at(-1).text,'COMMIT');
console.log('PASS credential confirmation store: insert-only writer needs no read grant');
