import { useEffect, useState } from 'react';
import { SURVEY_CENTERS } from '../../../utils/surveyAssignments';
import { listVisitProgramPrompts, normalizeProgramPromptUrl, programIdFromPublicLink, saveVisitProgramPrompt } from '../../../utils/visitProgramPrompts';

const initial = center_code => ({ center_code, title: '', description: '', url: '', show_at: 'CHECKOUT', enabled: false, program_id: null, show_to_applicants: true });
const field = 'mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-gray-900';

export default function VisitProgramPromptSettings({ programs }) {
    const [settings, setSettings] = useState(null);
    const [loadError, setLoadError] = useState('');
    useEffect(() => {
        let cancelled = false;
        listVisitProgramPrompts()
            .then(rows => { if (!cancelled) setSettings(new Map(rows.map(row => [row.center_code, row]))); })
            .catch(() => { if (!cancelled) setLoadError('프로그램 안내 설정을 불러오지 못했습니다. 잠시 후 다시 열어 주세요.'); });
        return () => { cancelled = true; };
    }, []);

    return <section className="space-y-4">
        <div>
            <h2 className="text-lg font-bold text-gray-900">프로그램 안내</h2>
            <p className="mt-1 text-sm text-gray-500">센터별로 모바일 QR 체크인·체크아웃 후 보여줄 안내를 설정합니다.</p>
        </div>
        {loadError ? <p role="alert" className="text-sm text-red-700">{loadError}</p> : !settings ?
            <p role="status" className="text-sm text-gray-500">설정을 불러오는 중…</p> :
            <div className="grid gap-4 xl:grid-cols-2">
                {SURVEY_CENTERS.map(({ code, label }) =>
                    <PromptForm key={code} label={label} programs={programs} initialValue={{ ...initial(code), ...settings.get(code) }} />
                )}
            </div>
        }
    </section>;
}

function PromptForm({ label, initialValue, programs }) {
    const [draft, setDraft] = useState(initialValue);
    const [busy, setBusy] = useState(false);
    const [feedback, setFeedback] = useState(null);
    const edit = (key, value) => {
        setFeedback(null);
        setDraft(previous => ({
            ...previous,
            [key]: value,
            ...(key === 'show_to_applicants' && !value && !previous.program_id
                ? { program_id: programIdFromPublicLink(previous.url) } : {})
        }));
    };
    const save = async event => {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        setFeedback(null);
        try {
            if (!draft.title.trim()) throw new Error('팝업 제목을 입력해 주세요.');
            if (draft.enabled && !draft.show_to_applicants && !programs.some(program => String(program.id) === String(draft.program_id))) {
                throw new Error('신청 여부를 확인할 프로그램을 선택해 주세요.');
            }
            const programId = programs.find(program => String(program.id) === String(draft.program_id))?.id ?? null;
            await saveVisitProgramPrompt({ ...draft, program_id: programId });
            setFeedback({ text: '저장했습니다.' });
        } catch (error) {
            setFeedback({ error: true, text: error.code ? '설정을 저장하지 못했습니다. 권한이나 연결 상태를 확인해 주세요.' : error.message });
        } finally {
            setBusy(false);
        }
    };
    const previewUrl = normalizeProgramPromptUrl(draft.url);

    return <form onSubmit={save} className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
        <fieldset disabled={busy} className="space-y-4">
            <legend className="mb-3 text-lg font-bold text-gray-900">{label}</legend>
            <label className="block text-sm font-semibold text-gray-700">팝업 제목
                <input required maxLength={80} value={draft.title} onChange={e => edit('title', e.target.value)} className={field} />
            </label>
            <label className="block text-sm font-semibold text-gray-700">안내 문구 (선택)
                <textarea rows={3} maxLength={300} value={draft.description} onChange={e => edit('description', e.target.value)} className={field} />
            </label>
            <label className="block text-sm font-semibold text-gray-700">프로그램 링크
                <input required type="url" maxLength={2000} placeholder="https://app.schoolchurchimpact.org/p/175" value={draft.url} onChange={e => edit('url', e.target.value)} className={field} />
            </label>
            {previewUrl && <a href={previewUrl} target="_blank" rel="noreferrer" className="inline-block text-sm font-semibold text-blue-700 underline">링크 열어보기</a>}
            <label className="block text-sm font-semibold text-gray-700">표시 시점
                <select value={draft.show_at} onChange={e => edit('show_at', e.target.value)} className={field}>
                    <option value="CHECKIN">체크인 후</option>
                    <option value="CHECKOUT">체크아웃 후</option>
                    <option value="BOTH">체크인 후와 체크아웃 후</option>
                </select>
            </label>
            <div className="space-y-3 rounded-xl bg-gray-50 p-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <input type="checkbox" checked={draft.show_to_applicants} onChange={e => edit('show_to_applicants', e.target.checked)} />
                    이미 신청한 이용자에게도 표시
                </label>
                {!draft.show_to_applicants && <>
                    <label className="block text-sm font-semibold text-gray-700">신청 여부를 확인할 프로그램
                        <select className={field} required={draft.enabled} value={draft.program_id ?? ''} onChange={e => {
                            const programId = e.target.value || null;
                            setFeedback(null);
                            setDraft(previous => ({
                                ...previous,
                                program_id: programId,
                                url: programId && (!previous.url || programIdFromPublicLink(previous.url)) ? 'https://app.schoolchurchimpact.org/p/' + programId : previous.url
                            }));
                        }}>
                            <option value="">프로그램 선택</option>
                            {programs.map(program => <option key={program.id} value={program.id}>{program.title} (#{program.id})</option>)}
                        </select>
                    </label>
                    <p className="text-xs text-gray-600">연결 링크와 같은 프로그램을 선택해 주세요. 신청 완료·대기 중인 이용자와 본인 확인이 안 된 게스트에게는 안내가 표시되지 않습니다.</p>
                </>}
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <input type="checkbox" checked={draft.enabled} onChange={e => edit('enabled', e.target.checked)} />
                안내 표시
            </label>
            <div className="flex flex-wrap items-center gap-3">
                <button type="submit" className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy ? '저장 중…' : '저장'}</button>
                {feedback && <span role={feedback.error ? 'alert' : 'status'} className={feedback.error ? 'text-sm text-red-700' : 'text-sm text-emerald-700'}>{feedback.text}</span>}
            </div>
        </fieldset>
    </form>;
}
