import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile('public/firebase-messaging-sw.js','utf8');
const origin='https://app.schoolchurchimpact.org';
async function click(url,{open=true,failNavigation=false}={}){
 const handlers={};let target;const steps=[];let closed=false;let pending;
 const client={url:origin+'/admin',async navigate(value){if(failNavigation)throw Error('navigation failed');await Promise.resolve();target=value;steps.push('navigate');return client},async focus(){steps.push('focus');return client}};
 const clients={matchAll:async()=>open?[client]:[],openWindow:async value=>{target=value;steps.push('open');}};
 const self={location:{origin},addEventListener:(name,handler)=>handlers[name]=handler,clients};
 vm.runInNewContext(source,{self,clients,URL,fetch:async()=>({ok:true}),caches:{keys:async()=>[]}});
 handlers.notificationclick({notification:{data:{url},close(){closed=true}},waitUntil(value){pending=value}});await pending;
 return {target,steps,closed};
}
const old=await click(origin+'/community/channel?post=post-15');
assert.equal(new URL(old.target).searchParams.get('from'),'push','A previously delivered unmarked community notification must be recognized as push entry');
assert.deepEqual(old.steps,['navigate','focus'],'Focus follows completed navigation');assert.equal(old.closed,true);
assert.equal(new URL(old.target).searchParams.get('post'),'post-15');
const digest=await click('/community/channel',{open:false});assert.equal(digest.target,origin+'/community/channel?from=push');
const current=await click('/community/channel?from=push&post=post-15');assert.equal(current.target,origin+'/community/channel?from=push&post=post-15');
const ordinary=await click('/student?dm=conversation#reply');assert.equal(ordinary.target,origin+'/student?dm=conversation#reply','Other notification destinations stay unchanged');
const external=await click('https://example.com/community/other');assert.equal(external.target,'https://example.com/community/other');
const retry=await click('/community/channel',{failNavigation:true});assert.deepEqual(retry.steps,['open']);assert.equal(new URL(retry.target).searchParams.get('from'),'push');
console.log('Real service-worker click handler passed: old and new post links, digest, existing/new windows, navigation/focus ordering, failure fallback, unrelated links.');
