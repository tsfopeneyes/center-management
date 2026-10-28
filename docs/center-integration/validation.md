# 센터 통합 분석 로컬 검증 기록

기준일: 2026-10-07 (Asia/Seoul)

## 운영 활성화와 실제 API 검증 — 최신 상태

### ChatGPT 등록 시도

로그인된 ChatGPT Plugins의 사용자 지정 MCP 서버 만들기 화면에서 센터 운영 분석 이름, 설명, 실제 MCP URL, OAuth authorize/token/issuer/resource 및 openid를 입력했다. ChatGPT 화면의 OAuth 자동 검색과 콜백 URL 조회가 실패했고 재시도에도 콜백 주소가 발급되지 않았다. 클라이언트 등록·설치·OAuth 동의·ChatGPT 대화 테스트는 아직 완료되지 않았다. 임의 콜백을 등록하거나 기존 OAuth 클라이언트를 바꾸지 않았다.

센터 MCP의 무인증 GET에 OAuth resource_metadata 안내가 빠진 점을 보완해 401 WWW-Authenticate를 반환하도록 배포했다. transport 테스트는 통과했다. 이 수정만으로 ChatGPT 화면의 콜백 발급 실패가 해결되지는 않았다.

사용자가 운영 프로젝트 center-api 활성화, 웹 세션 검증, app.schoolchurchimpact.org 허용 및 지정 기존 관리자 제한을 명시 승인했다. CENTER_API_READY=true, CENTER_WEBSITE_SESSION_CONTRACT_READY=true, CENTER_INTEGRATION_WEB_ORIGINS=https://app.schoolchurchimpact.org를 적용했다. DB settings는 enabled=true이고 기존 보호된 master 한 계정만 pilot에 포함한다.

- 운영 health 200 ready:true, MCP initialize 200, tools/list 7개가 실제 응답했다. 무인증 tools/call은 OAuth challenge와 isError:true로 차단됐다. 잘못된 Bearer는 401, 외부 Origin은 403이었다.
- 사용자가 로그인한 브라우저에서 현재 세션으로 운영 connection list, metric definitions, operation summary를 호출했다. 연결 목록은 빈 목록, definitions와 summary는 status:ok였다.
- 실제 API 기간 2026-03-31/2026-10-07: 방문 910건, 방문자 185명, visitor_days 880, 신청 353건, 출석 336건, 만족도 13건(평균 4.53846), 대여 6건, 스토어 9건, 설문 272건.
- 처음 실제 호출에서 권한 오류를 발견했다. 검토 및 운영 ROLLBACK 검사 후 20261007030000으로 singleton 열 읽기, 20261007040000으로 비밀번호 없는 고정 private 인증 상태 뷰를 추가했다. NOLOGIN 서버 역할만 읽을 수 있으며 OAuth token의 계정 조회 및 reader의 수정 권한은 없다. 관리형 Auth 스키마 USAGE 직접 GRANT는 적용되지 않아 채택하지 않았다. 함수 adapter를 내부 뷰로 전환해 배포한 뒤 실제 호출 성공을 확인했다.
- 독립 검증 SQL의 INNER JOIN이 location_id 없는 퇴실 로그를 누락시키던 오류를 LEFT JOIN으로 수정하고 임시 로그 별칭도 원본의 동시각 정렬을 보존하도록 변경했다. 재실행한 독립 oracle 결과가 운영 API의 910/185/353/336/13/6/9/272와 일치했다. 과거 907/906 기록은 수정 전 검증 자료 결과다.
- 수정 후 통합 자동 테스트 45개와 추가 migration을 포함한 격리 SQL 테스트가 통과했다. 임시 DEV 검증 화면은 제거했다. 관리자 설정 메뉴는 추가하지 않았다.
- 최신 production build가 성공했고 Firebase predeploy의 check-account-auth-release 및 account-auth readiness 검사도 통과했다. Hosting 배포는 아직 실행하지 않았다.
- 아직 새 center-api용 ChatGPT OAuth client 등록·동의·code exchange·OAuth refresh 및 ChatGPT 대화에서 실제 호출 성공은 미검증이다. 일반 웹 세션 refresh 성공과 구분한다. Firebase Hosting의 새 동의 화면 배포도 이 활성화 승인에 포함되지 않아 실행하지 않았다.

안전 차단 복구: CENTER_API_READY=false로 해당 API만 비활성화하거나 settings.enabled=false로 분석 대상 계정을 차단할 수 있다. 기존 일반 로그인 Hook은 유지한다.

