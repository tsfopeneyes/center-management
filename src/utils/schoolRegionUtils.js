import { supabase, supabaseUrl } from '../supabaseClient';
import { createSchoolRegionResolver, withSchoolLookupTimeout } from './schoolRegionResolver';

async function readSchools() {
    try {
        return await withSchoolLookupTimeout(async () => {
            const { data, error } = await supabase.from('schools').select('name, region');
            if (error) throw error;
            if (!Array.isArray(data)) throw new Error('Invalid school response');
            return data;
        });
    } catch {
        // Same public school directory as registration, without a restored SDK's aborted signal.
        const controller = new AbortController();
        try {
            return await withSchoolLookupTimeout(async () => {
                const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
                const response = await fetch(`${supabaseUrl}/rest/v1/schools?select=name,region`, {
                    headers: { apikey: key, Authorization: `Bearer ${key}` },
                    signal: controller.signal,
                    cache: 'no-store',
                });
                if (!response.ok) throw Object.assign(new Error('School lookup failed'), { code: `HTTP_${response.status}` });
                return response.json();
            });
        } finally { controller.abort(); }
    }
}

export const resolveSchoolRegion = createSchoolRegionResolver({ readSchools });
