export const CENTER_CODES = Object.freeze({
  HAIFN: 'HAIFN',
  ENOUGH_PLACE: 'ENOUGH_PLACE',
});

export const NOTIFICATION_CATEGORIES = Object.freeze([
  'visit',
  'program',
  'coffee_chat',
  'rental',
]);

const DEFAULT_CHANNELS = Object.freeze({
  line: Object.freeze({ visit: true, program: true, coffee_chat: true, rental: false }),
  slack: Object.freeze({ visit: true, program: true, coffee_chat: true, rental: true }),
});

export const DEFAULT_NOTIFICATION_ROUTING = Object.freeze({
  HAIFN: DEFAULT_CHANNELS,
  ENOUGH_PLACE: Object.freeze({
    line: DEFAULT_CHANNELS.line,
    // No existing 이높플레이스 Slack destination is assumed. An admin can
    // enable these routes only after SLACK_ENOUGH_CHANNEL_ID is configured.
    slack: Object.freeze({ visit: false, program: false, coffee_chat: false, rental: false }),
  }),
});

const unique = (values) => [...new Set(values)];

export const normalizeCenterCodes = (values) => unique((Array.isArray(values) ? values : [values])
  .map((value) => String(value || '').trim().toUpperCase())
  .filter((value) => value === CENTER_CODES.HAIFN || value === CENTER_CODES.ENOUGH_PLACE));

export const centersFromTargetRegions = (regions) => normalizeCenterCodes(
  (Array.isArray(regions) ? regions : []).map((region) => {
    const normalized = String(region || '').trim().toLowerCase();
    if (['강동', 'gangdong', 'haifn', '하이픈'].includes(normalized)) return CENTER_CODES.HAIFN;
    if (['강서', 'gangseo', 'enough_place', 'enough place', '이높플레이스', '이높'].includes(normalized)) return CENTER_CODES.ENOUGH_PLACE;
    return '';
  }),
);

export const centerFromLocationText = (value) => {
  const text = String(value || '');
  const enough = /이높플레이스|이높|ENOUGH[_\s-]?PLACE|강서/i.test(text);
  const haifn = /하이픈|HAIFN|강동/i.test(text);
  if (enough === haifn) return null;
  return enough ? CENTER_CODES.ENOUGH_PLACE : CENTER_CODES.HAIFN;
};

const readBoolean = (value, fallback) => typeof value === 'boolean' ? value : fallback;

export const normalizeRoutingConfig = (value) => {
  let parsed = value;
  if (typeof value === 'string') {
    try { parsed = JSON.parse(value); } catch { parsed = {}; }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) parsed = {};

  return Object.fromEntries(Object.values(CENTER_CODES).map((centerCode) => {
    const center = parsed[centerCode] && typeof parsed[centerCode] === 'object' ? parsed[centerCode] : {};
    return [centerCode, Object.fromEntries(['line', 'slack'].map((channel) => {
      const channelConfig = center[channel] && typeof center[channel] === 'object' ? center[channel] : {};
      return [channel, Object.fromEntries(NOTIFICATION_CATEGORIES.map((category) => [
        category,
        readBoolean(channelConfig[category], DEFAULT_NOTIFICATION_ROUTING[centerCode][channel][category]),
      ]))];
    }))];
  }));
};

export const enabledDestinations = ({ centerCodes, category, routingConfig }) => {
  const normalizedCenters = normalizeCenterCodes(centerCodes);
  if (!NOTIFICATION_CATEGORIES.includes(category) || normalizedCenters.length === 0) return [];
  const config = normalizeRoutingConfig(routingConfig);
  return normalizedCenters.flatMap((centerCode) => ['line', 'slack']
    .filter((channel) => config[centerCode][channel][category])
    .map((channel) => ({ centerCode, channel })));
};

export const destinationSecretName = ({ centerCode, channel }) => {
  if (channel === 'line') {
    return centerCode === CENTER_CODES.HAIFN ? 'LINE_HAIFN_GROUP_ID' : 'LINE_ENOUGH_GROUP_ID';
  }
  if (channel === 'slack') {
    return centerCode === CENTER_CODES.HAIFN ? 'SLACK_HAIFN_CHANNEL_ID' : 'SLACK_ENOUGH_CHANNEL_ID';
  }
  return null;
};

export const legacyLineProxySecretName = (centerCode) =>
  centerCode === CENTER_CODES.HAIFN ? 'LINE_HAIFN_PROXY_URL' : 'LINE_ENOUGH_PROXY_URL';
