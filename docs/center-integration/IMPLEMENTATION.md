# 센터 통합 기능 구현 순서와 수용 기준

다른 모델이 이 문서의 순서대로 로컬 구현과 검증을 진행하고, 검증 결과를 근거로 운영 적용 여부를 판단할 수 있도록 작성한 실행 계획이다.

## 1 인수인계 원칙

이 작업의 완료 목표는 [README.md](./README.md)의 통합 분석을 [SPEC.md](./SPEC.md)의 권한·입출력 계약으로 제공하는 것이다. 기존 관리자 로그인으로 ChatGPT를 연결하고, 같은 분석을 웹과 Slack에서 재사용한다. 코드 작성 모델은 아키텍처를 처음부터 다시 선택하지 않는다.

이번 문서 작성으로 운영 변경이 승인된 것은 아니다. 로컬 구현·검증과 운영 활성화 완료를 구분한다. `AGENTS.md`에 따라 production schema는 reviewed migration + 명시적 승인 + dry-run/격리 검증 후 적용하고, Firebase Hosting은 명시적인 배포 지시 후에만 배포한다. 새 Supabase 함수·Hook·권한 활성화도 변경 내역을 구체화한 뒤 승인받는다.

## 2 구현 파일 지도

아래는 2026-10-07 로컬 구현의 실제 파일 지도다. 실제 변경 전 현재 작업 트리와 다른 진행 중 작업을 확인한다. 기존 미커밋 파일을 일괄 덮어쓰지 않는다. 사용자 지시에 따라 관리자 설정 메뉴용 연결 화면은 만들지 않는다.

```text
supabase/functions/center-api/
  index.ts                      HTTP 라우팅과 의존성 조립
supabase/functions/_shared/centerIntegration/
  config.mjs                    환경·경로 검증
  oauth.mjs                     JOSE 서명·claims 검증
  nativeOAuthStore.mjs           관리형 OAuth 상태 adapter 하나
  connectionService.mjs          prepare/complete/revoke 전이
  connectionStore.mjs            private SQL과 트랜잭션
  mcp.mjs                       SDK transport와 도구 등록
  http.mjs                      웹 HTTP와 OAuth discovery
  websiteAuth.mjs               live 권한 확인과 ActorContext 생성
  websiteSessionVerifier.mjs    관리형 웹 세션 adapter
  slack.mjs                     검증된 Slack 주체 매핑
supabase/functions/_shared/centerAnalysis/
  contracts.mjs                 입력·출력 schema와 operation registry
  definitions.mjs               지표 버전과 정의
  service.mjs                   authorize → query → calculate → disclose
  postgresRepository.mjs        snapshot·고정 질의·페이지 완전성
  normalize.mjs                 legacy/회차/게스트/설문 정규화
  visits.mjs                    방문·체류 순수 계산
  programs.mjs                  신청·출석·만족도·참여 분포
  engagement.mjs                재방문·전후·전환
  operations.mjs                대여·스토어·제출 건수
  disclosure.mjs                출력 allowlist·작은 집단·보완 셀
src/api/centerIntegrationApi.js   검증된 웹 세션으로 OAuth 동의 HTTP 호출
src/pages/OAuthConsent.jsx        기존 파일을 검토 후 변경
scripts/test-center-analysis-contracts.mjs
scripts/test-center-analysis-metrics.mjs
scripts/test-center-analysis-repository.mjs
scripts/test-center-analysis-live.mjs    가명화한 실제 읽기 전용 snapshot의 독립 oracle 검사
scripts/center-analysis-live-snapshot.sql 실제 자료를 식별자 없이 임시 snapshot으로 만드는 읽기 전용 query
scripts/test-center-integration-auth.mjs
scripts/test-center-integration-transport.mjs
scripts/test-center-integration-web.mjs
scripts/test-center-integration-channels.mjs
supabase/manual/proposals/center-integration/ 검토용 SQL과 impact/rollback
docs/center-integration/validation.md        구현 시 실제 결과 기록
```

파일별 책임은 유지하되 아주 작은 모듈을 추가 분할할 필요는 없다. 분석 모듈에서 Supabase/HTTP/AI 클라이언트를 직접 만들지 않는다. DB 저장소와 auth는 주입하고 순수 계산은 합성 데이터만으로 실행 가능해야 한다.

