import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
await db.exec(`
  CREATE ROLE authenticated;
  CREATE TABLE community_channel_posts (id integer PRIMARY KEY, author_id integer, deleted_at timestamptz);
  INSERT INTO community_channel_posts (id, author_id) VALUES (1, 42), (2, 42), (3, 99);
  CREATE FUNCTION current_profile_id() RETURNS integer LANGUAGE sql STABLE
    AS $$ SELECT current_setting('test.profile_id')::integer $$;
  ALTER TABLE community_channel_posts ENABLE ROW LEVEL SECURITY;
  CREATE POLICY posts_read ON community_channel_posts FOR SELECT TO authenticated
    USING (deleted_at IS NULL);
  CREATE POLICY posts_update ON community_channel_posts FOR UPDATE TO authenticated
    USING (author_id = current_profile_id()) WITH CHECK (author_id = current_profile_id());
  GRANT SELECT, UPDATE ON community_channel_posts TO authenticated;
  CREATE FUNCTION soft_delete_community_post(p_post_id integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
    DECLARE v_author_id integer;
    BEGIN
      SELECT author_id INTO v_author_id FROM community_channel_posts
        WHERE id = p_post_id AND deleted_at IS NULL FOR UPDATE;
      IF NOT FOUND OR current_profile_id() != v_author_id THEN
        RAISE EXCEPTION '글 삭제 권한이 없습니다.' USING ERRCODE = '42501';
      END IF;
      UPDATE community_channel_posts SET deleted_at = now() WHERE id = p_post_id;
    END $$;
  GRANT EXECUTE ON FUNCTION soft_delete_community_post(integer) TO authenticated;
  SET test.profile_id = '42';
  SET ROLE authenticated;
`);

await assert.rejects(db.query('UPDATE community_channel_posts SET deleted_at = now() WHERE id = 1 RETURNING id'),
  /row-level security policy/, 'the current read policy rejects soft deletion');
await assert.rejects(db.query('UPDATE community_channel_posts SET deleted_at = now() WHERE id = 2'),
  /row-level security policy/, 'omitting RETURNING does not fix the update');

await db.query('SELECT soft_delete_community_post(1)');
const own = await db.query('SELECT id FROM community_channel_posts WHERE id = 1');
assert.equal(own.rows.length, 0, 'the deleted row is invisible even to its author');
await assert.rejects(db.query('SELECT soft_delete_community_post(3)'), /글 삭제 권한이 없습니다/,
  'a participant cannot delete another author’s post');
await db.exec("SET test.profile_id = '99'");
const other = await db.query('SELECT id FROM community_channel_posts WHERE id = 3');
assert.equal(other.rows.length, 1, 'another participant still sees an undeleted post');
const deleted = await db.query('SELECT id FROM community_channel_posts WHERE id = 1');
assert.equal(deleted.rows.length, 0, 'another participant cannot read a deleted post');
await db.close();
console.log('Community post soft-delete RLS check passed.');
