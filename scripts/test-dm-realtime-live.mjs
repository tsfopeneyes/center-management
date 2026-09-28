import process from 'node:process';
import readline from 'node:readline';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const input = readline.createInterface({ input: process.stdin, terminal: false });
const lines = [];
for await (const line of input) lines.push(line);
const credentials = JSON.parse(lines.join('\n'));

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const publishableKey = process.env.VITE_SUPABASE_ANON_KEY;
const authBaseUrl = process.env.VITE_ACCOUNT_AUTH_BASE_URL;
if (!supabaseUrl || !publishableKey || !authBaseUrl) throw new Error('Missing account or Supabase configuration');

const login = async ({ name, password }) => {
  const response = await fetch(`${authBaseUrl}/login`, {
    method: 'POST',
    redirect: 'error',
    headers: { 'Content-Type': 'application/json', apikey: publishableKey },
    body: JSON.stringify({ action: 'login', protocol: 1, name, password }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Login failed for ${name}: ${result?.error || response.status}`);
  if (!result?.profileId || !result?.session?.access_token || !result?.session?.refresh_token) {
    throw new Error(`Incomplete login result for ${name}`);
  }
  return result;
};

const makeClient = async issued => {
  const client = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    realtime: { params: { eventsPerSecond: 20 } },
  });
  const { error } = await client.auth.setSession({
    access_token: issued.session.access_token,
    refresh_token: issued.session.refresh_token,
  });
  if (error) throw error;
  return client;
};

const checkedRpc = async (client, name, args) => {
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(`${name}: ${error.message}`);
  return data;
};

const subscribe = (client, label, conversationId, events) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`${label} subscription timeout`)), 15000);
  const channel = client.channel(`dm-live-test-${label}-${crypto.randomUUID()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_messages', filter: `conversation_id=eq.${conversationId}` }, payload => events.push({ table: 'messages', event: payload.eventType, row: payload.new, old: payload.old }))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_message_reactions' }, payload => events.push({ table: 'reactions', event: payload.eventType, row: payload.new, old: payload.old }))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_typing_states', filter: `conversation_id=eq.${conversationId}` }, payload => events.push({ table: 'typing', event: payload.eventType, row: payload.new, old: payload.old }))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_participant_memberships', filter: `conversation_id=eq.${conversationId}` }, payload => events.push({ table: 'memberships', event: payload.eventType, row: payload.new, old: payload.old }))
    .subscribe(status => {
      if (status === 'SUBSCRIBED') { clearTimeout(timer); resolve(channel); }
      else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) { clearTimeout(timer); reject(new Error(`${label} channel ${status}`)); }
    });
});

const waitFor = async (events, predicate, label, timeoutMs = 10000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const found = events.find(predicate);
    if (found) return found;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`${label} realtime event not received`);
};

const teacherIssued = await login(credentials.teacher);
const studentIssued = await login(credentials.student);
const teacher = await makeClient(teacherIssued);
const student = await makeClient(studentIssued);
const teacherEvents = [];
const studentEvents = [];
let teacherChannel;
let studentChannel;
let conversationId;
let teacherMessageId;
let studentMessageId;

try {
  conversationId = await checkedRpc(teacher, 'dm_create_direct', { p_other_user_id: studentIssued.profileId });
  [teacherChannel, studentChannel] = await Promise.all([
    subscribe(teacher, 'teacher', conversationId, teacherEvents),
    subscribe(student, 'student', conversationId, studentEvents),
  ]);

  const teacherMessage = await checkedRpc(teacher, 'dm_send_message', { p_conversation_id: conversationId, p_content: '실시간 테스트: 쌤→학생' });
  teacherMessageId = teacherMessage.id;
  await waitFor(studentEvents, event => event.table === 'messages' && event.event === 'INSERT' && event.row?.id === teacherMessageId, 'teacher-to-student message');

  const studentMessage = await checkedRpc(student, 'dm_send_message', { p_conversation_id: conversationId, p_content: '실시간 테스트: 학생→쌤' });
  studentMessageId = studentMessage.id;
  await waitFor(teacherEvents, event => event.table === 'messages' && event.event === 'INSERT' && event.row?.id === studentMessageId, 'student-to-teacher message');

  const { error: typingError } = await student.from('dm_typing_states').upsert({
    conversation_id: conversationId,
    user_id: studentIssued.profileId,
    updated_at: new Date().toISOString(),
  });
  if (typingError) throw typingError;
  await waitFor(teacherEvents, event => event.table === 'typing' && event.row?.user_id === studentIssued.profileId, 'typing state');

  await checkedRpc(teacher, 'dm_toggle_reaction', { p_message_id: studentMessageId, p_emoji: '👍' });
  await waitFor(studentEvents, event => event.table === 'reactions' && event.event === 'INSERT' && event.row?.message_id === studentMessageId, 'emoji reaction');

  const beforeRead = await student.from('dm_participant_memberships').select('last_read_at').eq('conversation_id', conversationId).eq('user_id', studentIssued.profileId).single();
  if (beforeRead.error) throw beforeRead.error;
  await checkedRpc(student, 'dm_mark_read', { p_conversation_id: conversationId });
  const afterRead = await student.from('dm_participant_memberships').select('last_read_at').eq('conversation_id', conversationId).eq('user_id', studentIssued.profileId).single();
  if (afterRead.error || !afterRead.data?.last_read_at || afterRead.data.last_read_at === beforeRead.data?.last_read_at) throw new Error('Read marker did not advance');

  await checkedRpc(teacher, 'dm_revoke_message', { p_message_id: teacherMessageId });
  await checkedRpc(student, 'dm_revoke_message', { p_message_id: studentMessageId });
  await checkedRpc(student, 'dm_leave_conversation', { p_conversation_id: conversationId });
  await checkedRpc(teacher, 'dm_leave_conversation', { p_conversation_id: conversationId });

  console.log(JSON.stringify({
    twoIndependentSessions: true,
    teacherToStudentRealtime: true,
    studentToTeacherRealtime: true,
    typingRealtime: true,
    reactionRealtime: true,
    readMarker: true,
    cleanup: 'conversation_archived_and_both_left',
  }));
} finally {
  if (teacherChannel) await teacher.removeChannel(teacherChannel);
  if (studentChannel) await student.removeChannel(studentChannel);
  await teacher.auth.signOut({ scope: 'local' }).catch(() => {});
  await student.auth.signOut({ scope: 'local' }).catch(() => {});
}
