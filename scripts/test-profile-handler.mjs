import assert from 'node:assert/strict';
import {createProfileHandler} from '../supabase/functions/_shared/profileHandler.mjs';
import {LoginError} from '../supabase/functions/_shared/loginSecurity.mjs';

const calls=[],profileId=crypto.randomUUID();
const profiles={async read(input){calls.push({kind:'read',input});return {protocol:1,status:'ok',profile:{id:profileId}};},async update(input){calls.push({kind:'update',input});return {protocol:1,status:'saved'};},async acceptTerms(input){calls.push({kind:'accept_terms',input});return {protocol:1,status:'saved'};}};
const handler=createProfileHandler({profiles,allowedOrigins:['https://app.example']});
const post=body=>handler(new Request('https://auth.example/profile',{method:'POST',headers:{Origin:'https://app.example','Content-Type':'application/json',Authorization:'Bearer access-token'},body:typeof body==='string'?body:JSON.stringify(body)}));
let response=await post({action:'read',profileId});assert.equal(response.status,200);assert.equal(calls[0].input.accessToken,'access-token');
response=await post({action:'update',profileId,updates:{school:'new'}});assert.equal(response.status,200);assert.equal(calls[1].kind,'update');
response=await post({action:'accept_terms',profileId,termsVersion:'fixture-v1',agreements:{art1:true,art2:true,art3:true,art4:true},source:'WEB_LOGIN'});assert.equal(response.status,200);assert.equal(calls[2].kind,'accept_terms');
response=await handler(new Request('https://auth.example/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}));assert.equal(response.status,401);
response=await post('x'.repeat(33000));assert.equal(response.status,413);
profiles.read=async()=>{throw new LoginError('forbidden',403);};response=await post({action:'read',profileId});assert.equal(response.status,403);assert.deepEqual(await response.json(),{error:'forbidden'});
assert.throws(()=>createProfileHandler({profiles,allowedOrigins:['*']}));
console.log('PASS profile HTTP: bearer required, exact read/update/terms routes, bounded body/origin and safe errors');
