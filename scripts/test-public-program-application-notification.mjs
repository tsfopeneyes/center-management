import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from '@babel/parser';
import vm from 'node:vm';
const source = readFileSync(new URL('../src/pages/PublicProgramDetail.jsx', import.meta.url), 'utf8');
const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
const handlers = new Map();
function visit(node) {
 if (!node || typeof node !== 'object') return;
 if (node.type === 'VariableDeclarator' && ['handleGuestSubmit', 'handleRegisterLoggedIn'].includes(node.id?.name)) handlers.set(node.id.name, node.init);
 for (const value of Object.values(node)) if (Array.isArray(value)) value.forEach(visit); else if (value && typeof value === 'object') visit(value);
}
visit(ast);
for (const [name, handler] of handlers) {
 let notificationBlock;
 function find(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'TryStatement' && source.slice(node.block.start, node.block.end).includes('sendProgramApplicationNotification') && !source.slice(node.block.start, node.block.end).includes('setSubmitting')) notificationBlock = node;
  for (const v of Object.values(node)) if (Array.isArray(v)) v.forEach(find); else if (v && typeof v === 'object') find(v);
 }
 find(handler);
 assert.ok(notificationBlock, name);
 for (const sessionScoped of [true, false]) for (const status of ['JOIN', 'WAITLIST']) for (const fail of [false, true]) {
  const session = { id: 'chosen-session', session_date: '2026-10-01' };
  const program = { id: 121, open_sessions: [session], today_session: { id: 'other-session', session_date: '2026-10-02' } };
  const calls = [];
  const context = { request: { sessionId: sessionScoped ? session.id : null }, registrationNotice: program, freshProgram: program,
   registeredSession: sessionScoped ? session : null, userId: 'student', dbUser: { id: 'student' }, registrationStatus: status,
   console: { error() {} }, sendProgramApplicationNotification: async payload => { calls.push(payload); if (fail) throw new Error('delivery failed'); } };
  await vm.runInNewContext(`(async () => { ${source.slice(notificationBlock.start, notificationBlock.end)} })()`, context);
  assert.equal(calls.length, 1, name);
  assert.equal(calls[0].noticeId, 121); assert.equal(calls[0].userId, 'student'); assert.equal(calls[0].status, status);
  assert.equal(calls[0].dailySessionId || null, sessionScoped ? session.id : null);
  assert.equal(calls[0].sessionDate, sessionScoped ? session.session_date : undefined);
 }
}
assert.equal(handlers.size, 2);
console.log('Public member/guest application notifications: selected session, whole program, waitlist, and delivery failure passed.');