## 3 작업 단계와 통과 조건

### P0 현재 상태와 제공자 계약 확인

산출물은 `validation.md`의 환경 표와 OAuth 계약 검사다.

- HEAD·git diff·미커밋 파일의 소유 범위를 기록. 새 기능 변경만 분리.
- 과거 `center-statistics-mcp`의 배포 여부, 기존 client/callback, 새 함수 URL 사용 가능 여부를 확인. 기존 연결이 있다면 유지/이관 표 작성.
- production은 우선 비밀값 없는 metadata/catalog만 확인. 실제 사용자 원본 데이터를 export하지 않음.
- 적용 migration 이력을 확인. `20261006010000_center_mcp_readonly.sql`이 미적용이면 자동 배포에서 제외하도록 검토 대상 분리. 적용됐다면 원본 파일 수정으로 해결하지 않고 새 forward migration 작성.
- 현재 OAuth enable/DCR 설정, discovery issuer, S256, signing algorithm, client auth method, 등록 callback, 활성 Hook을 확인. 이전 문서만으로 재설정하지 않음.
- 고정한 SDK가 Deno·로컬 Node tests와 호환되는지 확인. 설치 버전과 package hash/lock 기록.
- 실제 관리형 또는 로컬 Supabase Auth로 synthetic 사용자/client의 code exchange와 refresh를 검사. Hook의 client_id, custom audience/role, connection claims가 두 경로에서 유지되는지 확인.
- `native_connection_state`에 필요한 session/client/grant 필드 존재와 key 관계를 확인. 시간차 추정 없이 현재 철회 상태를 검증할 수 있는 계약을 확정.
- 계정 연결·role·assurance의 private 구조 및 실제 기존 로그인/세션 철회 검사를 확인. `live:true` stub을 증거로 인정하지 않음.

**통과 조건:** 전용 OAuth 토큰을 업무 DB·다른 관리자 API에서 사용할 수 없고, native grant/session 철회를 새 호출에서 확인할 수 있는 방법이 실제 환경에서 증명된다. 미통과여도 독립적인 분석 순수 코드·UI fixture는 진행할 수 있으나 production 연결은 활성화하지 않는다.

### P1 계약과 합성 기대값 작성

산출물은 `contracts.mjs`, `definitions.mjs`, 합성 fixture와 계약 테스트다.

- SPEC의 7개 operation, 입력 허용 목록, 공통 응답, per-operation output schema를 구현.
- 빈 데이터·누락·관찰 미완료·privacy suppression을 서로 다른 결과로 정의.
- 지표 registry에 ID, 한국어 이름, 분모, 포함/제외, 단위, 버전, 지원 source capability를 등록.
- 기존 웹/Slack 지표 의미 차이를 test case로 작성. legacy 이름을 새 정의로 자동 치환하지 않음.
- 기존 `engagement-fixture.mjs`를 검토하여 필요한 항목을 재사용. fixture의 가상 필드를 운영 데이터 필드처럼 쓰지 않음.

**통과 조건:** fixture 기대값이 구현 로직을 복사해서 계산된 값이 아니고, 수동으로 설명 가능한 값이다. 유효·무효 입력과 소스 한계가 고정된다.

### P2 DB 읽기 경계와 분석 구현

산출물은 검토 SQL, 내부 뷰, repository, 계산 모듈, DB 권한 검사다.

- 실제 source inventory를 metadata로 완성. 각 열의 존재·타입·관계·시각 의미·status enum 기록.
- SQL을 격리 DB에서 실행. 사용자·방문·신청·회차·설문·대여·스토어 합성 데이터만 사용.
- reader 접속은 source view SELECT만, control 접속은 integration metadata DML만 허용.
- PUBLIC SECURITY DEFINER 및 inherited ACL로 권한이 넓어지는지 검사. 발견하면 영향 분석 후 필요한 함수의 호출 역할 검증을 별도 reviewed migration으로 보완. 전체 PUBLIC 권한을 무차별 회수하지 않음.
- query predicate와 필요한 index를 EXPLAIN으로 검토. production EXPLAIN ANALYZE로 대형 질의를 임의 실행하지 않음.
- 같은 snapshot의 period/cohort facts를 읽고, 순수 계산 결과를 disclosure 단계로 전달.
- 숫자 만족도와 제출 count는 구형·신형 설문 중복을 검증. 원문 JSON을 모델이나 audit에 전달하지 않음.
- 도구 결과가 개인 식별자·고정 해시·이름·연락처·개별 시각을 포함하지 않는지 구조 검증.

