// Read-only production diagnosis. The local UI uses actual survey assignments
// and completion flags, but blocks response submission and notification writes.
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import dotenv from 'dotenv';
const traverse = traverseModule.default;
const env = { ...dotenv.parse(await readFile('.env', 'utf8')), ...dotenv.parse(await readFile('.env.local', 'utf8')) };
const memberName = process.argv[2];
if (!memberName) throw new Error('Member name required for read-only diagnosis');
const headers = { apikey:env.VITE_SUPABASE_ANON_KEY, Authorization:`Bearer ${env.VITE_SUPABASE_ANON_KEY}` };
async function get(path) {
    const response = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/${path}`, { headers, signal:AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`Read-only query failed: ${response.status}`);
    return response.json();
}
const users = await get(`users?select=id&name=eq.${encodeURIComponent(memberName)}&limit=1`);
if (!users[0]) throw new Error('Member not found');
const userId = users[0].id;
const logs = await get(`logs?select=created_at&user_id=eq.${userId}&type=eq.CHECKIN&order=created_at.desc&limit=1`);
if (!logs[0]) throw new Error('No check-in receipt');
function extract(source) {
    let effect, close;
    traverse(parse(source, { sourceType:'module', plugins:['jsx'] }), {
        CallExpression({node}) { if (node.callee.name === 'useEffect' && source.slice(node.start,node.end).includes('const isForceRequireSurvey')) effect=source.slice(node.start,node.end); },
        JSXElement({node}) { if(node.openingElement.name.name !== 'StudentCheckinSurveyModal') return; const attribute=node.openingElement.attributes.find(a=>a.name?.name==='onClose'); close=source.slice(attribute.value.expression.start,attribute.value.expression.end); }
    });
    if (!effect || !close) throw new Error('Dashboard wiring missing');
    return {effect,close};
}
const before=extract(execFileSync('git',['show','HEAD:src/pages/StudentDashboard.jsx'],{encoding:'utf8'}));
const after=extract(await readFile('src/pages/StudentDashboard.jsx','utf8'));
await writeFile('scripts/fixtures/live-checkin-verification.html','<html><meta charset="utf-8"><div id="root"></div><script type="module" src="./live-checkin-verification.jsx"></script></html>');
const panel = (label, wiring) => `function ${label}() {
 const [user,setUser]=useState({id:${JSON.stringify(userId)},name:'운영 데이터 검증'});
 const [location,setLocation]=useState({state:{requireCheckinSurvey:true,checkinTime:${JSON.stringify(logs[0].created_at)},locationName:'하이픈'}});
 const [showCheckinSurveyModal,setShowCheckinSurveyModal]=useState(false);
 const [checkinLocationName,setCheckinLocationName]=useState('하이픈');
 const [checkinToastMsg,setCheckinToastMsg]=useState(null);
 const checkinSurveyVisitRef=React.useRef(null);
 const store=React.useRef(new Map([['require_checkin_survey','true'],['active_checkin_time',${JSON.stringify(logs[0].created_at)}]]));
 const sessionStorage={getItem:key=>store.current.get(key)||null,setItem:(key,value)=>store.current.set(key,value),removeItem:key=>store.current.delete(key)};
 ${wiring.effect};
 return <main className="p-6"><h1>${label === 'Before' ? '수정 전' : '수정 후'} · 실제 운영 설문 조회 · 쓰기 차단</h1><button onClick={()=>setUser(current=>({...current,name:current.name+'!'}))}>프로필 갱신</button>{' '}<button onClick={()=>setLocation(current=>({...current,state:{...current.state}}))}>화면 상태 갱신</button><p>설문 상태: {showCheckinSurveyModal?'열림':'닫힘'}</p><p>로딩 표시 횟수: {openingCount}</p>{checkinToastMsg&&<p>{checkinToastMsg.title}</p>}<StudentCheckinSurveyModal isOpen={showCheckinSurveyModal} user={user} locationName={checkinLocationName} onClose={${wiring.close}}/></main>;
}`;
await writeFile('scripts/fixtures/live-checkin-verification.jsx',`
import React,{useState,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import '../../src/index.css';
import StudentCheckinSurveyModal from '../../src/components/student/modals/StudentCheckinSurveyModal';
import {supabase} from '../../src/supabaseClient';
import {surveyHubApi} from '../../src/api/surveyHubApi';
if(!import.meta.env.DEV)throw new Error('Local only');
surveyHubApi.submit=async()=>{throw new Error('Read-only verification: submission blocked');};
const realFrom=supabase.from.bind(supabase);
supabase.from=table=>{const query=realFrom(table);for(const method of ['insert','update','upsert','delete'])query[method]=()=>{throw new Error('Read-only verification: writes blocked');};return query;};
if(window.sessionStorage.getItem('pending_checkin_notif'))throw new Error('Use an isolated localhost origin');
const confetti=()=>{};
let openingCount=0;
const observer=new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1&&node.textContent.includes('설문을 불러오는 중'))openingCount++;});
observer.observe(document.getElementById('root'),{childList:true,subtree:true});
${panel('Before',before)}
${panel('After',after)}
function Demo(){const[mode,setMode]=useState('before');return <><div className="relative z-[2000] bg-white p-3"><button onClick={()=>{openingCount=0;setMode('before');}}>수정 전 실행</button>{' '}<button onClick={()=>{openingCount=0;setMode('after');}}>수정 후 실행</button></div>{mode==='before'?<Before/>:<After/>}</>;}
createRoot(document.getElementById('root')).render(<Demo/>);
`);
console.log('Built isolated read-only UI using the production member receipt, assignments and completions.');
