# 센터 통합 기능 구현 계약

[설계 개요](./README.md)와 함께 적용한다. 아래 이름·상태·입출력은 목표 계약이며 아직 배포된 API라고 간주하지 않는다. 구현 중 변경이 필요하면 이유와 호환성 영향을 이 문서에 먼저 기록한다.

## 1 배치와 모듈 경계

### 배포 단위

- `supabase/functions/center-api/index.ts`: MCP, 관리자용 분석 HTTP, 연결 관리 경로를 조립하는 얇은 진입점.
- `supabase/functions/_shared/centerAnalysis/`: 데이터 조회·정규화·분석·공개 정책. MCP/Slack/React import 금지.
- `supabase/functions/_shared/centerIntegration/`: OAuth 검사, 웹/Slack 신원 변환, 연결 저장소, MCP/HTTP 어댑터.
- 기존 `slack-tsf`: Slack 서명을 검증하고 공통 서비스를 호출. OpenAI API 호출은 이 기존 경로에만 존재.
- 기존 React 앱: OAuth 동의 화면과 공통 분석 HTTP client. 관리자 설정 메뉴에는 이 기능의 새 항목을 추가하지 않는다.

기능마다 Edge Function을 만들지 않는다. SDK는 Deno의 fetch 기반 요청/응답에 호환되는 공식 구현을 선택하고 정확한 버전을 고정한다. MCP SDK·JOSE·Supabase SDK·pg 의존성은 `deno.json`/lock과 로컬 테스트 환경에서 일치시킨다. 웹앱 전체 의존성을 무조건 최신으로 올리지 않는다.

### 경로

기본 URL은 `https://<project-ref>.supabase.co/functions/v1/center-api`다.

| 경로 | 인증 | 동작 |
| --- | --- | --- |
| `/health` | 없음 | 정적 readiness 정보만. 내부 DB·계정·secret 정보 없음 |
| `/mcp` | MCP 전용 OAuth access token | Streamable HTTP, 도구 실행 |
| `/mcp/.well-known/oauth-protected-resource` | 없음 | 고정 resource와 OAuth issuer 안내 |
| `/v1/analysis/<operation>` | 검증된 웹앱 관리자 세션 | 등록된 분석 operation만 POST |
| `/v1/connections` | 검증된 웹앱 관리자 세션 | 자기 연결 목록 GET |
| `/v1/connections/prepare` | 검증된 웹앱 관리자 세션 | 동의 요청 검증 POST |
| `/v1/connections/complete` | 검증된 웹앱 관리자 세션 | native 동의 완료 확인 POST |
| `/v1/connections/<id>/revoke/begin` | 검증된 웹앱 관리자 세션 | 로컬 권한을 먼저 차단 POST |
| `/v1/connections/<id>/revoke/confirm` | 검증된 웹앱 관리자 세션 | native 철회 완료를 확인해 확정 POST |

`/mcp`의 canonical resource와 issuer는 환경 설정의 정확한 문자열로 검증한다. 이전 `center-statistics-mcp` URL이 실제로 사용 중이면 운영 이관 계획을 먼저 만든다. 기존 client/callback을 무조건 새로 생성하지 않는다. 이전 URL에서 새 OAuth 토큰을 무검증으로 전달하는 redirect는 만들지 않는다.

새 함수에만 gateway `verify_jwt=false`를 사용하고 각 경로에서 인증을 수행한다. 나머지 함수의 gateway 설정은 이번 변경 대상으로 삼지 않는다. CORS는 웹 경로에 기존 웹앱 origin, 로컬 환경에서만 localhost:5173을 허용한다. MCP는 Origin이 있으면 허용 목록을 검사하되 서버 간 요청에는 Origin이 없을 수 있다. CORS를 인증으로 취급하지 않는다.

## 2 인증과 권한

### 연결 관리 HTTP 계약

모든 POST는 JSON이며 unknown key를 거절한다. body로 사용자·역할·client·callback·권한을 지정하지 않는다. 계정은 검증된 웹 세션, client와 callback은 해당 native authorization 요청에서만 결정한다.

| 요청 | body | 성공 응답 data |
| --- | --- | --- |
| GET connections | 없음 | `{connections:[{id,client_label,state,capabilities,consented_at,revoked_at}]}`; 본인 연결만 |
| POST prepare | `{authorization_id:string}` | `{request_id,client_label,capabilities,expires_at}` |
| POST complete | `{request_id:string}` | `{connection_id,state:'active'}`; native 승인 증명 검사 후만 성공 |
| POST revoke | `{}` | `{connection_id,state:'revoke_pending'|'revoked'}`; 두 상태 모두 즉시 접근 불가 |
| POST reconcile-revocation | `{}` | `{connection_id,state:'revoke_pending'|'revoked'}` |

성공 응답은 해당 operation의 고정 JSON 객체이고 실패 응답은 `{error:{code}}`다. prepare의 authorization_id는 native SDK가 반환한 값 그대로 길이 1..512로 제한한다. request_id와 connection_id는 서버 발급 UUID다. 재시도는 같은 요청에 대해 멱등 처리하며, 만료·다른 계정의 request_id는 거절한다. redirect URL은 브라우저가 native SDK에서 받은 결과를 이용하고 관리 API는 임의 URL을 반환하지 않는다. master의 다른 계정 철회는 v1 UI/API에 노출하지 않는다. 이 경로는 OAuth 동의 화면을 위한 내부 경계이며 관리자 설정 메뉴에 노출하지 않는다.

### 반드시 구분할 세 가지

1. 웹 로그인: 기존 account-auth가 검증한 관리자.
2. OAuth 동의: 그 관리자가 센터 앱에 허용한 접근.
3. 도구 권한: 해당 채널과 연결에서 실행할 수 있는 분석.

OAuth SDK의 `getSession()` 결과, JWT decode, 브라우저의 role, 공개 users의 이름/관리자 표시는 서버 권한 증거가 아니다. `verifiedSession.mjs`는 현재 일반 웹앱 audience/role을 요구하므로 MCP 토큰에 그대로 사용하지 않는다. 현재 `sessionReadStore.loadLiveSession`의 `live:true` 반환 역시 실제 철회 검사로 인정하지 않는다.

