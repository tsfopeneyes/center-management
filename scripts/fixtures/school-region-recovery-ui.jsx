import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import {useSchoolRegion} from '../../src/hooks/useSchoolRegion';
import ProgramVisibilityHelp from '../../src/components/student/components/ProgramVisibilityHelp';
import {programVisibilityDiagnostics} from '../../src/utils/programVisibilityDiagnostics';
import {refreshVisibleData} from '../../src/utils/dataRefresh';
const retryDelays=[100,200];let offline=true,reads=0,autoReads=0;const pending=new Map();
const resolve=async()=>{reads++;if(offline)throw Error('offline');return '강동';};
const autoResolve=async()=>{autoReads++;if(autoReads<3)throw Error('temporary');return '강동';};
const raceResolve=name=>new Promise(done=>pending.set(name,done));
let restReads=0;globalThis.fetch=async()=>{restReads++;return {ok:true,json:async()=>[{name:'해성국제컨벤션고',region:'강동'}]};};
const notice={id:157,title:'하나님의 마음을 담은 일주일 살기',category:'PROGRAM',is_recruiting:true,program_status:'ACTIVE'};
function Recovery(){const state=useSchoolRegion('해성국제컨벤션고등학교',{resolve,retryDelays});const shown=state.region==='강동';const info=programVisibilityDiagnostics({school:'해성국제컨벤션고등학교',notices:[notice],allPrograms:shown?[notice]:[],filteredPrograms:shown?[notice]:[],homePrograms:shown?[notice]:[],regionState:state,readState:{checkedAt:Date.now()},dashboardConfig:[{id:'programs',count:10,isVisible:true}]});return <section><h2>실패 후 복구</h2><p data-testid="recovery">{state.status} · {state.region||'미확인'} · {reads}회</p>{shown&&<h3>{notice.title}</h3>}<button onClick={()=>{offline=false;refreshVisibleData();}}>연결 복구 후 새로고침</button><button onClick={()=>{offline=true;state.retry();}}>다음 조회 실패</button><ProgramVisibilityHelp info={info} onRetry={state.retry}/></section>}
function Automatic(){const state=useSchoolRegion('학교',{resolve:autoResolve,retryDelays});return <section><h2>자동 재시도</h2><p data-testid="automatic">{state.status} · {state.region||'미확인'} · {autoReads}회</p></section>}
function Race(){const [name,setName]=useState('학교A');const state=useSchoolRegion(name,{resolve:raceResolve,retryDelays});return <section><h2>학교 변경 중 늦은 응답</h2><p data-testid="race">{name} · {state.status} · {state.region||'미확인'}</p><button onClick={()=>setName('학교B')}>학교 변경</button><button onClick={()=>pending.get('학교B')?.('강서')}>새 학교 응답</button><button onClick={()=>pending.get('학교A')?.('강동')}>이전 학교 응답</button></section>}
function Fallback(){const state=useSchoolRegion('해성국제컨벤션고등학교');return <section><h2>SDK 중단 후 직접 조회</h2><p data-testid="fallback">{state.status} · {state.region||'미확인'} · 직접 조회 {restReads}회</p></section>}
function App(){return <main style={{maxWidth:480,margin:'auto',padding:24}}><h1>격리된 복구 검증</h1><p>운영 서버에 요청하거나 기록하지 않습니다.</p><Recovery/><Automatic/><Race/><Fallback/></main>};createRoot(document.getElementById('root')).render(<App/>);
