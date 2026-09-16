import assert from 'node:assert/strict';
import {createTemporaryPasswordController} from '../src/auth/temporaryPasswordController.js';

const profileId=crypto.randomUUID(),calls=[];
const controller=createTemporaryPasswordController({
    credentials:async(input,options)=>{calls.push({input,options});return {protocol:1,status:'login_required'};},
    exclusive:async(work)=>work(),
});
assert.deepEqual(await controller({profileId,temporaryPassword:'0644',newPassword:'new-password'}),{status:'saved'});
assert.deepEqual(calls[0].input,{action:'change-temporary',protocol:1,profileId,temporaryPassword:'0644',newPassword:'new-password'});
await assert.rejects(()=>controller({profileId,temporaryPassword:'644',newPassword:'new-password'}),error=>error.code==='invalid_request');
console.log('PASS temporary password controller: four-digit proof changes to a permanent password');
