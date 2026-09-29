import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
    const { default: GuestIdentitySettings } = await vite.ssrLoadModule(
        '/src/features/programs/settings/GuestIdentitySettings.jsx'
    );
    const { default: ApplicationQuestionSettings } = await vite.ssrLoadModule(
        '/src/features/programs/settings/ApplicationQuestionSettings.jsx'
    );
    const render = (formData) => renderToStaticMarkup(
        React.createElement(GuestIdentitySettings, { formData, updateField: () => {} })
    );
    const renderQuestions = (formData) => renderToStaticMarkup(
        React.createElement(ApplicationQuestionSettings, { formData, updateField: () => {} })
    );
    const active = render({ is_recruiting: true, guest_properties: {
        allow_guest: true,
        custom_fields: [{ id: 'saved', label: '기존 질문', type: 'select', required: true, options: ['하나', '둘'] }],
    } });
    assert.match(active, /비회원 신청 허용/);
    assert.match(active, /개인정보 동의/);
    const legacyQuestions = renderQuestions({ is_recruiting: true, guest_properties: {
        allow_guest: true,
        custom_fields: [{ id: 'saved', label: '기존 질문', type: 'select', required: true, options: ['하나', '둘'] }],
    } });
    assert.match(legacyQuestions, /기존 질문/);
    assert.match(legacyQuestions, /하나, 둘/);
    assert.match(legacyQuestions, /회원/);
    assert.match(legacyQuestions, /필수 답변/);

    const draftQuestions = renderQuestions({ is_recruiting: true, guest_properties: {
        allow_guest: true,
        custom_fields: [
            { id: 'saved', label: '기존 질문', type: 'text', required: true },
            { id: 'draft', label: '', type: 'text', required: false },
        ],
    } });
    assert.match(draftQuestions, /application-question-draft/);
    assert.match(draftQuestions, /질문 2/);

    const disabled = render({ is_recruiting: true, guest_properties: { allow_guest: false } });
    assert.doesNotMatch(disabled, /checked=""/);
    assert.doesNotMatch(disabled, /비회원 기본 수집 정보/);
    assert.equal(render({ is_recruiting: false, guest_properties: { allow_guest: true } }), '');
    assert.equal(renderQuestions({ is_recruiting: false, guest_properties: {} }), '');
    console.log('PASS: guest settings active, disabled and hidden render states; legacy question remains visible.');
} finally {
    await vite.close();
}
