import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {createMemberAdminTransport} from '../src/auth/memberAdminTransport.js';
const api = readFileSync(new URL('../src/api/userMergeApi.js', import.meta.url), 'utf8');
assert.match(api,/isAccountAuthEnabled\(\)/);assert.match(api,/members\.merge/);
assert.doesNotMatch(api,/\.rpc\s*\(|\.from\s*\(|\bfetch\s*\(/);
const modal = readFileSync(new URL('../src/components/admin/users/modals/UserMergeModal.jsx', import.meta.url), 'utf8');
assert.match(modal,/mergeUserStats|handleMergeAction|mergeCandidates|confirm\s*\(/);
const school = readFileSync(new URL('../src/components/admin/school/modals/StudentDetailModal.jsx', import.meta.url), 'utf8');
const mergeBody=school.slice(school.indexOf('const handleMerge'),school.indexOf('const handleDeleteTempStudent'));
assert.match(mergeBody,/mergeUserStats/);assert.doesNotMatch(mergeBody,/school_logs|calling_forest_progress|\.delete\s*\(/);
const transport=createMemberAdminTransport({endpoint:'http://localhost:5173/account-auth',
  auth:{getSession:async()=>({data:{session:{access_token:'test'}}})},
  fetcher:async()=>new Response(JSON.stringify({error:'merge_requires_review'}),{status:409})});
await assert.rejects(transport.merge({requestId:'test',sourceProfileId:'source',targetProfileId:'target'}),
  error=>error.code==='merge_requires_review');
console.log('PASS account merge client safety: existing UI uses one secure server action with no RPC/direct-table fallback');
