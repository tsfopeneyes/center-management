import {
  CENTER_CODES,
  centerFromLocationText,
  centersFromTargetRegions,
  normalizeCenterCodes,
} from './notificationRouting.mjs';

const EVENT_CATEGORIES = Object.freeze({
  VISIT_CHECKIN: 'visit',
  VISIT_CHECKOUT: 'visit',
  PROGRAM_APPLICATION: 'program',
  COFFEE_CHAT_APPLICATION: 'coffee_chat',
  RENTAL_APPLICATION: 'rental',
});

const cleanText = (value, fallback = '', maxLength = 1_000) => {
  const text = String(value ?? '').trim();
  return (text || fallback).slice(0, maxLength);
};

const cleanAnswers = (value) => (Array.isArray(value) ? value : [])
  .map((item) => cleanText(item, '', 300))
  .filter(Boolean)
  .slice(0, 20);

const requireRow = async (readOne, table, query, message) => {
  const row = await readOne(table, query);
  if (!row) throw new Error(message);
  return row;
};

const buildVisitMessage = ({ eventType, user, details }) => {
  const checkout = eventType === 'VISIT_CHECKOUT';
  const isGuest = user.user_group === '게스트' || String(user.name || '').includes('(guest)');
  const name = cleanText(String(user.name || '').replace('(guest)', ''), '알 수 없음', 100);
  const school = cleanText(user.school, '', 100);
  const identity = school && school !== '-' ? `${name} (${school})` : name;
  const lines = [
    `[${isGuest ? 'GUEST ' : ''}${checkout ? 'CHECK-OUT' : 'CHECK-IN'}]`,
    `${checkout ? '💙' : '💌'} ${identity}`,
  ];
  const referralPath = cleanText(details?.referralPath, '', 300);
  if (!checkout && referralPath) lines.push('', '🧭 방문 경로', `▪ ${referralPath}`);
  const question = cleanText(details?.surveyQuestion, '', 300);
  const answers = cleanAnswers(details?.surveyAnswers);
  if (question && answers.length) lines.push('', `${checkout ? '📝' : '🎯'} ${question}`, ...answers.map((answer) => `▪ ${answer}`));
  return lines.join('\n');
};

const resolveVisit = async (payload, readOne) => {
  const logId = cleanText(payload.logId, '', 100);
  if (!logId) throw new Error('A visit log ID is required.');
  const expectedType = payload.eventType === 'VISIT_CHECKIN' ? 'CHECKIN' : 'CHECKOUT';
  const log = await requireRow(readOne, 'logs', [
    ['id', `eq.${logId}`], ['type', `eq.${expectedType}`], ['select', 'id,user_id,location_id,type,created_at'], ['limit', '1'],
  ], 'The visit event could not be verified.');
  const [user, location] = await Promise.all([
    requireRow(readOne, 'users', [['id', `eq.${log.user_id}`], ['select', 'id,name,school,user_group'], ['limit', '1']], 'The visitor could not be verified.'),
    requireRow(readOne, 'locations', [['id', `eq.${log.location_id}`], ['select', 'id,name,group_id'], ['limit', '1']], 'The visit location could not be verified.'),
  ]);
  const group = location.group_id
    ? await readOne('location_groups', [['id', `eq.${location.group_id}`], ['select', 'name'], ['limit', '1']])
    : null;
  const centerCode = centerFromLocationText(`${group?.name || ''} ${location.name || ''}`);
  if (!centerCode) throw new Error('The visit center could not be determined.');
  return {
    category: EVENT_CATEGORIES[payload.eventType],
    centerCodes: [centerCode],
    message: buildVisitMessage({ eventType: payload.eventType, user, details: payload.details }),
    eventKey: `${payload.eventType}:${log.id}`,
    source: { table: 'logs', id: String(log.id) },
  };
};

