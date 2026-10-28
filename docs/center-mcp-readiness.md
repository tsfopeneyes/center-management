# 전용 MCP 읽기 연결 준비 결과

현재 상태는 **로컬 코드·합성 검증 완료, 실제 OAuth/연결 미완료**다. 새 Edge Function 진입점은 구성 없는 기본 상태에서 503을 반환한다. 운영 환경 설정, client 등록, 비밀값, 새 키, 계정·권한, 데이터, 배포는 변경하지 않았다.

## 기존 인증과 공식 지원 경로

기존 `account-auth/index.ts`는 Supabase Auth와 보호된 account_security 매핑/역할/검증세션을 사용하는 자체 계정 API다. OAuth authorize/token/discovery endpoint가 아니다. `verifiedSession.mjs`는 일반 웹앱 JWT의 `aud=authenticated`를 요구하므로 MCP 전용 resource audience 토큰 검증에 그대로 쓸 수 없다. `sessionContinuity.mjs`는 단순 JWT 존재가 아니라 검증된 로그인 assurance를 요구한다. OAuth 새 세션이 이 assurance를 자동 충족한다고 가정하지 않는다.

로컬 `supabase/config.toml`의 `auth.oauth_server.enabled=false`, `allow_dynamic_registration=false`는 확인했다. 원격 OAuth 설정과 현재 서명 키 종류는 조회하지 않았으며 로컬 값으로 원격 상태를 단정하지 않는다.

