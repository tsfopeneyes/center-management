import React, { useEffect, useId, useState } from 'react';
import { ChevronDown, ChevronUp, Link2, MessageSquare, ToggleLeft, ToggleRight } from 'lucide-react';
import { supabase } from '../../../supabaseClient';

export default function CommunitySettings({ formData, updateField }) {
    const isEnabled = formData.community_enabled === true;
    const contentId = useId();
    const [channels, setChannels] = useState([]);
    const [error, setError] = useState('');
    useEffect(() => {
        let active = true;
        supabase.from('community_channel_directory').select('id,name,source_notice_id,status').neq('status', 'ARCHIVED').order('name')
            .then(({ data, error: failure }) => {
                if (!active) return;
                setError(failure ? '커뮤니티 목록을 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.' : '');
                setChannels((data || []).filter(channel => !channel.source_notice_id || channel.id === formData.community_channel_id));
            });
        return () => { active = false; };
    }, [formData.community_channel_id]);
    return <div className={`overflow-hidden rounded-2xl border bg-white transition-colors ${isEnabled ? 'border-blue-300' : 'border-slate-200/80 hover:border-slate-300'}`}>
        <button type="button" role="switch" aria-checked={isEnabled} aria-controls={contentId}
            aria-label="커뮤니티 사용" aria-describedby={`${contentId}-description`}
            onClick={() => updateField('community_enabled', !isEnabled)}
            className="flex w-full items-center justify-between gap-3 bg-white p-4 text-left transition-colors hover:bg-slate-50/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600 sm:p-5">
            <span className="flex min-w-0 items-center gap-3">
                <span className={`shrink-0 rounded-xl p-2.5 ${isEnabled ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                    <MessageSquare size={18} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-800">커뮤니티 사용</span>
                        <span className={`rounded-md border px-2.5 py-0.5 text-[11px] font-extrabold ${isEnabled ? 'border-blue-200/60 bg-blue-50 text-blue-600' : 'border-slate-200/60 bg-slate-100 text-slate-600'}`}>{isEnabled ? '사용 중' : '미사용'}</span>
                    </span>
                    <span id={`${contentId}-description`} className="mt-1 block text-xs leading-relaxed text-slate-600">글·사진·댓글·반응을 함께 나눕니다.</span>
                </span>
            </span>
            <span className="flex shrink-0 items-center gap-2 sm:gap-3" aria-hidden="true">
                {isEnabled ? <ToggleRight size={28} className="text-blue-600" /> : <ToggleLeft size={28} className="text-slate-500" />}
                {isEnabled ? <ChevronUp size={18} className="text-slate-500" /> : <ChevronDown size={18} className="text-slate-500" />}
            </span>
        </button>
        {isEnabled && <div id={contentId} className="space-y-4 border-t border-slate-100 bg-slate-50/40 p-4 sm:p-5">
            <label className="block text-xs font-bold text-slate-600">
                연결할 커뮤니티
                <span className="relative mt-2 flex h-11 items-center rounded-xl border border-slate-200/60 bg-slate-50 transition-colors focus-within:border-blue-600 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100">
                    <Link2 size={14} aria-hidden="true" className="pointer-events-none absolute left-3 text-slate-500" />
                    <select value={formData.community_channel_id || ''} onChange={event => updateField('community_channel_id', event.target.value)}
                        className="h-full w-full min-w-0 rounded-xl bg-transparent pl-9 pr-3 text-sm font-semibold text-slate-800 outline-none">
                        <option value="">프로그램 이름으로 새 커뮤니티 자동 생성</option>
                        {channels.map(channel => <option key={channel.id} value={channel.id}>{channel.name}</option>)}
                    </select>
                </span>
            </label>
            {error && <p role="alert" className="text-xs leading-relaxed text-red-700">{error}</p>}
            <div className="space-y-2 border-t border-slate-200/60 pt-4 text-xs leading-relaxed text-slate-600">
                <p>{formData.is_recruiting || formData.is_challenge
                    ? '프로그램 참여자와 직접 추가한 멤버가 함께합니다. 모집 시작 전에는 운영 예정이며, 모집이 시작되면 자동으로 열립니다.'
                    : '로그인한 이용자는 가입 명단 없이 누구나 바로 들어가 글을 남길 수 있습니다.'}</p>
                <p>프로그램이 끝나도 커뮤니티는 직접 종료하기 전까지 계속 열려 있습니다.</p>
                {formData.is_challenge && formData.challenge_format === 'ONLINE' && <p>미션은 챌린지 미션 설정에서 추가합니다. 자유 글과 미션 인증을 함께 사용할 수 있습니다.</p>}
            </div>
        </div>}
    </div>;
}
