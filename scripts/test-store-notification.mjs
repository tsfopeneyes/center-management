import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { resolveNotificationEvent } from '../supabase/functions/_shared/notificationEvent.mjs';
import { enabledDestinations } from '../supabase/functions/_shared/notificationRouting.mjs';
import { normalizeNotificationRouteConfig } from '../src/utils/notificationRouteConfig.js';

const orderId = '10000000-0000-4000-8000-000000000001';
let status = 'PENDING';
const readOne = async table => ({
  store_orders: { id: orderId, user_id: 'student', item_id: 'item', amount: 30, status },
  users: { id: 'student', name: '테스트 학생', school: '테스트 학교' },
  haifn_items: { id: 'item', name: '대화카드', item_type: 'SPEND' },
})[table];
const payload = { eventType: 'STORE_APPLICATION', orderId, userId: 'forged', details: { name: 'forged' } };
const event = await resolveNotificationEvent(payload, { readOne });
assert.equal(event.source.table, 'store_orders');
assert.match(event.message, /테스트 학생 \(테스트 학교\)/);
assert.match(event.message, /대화카드/);
assert.match(event.message, /-30H/);
assert.doesNotMatch(event.message, /forged/);
assert.equal((await resolveNotificationEvent(payload, { readOne })).eventKey, event.eventKey);
assert.deepEqual(enabledDestinations({ ...event, routingConfig: {} }), [{ centerCode: 'HAIFN', channel: 'slack' }]);
assert.deepEqual(enabledDestinations({ ...event, routingConfig: { HAIFN: { slack: { store: false } } } }), []);
assert.equal(normalizeNotificationRouteConfig('{}').HAIFN.slack.store, true);
assert.equal(normalizeNotificationRouteConfig('{}').ENOUGH_PLACE.line.store, false);
for (status of ['APPROVED', 'REJECTED', 'CANCELLED']) {
  await assert.rejects(resolveNotificationEvent(payload, { readOne }), /no longer pending/);
}
await assert.rejects(resolveNotificationEvent({ ...payload, orderId: '' }, { readOne }));
await assert.rejects(resolveNotificationEvent(payload, { readOne: async () => null }), /could not be verified/);

// Exercise the actual order API with isolated dependencies and no network writes.
const apiSource = (await readFile(new URL('../src/api/haifnApi.js', import.meta.url), 'utf8'))
  .replace(/^import .*;\r?\n/gm, '');
const createApi = new Function('supabase', 'dispatchNotificationEvent', `${apiSource.replace('export const haifnApi', 'const haifnApi')}\nreturn haifnApi;`);
const writes = [];
const notifications = [];
let writeError = null;
const api = createApi({ from: table => ({ insert: async rows => {
  writes.push({ table, rows });
  return { error: writeError };
} }) }, async event => {
  notifications.push(event);
  throw new Error('simulated delivery failure');
});
const originalConsoleError = console.error;
console.error = () => {};
try {
  await api.createOrder('student', 'item', 30, true, 'card');
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].orderId, writes[0].rows[0].id);
  assert.equal(writes[0].rows[0].status, 'PENDING');
  await api.createOrder('student', 'item', 5, false, 'sticker');
  assert.equal(notifications.length, 1, 'immediate exchanges do not notify');
  writeError = new Error('save failed');
  await assert.rejects(api.createOrder('student', 'item', 30, true, 'card'), /save failed/);
  assert.equal(notifications.length, 1, 'failed saves do not notify');
} finally { console.error = originalConsoleError; }

// Equivalent impact check: existing categories and rows survive, and only the
// new store category is additionally accepted. This never connects to production.
const db = new PGlite();
try {
  await db.exec(`CREATE TABLE notification_delivery_logs (
    id integer PRIMARY KEY, category text NOT NULL
      CONSTRAINT notification_delivery_logs_category_check CHECK (category IN ('visit', 'program', 'coffee_chat', 'rental'))
  ); INSERT INTO notification_delivery_logs VALUES (1,'visit'), (2,'program'), (3,'coffee_chat'), (4,'rental');`);
  const before = (await db.query('SELECT * FROM notification_delivery_logs ORDER BY id')).rows;
  await db.exec(await readFile(new URL('../supabase/manual/proposals/20261002_store_notification_category.sql', import.meta.url), 'utf8'));
  assert.deepEqual((await db.query('SELECT * FROM notification_delivery_logs ORDER BY id')).rows, before);
  await db.exec("INSERT INTO notification_delivery_logs VALUES (5,'store')");
  await assert.rejects(db.exec("INSERT INTO notification_delivery_logs VALUES (6,'invalid')"));
} finally { await db.close(); }
console.log('Store notification routing, source validation and migration impact checks passed');