지원 경로는 별도 IdP를 새로 만드는 대신 기존 Supabase OAuth 2.1 서버와 자체 동의 UI를 사용하는 것이다. [Supabase 시작 문서](https://supabase.com/docs/guides/auth/oauth-server/getting-started)는 native authorize/token/discovery/JWKS 및 동의 처리를 설명한다. [토큰 보안 문서](https://supabase.com/docs/guides/auth/oauth-server/token-security)는 기본 OAuth 토큰이 `aud=authenticated`, `client_id`를 가지며 OIDC scope가 DB 권한을 제한하지 않는다고 설명한다. **일반 웹앱/DB 토큰을 읽기 전용 MCP 토큰으로 취급하지 않는다.**

[OpenAI 인증 문서](https://developers.openai.com/plugins/build/auth)는 MCP resource를 토큰에 결합하고 서버에서 issuer/audience/expiry/permission을 검증하도록 요구한다. 같은 문서는 client 식별과 OAuth 사용자를 구분한다. 전용 client+Jin 센터 계정 제한은 구현할 수 있지만, native Supabase 토큰만으로 특정 ChatGPT 계정의 별도 subject를 증명하는 것은 아니다. 개인 플러그인 설치와 전용 callback/client 설정을 함께 확인해야 하며, 다른 ChatGPT 계정의 접근이 암호학적으로 불가능하다고 아직 보장하지 않는다.

Supabase는 Custom Access Token Hook으로 client별 audience 및 추가 signed claim 조정을 지원한다. 따라서 검토할 최소 bridge는 **정확한 전용 client에만 resource audience와 서버에서 승인한 center_permissions를 부여**하고 다른 웹앱/client의 claims를 보존하는 hook이다. 이 hook은 이번에 활성화·배포하지 않았고 코드의 요구 조건만으로 실제 발급 호환성이 입증된 것이 아니다.

Supabase 문서에 확인된 OAuth scopes는 openid/email/profile/phone다. 임의 `center:*` scope를 native authorize 요청이 지원한다고 가정하지 않는다. 준비 코드의 discovery/tool OAuth scope는 native `openid`이며, 통계·프로그램 읽기는 별도의 signed `center_permissions`와 보호된 서버 계정/현재 grant로 제한한다. `openid` 발급을 위해 비대칭 서명 키가 필요한 경우 기존 로그인에 영향이 있으므로 실제 서명 키 현황을 비밀값 없는 설정 확인으로 먼저 검증해야 한다. 키 변경은 별도 승인이다.

## 첫 실제 단계에서 승인받을 정확한 설정안

대상 프로젝트는 기존 `erecqalsxoxrufggvmcc`다. 아래 URL은 제안이며 아직 운영 연결이나 설정이 존재한다고 확인한 것은 아니다.

| 설정/대상 | 제안 및 확인 조건 |
| --- | --- |
| MCP resource | `https://erecqalsxoxrufggvmcc.supabase.co/functions/v1/center-statistics-mcp` |
| OAuth issuer | `https://erecqalsxoxrufggvmcc.supabase.co/auth/v1` — 실제 discovery의 issuer와 정확히 일치 확인 |
| Native OAuth 활성화 | 기존 프로젝트 Authentication → OAuth Server; 명시적 승인 후만 활성화 |
| 동의 UI | 기존 웹앱의 `/oauth/consent` 제안. 기존 Site URL과 결합되는 실제 주소 확인. 기존 계정 로그인·assurance를 재사용하며 승인/거절 명시 |
| client 등록 | 개인 ChatGPT 연결 전용 client 하나. DCR은 계속 비활성 유지하는 수동 등록 경로 우선 검토 |
| callback URI | ChatGPT 관리 UI에 실제 표시된 URI를 정확히 복사. stable URI나 callback ID를 추정해서 등록하지 않음 |
| OAuth scope | native openid, 추가 OIDC 정보 최소화. scope만으로 DB 읽기 범위를 제한하지 않음 |
| client별 token hook | 해당 client에만 MCP resource audience, 승인된 center_permissions 부여. 일반 JWT/다른 client 변화 없는 회귀 검증 필요 |
| Jin binding | 보호된 accounts의 검증된 Auth user ↔ profile 1:1 매핑, 활성 상태·역할. 실제 ID를 추정하거나 공개 users 이름으로 결정하지 않음. 안전한 운영자 설정 절차 필요 |
| live grant/연속성 | 기존 검증 로그인 assurance와 native OAuth 세션/동의·철회가 어떻게 연결되는지 실제 provider 계약으로 검증. `loadLiveGrant` 실제 어댑터는 아직 미구현이며 JWT만으로 active를 만들어 주지 않음 |
| DB reader | 서버 내부 `center_statistics_reader` 제안. 아래 열만 SELECT, 기존 server 연결의 요청별 읽기 transaction에 한정. NOLOGIN role 및 역할 결합 방식은 별도 reviewed migration/impact check·승인 필요 |
| 공개 정책 | 일/주/월·분모·작은 셀·프로그램 정보 검토, 반복/중첩 공개 승인 adapter. 지금 테스트 정책을 운영에 복사하지 않음 |

Client secret이 필요한 등록 방식이면 사용자가 안전한 credential UI로 입력해야 한다. 채팅·소스·출력에 복사하지 않는다. 넓은 service key를 ChatGPT 플러그인에 주지 않는다. No authentication을 선택하지 않는다. 새 Auth 키나 client credential은 이번에 만들지 않았다.

## 구현한 로컬 경계

- `centerMcp/handler.mjs`: stateless Streamable HTTP JSON-RPC, initialize/ping/tools/list/tools/call, 읽기 도구 두 개만 허용. 401 discovery challenge, Origin/미디어/프로토콜/본문 크기 검증. Supabase gateway 전후 경로 처리.
- `centerMcp/oauth.mjs`: ES256/RS256 signature, 고정 issuer/resource/client/Jin ID, 만료·nbf, signed 읽기 권한, 보호된 매핑·역할·credential epoch와 실제 live grant 계약 검증. 키 발급·OAuth token 교환을 직접 구현하지 않음.
- `centerMcp/postgres.mjs`: 한 REPEATABLE READ READ ONLY transaction 안에서 고정 9테이블의 500행 keyset page 조회. 요청 SQL 없음, 1501행 fixture 검증, 실패는 0으로 바뀌지 않음. 승인된 role 연결이 아니면 거절.
- `centerMcp/runtime.mjs`: 어댑터 조합 factory. 기본 상태는 비활성. `center-statistics-mcp/index.ts`에는 비밀값 읽기나 서버 설정 활성화가 없음.

기본 HTTP transport의 합성 검증은 실제 ChatGPT UI의 OAuth 끝단 검증을 대체하지 않는다. 실제 client와 native 발급/refresh/resource 처리, 인증 실패 재연결, 일반 PostgREST 접근 거절, 철회·역할/비밀번호 변경, 기존 웹앱/Slack 동작을 별도로 검증해야 한다. resource audience와 hook의 지원 사실은 문서에서 확인했지만 해당 프로젝트에서 resource echo·실제 signed claims·live grant를 확인한 상태는 아니다.

## 지표 계산에 필요한 최소 읽기 열

| 내부 테이블 | 최소 열 |
| --- | --- |
| users | id,user_group — 중복 제거·직원/게스트 구분, 이름 없음 |
| staff_directory | id,role |
| locations | id |
| logs | id,user_id,type,location_id,created_at |
| notices | id,category,program_date,created_at,program_status,is_recruiting |
| notice_responses | notice_id,user_id,status,is_attended,is_staff |
| daily_program_sessions | id,notice_id,session_date,status,voided_at |
| daily_program_session_responses | session_id,user_id,status,is_attended |
| open_program_attendance | notice_id,user_id,attendance_date |
| account_security.accounts | auth_user_id,profile_id,mapping_verified,status,must_change_password,credential_version |
| account_security.account_roles | profile_id,role,enabled |

Auth 읽기는 Jin 신원 검증용이며 tool 결과에 포함되지 않는다. native live grant 검증에 필요한 추가 읽기는 provider 계약을 확인하기 전 요구 권한을 추정하여 부여하지 않는다. 프로그램 소개는 DB 자유서술 원문 대신 게시·검토된 catalog의 허용 필드만 출력한다. 실제 catalog를 어떤 담당자/저장소에서 검토·제공할지도 승인 대상이며 현재 fixture catalog뿐이다.

## 남은 blocker와 비용·롤백

다음 한 단계는 **기존 Supabase native OAuth와 vetted account-auth 사이의 client별 resource/permission/continuity bridge 설정안 승인 및 발급 계약 검증**이다. 현재 검증기는 일반 native JWT를 거절하므로 설정 없이 URL만 ChatGPT에 등록해도 연결되지 않는다. 이 미완료를 인증 완료로 보고하지 않는다.

새 호스팅은 요구하지 않았다. Supabase 공식 문서는 OAuth 별도 기능 요금 없이 MAU에 포함된다고 설명하며, 실제 Edge·DB 호출·현재 플랜 비용은 운영 환경에서 확인하지 않았다. 지속 접근 client/grant·reader 권한과 공개 이력 관리에는 별도 승인이 필요하다. 설정 승인 후에도 배포는 별도 승인이다. 롤백은 전용 client/grant 철회, MCP 함수 비활성화, client별 hook 변경 복구이며 기존 데이터 삭제나 재설정은 필요 없다.
