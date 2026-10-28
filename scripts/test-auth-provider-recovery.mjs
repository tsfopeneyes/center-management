import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transform} from 'esbuild';

// Execute the actual provider with isolated hooks, browser storage and service
// doubles. No credentials, production requests or database writes are involved.
const source=(await readFile(new URL('../src/auth/AuthProvider.jsx',import.meta.url),'utf8'))
    .replace(/^import .*;\r?\n/gm,'');
const {code}=await transform(`const {React,createContext,useCallback,useContext,useEffect,useMemo,useRef,useState,supabase,getAccountAuthClient,isAccountAuthEnabled}=globalThis.__authFixture;\n${source}`,{loader:'jsx',format:'esm'});
const flush=async()=>{for(let n=0;n<12;n++)await Promise.resolve();};
const authId='10000000-0000-4000-8000-000000000001';
const profileId='10000000-0000-4000-8000-000000000002';
const session={user:{id:authId},access_token:'fixture-token',refresh_token:'fixture-refresh',expires_at:Date.now()/1000+3600};
const profile={id:profileId,name:'fixture',account_role:'member'};
let count=0;
async function fixture(saved=session,initialVerify=null){
    let index=0,slots=[],effects=[],listeners={},callback,checks=0,refreshes=0;
    let verify=initialVerify||(async()=>({protocol:1,decision:'retain',authUserId:authId,profileId}));
    const storage=new Map([['sb-fixture-auth-token',JSON.stringify(saved)],['user',JSON.stringify(profile)]]);
    const timers=new Map();let timerId=0;
    globalThis.localStorage={get length(){return storage.size;},key:i=>[...storage.keys()][i],getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)};
    globalThis.window={setTimeout:(fn,ms)=>{timers.set(++timerId,{fn,ms});return timerId;},clearTimeout:id=>timers.delete(id),addEventListener:(name,fn)=>listeners[name]=fn,removeEventListener:()=>{}};
    globalThis.document={visibilityState:'visible',addEventListener:(name,fn)=>listeners[name]=fn,removeEventListener:()=>{}};
    Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:true}});
    const hook=initial=>{const i=index++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return i;};
    const client={session:async()=>{checks++;return verify();},profile:async()=>({protocol:1,status:'ok',profile})};
    globalThis.__authFixture={React:{createElement:(_type,props)=>props},createContext:()=>({Provider:{}}),useContext:()=>{},
        useState:initial=>{const i=hook(initial);return [slots[i],value=>slots[i]=typeof value==='function'?value(slots[i]):value];},
        useRef:initial=>{const i=hook(()=>({current:initial}));return slots[i];},
        useCallback:(fn,deps)=>{const i=index++,old=slots[i];if(!old||deps.some((dep,n)=>dep!==old.deps[n]))slots[i]={deps,value:fn};return slots[i].value;},
        useMemo:(fn,deps)=>{const i=index++,old=slots[i];if(!old||deps.some((dep,n)=>dep!==old.deps[n]))slots[i]={deps,value:fn()};return slots[i].value;},
        useEffect:(fn,deps)=>{const i=index++,old=slots[i];if(!old||deps.some((dep,n)=>dep!==old.deps[n])){effects.push(()=>{old?.cleanup?.();slots[i]={deps,cleanup:fn()};});}},
        supabase:{auth:{refreshSession:async()=>{refreshes++;return {data:{session}};},getSession:async()=>({data:{session:saved}}),onAuthStateChange:fn=>{callback=fn;return {data:{subscription:{unsubscribe(){}}}};}}},
        getAccountAuthClient:()=>client,isAccountAuthEnabled:()=>true};
    const module=await import('data:text/javascript;base64,'+Buffer.from(code+`\n// fixture ${++count}`).toString('base64'));
    const render=()=>{index=0;effects=[];const value=module.AuthProvider({children:null}).value;for(const fn of effects)fn();return value;};
    render();await flush();
    return {render,storage,timers,get checks(){return checks;},get refreshes(){return refreshes;},setVerify:fn=>verify=fn,
        event:(event,value)=>{callback(event,value);for(const [id,timer] of timers)if(timer.ms===0){timers.delete(id);timer.fn();}}};
}

let f=await fixture();
assert.equal(f.render().status,'authenticated');
assert.equal(JSON.parse(f.storage.get('user')).auth_user_id,authId,'server-verified profile retains provider identity');
f.setVerify(async()=>{throw new Error('connection unavailable');});
await f.render().refresh();
assert.equal(f.render().status,'authenticated','transient revalidation cannot lose verified login');

let complete;
f.setVerify(()=>new Promise(resolve=>complete=resolve));
const before=f.checks;
const first=f.render().refresh(),second=f.render().refresh();
await flush();assert.equal(f.checks,before+1,'resume events share the same verification');
complete({protocol:1,decision:'retain',authUserId:authId,profileId});await Promise.all([first,second]);
assert.equal(f.render().status,'authenticated');

f.setVerify(async()=>({protocol:1,decision:'reauth'}));await f.render().refresh();
assert.equal(f.render().status,'blocked','authoritative rejection cannot retain verified login');
f.event('SIGNED_OUT',null);await flush();assert.equal(f.render().status,'anonymous');

f=await fixture();f.setVerify(async()=>({protocol:1,decision:'retain',authUserId:'different-account',profileId}));
await f.render().refresh();assert.equal(f.render().status,'blocked','account identity must match the installed session');

f=await fixture({...session,expires_at:Date.now()/1000-1});
assert.equal(f.refreshes,1,'expired mobile snapshot refreshes before service verification');
assert.equal(f.render().status,'authenticated');

f=await fixture(session,async()=>{throw new Error('temporary outage');});
assert.equal(f.render().status,'offline','unverified startup cannot trust cached profile');
const retry=[...f.timers.values()].find(timer=>timer.ms===15000);
assert.ok(retry,'stored session gets a recovery attempt without another password');
f.setVerify(async()=>({protocol:1,decision:'retain',authUserId:authId,profileId}));
retry.fn();await flush();assert.equal(f.render().status,'authenticated');

let late;
f=await fixture(session,()=>new Promise(resolve=>late=resolve));
assert.equal(f.render().status,'initializing');
const activeChecks=f.checks;
f.event('SIGNED_IN',session);await flush();assert.equal(f.checks,activeChecks,'duplicate SDK event shares startup check');
f.event('SIGNED_OUT',null);await flush();
late({protocol:1,decision:'retain',authUserId:authId,profileId});await flush();
assert.equal(f.render().status,'anonymous','late verification cannot resurrect a signed out session');
console.log('PASS provider: bound identity, transient recovery, coalesced resume, authoritative rejection, signout and expired mobile sessions');
