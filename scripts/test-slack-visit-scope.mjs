import assert from 'node:assert/strict';
import { resolveVisitLocationKeyword } from '../supabase/functions/_shared/visitScope.mjs';

assert.equal(resolveVisitLocationKeyword('지난주 하이픈만 이용 통계 알려줘', '', null), '하이픈');
assert.equal(resolveVisitLocationKeyword('하이픈 방문자는?', '', '이높플레이스'), '하이픈');
assert.equal(resolveVisitLocationKeyword('이높플레이스 방문 통계', '', '하이픈'), '이높플레이스');
assert.equal(resolveVisitLocationKeyword('두 센터 방문 통계', '', '하이픈'), '');
assert.equal(resolveVisitLocationKeyword('하이픈과 이높플레이스 비교', '', null), '');
assert.equal(resolveVisitLocationKeyword('응 다시 조회해봐', '요청자: 하이픈만 알려줘\n퐁퐁: 조회 오류 (504)', null), '하이픈');
assert.equal(resolveVisitLocationKeyword('다시 조회해봐', '요청자: 하이픈만 알려줘\n요청자: 이높플레이스만 알려줘', null), '이높플레이스');
assert.equal(resolveVisitLocationKeyword('다시 조회해봐', '퐁퐁: 하이픈 방문 조회 오류 (504)', null), '');

console.log('Slack visit scope tests passed');