### ActorContext

신뢰된 서버 어댑터만 생성한다. HTTP body나 MCP input으로 받지 않는다.

```ts
type ActorContext = {
  profileId: string;           // 내부 전용
  authUserId: string;          // 내부 전용
  channel: 'chatgpt' | 'slack' | 'web';
  connectionId: string | null;
  providerSessionId: string | null;
  capabilities: ('analytics.read' | 'programs.read')[];
  dataScope: 'center';         // 첫 버전은 현재 프로젝트의 센터 범위 하나
  disclosureProfile: 'operator' | 'slack_dm';
  grantVersion: number;
  credentialVersion: number;
};
```

`center`는 지역/지점 다중 권한이 구현되었다는 뜻이 아니다. 현재 프로젝트의 승인된 데이터 범위다. 다른 센터를 추가할 때는 데이터 소속 키와 서버 필터부터 추가해야 하며 요청의 center_id만 신뢰하지 않는다.

### 전용 토큰 격리

Supabase 기본 OAuth 토큰은 일반 DB 접근에 사용될 수 있다. `openid` 같은 OIDC scope는 DB 읽기 전용 권한이 아니다. 다음 격리를 구현한다.

- 전용 OAuth client의 access token만 `aud=<canonical MCP resource>`, `role=center_integration_token`으로 발급.
- `center_integration_token`: NOLOGIN/NOBYPASSRLS/NOINHERIT, 업무 테이블·뷰·함수 권한 없음. `authenticator`에 역할 membership을 주지 않는다.
- 일반 웹앱 access token은 기존 audience·role·claims를 유지.
- 전용 client가 비활성·잘못된 사용자·미승인 상태여도 일반 `authenticated` 토큰으로 돌아가지 않는다. 제한 역할과 빈 권한으로 발급하거나 발급을 거절한다.
- DB 원본 및 PUBLIC 실행권한이 있는 SECURITY DEFINER RPC, Storage, 기타 관리자 Edge Function에서 이 토큰이 거절되는지 실제로 검사한다. audience 변경만으로 격리가 됐다고 선언하지 않는다.
- MCP 서버가 받은 토큰을 PostgREST·Storage·다른 API 호출에 전달하지 않는다.

표준 Supabase Custom Access Token Hook을 **전용 client에 한정**해 사용한다. 인증 서버를 직접 구현하지 않는다. Hook의 입력/출력과 지원 claim은 실제 SDK/프로젝트 발급으로 검증한다.

필수 claims를 보존하고 추가할 claims는 다음으로 고정한다.

```ts
{
  aud: '<canonical MCP resource>',
  role: 'center_integration_token',
  client_id: '<registered client>',
  center_connection_id: '<opaque connection UUID>',
  center_grant_version: 1,
  center_credential_version: 1,
  center_permissions: ['analytics.read', 'programs.read']
}
```

해당 client가 아닌 로그인은 Hook의 기존 결과를 보존한다. 기존 Hook이 있으면 결과를 조합한다. Hook 선택을 덮어써서 다른 로그인 규칙을 제거하지 않는다. client 식별자를 찾을 수 없는 refresh 계약은 출시 차단이며 역할을 완화하지 않는다. 해지한 client 기록은 tombstone으로 남겨 제한 토큰 발급 규칙이 사라지지 않게 한다.

OIDC 요청 scope는 검증된 native `openid`를 기본으로 한다. 임의의 `analytics.read` OAuth scope가 Supabase에서 지원된다고 가정하지 않는다. 애플리케이션 권한은 위 signed claim과 현재 DB grant의 교집합으로 검사한다. `openid` scope를 데이터 권한으로 해석하지 않는다.

### 동의 흐름

1. ChatGPT가 Supabase authorize로 이동. 정확히 등록한 callback, PKCE S256, resource를 사용.
2. `/oauth/consent?authorization_id=...`에서 기존 `AuthProvider`/로그인 경로 사용. 비밀번호를 ChatGPT나 MCP 서버 자체 폼으로 받지 않음.
3. native `getAuthorizationDetails`로 요청 표시. 서버 `prepare`가 웹 세션의 서명·현재 상태·기존 assurance·계정 1:1 매핑·역할·초기 허용 목록을 검사.
4. `prepare`는 native 요청의 client, resource, callback, 사용자, 허용 scope, 상태와 만료를 서버에서 확인하고 private `consent_requests`를 저장. body의 client/user/role을 신뢰하지 않음.
5. 관리자가 승인하면 브라우저가 native `approveAuthorization(..., {skipBrowserRedirect:true})` 실행.
6. 서버 `complete`가 저장된 요청과 native의 실제 approved 상태를 대조한 후 connection을 active로 설정. **그 다음에만** 승인 결과의 정확한 callback으로 이동.
7. ChatGPT가 코드를 교환. Hook이 active connection에 해당하는 제한 토큰을 발급.

이미 동의한 native 요청이 자동 승인 URL을 반환하는 경우에도 입력 authorization_id에 대한 prepare/complete 검증을 거친다. approved 상태이면 native approve를 중복 호출하지 않는다. native API가 이 상태의 식별자/사용자를 검증할 수 없으면 새 동의를 시작하도록 표시하고 우회하지 않는다.

native authorization과 웹 동의는 authorization_id로 정확히 연결한다. 세션 생성 시각과 승인 시각이 몇 초 차이 나는지로 동의를 추정하지 않는다. connection은 **관리자와 등록된 client 간의 지속 접근 위임**이다. 특정 ChatGPT 계정의 신원을 Supabase가 증명한다고 주장하지 않는다.

`prepare`/`complete`는 같은 authorization_id에 대해 멱등적이다. 재시도는 기존 결과를 반환하되 revoked 상태를 되살리지 않는다. pending 동의 실패가 이미 active인 별도 연결을 끊어서는 안 된다. 준비 기록 만료는 10분 또는 native 만료 중 더 짧은 값이다.

### 매 도구 호출의 권한 검사