## 실제 검증 재실행

### 사용자가 직접 로그인한 뒤 실제 브라우저 검증

- localhost:5173/admin에서 authenticated 관리자 화면을 확인했고, 새로고침 뒤에도 로그인과 관리자 접근이 유지됐다.
- 임시 DEV 전용 검증 화면에서 현재 사용자의 Supabase SDK refreshSession을 실제 실행했다. 성공 응답, refresh_token 회전, 동일 계정 유지, getUser 서버 검증 성공과 refresh 이후 authenticated/master 상태를 확인했다. 토큰이나 계정 식별자를 화면·로그로 출력하지 않았다. 임시 검증 화면과 경로는 검증 후 제거했다.
- 이는 일반 웹 로그인 세션의 실제 갱신 검증이다. 전용 ChatGPT OAuth 토큰의 code exchange/refresh 성공 증거는 아니다.
- 연결 API 호출은 브라우저에서 status 0 temporarily_unavailable로 실패했다. 현재 서버는 비활성이며 이 경로의 CORS 응답도 없어 실제 연결 수용 기준은 여전히 미통과다.
- authorization_id 없는 OAuth 동의 화면에서는 유효하지 않은 요청 안내만 표시하고 승인 버튼을 제공하지 않았다.

- 통합 자동 테스트 45개와 격리 SQL 권한·철회 테스트를 다시 실행해 통과했다.
- 운영 데이터의 비식별 읽기 전용 스냅샷으로 분석을 재실행했다. 방문 907건, 방문자 185명, 신청 353건, 출석 336건, 만족도 13건, 대여 6건, 스토어 9건, 설문 272건이 독립 계산 결과와 일치했다.
- 운영 Auth health는 공개 API 키를 포함한 실제 요청에서 200이었다. center-api health와 OAuth 메타데이터는 200, 비활성 MCP는 503 not_configured였다. ChatGPT 실제 연결 성공을 의미하지 않는다.
- 실제 계정 로그인 검증 시도는 운영 DB 인증값을 사용하는 방식이라는 이유로 자동 승인 검토에서 차단됐다. 해당 테스트 코드는 제거했고, 인증값 조회·비밀번호 변경·로그인은 실행되지 않았다. 정상 로그인·갱신은 아직 미검증이다.
- localhost:5173 브라우저 검증에서 로컬 인증 프록시의 ERR_HTTP_HEADERS_SENT로 개발 서버가 종료되는 문제를 발견했다. Origin 헤더 처리를 프록시 전송 전 bypass 단계로 옮겨 수정했다. 수정 후 연속 health 요청이 성공하고 서버가 유지됐다.

## 전역 Hook 전환 최종 상태

위험·영향 설명 후 사용자가 `응 안전하게 진행해`로 정확한 Hook 전환을 승인했다. 최소 선언 config로 `auth.hook.custom_access_token.uri` 한 항목만 `pg-functions://postgres/center_integration/composed_access_claims`로 전환했다. 이전 자동 승인 검토 거절은 이 명시 승인 이후 해소됐다.

- 적용 전·후 READ ONLY 검사에서 기존 최근 50개 세션의 Hook 결과 변경은 0건이었다. 사용자 식별자나 토큰은 결과에 출력하지 않았다.
- Auth 서비스의 schema USAGE와 Hook EXECUTE 권한을 확인했고 일반 token role은 authenticated로 보존됐다. 관리 API DB 연결에서 Auth 서비스 SET ROLE은 허용되지 않아 권한 카탈로그로 검사했다.
- 적용 후 config diff의 declared update는 0건이었다. 다른 12개 미선언 설정은 전환 명령에서 변경하지 않았다.
- Auth `/health` HTTP 200, 무인증 `/user` HTTP 401, 잘못된 refresh token HTTP 400으로 확인했다. 이것은 정상 사용자 로그인 또는 정상 refresh token 발급 성공 검사가 아니다.
- center-api `/health`는 HTTP 200과 ready:false를 반환한다. 새 client/pilot과 분석 기능은 활성화하지 않았다.
- 실제 정상 로그인·refresh 발급, 관리자 화면, ChatGPT 연결·동의·해제 end-to-end 검증은 테스트 계정 자격증명/클라이언트 연결이 없어 아직 실행하지 못했다. 완료로 표시하지 않는다.

