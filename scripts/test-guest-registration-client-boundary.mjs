import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';

const traverse = traverseModule.default || traverseModule;
const page = readFileSync(new URL('../src/pages/PublicProgramDetail.jsx', import.meta.url), 'utf8');
const api = readFileSync(new URL('../src/api/guestProgramRegistrationApi.js', import.meta.url), 'utf8');
const ast = parse(page, { sourceType: 'module', plugins: ['jsx'] });
let atomicCalls = 0;
let verifiedNotificationCalls = 0;

traverse(ast, {
    CallExpression(path) {
        if (path.node.callee?.object?.name === 'guestProgramRegistrationApi'
            && path.node.callee?.property?.name === 'register') atomicCalls += 1;
        if (path.node.callee?.name !== 'sendProgramApplicationNotification') return;
        const payload = path.node.arguments[0];
        const status = payload?.properties?.find(property => property.key?.name === 'status');
        assert.equal(status?.value?.name, 'registrationStatus',
            'public member and guest notifications must use the saved response status');
        verifiedNotificationCalls += 1;
    },
});

assert.equal(atomicCalls, 1, 'the public guest path must use atomic registration');
assert.equal(verifiedNotificationCalls, 2);
assert.doesNotMatch(page, /programSessionsApi\.applyGuest|programApplicationsApi\.applyGuest/);
assert.doesNotMatch(page, /\.from\('notice_responses'\)\.insert|\.from\('users'\)\.insert/);
assert.match(api, /register_guest_program_application_checked/);
assert.match(api, /guest_program_registration_checked_requests/);
assert.doesNotMatch(api, /rpc\('register_guest_program_application'/);
assert.doesNotMatch(api, /from\('guest_program_registration_requests'/);
assert.doesNotMatch(api, /\.from\(['"]users['"]\)|\.from\(['"]notice_responses['"]\)/);
console.log('public guest path uses only atomic RPC or equivalent insert-only relation');
