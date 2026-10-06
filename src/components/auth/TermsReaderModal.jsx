import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, X } from 'lucide-react';
import useModalClose from '../../hooks/useModalClose';
import TermsArticleBody from './TermsArticleBody';

export default function TermsReaderModal({ article, onClose, returnLabel = '설정으로 돌아가기' }) {
    const backButton = useRef(null);
    useModalClose(true, onClose);
    const title = article === 'art1' ? '이용약관' : '개인정보처리방침';

    useEffect(() => {
        const previousFocus = document.activeElement;
        backButton.current?.focus();
        return () => previousFocus?.focus();
    }, []);

    const trapFocus = (event) => {
        if (event.key !== 'Tab') return;
        const focusable = [...event.currentTarget.querySelectorAll('button, [tabindex="0"]')];
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault(); last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault(); first.focus();
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 p-4">
            <section role="dialog" aria-modal="true" aria-labelledby="terms-reader-title" onClick={event => event.stopPropagation()} onKeyDown={trapFocus}
                className="flex max-h-[85dvh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
                <header className="flex shrink-0 items-center gap-2 border-b border-gray-100 p-4">
                    <button ref={backButton} type="button" onClick={onClose} aria-label={returnLabel} className="rounded-full p-2 text-gray-600 hover:bg-gray-100"><ArrowLeft size={22} /></button>
                    <h3 id="terms-reader-title" className="min-w-0 flex-1 text-lg font-bold text-gray-800">{title}</h3>
                    <button type="button" onClick={onClose} aria-label="약관 닫기" className="rounded-full p-2 text-gray-600 hover:bg-gray-100"><X size={22} /></button>
                </header>
                <div tabIndex={0} aria-label={`${title} 본문`} className="min-h-0 flex-1 overflow-y-auto overscroll-contain break-words p-4 text-sm leading-relaxed text-gray-600 sm:p-6">
                    <TermsArticleBody article={article} />
                </div>
            </section>
        </div>, document.body
    );
}