1. 표준 JOSE로 서명·고정 issuer·정확한 audience·허용 알고리즘·exp/nbf/iat·client_id·session_id 확인. ID token과 일반 웹 JWT 거절.
2. private connection 상태, 권한 version, credential version, 현재 계정 mapping/status/must_change_password/역할 확인.
3. native client·grant·session의 현재 유효성 확인. 순수 JWT 검증만으로 철회 반영을 주장하지 않음.
4. signed permission ∩ 현재 connection permission ∩ 채널 권한으로 ActorContext 생성.
5. 분석 전과 결과 반환 직전에 현재 권한 확인. 캐시 조회도 동일. 반환 직전 확인 뒤의 네트워크 전송까지 원자적인 철회를 보장한다고 주장하지 않음.

native live 상태는 문서화된 API가 이 토큰 유형으로 제공하는지 먼저 검증한다. 첫 구현의 fallback은 **실제 catalog로 열/타입을 확인한 private `native_connection_state` 뷰**다. 이 뷰만 native Auth 테이블을 제한적으로 읽으며, 토큰/코드/refresh hash/IP/UA를 노출하지 않는다. OAuth 내부 테이블을 수정하거나 광범위 SELECT 권한을 부여하지 않는다. 정확한 join 조건은 검증된 `session_id + auth_user_id + client_id`와 현재 grant 상태다. 시간 근접성 join은 금지한다.

이 프로젝트에서 지원 API와 private 뷰 어느 쪽으로도 live 유효성을 증명하지 못하면 인증 수용 실패로 기록한다. 네트워크/DB 실패 때 마지막 성공한 권한으로 계속 서비스하지 않는다.

### 해제와 관리자 권한 변경

- 해제 요청은 먼저 `/revoke/begin`으로 로컬 connection을 `revoke_pending`으로 바꾸고 grant_version을 증가시킨다. 그 순간 이후 새 호출을 거절한다. native OAuth 철회 후 `/revoke/confirm`으로만 `revoked`를 확정한다.
- 이후 기존 웹 로그인으로 native `revokeGrant(clientId)` 수행. 서버는 native 철회 완료를 확인해 `revoked` 확정. native 실패 시 로컬 차단 유지하고 재시도 상태 표시.
- `revoke_pending` 연결은 재활성화 불가. 기존 native 세션/권한 철회를 확인한 뒤 새 동의 흐름을 시작.
- 계정 차단/탈퇴/관리자 역할 해제/credential_version 증가 시 연결을 취소 상태로 전환. 현재 상태 검사로 즉시 차단하고, 해당 변경 트랜잭션의 제한된 trigger 또는 기존 서버 서비스로 연결 취소를 보존. 역할이 나중에 복구되어도 과거 연결이 자동 재활성화되지 않게 함.
- 일반 웹 로그아웃은 브라우저 세션 종료이며 지속 연결 해제와 구분. “모든 연결 해제”는 명시적 동작으로 제공.
- ChatGPT UI에서 앱 삭제만 했을 때 native grant가 철회되는지는 실제 클라이언트로 확인. 서버가 확인하지 못하는 동작을 즉시 철회라고 표시하지 않음.
- 현재 권한 검사는 성공 결과를 cross-request 캐시하지 않음. JWKS의 공개키만 TTL과 key-rotation 재시도를 갖고 캐시.

### 채널별 권한

| 채널 | 신원 근거 | 첫 릴리스 범위 |
| --- | --- | --- |
| ChatGPT | 위 OAuth + connection | 초기 지정 관리자만 통합 분석 |
| 웹 | 기존 검증 로그인 + 현재 역할 | pilot 허용 관리자에게 새 공통 분석 제공 |
| Slack | 검증된 Slack 서명/team/user + private `external_identities` 연결 + 현재 관리자 역할 | 통합 분석은 연결된 운영자의 DM만. 공개·그룹 채널로 자동 전달 금지 |

Slack user ID와 센터 profile의 연결은 보호된 운영자 설정으로 등록한다. 표시 이름/이메일/사용자가 입력한 profile ID로 연결하지 않는다. 기존 Slack의 공용 요약 기능은 별도의 기존 범위로 남겨 두고, 새 통합 분석 권한을 자동 상속시키지 않는다. 웹과 Slack은 MCP OAuth 토큰을 가져다 쓰지 않는다.

## 3 데이터 저장과 DB 권한

### 새 private 객체

다음은 논리 스키마다. 실행 SQL은 실제 운영 catalog의 키/타입/enum/role/기존 적용 이력을 확인한 뒤 별도 migration으로 작성한다. 자동 적용 폴더에 검토용 SQL을 두지 않는다.

| 객체 | 최소 필드와 제약 | 용도 |
| --- | --- | --- |
| `center_integration.settings` | singleton PK, enabled=false, pilot_profile_ids, disclosure_version | 전체 차단과 초기 허용 목록. 클라이언트 수정 불가 |
| `center_integration.clients` | client_id PK, resource UNIQUE, issuer, redirect_uris, enabled, retired_at | 승인된 OAuth client registry와 tombstone |
| `center_integration.connections` | id UUID PK, auth_user_id, profile_id, client_id FK, state, capabilities, grant_version>=1, credential_version, consented_at, revoked_at, UNIQUE(auth_user_id,client_id) | 지속 위임. secret/token 저장 없음 |
| `center_integration.consent_requests` | authorization_id PK, connection_id, verified_website_session_id, credential_version, state, created_at, expires_at, completed_at | trusted 웹 동의와 native 요청 결합 |
| `center_integration.external_identities` | channel, team_id, external_user_id, profile_id, enabled, UNIQUE(channel,team_id,external_user_id) | Slack 관리자 연결 |
| `center_integration.audit_events` | id, request_id, actor_profile_id, connection_id, channel, operation, normalized_query_hash, status, duration_ms, created_at | 요청·허용·거절 감사. 토큰/개인행/자유서술 저장 금지 |
| `center_integration.runtime_state` | key PK, kind(rate_limit/cache), scope_hash, expires_at, bounded payload | 원자적 호출 제한 및 선택적 결과 캐시 |
| `center_analytics.*` 뷰 | 아래 허용 projection | 읽기 전용 내부 사실과 승인된 집계 |

