import { LoginError } from './loginSecurity.mjs';

const ident = value => '"' + String(value).replaceAll('"', '""') + '"';
const rank = status => ({ JOIN: 4, WAITLIST: 3, UNDECIDED: 2, DECLINE: 1, CANCELLED: 0 })[status];

// Keep complete originals, including conflicting form answers, before combining
// duplicate operational rows. This private archive has no profile FK/cascade.
export async function mergeProgramActivity(client, { requestId, sourceProfileId, targetProfileId }) {
    for (const [table, keys, application] of [
        ['notice_responses', ['notice_id'], true],
        ['daily_program_session_responses', ['session_id'], true],
        ['open_program_attendance', ['notice_id', 'attendance_date'], false],
        ['program_application_attempt_history', null, false],
        ['program_session_application_attempt_history', null, false],
    ]) {
        const present = (await client.query('SELECT to_regclass($1) IS NOT NULL AS present', [`public.${table}`])).rows[0]?.present;
        if (!present) continue;
        const relation = `public.${ident(table)}`;
        await client.query(`INSERT INTO account_security.account_merge_program_originals
            (request_id,source_profile_id,target_profile_id,table_name,original_profile_id,row_key,row_data)
            SELECT $1,$2,$3,$4,user_id,md5(to_jsonb(r)::text),to_jsonb(r)
            FROM ${relation} r WHERE user_id=$2 ON CONFLICT DO NOTHING`,
        [requestId, sourceProfileId, targetProfileId, table]);
        if (!keys) continue;
        const condition = keys.map(key => `s.${ident(key)} IS NOT DISTINCT FROM t.${ident(key)}`).join(' AND ');
        const duplicates = (await client.query(`SELECT s.ctid::text AS source_tid,t.ctid::text AS target_tid,
            to_jsonb(s) AS source_row,to_jsonb(t) AS target_row FROM ${relation} s JOIN ${relation} t ON ${condition}
            WHERE s.user_id=$1 AND t.user_id=$2 FOR UPDATE OF s,t`, [sourceProfileId, targetProfileId])).rows;
        for (const row of duplicates) {
            const source = row.source_row, target = row.target_row;
            await client.query(`INSERT INTO account_security.account_merge_program_originals
                (request_id,source_profile_id,target_profile_id,table_name,original_profile_id,row_key,row_data)
                VALUES($1,$2,$3,$4,$3,md5($5::jsonb::text),$5::jsonb) ON CONFLICT DO NOTHING`,
            [requestId, sourceProfileId, targetProfileId, table, JSON.stringify(target)]);
            const patch = {};
            if (application) {
                if (rank(source.status) === undefined || rank(target.status) === undefined)
                    throw new LoginError('merge_requires_review', 409);
                // Keep a valid registration; for equal status keep its original
                // earliest queue position and the matching form/answer snapshot.
                const winner = rank(source.status) > rank(target.status) ||
                    (rank(source.status) === rank(target.status) && source.created_at < target.created_at) ? source : target;
                for (const key of ['status', 'cancelled_at', 'created_at', 'application_answers',
                    'application_form_revision', 'application_form_snapshot', 'application_audience']) {
                    if (key in winner) patch[key] = winner[key];
                }
                for (const key of ['is_attended', 'is_staff']) {
                    if (key in target) patch[key] = Boolean(source[key] || target[key]);
                }
            } else if (source.created_at && target.created_at) {
                patch.created_at = source.created_at < target.created_at ? source.created_at : target.created_at;
            }
            if (Object.keys(patch).length) {
                await client.query(`UPDATE ${relation} t SET ${Object.keys(patch).map(key =>
                    `${ident(key)}=(jsonb_populate_record(NULL::${relation},$1::jsonb)).${ident(key)}`).join(',')}
                    WHERE ctid=$2::tid`, [JSON.stringify(patch), row.target_tid]);
            }
            // Only the duplicate operational row is removed; its full original
            // is retained above, inside the same transaction as the merge receipt.
            await client.query(`DELETE FROM ${relation} WHERE ctid=$1::tid`, [row.source_tid]);
        }
    }
}
