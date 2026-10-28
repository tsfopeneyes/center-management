// Uses production components and save API with an isolated database transport.
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import '../../src/index.css';
import NoticeModal from '../../src/components/student/NoticeModal';
import AdminFeedbackListModal from '../../src/components/admin/board/components/modals/AdminFeedbackListModal';
import {supabase} from '../../src/supabaseClient';
import {userApi} from '../../src/api/userApi';
import {noticesApi} from '../../src/api/noticesApi';
const user={id:'00000000-0000-4000-8000-000000000001',name:'테스트 학생',account_role:'member'};
const notice={id:9001,title:'검증 프로그램',content:'<p>운영 데이터와 분리된 피드백 작성 검증입니다.</p>',category:'PROGRAM',is_recruiting:true,program_status:'ACTIVE',program_date:new Date(Date.now()-60000).toISOString(),program_duration:'1시간',guest_properties:{schedule_mode:'SINGLE',enable_feedback:true,survey_version_id:'test-version'},images:[]};
localStorage.setItem('user',JSON.stringify(user));
let admin=false;
supabase.from=table=>{const ops=[];const query=new Proxy({}, {get:(_,key)=>key==='then'?resolve=>fetch('http://127.0.0.1:1003/query',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({table,ops,admin})}).then(r=>r.json()).then(resolve):(...args)=>{ops.push([key,...args]);return query;}});return query;};
supabase.rpc=async()=>({data:[],error:null});supabase.channel=()=>{const c={on:()=>c,subscribe:()=>c};return c;};supabase.removeChannel=()=>{};
userApi.fetchStaff=async()=>[];noticesApi.fetchNoticeReactions=async()=>[];
function Preview(){const [mode,setMode]=useState('student');return <><nav style={{position:'fixed',top:0,right:0,zIndex:5000,padding:8,background:'white'}}><button onClick={()=>{admin=false;setMode('student');}}>학생 화면</button><button onClick={()=>{admin=true;setMode('admin');}}>관리자 결과 보기</button></nav>{mode==='student'?<NoticeModal notice={notice} context="student" user={user} responses={{9001:'JOIN'}} responseDetails={{}} comments={[]} newComment="" setNewComment={()=>{}} onResponse={()=>{}} onClose={()=>{}} onRefresh={()=>{}} tutorialMode />:<AdminFeedbackListModal notice={notice} onClose={()=>{admin=false;setMode('student');}}/>}</>}
createRoot(document.getElementById('root')).render(<Preview/>);
