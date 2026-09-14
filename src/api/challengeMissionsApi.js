import { supabase } from '../supabaseClient';

const tableFor = format => format === 'ONLINE'
    ? 'online_challenge_missions'
    : 'offline_challenge_missions';

const normalizeMission = (mission, index, format) => ({
    id: mission.id,
    title: mission.title || '',
    description: mission.description || '',
    sort_order: mission.sort_order ?? index,
    ...(format === 'ONLINE'
        ? {
            schedule_type: mission.schedule_type || 'FLEXIBLE',
            fixed_date: mission.schedule_type === 'FIXED_DATE' ? (mission.fixed_date || '') : '',
            target_count: mission.schedule_type === 'FLEXIBLE' ? Math.max(1, Number(mission.target_count) || 1) : 1,
        }
        : {
            location: mission.location || '',
            verification_type: String(mission.verification_type || 'PHOTO').toUpperCase(),
        }),
});

export const challengeMissionsApi = {
    async fetchMissions(challengeId, format = 'OFFLINE', { includeInactive = false } = {}) {
        let query = supabase
            .from(tableFor(format))
            .select('*')
            .eq('challenge_id', challengeId)
            .order('sort_order', { ascending: true });
        if (!includeInactive) query = query.eq('is_active', true);
        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map((mission, index) => normalizeMission(mission, index, format));
    },

    async fetchMissionsForChallenges(challenges = []) {
        const onlineIds = challenges.filter(item => item.is_challenge && item.challenge_format === 'ONLINE').map(item => item.id);
        const offlineIds = challenges.filter(item => item.is_challenge && item.challenge_format !== 'ONLINE').map(item => item.id);
        const [onlineResult, offlineResult] = await Promise.all([
            onlineIds.length
                ? supabase.from('online_challenge_missions').select('*').in('challenge_id', onlineIds).eq('is_active', true).order('sort_order')
                : Promise.resolve({ data: [], error: null }),
            offlineIds.length
                ? supabase.from('offline_challenge_missions').select('*').in('challenge_id', offlineIds).eq('is_active', true).order('sort_order')
                : Promise.resolve({ data: [], error: null }),
        ]);
        if (onlineResult.error) throw onlineResult.error;
        if (offlineResult.error) throw offlineResult.error;
        const grouped = new Map();
        [...(onlineResult.data || []), ...(offlineResult.data || [])].forEach(mission => {
            const values = grouped.get(mission.challenge_id) || [];
            values.push(mission);
            grouped.set(mission.challenge_id, values);
        });
        return challenges.map(challenge => ({
            ...challenge,
            challenge_missions: (grouped.get(challenge.id) || []).map((mission, index) =>
                normalizeMission(mission, index, challenge.challenge_format || 'OFFLINE')),
        }));
    },

    async syncMissions(challengeId, format, missions) {
        const normalized = (missions || []).map((mission, index) => normalizeMission(mission, index, format));
        const { error: rpcError } = await supabase.rpc('sync_challenge_missions', {
            p_notice_id: challengeId,
            p_format: format,
            p_missions: normalized,
        });
        if (!rpcError) return;

        // Staged-deployment fallback: the same normalized rows are written
        // directly. DB constraints and RLS remain the final authority.
        if (!['PGRST202', '42883'].includes(rpcError.code)) throw rpcError;
        const table = tableFor(format);
        const ids = normalized.map(item => item.id);
        const rows = normalized.map(item => ({
            ...item,
            ...(format === 'ONLINE' ? { fixed_date: item.fixed_date || null } : {}),
            challenge_id: challengeId,
            is_active: true,
            updated_at: new Date().toISOString(),
        }));
        if (rows.length) {
            const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' });
            if (error) throw error;
        }
        let inactiveQuery = supabase.from(table).update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('challenge_id', challengeId).eq('is_active', true);
        if (ids.length) inactiveQuery = inactiveQuery.not('id', 'in', `(${ids.join(',')})`);
        const { error: inactiveError } = await inactiveQuery;
        if (inactiveError) throw inactiveError;
    },

    async fetchSubmissions(challengeId, format = 'OFFLINE') {
        const table = format === 'ONLINE' ? 'online_challenge_submissions' : 'offline_challenge_submissions';
        const { data, error } = await supabase.from(table).select('*').eq('challenge_id', challengeId);
        if (error) throw error;
        return format === 'ONLINE' ? (data || []).filter(item => item.is_valid) : (data || []);
    },

    async submitOffline({ challengeId, missionId, participantId, authText = null, authImageUrl = null }) {
        const payload = {
            challenge_id: challengeId,
            mission_id: missionId,
            participant_id: participantId,
            auth_text: authText || null,
            auth_image_url: authImageUrl || null,
            status: 'COMPLETED',
            submitted_at: new Date().toISOString(),
            completed_at: new Date().toISOString(),
        };
        const { data, error } = await supabase.from('offline_challenge_submissions')
            .upsert(payload, { onConflict: 'mission_id,participant_id' }).select().single();
        if (error) throw error;
        return data;
    },
};
