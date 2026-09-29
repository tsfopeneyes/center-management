import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';

const traverse = traverseModule.default || traverseModule;
const page = readFileSync(new URL('../src/pages/PublicProgramDetail.jsx', import.meta.url), 'utf8');
const api = readFileSync(new URL('../src/api/guestProgramRegistrationApi.js', import.meta.url), 'utf8');
const ast = parse(page, { sourceType: 'module', plugins: ['jsx'] });
let atomicCalls = null;
let verifiedNotificationCalls = 0;

traverse(ast, {
    CallExpression(path) {
        if (path.node.callee?.name !== 'sendProgramApplicationNotification') return;
        const payload = path.node.arguments[0];
        const status = payload?.properties?.find(property => property.key?.name === 'status');
        assert.equal(status?.value?.name, 'registrationStatus',
            'public member and guest notifications must use the saved response status');
        verifiedNotificationCalls += 1;
    },
    IfStatement(path) {
        if (path.node.test?.callee?.name !== 'isProgramApplicationTransitionEnabled') return;
        const calls = [];
        path.get('consequent').traverse({
            CallExpression(callPath) {
                const callee = callPath.node.callee;
                if (callee?.type === 'MemberExpression') {
                    calls.push(`${callee.object?.name || '?'}.${callee.property?.name || '?'}`);
                }
            },
        });
        if (calls.includes('guestProgramRegistrationApi.register')) atomicCalls = calls;
    },
});

assert.ok(atomicCalls, 'the enabled public guest path must use atomic registration');
assert.equal(verifiedNotificationCalls, 2);
assert.ok(!atomicCalls.includes('supabase.from'), 'the enabled path must not write users or responses directly');
assert.ok(!atomicCalls.includes('programSessionsApi.applyGuest'), 'the enabled path must not use the old session guest endpoint');
assert.ok(!atomicCalls.includes('programApplicationsApi.applyGuest'), 'the enabled path must not use the old whole-program guest endpoint');
assert.match(api, /register_guest_program_application/);
assert.match(api, /guest_program_registration_requests/);
assert.doesNotMatch(api, /\.from\(['"]users['"]\)|\.from\(['"]notice_responses['"]\)/);
console.log('enabled public guest path uses only atomic RPC or equivalent insert-only relation');
