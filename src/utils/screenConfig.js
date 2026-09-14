import { supabase } from '../supabaseClient';

export const SCREEN_CONFIG_TITLE = 'SCREEN_DISPLAY_CONFIG';
export const SCREEN_INTERVALS = [5, 10, 15, 30, 60];
export const MAX_SCREEN_ASSETS = 100;
export const MAX_SCREEN_SET_IMAGES = 30;
export const MAX_SCREEN_SETS = 20;

const DEFAULT_SET_ID = 'default';
export const DEFAULT_SCREEN_CONFIG = Object.freeze({
    assets: [],
    sets: [{ id: DEFAULT_SET_ID, name: '기본 송출', imageIds: [], intervalSeconds: 10 }],
    activeSetId: DEFAULT_SET_ID,
    version: 2,
});

const text = (value, fallback, limit = 120) => String(value || fallback).trim().slice(0, limit) || fallback;
const validUrl = value => typeof value === 'string' && value.startsWith('https://');
const validInterval = value => SCREEN_INTERVALS.includes(Number(value)) ? Number(value) : 10;

export function normalizeScreenConfig(value) {
    // Version 1 stored only the live image list. Preserve it as the first
    // reusable set so an upgrade never changes what is currently on screen.
    const sourceAssets = Array.isArray(value?.assets) ? value.assets : (Array.isArray(value?.images) ? value.images : []);
    const assets = sourceAssets
        .filter(item => item && typeof item.id === 'string' && validUrl(item.url))
        .slice(0, MAX_SCREEN_ASSETS)
        .map(item => ({ id: item.id, url: item.url, name: text(item.name, '이미지') }));
    const assetIds = new Set(assets.map(item => item.id));
    const sourceSets = Array.isArray(value?.sets) && value.sets.length
        ? value.sets
        : [{ id: DEFAULT_SET_ID, name: '기본 송출', imageIds: assets.map(item => item.id), intervalSeconds: value?.intervalSeconds }];
    const seenSetIds = new Set();
    const sets = sourceSets.filter(item => item && typeof item.id === 'string' && !seenSetIds.has(item.id))
        .slice(0, MAX_SCREEN_SETS)
        .map((item, index) => {
            seenSetIds.add(item.id);
            const imageIds = [...new Set(Array.isArray(item.imageIds) ? item.imageIds : [])]
                .filter(id => assetIds.has(id)).slice(0, MAX_SCREEN_SET_IMAGES);
            return { id: item.id, name: text(item.name, `송출 세트 ${index + 1}`, 40), imageIds, intervalSeconds: validInterval(item.intervalSeconds) };
        });
    if (!sets.length) sets.push({ ...DEFAULT_SCREEN_CONFIG.sets[0] });
    const activeSetId = sets.some(item => item.id === value?.activeSetId) ? value.activeSetId : sets[0].id;
    return { assets, sets, activeSetId, version: 2 };
}

export function getActiveScreenConfig(config) {
    const normalized = normalizeScreenConfig(config);
    const activeSet = normalized.sets.find(item => item.id === normalized.activeSetId) || normalized.sets[0];
    const assetMap = new Map(normalized.assets.map(item => [item.id, item]));
    return {
        images: activeSet.imageIds.map(id => assetMap.get(id)).filter(Boolean),
        intervalSeconds: activeSet.intervalSeconds,
        setId: activeSet.id,
        setName: activeSet.name,
        version: 2,
    };
}

export async function loadScreenConfig() {
    const { data, error } = await supabase.from('notices').select('content')
        .eq('category', 'SYSTEM').eq('title', SCREEN_CONFIG_TITLE).maybeSingle();
    if (error) throw error;
    if (!data?.content) return normalizeScreenConfig(DEFAULT_SCREEN_CONFIG);
    try { return normalizeScreenConfig(JSON.parse(data.content)); }
    catch { return normalizeScreenConfig(DEFAULT_SCREEN_CONFIG); }
}

export async function saveScreenConfig(config) {
    const normalized = normalizeScreenConfig(config);
    const { data: existing, error: readError } = await supabase.from('notices').select('id')
        .eq('category', 'SYSTEM').eq('title', SCREEN_CONFIG_TITLE).maybeSingle();
    if (readError) throw readError;
    const payload = { content: JSON.stringify(normalized) };
    const request = existing?.id
        ? supabase.from('notices').update(payload).eq('id', existing.id)
        : supabase.from('notices').insert({ ...payload, title: SCREEN_CONFIG_TITLE, category: 'SYSTEM' });
    const { error } = await request;
    if (error) throw error;
    return normalized;
}
