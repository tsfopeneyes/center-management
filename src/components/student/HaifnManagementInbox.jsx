import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Loader2, Send } from 'lucide-react';
import { haifnManagementApi } from '../../api/haifnManagementApi';

const statusLabel = { OPEN: '답변 필요', IN_PROGRESS: '응대 중', DONE: '완료' };
const formatTime = value => value ? new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit',
}).format(new Date(value)) : '';
const dateKey = value => new Date(value).toLocaleDateString('ko-KR');
const formatDate = value => new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
}).format(new Date(value));
const formatMessageTime = value => new Intl.DateTimeFormat('ko-KR', {
    hour: 'numeric', minute: '2-digit',
}).format(new Date(value));

export default function HaifnManagementInbox({ currentUser, onPendingChange }) {
    const [available, setAvailable] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [messages, setMessages] = useState([]);
    const [names, setNames] = useState({});
    const [selectedId, setSelectedId] = useState(null);
    const [draft, setDraft] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState('OPEN');
    const selected = sessions.find(session => session.id === selectedId);
    const messageListRef = useRef(null);

    useLayoutEffect(() => {
        const list = messageListRef.current;
        if (!list) return;
        list.scrollTop = list.scrollHeight;
        const frame = requestAnimationFrame(() => { list.scrollTop = list.scrollHeight; });
        return () => cancelAnimationFrame(frame);
    }, [selected?.id, messages.length, messages.at(-1)?.id]);

    useEffect(() => {
        const list = messageListRef.current;
        if (!list) return;
        const observer = new ResizeObserver(() => { list.scrollTop = list.scrollHeight; });
        observer.observe(list);
        return () => observer.disconnect();
    }, [selected?.id]);

    const refresh = useCallback(async () => {
        try {
            const next = await haifnManagementApi.listSessions();
            setSessions(next);
            if (selectedId) {
                const nextMessages = await haifnManagementApi.listMessages(selectedId);
                setMessages(nextMessages);
                await haifnManagementApi.markRead(currentUser.id, nextMessages);
            }
            onPendingChange?.(await haifnManagementApi.pendingCount(currentUser.id));
            setError('');
        } catch (cause) {
            setError(['42P01', 'PGRST205'].includes(cause?.code)
                ? '관리 DM 저장 구조가 아직 적용되지 않았습니다.'
                : '문의 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
        }
    }, [currentUser.id, onPendingChange, selectedId]);

    useEffect(() => {
        let active = true;
        haifnManagementApi.isOperator(currentUser.id)
            .then(async allowed => {
                if (!active) return;
                setAvailable(allowed);
                if (allowed) setNames(await haifnManagementApi.operatorNames());
            })
            .catch(() => { if (active) setAvailable(false); });
        return () => { active = false; };
    }, [currentUser.id]);

    useEffect(() => {
        if (!available) return undefined;
        void refresh();
        const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 5000);
        return () => window.clearInterval(timer);
    }, [available, refresh]);

    const filtered = useMemo(() => sessions.filter(session => filter === 'FILTERED' ? session.moderation === 'FILTERED' : session.moderation !== 'FILTERED' && (filter === 'ALL' || session.status === filter)), [sessions, filter]);
    const perform = async action => {
        if (!selected || busy) return;
        setBusy(true); setError('');
        try { await action(); await refresh(); }
        catch { setError('처리하지 못했습니다. 다시 시도해 주세요.'); }
        finally { setBusy(false); }
    };
    const send = event => {
        event.preventDefault();
        const body = draft.trim();
        if (!body) return;
        void perform(async () => { await haifnManagementApi.reply(selectedId, currentUser.id, body); setDraft(''); });
    };

    if (available === null) return <div className="flex flex-1 items-center justify-center"><Loader2 className="animate-spin text-[#CF3A27]" /></div>;
    if (!available) return <div className="p-6 text-sm text-[#71665C]">관리 DM은 지정된 운영자만 볼 수 있습니다. 운영 DB 연결 전이라면 적용 후 표시됩니다.</div>;

    if (selected) return <div className="flex min-h-0 flex-1 flex-col bg-[#F8F4EE]">
        <div className="flex min-h-[77px] items-center gap-3 border-b border-[#B92F20] bg-[#CF3A27] px-5 py-4 text-white">
            <button type="button" onClick={() => setSelectedId(null)} aria-label="문의 목록으로" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white"><ArrowLeft size={20} /></button>
            <div className="min-w-0 flex-1"><h2 className="truncate text-xl font-black tracking-tight">방문자 문의</h2><p className="mt-0.5 text-xs font-semibold text-white/70">{statusLabel[selected.status]}{selected.assigned_to ? ` · 담당 ${names[selected.assigned_to] || '운영자'}` : ''}</p></div>
        </div>
        <div ref={messageListRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {messages.map((message, index) => {
                const isStaff = message.sender === 'STAFF';
                const mine = isStaff && message.sender_id === currentUser.id;
                const senderName = message.sender === 'VISITOR' ? '방문자' : names[message.sender_id] || '운영자';
                const showDate = !index || dateKey(messages[index - 1].created_at) !== dateKey(message.created_at);
                return <React.Fragment key={message.id}>
                    {showDate && <div className="my-3 flex justify-center"><span className="rounded-full bg-[#EDE5DC] px-3 py-1 text-[11px] font-bold text-[#8B7B70]">{formatDate(message.created_at)}</span></div>}
                    <div className={`mt-2.5 flex w-full items-end gap-1.5 ${isStaff ? 'justify-end' : 'justify-start'}`}>
                        {!isStaff && <span className="max-w-12 shrink-0 self-end truncate pb-1 text-[10.5px] font-bold text-[#7E7065]">{senderName}</span>}
                        {isStaff && <span className="mb-0.5 shrink-0 whitespace-nowrap text-[9.5px] text-[#A99C91]">{formatMessageTime(message.created_at)}</span>}
                        <div className={`min-w-0 max-w-[72%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-left text-sm leading-5 shadow-sm ${mine ? 'rounded-br-md bg-[#D93625] text-white' : isStaff ? 'rounded-br-md bg-[#DCEDE8] text-[#284C44]' : 'rounded-bl-md border border-[#EEE6DE] bg-white text-[#40352E]'}`}>{message.body}</div>
                        {!isStaff && <span className="mb-0.5 shrink-0 whitespace-nowrap text-[9.5px] text-[#A99C91]">{formatMessageTime(message.created_at)}</span>}
                        {isStaff && <span className="max-w-12 shrink-0 self-end truncate pb-1 text-[10.5px] font-bold text-[#7E7065]">{senderName}</span>}
                    </div>
                </React.Fragment>;
            })}
        </div>
        {error && <p role="alert" className="px-4 text-xs font-bold text-red-700">{error}</p>}
        <div className="flex flex-wrap gap-2 px-4 pb-2">
            {selected.moderation === 'FILTERED' && <><p className="w-full text-xs text-[#A82920]">필터링된 대화 · {selected.moderation_reason || '운영자 검토'}</p><button type="button" disabled={busy} onClick={() => void perform(() => haifnManagementApi.setModeration(selectedId, 'NORMAL'))} className="rounded-full border border-[#E7D8C4] px-3 py-2 text-xs font-bold">일반 문의로 이동</button></>}
            {selected.status !== 'DONE' && <button type="button" disabled={busy} onClick={() => void perform(() => haifnManagementApi.setStatus(selectedId, 'DONE', selected.assigned_to || currentUser.id))} className="rounded-full border border-[#E7D8C4] px-3 py-2 text-xs font-bold text-[#71665C]">응대 완료</button>}
            {selected.status === 'DONE' && <button type="button" disabled={busy} onClick={() => void perform(() => haifnManagementApi.setStatus(selectedId, 'OPEN', null))} className="rounded-full border border-[#E7D8C4] px-3 py-2 text-xs font-bold text-[#71665C]">다시 열기</button>}
            {selected.assigned_to !== currentUser.id && <button type="button" disabled={busy} onClick={() => void perform(() => haifnManagementApi.setStatus(selectedId, 'IN_PROGRESS', currentUser.id))} className="rounded-full border border-[#E7D8C4] px-3 py-2 text-xs font-bold text-[#71665C]">내가 응대</button>}
        </div>
        <form onSubmit={send} className="flex gap-2 border-t border-[#E7D8C4] bg-[#FFFDF9] p-3 pb-[max(12px,env(safe-area-inset-bottom))]"><input value={draft} onChange={event => setDraft(event.target.value)} maxLength={1000} placeholder="방문자에게 답장" aria-label="방문자에게 답장" className="min-w-0 flex-1 rounded-2xl bg-[#F2ECE5] px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#CF3A27]/20" /><button type="submit" disabled={busy || !draft.trim()} className="rounded-2xl bg-[#CF3A27] p-3 text-white disabled:bg-[#D7CCC3]" aria-label="답장 보내기"><Send size={20} /></button></form>
    </div>;

    return <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mb-4 flex flex-wrap gap-2">{[['OPEN', '답변 필요'], ['IN_PROGRESS', '응대 중'], ['DONE', '완료'], ['ALL', '전체'], ['FILTERED', '필터링된 대화']].map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-full px-3 py-2 text-xs font-bold ${filter === value ? 'bg-[#CF3A27] text-white' : 'bg-[#F3EEE8] text-[#71665C]'}`}>{label}</button>)}</div>
        {error && <p role="alert" className="mb-3 text-xs font-bold text-red-700">{error}</p>}
        {!filtered.length && <p className="py-12 text-center text-sm text-[#71665C]">{filter === 'OPEN' ? '답변을 기다리는 문의가 없어요.' : '해당하는 문의가 없어요.'}</p>}
        {filtered.map(session => <button key={session.id} type="button" onClick={() => { setSelectedId(session.id); setMessages([]); }} className="mb-2 w-full rounded-2xl bg-white p-4 text-left shadow-[0_2px_12px_rgba(80,52,35,0.06)]">
            <span className="flex items-center justify-between text-xs"><strong className="text-[#CF3A27]">{statusLabel[session.status]}</strong><span className="text-[#A3958A]">{formatTime(session.updated_at)}</span></span>
            <p className="mt-2 line-clamp-2 text-sm font-bold text-[#332821]">{session.lastMessage?.body || '방문자 문의'}</p>
            <span className="mt-1 block text-xs text-[#71665C]">{session.assigned_to ? `담당 ${names[session.assigned_to] || '운영자'}` : '담당자 없음'} · 웹 채팅</span>
        </button>)}
    </div>;
}
