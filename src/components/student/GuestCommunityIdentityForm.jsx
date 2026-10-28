import React,{useState} from 'react';
import {guestCommunityApi} from '../../api/guestCommunityApi';

export default function GuestCommunityIdentityForm({channelId,onVerified,onCancel}){
    const [identity,setIdentity]=useState({name:'',pin:''});
    const [pending,setPending]=useState(false),[error,setError]=useState('');
    const change=field=>event=>setIdentity(current=>({...current,[field]:event.target.value}));
    const submit=async event=>{
        event.preventDefault();if(pending)return;setPending(true);setError('');
        try{onVerified(await guestCommunityApi.verify(channelId,identity));}
        catch(failure){setError(failure.message);}finally{setPending(false);}
    };
    return <form onSubmit={submit} className="mt-6 space-y-4 border-t border-[#E7D8C4] pt-5">
        <div><h2 className="text-base font-bold text-[#302A25]">게스트 로그인</h2><p className="mt-2 text-sm leading-6 text-[#71665C]">신청한 이름과 휴대폰 번호 뒤 4자리를 입력해주세요. 신청이 확정된 게스트는 회원가입 없이 이용할 수 있어요.</p></div>
        {[{field:'name',label:'이름',type:'text',placeholder:'신청한 이름'},
            {field:'pin',label:'비밀번호',type:'password',placeholder:'신청한 휴대폰 번호 뒤 4자리'}].map(({field,label,type,placeholder})=><label key={field} className="block text-sm font-semibold text-[#302A25]">{label}
            <input type={type} required autoComplete={field==='name'?'name':'off'}
                inputMode={field==='name'?'text':'numeric'} maxLength={field==='pin'?4:100} pattern={field==='pin'?'[0-9]{4}':undefined}
                value={identity[field]} onChange={change(field)} placeholder={placeholder}
                className="mt-2 h-12 w-full rounded-xl border border-[#E7D8C4] bg-white px-3 text-base font-normal outline-none focus:border-[#CF3A27] focus:ring-2 focus:ring-[#CF3A27]/10"/>
        </label>)}
        {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm leading-6 text-red-700">{error}</p>}
        <button type="submit" disabled={pending} className="h-12 w-full rounded-xl bg-[#CF3A27] font-bold text-white hover:bg-[#B93223] disabled:opacity-50">{pending?'로그인 중...':'로그인하고 커뮤니티 입장'}</button>
        <button type="button" onClick={onCancel} disabled={pending} className="w-full py-2 text-sm font-semibold text-[#71665C]">취소</button>
    </form>;
}