`connections.state`: `pending`, `active`, `revoke_pending`, `revoked`. 상태 전이는 서버만 수행한다. grant 생성/확대는 verified consent 경로, 차단은 현재 계정 검사와 관리 경로로 수행한다. 분석 경로에는 grant 변경 권한이 없다.

초기 운영자와 client 등록 값은 운영 배포 시 검증된 값으로 private 저장소에 주입한다. migration 소스에 실제 사용자 UUID·비밀값을 넣지 않는다.

### DB 역할

- `center_analysis_reader`: 로그인 가능한 전용 서비스 역할. `center_analytics` 허용 뷰와 연결 상태의 제한 projection SELECT만. 업무 테이블 INSERT/UPDATE/DELETE/DDL, 임의 RPC 실행권한 없음.
- `center_integration_worker`: 연결 관리·audit·runtime_state의 필요한 제한 DML만. 업무 데이터 쓰기 없음. 경로마다 고정 SQL 사용.
- `center_analysis_view_owner`: NOLOGIN/NOBYPASSRLS. 뷰를 계산하는 데 필요한 원본 열 SELECT와 전용 RLS 정책만. 로그인 서비스 역할에 membership을 주지 않음.
- `center_integration_token`: OAuth JWT용 무권한 NOLOGIN 역할. DB reader가 아님.
- 관리형 Auth Hook과 연결 상태 뷰의 소유자는 필요한 private 열만 읽는 역할로 분리. SECURITY DEFINER가 필요하면 search_path 고정, PUBLIC 실행 회수, 동적 SQL 금지.

가능한 배포 연결은 `CENTER_ANALYSIS_DATABASE_URL`, `CENTER_INTEGRATION_DATABASE_URL` 두 개다. 같은 DB의 권한이 다른 접속 정보이며 추가 DB 인스턴스를 의미하지 않는다. 별도 접속 비밀값이 없을 때 `SUPABASE_DB_URL`의 postgres 권한으로 자동 fallback하지 않는다. `SET ROLE`만 하고 원래 postgres 자격을 보유하는 것을 최소 권한 접속이라고 보고하지 않는다.

원본 테이블 RLS는 유지한다. 필요한 추가 정책은 view owner 역할에 한정하고 `anon`/`authenticated` 정책을 넓히지 않는다. 뷰의 owner/invoker/security_barrier와 restrictive/forced RLS의 실제 효과를 SQL 검사한다. 원본 데이터를 외부 앱 전체에 공개하는 public view를 만들지 않는다.

PUBLIC 함수 실행권한·기본 권한 상속도 권한 감사 범위다. `default_transaction_read_only`나 코드의 READ ONLY만으로 침해된 DB 자격의 쓰기를 막았다고 주장하지 않는다. 역할의 실제 ACL과 노출 경로를 함께 검사한다.

### 내부 사실 뷰와 데이터 최소화

외부에서 원본 테이블을 선택하게 하지 않는다. 공통 저장소에는 정해진 질의 템플릿만 둔다. SQL 값은 전부 parameter binding, 정렬/열/뷰 이름은 서버 enum으로 결정한다.

| 사실 | 확인된 원천 | 내부 필요 필드/규칙 |
| --- | --- | --- |
| 이용자 분류 | users, staff_directory | id, user_group, role. 이름·연락처·학교·생년월일 없음 |
| 방문 | logs, locations | event id, user_id, type, location_id, created_at, 유효 공간. 기간 및 대상 이벤트로 먼저 제한 |
| 프로그램 | notices | id, category, program_date, status, recruiting; capacity는 실제 max_capacity 의미 검증 후 추가 |
| 신청 | notice_responses | notice_id,user_id,status,is_attended,is_staff. 시각/출처는 실제 존재와 의미 확인 후 추가 |
| 회차 | daily_program_sessions, daily_program_session_responses | id,notice_id,date,status,voided_at,capacity 및 응답 최소 열 |
| 개방형 참석 | open_program_attendance | notice_id,user_id,attendance_date |
| 만족도 | program_feedback, survey_entries, 설문 definition/snapshot | 허용된 만족도 질문의 숫자만 projection. 응답 원문·자유서술 JSON을 Edge/모델로 내보내지 않음 |
| 대여 | rental_bookings, rentals | id,rental_id,booking_date,status 및 승인된 공간명. user 연결 존재를 가정하지 않음 |
| 포인트/스토어 | haifn_transactions, store_orders | id,amount,type/status,created_at. 증감 부호·환불·취소 의미 확인 후 집계 |
| 설문 제출 | checkin_surveys, survey_entries, program_feedback | source,submission id,종류,제출 시각,프로그램 관계. 이중 저장 중복 처리 확인 |

통합 분석을 위해 내부 사실 뷰에는 개인 연결키가 필요하다. reader가 개인 행을 전혀 읽지 않는다는 약속과 구분한다. **전용 서버 내부에서 제한된 키와 사실을 읽고, ChatGPT·Slack 결과에는 내보내지 않는 구조**다. 순방문자·재방문율은 단순 일별 합계만으로 정확히 계산할 수 없다.

뷰/질의는 전체 users와 전체 응답을 매번 읽지 않도록 기간과 프로그램으로 대상 사실을 먼저 좁힌다. cohort 구성에 필요한 내부 사용자 키만 join한다. 원본 이름·내용 필드가 들어간 기존 관리자 `.select('*')`와 Slack 결과를 그대로 재사용하지 않는다.

설문 숫자 추출은 DB projection에서 질문 종류와 metric을 확인한다. legacy custom feedback의 합성 q3=5를 만족도 응답으로 세지 않는다. 구형/신형의 동일 제출을 연결할 authoritative key가 없으면 별도 계열로 보고하고 임의로 합치지 않는다.

### 조회 완전성