const resolveProgramApplication = async (payload, readOne) => {
  const noticeId = Number(payload.noticeId);
  const userId = cleanText(payload.userId, '', 100);
  const status = payload.status === 'WAITLIST' ? 'WAITLIST' : 'JOIN';
  if (!Number.isSafeInteger(noticeId) || noticeId <= 0 || !userId) throw new Error('A valid program application reference is required.');

  let application;
  if (payload.dailySessionId) {
    const session = await requireRow(readOne, 'daily_program_sessions', [
      ['id', `eq.${cleanText(payload.dailySessionId, '', 100)}`], ['notice_id', `eq.${noticeId}`], ['select', 'id,notice_id,session_date'], ['limit', '1'],
    ], 'The daily program session could not be verified.');
    application = await requireRow(readOne, 'daily_program_session_responses', [
      ['session_id', `eq.${session.id}`], ['user_id', `eq.${userId}`], ['status', `eq.${status}`], ['select', 'session_id,user_id,status,created_at'], ['limit', '1'],
    ], 'The daily program application could not be verified.');
  } else {
    application = await requireRow(readOne, 'notice_responses', [
      ['notice_id', `eq.${noticeId}`], ['user_id', `eq.${userId}`], ['status', `eq.${status}`], ['select', 'notice_id,user_id,status,created_at'], ['limit', '1'],
    ], 'The program application could not be verified.');
  }

  const [notice, user] = await Promise.all([
    requireRow(readOne, 'notices', [['id', `eq.${noticeId}`], ['select', 'id,title,target_regions'], ['limit', '1']], 'The program could not be verified.'),
    requireRow(readOne, 'users', [['id', `eq.${userId}`], ['select', 'id,name'], ['limit', '1']], 'The applicant could not be verified.'),
  ]);
  const centerCodes = centersFromTargetRegions(notice.target_regions);
  if (!centerCodes.length) throw new Error('The program notification centers are not configured.');
  const action = status === 'WAITLIST' ? '대기 신청했어요!' : '신청했어요!';
  const suffix = payload.dailySessionId ? ` (${cleanText(payload.sessionDate, '오늘', 30)})` : '';
  return {
    category: EVENT_CATEGORIES.PROGRAM_APPLICATION,
    centerCodes,
    message: `[PROGRAM]\n📝 ${cleanText(user.name, '학생', 100)}님이 <${cleanText(notice.title, '프로그램', 200)}>${suffix} 프로그램을 ${action}`,
    eventKey: `PROGRAM_APPLICATION:${payload.dailySessionId || noticeId}:${userId}:${status}:${application.created_at || 'legacy'}`,
    source: { table: payload.dailySessionId ? 'daily_program_session_responses' : 'notice_responses', id: `${payload.dailySessionId || noticeId}:${userId}` },
  };
};

const resolveRentalApplication = async (payload, readOne) => {
  const bookingId = cleanText(payload.bookingId, '', 100);
  if (!bookingId) throw new Error('A rental booking ID is required.');
  const booking = await requireRow(readOne, 'rental_bookings', [
    ['id', `eq.${bookingId}`], ['select', 'id,rental_id,user_id,booking_date,start_time,end_time,status'], ['limit', '1'],
  ], 'The rental booking could not be verified.');
  const [rental, user] = await Promise.all([
    requireRow(readOne, 'rentals', [['id', `eq.${booking.rental_id}`], ['select', 'id,name,school_id'], ['limit', '1']], 'The rental space could not be verified.'),
    requireRow(readOne, 'users', [['id', `eq.${booking.user_id}`], ['select', 'id,name'], ['limit', '1']], 'The rental applicant could not be verified.'),
  ]);
  const school = await requireRow(readOne, 'schools', [['id', `eq.${rental.school_id}`], ['select', 'id,region'], ['limit', '1']], 'The rental center could not be verified.');
  const centerCodes = centersFromTargetRegions([school.region]);
  if (!centerCodes.length) throw new Error('The rental center could not be determined.');
  let rentalName = cleanText(rental.name, '공간', 200);
  try { rentalName = cleanText(JSON.parse(rentalName)?.name, rentalName, 200); } catch { /* plain legacy name */ }
  const endParts = cleanText(booking.end_time, '', 2_000).split('|');
  const [endTime, purpose = '', headcount = '', meetingName = '', notes = ''] = endParts;
  const centerLabel = centerCodes[0] === CENTER_CODES.HAIFN ? '하이픈' : '이높플레이스';
  return {
    category: EVENT_CATEGORIES.RENTAL_APPLICATION,
    centerCodes,
    message: [
      '[대관 신청]',
      `🏠 ${cleanText(user.name, '이용자', 100)}님이 ${centerLabel} ${rentalName} 대관을 신청했어요.`,
      `📅 ${booking.booking_date} ${booking.start_time} ~ ${endTime || '-'}`,
      `👥 ${cleanText(meetingName, '모임', 200)} / ${cleanText(headcount, '-', 30)}명`,
      `📝 ${cleanText(purpose, '없음', 500)}`,
      `🙏 ${cleanText(notes, '없음', 500)}`,
    ].join('\n'),
    eventKey: `RENTAL_APPLICATION:${booking.id}`,
    source: { table: 'rental_bookings', id: String(booking.id) },
  };
};

