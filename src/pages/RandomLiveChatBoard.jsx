import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useLiveCenterChat } from '../hooks/useLiveCenterChat';

const EDGE_GAP = 28;
const CARD_GAP = 18;

const normalizeCenter = (value = '') => {
    const center = value.toLowerCase().trim();
    if (['enough', '이높', '이높플레이스', 'gangseo', '강서'].includes(center)) return '이높플레이스';
    return '하이픈';
};

const hashText = (value = '') => {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
};

const createRandom = (seed) => {
    let state = seed || 1;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 4294967296;
    };
};

const overlapArea = (first, second) => {
    const width = Math.max(0, Math.min(first.x + first.width + CARD_GAP, second.x + second.width + CARD_GAP) - Math.max(first.x, second.x));
    const height = Math.max(0, Math.min(first.y + first.height + CARD_GAP, second.y + second.height + CARD_GAP) - Math.max(first.y, second.y));
    return width * height;
};

const palette = [
    'bg-white border-blue-200 text-slate-900 shadow-blue-900/10',
    'bg-amber-50 border-amber-200 text-amber-950 shadow-amber-900/10',
    'bg-emerald-50 border-emerald-200 text-emerald-950 shadow-emerald-900/10',
    'bg-violet-50 border-violet-200 text-violet-950 shadow-violet-900/10',
    'bg-rose-50 border-rose-200 text-rose-950 shadow-rose-900/10',
    'bg-sky-50 border-sky-200 text-sky-950 shadow-sky-900/10'
];

