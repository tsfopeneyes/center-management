import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';

const traverse = traverseModule.default || traverseModule;
const form = readFileSync(new URL('../src/components/admin/board/components/forms/WriteForm.jsx', import.meta.url), 'utf8');
const api = readFileSync(new URL('../src/api/programSettingsApi.js', import.meta.url), 'utf8');
assert.match(api, /rpc\('save_program_settings_atomic'/);
assert.match(api, /from\('program_settings_save_requests'\)/);
assert.doesNotMatch(api, /from\('notices'\)/);
const ast = parse(form, { sourceType: 'module', plugins: ['jsx'] });
let found = false;
traverse(ast, {
    IfStatement(path) {
        const test = path.node.test;
        if (test?.operator !== '&&' || test.left?.name !== 'isProgram'
            || test.right?.callee?.name !== 'isProgramApplicationTransitionEnabled') return;
        const calls = [];
        path.get('consequent').traverse({
            CallExpression(callPath) {
                const callee = callPath.node.callee;
                if (callee.type === 'MemberExpression') calls.push(`${callee.object?.name}.${callee.property?.name}`);
            },
        });
        assert.ok(calls.includes('programSettingsApi.save'));
        assert.ok(!calls.includes('noticesApi.update'));
        assert.ok(!calls.includes('noticesApi.create'));
        assert.ok(!calls.includes('surveyHubApi.saveProgramSurvey'));
        assert.ok(!calls.includes('challengeMissionsApi.syncMissions'));
        found = true;
    },
});
assert.ok(found, 'program settings must use the atomic boundary when transition is enabled');
console.log('program settings atomic client path and direct relation fallback passed');