- 동일 분석 요청의 모든 영역을 REPEATABLE READ READ ONLY snapshot에서 읽는다. SQL에서 일관된 집계를 끝내거나, 같은 snapshot의 keyset 페이지를 읽은 뒤 순수 계산한다.
- 페이지 크기 기본 500. 정렬키와 PK tie-breaker를 고정. offset과 불안정한 정렬 사용 금지.
- 실행 상한 도달·페이지 실패·키 충돌·필수 열 누락은 `source_incomplete`. 잘린 결과로 전체 합계나 비율을 반환하지 않음.
- 실제 빈 데이터는 count=0, 분모0 비율/평균=null. 오류를 빈 배열로 바꾸는 기존 helper는 재사용 금지.
- 큰 결과를 브라우저/LLM에 전달해 join하도록 하지 않음.
- 새로운 앱 RPC는 기본적으로 만들지 않고 parameterized DB queries/views를 사용. 기존 RPC를 사용해야 한다면 AGENTS.md에 따라 동일 권한·필터·분모를 보존하는 직접 테이블 조회 fallback을 구현. 인증 실패/권한 거절/불완전 결과에 대해 권한을 넓히는 fallback은 금지.

## 4 분석 요청과 응답

### 공통 입력

모든 객체는 unknown key 거절. 날짜는 유효한 ISO `YYYY-MM-DD`, timezone은 서버의 `Asia/Seoul` 고정이다. 미래 기간 시작·start>=end 거절. 날짜 문자열을 시스템 locale로 해석하지 않는다.

```ts
type Period = { start: string; end_exclusive: string };
type CommonQuery = {
  period: Period;
  comparison?: { kind: 'previous_equal_length' } | { kind: 'previous_calendar_period'; unit: 'week' | 'month' };
};
```

주 비교는 월요일 시작의 완전한 주, 월 비교는 첫날~다음 달 첫날 입력에만 허용한다. 다른 기간이면 명시적인 이전 동일 일수 비교를 사용한다. 진행 중 월의 전체 전월과 비율을 비교하면 관찰일수가 다름을 표시한다. 임의 시간대·SQL·회원 ID·필터식·전체 raw export 입력은 없다.

### 도구 목록

등록 목록은 이 7개다. ChatGPT와 웹의 operation 이름을 동일하게 사용한다. `get_analysis_capabilities`와 `get_program_catalog`를 제외한 도구는 analytics.read, catalog는 programs.read, capabilities도 인증 필수다.

| 도구 | 입력 | 결과 |
| --- | --- | --- |
| `get_analysis_capabilities` | `{}` | 지표 정의 버전, 지원 분석, 데이터 기간/한계, 허용 필터·기간 상한. DB 테이블·비밀값 없음 |
| `get_operation_summary` | CommonQuery + `domains?: ['visits','duration','programs','feedback','rentals','store','surveys']` | 기간별 영역 집계와 비교. 기본 visits,duration,programs |
| `get_program_catalog` | `query?:string<=100`, `period?:Period`, `limit?:1..20` | 승인된 program_ref, 제목, 일정, 모집 상태, 공개 안내. 개인/원문 응답 없음 |
| `analyze_program_engagement` | CommonQuery + `program_refs?:string[1..20]`, `breakdown:'none'|'program'`, `measures?:['applications','recorded_attendance','satisfaction','participation_distribution','transitions']` | 프로그램별 참여·숫자 만족도, 참여 개수 분포, 기록상 이동 |
| `analyze_revisits` | `period`, `cohort:'visitors'|'program_attendees'`, `program_refs?:string[1..20]`, `followup_days:7|14|30` | 관찰 완료/미완료 인원, 재방문 인원과 비율 |
| `analyze_program_visit_change` | `period`, `program_refs:string[1..20]`, `window_days:7|14|28|30`, `measures?:['visitor_days','visit_sessions','measured_duration']` | 같은 참석자 전후 변화와 이용 가능한 분모 |
| `get_metric_definitions` | `metric_ids?:string[1..30]` | 계산 기준, 포함/제외, 분모, 제한, 버전. private schema 정보 없음 |

기본 program engagement measures는 applications,recorded_attendance,satisfaction이다. program_refs 생략은 허용된 전체 프로그램. catalog에서 받은 ref만 서버에서 재확인해 처리하고 미존재/미허용 ref로 데이터 존재 여부를 누출하지 않는다. visitors cohort에 program_refs를 주거나 program_attendees에 비어 있는 refs를 주면 invalid_input.

breakdown, cohort, followup_days, window_days는 명시적 필수 입력이다. visit_change의 기본 measures는 세 항목 모두, catalog limit 기본값은 20이다. program_ref는 서버가 반환한 비개인 문자열(1..64자)이며 중복 refs와 빈 measures/domains 배열은 거절한다. comparison 생략 시 비교하지 않는다. get_metric_definitions의 IDs 생략 시 전체 등록 정의를 반환한다.

transitions는 program_refs를 기준으로 원천 sequence를 먼저 필터링해 가짜 A→C 전환을 만들지 않는다. 전체 허용 sequence에서 연속 pair를 만든 뒤 양 끝이 선택 목록에 든 edge만 선택한다. 분모도 실제 분석 대상과 함께 정의한다.

도구 수를 줄이려고 임의 JSON query/SQL 실행 도구 하나로 합치지 않는다. 추가 분석은 별도 계약과 수용 fixture를 추가한다. 도구 description에는 사용 목적·상태 기준·불가능한 해석을 짧게 기록한다.

### 출력 형식

```ts
type AnalysisResult = {
  schema_version: 'center-analysis.v1';
  definition_version: string;
  request_id: string;
  status: 'ok' | 'partial' | 'unavailable' | 'error';
  as_of: string; // 결과를 계산한 실제 기준시점. 요청자가 지정할 수 없음
  timezone: 'Asia/Seoul';
  period?: Period;
  basis: 'recorded_current_state';
  cache: { hit: boolean; generated_at: string; expires_at: string | null };
  data: Record<string, unknown>; // operation별 고정 스키마
  quality: {
    status: 'complete' | 'limited' | 'incomplete';
    observation_start: string | null;
    observation_end_exclusive: string | null;
    reasons: string[];
  };
  warnings: { code: string; message: string }[];
  sources: { label: string; url?: string }[]; // 관리자 화면 등 검증된 앱 URL만
  error?: { code: string; retryable: boolean };
};
type Metric = {
  status: 'available' | 'limited' | 'suppressed' | 'unavailable';
  value: number | null;
  unit: 'people' | 'sessions' | 'days' | 'minutes' | 'count' | 'points' | 'ratio' | 'rating';
  numerator?: number | null;
  denominator?: number | null;
  reason?: string;
};
```

