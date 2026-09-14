import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getAccountRole, isAdminOrStaff, isMasterStaff } from '../src/utils/userUtils.js';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

assert.equal(getAccountRole({ role: 'admin', user_group: 'STAFF', is_master: true }), 'member');
assert.equal(isAdminOrStaff({ account_role: 'admin' }), true);
assert.equal(isMasterStaff({ account_role: 'master' }), true);
assert.equal(isMasterStaff({ account_role: 'admin', is_master: true }), false);

const serverRoles = read('../supabase/functions/_shared/staffRoles.mjs');
assert.doesNotMatch(serverRoles, /accountRole\s*\?\?\s*profile\.role/);

const profileRead = read('../supabase/functions/_shared/profileReadService.mjs');
assert.match(profileRead, /AS account_role/);
assert.match(profileRead, /account_security\.account_roles/);

const hardening = read('../supabase/migrations/20260910055000_harden_authorization_boundaries.sql');
assert.match(hardening, /account_security\.current_profile_id\(\)/);
assert.match(hardening, /AS RESTRICTIVE/);
assert.match(hardening, /guard_public_profile_security_fields/);

const scopedRead = read('../supabase/migrations/20260910056000_allow_scoped_profile_role_read.sql');
assert.match(scopedRead, /TO account_profile_worker/);
assert.match(scopedRead, /app\.profile_id/);

const adminDashboard = read('../src/pages/AdminDashboard.jsx');
assert.match(adminDashboard, /useAuth\(\)/);
assert.match(adminDashboard, /auth\.status === 'authenticated'/);
assert.doesNotMatch(adminDashboard, /createSessionCoordinator/);

const authProvider = read('../src/auth/AuthProvider.jsx');
assert.match(authProvider, /client\.session\(session\.access_token/);
assert.match(authProvider, /client\.profile\(/);
assert.doesNotMatch(authProvider, /auth\.signOut/);

const userApi = read('../src/api/userApi.js');
assert.match(userApi, /requestSupabaseRest\(/);
assert.match(userApi, /staff_directory\?/);
assert.match(userApi, /10000/);

const app = read('../src/App.jsx');
assert.doesNotMatch(app, /SplashScreen|handleFinishLoading/);
assert.match(app, /Suspense fallback=\{<div className="min-h-screen bg-\[#F8F9FA\]" aria-hidden="true" \/>\}/);

console.log('PASS canonical role boundaries: private role only, server-bound admin entry, bounded staff hydration, restrictive writes');