**통과 조건:** 정상 source를 끝까지 읽은 결과만 완전한 지표로 반환하고, 비어 있는 것과 읽기 실패를 구분한다. 계정 reader와 업무 reader의 권한이 실제 SQL로 확인된다.

### P3 OAuth와 연결 관리 구현

산출물은 token Hook, connection service, live authorizer, OAuth 동의 화면이다. 관리자 설정 메뉴에는 연결/해제 UI를 추가하지 않는다.

- 전용 client의 토큰만 격리. 기존 Hook/일반 로그인/다른 client claims 보존.
- `accountAuthorization`에 새 고정 action을 추가: `analytics.read`, `connections.manage-self`는 staff 권한, `connections.manage-all`은 master 권한. 이 문자열을 HTTP body에서 선택하게 하지 않음.
- 기존 관리자 로그인 뒤 prepare → native approve → complete → callback 흐름. declined/expired/auto-consent/retry 처리.
- 동의 완료의 native 상태 확인은 서버가 수행. 현재 callback/client 설정은 서버로부터 안전한 표시 정보만 제공.
- 계정 1:1 매핑, 현재 역할, credential epoch, signed permission과 live grant 교집합 검사.
- 로컬 revoke를 먼저 처리하고 native 실패 시 차단 유지. revoked 권한이 역할 복구/토큰 refresh로 되살아나지 않게 테스트.
- 초기 허용 운영자는 신뢰할 수 있는 설정 절차로 지정. 새로 가입한 계정이나 모든 admin에게 자동 연결 허용 금지.

**통과 조건:** 실제 OAuth 성공, 토큰 refresh, callback 오류, 해제, 역할 제거, 비밀번호 변경과 raw API 접근 차단을 확인. 테스트하지 못한 관리형 제공자 계약은 미완료로 기록한다.

### P4 MCP와 채널 연결

산출물은 실제 MCP SDK 서버, 웹 client, Slack 공통 분석 adapter다.

- 공개 metadata/401 challenge는 DB 비밀정보 없이 동작. 실제 도구 결과는 인증 후에만 제공.
- MCP 도구는 `readOnlyHint=true`, `destructiveHint=false`, 적절한 securitySchemes. annotation을 권한 통제로 대신하지 않음.
- 인증 상태 만료 시 HTTP 및 MCP `_meta["mcp/www_authenticate"]`를 실제 클라이언트 계약에 맞게 반환.
- SDK transport가 지원하는 initialize/notifications/tools/list/tools/call, content types와 protocol version 동작을 Inspector로 검증.
- 웹 분석 화면은 공통 HTTP 결과를 사용. 기존 관리자 전체 화면을 재설계하지 않음.
- Slack 서명 검증 후 private identity와 DM 여부를 확인. 새로운 공통 결과를 모델 context에 전달하고 legacy 개인 피드백 helper를 끼워 넣지 않음.
- 같은 Actor 권한·기간·as_of·metric version으로 세 경로의 공통 숫자 일치 검증. 채널별 표시 형식만 다를 수 있음.

**통과 조건:** 동일한 질문을 ChatGPT/웹/Slack에서 실행했을 때 정의와 숫자가 맞고, 권한이 없는 채널은 분석을 실행하지 않는다.

### P5 성능과 운영 검증

산출물은 시간/CPU/메모리/DB 연결 측정, SQL impact 결과, 준비된 배포 변경 목록이다.

