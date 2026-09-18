import { useEffect, useState } from 'react';

// Central replacement for browser alert() calls. Existing screens can keep
// their validation code while users receive one consistent in-app dialog.
const AppAlertDialog = () => {
    const [messages, setMessages] = useState([]);
    const [confirmation, setConfirmation] = useState(null);

    useEffect(() => {
        const nativeAlert = window.alert;
        const showAppAlert = (message) => {
            const detail = message && typeof message === 'object' ? message : { message };
            const text = String(detail.message || detail.text || '안내할 내용이 없습니다.');
            const title = String(detail.title || '안내');
            const highlight = detail.highlight ? String(detail.highlight) : '';
            setMessages((current) => [...current, { id: `${Date.now()}-${Math.random()}`, title, text, highlight }]);
        };
        const handleAppAlert = (event) => showAppAlert(event.detail);
        const handleAppConfirm = (event) => {
            const detail = event.detail || {};
            if (typeof detail.resolve !== 'function') return;
            setConfirmation({
                title: String(detail.title || '확인해 주세요'),
                text: String(detail.message || detail.text || '계속 진행할까요?'),
                confirmText: String(detail.confirmText || '확인'),
                cancelText: String(detail.cancelText || '취소'),
                tone: detail.tone === 'danger' ? 'danger' : 'primary',
                resolve: detail.resolve,
            });
        };

        window.alert = showAppAlert;
        window.addEventListener('app-alert', handleAppAlert);
        window.addEventListener('app-confirm', handleAppConfirm);
        return () => {
            if (window.alert === showAppAlert) window.alert = nativeAlert;
            window.removeEventListener('app-alert', handleAppAlert);
            window.removeEventListener('app-confirm', handleAppConfirm);
        };
    }, []);

    const activeMessage = messages[0];
    const finishConfirmation = (result) => {
        if (!confirmation) return;
        confirmation.resolve(result);
        setConfirmation(null);
    };

    if (confirmation) return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]" role="presentation">
            <div className="w-full max-w-sm rounded-3xl border border-tossGrey100 bg-white p-6 text-center shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="app-confirm-title" aria-describedby="app-confirm-description">
                <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full text-2xl ${confirmation.tone === 'danger' ? 'bg-red-50' : 'bg-[#F8E8E4]'}`}>💬</div>
                <h2 id="app-confirm-title" className="mt-4 break-keep text-lg font-black text-tossGrey900">{confirmation.title}</h2>
                <p id="app-confirm-description" className="mt-2 whitespace-pre-line break-keep text-sm font-semibold leading-relaxed text-tossGrey600">{confirmation.text}</p>
                <div className="mt-5 grid grid-cols-2 gap-2.5">
                    <button type="button" onClick={() => finishConfirmation(false)} className="rounded-xl bg-tossGrey100 py-3 text-sm font-bold text-tossGrey700">{confirmation.cancelText}</button>
                    <button type="button" onClick={() => finishConfirmation(true)} autoFocus className={`rounded-xl py-3 text-sm font-bold text-white transition-colors ${confirmation.tone === 'danger' ? 'bg-red-500 hover:bg-red-600' : 'bg-haifnRed hover:bg-haifnRedHover'}`}>{confirmation.confirmText}</button>
                </div>
            </div>
        </div>
    );

    if (!activeMessage) return null;

    const close = () => setMessages((current) => current.slice(1));

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]" onClick={close}>
            <div className="w-full max-w-sm rounded-3xl border border-tossGrey100 bg-white p-6 text-center shadow-2xl" onClick={(event) => event.stopPropagation()}>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#F8E8E4] text-2xl">💬</div>
                <h2 className="mt-4 break-keep text-lg font-black text-tossGrey900">{activeMessage.title}</h2>
                <p className="mt-2 whitespace-pre-line break-keep text-sm font-semibold leading-relaxed text-tossGrey600">{activeMessage.text}</p>
                {activeMessage.highlight && (
                    <p className="mt-4 rounded-xl bg-[#F8E8E4] px-4 py-3 text-sm font-black text-haifnRed">
                        {activeMessage.highlight}
                    </p>
                )}
                <button type="button" onClick={close} className="mt-5 w-full rounded-xl bg-haifnRed py-3 text-sm font-bold text-white transition-colors hover:bg-haifnRedHover">
                    확인
                </button>
            </div>
        </div>
    );
};

export default AppAlertDialog;
