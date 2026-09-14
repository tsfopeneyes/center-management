import assert from 'node:assert/strict';
import {createMemberAdminService} from '../supabase/functions/_shared/memberAdminService.mjs';

const actor='10000000-0000-4000-8000-000000000001';
const target='10000000-0000-4000-8000-000000000002';

function serviceFixture({actorRole='master',targetRole='admin',otherMasters=1}={}){
  const queries=[];
  const client={
    async query(text,values=[]){
      const sql=String(text).replace(/\s+/g,' ').trim();queries.push({sql,values});
      if(sql.includes('SELECT role FROM account_security.account_roles'))return {rows:[{role:actorRole}]};
      if(sql.includes('SELECT r.role,r.enabled'))return {rows:[{role:targetRole,enabled:true,mapping_verified:true,status:'active',profile_status:'approved'}]};
      if(sql.includes('SELECT count(*)::int AS count'))return {rows:[{count:otherMasters}]};
      if(sql.includes('UPDATE account_security.account_roles'))return {rows:[{profile_id:target,role:values[1],enabled:true}]};
      return {rows:[]};
    },
    release() {},
  };
  return {
    queries,
    service:createMemberAdminService({
      pool:{connect:async()=>client},readiness:async()=>true,
      authorize:async input=>{assert.equal(input.action,'roles.manage');return {actorProfileId:actor};},
    }),
  };
}

const success=serviceFixture();
assert.deepEqual(await success.service({accessToken:'token',profileId:target,targetRole:'master',reason:'promote_test'}),
  {protocol:1,status:'saved',profileId:target,role:'master'});
assert.ok(success.queries.some(item=>item.sql.includes("set_config('app.actor_profile_id'")));
assert.ok(success.queries.some(item=>item.sql.includes('UPDATE account_security.account_roles')));
assert.equal(success.queries.at(-1).sql,'COMMIT');

const nonMaster=serviceFixture({actorRole:'admin'});
await assert.rejects(nonMaster.service({accessToken:'token',profileId:target,targetRole:'master'}),error=>error.code==='forbidden');
assert.equal(nonMaster.queries.at(-1).sql,'ROLLBACK');

const lastMaster=serviceFixture({targetRole:'master',otherMasters:0});
await assert.rejects(lastMaster.service({accessToken:'token',profileId:target,targetRole:'admin'}),error=>error.code==='forbidden');
assert.equal(lastMaster.queries.at(-1).sql,'ROLLBACK');

await assert.rejects(success.service({accessToken:'token',profileId:target,targetRole:'staff'}),error=>error.code==='invalid_request');

console.log('PASS member role service: master-only canonical changes, audit context, last-master guard and rollback');
