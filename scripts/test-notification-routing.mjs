import assert from 'node:assert/strict';
import {
  CENTER_CODES,
  centerFromLocationText,
  centersFromTargetRegions,
  destinationSecretName,
  enabledDestinations,
  normalizeRoutingConfig,
} from '../supabase/functions/_shared/notificationRouting.mjs';

assert.deepEqual(centersFromTargetRegions(['강동']), [CENTER_CODES.HAIFN]);
assert.deepEqual(centersFromTargetRegions(['강서']), [CENTER_CODES.ENOUGH_PLACE]);
assert.deepEqual(centersFromTargetRegions(['강동', '강서', '강동']), [CENTER_CODES.HAIFN, CENTER_CODES.ENOUGH_PLACE]);
assert.deepEqual(centersFromTargetRegions([]), []);

assert.equal(centerFromLocationText('하이픈 2F'), CENTER_CODES.HAIFN);
assert.equal(centerFromLocationText('이높플레이스'), CENTER_CODES.ENOUGH_PLACE);
assert.equal(centerFromLocationText('하이픈 강서'), null);
assert.equal(centerFromLocationText('외부 행사장'), null);

const config = normalizeRoutingConfig({
  ENOUGH_PLACE: { slack: { program: false } },
});
assert.equal(config.ENOUGH_PLACE.slack.program, false);
assert.equal(config.ENOUGH_PLACE.line.program, true);
assert.equal(config.HAIFN.slack.program, true);
assert.equal(destinationSecretName({ centerCode: 'HAIFN', channel: 'line' }), 'LINE_HAIFN_GROUP_ID');
assert.equal(destinationSecretName({ centerCode: 'ENOUGH_PLACE', channel: 'slack' }), 'SLACK_ENOUGH_CHANNEL_ID');

assert.deepEqual(enabledDestinations({
  centerCodes: ['HAIFN', 'ENOUGH_PLACE'],
  category: 'program',
  routingConfig: config,
}), [
  { centerCode: 'HAIFN', channel: 'line' },
  { centerCode: 'HAIFN', channel: 'slack' },
  { centerCode: 'ENOUGH_PLACE', channel: 'line' },
]);

console.log('notification routing tests passed');