Metric별 value와 numerator/denominator의 공개는 하나의 정책으로 검사한다. 숨긴 값을 다른 필드로 복원할 수 있게 내보내지 않는다. duration 배열·개별 IDs·첫/마지막 개인 방문 시각은 출력 스키마에 없다. 프로그램 ref는 비개인 리소스 식별자로 허용한다.

### operation별 data 계약

`Record<string, unknown>`는 설명용 공통 표기다. 구현에서는 다음 구조별 strict schema와 MCP outputSchema를 선언한다. 동적 metric 키는 등록된 정의 enum만 허용한다. count·mean·변화량도 전부 Metric을 사용해 공개 제한을 동일하게 적용한다. 배열은 결과가 없으면 `[]`, 사용할 수 없는 숫자는 이유가 있는 Metric(null)로 표시한다.

| operation | 고정 data 구조 |
| --- | --- |
| get_analysis_capabilities | `{operations:[{name,max_period_days,allowed_measures}],available_metric_ids:string[],coverage:[{domain,start,end_exclusive,status,reason}],limitations:string[]}`; 범위 미검증은 null |
| get_operation_summary | `{periods:[{period,metrics:{[metric_id]:Metric}}],comparisons:[{metric_id,absolute_change:Metric,relative_change:Metric}]}`; 현재 기간 먼저, 비교 없으면 comparisons=[] |
| get_program_catalog | `{programs:[{program_ref,title,scheduled_date:null|string,recruitment_status,public_description:null|string}],has_more:boolean}`; 자유서술 응답은 public_description에 포함 금지 |
| analyze_program_engagement | `{periods:[{period,totals:{[metric_id]:Metric},programs:[{program_ref,metrics:{[metric_id]:Metric}}],participation_distribution:[{bucket:'1'|'2'|'3_plus',people:Metric}],transitions:[{from_program_ref,to_program_ref,people:Metric}]}]}`; breakdown=none이면 programs=[], 미요청 분석 배열=[] |
| analyze_revisits | `{cohort_size:Metric,observation_complete:Metric,observation_pending:Metric,revisited_people:Metric,revisit_rate:Metric}` |
| analyze_program_visit_change | `{cohort_size:Metric,changes:[{measure,paired_people:Metric,excluded_people:Metric,before_mean:Metric,after_mean:Metric,mean_change:Metric}]}`; 동일 paired 집단의 사람별 차이를 평균 |
| get_metric_definitions | `{definitions:[{metric_id,label,unit,calculation,inclusions:string[],exclusions:string[],denominator:null|string,limitations:string[],version}]}` |

catalog의 recruitment_status는 `open|closed|unknown`이다. 지표 registry에는 domain과 source 요구사항도 내부적으로 선언하고 계약 테스트에서 등록되지 않은 키를 거절한다. metric 목록·도메인 매핑과 세부 기대값은 P1에서 아래 지표 정의를 기준으로 확정하고, 이후 adapter마다 다른 키를 만들지 않는다. 오류 응답의 data는 `{}`이며 성공 스키마와 별도 union으로 선언한다.

`ok`: 요청한 필수 지표가 모두 사용 가능. `partial`: 독립된 영역 일부가 unavailable/limited/suppressed이며 성공한 영역은 각각 완전하게 계산됨. `unavailable`: 유용한 요청 지표가 없음. `error`: 입력/인증/실행 오류. 소스 일부를 못 읽은 같은 지표를 partial 숫자로 반환하지 않는다.

`as_of`는 DB snapshot의 조회 시점이지 과거 상태 재현 시점이 아니다. 과거 기간의 신청·출석 상태가 현재 수정되어 있으면 `recorded_current_state`로 표시한다. 근거 없는 `confirmed`/`historical_as_of` 상태를 만들어 내지 않는다.

DB 시계로 snapshot 기준시각을 정한다. SQL 전체 페이지를 읽었다는 사실만으로 사건 수집의 완전성을 입증하지 않는다. 관찰 가능 기간은 확인된 수집 시작/중단 기록 등 근거로 판단하고, 근거가 없으면 coverage를 unknown으로 표시하며 관찰 완료가 필요한 확정 재방문율은 unavailable로 둔다. 단순 기록 기반 방문 합계는 한계를 표시해 제공할 수 있다. fixture의 coverage 값을 운영 환경 기본값으로 복사하지 않는다.

웹 API의 응답과 MCP structuredContent는 같은 결과 구조를 사용한다. 인증 오류는 HTTP 401/403 및 MCP 인증 challenge로 표현. 업무 unavailable/partial은 정상 tool 결과와 명시적 status로 표현하고, 실패를 자연어 성공 메시지로 바꾸지 않는다.

### 결과 예시

아래는 합성 데이터이며 운영 결과가 아니다.

```json
{
  "schema_version": "center-analysis.v1",
  "definition_version": "2026-10-v1",
  "request_id": "synthetic-request-1",
  "status": "partial",
  "as_of": "2026-02-01T00:00:00+09:00",
  "timezone": "Asia/Seoul",
  "period": {"start":"2026-01-01","end_exclusive":"2026-02-01"},
  "basis": "recorded_current_state",
  "cache": {"hit":false,"generated_at":"2026-02-01T00:00:00+09:00","expires_at":null},
  "data": {
    "cohort_size": {"status":"available","value":28,"unit":"people"},
    "observation_complete": {"status":"available","value":20,"unit":"people"},
    "revisited_people": {"status":"limited","value":10,"unit":"people","reason":"recorded_attendance_basis"},
    "revisit_rate": {"status":"limited","value":0.5,"unit":"ratio","numerator":10,"denominator":20,"reason":"recorded_attendance_basis"},
    "observation_pending": {"status":"available","value":8,"unit":"people"}
  },
  "quality": {"status":"limited","observation_start":"2025-12-01","observation_end_exclusive":"2026-02-01","reasons":["recorded_attendance_basis"]},
  "warnings": [{"code":"observation_pending","message":"추적 기간이 끝나지 않은 8명은 재방문율 분모에서 제외했습니다."}],
  "sources": [{"label":"센터 기록 기반 재방문 분석"}]
}
```