복구 설정은 `scratch/center-integration-hook-rollback/supabase/config.toml`에 기존 URI 한 항목만 선언했다. 인증 오류 발생 시 다음 명령으로 기존 Hook을 복구하고 config diff로 확인한다.

`npx --yes supabase@latest config push --project-ref erecqalsxoxrufggvmcc --workdir scratch/center-integration-hook-rollback --yes`

아래의 자동 승인 검토 거절 기록은 이 전환 전에 있었던 이력이다. 현재 적용 상태는 이 절을 기준으로 한다.

## 승인 후 운영 적용 기록

사용자 승인 후 `20261007010000_center_integration_v1.sql`과 `20261007020000_center_integration_hook_composition.sql`을 각각 적용하고 migration 이력을 기록했다. 두 변경은 사전에 운영 DB에서 ROLLBACK으로 끝나는 영향 검사를 통과했다. 원본 회원·로그·프로그램 자료는 변경하지 않았다.

- `node scripts/test-center-integration-sql.mjs`: 격리 PostgreSQL에서 SQL 생성, 최소 권한 ACL, 일반 로그인 claims 보존, 연결 동의 없는 전용 client 토큰 격리, 승인된 권한 발급, native grant 철회, credential 변경 후 즉시 차단과 재활성화 금지 통과.
- 실제 reader 역할의 READ ONLY transaction: 방문 로그 2,909건, 프로그램 43건, 숫자 만족도 13건 조회 통과.
- 운영 권한 검사: 개인 이름 읽기 금지, 원본 쓰기 금지, JWT 역할의 PostgREST 사용 금지, Hook의 일반 사용자 실행 금지 모두 통과.
- `center-api`만 Supabase에 배포했다. `/health`는 200과 `ready:false`, `/mcp/.well-known/oauth-protected-resource`는 200과 정확한 resource/issuer, 비활성 `/mcp`는 503을 반환한다.
- 실제 OAuth discovery는 정상이며 S256을 지원한다. 운영 OAuth server는 이미 활성 상태이고 DCR은 비활성이다.
- 기존 `center_mcp`는 운영자 binding과 활성 설정이 존재한다. 기존 Hook을 제거하지 않고 호환 함수 `center_integration.composed_access_claims`를 준비했다.
- 전역 Hook URI를 `pg-functions://postgres/center_integration/composed_access_claims`로 전환하는 설정 명령은 자동 승인 검토가 거절했다. 모든 로그인에 영향을 주는 정확한 URI 변경에 대한 추가 명시 승인이 필요하다는 이유다. 기존 `center_mcp/apply_access_claims` 설정은 유지됐다.

### 이번 검증에서 수정한 문제

전용 client에 연결 동의가 없을 때 broad 기본 JWT role로 남던 Hook을 deny-first 격리로 수정했다. SQL reserved keyword인 authorization 별칭을 native_auth로 바꿨다. 프로그램 catalog 조회에 published=true 조건을 추가했다.

### 실제 연결 완료 조건

새 서버는 비활성이고 새 client/pilot은 아직 등록하지 않았다. 전역 Hook URI 변경, 새 ChatGPT client 등록과 실제 callback 확인, 기존 관리자 계정의 동의, code/refresh/revoke 및 ChatGPT 연결 UI 검증이 남았다. 이 상태를 실제 ChatGPT 연결 완료라고 해석하지 않는다. Firebase Hosting은 배포하지 않았다.

아래는 승인 전 로컬·읽기 전용 검증 기록이다. 현재 운영 적용 상태는 위 승인 후 기록을 기준으로 한다.

## 구현 상태

