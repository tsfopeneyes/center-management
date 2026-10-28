import React, { useState } from 'react';
import { visibilityDiagnosticText } from '../../../utils/programVisibilityDiagnostics';

const statusLabels = { idle: '학교 정보 없음', loading: '확인 중', ready: '확인 완료', unknown: '등록된 지역 없음', error: '다시 연결해야 해요' };
const timeLabel = value => value ? new Date(value).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '아직 확인하지 못했어요';

export default function ProgramVisibilityHelp({ info, onRetry }) {
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [copyText, setCopyText] = useState('');
    if (!info) return null;
    const retry = async () => {
        setBusy(true);
        setMessage('');
        try { await onRetry?.(); }
        catch { setMessage('연결을 확인한 뒤 다시 시도해 주세요.'); }
        finally { setBusy(false); }
    };
    const copy = async () => {
        const text = visibilityDiagnosticText(info);
        try { await navigator.clipboard.writeText(text); setMessage('확인 정보를 복사했어요. 담당자에게 전달해 주세요.'); }
        catch { setCopyText(text); setMessage('아래 확인 정보를 길게 눌러 복사해 주세요.'); }
    };
    return <details className="mt-4 border-t border-tossGrey100 pt-3 text-xs text-tossGrey600">
        <summary className="cursor-pointer rounded-lg py-1 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#CF3A27]">프로그램이 보이지 않나요?</summary>
        <div className="mt-3 space-y-3 rounded-xl bg-tossGrey50 p-4">
            <p className="leading-relaxed">학교와 프로그램 정보를 다시 확인할 수 있어요. 확인 정보는 담당자에게 직접 전달할 때만 공유됩니다.</p>
            <dl className="space-y-1.5 leading-relaxed">
                <div><dt className="inline font-semibold">학교: </dt><dd className="inline">{info.school}</dd></div>
                <div><dt className="inline font-semibold">지역: </dt><dd className="inline">{info.region || '미확인'} · {statusLabels[info.regionStatus]}</dd></div>
                <div><dt className="inline font-semibold">목록 확인: </dt><dd className="inline">{timeLabel(info.listCheckedAt)}{info.listFailed ? ' · 다시 불러오기가 필요해요' : ''}</dd></div>
            </dl>
            {(info.regionStatus === 'error' || info.regionStatus === 'unknown') && <p role="status" className="font-semibold text-[#9B341F]">{info.regionStatus === 'error' ? '학교 정보 연결이 원활하지 않아요. 다시 불러오기를 눌러 주세요.' : '학교 지역을 찾지 못했어요. 담당자에게 학교 등록을 확인해 주세요.'}</p>}
            <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy || !onRetry} onClick={retry} className="min-h-10 rounded-lg bg-[#CF3A27] px-3 font-bold text-white hover:bg-[#B83222] disabled:opacity-50">{busy ? '확인 중…' : '다시 불러오기'}</button>
                <button type="button" onClick={copy} className="min-h-10 rounded-lg border border-tossGrey200 bg-white px-3 font-semibold text-tossGrey800 hover:bg-tossGrey50">확인 정보 복사</button>
            </div>
            {message && <p role="status" className="leading-relaxed">{message}</p>}
            {copyText && <textarea aria-label="복사할 프로그램 확인 정보" readOnly value={copyText} className="min-h-32 w-full rounded-lg border border-tossGrey200 bg-white p-2 text-xs" />}
            <ul className="space-y-3" aria-label="프로그램 표시 상태">
                {info.programs.map(program => <li key={program.id} className="leading-relaxed"><p className="font-bold text-tossGrey900">{program.title}</p><p>{program.reason}</p></li>)}
            </ul>
            {!info.programs.length && <p>현재 확인할 수 있는 프로그램 정보가 없어요. 다시 불러오기를 눌러 주세요.</p>}
        </div>
    </details>;
}