실제 사용자 메시지는 한국어로 작성한다. `error.code`는 고정 enum: `invalid_input`, `unauthenticated`, `forbidden`, `connection_revoked`, `not_configured`, `source_incomplete`, `unsupported_metric`, `observation_incomplete`, `privacy_suppressed`, `rate_limited`, `analysis_too_large`, `timeout`, `temporarily_unavailable`. 외부에 SQL·토큰·DB 에러 전문을 반환하지 않는다.

## 5 지표 정의

### 공통

- KST 시작 포함/끝 제외. 주는 월요일. 로그는 snapshot 시각 이후 제외.
- 직원 제외는 canonical staff role 기준. 일반 회원과 게스트/미가입은 구분하여 계산하되 개인 추적 가능성은 별도로 표시.
- 사용자 ID가 회원 통합으로 바뀌는 경우 검증된 merge mapping이 있으면 적용. 이름/전화로 추측 연결 금지. 안정된 연결키가 없는 게스트는 장기 재방문 분모에서 제외하고 제외 이유를 표시.
- 직원 분류가 현재 역할만 제공하면 과거에도 직원이었다고 확정하지 않고 current_role_exclusion 한계를 표시.
- 0분·누락·미확인을 하나의 0값으로 합치지 않는다. 비율은 0..1, 분모0이면 null. 전기값0 증감률은 null이며 신규 발생으로 표시.

| metric 또는 분석 | 고정 정의 |
| --- | --- |
| visit_sessions | KST 이용자·날짜별 유효 방문 세션. CHECKOUT 뒤 재입실은 새 세션. 중복 CHECKIN/게스트 보조 이벤트는 별도 방문으로 중복 합산하지 않음 |
| unique_visitors | 기간 전체 유효 세션의 이용자 키 distinct. 일별 unique 합산 금지 |
| visitor_days | 이용자×KST 날짜 distinct. 같은 날 재입실도 1일 |
| recorded_minutes | 유효 공간에서 MOVE/실제 CHECKOUT으로 끝나는 양수 측정 구간의 정수 분 합 |
| complete_duration | 실제 퇴실이 있고 양수 측정 시간이 있는 세션만 평균·중앙값. 실측 누락·0분·추정값 별도 |
| missing_checkout | 마지막 열린 구간은 실측 시간에 더하지 않음. 추정값을 제공한다면 estimate 전용 지표와 계산 규칙 표시 |
| current_applications | 현재 응답의 JOIN/WAITLIST/CANCELLED 각각. 이벤트 누적 횟수로 부르지 않음 |
| recorded_attendance | JOIN + is_attended, 개방형 날짜별 출석. 직원·폐기/취소 회차 제외. 회차로 전환된 프로그램의 전체 응답 중복 합산 금지 |
| participation_distribution | 기간 내 기록상 참석한 서로 다른 프로그램 수를 이용자별로 계산. 1개,2개,3개 이상. 동일 프로그램 여러 회차는 1개 프로그램 |
| satisfaction | 검증된 satisfaction 숫자 질문의 유효 1..5 응답만. 응답수·평균·분포. 응답 없음은 null. 합성 기본5점 제외 |
| revisit_rate | cohort index 다음날~followup_days번째 날의 다른 날 유효 방문 여부. 기간 내 첫 관측 방문/첫 해당 프로그램 참석이 index. 생애 최초 방문 아님 |
| observation_maturity | index + N + 1일 00:00 KST까지 실제 수집 가능해야 분모 포함. pending은 실패로 세지 않음 |
| before_after | 사람별 기간 내 첫 대상 참석일 기준 이전 N일/이후 N일, 기준일 제외. 같은 사람·양쪽 데이터가 있는 경우만 paired 비교 |
| duration_change | 양쪽 유효 실측이 있는 사람만 duration 분모에 포함. 방문일 변화 분모와 같다고 가정하지 않음 |
| program_transitions | 날짜 순 기록상 참석, 연속 같은 프로그램을 접고 인접한 서로 다른 프로그램 쌍을 사람별 1회 계산. 같은 날 순서 불명확한 사람은 전환 분석에서 제외 |
| rental_counts | booking_date 기준 현재 상태별 예약 건수. 실제 공간 이용률이나 이용시간으로 해석하지 않음 |
| store_counts | 생성일 기준 주문 건수와 현재 상태. 포인트 순증감과 매출을 혼동하지 않음 |

visit 세션 경계에서 기존 `visitUtils`와 `operationStatistics/aggregate`가 다른 경우 차이를 fixture로 문서화한 후 위 정의에 맞는 한 구현을 선택한다. 자정을 넘는 세션은 v1에서 KST 날짜 경계 처리 한계를 표시하고 별도 인과/정밀 체류 분석에 쓰지 않는다. GUEST_ENTRY의 실제 발생 패턴은 CHECKIN과 함께 생성되는지 fixture/스키마 근거로 확인한다.

엄밀한 사전신청자 출석률·현장참여 제외·당시 확정 상태·취소 시각 분석은 신청 출처와 사건 이력이 있어야 제공한다. 현재 자료가 부족하면 해당 지표만 unavailable. 단순 recorded_attendance/JOIN 비율을 사전신청자 출석률로 이름 붙이지 않는다.

## 6 결과 공개와 개인정보

