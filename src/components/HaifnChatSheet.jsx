import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, Send } from 'lucide-react';
import { useBodyScrollLock } from '../hooks/useModalClose';
import { supabase } from '../supabaseClient';

const storageKey = 'haifn-chat-token-v1';
let browserToken;
function getToken() {
    let token = browserToken;
    try { token = localStorage.getItem(storageKey) || token; } catch { /* Restricted browsers can still chat during this visit. */ }
    if (!token || !/^[a-f0-9]{64}$/.test(token)) {
        token = Array.from(crypto.getRandomValues(new Uint8Array(32)), value => value.toString(16).padStart(2, '0')).join('');
        try { localStorage.setItem(storageKey, token); } catch { /* Keep the token in memory when storage is unavailable. */ }
    }
    browserToken = token;
    return token;
}

export default function HaifnChatSheet({ onClose }) {
    useBodyScrollLock(true);
    const [messages, setMessages] = useState([]);
    const [draft, setDraft] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [ready, setReady] = useState(false);
    const listRef = useRef(null);
    const tokenRef = useRef(null);
    const [viewport, setViewport] = useState(() => ({
        height: window.visualViewport?.height || window.innerHeight,
        top: window.visualViewport?.offsetTop || 0,
    }));
    useEffect(() => {
        const visual = window.visualViewport;
        let frame;
        const update = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                setViewport({ height: visual?.height || window.innerHeight, top: visual?.offsetTop || 0 });
            });
        };
        visual?.addEventListener('resize', update);
        visual?.addEventListener('scroll', update);
        window.addEventListener('resize', update);
        update();
        return () => {
            cancelAnimationFrame(frame);
            visual?.removeEventListener('resize', update);
            visual?.removeEventListener('scroll', update);
            window.removeEventListener('resize', update);
        };
    }, []);
    const request = async (action, extra = {}) => {
        const { data, error: invokeError } = await supabase.functions.invoke('haifn-chat', {
            body: { action, token: tokenRef.current, ...extra },
        });
        if (invokeError || data?.error) throw new Error('chat unavailable');
        return data;
    };
    useEffect(() => {
        tokenRef.current = getToken();
        setReady(true);
        let mounted = true;
        const load = async () => {
            try {
                const data = await request('history');
                if (mounted) { setMessages(data.messages || []); setError(''); }
            } catch {
                if (mounted) setError('지금은 채팅을 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.');
            }
        };
        void load();
        const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 4000);
        const keydown = event => { if (event.key === 'Escape') onClose(); };
        window.addEventListener('keydown', keydown);
        return () => { mounted = false; window.clearInterval(timer); window.removeEventListener('keydown', keydown); };
    }, [onClose]);
    useLayoutEffect(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'instant' });
    }, [messages.length, messages.at(-1)?.id, viewport.height, ready, error]);
    const send = async event => {
        event.preventDefault();
        const body = draft.trim();
        if (!body || busy) return;
        setBusy(true); setError('');
        try {
            const data = await request('send', { body });
            setMessages(data.messages || []); setDraft('');
        } catch { setError('메시지를 보내지 못했습니다. 다시 시도해 주세요.'); }
        finally { setBusy(false); }
    };
    return <div className="hi-sheet-backdrop" style={{ '--chat-visible-height': `${viewport.height}px`, '--chat-visible-top': `${viewport.top}px` }} onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
        <section className="hi-chat-window" role="dialog" aria-modal="true" aria-labelledby="hi-chat-title">
            <header className="hi-chat-header">
                <button type="button" onClick={onClose} aria-label="채팅 닫기"><ArrowLeft size={22} /></button>
                <div><h2 id="hi-chat-title">하이픈 상담톡</h2><p>궁금한 점을 편하게 물어보세요</p></div>
            </header>
            <div ref={listRef} className="hi-chat-messages" role="log" aria-live="polite">
                <div className="hi-chat-notice"><strong>안녕하세요! 무엇이 궁금한가요?</strong><p>평일 오전 10시~오후 6시에 답변드려요.<br />그 외 시간에는 답변이 늦어질 수 있어요.</p><details className="hi-chat-guidelines"><summary>채팅 이용 안내</summary><p>서로를 존중하는 대화를 부탁드려요.<br />욕설·외설적인 메시지는 답변이 제한될 수 있으며, 협박·반복적인 괴롭힘은 기록을 바탕으로 신고 등 필요한 조치를 취할 수 있습니다.</p></details></div>
                {messages.map(message => <div key={message.id} className={`hi-chat-bubble ${message.sender === 'VISITOR' ? 'is-visitor' : 'is-staff'}`}>
                    <span>{message.sender === 'VISITOR' ? '나' : '하이픈 운영자'}</span><p>{message.body}</p>
                </div>)}
            </div>
            {error && <p role="alert" className="hi-chat-error">{error}</p>}
            <form className="hi-chat-compose" onSubmit={send}>
                <label className="sr-only" htmlFor="hi-chat-message">메시지</label>
                <input id="hi-chat-message" value={draft} onChange={event => setDraft(event.target.value)} maxLength={1000} placeholder="메시지를 입력하세요" disabled={!ready || busy} autoComplete="off" />
                <button type="submit" aria-label="메시지 보내기" disabled={!draft.trim() || busy || !ready}><Send size={20} /></button>
            </form>
        </section>
    </div>;
}
