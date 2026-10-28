import assert from 'node:assert/strict';import {PGlite} from '@electric-sql/pglite';import {readFile} from 'node:fs/promises';
const db=new PGlite();let checks=0;const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
try{await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;
CREATE FUNCTION public.is_current_staff() RETURNS boolean LANGUAGE sql AS $$ SELECT current_setting('test.staff',true)='true' $$;
CREATE TABLE notices(id bigint PRIMARY KEY,guest_properties jsonb DEFAULT '{}');
CREATE TABLE survey_forms(id uuid PRIMARY KEY,kind text DEFAULT 'PROGRAM',owner_notice_id bigint REFERENCES notices(id),source_template_id uuid REFERENCES survey_forms(id),archived boolean DEFAULT false);
CREATE TABLE survey_versions(id uuid PRIMARY KEY,form_id uuid REFERENCES survey_forms(id));
CREATE TABLE survey_links(id uuid PRIMARY KEY,notice_id bigint REFERENCES notices(id),form_id uuid REFERENCES survey_forms(id),version_id uuid REFERENCES survey_versions(id));
CREATE TABLE survey_entries(id uuid PRIMARY KEY,notice_id bigint REFERENCES notices(id),link_id uuid REFERENCES survey_links(id),form_id uuid REFERENCES survey_forms(id),version_id uuid REFERENCES survey_versions(id));
CREATE TABLE logs(id bigint PRIMARY KEY,raw text);INSERT INTO logs VALUES(1,'preserve');
CREATE FUNCTION forbid_version_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Published survey versions are immutable';END $$;
CREATE TRIGGER immutable_versions BEFORE DELETE ON survey_versions FOR EACH ROW EXECUTE FUNCTION forbid_version_delete();
ALTER TABLE notices ENABLE ROW LEVEL SECURITY;CREATE POLICY staff_delete ON notices FOR DELETE USING(is_current_staff());CREATE POLICY staff_read ON notices FOR SELECT USING(is_current_staff());GRANT SELECT,DELETE ON notices TO authenticated;
SET test.staff='true';`);
await db.exec(await readFile('supabase/migrations/20261023020000_program_survey_delete_cleanup.sql','utf8'));
const seed=async n=>{await db.query('INSERT INTO notices VALUES($1, $2)',[n,{}]);await db.query('INSERT INTO survey_forms(id,owner_notice_id) VALUES($1,$2)',[uuid(n),n]);await db.query('INSERT INTO survey_versions VALUES($1,$2)',[uuid(100+n),uuid(n)]);await db.query('INSERT INTO survey_links VALUES($1,$2,$3,$4)',[uuid(200+n),n,uuid(n),uuid(100+n)]);await db.query('INSERT INTO survey_entries VALUES($1,$2,$3,$4,$5)',[uuid(300+n),n,uuid(200+n),uuid(n),uuid(100+n)]);};
const count=async(table,where,args=[])=>(await db.query(`SELECT count(*)::int n FROM ${table} WHERE ${where}`,args)).rows[0].n;
await seed(1);await seed(2);
await db.exec('SET ROLE authenticated');await db.query('DELETE FROM notices WHERE id=1');await db.exec('RESET ROLE');
assert.equal(await count('survey_links','notice_id=1'),0);assert.equal(await count('survey_entries','notice_id=1'),0);checks++;
assert.deepEqual((await db.query('SELECT owner_notice_id,archived FROM survey_forms WHERE id=$1',[uuid(1)])).rows[0],{owner_notice_id:null,archived:true});checks++;
assert.equal(await count('survey_versions','form_id=$1',[uuid(1)]),1);checks++;
assert.equal(await count('survey_entries','notice_id=2'),1);checks++;
// A reusable form owned by the deleted program remains active for its other program.
await seed(3);await db.query('INSERT INTO notices VALUES(4, $1)',[{}]);await db.query('INSERT INTO survey_links VALUES($1,4,$2,$3)',[uuid(204),uuid(3),uuid(103)]);
await db.query('INSERT INTO survey_entries VALUES($1,4,$2,$3,$4)',[uuid(304),uuid(204),uuid(3),uuid(103)]);await db.query('DELETE FROM notices WHERE id=3');
assert.deepEqual((await db.query('SELECT owner_notice_id,archived FROM survey_forms WHERE id=$1',[uuid(3)])).rows[0],{owner_notice_id:null,archived:false});assert.equal(await count('survey_entries','notice_id=4'),1);checks++;
// No-response programs and unused owned forms also delete successfully.
await seed(5);await db.query('DELETE FROM survey_entries WHERE notice_id=5');await db.query('DELETE FROM notices WHERE id=5');assert.equal(await count('notices','id=5'),0);checks++;
// A shared template source is retained even when it has no direct delivery link.
await seed(6);await db.query('INSERT INTO survey_forms(id,source_template_id) VALUES($1,$2)',[uuid(66),uuid(6)]);await db.query('DELETE FROM notices WHERE id=6');assert.equal((await db.query('SELECT archived FROM survey_forms WHERE id=$1',[uuid(6)])).rows[0].archived,false);checks++;
// Nonstaff DELETE must not execute cleanup or bypass notice RLS.
await seed(7);await db.exec("SET test.staff='false';SET ROLE authenticated");await db.query('DELETE FROM notices WHERE id=7');await db.exec("RESET ROLE;SET test.staff='true'");assert.equal(await count('survey_entries','notice_id=7'),1);checks++;
// Any later failure rolls the entire operation back, including deleted answers.
await seed(8);await db.exec(`CREATE FUNCTION fail_notice_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.id=8 THEN RAISE EXCEPTION 'test failure';END IF;RETURN OLD;END $$;CREATE TRIGGER fail_delete AFTER DELETE ON notices FOR EACH ROW EXECUTE FUNCTION fail_notice_delete();`);
await assert.rejects(()=>db.query('DELETE FROM notices WHERE id=8'),/test failure/);assert.equal(await count('survey_entries','notice_id=8'),1);assert.equal(await count('survey_links','notice_id=8'),1);assert.equal(await count('notices','id=8'),1);checks++;
assert.equal(await count('logs',"raw='preserve'"),1);checks++;
console.log(`PASS ${checks} program survey deletion checks: atomic cleanup, no-answer delete, shared definitions/other answers retained, immutable versions, staff RLS, rollback, raw logs unchanged.`);
}finally{await db.close()}
