// Local-only UI fixture. Every community mutation is stubbed; no production data is written.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/index.css';
import CommunityModal from '../../src/components/student/modals/CommunityModal';
import CommunitySettings from '../../src/features/programs/settings/CommunitySettings';
import HostSettings from '../../src/features/programs/settings/HostSettings';
import { ProgramSettingsGroup } from '../../src/features/programs/settings/ProgramSettingsLayout';
import { userApi } from '../../src/api/userApi';
import AdminCommunity from '../../src/components/admin/community/AdminCommunity';
import { communityChannelsApi } from '../../src/api/communityChannelsApi';
import { communityFeedApi } from '../../src/api/communityFeedApi';
import { challengeCommunityApi } from '../../src/api/challengeCommunityApi';
import { challengeMissionsApi } from '../../src/api/challengeMissionsApi';
import { supabase } from '../../src/supabaseClient';

const accessCase=new URLSearchParams(window.location.search).get('access') || 'applicant';
const user={id:'00000000-0000-4000-8000-000000000001',name:'검증 이용자',account_role:accessCase.startsWith('admin')?'admin':'member',school:'테스트 학교'};
const channel={id:'00000000-0000-4000-8000-000000000010',name:'프로그램 커뮤니티',status:'ACTIVE',source_notice_id:100,is_open_program:new URLSearchParams(window.location.search).get('screen')!=='challenge',participant_count:0};
const notice={id:100,title:'일반 프로그램',is_challenge:false,community_enabled:true};
let posts=[{id:'00000000-0000-4000-8000-000000000030',channel_id:channel.id,author_id:user.id,author:user,content:'프로그램이 끝난 뒤에도 여기서 사진과 후기를 나눌 수 있어요.',created_at:new Date().toISOString(),media:[{id:'photo',media_url:'/brand/center/welcome-poster-2.png'}],community_channel_comments:[],community_channel_reactions:[]}];
communityChannelsApi.fetchChannel=async()=>channel;
communityChannelsApi.fetchProgramChannel=async()=>channel;
communityChannelsApi.fetchPosts=async()=>posts;
communityChannelsApi.fetchMentionCandidates=async()=>[user];
communityChannelsApi.fetchChallengeAccess=async()=>['applicant','admin-applicant'].includes(accessCase);
communityChannelsApi.fetchChannels=async()=>[{...channel,post_count:posts.length,source_notice:{id:100,title:'일반 프로그램',is_challenge:false,challenge_format:'OFFLINE'}}];
communityChannelsApi.fetchMembers=async()=>[{user_id:user.id,user,source:'DIRECT',member_role:'MEMBER'}];
communityChannelsApi.fetchUsers=async()=>[user];
communityChannelsApi.fetchLinkablePrograms=async()=>[{id:100,title:'일반 프로그램'},{id:101,title:'일반 프로그램 둘째'}];
communityChannelsApi.fetchChallengeNotice=async()=>notice;
communityChannelsApi.linkToProgram=async()=>{};
communityChannelsApi.createPost=async({content})=>{const id=crypto.randomUUID();posts=[{...posts[0],id,content,media:[],created_at:new Date().toISOString()},...posts];return id;};
communityChannelsApi.editPost=async(post,authorId,content)=>{posts=posts.map(item=>item.id===post.id?{...item,content}:item);return {id:post.id,content};};
communityFeedApi.fetchReadAt=async()=>null;
communityFeedApi.markRead=async()=>{};
communityFeedApi.setAnnouncement=async()=>({});
challengeCommunityApi.isChallengeHost=async()=>false;
challengeCommunityApi.toggleReaction=async()=>true;
challengeCommunityApi.createComment=async()=>crypto.randomUUID();
challengeCommunityApi.deletePost=async id=>{posts=posts.filter(post=>post.id!==id);};
challengeMissionsApi.fetchSubmissions=async()=>[];
supabase.auth.getSession=async()=>({data:{session:{}}});
userApi.fetchStaff=async()=>[user];
const originalFrom=supabase.from.bind(supabase);
supabase.from=table=>table==='community_channel_directory'?{select(){return this;},neq(){return this;},order(){return Promise.resolve({data:[{...channel,source_notice_id:null}],error:null});}}:originalFrom(table);

function Preview(){
 const [screen,setScreen]=useState(new URLSearchParams(window.location.search).get('screen') || 'general');
 const [form,setForm]=useState({community_enabled:new URLSearchParams(window.location.search).get('enabled')==='1',community_channel_id:'',is_recruiting:false,enable_hosts:true,hosts:[{host_id:user.id,one_liner:''}]});
 const today=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
 const challenge={...notice,is_challenge:true,challenge_format:'ONLINE',program_start_date:today,program_end_date:today,challenge_missions:[{id:'mission',title:'오늘의 기록',schedule_type:'FLEXIBLE',target_count:1}]};
 return <div className="min-h-screen bg-slate-50 p-6">
  <nav className="flex flex-wrap gap-3 pb-6"><button onClick={()=>{channel.is_open_program=true;setScreen('general');}}>오픈 커뮤니티</button><button onClick={()=>{channel.is_open_program=false;setScreen('challenge');}}>챌린지 커뮤니티</button><button onClick={()=>setScreen('settings')}>프로그램 설정</button><button onClick={()=>setScreen('admin')}>커뮤니티 관리</button></nav>
  {screen==='admin'?<AdminCommunity/>:screen==='settings'?<section className="mx-auto max-w-5xl space-y-8 rounded-2xl bg-white p-4 sm:p-6">
   <h1 className="text-xl font-bold text-slate-900">프로그램 설정</h1>
   <ProgramSettingsGroup id="program-community" title="커뮤니티" description="프로그램 참여자가 함께 이야기를 나눌 공간을 설정합니다." optional active={form.community_enabled}>
    <CommunitySettings formData={form} updateField={(key,value)=>setForm(current=>({...current,[key]:value}))}/>
   </ProgramSettingsGroup>
   <div className="border-t border-slate-200 pt-6"><h2 className="text-lg font-black text-slate-900">고급 설정</h2><p className="mt-1 text-sm text-slate-500">필요한 기능만 펼쳐서 설정하세요. 사용 중인 기능은 자동으로 펼쳐집니다.</p></div>
   <ProgramSettingsGroup id="program-hosts" title="호스트(진행자)" description="센터와 스처 프로그램의 진행자를 지정합니다." optional active={form.enable_hosts}>
    <HostSettings formData={form} updateField={(key,value)=>setForm(current=>({...current,[key]:value}))}/>
   </ProgramSettingsGroup>
  </section>:<CommunityModal channel={channel} notice={screen==='challenge'?challenge:notice} user={user} manageHistory={false} onClose={()=>setScreen('settings')}/>}
 </div>;
}
createRoot(document.getElementById('root')).render(<Preview/>);
