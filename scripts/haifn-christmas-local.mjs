import { readFile } from 'node:fs/promises'
import { networkInterfaces } from 'node:os'
import { PGlite } from '@electric-sql/pglite'

const migration = new URL('../supabase/migrations/20261125010000_haifn_christmas.sql', import.meta.url)

export async function createChristmasPreviewDatabase() {
    const db = new PGlite()
    try {
        await db.exec(`
            CREATE ROLE anon;
            CREATE ROLE authenticated;
            CREATE ROLE service_role;
            CREATE FUNCTION public.is_current_staff() RETURNS boolean LANGUAGE sql STABLE
                AS 'SELECT current_setting(''christmas.preview_staff'', true) = ''on''';
            REVOKE ALL ON FUNCTION public.is_current_staff() FROM PUBLIC;
            GRANT EXECUTE ON FUNCTION public.is_current_staff() TO authenticated;
        `)
        await db.exec(await readFile(migration, 'utf8'))
        return db
    } catch (error) {
        await db.close()
        throw error
    }
}

function reply(response, status, data) {
    response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
    response.end(JSON.stringify(data))
}

async function readJson(request) {
    let body = ''
    request.setEncoding('utf8')
    for await (const chunk of request) {
        body += chunk
        if (body.length > 405000) throw new Error('drawing_too_large')
    }
    return JSON.parse(body)
}

export function christmasLocalPreview() {
    return {
        name: 'haifn-christmas-preview',
        configureServer(server) {
            let database
            server.httpServer?.once('close', () => { void database?.then(db => db.close()).catch(() => {}) })
            server.middlewares.use(async (request, response, next) => {
                const url = new URL(request.url, 'http://localhost')
                const prefix = '/__haifn_christmas/'
                if (!url.pathname.startsWith(prefix)) return next()
                const route = url.pathname.slice(prefix.length)
                const method = request.method
                const loopback = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.socket.remoteAddress)
                const staff = route.startsWith('manage/')
                if (staff && !loopback) return reply(response, 403, { code: 'preview_local_only' })
                if (method !== 'GET' && request.headers.origin !== `http://${request.headers.host}`) {
                    return reply(response, 403, { code: 'invalid_origin' })
                }
                if (route === 'network' && method === 'GET') {
                    const addresses = Object.values(networkInterfaces()).flat()
                    const address = addresses.find(entry => entry?.family === 'IPv4' && !entry.internal
                        && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(entry.address))
                    return reply(response, 200, { host: address?.address ?? null })
                }

                try {
                    const body = ['POST', 'PATCH'].includes(method) ? await readJson(request) : null
                    database ??= createChristmasPreviewDatabase()
                    const db = await database
                    const result = await db.transaction(async tx => {
                        await tx.exec(staff
                            ? "SET LOCAL ROLE authenticated; SET LOCAL christmas.preview_staff = 'on'"
                            : 'SET LOCAL ROLE anon')
                        if (route.endsWith('mode')) {
                            if (method === 'GET') return (await tx.query('SELECT mode FROM public.haifn_christmas_settings')).rows[0]
                            if (staff && method === 'PATCH') {
                                return (await tx.query('UPDATE public.haifn_christmas_settings SET mode = $1 WHERE singleton RETURNING mode', [body.mode])).rows[0]
                            }
                        }
                        if (route === 'drawings' && method === 'POST') {
                            await tx.query('INSERT INTO public.haifn_christmas_drawings (id, image) VALUES ($1, $2)', [body.id, body.image])
                            return {}
                        }
                        if (['drawings', 'manage/drawings'].includes(route) && method === 'GET') {
                            const offset = Math.max(0, Number.parseInt(url.searchParams.get('offset'), 10) || 0)
                            return (await tx.query(`
                                SELECT id, status, created_at FROM public.haifn_christmas_drawings
                                WHERE ($1 OR status = 'published')
                                ORDER BY created_at DESC, id DESC LIMIT 500 OFFSET $2
                            `, [staff, offset])).rows
                        }
                        const imageRoute = /^(?:manage\/)?drawings\/([\da-f-]{36})$/i.exec(route)
                        if (imageRoute && method === 'GET') {
                            return (await tx.query('SELECT image FROM public.haifn_christmas_drawings WHERE id = $1', [imageRoute[1]])).rows[0]
                        }
                        if (imageRoute && staff && method === 'PATCH') {
                            return (await tx.query('UPDATE public.haifn_christmas_drawings SET status = $1 WHERE id = $2 RETURNING id', [body.status, imageRoute[1]])).rows[0]
                        }
                        return undefined
                    })
                    return result === undefined
                        ? reply(response, 404, { code: 'not_found' })
                        : reply(response, 200, result)
                } catch (error) {
                    return reply(response, error.code === '23505' ? 409 : 400, {
                        code: error.code || 'preview_error',
                        message: error.message === 'christmas_submissions_closed' ? error.message : undefined,
                    })
                }
            })
        },
    }
}
