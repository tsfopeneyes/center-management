import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { schoolCoordinates } from '../src/utils/naverMaps.js';

const db = new PGlite();
try {
    await db.exec("CREATE TABLE schools (id int PRIMARY KEY, name text); INSERT INTO schools VALUES (1, '기존 학교');");
    await db.exec(await readFile('supabase/migrations/20261015090000_school_map_locations.sql', 'utf8'));
    const { rows } = await db.query('SELECT * FROM schools');
    assert.equal(rows.length, 1); assert.equal(rows[0].name, '기존 학교');
    assert.equal(rows[0].map_latitude, null);
    await db.exec("UPDATE schools SET map_address='학교 주소', map_latitude=37.5, map_longitude=127.1 WHERE id=1");
    await assert.rejects(db.exec('UPDATE schools SET map_latitude=100 WHERE id=1'));
    await assert.rejects(db.exec('UPDATE schools SET map_latitude=NULL WHERE id=1'));
    assert.equal(schoolCoordinates({ map_latitude: null, map_longitude: null }), null);
    assert.equal(schoolCoordinates({ map_latitude: 91, map_longitude: 127 }), null);
    assert.equal(schoolCoordinates({ map_latitude: 'NaN', map_longitude: 127 }), null);
    assert.deepEqual(schoolCoordinates({ map_latitude: 0, map_longitude: 0 }), { lat: 0, lng: 0 });
    console.log('School map: existing data preserved; coordinate validation and shared location schema passed.');
} finally { await db.close(); }
