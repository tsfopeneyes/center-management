import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { Readable } from 'node:stream'
import { christmasLocalPreview, createChristmasPreviewDatabase } from './haifn-christmas-local.mjs'

const db = await createChristmasPreviewDatabase()
// The SQL contract checks the data URL envelope and the 480 �� 480 PNG header.
const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAeAAAAHgAAAAAAAABBBBBBBBBBBBBBB='
const first = randomUUID()
const second = randomUUID()
const settings = 'public.haifn_christmas_settings'
const drawings = 'public.haifn_christmas_drawings'

function as(role, sql, params = []) {
    return db.transaction(async tx => {
        await tx.exec(role === 'staff'
            ? "SET LOCAL ROLE authenticated; SET LOCAL christmas.preview_staff = 'on'"
            : `SET LOCAL ROLE ${role}`)
        return (await tx.query(sql, params)).rows
    })
}

const insert = (id, content = image) => as('anon', `INSERT INTO ${drawings} (id, image) VALUES ($1, $2)`, [id, content])
const mode = value => as('staff', `UPDATE ${settings} SET mode = $1 RETURNING mode`, [value])

try {
    assert.deepEqual(await as('anon', `SELECT mode FROM ${settings}`), [{ mode: 'closed' }])
    await assert.rejects(insert(first), { code: '23514', message: 'christmas_submissions_closed' })
    await assert.rejects(as('anon', `UPDATE ${settings} SET mode = 'live'`), { code: '42501' })
    assert.deepEqual(await as('authenticated', `UPDATE ${settings} SET mode = 'live' RETURNING mode`), [])

    await mode('review')
    await assert.rejects(insert(first, 'data:image/svg+xml,<svg/>'), { code: '23514' })
    await assert.rejects(as('anon', `INSERT INTO ${drawings} (id, image, status) VALUES ($1, $2, 'published')`, [first, image]), { code: '42501' })
    await insert(first)
    await assert.rejects(insert(first), { code: '23505' })
    assert.deepEqual(await as('anon', `SELECT id FROM ${drawings}`), [])
    assert.deepEqual(await as('authenticated', `SELECT id FROM ${drawings}`), [])
    assert.deepEqual(await as('staff', `SELECT status FROM ${drawings}`), [{ status: 'pending' }])
    assert.deepEqual(await as('authenticated', `UPDATE ${drawings} SET status = 'published' RETURNING id`), [])

    await as('staff', `UPDATE ${drawings} SET status = 'published' WHERE id = $1`, [first])
    assert.deepEqual(await as('anon', `SELECT id FROM ${drawings}`), [{ id: first }])
    assert.deepEqual(await as('authenticated', `UPDATE ${drawings} SET status = 'hidden' RETURNING id`), [])
    await assert.rejects(as('staff', `UPDATE ${drawings} SET image = 'other'`), { code: '42501' })
    await assert.rejects(as('staff', `DELETE FROM ${drawings}`), { code: '42501' })
    await as('staff', `UPDATE ${drawings} SET status = 'hidden' WHERE id = $1`, [first])
    assert.deepEqual(await as('anon', `SELECT image FROM ${drawings} WHERE id = $1`, [first]), [])

    await mode('live')
    await insert(second)
    assert.deepEqual(await as('anon', `SELECT id, status FROM ${drawings}`), [{ id: second, status: 'published' }])
    await assert.rejects(as('service_role', `SELECT id FROM ${drawings}`), { code: '42501' })
    console.log('HAIFN CHRISTMAS SQL access and publishing checks passed.')
} finally {
    await db.close()
}

const server = new EventEmitter()
let handle
christmasLocalPreview().configureServer({
    httpServer: server,
    middlewares: { use: middleware => { handle = middleware } },
})

function request(route, { method = 'GET', body, remoteAddress = '127.0.0.1', origin = 'http://localhost:1000' } = {}) {
    const incoming = Readable.from(body ? [JSON.stringify(body)] : [])
    Object.assign(incoming, {
        url: `/__haifn_christmas/${route}`,
        method,
        headers: { host: 'localhost:1000', origin },
        socket: { remoteAddress },
    })
    return new Promise((resolve, reject) => {
        let status
        const outgoing = {
            writeHead(code) { status = code },
            end(data) { resolve({ status, data: JSON.parse(data) }) },
        }
        handle(incoming, outgoing, () => reject(new Error('Unexpected Vite middleware fallthrough'))).catch(reject)
    })
}

try {
    const id = randomUUID()
    assert.equal((await request('manage/mode', { remoteAddress: '192.168.1.8' })).status, 403)
    assert.equal((await request('manage/mode', { method: 'PATCH', body: { mode: 'review' }, origin: 'https://example.org' })).status, 403)
    assert.equal((await request('manage/mode', { method: 'PATCH', body: { mode: 'review' } })).status, 200)
    assert.equal((await request('drawings', { method: 'POST', body: { id, image }, remoteAddress: '192.168.1.8' })).status, 200)
    assert.deepEqual((await request('drawings')).data, [])
    assert.equal((await request(`drawings/${id}`)).status, 404)
    assert.equal((await request('manage/drawings')).data[0].status, 'pending')
    assert.equal((await request(`manage/drawings/${id}`, { method: 'PATCH', body: { status: 'published' } })).status, 200)
    assert.equal((await request('drawings')).data[0].status, 'published')
    assert.deepEqual((await request(`drawings/${id}`)).data, { image })
    assert.equal((await request(`manage/drawings/${id}`, { method: 'PATCH', body: { status: 'hidden' } })).status, 200)
    assert.deepEqual((await request('drawings')).data, [])
    console.log('HAIFN CHRISTMAS preview request flow passed.')
} finally {
    server.emit('close')
}
