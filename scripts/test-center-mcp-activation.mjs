import assert from 'node:assert/strict';
import { createMcpHandler } from '../supabase/functions/_shared/centerMcp/handler.mjs';
import { createCenterRolePool, createLiveGrantReader, createConsentService } from '../supabase/functions/_shared/centerMcp/liveStore.mjs';
import { createConsentHandler } from '../supabase/functions/_shared/centerMcp/consentHandler.mjs';
import { createIdentityHandler } from '../supabase/functions/_shared/centerMcp/identityHandler.mjs';
import { createPublishedStatistics } from '../supabase/functions/_shared/centerMcp/releaseStore.mjs';
import { RESOURCE, ISSUER, CALLBACK, CENTER_ORIGIN } from '../supabase/functions/_shared/centerMcp/deployment.mjs';
const originalFetch = globalThis.fetch; globalThis.fetch = () => { throw new Error('No network in synthetic acceptance'); };
let passed = 0;
const check = async (name, run) => { await run(); passed++; console.log('MCP ACTIVATION PASS ' + name); };
const authId='11111111-1111-4111-8111-111111111111',profileId='22222222-2222-4222-8222-222222222222',sessionId='33333333-3333-4333-8333-333333333333',clientId='44444444-4444-4444-8444-444444444444';
const mockPool = run => ({ connect: async () => ({ query: run, release() {} }) });
try {
 await check('preparation metadata and challenge; bearer cannot list or call tools',async()=>{
  const handler=createMcpHandler({resource:RESOURCE,issuer:ISSUER});
  const meta=await handler(new Request(RESOURCE+'/.well-known/oauth-protected-resource'));
  assert.equal(meta.status,200); assert.deepEqual((await meta.json()).authorization_servers,[ISSUER]);
  const challenge=await handler(new Request(RESOURCE)); assert.equal(challenge.status,401);
  assert.ok(challenge.headers.get('WWW-Authenticate').includes(RESOURCE+'/.well-known/oauth-protected-resource'));
  assert.equal((await handler(new Request(RESOURCE,{method:'POST',headers:{Authorization:'Bearer synthetic.invalid.token'},body:'{"method":"tools/list"}'}))).status,503);
 });
 await check('fixed role transaction precedes SELECT; no SQL before BEGIN',async()=>{
  const calls=[]; const base=mockPool(async(sql)=>{calls.push(sql);return{rows:[]};});
  assert.throws(()=>createCenterRolePool(base,'authenticated'));
  const client=await createCenterRolePool(base).connect(); await assert.rejects(client.query('SELECT 1'));
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');await client.query('SELECT 1');await client.query('ROLLBACK');
  assert.deepEqual(calls.slice(0,3),['BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY','SET LOCAL ROLE "center_statistics_reader"','SELECT 1']);
  client.release();await assert.rejects(client.query('SELECT 1'));
  let discarded=false;const broken=await createCenterRolePool({connect:async()=>({query:async sql=>{if(sql.startsWith('SET LOCAL ROLE')||sql==='ROLLBACK')throw new Error('synthetic failure');return{rows:[]};},release:bad=>{discarded=bad===true;}})}).connect();
  await assert.rejects(broken.query('BEGIN'));broken.release();assert.equal(discarded,true);
 });
 await check('live native revocation query excludes secret columns and uses exact bindings',async()=>{
  let live=true, queries=[];
  const read=createLiveGrantReader(mockPool(async(sql,values)=>{queries.push({sql,values});return{rows:[{active:live}]};}));
  const claims={sub:authId,session_id:sessionId,client_id:clientId,center_credential_version:3};const account={profileId,credentialVersion:3};
  assert.equal((await read(claims,account)).active,true);live=false;assert.equal(await read(claims,account),null);
  assert.equal(await read({...claims,center_credential_version:2},account),null);
  const query=queries.find(q=>q.sql.includes('SELECT EXISTS'));
  assert.deepEqual(query.values,[sessionId,authId,profileId,clientId,3]);
  for(const predicate of ['g.revoked_at IS NULL','oc.deleted_at IS NULL','s.not_after','p.revoked_at IS NULL','c.enabled=true'])assert.ok(query.sql.includes(predicate));
  assert.ok(!/refresh_token|authorization_code|client_secret|user_agent|ip\b/.test(query.sql));
 });
 await check('consent proof requires vetted server identity and fixed native callback/PKCE',async()=>{
  let captured;const commands=[];
  const prepare=createConsentService({pool:mockPool(async(sql,values)=>{commands.push(sql);if(sql.includes('INSERT INTO'))captured={sql,values};return{rows:[{authorization_id:'synthetic-request'}]};}),
   authorizeExistingSession:async input=>{assert.equal(input.action,'members.manage');return{sessionId,authUserId:authId,actorProfileId:profileId};},callback:CALLBACK,resource:RESOURCE});
  assert.deepEqual(await prepare({accessToken:'synthetic-token',authorizationId:'synthetic-request'}),{allowed:true});
  assert.deepEqual(captured.values,[sessionId,authId,profileId,'synthetic-request',CALLBACK,RESOURCE]);
  assert.ok(captured.sql.includes("lower(a.code_challenge_method::text)='s256'"));assert.ok(commands.includes('COMMIT'));
  const blocked=createConsentService({pool:mockPool(()=>{throw new Error('must not query');}),authorizeExistingSession:async()=>{throw new Error('blocked');}});
  await assert.rejects(blocked({accessToken:'synthetic-token',authorizationId:'synthetic-request'}));
 });
 await check('consent handler rejects unknown origins/missing auth/body injection before preparation',async()=>{
  let calls=0;const handler=createConsentHandler({origin:CENTER_ORIGIN,prepare:async()=>{calls++;return{allowed:true};}});
  const req=(body,headers={})=>new Request(RESOURCE+'/consent/prepare',{method:'POST',headers:{Origin:CENTER_ORIGIN,'Content-Type':'application/json',Authorization:'Bearer synthetic.invalid.token',...headers},body:JSON.stringify(body)});
  assert.equal((await handler(req({authorizationId:'synthetic-request'},{Origin:'https://evil.invalid'}))).status,403);
  assert.equal((await handler(req({authorizationId:'synthetic-request'},{Authorization:''}))).status,401);
  assert.equal((await handler(req({authorizationId:'synthetic-request',profileId}))).status,400);assert.equal(calls,0);
  assert.equal((await handler(req({authorizationId:'synthetic-request'}))).status,200);assert.equal(calls,1);
 });
 await check('durable release returns cached output; overlapping release never reads source',async()=>{
  let cached={status:'ok',asOf:'synthetic-fixed-time',immutable:true},reads=0;const calls=[];
  const run=createPublishedStatistics({pool:mockPool(async(sql)=>{calls.push(sql);return{rows:sql.includes('SELECT payload')?(cached?[{payload:cached}]:[]):sql.includes('SELECT EXISTS')?[{overlap:true}]:[]};}),
   readSources:async()=>{reads++;throw new Error('must not read');},policy:{reviewed:true,id:'synthetic'},subject:profileId,now:()=>new Date('2026-02-01T00:00:00Z')});
  const identity={verified:true,active:true,subject:profileId,scopes:['center:statistics:read']};const input={period:{kind:'month',date:'2026-01-01'},metrics:['visits']};
  assert.deepEqual(await run(input,identity),cached);cached=null;
  assert.equal((await run(input,identity)).code,'release_review_required');assert.equal(reads,0);
  assert.ok(calls.includes('SELECT pg_advisory_xact_lock(620061006)'));assert.ok(calls.includes('ROLLBACK'));
 });
 await check('website identity returns only server-verified own UUIDs; no target input/grant',async()=>{
  let calls=0;const handler=createIdentityHandler({origin:CENTER_ORIGIN,authorizeExistingSession:async input=>{calls++;assert.equal(input.action,'members.manage');return{authUserId:authId,actorProfileId:profileId,sessionId,privateExtra:'never-output'};}});
  const req=(suffix='',headers={})=>new Request(RESOURCE+'/consent/identity'+suffix,{headers:{Origin:CENTER_ORIGIN,Authorization:'Bearer synthetic.invalid.token',...headers}});
  assert.equal((await handler(req('?target='+sessionId))).status,400);assert.equal(calls,0);
  assert.equal((await handler(req('',{Authorization:''}))).status,401);
  const output=await(await handler(req())).json();assert.deepEqual(output,{verified:true,authUserId:authId,profileId});
  const blocked=createIdentityHandler({origin:CENTER_ORIGIN,authorizeExistingSession:async()=>{throw new Error('untrusted');}});
  assert.equal((await blocked(req())).status,403);
 });
 console.log(`${passed} MCP activation checks passed (synthetic; DB migration/hook/native OAuth NOT verified)`);
} finally { globalThis.fetch=originalFetch; }
