import assert from 'node:assert/strict';
import { filterProgramUsersByRegions } from '../supabase/functions/_shared/programPushRegions.mjs';

const rows={
  schools:[{name:'강동고'}],
  notices:[{content:JSON.stringify({하이픈:['staff-haifn'],이높플레이스:['staff-enough']})}],
  staff_directory:[
    {id:'staff-haifn',role:'admin'},{id:'staff-enough',role:'admin'},
    {id:'master',role:'master'},{id:'admin',role:'admin'},
  ],
};
const db={from(table){
  const state={table};
  const builder={
    select(){return builder;}, in(){return Promise.resolve({data:rows[state.table],error:null});},
    eq(){return builder;}, maybeSingle(){return Promise.resolve({data:rows[state.table][0],error:null});},
  };
  return builder;
}};
const users=[
  {id:'student-gangdong',school:'강동고',role:'user',user_group:'청소년'},
  {id:'student-other',school:'다른고',role:'user',user_group:'청소년'},
  {id:'staff-haifn',school:'',role:'staff',user_group:'STAFF',is_master:false},
  {id:'staff-enough',school:'강동고',role:'staff',user_group:'STAFF',is_master:false},
  {id:'master',school:'',role:'admin',user_group:'STAFF',is_master:true},
  {id:'admin',school:'강동고',role:'admin',user_group:'관리자',is_master:true},
];

assert.deepEqual((await filterProgramUsersByRegions(db,users,['강동'])).map(user=>user.id),
  ['student-gangdong','staff-haifn','master']);

rows.schools=[{name:'강서고'}];
assert.deepEqual((await filterProgramUsersByRegions(db,users,['강서'])).map(user=>user.id),
  ['staff-enough','master']);

console.log('program push region staff routing: ok');
