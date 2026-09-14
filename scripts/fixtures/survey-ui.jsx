// Development-only fixture. All data operations below stay in page memory.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/index.css';
import SurveyHub from '../../src/components/admin/surveys/SurveyHub';
import SurveyRunner from '../../src/components/surveys/SurveyRunner';
import { surveyHubApi } from '../../src/api/surveyHubApi';
import { supabase } from '../../src/supabaseClient';

if (!import.meta.env.DEV) throw new Error('Local fixture only');
const definition = { title: '프로그램 공통 만족도', description: '활동 경험을 알려주세요.', questions: [
    {id:'rating',title:'프로그램에 얼마나 만족하나요?',type:'star',metric:'satisfaction',required:true},
    {id:'choice',title:'가장 좋았던 활동은?',type:'choice',options:['대화','만들기'],required:true},
    {id:'multiple',title:'다음에 하고 싶은 활동은?',type:'multiple',options:['운동','보드게임','산책'],required:false},
    {id:'short',title:'한마디로 표현하면?',type:'short',required:false},
    {id:'text',title:'개선할 점을 알려주세요.',type:'text',required:false}
] };
let forms=[{id:'f1',title:definition.title,archived:false,survey_versions:[{id:'v1',form_id:'f1',definition,created_at:'2026-09-10T00:00:00Z'}]}];
let programs=[{id:'p1',category:'PROGRAM',title:'A 프로그램',guest_properties:{}},{id:'p2',category:'PROGRAM',title:'B 프로그램',guest_properties:{}}];
let links=['p1','p2'].map((id,i)=>({id:`l${i}`,form_id:'f1',version_id:'v1',event:'PROGRAM',notice_id:id,enabled:true,frequency:'ONCE',priority:100,is_default:false,audience:'ATTENDED',timing:'AFTER_END',opens_at:null,closes_at:null}));
let entries=[{id:'e1',form_id:'f1',version_id:'v1',link_id:'l0',notice_id:'p1',snapshot:definition,answers:{rating:4,choice:'대화',multiple:['운동','산책'],text:'시간을 늘려주세요'},created_at:new Date().toISOString()},{id:'e2',form_id:'f1',version_id:'v1',link_id:'l1',notice_id:'p2',snapshot:definition,answers:{rating:5,choice:'만들기',short:'즐거움'},created_at:new Date().toISOString()}];
const clone=value=>structuredClone(value);
const full=link=>({...link,form:forms.find(f=>f.id===link.form_id),version:forms.flatMap(f=>f.survey_versions).find(v=>v.id===link.version_id)});
surveyHubApi.catalog=async()=>clone(forms);
surveyHubApi.links=async()=>clone(links.map(full));
surveyHubApi.entries=async id=>clone(entries.filter(e=>!id||e.form_id===id));
surveyHubApi.publish=async(formId,def)=>{const v={id:crypto.randomUUID(),form_id:formId,definition:clone(def),created_at:new Date().toISOString()};forms.find(f=>f.id===formId).survey_versions.push(v);return clone(v);};
surveyHubApi.create=async def=>{const form={id:crypto.randomUUID(),title:def.title,archived:false,survey_versions:[]};forms.push(form);return surveyHubApi.publish(form.id,def);};
surveyHubApi.updateLink=async(id,patch)=>{const link=links.find(l=>l.id===id);Object.assign(link,patch);return clone(link);};
surveyHubApi.connect=async values=>{const link={id:crypto.randomUUID(),enabled:true,priority:100,is_default:false,audience:'ATTENDED',timing:'AFTER_END',...values};links.push(link);return clone(link);};
surveyHubApi.archive=async(id,archived)=>{forms.find(f=>f.id===id).archived=archived;};
surveyHubApi.submit=async(link,userId,answers)=>{const e={id:crypto.randomUUID(),link_id:link.id,form_id:link.form_id,version_id:link.version_id,notice_id:link.notice_id,user_id:userId,answers:clone(answers),snapshot:clone(link.version.definition),created_at:new Date().toISOString()};entries.push(e);return clone(e);};
supabase.from=table=>{let data=table==='notices'?programs:table==='surveys'?[]:entries;let patch=null;const builder={select(){return this;},order(){return this;},eq(key,value){data=data.filter(r=>r[key]===value);return this;},update(value){patch=value;return this;},then(resolve,reject){if(patch)data.forEach(r=>Object.assign(r,patch));return Promise.resolve({data:clone(data),error:null}).then(resolve,reject);}};return builder;};
function Demo(){const[runner,setRunner]=useState(false);const[message,setMessage]=useState('');return <main className="mx-auto max-w-6xl p-4 md:p-8 bg-gray-50 min-h-screen"><div className="mb-5 rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm">로컬 검증용 예시 데이터 · 실제 설문과 응답에는 저장되지 않습니다. <button className="ml-3 underline" onClick={()=>setRunner(true)}>응답 화면 체험</button></div>{message&&<p role="status" className="mb-4 bg-green-50 p-4">{message}</p>}<SurveyHub onLegacy={()=>setMessage('기존 설문 보기 연결 확인')} />{runner&&<SurveyRunner link={full(links[0])} userId="test-user" onClose={()=>setRunner(false)} onComplete={()=>{setRunner(false);setMessage('응답이 저장되었습니다.');}}/>}</main>}
const mount = document.getElementById('root');
const root = mount.__surveyFixtureRoot ||= createRoot(mount);
root.render(<Demo/>);
