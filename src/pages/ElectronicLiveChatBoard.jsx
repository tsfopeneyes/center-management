import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useLiveCenterChat } from '../hooks/useLiveCenterChat';

const EDGE_GAP = 28;
const CARD_GAP = 18;
const MIN_MESSAGE_FONT_SIZE = 18;

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

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const findOpenPosition = (preferred, width, height, occupied, stageWidth, stageHeight) => {
    const maxX = Math.max(EDGE_GAP, stageWidth - width - EDGE_GAP);
    const maxY = Math.max(EDGE_GAP, stageHeight - height - EDGE_GAP);
    const candidateAt = (x, y) => ({
        x: Math.round(clamp(x, EDGE_GAP, maxX)),
        y: Math.round(clamp(y, EDGE_GAP, maxY)),
        width,
        height
    });
    const isOpen = (candidate) => occupied.every((placed) => overlapArea(candidate, placed) === 0);
    const origin = candidateAt(preferred.x, preferred.y);
    if (isOpen(origin)) return origin;

    // Search outwards from the old position, like a bubble pushed by its neighbor.
    const step = 24;
    const directions = 24;
    const maxRadius = Math.ceil(Math.hypot(stageWidth, stageHeight) / step) * step;
    for (let radius = step; radius <= maxRadius; radius += step) {
        for (let direction = 0; direction < directions; direction += 1) {
            const angle = (direction / directions) * Math.PI * 2;
            const candidate = candidateAt(
                preferred.x + Math.cos(angle) * radius,
                preferred.y + Math.sin(angle) * radius
            );
            if (isOpen(candidate)) return candidate;
        }
    }

    // A dense board may have narrow gaps that the radial search misses.
    for (let y = EDGE_GAP; y <= maxY; y += 18) {
        for (let x = EDGE_GAP; x <= maxX; x += 18) {
            const candidate = candidateAt(x, y);
            if (isOpen(candidate)) return candidate;
        }
    }
    return null;
};

const palette = [
    'bg-white border-blue-200 text-slate-900 shadow-blue-900/10',
    'bg-amber-50 border-amber-200 text-amber-950 shadow-amber-900/10',
    'bg-emerald-50 border-emerald-200 text-emerald-950 shadow-emerald-900/10',
    'bg-violet-50 border-violet-200 text-violet-950 shadow-violet-900/10',
    'bg-rose-50 border-rose-200 text-rose-950 shadow-rose-900/10',
    'bg-sky-50 border-sky-200 text-sky-950 shadow-sky-900/10'
];