- 소규모·1501행 페이지·100,000행 상한과 상한 초과를 검사. 100,000행을 무조건 Edge JS 메모리에 적재하는 구현을 목표로 삼지 않음.
- 1일/30일/90일/366일과 cohort 전후 범위를 합성 데이터로 측정. 제한 초과는 명확한 결과로 종료.
- 체크인·로그인 등 주요 웹앱 요청을 병행해 분석 부하가 미치는 영향을 비교. 서비스 목표: 분석 실행 중 주요 요청 p95가 기준 대비20% 이상 악화되면 출시 보류/질의 보완. 최소30회 warm 측정, cold 결과는 따로 기록. 이는 초기 목표이며 실제 baseline을 기록해야 함.
- 허용되는 일반 분석은 warm p95 5초 이내 목표. 전체15초에 요청 종료. Edge CPU/메모리 한도도 통과해야 함.
- rate-limit·동시 lease·cache hit에서도 권한 재검증. 여러 함수 인스턴스를 가정한 원자성 검사.
- 전체 차단, DB 장애, JWKS 장애, provider 철회, Hook 실패, client 은퇴 시 fail-closed 확인.
- production에 적용할 SQL·Hook·함수·Hosting 변경을 각각 분리한 review manifest 작성. 승인되지 않은 다른 migration/웹 변경이 섞이지 않게 함.

**통과 조건:** 기능·권한·성능 결과와 rollback 경로가 모두 존재한다. DB/배포 승인을 요청할 때 이 결과를 제시한다.

## 4 수용 검사 목록

### 인증과 권한

| ID | 검사 | 기대 결과 |
| --- | --- | --- |
| A01 | 정상 기존 관리자, allowlist 포함, 동의 완료 | 등록된 분석만 성공 |
| A02 | 일반 회원/익명/allowlist 밖 admin | 연결과 도구 호출 거절 |
| A03 | 위조 서명, alg 혼동, 다른 issuer/aud/client, ID token | 401, 데이터 query 실행0 |
| A04 | 일반 웹 JWT를 MCP에, MCP JWT를 웹 관리 API에 사용 | 각각 거절 |
| A05 | role/user_metadata/body profile 변조 | protected mapping 기준으로 거절 |
| A06 | 연결 해제 후 유효 exp 토큰/캐시 사용 | 다음 요청 거절 |
| A07 | native grant만 철회, native session 제거 | 다음 요청 거절, 로컬 active만 믿지 않음 |
| A08 | 비밀번호 변경/강제 변경/계정 차단/역할 제거 | next call 거절. 역할 복구만으로 재활성화 안 됨 |
| A09 | 다른 client의 refresh·학생 로그인·회원가입 | 기존 claims·동작 유지 |
| A10 | 전용 client disabled/은퇴/미동의 상태의 발급 | 광범위 authenticated 토큰 발급 안 됨 |
| A11 | 중복 prepare/complete, callback 재진입, native 자동 동의 | 멱등·정확한 요청 결합, 철회 연결 부활 안 됨 |
| A12 | 해제 중 native 장애와 재연결 시도 | 로컬 차단 유지, 철회 확인 전 재활성화 거절 |
| A13 | DB/JWKS/provider 장애 | 성공 이력 재사용 없이 503/안전한 오류 |
| A14 | same actor revoked while long query runs | 반환 전 재검사에서 차단 |
| A15 | MCP token으로 PostgREST/Storage/PUBLIC RPC/관리자 Edge 호출 | 읽기/쓰기 모두 범위 밖 접근 거절 |

### 데이터와 지표

| ID | 검사 | 기대 결과 |
| --- | --- | --- |
| D01 | 같은 날 퇴실 후 재입실 | 방문2, 방문일1, 순방문자1 |
| D02 | 중복 CHECKIN/게스트 보조 로그/MOVE/고아 CHECKOUT | 정의대로 집계, 중복·품질 문제 별도 표시 |
| D03 | KST 자정·월 경계·윤일·주 시작 | 날짜 포함/제외 일치 |
| D04 | 퇴실 누락·0분·음수/잘못된 시각 | 실측과 추정 분리, 누락을0분 평균에 넣지 않음 |
| D05 | 직원·미가입·불안정 게스트키·회원 통합 | 정의에 맞게 제외/연결/제한 |
| D06 | 회차 전환·폐기·취소·대기·출석 잔존 | 중복 합산과 취소 출석 포함 없음 |
| D07 | 같은 프로그램 여러 회차, 서로 다른 프로그램 | 서로 다른 프로그램 수 분포 정확 |
| D08 | 30일 추적 마지막 날/미성숙 대상/이력 부족 | 완료자만 비율 분모, unknown을 실패로 처리 안 함 |
| D09 | 동일인 전후 비교, 전기 체류 없음 | paired count 정확, 과거 체류0으로 추정 안 함 |
| D10 | A→B→C에서 A,C만 선택, 같은 날 다중 참석 | 가짜 A→C 생성 안 됨, 불명확 순서 제외 |
| D11 | legacy custom synthetic5·modern rating·중복 제출 | 유효 satisfaction만, 근거 없는 dedupe 없음 |
| D12 | 대여 상태·스토어 취소·포인트 부호 | 예약을 이용률로, 포인트를 매출로 표시 안 함 |
| D13 | 빈 source vs missing table/column/페이지 실패 | count0과 unavailable/source_incomplete 구분 |
| D14 | 1501행·동률 timestamp·bigint 키·동시 변경 | keyset 완전성과 snapshot 일치 |
| D15 | 최대 행 수 초과·출력 한도 초과 | 잘린 total 없음, 범위 축소 안내 |
| D16 | 서로 다른 영역을 같은 기간에 조회 | 한 snapshot 기준, 영역별 누락 표시 |

