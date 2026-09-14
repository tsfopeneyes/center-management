import React, { useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import { promptAndEnableNotification } from '../../../firebase';

const failureCopy = {
    unsupported: ['알림을 사용할 수 없어요', '현재 브라우저에서는 웹 푸시 알림을 지원하지 않습니다.'],
    denied: ['알림 허용이 차단되어 있어요', "브라우저 또는 기기 설정에서 이 사이트의 알림을 '허용'으로 변경한 뒤 다시 시도해주세요."],
    dismissed: ['알림 허용이 완료되지 않았어요', '브라우저의 알림 권한 요청에서 허용을 선택하지 않아 알림을 연결하지 못했습니다.'],
    token_failed: ['알림 연결을 완료하지 못했어요', '알림 권한은 확인했지만 이 기기의 알림 등록에 실패했습니다. 잠시 후 알림 설정에서 다시 시도해주세요.'],
    error: ['알림 설정 중 문제가 생겼어요', '알림 연결을 완료하지 못했습니다. 잠시 후 알림 설정에서 다시 시도해주세요.'],
};

export default function PushPermissionPrompt({ user }) {
    const [open, setOpen] = useState(false);
    const [declined, setDeclined] = useState(false);
    const [loading, setLoading] = useState(false);
    const [failure, setFailure] = useState(null);

    useEffect(() => {
        if (!user?.id || typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'default') return;
        const key = `push_prompt_answered:${user.id}`;
        if (localStorage.getItem(key)) return;
        const timer = setTimeout(() => setOpen(true), 700);
        return () => clearTimeout(timer);
    }, [user?.id]);

    const allow = async () => {
        setLoading(true);
        try {
            const result = await promptAndEnableNotification(user.id);
            if (result.success) {
                localStorage.setItem(`push_prompt_answered:${user.id}`, 'allowed');
                setOpen(false);
                return;
            }
            setFailure({ reason: result.reason || 'error', detail: result.error || '' });
        } catch (error) {
            setFailure({ reason: 'error', detail: error?.message || '' });
        } finally {
            setLoading(false);
        }
    };

    const decline = () => {
        localStorage.setItem(`push_prompt_answered:${user.id}`, 'declined');
        setOpen(false);
        setDeclined(true);
    };

    const closeFailure = () => {
        localStorage.setItem(`push_prompt_answered:${user.id}`, `failed:${failure?.reason || 'error'}`);
        setFailure(null);
        setOpen(false);
    };

    if (!open && !declined && !failure) return null;
    const [failureTitle, failureDescription] = failureCopy[failure?.reason] || failureCopy.error;

    return (
        <div className="fixed inset-0 z-[10020] flex items-center justify-center bg-black/45 p-5 backdrop-blur-sm">
            <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-[30px] bg-white p-7 text-center shadow-2xl">
                <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${failure ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                    <BellRing size={27} />
                </div>
                {failure ? (
                    <>
                        <h2 className="mt-5 text-xl font-black leading-8 text-gray-900">{failureTitle}</h2>
                        <p className="mt-3 text-sm font-semibold leading-6 text-gray-500">{failureDescription}</p>
                        {failure.detail && <p className="mt-2 text-xs font-medium text-gray-400">{failure.detail}</p>}
                        <button type="button" onClick={closeFailure} className="mt-6 w-full rounded-2xl bg-blue-600 py-4 font-bold text-white">확인</button>
                    </>
                ) : declined ? (
                    <>
                        <h2 className="mt-5 text-xl font-black text-gray-900">천천히 경험해보세요!</h2>
                        <p className="mt-3 text-sm font-semibold leading-6 text-gray-500">언제든지 기기에서 알림을 설정할 수 있으니, 천천히 경험해보세요!</p>
                        <button type="button" onClick={() => setDeclined(false)} className="mt-6 w-full rounded-2xl bg-blue-600 py-4 font-bold text-white">확인</button>
                    </>
                ) : (
                    <>
                        <h2 className="mt-5 text-xl font-black leading-8 text-gray-900">센터에서 일어나는 즐거운 소식들을 받아보시겠습니까?</h2>
                        <p className="mt-3 text-sm font-semibold leading-6 text-gray-500">새로운 프로그램과 공지 소식을 놓치지 않고 알려드려요.</p>
                        <button type="button" disabled={loading} onClick={allow} className="mt-6 w-full rounded-2xl bg-blue-600 py-4 font-bold text-white disabled:opacity-50">{loading ? '연결 중…' : '알림 허용'}</button>
                        <button type="button" onClick={decline} className="mt-2 w-full rounded-2xl py-3.5 font-bold text-gray-400">거부</button>
                    </>
                )}
            </div>
        </div>
    );
}
