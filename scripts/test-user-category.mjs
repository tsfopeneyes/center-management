import assert from 'node:assert/strict';
import { getUserCategory } from '../src/utils/userCategory.js';
for (const [user, expected] of [
    [{user_group:'청소년'}, '청소년'], [{user_group:'재학생'}, '청소년'], [{user_group:'일반인'}, '청소년'],
    [{user_group:'졸업생'}, '졸업생'], [{user_group:'게스트'}, '게스트'],
    [{name:'테스트(guest)'}, '게스트'], [{preferences:{is_temporary:true}}, '게스트'],
    [{is_leader:true,user_group:'청소년'}, '리더'], [{is_leader:true,user_group:'졸업생'}, '리더'],
    [{account_role:'admin',is_leader:true}, 'STAFF'], [{account_role:'master'}, 'STAFF'],
    [{user_group:'STAFF'}, 'STAFF'], [{is_staff:true,user_group:'청소년'}, '청소년'],
]) assert.equal(getUserCategory(user), expected);
console.log('Five display categories, legacy labels, staff precedence and program helper separation passed');
