// Test harness: production UI/hook and production transport, isolated center key.
// No product code changes, real member identities, notifications, or deletions.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {createClient} from '@supabase/supabase-js';
import '../../src/index.css';
import LiveCenterChat from '../../src/components/student/components/LiveCenterChat';
import {supabase} from '../../src/supabaseClient';
const run=__CHAT_TEST_RUN__;
const index=Number(new URLSearchParams(location.search).get('client'));
if(!Number.isInteger(index)||index<1||index>30)throw Error('Invalid test participant');
const center=`LOAD_TEST_${run}`;
const transport=createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const stats={run,client:index,status:'connecting',received:0,sent:0,errors:[],requestMs:[],deliveryMs:[]};
const seen=new Set();
let controlChannel;
const renderStats=()=>{const output=document.getElementById('chat-test-stats');if(output)output.textContent=JSON.stringify(stats);};
const empty=()=>{const q=new Proxy({}, {get:(_,key)=>key==='then'?resolve=>Promise.resolve({data:[],error:null}).then(resolve):()=>q});return q;};
supabase.from=table=>{
 if(table!=='center_daily_chats')return empty();
 let query=transport.from(table),isInsert=false,start=0;
 const proxy=new Proxy({}, {get:(_,key)=>{
  if(key==='then')return resolve=>Promise.resolve(query).then(result=>{
   if(isInsert){if(result.error)stats.errors.push(result.error.message);else stats.sent+=(result.data?.length||0);stats.requestMs.push(Date.now()-start);renderStats();}
   return result;
  }).then(resolve);
  return(...args)=>{
   if(['update','upsert','delete'].includes(key))throw Error('Test only permits inserts');
   if(key==='insert'){
    const rows=Array.isArray(args[0])?args[0]:[args[0]];
    if(rows.length!==1||!rows[0].message.startsWith(`[동시검증 ${run} `))throw Error('Invalid test message');
    if(stats.sent>=1)throw Error('One test message per client');
    args[0]=rows.map(row=>({...row,center_code:center,user_id:null,user_name:`동시검증 ${index}`,user_role:'테스트',message:`${row.message} ${Date.now()}`}));isInsert=true;start=Date.now();
   }
   if(key==='eq'&&args[0]==='center_code')args[1]=center;
   query=query[key](...args);return proxy;
  };
 }});return proxy;
};
supabase.channel=()=>{
 const channel=transport.channel(`load:${run}`,{config:{broadcast:{ack:false}}});
 controlChannel=channel;
 channel.on('broadcast',{event:'load-test-submit'},({payload})=>{if(payload?.run===run)submitPrepared();});
 const wrapper={
  on:(kind,filter,callback)=>{
   channel.on(kind,kind==='postgres_changes'?{...filter,filter:`center_code=eq.${center}`}:filter,payload=>{
    if(kind==='postgres_changes'){
     if(payload.new?.center_code!==center)return;
     if(payload.eventType==='INSERT'&&!seen.has(payload.new.id)){
      seen.add(payload.new.id);stats.received=seen.size;
      const sent=Number(payload.new.message.split(' ').at(-1));if(Number.isFinite(sent))stats.deliveryMs.push(Date.now()-sent);renderStats();
     }
     callback({...payload,new:{...payload.new,center_code:'하이픈'}});
    }else callback(payload);
   });return wrapper;
  },
  subscribe:()=>{channel.subscribe((status,error)=>{stats.status=status;if(error)stats.errors.push(error.message);renderStats();});return wrapper;},
  send:message=>channel.send(message),
  raw:channel
 };return wrapper;
};
supabase.removeChannel=channel=>transport.removeChannel(channel.raw);
const currentUser={id:`isolated-test-${index}`,name:`동시검증 ${index}`,account_role:'member',region:'강동'};
// A fixture-only UI control releases all prepared browser forms together.
// The production component still validates and sends its own form normally.
const submitPrepared=()=>document.querySelector('form')?.requestSubmit();
createRoot(document.getElementById('root')).render(<main className="mx-auto max-w-xl p-4"><h1 className="mb-3 font-bold">센터 채팅 동시 접속 검증 {index}/30</h1><LiveCenterChat currentUser={currentUser} studentRegion="강동"/><button onClick={()=>{controlChannel.send({type:'broadcast',event:'load-test-submit',payload:{run}});submitPrepared();}}>30개 화면 동시 전송</button><output id="chat-test-stats" className="mt-4 block break-all text-xs"/></main>);
setTimeout(renderStats,0);
