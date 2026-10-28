# MCP activation handoff — 2026-10-06

## Local implementation / not activated

Project `erecqalsxoxrufggvmcc`; resource
`https://erecqalsxoxrufggvmcc.supabase.co/functions/v1/center-statistics-mcp`;
issuer `https://erecqalsxoxrufggvmcc.supabase.co/auth/v1`.
Actual callback supplied by the parent ChatGPT setup UI:
`https://chatgpt.com/connector/oauth/rSkSkN6wyFcZ`.
No callback guessing, client secret creation or credential copying.

Parent verified management settings: OAuth Server ON, Dynamic OAuth Apps OFF,
existing Site URL `https://app.schoolchurchimpact.org` preserved, authorization
path `/oauth/consent`. Therefore the actual consent URL is
`https://app.schoolchurchimpact.org/oauth/consent` and the server consent CORS
allowlist contains that origin only. Firebase's default .web.app origin is not
silently added. Parent created the manual public client `Jin Center Statistics`,
ID `914be882-969c-408f-9609-57a3534cc9b5`, exact callback, token authentication
method none; the parent verified no existing active Hook. The OIDC discovery URL is
`https://erecqalsxoxrufggvmcc.supabase.co/auth/v1/.well-known/openid-configuration`;
public discovery issuer equality was confirmed on 2026-10-06.

Entry point now supplies public discovery and a 401 challenge before private
configuration exists. Metadata never initializes the database pool. A bearer
cannot list/initialize/call tools until an enabled protected binding is loaded.
DB failures/configuration absence remain 503. Deployment requires gateway JWT
verification off for this function only; the handler validates OAuth itself.

The `/oauth/consent` route uses existing website login, native Supabase OAuth
SDK methods and a server preparation gate. Client-side roles are never trusted.
The server reuses `createAccountAuthorization` with the fixed `members.manage`
action and exact operator-bound Auth/profile/client IDs. The dedicated request
must use the actual callback, PKCE S256, and a compatible resource. No native
approval is performed by the server gate. Direct native consent without a
matching vetted authorization proof cannot grant MCP permissions.

Consent is an ordinary operating-screen extension: incumbent #CF3A27 actions,
#F8F9FA background and app Pretendard/sans. Existing PRODUCT.md/DESIGN.md remain
scoped to /welcome. Ready desktop/mobile and offline mobile were checked with
synthetic Auth/SDK only; decisions disable on any unauthenticated transition.

## Proposed DB changes / impact

`supabase/manual/proposals/20261006_center_mcp_readonly.sql` is a review proposal,
not an applied migration. Adds one private schema, three private tables and
four NOLOGIN/NOBYPASSRLS roles. Existing raw tables are neither updated nor
deleted. Existing RLS policies are preserved; additive SELECT policies apply
only to the new server reader. No anon/authenticated membership is granted.
The reader receives only the nine source projections plus exact account and
native OAuth status columns. No contact/name/password/free-text answers,
authorization codes, token keys/hashes, session IP or user-agent are granted.

The consent writer can only insert authorization proofs after vetted login.
The release worker can only SELECT/INSERT already-published aggregate outputs.
Neither can enable the binding or edit publication policy. The JWT role
`center_mcp_oauth` is deliberately NOT granted to PostgREST `authenticator`,
so PostgREST must fail its SET ROLE, including PUBLIC executable RPCs. Verify
this against actual authenticator membership before activation; merely changing
audience is not sufficient evidence that raw access is denied.

Configuration starts `enabled=false`, with no user/client IDs. Operator binding
must be completed via a trusted management path after Jin's real website login
and authoritative private mapping verification. Never pick the first master,
infer identity from name/email, or place production identity values in source.
Publication policy also starts `reviewed=false`; it needs an explicit metric,
period, suppression/dominance and approved catalog review before data is served.

Live authorization checks current account status/credential epoch, protected
binding, native session/client status and consent/proof revocation per request.
Proofs match an approved native authorization near that OAuth session's creation
(-5/+30 seconds). This conservative bound prevents reuse of an old proof for a
new unvetted session. Native code-exchange timing/session creation and refresh
must be verified live; incompatible timing remains denied, not broadened.

Durable publication stores immutable aggregate outputs with an asOf timestamp.
Exact repeat requests reuse them. A transaction-level advisory lock serializes
release checks and persistence; any overlapping period across requests/metrics,
granularities, policy changes or refresh attempts is blocked for separate review.
This intentionally limits drilldown and refresh. No person rows are stored in
the published-output table. Do not clear that ledger to bypass overlap review.

## Hook and existing-login preservation

`center_mcp.apply_access_claims(jsonb)` is a composable transformer. It leaves
ordinary website/other-client events unchanged. The dedicated client always
gets resource audience and `center_mcp_oauth` role, even when disabled/denied;
only the vetted exact mapping gets read permissions and credential epoch.

If an active hook exists, retain it and review a wrapper that passes its vetted
output claims into this transformer. Preserve every unrelated top-level event
and required claim. Do not replace an existing hook or reconstruct claims from
scratch. Hook registration, SQL execution and real native token issuance have
NOT been tested by JS mocks. Check supported hook schema/role claims with
Supabase's actual managed Auth before activation.

## Coordinated next steps

1. Parent: native OAuth enable, DCR off, dedicated public client, exact callback,
   authorization path `/oauth/consent`; preserve Site URL and existing redirects.
   Check current hook before selecting/composing the new one.
2. PC: inspect catalog/role/policy impact and run the proposal in a rollback
   transaction (or equivalent isolated DB). Verify all referenced columns/enums,
   table owner/forced/restrictive RLS and role membership; do not query raw rows.
   Report impact and coordinate production application first. This script is
   intentionally not in automatic migrations and is not idempotent.
3. Deploy preparation endpoint if parent needs discovery. It cannot serve data
   while the protected binding remains absent/disabled. Verify public metadata,
   blank credential 401 and non-authorized bearer refusal. Deploy only this new
   function; preserve previous function versions and unrelated code.
4. Deploy consent route through Firebase Hosting after a final build; preserve
   the preceding Hosting release ID for rollback. No new hosting/project/cost.
5. Bind Jin/client via trusted private account verification; review publication
   policy/catalog; enable only after real Auth/hook contract checks.
6. Jin: real secure login + native consent + code exchange. Confirm actual token
   acceptance without exposing token values. Test both read tools, wrong account,
   wrong client/resource, expired token, native revocation, session removal,
   account block, role removal, credential-epoch change and raw PostgREST/RPC
   denial. Verify existing student login, signup and unrelated clients unchanged.
7. Rollback: first disable protected configuration and revoke dedicated consent;
   restore previous Hook composition and Hosting/function version as needed.
   Preserve raw data, consent proofs and publication ledger; schema removal is
   a separate reviewed change, not the normal rollback.

Synthetic checks demonstrate JS boundaries only. No real token flow, migration,
native grant/session timing, SQL hook execution or production deployment is
claimed by those tests. The public ES256 JWKS was verified previously; no key
rotation is needed based on that observation.