const ElectronicLiveChatBoard = () => {
    const { center: centerParam } = useParams();
    const [searchParams] = useSearchParams();
    const activeCenter = normalizeCenter(centerParam || searchParams.get('center') || '하이픈');
    const { messages, loading } = useLiveCenterChat(activeCenter, null);
    const visibleMessages = useMemo(() => messages.filter((message) => !message.is_hidden), [messages]);
    const stageRef = useRef(null);
    const cardRefs = useRef(new Map());
    const positionsRef = useRef(new Map());
    const resetFontRef = useRef(false);
    const [positions, setPositions] = useState({});
    const [stageRevision, setStageRevision] = useState(0);
    const [viewportRevision, setViewportRevision] = useState(0);
    const boardWidth = stageRef.current?.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 1920);
    const baseFontSize = Math.round(Math.max(96, Math.min(136, Math.round(boardWidth * 0.072))) / 3);
    const [messageFontSize, setMessageFontSize] = useState(baseFontSize);
    const maxBubbleWidth = Math.max(220, Math.min(1100, Math.round(boardWidth * 0.7), boardWidth - EDGE_GAP * 2));

    // Reclaim readable size when messages disappear or the board changes size.
    useLayoutEffect(() => {
        resetFontRef.current = true;
        setMessageFontSize(baseFontSize);
    }, [baseFontSize, visibleMessages, viewportRevision]);

    useEffect(() => {
        const stage = stageRef.current;
        if (!stage) return undefined;

        let observer = null;
        let lastWidth = stage.clientWidth;
        let lastHeight = stage.clientHeight;
        const refreshStage = () => {
            const nextWidth = stage.clientWidth;
            const nextHeight = stage.clientHeight;
            if (nextWidth === lastWidth && nextHeight === lastHeight) return;
            lastWidth = nextWidth;
            lastHeight = nextHeight;
            positionsRef.current.clear();
            setPositions({});
            setViewportRevision((value) => value + 1);
            setStageRevision((value) => value + 1);
        };

        window.addEventListener('resize', refreshStage);
        window.addEventListener('orientationchange', refreshStage);

        // ResizeObserver is missing on a number of Samsung signage/Tizen browsers.
        // Window events and the short polling fallback keep the board usable there.
        if (typeof window.ResizeObserver === 'function') {
            observer = new window.ResizeObserver(refreshStage);
            observer.observe(stage);
        }
        const sizeTimer = window.setInterval(() => {
            refreshStage();
            // Images and fonts can change a card's size after the first layout.
            const cardResized = [...positionsRef.current].some(([id, position]) => {
                const card = cardRefs.current.get(id);
                return card && (card.offsetWidth !== position.width || card.offsetHeight !== position.height);
            });
            if (cardResized) setStageRevision((value) => value + 1);
        }, 1500);

        return () => {
            window.removeEventListener('resize', refreshStage);
            window.removeEventListener('orientationchange', refreshStage);
            if (observer) observer.disconnect();
            window.clearInterval(sizeTimer);
        };
    }, []);

    useLayoutEffect(() => {
        const stage = stageRef.current;
        if (!stage || stage.clientWidth < 100 || stage.clientHeight < 100) return;
        if (resetFontRef.current) {
            if (messageFontSize !== baseFontSize) return;
            resetFontRef.current = false;
        }

        const measured = visibleMessages.map((message) => {
            const id = String(message.id);
            const element = cardRefs.current.get(id);
            if (!element) return null;
            return {
                id,
                message,
                width: Math.min(element.offsetWidth, stage.clientWidth - EDGE_GAP * 2),
                height: Math.min(element.offsetHeight, stage.clientHeight - EDGE_GAP * 2),
                previous: positionsRef.current.get(id)
            };
        }).filter(Boolean);

        // Keep the newest message visible even when the board reaches its minimum scale.
        // Otherwise an incoming message could remain invisible behind older cards.
        const messageOrder = new Map(visibleMessages.map((message, index) => [String(message.id), index]));
        measured.sort((first, second) => {
            if (Boolean(first.previous) !== Boolean(second.previous)) return first.previous ? 1 : -1;
            const firstResized = Boolean(first.previous && (first.previous.width !== first.width || first.previous.height !== first.height));
            const secondResized = Boolean(second.previous && (second.previous.width !== second.width || second.previous.height !== second.height));
            if (firstResized !== secondResized) return firstResized ? -1 : 1;
            return messageOrder.get(second.id) - messageOrder.get(first.id);
        });

        const occupied = [];
        const nextPositions = new Map();
        measured.forEach(({ id, message, width, height, previous }) => {
            const random = createRandom(hashText(`${id}:${message.created_at || ''}`));
            const preferred = previous || {
                x: EDGE_GAP + random() * Math.max(0, stage.clientWidth - width - EDGE_GAP * 2),
                y: EDGE_GAP + random() * Math.max(0, stage.clientHeight - height - EDGE_GAP * 2)
            };
            const placed = findOpenPosition(preferred, width, height, occupied, stage.clientWidth, stage.clientHeight);
            if (placed) {
                nextPositions.set(id, placed);
                occupied.push(placed);
            }
        });

        if (nextPositions.size < measured.length && messageFontSize > MIN_MESSAGE_FONT_SIZE) {
            setMessageFontSize((size) => Math.max(MIN_MESSAGE_FONT_SIZE, size - 3));
            return;
        }

        const layoutChanged = nextPositions.size !== positionsRef.current.size ||
            [...nextPositions].some(([id, position]) => {
                const previous = positionsRef.current.get(id);
                return !previous || previous.x !== position.x || previous.y !== position.y ||
                    previous.width !== position.width || previous.height !== position.height;
            });
        if (layoutChanged) {
            positionsRef.current = nextPositions;
            setPositions(Object.fromEntries(nextPositions));
        }
    }, [visibleMessages, stageRevision, messageFontSize, baseFontSize]);

    return (
        <main
            ref={stageRef}
            className="fixed inset-0 overflow-hidden bg-[#f5f8ff] font-sans bg-[radial-gradient(circle_at_15%_15%,rgba(59,130,246,0.12),transparent_28%),radial-gradient(circle_at_82%_78%,rgba(139,92,246,0.11),transparent_30%),linear-gradient(135deg,#f8fbff_0%,#f7f5ff_100%)]"
            aria-label={`${activeCenter} 전자칠판 라이브 채팅`}
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
                return (
                    <article
                        key={id}
                        ref={(node) => {
                            if (node) cardRefs.current.set(id, node);
                            else cardRefs.current.delete(id);
                        }}
                        className={`absolute max-h-[calc(100vh-56px)] overflow-auto rounded-[26px] border-2 shadow-[0_16px_38px] transition-[left,top] duration-500 ease-[cubic-bezier(.2,1.35,.35,1)] ${color} ${position ? 'animate-[chat3-pop_420ms_cubic-bezier(.2,.8,.2,1)]' : 'invisible'}`}
                        style={{
                            left: position?.x ?? EDGE_GAP,
                            top: position?.y ?? EDGE_GAP,
                            width: 'auto',
                            maxWidth: `${maxBubbleWidth}px`,
                            padding: `${Math.max(10, Math.round(messageFontSize * 0.44))}px ${Math.max(12, Math.round(messageFontSize * 0.53))}px`
                        }}
                    >
                        {message.image_url && (
                            <img src={message.image_url} alt="채팅 첨부 이미지" className="mb-3 max-h-[38vh] w-full rounded-2xl border border-black/10 object-contain bg-white/50" />
                        )}
                        {message.message && (
                            <p
                                className="whitespace-pre-wrap break-words font-extrabold leading-[1.2] tracking-[-0.02em]"
                                style={{ fontSize: `${messageFontSize}px`, lineHeight: 1.2 }}
                            >
                                {message.message}
                            </p>
                        )}
                        {reactions.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {reactions.map(([emoji, users]) => (
                                    <span key={emoji} className="rounded-full border border-black/10 bg-white/75 px-3 py-1 font-black" style={{ fontSize: `${Math.max(12, Math.round(messageFontSize * 0.44))}px` }}>
                                        {emoji} {users.length}
                                    </span>
                                ))}
                            </div>
                        )}
                    </article>
                );
            })}

            <style>{`
                @keyframes chat3-pop {
                    from { opacity: 0; transform: scale(.82) translateY(12px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
                @media (prefers-reduced-motion: reduce) {
                    [class*="chat3-pop"] { animation: none !important; transition: none !important; }
                }
            `}</style>
        </main>
    );
};

export default ElectronicLiveChatBoard;
