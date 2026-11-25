import { supabase } from '../../supabaseClient'

export const CHRISTMAS_PATH = '/2026christmas'
const productionOrigin = 'https://app.schoolchurchimpact.org'
export const PAGE_SIZE = 500
const preview = import.meta.env.DEV
const settings = 'haifn_christmas_settings'
const drawings = 'haifn_christmas_drawings'

async function local(path, method = 'GET', body) {
    const response = await fetch(`/__haifn_christmas/${path}`, {
        method,
        cache: 'no-store',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
    })
    const result = await response.json()
    if (!response.ok) throw Object.assign(new Error(result.message || result.code), result)
    return result
}

async function dataFrom(query) {
    const { data, error } = await query
    if (error) throw error
    return data
}

export function drawingId() {
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    bytes[6] = (bytes[6] & 15) | 64
    bytes[8] = (bytes[8] & 63) | 128
    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
    return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-')
}

export async function participationUrl() {
    const url = new URL(CHRISTMAS_PATH, preview ? window.location.origin : productionOrigin)
    if (preview && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
        const { host } = await local('network')
        if (host) url.hostname = host
    }
    return url.href
}

export const christmasApi = {
    async mode() {
        const result = preview ? await local('mode')
            : await dataFrom(supabase.from(settings).select('mode').eq('singleton', true).single())
        return result.mode
    },
    async submit(id, image) {
        try {
            if (preview) await local('drawings', 'POST', { id, image })
            else await dataFrom(supabase.from(drawings).insert({ id, image }))
        } catch (error) {
            if (error.code !== '23505') throw error
        }
    },
    async list(manage = false) {
        const rows = []
        for (let offset = 0; ; offset += PAGE_SIZE) {
            let page
            if (preview) {
                page = await local(`${manage ? 'manage/' : ''}drawings?offset=${offset}`)
            } else {
                let query = supabase.from(drawings).select('id,status,created_at')
                    .order('created_at', { ascending: false }).order('id', { ascending: false })
                    .range(offset, offset + PAGE_SIZE - 1)
                if (!manage) query = query.eq('status', 'published')
                page = await dataFrom(query)
            }
            rows.push(...page)
            if (page.length < PAGE_SIZE) return Array.from(new Map(rows.map(row => [row.id, row])).values())
        }
    },
    async image(id, manage = false) {
        const result = preview ? await local(`${manage ? 'manage/' : ''}drawings/${id}`)
            : await dataFrom(supabase.from(drawings).select('image').eq('id', id).maybeSingle())
        return result?.image ?? null
    },
    setMode(mode) {
        if (preview) return local('manage/mode', 'PATCH', { mode })
        return dataFrom(supabase.from(settings).update({ mode }).eq('singleton', true).select('mode').single())
    },
    setStatus(id, status) {
        if (preview) return local(`manage/drawings/${id}`, 'PATCH', { status })
        return dataFrom(supabase.from(drawings).update({ status }).eq('id', id).select('id').single())
    },
}