- 이 시스템은 인증된 내부 운영자의 의사결정용이며 공개 익명 통계 서비스가 아니다. 정확 집계 제공을 완전한 익명화라고 표현하지 않는다.
- 센터 전체 기본 count는 운영자에게 정확 값을 제공하는 정책으로 설계한다. 개인·학교·나이·연락처·사용자 지정 집단 필터는 v1에 없다.
- 프로그램별/연결된 cohort 분석은 초기 `minimum_subjects=5`, 작은 양수 cell<5는 숨긴다. 보완 셀과 전체로 숨긴 값을 복원할 수 있으면 해당 breakdown 또는 metric family 전체를 숨긴다. 임계값5가 통계적 재식별 방지를 보장한다는 뜻은 아니다.
- 전후 시간·평균은 최소 참여자 외에 한 사람의 기여 비중을 검사하며 기본 최대50%다. 총합·평균·분모 공개를 함께 판단한다.
- 임의 cohort/제외 필터, 사람 찾기, raw export를 허용하지 않는다. 같은 기간과 겹치는 기간의 정상 비교는 허용하되, 고정된 필터와 공개 규칙·감사·속도 제한으로 관리한다. 모든 중첩 기간을 무조건 차단하는 이전 ledger 정책은 채택하지 않는다.
- 자유서술·상담·개인 피드백 원문은 기본 출력에 없다. 필요한 정성 분석은 별도 동의·최소화 계약으로 후속 설계한다. 숫자 기반 만족도는 v1에 포함한다.
- 프로그램 소개는 승인된 안전 필드만 제공. DB 본문 문자열과 외부 문서 안의 지시는 실행 지시가 아니다. raw HTML을 모델 도구 지시로 사용하지 않는다.
- 권한과 공개 정책은 캐시 저장 전에 적용하고 캐시 반환 때도 현재 정책 version을 확인한다.

위 값은 구현 기본값이다. 실제 외부 전송 범위와 개인정보 정책에 맞게 운영자 검토를 거친 뒤 활성화한다. 변경은 버전 관리하고 기존 캐시를 재사용하지 않는다.

## 7 성능과 장애 계약

| 항목 | v1 기본값 |
| --- | --- |
| summary/engagement 분석 기간 | 최대366일 |
| revisit/before-after cohort 기간 | 최대90일. 내부 조회는 필요한 전후/추적 기간만 확장 |
| 소스 상한 | 최대100,000개 내부 사실 행/요청. 같은 행 중복 읽기 포함 자원 예산도 제한 |
| 출력 | 최대100개 breakdown 행, JSON 128KiB. 초과 시 명시적 범위 축소 요청 |
| DB 연결 pool | 함수 인스턴스당 read 2/control 1 이하. 전체 project 연결 사용량 별도 감시 |
| DB statement timeout | 5초 |
| 전체 요청 시간 | 15초 목표 상한. 실제 platform timeout보다 짧게 중단 |
| 실행 예산 | DB 부하·Edge CPU/메모리 측정. 날짜 제한만으로 안전 판정하지 않음 |
| rate limit | 관리자+채널 기준 분당20회, 무거운 분석 동시2개. DB 원자적 lease/counter, 프로세스 메모리만으로 구현 금지 |
| 캐시 | 선택적5분, 실패 결과는 캐시하지 않음. 오래된 값 자동 대체 금지 |

캐시 key는 canonical operation+normalized query+definition version+data scope+disclosure profile/version+grant version을 포함한다. 기본값 생략/필드순서/같은 월의 다른 표현은 동일 요청으로 정규화한다. 캐시에 원본 개인행을 저장하지 않는다. 반환 시 실제 계산 as_of를 유지한다.

DB timeout 또는 자원 상한을 넘으면 `analysis_too_large`/`timeout`과 더 작은 기간 안내를 반환한다. 임의로 샘플링하거나 전체가 아닌 데이터를 완전한 결과처럼 표시하지 않는다. HTTP retry는 연결/전송 단계 transient 오류에 한해 제한적으로 수행하고 분석을 무한 재시도하지 않는다.

임시 runtime cache/rate-limit 행의 자동 만료 정리는 새 임시 데이터에만 한정한다. 감사·원본 로그·기존 published ledger는 삭제하지 않는다. 감사 보존 기간 변경/정리는 별도 운영 결정이다.

장기간 요청이 자주 한도를 넘으면 후속 `analysis_jobs`를 추가한다. submit/read-result는 같은 ActorContext와 권한을 재확인하고, 작업 결과는 공개된 집계만 보관한다. 단순 `waitUntil`로 장시간 CPU 제한을 피할 수 있다고 가정하지 않는다. 별도 worker/분석 DB 비용이 필요해지면 측정 근거와 함께 별도 결정한다.

## 8 사건 이력과 운영 쓰기 후속 단계

첫 릴리스에서 기록 기반 분석의 한계를 표시하고, 운영 이력이 필요한 지표는 별도 capability로 관리한다. 이력 확장은 다음 이벤트부터 시작한다.

- 신청/대기/취소/현장등록/출석확정/출석수정의 event_type, occurred_at, recorded_at, program/session key, 내부 person key, 원천 operation id.
- application_origin은 preregistered/walk_in/unknown. 기존 자료에 소급해서 임의로 채우지 않음.
- idempotency용 원천 event key UNIQUE. 원본 변경과 이력 append는 같은 트랜잭션. 모든 웹/RPC/fallback/관리자 경로를 확인.
- 기존 상태를 초기 적재하면 snapshot이라는 사실과 적재 시각을 기록. 과거 발생 이벤트로 위장하지 않음.
- 저장 시작일 이전의 완전성을 주장하지 않음. 데이터 삭제가 있었다면 그 기간은 불완전하게 표시.

미래 운영 쓰기는 `prepare_notice_draft`와 웹 승인 경로부터 추가한다. 사용자·내용 hash·유효기간·idempotency key를 가진 초안을 서버에 저장하고, 승인 당시 현재 권한과 내용 일치를 다시 확인한다. MCP에서 승인 없이 게시하는 도구는 이 첫 릴리스에 등록하지 않는다. Slack의 기존 승인 토큰을 다른 채널에서 재사용하지 않는다.

## 9 호환성과 버전

- result schema와 metric definition version은 별개다. 수치 의미가 바뀌면 definition version을 올린다.
- Slack 구형 `total_visits`의 의미를 새 visit_sessions로 조용히 덮어쓰지 않는다. 병행 출력·비교 후 명시적인 전환.
- 웹 관리자 화면은 공통 결과를 사용하도록 pilot부터 전환. 세션·회원 표시 같은 다른 기능을 분석 API로 일괄 이식하지 않는다.
- tool 이름/필수 필드 변경은 새 버전 또는 호환 기간을 둔다. ChatGPT 도구 목록 갱신 절차와 회귀 질문을 배포 기록에 남긴다.
- 기존 개발 중 MCP와 새 구현을 동시에 활성화하지 않는다. 이전 객체/이력은 적용 상태와 참조를 확인한 후 별도 정리한다.