기존 A~F 합성 fixture의 검증 가능한 기대값은 별도 계산 시험에 유지한다: 방문자4, 방문일7, 방문세션8, 실측305분, 유효세션7, 중앙값45분, 관찰 완료 재방문2/3, 전후 방문일1→1.5. 이 값들은 fixture 전체 조건이 같을 때만 적용한다. 공개 정책 시험에서는 cohort가5 미만인 결과를 숨겨야 하므로 순수 계산 시험과 외부 출력 시험을 분리한다.

### 공개 정책과 채널

| ID | 검사 | 기대 결과 |
| --- | --- | --- |
| P01 | 결과를 재귀 검사 | 개인 ID/이름/연락처/정밀 개인 시각/고정 해시 없음 |
| P02 | 작은 cohort·보완 셀·총합과 평균 역산 | family/breakdown 단위로 충분히 숨김 |
| P03 | 프로그램 본문에 도구 실행 지시/외부 URL/HTML | 데이터로만 처리, 임의 fetch/실행 없음 |
| P04 | program ref 또는 query에 SQL/unknown key | 입력 거절, SQL 구조 변경 없음 |
| P05 | 같은 cache key를 다른 actor/scope/channel로 요청 | 현재 권한과 disclosure 별로 분리 |
| P06 | 분석 정책 버전 변경 | 이전 cache 반환 안 됨 |
| C01 | 검증된 Slack DM의 연결 관리자 | 공통 분석 가능 |
| C02 | Slack 공개/그룹 채널·다른 team·미연결 사용자 | 새 통합 분석 차단 |
| C03 | 같은 fixture를 웹·Slack·MCP로 호출 | 허용된 숫자·정의 동일 |
| C04 | 기존 Slack 공지/Notion 확인 동작 | 기존 동작 회귀 없음, 새 권한으로 확대 없음 |

### 사용자 화면과 실제 연결

- `http://localhost:5173`에서 기존 관리자 로그인 → 동의 → 성공/거절/오류 흐름 확인.
- 모바일/데스크톱에서 권한 범위·승인·해제 상태와 오류 복구가 보임.
- 로그아웃 또는 계정 전환 후 이전 계정의 동의 버튼/연결 목록이 남지 않음.
- UI의 query parameter로 다른 사용자의 연결 해제/조회 불가.
- native 자동 동의, 새로고침, 네트워크 재시도, 브라우저 뒤로 가기, 만료 요청 검사.
- 실제 ChatGPT에서 최소5개 질문으로 코드 교환·도구 선택·refresh·설명 품질을 확인. Inspector 성공만으로 ChatGPT 완료 판정 안 함.

실제 회귀 질문:

1. 지난달과 그 전달 방문자와 이용시간을 비교해줘.
2. 지정 프로그램 참여자 중 30일 안에 센터를 다시 찾은 비율을 보여줘.
3. 그 참여자들의 프로그램 전후28일 방문일수가 달라졌는지 비교해줘.
4. 여러 프로그램에 참여하는 비중과 프로그램 간 이동을 정리해줘.
5. 프로그램별 신청·기록된 출석·만족도를 비교하고 데이터 한계도 적어줘.
6. 특정 학생의 모든 활동과 연락처를 보여줘. → 제공 범위 밖 안내, 개인 query 실행 안 함.
7. 이 프로그램 덕분에 방문이 늘었다고 확정해줘. → 인과효과로 확정하지 않음.
8. 결과를 바로 공지로 게시해줘. → v1은 초안만, 실제 게시 실행 안 함.

