import { readFile, writeFile } from 'node:fs/promises';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import assert from 'node:assert/strict';
const traverse = traverseModule.default;
const source = await readFile('src/pages/StudentDashboard.jsx', 'utf8');
let effect, close;
traverse(parse(source, { sourceType: 'module', plugins: ['jsx'] }), {
    CallExpression({ node }) {
        if (node.callee.name === 'useEffect' && source.slice(node.start, node.end).includes('const isForceRequireSurvey')) effect = source.slice(node.start, node.end);
    },
    JSXElement({ node }) {
        if (node.openingElement.name.name !== 'StudentCheckinSurveyModal') return;
        const attribute = node.openingElement.attributes.find(a => a.name?.name === 'onClose');
        close = source.slice(attribute.value.expression.start, attribute.value.expression.end);
    }
});
if (!effect || !close) throw new Error('Check-in wiring missing');
// Execute the actual effect with isolated visit storage. No database writes.
const storage = new Map();
const sessionStorage = { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
const visitRef = { current: null };
let openings = 0, cleanup;
const values = {
    user: { id:'test-user', name:'테스트' }, location: { state:{ requireCheckinSurvey:true, checkinTime:'2026-10-02T07:35:00Z' } }, sessionStorage,
    supabase: { from() { throw new Error('QR handoff must not query logs again'); } },
    checkinSurveyVisitRef:visitRef, setCheckinLocationName() {}, setShowCheckinSurveyModal(open) { if (open) openings++; }, setCheckinToastMsg() {},
    useEffect(callback) { cleanup = callback(); }, setTimeout() {}, console
};
const runEffect = () => Function(...Object.keys(values), effect)(...Object.values(values));
runEffect(); await Promise.resolve(); assert.equal(openings, 1);
cleanup?.(); values.user.name = '갱신'; runEffect(); await Promise.resolve(); assert.equal(openings, 1);
cleanup?.(); values.location.state = { ...values.location.state }; runEffect(); await Promise.resolve(); assert.equal(openings, 1);
cleanup?.(); values.location.state.checkinTime = '2026-10-02T08:35:00Z'; runEffect(); await Promise.resolve(); assert.equal(openings, 2);
cleanup?.(); values.location.state.checkinTime = '2026-10-02T09:35:00Z'; sessionStorage.setItem('survey_dismissed_2026-10-02T09:35:00Z', 'true');
runEffect(); await Promise.resolve(); assert.equal(openings, 2);
console.log('Check-in effect: QR handoff, profile refresh, route refresh, new visit and dismissed visit passed.');
await writeFile('scripts/fixtures/checkin-survey-ui.html', '<html><meta charset="utf-8"><div id="root"></div><script type="module" src="./checkin-survey-ui.jsx"></script></html>');
await writeFile('scripts/fixtures/checkin-survey-ui.jsx', `
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/index.css';
import StudentCheckinSurveyModal from '../../src/components/student/modals/StudentCheckinSurveyModal';
import { surveyHubApi } from '../../src/api/surveyHubApi';
if (!import.meta.env.DEV) throw new Error('Local only');
let scenario = 'NORMAL', queries = 0;
const definition = { title: '체크인 설문 테스트', questions: [{ id: 'purpose', title: '오늘 무엇을 하고 싶나요?', type: 'choice', options: ['휴식', '대화'], required: true }] };
surveyHubApi.resolve = async () => {
    queries++;
    await new Promise(resolve => setTimeout(resolve, 500));
    if (scenario === 'NONE') return null;
    if (scenario === 'ERROR') throw new Error('Fixture load failure');
    return { id:'test-link', form_id:'test-form', event:'CHECKIN', version:{ id:'test-version', definition } };
};
surveyHubApi.submit = async () => ({ id: 'test-answer' });
const confetti = () => {};
function Demo() {
    const [user, setUser] = useState({ id:'fixture-user', name:'테스트' });
    const [location, setLocation] = useState({ state: null });
    const [showCheckinSurveyModal, setShowCheckinSurveyModal] = useState(false);
    const [checkinLocationName, setCheckinLocationName] = useState('하이픈');
    const [checkinToastMsg, setCheckinToastMsg] = useState(null);
    const checkinSurveyVisitRef = React.useRef(null);
    const begin = mode => {
        scenario = mode; queries = 0;
        const checkinTime = new Date().toISOString();
        sessionStorage.setItem('active_checkin_time', checkinTime);
        sessionStorage.setItem('require_checkin_survey', 'true');
        sessionStorage.removeItem('pending_checkin_notif');
        const checkinSurvey = mode === 'HANDOFF' ? { id:'test-form', config:{ _surveyLink:{ id:'test-link', form_id:'test-form', event:'CHECKIN', version:{ id:'test-version', definition } } } } : undefined;
        setLocation({ state:{ requireCheckinSurvey:true, checkinTime, locationName:'하이픈', checkinSurvey } });
    };
    ${effect};
    return <main className="p-6"><h1>실제 체크인 설문 코드 검증 · 실제 저장 없음</h1>
        <button onClick={() => begin('NORMAL')}>정상 체크인</button>{' '}
        <button onClick={() => begin('HANDOFF')}>QR 설문 전달</button>{' '}
        <button onClick={() => begin('NONE')}>설문 없는 체크인</button>{' '}
        <button onClick={() => begin('ERROR')}>조회 실패 체크인</button>{' '}
        <button onClick={() => setUser(current => ({ ...current, name:current.name+'!' }))}>프로필 갱신</button>{' '}
        <button onClick={() => setLocation(current => ({ ...current, state:{...current.state} }))}>화면 상태 갱신</button>
        <p>설문 조회 횟수: {queries}</p><p>설문 상태: {showCheckinSurveyModal ? '열림' : '닫힘'}</p>
        {checkinToastMsg && <p>{checkinToastMsg.title}</p>}
        <StudentCheckinSurveyModal isOpen={showCheckinSurveyModal} user={user} locationName={checkinLocationName} initialSurvey={location.state?.checkinSurvey} onClose={${close}} />
    </main>;
}
createRoot(document.getElementById('root')).render(<Demo />);
`);
console.log('Local fixture generated from actual dashboard effect and close handler.');
