import {LoginError} from './loginSecurity.mjs';

const projection = `id,request_key AS "requestKey",identity_key AS "identityKey",details_key AS "detailsKey",
    login_email AS "loginEmail",state,auth_user_id AS "authUserId",valid_until>clock_timestamp() AS usable`;

export function createRegistrationStore(pool) {
    return {
        async reserve({id,requestKey,identityKey,detailsKey,loginEmail,lifetimeMs}) {
            // Each statement autocommits. A lost INSERT response is recovered by
            // request_key, and a lost claim response must NEVER trigger create.
            await pool.query(`INSERT INTO account_security.registration_operations
                (id,request_key,identity_key,details_key,login_email,valid_until)
                VALUES($1,$2,$3,$4,$5,clock_timestamp()+($6 * interval '1 millisecond'))
                ON CONFLICT DO NOTHING`,[id,requestKey,identityKey,detailsKey,loginEmail,lifetimeMs]);
            let {rows}=await pool.query(`SELECT ${projection} FROM account_security.registration_operations WHERE request_key=$1`,[requestKey]);
            let row=rows[0];
            // A mobile browser can lose its request secret after Auth creation.
            // An expired auth_ready operation can also be recovered, but only
            // after the service verifies the existing Auth user's password.
            if(!row) {
                ({rows}=await pool.query(`SELECT ${projection} FROM account_security.registration_operations
                    WHERE identity_key=$1 AND details_key=$2 AND state='auth_ready'`,[identityKey,detailsKey]));
                row=rows.length===1?rows[0]:null;
            }
            if(!row || row.identityKey!==identityKey || row.detailsKey!==detailsKey ||
                (!row.usable && row.state!=='auth_ready')) {
                throw new LoginError('registration_review_required',409);
            }
            return row;
        },
        async claim(operation) {
            const {rows}=await pool.query(`UPDATE account_security.registration_operations SET state='creating'
                WHERE id=$1 AND request_key=$2 AND state='reserved' AND valid_until>clock_timestamp() RETURNING id`,
                [operation.id,operation.requestKey]);
            return rows.length===1;
        },
        async markReady(operation,authUserId,lifetimeMs) {
            // Recheck the authoritative binding in the write itself. No email-only
            // adoption, metadata from public users, or account/profile linking.
            // Extend an expired auth_ready operation only after fresh password
            // and live-session proof; never re-run Auth create for it.
            const {rows}=await pool.query(`UPDATE account_security.registration_operations o
                SET state='auth_ready',auth_user_id=$3,ready_at=COALESCE(ready_at,clock_timestamp()),
                    valid_until=CASE WHEN o.state='auth_ready' AND o.valid_until<=clock_timestamp()
                        THEN clock_timestamp()+($4 * interval '1 millisecond') ELSE o.valid_until END
                WHERE o.id=$1 AND o.request_key=$2
                AND ((o.state='creating' AND o.valid_until>clock_timestamp())
                    OR (o.state='auth_ready' AND o.auth_user_id=$3))
                RETURNING o.id`,[operation.id,operation.requestKey,authUserId,lifetimeMs]);
            if(rows.length!==1)throw new LoginError('registration_review_required',409);
        }
    };
}