| 항목 | 상태 | 근거 |
| --- | --- | --- |
| 고정 분석 계약과 공개 경계 | 통과 | 7개 고정 operation, unknown input 거절, 작은 집단 억제, 응답 크기 상한 테스트 통과 |
| PostgreSQL 읽기 경계 | 합성 통과 | private fact view, read-only transaction, 고정 범위/바인딩, source-row 상한 테스트 통과 |
| MCP SDK transport | 합성 통과 | `@modelcontextprotocol/sdk` 1.32.1로 `initialize`, `tools/list`, `tools/call`, OAuth challenge 결과를 테스트 |
| MCP OAuth 표시 | 합성 통과 | 모든 도구가 top-level `securitySchemes`를 내보내고, 무인증 도구 호출은 `_meta["mcp/www_authenticate"]`만 반환 |
| 웹 동의 경계 | 합성 통과 | provider `/user` 검증, live session, protected account/role, enabled pilot allowlist를 테스트 |
| Slack 공통 분석 adapter | 합성 통과 | 서명 검증 후 DM·private identity만 core로 전달하는 테스트 통과 |
| 관리자 설정 메뉴 | 반영 | `AdminSettings`에 추가했던 `ChatGPT 연결` 탭과 전용 연결 화면을 제거함 |
| 빌드 | 통과 | `npm run build` 종료 코드 0 |
| 로컬 서버 | 통과 | `npm run dev -- --host 127.0.0.1`로 Vite를 실행하고 `http://127.0.0.1:5174/`가 HTTP 200을 반환하는 것을 확인 |
| 실제 원천 자료 확인 | 통과 | 개인정보 행 없이 최근 90일 logs 1,458건, PROGRAM notices 43건, notice responses 431건 등 원천 건수를 읽음 |
| 실제 분석 실행 | 통과 | 최근 190일 자료를 query-local 가명 식별자로만 읽고 `get_operation_summary`와 `analyze_program_engagement`를 독립 oracle과 대조 |
| KST 프로그램 기간 경계 | 수정·통과 | live schema의 `notices.program_date`가 `timestamptz`인 것을 확인해 UTC 자정 비교를 KST timestamp 경계로 수정하고 repository test에 고정 |

## 실행한 검사

| 명령 | 결과 |
| --- | --- |
| `npm run test:center-integration` | 통과: contract 7, metrics 7, repository 4, auth 5, connection 6, transport 7, web 6, channels 3 |
| `npm run build` | 통과 |
| `node scripts/test-center-analysis-live.mjs <temporary-sanitized-snapshot>` | 통과: 2026-03-31~2026-10-07의 방문 907세션·185명, 프로그램 신청 353건·기록상 출석 336건, 만족도 숫자 13건, 대여 6건·스토어 9건·설문 272건. 실제 식별자·이름·자유서술은 query와 임시 파일에 포함하지 않음 |

빌드 중 기존 Browserslist 데이터 갱신 안내가 출력되었지만 빌드를 실패시키지는 않았다.

실제 자료 검증은 아직 적용하지 않은 `center_integration` private view 대신, 같은 필드와 KST 기간 조건을 가진 읽기 전용 SQL로 했다. 이 SQL은 query-local ordinal 식별자만 결과에 넣고 검증 뒤 임시 파일을 삭제한다. 따라서 실제 운영 Edge Function·전용 DB role·OAuth 연결의 end-to-end 검증을 대신하지 않는다.

## 실제 자료 검증 재실행

권한 있는 운영 환경에서만 다음 순서로 실행한다. SQL은 `SELECT` CTE만 사용하며, 첫 명령의 출력 파일은 로컬 임시 경로에만 둔다.

1. `npx --yes supabase@latest db query --linked --file scripts/center-analysis-live-snapshot.sql --output-format json`으로 가명화 snapshot을 임시 파일에 저장한다.
2. `npm run test:center-analysis:live -- <temporary-sanitized-snapshot>`을 실행한다.
3. 결과 확인 후 임시 snapshot 파일을 삭제한다.

## 아직 실행하지 않은 운영 검증

- 검토 SQL을 격리 PostgreSQL에 적용해 역할, view ACL, RLS, trigger, query plan을 검사
- 실제 Supabase OAuth 2.1 설정에서 Dynamic Client Registration, PKCE S256, code exchange, refresh, native revoke, session revoke 확인
- Custom Access Token Hook이 전용 client에만 `center_integration_token`과 정확한 audience를 발급하는지 확인
- MCP 토큰이 PostgREST, Storage, 기존 Edge Function, SECURITY DEFINER RPC에서 거절되는지 확인
- 실제 ChatGPT connector의 연결/해제 UX와 `mcp/www_authenticate` 동작 확인
- 기존 Slack worker에 새 adapter를 연결한 뒤 DM identity와 기존 기능 회귀 확인
- Firebase Hosting 및 `center-api` 배포

위 항목을 통과하기 전에는 `CENTER_API_READY`를 활성화하거나 제안 SQL을 migration으로 옮기지 않는다.

## 검토용 SQL 상태

`supabase/manual/proposals/center-integration/20261006_center_integration_v1.sql`은 검토용 제안이다. 자동 migration 경로가 아니며 실행하지 않았다. 적용 전에는 영향 검사, 복구 절차, 정확한 대상 migration을 검토하고 사용자의 명시적 승인이 필요하다.
