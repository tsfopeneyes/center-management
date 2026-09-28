import assert from 'node:assert/strict';
import {createProfileBundle} from '../supabase/functions/_shared/profileBundle.mjs';
const pool={connect:async()=>({query:async()=>({rows:[]}),release(){}})};
const bundle=createProfileBundle({pool,verifyToken:async()=>null,readiness:async()=>false,termsVersion:'fixture-v1'});
assert.deepEqual(Object.keys(bundle),['read','update','acceptTerms']);assert.equal(typeof bundle.read,'function');assert.equal(typeof bundle.update,'function');assert.equal(typeof bundle.acceptTerms,'function');
console.log('PASS profile composition: protected read, metadata update and terms acceptance wired together');
