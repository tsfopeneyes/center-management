import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Award, Sparkles } from 'lucide-react';
import useModalClose from '../../hooks/useModalClose';

export default function ChallengeSuccessDialog({ open, onClose, notice, user, onRegisterRegularUser }) {
    const titleId = useId();
    const confirmRef = useRef(null);
    const dialogRef = useRef(null);
    useModalClose(open, onClose, { priority: 300 });
    useEffect(() => {
        if (!open) return;
        const previous = document.activeElement;
        confirmRef.current?.focus();
        return () => { if (previous?.isConnected) previous.focus?.(); };
    }, [open]);
    if (!open) return null;
    const focusStyle = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#CF3A27]';
    return createPortal(<div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/75 p-4" onClick={onClose}>
        <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={event => event.stopPropagation()} onKeyDown={event => {
            if (event.key !== 'Tab') return;
            const buttons = [...dialogRef.current.querySelectorAll('button')];
            const first = buttons[0], last = buttons[buttons.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }} className="flex w-full max-w-sm flex-col items-center rounded-3xl bg-white p-6 text-center shadow-xl">
            <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#FBF3E7] text-[#CF3A27]"><Award size={32} aria-hidden="true"/></span>
            <h3 id={titleId} className="mb-2 text-xl font-black text-slate-800">축하합니다! 챌린지 성공!</h3>
            <p className="mb-6 max-h-48 w-full overflow-y-auto whitespace-pre-wrap px-2 text-sm font-semibold leading-relaxed text-slate-600">{notice.challenge_success_message || '챌린지 성공 기준을 달성했어요! 대단해요 🎉'}</p>
            <div className="mt-2 flex w-full gap-2">
                {onRegisterRegularUser && notice.challenge_show_haifn_btn && (user?.role === 'GUEST' || user?.user_group === '게스트') && <button type="button" onClick={() => { onClose(); onRegisterRegularUser(); }} className={`flex flex-1 items-center justify-center gap-1.5 rounded-2xl border border-[#CF3A27] bg-white py-3.5 text-xs font-black text-[#CF3A27] ${focusStyle}`}><Sparkles size={12} aria-hidden="true"/>하이픈 등록</button>}
                <button ref={confirmRef} type="button" onClick={onClose} className={`flex-1 rounded-2xl bg-[#CF3A27] py-3.5 text-xs font-black text-white hover:bg-[#B93223] ${focusStyle}`}>확인</button>
            </div>
        </section>
    </div>, document.body);
}
