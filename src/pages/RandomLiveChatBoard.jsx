import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, MessageCircle } from 'lucide-react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useLiveCenterChat } from '../hooks/useLiveCenterChat';

const PAGE_SIZE = 6;
const normalizeCenter = (value = '') => ['enough', '이높', '이높플레이스', 'gangseo', '강서'].includes(value.toLowerCase().trim()) ? '이높플레이스' : '하이픈';
const palette = [
    'bg-white border-blue-200 text-slate-900',
    'bg-amber-50 border-amber-200 text-amber-950',
    'bg-emerald-50 border-emerald-200 text-emerald-950',
    'bg-violet-50 border-violet-200 text-violet-950',
    'bg-rose-50 border-rose-200 text-rose-950',
    'bg-sky-50 border-sky-200 text-sky-950',
];
const hashText = (value = '') => [...value].reduce((hash, char) => (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0, 0);

const RandomLiveChatBoard = () => {
    const { center: centerParam } = useParams();
    const [searchParams] = useSearchParams();
    const activeCenter = normalizeCenter(centerParam || searchParams.get('center') || '하이픈');
    const { messages, loading, error } = useLiveCenterChat(activeCenter, null);
    const visibleMessages = useMemo(() => messages.filter(message => !message.is_hidden)
        .sort((a, b) => (Date.parse(a.created_at) || 0) - (Date.parse(b.created_at) || 0)
            || String(a.id).localeCompare(String(b.id), 'en', { numeric: true })), [messages]);
    const [page, setPage] = useState(1);
    const pageCount = Math.max(1, Math.ceil(visibleMessages.length / PAGE_SIZE));
    const currentPage = Math.min(page, pageCount);
    const listRef = useRef(null);
    const pageMessages = visibleMessages.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    useEffect(() => setPage(1), [activeCenter]);
    useEffect(() => setPage(value => Math.min(value, pageCount)), [pageCount]);
    const goToPage = value => {
        setPage(value);
        listRef.current?.scrollTo({ top: 0, behavior: 'instant' });
    };

    return (
        <main className="flex h-[100dvh] min-h-0 flex-col bg-[#f5f8ff] font-sans text-slate-900 selection:bg-blue-200" aria-label={`${activeCenter} 라이브 채팅`}>
            <header className="shrink-0 border-b border-slate-200 bg-white px-5 py-4 sm:px-8 sm:py-5">
                <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
                    <h1 className="text-xl font-black tracking-tight sm:text-2xl">{activeCenter} 라이브 채팅</h1>
                    <span className="shrink-0 text-sm font-medium text-slate-600">오늘 · {visibleMessages.length}개</span>
                </div>
            </header>
            <section ref={listRef} aria-label="시간순 메시지" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-8 sm:py-8">
                <div className="mx-auto max-w-6xl">
                    {loading && visibleMessages.length === 0 && <p role="status" className="py-16 text-center text-slate-600">채팅을 불러오는 중...</p>}
                    {error && <p role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-red-800">채팅을 불러오지 못했어요. 잠시 후 새로고침해 주세요.</p>}
                    {!loading && !error && visibleMessages.length === 0 && (
                        <div className="flex flex-col items-center gap-4 py-16 text-slate-600">
                            <MessageCircle size={48} strokeWidth={1.7} aria-hidden="true" />
                            <p className="text-lg font-bold">아직 도착한 메시지가 없어요</p>
                        </div>
                    )}
                    <ol className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3 sm:gap-5">
                        {pageMessages.map(message => {
                            const id = String(message.id);
                            const color = palette[hashText(message.user_name || id) % palette.length];
                            const reactions = Object.entries(message.reactions || {}).filter(([, users]) => Array.isArray(users) && users.length > 0);
                            const time = message.created_at ? new Date(message.created_at).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' }) : '';
                            return (
                                <li key={id} className="min-w-0">
                                    <article className={`min-w-0 rounded-2xl border p-5 ${color}`}>
                                        <header className="mb-4 flex items-center gap-3">
                                            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/80 text-lg font-bold">
                                                {message.user_avatar ? <img src={message.user_avatar} alt="" className="h-full w-full object-cover" /> : message.user_name?.[0] || '익'}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <strong className="break-words text-base font-bold [overflow-wrap:anywhere]">{message.user_name || '익명'}</strong>
                                                    {message.user_role === '스처쌤' && <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-bold text-white">스처쌤</span>}
                                                </div>
                                                <time dateTime={message.created_at} className="text-xs font-medium">{time}</time>
                                            </div>
                                        </header>
                                        {message.image_url && <img src={message.image_url} alt="채팅 첨부 이미지" loading="lazy" className="mb-4 max-h-[45dvh] w-full rounded-xl bg-white/60 object-contain" />}
                                        {message.message && <p className="whitespace-pre-wrap text-lg font-semibold leading-relaxed [overflow-wrap:anywhere]">{message.message}</p>}
                                        {reactions.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{reactions.map(([emoji, users]) => <span key={emoji} className="rounded-full bg-white/80 px-3 py-1 text-sm font-bold">{emoji} {users.length}</span>)}</div>}
                                    </article>
                                </li>
                            );
                        })}
                    </ol>
                </div>
            </section>
            <nav aria-label="메시지 페이지" className="shrink-0 border-t border-slate-200 bg-white px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-8">
                <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
                    <button type="button" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} className="flex min-h-11 items-center gap-1 rounded-xl px-3 font-bold text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-default disabled:text-slate-400 disabled:hover:bg-transparent"><ChevronLeft size={20} aria-hidden="true" />이전</button>
                    <p role="status" aria-live="polite" className="text-sm font-bold tabular-nums text-slate-700">{currentPage} / {pageCount} 페이지</p>
                    <button type="button" onClick={() => goToPage(currentPage + 1)} disabled={currentPage === pageCount} className="flex min-h-11 items-center gap-1 rounded-xl px-3 font-bold text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 disabled:cursor-default disabled:text-slate-400 disabled:hover:bg-transparent">다음<ChevronRight size={20} aria-hidden="true" /></button>
                </div>
            </nav>
        </main>
    );
};
export default RandomLiveChatBoard;