const RandomLiveChatBoard = () => {
    const { center: centerParam } = useParams();
    const [searchParams] = useSearchParams();
    const activeCenter = normalizeCenter(centerParam || searchParams.get('center') || '하이픈');
    const { messages, loading } = useLiveCenterChat(activeCenter, null);
    const visibleMessages = useMemo(() => messages.filter((message) => !message.is_hidden), [messages]);
    const stageRef = useRef(null);
    const cardRefs = useRef(new Map());
    const positionsRef = useRef(new Map());
    const [positions, setPositions] = useState({});
    const [stageRevision, setStageRevision] = useState(0);

    useEffect(() => {
        const stage = stageRef.current;
        if (!stage || typeof ResizeObserver === 'undefined') return undefined;
        const observer = new ResizeObserver(() => setStageRevision((value) => value + 1));
        observer.observe(stage);
        return () => observer.disconnect();
    }, []);

    useLayoutEffect(() => {
        const stage = stageRef.current;
        if (!stage || stage.clientWidth < 100 || stage.clientHeight < 100) return;

        const activeIds = new Set(visibleMessages.map((message) => String(message.id)));
        positionsRef.current.forEach((_, id) => {
            if (!activeIds.has(id)) positionsRef.current.delete(id);
        });

        const occupied = [...positionsRef.current.values()];
        let changed = false;

        visibleMessages.forEach((message) => {
            const id = String(message.id);
            if (positionsRef.current.has(id)) return;
            const element = cardRefs.current.get(id);
            if (!element) return;

            const width = Math.min(element.offsetWidth, Math.max(220, stage.clientWidth - EDGE_GAP * 2));
            const height = Math.min(element.offsetHeight, Math.max(120, stage.clientHeight - EDGE_GAP * 2));
            const maxX = Math.max(EDGE_GAP, stage.clientWidth - width - EDGE_GAP);
            const maxY = Math.max(EDGE_GAP, stage.clientHeight - height - EDGE_GAP);
            const random = createRandom(hashText(`${id}:${message.created_at || ''}`));
            let best = null;

            for (let attempt = 0; attempt < 180; attempt += 1) {
                const candidate = {
                    x: Math.round(EDGE_GAP + random() * Math.max(0, maxX - EDGE_GAP)),
                    y: Math.round(EDGE_GAP + random() * Math.max(0, maxY - EDGE_GAP)),
                    width,
                    height
                };
                const overlap = occupied.reduce((sum, placed) => sum + overlapArea(candidate, placed), 0);
                if (!best || overlap < best.overlap) best = { ...candidate, overlap };
                if (overlap === 0) break;
            }

            if (best) {
                const placed = { x: best.x, y: best.y, width, height };
                positionsRef.current.set(id, placed);
                occupied.push(placed);
                changed = true;
            }
        });

        if (changed || Object.keys(positions).some((id) => !activeIds.has(id))) {
            setPositions(Object.fromEntries(positionsRef.current));
        }
    }, [visibleMessages, stageRevision, positions]);

    return (
        <main
            ref={stageRef}
            className="relative h-screen w-screen overflow-hidden bg-[#f5f8ff] font-sans bg-[radial-gradient(circle_at_15%_15%,rgba(59,130,246,0.12),transparent_28%),radial-gradient(circle_at_82%_78%,rgba(139,92,246,0.11),transparent_30%),linear-gradient(135deg,#f8fbff_0%,#f7f5ff_100%)]"
            aria-label={`${activeCenter} 랜덤 라이브 채팅`}
        >
            <div className="pointer-events-none absolute inset-0 opacity-50 bg-[radial-gradient(rgba(100,116,139,0.2)_1px,transparent_1px)] bg-[size:28px_28px]" />

            {loading && visibleMessages.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-slate-400">
                    채팅을 불러오는 중...
                </div>
            )}

            {!loading && visibleMessages.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-slate-400">
                    <MessageCircle size={64} strokeWidth={1.7} />
                    <p className="text-2xl font-black">아직 도착한 메시지가 없어요</p>
                </div>
            )}

            {visibleMessages.map((message) => {
                const id = String(message.id);
                const position = positions[id];
                const color = palette[hashText(message.user_name || id) % palette.length];
                const reactions = Object.entries(message.reactions || {}).filter(([, users]) => Array.isArray(users) && users.length > 0);
                const time = message.created_at
                    ? new Date(message.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
                    : '';

                return (
                    <article
                        key={id}
                        ref={(node) => {
                            if (node) cardRefs.current.set(id, node);
                            else cardRefs.current.delete(id);
                        }}
                        className={`absolute max-w-[min(32rem,42vw)] min-w-[13rem] rounded-[26px] border-2 px-5 py-4 shadow-[0_16px_38px] ${color} ${position ? 'animate-[chat2-pop_420ms_cubic-bezier(.2,.8,.2,1)]' : 'invisible'}`}
                        style={position ? { left: position.x, top: position.y } : { left: EDGE_GAP, top: EDGE_GAP }}
                    >
                        <header className="mb-2 flex items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-black/10 bg-white/80 text-lg font-black">
                                {message.user_avatar
                                    ? <img src={message.user_avatar} alt="" className="h-full w-full object-cover" />
                                    : (message.user_name?.[0] || '익')}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <strong className="truncate text-lg font-black">{message.user_name || '익명'}</strong>
                                    {message.user_role === '스처쌤' && <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-black text-white">스처쌤</span>}
                                </div>
                                <time className="text-sm font-bold opacity-45">{time}</time>
                            </div>
                        </header>

                        {message.image_url && (
                            <img src={message.image_url} alt="채팅 첨부 이미지" className="mb-3 max-h-[36vh] w-full rounded-2xl border border-black/10 object-contain bg-white/50" />
                        )}
                        {message.message && (
                            <p className="whitespace-pre-wrap break-words text-[clamp(22px,1.65vw,30px)] font-extrabold leading-[1.38] tracking-[-0.02em]">
                                {message.message}
                            </p>
                        )}
                        {reactions.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {reactions.map(([emoji, users]) => (
                                    <span key={emoji} className="rounded-full border border-black/10 bg-white/75 px-3 py-1 text-lg font-black">
                                        {emoji} {users.length}
                                    </span>
                                ))}
                            </div>
                        )}
                    </article>
                );
            })}

            <style>{`
                @keyframes chat2-pop {
                    from { opacity: 0; transform: scale(.82) translateY(12px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
            `}</style>
        </main>
    );
};

export default RandomLiveChatBoard;