## 5 검증 실행과 증거

새 검사는 자격증명·실제 개인정보 없이 실행 가능하게 작성한다. `test-baseline.mjs`에는 오프라인/격리 검사만 등록한다. production 호출이 필요한 smoke는 별도 opt-in 스크립트로 분리하고 raw token/row를 출력하지 않는다.

기본 로컬 명령:

```powershell
node scripts/test-center-analysis-contracts.mjs
node scripts/test-center-analysis-metrics.mjs
node scripts/test-center-integration-auth.mjs
node scripts/test-center-integration-transport.mjs
node scripts/test-center-integration-sql.mjs
node scripts/test-center-integration-channels.mjs
npm run test:baseline
npm run build
npm run dev
```

이 명령은 향후 작성될 검사 파일의 실행 계약이다. 지금 존재하거나 이미 통과했다고 보고하지 않는다. SQL 검사는 실제 PostgreSQL의 역할·RLS·snapshot 의미를 검사하는 격리 환경을 사용한다. JS SQL 문자열 mock/PGlite만으로 관리형 Auth hook·role 동작을 증명하지 않는다.

`validation.md` 각 항목에 다음을 기록한다.

- test ID, 환경(local/synthetic/isolated PostgreSQL/managed Auth/production pilot), 실행 시각, commit, pass/fail/not-run.
- 기대값과 실제값 또는 실패 코드. 비밀값·개인 원본 없음.
- 승인받은 production 변경 범위와 승인 시점.
- 아직 검증되지 않은 계약과 배포 차단 여부.

## 6 배포 순서

1. 준비 코드와 검토 SQL 완성. 전체 feature flag는 false. 기존 source/설정의 보존 기준을 기록.
2. SQL impact 검사: 추가 schema/table/view/role/policy/index/Hook, 기존 로그인/권한에 영향, rollback 설명. 격리 DB 실행 또는 검토된 rollback transaction으로 확인.
3. 사용자에게 정확한 migration과 Auth 설정 변경을 승인받음. 전체 `db push --include-all`로 미검토 migration을 함께 적용하지 않음.
4. 승인된 schema와 제한 DB 역할 적용. 비밀값은 안전한 secret 관리 절차로 설정. Hook은 기존 구성과 조합해 전용 client만 격리하고 정상 로그인 회귀 확인.
5. 비활성 `center-api` 배포. metadata/challenge, 정상·비정상 token 차단 확인.
6. OAuth 동의 화면을 Firebase Hosting으로 명시적 승인 후 배포. 관리자 설정 메뉴에는 새 연결 항목을 넣지 않는다. 대상 빌드에 다른 미검토 웹 변경이 섞이지 않도록 변경 manifest 확인.
7. 검증된 pilot 관리자/client 등록. 실제 OAuth native 동의·교환·refresh·철회와 raw 접근 거절 확인.
8. source 공개 정책 검토 후 ChatGPT 분석 활성화. 5개 이상 실제 분석 질문과 권한 거절 검사.
9. 웹 분석 pilot 활성화, Slack DM identity 연결과 회귀 후 활성화. 채널별 배포 범위를 분리.
10. 오류율·지연·연결 수·호출량을 관찰. 통합 분석 결과와 기존 보고서 수치 차이가 정의 차이인지 오류인지 기록.

초기 운영 smoke는 허용된 운영자와 승인된 집계만 사용한다. 실제 관리자 계정 차단/비밀번호 변경을 검증하려고 운영 사용자를 임의로 수정하지 않는다. 이런 테스트는 격리된 검증 계정으로 수행한다.

## 7 롤백

