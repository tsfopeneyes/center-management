import React, { useEffect, useRef, useState } from 'react';
import { X, ExternalLink, ChevronDown } from 'lucide-react';
import useModalClose from '../../hooks/useModalClose';
import { buttonHasTeams, buttonHasQuestions, getProgramButtonLabel, getProgramQuestions } from './programButtons';

export default function ProgramButtonDialog({ button, participants = [], userId, onClose }) {
    const questions = getProgramQuestions(button.questions).filter(item => item.question.trim());
    const [questionIndex] = useState(() => Math.floor(Math.random() * Math.max(1, questions.length)));
    const randomMode = button.question_display_mode === 'RANDOM';
    const displayedQuestions = randomMode
        ? questions.length ? [{ item: questions[questionIndex % questions.length], index: questionIndex % questions.length }] : []
        : questions.map((item, index) => ({ item, index }));
    useModalClose(true, onClose, { priority: 100 });
    const panelRef = useRef(null);
    const scrollRef = useRef(null);
    const contentRef = useRef(null);
    const arrowRef = useRef(null);
    const reachedEndRef = useRef(false);
    const [showMoreArrow, setShowMoreArrow] = useState(false);
    const updateScrollHint = () => {
        const region = scrollRef.current;
        if (!region) return;
        const overflow = region.scrollHeight - region.clientHeight;
        if (overflow > 2 && region.scrollTop >= overflow - 2) {
            reachedEndRef.current = true;
            if (document.activeElement === arrowRef.current) region.focus({ preventScroll: true });
        }
        setShowMoreArrow(overflow > 2 && !reachedEndRef.current);
    };
    useEffect(() => {
        reachedEndRef.current = false;
        scrollRef.current.scrollTop = 0;
        updateScrollHint();
        const observer = new ResizeObserver(updateScrollHint);
        observer.observe(scrollRef.current);
        observer.observe(contentRef.current);
        return () => observer.disconnect();
    }, [button.id]);
    const scrollFurther = () => {
        const region = scrollRef.current;
        region.scrollBy({ top: region.clientHeight * 0.8,
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    };
    useEffect(() => {
        const previous = document.activeElement;
        panelRef.current?.querySelector('button')?.focus();
        return () => { if (previous?.isConnected) previous.focus(); };
    }, []);
    const containFocus = event => {
        if (event.key !== 'Tab') return;
        const controls = [...panelRef.current.querySelectorAll('button, a[href]')];
        const target = event.shiftKey ? controls[controls.length - 1] : controls[0];
        if ((event.shiftKey && document.activeElement === controls[0])
            || (!event.shiftKey && document.activeElement === controls[controls.length - 1])) {
            event.preventDefault(); target?.focus();
        }
    };
    const memberIndex = participants.findIndex(member => String(member.id) === String(userId));
    const customContent = button.template === 'GUIDE';
    let link = '';
    try { const parsed = new URL(customContent ? button.link.trim() : ''); if (['http:', 'https:'].includes(parsed.protocol)) link = parsed.href; } catch { /* Optional or invalid legacy link. */ }
    const title = getProgramButtonLabel(button);
    return <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
        <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={`button-dialog-${button.id}`} onClick={event => event.stopPropagation()} onKeyDown={containFocus}
            className="flex max-h-[85dvh] w-[92vw] max-w-[340px] flex-col gap-5 overflow-hidden rounded-[2rem] bg-white p-6 shadow-xl">
            <div className="flex shrink-0 items-start justify-between gap-4">
                <h2 id={`button-dialog-${button.id}`} className="min-w-0 break-words text-xl font-bold text-[#191f28]">{title}</h2>
                <button type="button" onClick={onClose} aria-label="닫기" className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={20} /></button>
            </div>
            <div className="relative flex min-h-0 flex-1">
            <div ref={scrollRef} role="region" aria-label="프로그램 안내 내용" tabIndex={0} onScroll={updateScrollHint}
                className="scrollbar-hide min-h-0 flex-1 overflow-y-auto overscroll-contain focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-slate-300">
            <div ref={contentRef} className="space-y-5">
            {customContent && button.content.trim() && <div className="whitespace-pre-wrap break-words text-base leading-relaxed text-[#333d4b]">{button.content}</div>}
            {buttonHasTeams(button) && <section className="space-y-2 rounded-xl bg-slate-50 p-4">
                <h3 className="text-sm font-semibold text-slate-600">나의 팀</h3>
                <p className="text-xl font-bold text-slate-900">{memberIndex < 0 ? '팀 배치 준비 중' : `${memberIndex % button.group_count + 1}팀`}</p>
            </section>}
            {buttonHasQuestions(button) && displayedQuestions.length > 0 && (
                <ol aria-label="질문 목록" className="space-y-3">
                    {displayedQuestions.map(({ item, index }) => <li key={index}>
                        <section aria-label={`질문 ${index + 1}`} className="rounded-xl bg-[#f9fafb] p-4">
                            <h3 className="flex items-start gap-2 text-base font-bold leading-relaxed text-[#191f28]">
                                <span className="shrink-0 tabular-nums text-[#CF3A27]">{index + 1}.</span>
                                <span className="min-w-0 whitespace-pre-wrap break-words">{item.question}</span>
                            </h3>
                            {item.description.trim() && <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-[#4e5968]">{item.description}</p>}
                        </section>
                    </li>)}
                </ol>
            )}
            </div>
            </div>
            {showMoreArrow && <button ref={arrowRef} type="button" onClick={scrollFurther} aria-label="아래 내용 더 보기"
                className="absolute -bottom-2 left-1/2 flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-md hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400">
                <ChevronDown size={22} aria-hidden="true" />
            </button>}
            </div>
            <div className="shrink-0 space-y-3">
            {link && <a href={link} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#CF3A27] px-4 py-3 font-bold text-white hover:bg-[#B83222]">바로가기<ExternalLink size={17} /></a>}
            <button type="button" onClick={onClose} className={`min-h-11 w-full rounded-xl px-4 py-3 font-bold ${link ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-[#CF3A27] text-white hover:bg-[#B83222]'}`}>확인</button>
            </div>
        </div>
    </div>;
}
