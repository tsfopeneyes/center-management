import React, { useMemo, useRef, useState } from 'react';
import UserAvatar from './UserAvatar';

const activeMention = (value, caret) => {
    const before = value.slice(0, caret);
    const match = before.match(/(^|\s)@([^@\s]*)$/);
    if (!match) return null;
    return { query: match[2], start: caret - match[2].length - 1, end: caret };
};

export function CommunityMentionInput({ value, onChange, candidates = [], onSubmit, placeholder = '댓글 남기기', className = '' }) {
    const inputRef = useRef(null);
    const [mention, setMention] = useState(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const matches = useMemo(() => {
        if (!mention) return [];
        const query = mention.query.toLocaleLowerCase('ko');
        return candidates.filter(candidate => (candidate.name || '').toLocaleLowerCase('ko').includes(query)).slice(0, 8);
    }, [candidates, mention]);

    const updateMention = (nextValue, caret) => {
        setMention(activeMention(nextValue, caret));
        setActiveIndex(0);
    };

    const selectCandidate = candidate => {
        if (!mention) return;
        const nextValue = `${value.slice(0, mention.start)}@${candidate.name} ${value.slice(mention.end)}`;
        const nextCaret = mention.start + candidate.name.length + 2;
        onChange(nextValue);
        setMention(null);
        window.requestAnimationFrame(() => {
            inputRef.current?.focus();
            inputRef.current?.setSelectionRange(nextCaret, nextCaret);
        });
    };

    return <div className="relative min-w-0 flex-1">
        {mention && matches.length > 0 && <div role="listbox" aria-label="태그할 이용자" className="absolute bottom-full left-0 z-30 mb-2 max-h-64 w-full min-w-56 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl">
            {matches.map((candidate, index) => <button key={candidate.id} type="button" role="option" aria-selected={index === activeIndex} onMouseDown={event => { event.preventDefault(); selectCandidate(candidate); }} className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left ${index === activeIndex ? 'bg-slate-100' : 'hover:bg-slate-50'}`}>
                <UserAvatar user={candidate} size="w-7 h-7"/>
                <span className="min-w-0 flex-1"><span className="block truncate text-xs font-black text-slate-900">{candidate.name}</span>{candidate.school && <span className="block truncate text-[10px] font-medium text-slate-400">{candidate.school}</span>}</span>
                {candidate.isHost && <span className="shrink-0 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-black text-orange-600">호스트</span>}
            </button>)}
        </div>}
        <input ref={inputRef} value={value} onChange={event => { onChange(event.target.value); updateMention(event.target.value, event.target.selectionStart); }} onClick={event => updateMention(value, event.currentTarget.selectionStart)} onKeyDown={event => {
            if (mention && matches.length) {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault();
                    setActiveIndex(index => (index + (event.key === 'ArrowDown' ? 1 : matches.length - 1)) % matches.length);
                    return;
                }
                if (event.key === 'Enter' || event.key === 'Tab') {
                    event.preventDefault();
                    selectCandidate(matches[activeIndex]);
                    return;
                }
                if (event.key === 'Escape') { event.preventDefault(); setMention(null); return; }
            }
            if (event.key === 'Enter') { event.preventDefault(); onSubmit?.(); }
        }} onBlur={() => window.setTimeout(() => setMention(null), 100)} placeholder={placeholder} aria-autocomplete="list" className={className}/>
    </div>;
}

export function CommunityMentionText({ children, candidates = [], className = '' }) {
    const content = String(children || '');
    const names = useMemo(() => [...new Set(candidates.map(candidate => candidate.name).filter(Boolean))].sort((a, b) => b.length - a.length), [candidates]);
    if (!names.length) return <p className={className}>{content}</p>;
    const escaped = names.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const parts = content.split(new RegExp(`(@(?:${escaped.join('|')}))`, 'g'));
    return <p className={className}>{parts.map((part, index) => part.startsWith('@') && names.includes(part.slice(1))
        ? <span key={index} className="font-black text-blue-600">{part}</span>
        : <React.Fragment key={index}>{part}</React.Fragment>)}</p>;
}
