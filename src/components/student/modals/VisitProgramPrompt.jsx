import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../../auth/AuthProvider';
import { claimDailyVisitProgramPrompt, loadVisitProgramPrompt } from '../../../utils/visitProgramPrompts';

export default function VisitProgramPrompt({ visit, wait = false }) {
    const auth = useAuth();
    const verifiedProfileId = auth.status === 'authenticated' ? auth.profile?.id : null;
    const [prompt, setPrompt] = useState(null);
    const dialogRef = useRef(null);
    const headingId = useId();
    const descriptionId = useId();
    const visitId = visit?.id;
    const event = visit?.event;
    const locationName = visit?.locationName;
    const userId = visit?.userId;
    const nativeDialog = typeof HTMLDialogElement !== 'undefined' && typeof HTMLDialogElement.prototype.showModal === 'function';

    useEffect(() => {
        setPrompt(null);
        if (!visitId || wait) return;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3500);
        loadVisitProgramPrompt({ event, locationName, userId, verifiedProfileId, signal: controller.signal })
            .then(result => {
                if (!controller.signal.aborted && result) setPrompt(result);
            })
            .catch(error => {
                if (!controller.signal.aborted) console.warn('Visit program prompt unavailable:', error.message);
            })
            .finally(() => clearTimeout(timeout));
        return () => {
            clearTimeout(timeout);
            controller.abort();
        };
    }, [visitId, event, locationName, userId, verifiedProfileId, wait]);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog || wait || (nativeDialog && dialog.open)) return;
        if (!claimDailyVisitProgramPrompt(prompt, userId)) {
            setPrompt(null);
            return;
        }
        if (nativeDialog) dialog.showModal();
        else dialog.querySelector('button')?.focus();
    }, [prompt, userId, wait, nativeDialog]);

    useEffect(() => {
        if (!prompt) return;
        const dismissRestoredPage = event => { if (event.persisted) setPrompt(null); };
        window.addEventListener('pageshow', dismissRestoredPage);
        return () => window.removeEventListener('pageshow', dismissRestoredPage);
    }, [prompt]);

    if (!prompt || wait) return null;
    return createPortal(
        <div className={nativeDialog ? undefined : 'fixed inset-0 z-[11000] flex items-center justify-center bg-black/45'}>
            <dialog
                ref={dialogRef}
                open={nativeDialog ? undefined : true}
                role="dialog"
                aria-modal="true"
                aria-labelledby={headingId}
                aria-describedby={prompt.description ? descriptionId : undefined}
                onClose={() => setPrompt(null)}
                onKeyDown={event => { if (!nativeDialog && event.key === 'Escape') setPrompt(null); }}
                className="m-auto w-[calc(100%_-_2rem)] max-h-[90vh] max-w-sm overflow-y-auto rounded-3xl bg-white p-6 text-gray-900 shadow-xl backdrop:bg-black/45"
            >
                <h2 id={headingId} className="break-words text-xl font-bold">{prompt.title}</h2>
                {prompt.description && <p id={descriptionId} className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-600">{prompt.description}</p>}
                <div className="mt-6 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => nativeDialog ? dialogRef.current?.close() : setPrompt(null)} className="rounded-xl bg-gray-100 px-4 py-3 text-sm font-bold">닫기</button>
                    <a href={prompt.url} referrerPolicy="no-referrer" className="rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-bold text-white">프로그램 보기</a>
                </div>
            </dialog>
        </div>,
        document.body
    );
}