- 첫 조치: private settings에서 새 연결/분석 비활성화. 모든 신규 도구 호출 차단 확인.
- pilot connection 로컬 revoke 및 native grant 철회. 토큰값을 로그에 남기지 않음.
- 필요하면 직전 `center-api`와 Hosting release로 복구, Slack 새 분석 feature만 끔.
- Hook 복구는 순서가 중요함: 전용 client 비활성화와 native 세션/refresh 철회가 확인되기 전 제한 Hook을 제거하면 광범위 토큰이 다시 발급될 수 있음. client tombstone 격리 규칙은 남겨 두는 것을 기본으로 함.
- 기존 로그인 장애가 Hook 변경으로 발생하면 검증된 이전 Hook을 복구하되, 해당 client를 먼저 폐쇄하여 토큰 노출 경로를 막음.
- 업무 원본·감사·동의 기록·기존 published_statistics를 삭제/초기화하지 않음. 새 schema 제거는 별도 검토 작업이며 정상 rollback의 필수 단계가 아님.

## 8 완료 판정

### 로컬 구현 완료

- 7개 도구와 입력/출력 schema 구현, 통합 분석의 순수 기대값 통과.
- 실제 SDK transport, OAuth 동의 화면, 같은 core를 쓰는 웹/Slack adapter 구현. 관리자 설정 메뉴 변경 없음.
- 권한·불완전 source·누락·small cohort·오류 검사 통과.
- reviewed migration과 영향/rollback 자료 준비.
- baseline/build/local UI 확인 및 validation 기록.

### 운영 연결 완료

- 승인된 범위만 배포/적용되고 actual OAuth/refresh/revoke 검증 통과.
- 허용 관리자만 연결하고 raw DB/다른 API로 권한 우회 불가.
- 실제 ChatGPT에서 통합 분석 질문 성공. 데이터 없는 항목은 적절한 unavailable 표시.
- 웹/Slack 동일 의미 결과와 기존 기능 회귀 확인.
- 차단/철회/rollback 실제 절차와 운영 계정 담당자가 정해짐.

로컬 완료를 운영 완료라고 보고하지 않는다. schema나 UI만 만들고 통합 분석은 추후 구현이라고 남기면 이 계획의 v1 완료가 아니다. 근거가 없는 엄밀한 지표를 unavailable로 표현하는 것은 허용하지만, 가능한 기록 기반 분석까지 모두 비활성으로 두어서는 안 된다.

## 9 다음 코딩 모델에 전달할 프롬프트

```text
docs/center-integration/README.md, SPEC.md, IMPLEMENTATION.md를 읽고 이 최종 설계를 구현해라.

목표는 기존 웹앱 관리자 계정으로 OAuth 동의해 ChatGPT를 연결하고, 방문·프로그램·체류·재방문·전후 변화·숫자 만족도 및 운영 집계를 공통 서버 분석 기능으로 제공하는 것이다. ChatGPT·웹·Slack이 같은 정의를 사용한다. 인증은 기존 Supabase, 운영 기반은 기존 Supabase와 Firebase다. ChatGPT 경로에 OpenAI API 호출을 추가하지 않는다.

먼저 AGENTS.md, 현재 git status/diff, 기존 OAuth/배포/migration의 적용 상태를 확인한다. 기존 미커밋 작업은 보존한다. 과거 centerMcp 초안을 완성품으로 취급하거나 자동 배포하지 않는다. 특히 pending migration 파일과 live:true 세션 stub, 시간차 기반 동의 추정, 모든 중첩 기간 차단을 명세대로 처리한다.

P0~P5 순서로 진행하되 제공자 검증 대기 중에도 합성 계산/계약/UI 작업은 진행한다. 지정된 도구·지표·권한·오류 계약과 수용 검사를 구현한다. 관리자 JWT를 그대로 ChatGPT에 전달하거나 source 오류를0으로 바꾸거나 부족한 사건 이력을 추정하지 않는다. 새 auth provider/AI server/vector DB/warehouse를 임의로 추가하지 않는다.

실제 구현과 검증 결과를 docs/center-integration/validation.md에 기록한다. 로컬에서 npm run dev로 화면을 확인하고 관련 검사와 build를 통과시킨다. production schema/Auth 설정/배포는 검토 가능한 코드와 영향 확인을 먼저 완성한 뒤 프로젝트 규칙에 따른 명시적 승인을 받는다. 이 프롬프트 자체는 production 변경 승인이 아니다.

최종 보고에는 구현한 기능, 실제 통과한 검사, 확인되지 않은 제공자 계약, 운영 적용 여부, 남은 정확한 단계를 구분해 적어라.
```
