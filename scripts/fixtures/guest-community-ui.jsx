// UI-only fixture. Verification and all writes are stubbed.
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import '../../src/index.css';
import GuestCommunityIdentityForm from '../../src/components/student/GuestCommunityIdentityForm';
import {guestCommunityApi} from '../../src/api/guestCommunityApi';
guestCommunityApi.verify=async(id,input)=>{
    if(input.pin!=='1001')throw Error('이름 또는 비밀번호가 일치하지 않거나 신청이 확정되지 않았어요.');
    return {user:{name:input.name}};
};
function Preview(){const [verified,setVerified]=useState(null);
    return <main className="flex min-h-screen items-center justify-center bg-[#F7EFE2] p-4"><section className="w-full max-w-lg rounded-2xl border border-[#E7D8C4] bg-[#FFFDF9] p-6">
        <h1 className="text-2xl font-black text-[#302A25]">일반 프로그램 커뮤니티</h1>
        <p className="mt-4 text-sm text-[#71665C]">프로그램 참여자와 직접 추가된 멤버가 함께하는 커뮤니티입니다.</p>
        {verified?<p role="status" className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800">{verified.user.name} 님, 게스트 로그인 완료</p>:
        <GuestCommunityIdentityForm channelId="test" onVerified={setVerified} onCancel={()=>{}}/>}
    </section></main>;
}createRoot(document.getElementById('root')).render(<Preview/>);
