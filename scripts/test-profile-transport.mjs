import assert from 'node:assert/strict';
import {createProfileTransport} from '../src/auth/profileTransport.js';

const profileId=crypto.randomUUID(),calls=[];
const transport=createProfileTransport({endpoint:'https://auth.example/profile',publishableKey:'public',fetcher:async(url,options)=>{
    calls.push({url,options});return new Response(JSON.stringify({protocol:1,status:'ok',profile:{id:profileId}}),{status:200});
}});
const result=await transport({action:'read',profileId},{accessToken:'access'});assert.equal(result.profile.id,profileId);
assert.equal(calls[0].options.headers.Authorization,'Bearer access');assert.equal(calls[0].options.credentials,'omit');
await assert.rejects(()=>transport({action:'read',profileId},{}),error=>error.code==='invalid_login');
for(const [status,code] of [[400,'invalid_request'],[401,'invalid_login'],[403,'forbidden'],[409,'account_changed'],[500,'temporarily_unavailable']]){
    const failing=createProfileTransport({endpoint:'https://auth.example/profile',fetcher:async()=>new Response('{}',{status})});
    await assert.rejects(()=>failing({action:'read',profileId},{accessToken:'access'}),error=>error.code===code);
}
assert.throws(()=>createProfileTransport({endpoint:'http://remote.invalid/profile'}));
let readAttempts=0;
const recovering=createProfileTransport({endpoint:'https://auth.example/profile',fetcher:async()=>{
    if(++readAttempts===1)return new Response('{}',{status:503});
    return Response.json({protocol:1,status:'ok',profile:{id:profileId}});
}});
assert.equal((await recovering({action:'read',profileId},{accessToken:'access'})).profile.id,profileId);
assert.equal(readAttempts,2,'transient profile read retries once without reissuing login');
for(const status of [401,403,503]){
    let attempts=0;
    const operation=createProfileTransport({endpoint:'https://auth.example/profile',fetcher:async()=>{attempts++;return new Response('{}',{status});}});
    await assert.rejects(operation({action:status===503?'update':'read',profileId},{accessToken:'access'}));
    assert.equal(attempts,1,'writes and authoritative refusals cannot be retried');
}
const aborted=new AbortController();let requests=0;
const interrupted=createProfileTransport({endpoint:'https://auth.example/profile',fetcher:async()=>{
    requests++;aborted.abort();throw new Error('cancelled');
}});
await assert.rejects(interrupted({action:'read',profileId},{accessToken:'access',signal:aborted.signal}));
assert.equal(requests,1,'user cancellation cannot trigger another read');
console.log('PASS profile transport: bearer-only HTTPS, transient read recovery, no write/rejection/cancellation retries and stable errors');
