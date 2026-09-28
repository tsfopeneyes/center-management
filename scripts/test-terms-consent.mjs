import assert from 'node:assert/strict';
import { getTermsConsentStatus, requiresCurrentTermsConsent } from '../src/utils/termsConsent.js';
import { createTermsAcceptanceService } from '../supabase/functions/_shared/termsAcceptanceService.mjs';

const id=crypto.randomUUID(),authUserId=crypto.randomUUID(),sessionId=crypto.randomUUID();
assert.equal(getTermsConsentStatus({id,user_group:'청소년',preferences:{terms_agreed:true,terms_version:'2024-03-05'}}),'CURRENT');
assert.equal(getTermsConsentStatus({id,user_group:'청소년',preferences:{terms_agreed:true,terms_version:'old'}}),'OUTDATED');
assert.equal(getTermsConsentStatus({id,user_group:'청소년',preferences:{}}),'REQUIRED');
assert.equal(getTermsConsentStatus({id,user_group:'게스트',preferences:{}}),'NOT_APPLICABLE');
assert.equal(getTermsConsentStatus({id,user_group:'청소년',preferences:{is_temporary:true}}),'NOT_APPLICABLE');
assert.equal(requiresCurrentTermsConsent({id,user_group:'청소년',preferences:{}}),true);

let committed=false,rolledBack=false,released=false,inserted=false;
const client={async query(sql){
    if(sql.startsWith('UPDATE public.users'))return {rows:[{preferences:{terms_agreed:true,terms_version:'2024-03-05'}}]};
    if(sql.startsWith('INSERT INTO account_security.member_terms_consents'))inserted=true;
    if(sql==='COMMIT')committed=true;if(sql==='ROLLBACK')rolledBack=true;return {rows:[]};
},release(){released=true;}};
const principal={authUserId,sessionId,live:true,isAnonymous:false,expiresAt:Date.now()+60000};
const service=createTermsAcceptanceService({pool:{connect:async()=>client},verifyToken:async()=>principal,readiness:async()=>true,termsVersion:'2024-03-05'});
const input={accessToken:'token',profileId:id,termsVersion:'2024-03-05',source:'WEB_LOGIN',agreements:{art1:true,art2:true,art3:true,art4:true}};
assert.equal((await service(input)).status,'saved');assert.ok(inserted&&committed&&released&&!rolledBack);
for(const invalid of [
    {...input,termsVersion:'old'},
    {...input,source:'ADMIN'},
    {...input,agreements:{...input.agreements,art4:false}},
])await assert.rejects(service(invalid),error=>error.code==='invalid_request');
console.log('PASS terms consent: member classification, exact current version, four required articles and atomic server acceptance');
