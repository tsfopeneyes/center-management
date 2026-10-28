import assert from 'node:assert/strict';
import { resolveProgramApplicationScope, usesDailySessionRsvp } from '../src/utils/dailyProgramSessions.js';

const open={is_recruiting:false,is_challenge:false,schedule_mode:'SINGLE',application_scope:'PROGRAM'};
const savedOpenScope=resolveProgramApplicationScope(open);
assert.equal(savedOpenScope,'NONE');
const reopened={...open,is_recruiting:true,application_scope:savedOpenScope};
assert.equal(resolveProgramApplicationScope(reopened),'PROGRAM','editing a saved open program into an application program restores applications');
assert.equal(resolveProgramApplicationScope({...reopened,schedule_mode:'RECURRING'}),'PROGRAM');
const session={...reopened,schedule_mode:'RECURRING',application_scope:'SESSION'};
assert.equal(resolveProgramApplicationScope(session),'SESSION','valid recurring session choice is preserved');
assert.equal(usesDailySessionRsvp({category:'PROGRAM',is_recruiting:true,is_challenge:false,guest_properties:{schedule_mode:'RECURRING',application_scope:resolveProgramApplicationScope(session)}}),true);
assert.equal(resolveProgramApplicationScope({...session,schedule_mode:'SINGLE'}),'PROGRAM','single programs cannot carry a stale session scope');
assert.equal(resolveProgramApplicationScope({...session,is_challenge:true}),'NONE','challenge applications keep their existing boundary');
console.log('PASS saved open -> application transition and recurring session scope preservation');