const resolveCoffeeChatApplication = async (payload, readOne) => {
  const coffeeChatId = cleanText(payload.coffeeChatId, '', 100);
  if (!coffeeChatId) throw new Error('A coffee chat ID is required.');
  const chat = await requireRow(readOne, 'coffee_chats', [
    ['id', `eq.${coffeeChatId}`], ['select', 'id,student_id,staff_id,topics,message,status'], ['limit', '1'],
  ], 'The coffee chat request could not be verified.');
  const [student, staff, configNotice] = await Promise.all([
    requireRow(readOne, 'users', [['id', `eq.${chat.student_id}`], ['select', 'id,name'], ['limit', '1']], 'The student could not be verified.'),
    requireRow(readOne, 'users', [['id', `eq.${chat.staff_id}`], ['select', 'id,name'], ['limit', '1']], 'The staff member could not be verified.'),
    readOne('notices', [['category', 'eq.SYSTEM'], ['title', 'eq.STAFF_PRESENCE_CONFIG'], ['select', 'content'], ['limit', '1']]),
  ]);
  let staffConfig = {};
  try { staffConfig = JSON.parse(configNotice?.content || '{}'); } catch { staffConfig = {}; }
  const centerCodes = normalizeCenterCodes([
    Array.isArray(staffConfig?.['하이픈']) && staffConfig['하이픈'].includes(chat.staff_id) ? CENTER_CODES.HAIFN : '',
    Array.isArray(staffConfig?.['이높플레이스']) && staffConfig['이높플레이스'].includes(chat.staff_id) ? CENTER_CODES.ENOUGH_PLACE : '',
  ]);
  if (!centerCodes.length) throw new Error('The coffee chat center could not be determined from the staff assignment.');
  const topics = cleanAnswers(chat.topics).join(', ');
  const note = cleanText(chat.message, '', 1_000);
  return {
    category: EVENT_CATEGORIES.COFFEE_CHAT_APPLICATION,
    centerCodes,
    message: `[COFFEE CHAT]\n☕ ${cleanText(student.name, '학생', 100)}님이 ${cleanText(staff.name, '스탭', 100)} 쌤에게 대화를 신청했어요!\n📌 주제: ${topics || '미입력'}${note ? `\n💬 전하고 싶은 말:\n"${note}"` : ''}`,
    eventKey: `COFFEE_CHAT_APPLICATION:${chat.id}`,
    source: { table: 'coffee_chats', id: String(chat.id) },
  };
};

export const resolveNotificationEvent = async (payload, { readOne }) => {
  if (!payload || typeof payload !== 'object' || typeof readOne !== 'function') throw new Error('Invalid notification event.');
  if (!Object.hasOwn(EVENT_CATEGORIES, payload.eventType)) throw new Error('Unsupported notification event type.');
  if (payload.eventType === 'PROGRAM_APPLICATION') return resolveProgramApplication(payload, readOne);
  if (payload.eventType === 'VISIT_CHECKIN' || payload.eventType === 'VISIT_CHECKOUT') return resolveVisit(payload, readOne);
  if (payload.eventType === 'RENTAL_APPLICATION') return resolveRentalApplication(payload, readOne);
  return resolveCoffeeChatApplication(payload, readOne);
};
