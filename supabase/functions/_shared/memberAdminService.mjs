import {LoginError,isProfileId} from './loginSecurity.mjs';
import {ACCOUNT_ROLES,normalizeAccountRole} from './staffRoles.mjs';

const assignableRoles=new Set(Object.values(ACCOUNT_ROLES));

export function createMemberAdminService({pool,authorize,readiness=async()=>false}){
    return async({accessToken,profileId,targetRole,reason='admin_role_change'},{signal}={})=>{
        if(!isProfileId(profileId)||typeof targetRole!=='string'||!assignableRoles.has(targetRole)||
            typeof reason!=='string'||!reason.trim()||reason.length>200)throw new LoginError('invalid_request',400);
        if(!await readiness())throw new LoginError('temporarily_unavailable',503);
        if(signal?.aborted)throw new LoginError('temporarily_unavailable',503);
        const actor=await authorize({accessToken,action:'roles.manage',targetProfileId:profileId});
        const client=await pool.connect();let committed=false,discard=false;
        try{
            try{await client.query('BEGIN');}catch(error){discard=true;throw error;}
            await client.query("SET LOCAL statement_timeout='3s'");
            await client.query("SET LOCAL idle_in_transaction_session_timeout='5s'");
            await client.query("SELECT set_config('app.target_profile_id',$1,true)",[profileId]);
            await client.query("SELECT set_config('app.actor_profile_id',$1,true)",[actor.actorProfileId]);
            await client.query("SELECT set_config('app.role_change_reason',$1,true)",[reason.trim()]);
            await client.query("SELECT pg_advisory_xact_lock(hashtextextended('account-role-change',0))");

            const liveActor=(await client.query(`SELECT role FROM account_security.account_roles
                WHERE profile_id=$1 AND enabled FOR UPDATE`,[actor.actorProfileId])).rows[0];
            if(normalizeAccountRole(liveActor?.role)!==ACCOUNT_ROLES.MASTER)throw new LoginError('forbidden',403);

            const target=(await client.query(`SELECT r.role,r.enabled,a.mapping_verified,a.status,u.status AS profile_status
                FROM account_security.account_roles r
                JOIN account_security.accounts a USING(profile_id)
                JOIN public.users u ON u.id=r.profile_id
                WHERE r.profile_id=$1 FOR UPDATE OF r`,[profileId])).rows[0];
            if(!target||target.enabled!==true||target.mapping_verified!==true||target.status!=='active'||target.profile_status==='withdrawn')
                throw new LoginError('account_changed',409);

            if(target.role==='master'&&targetRole!=='master'){
                const otherMasters=(await client.query(`SELECT count(*)::int AS count
                    FROM account_security.account_roles r
                    JOIN account_security.accounts a USING(profile_id)
                    JOIN public.users u ON u.id=r.profile_id
                    WHERE r.enabled AND r.role='master' AND r.profile_id<>$1
                      AND a.mapping_verified AND a.status='active' AND u.status IS DISTINCT FROM 'withdrawn'`,[profileId])).rows[0]?.count||0;
                if(otherMasters<1)throw new LoginError('forbidden',403);
            }

            if(target.role!==targetRole){
                const changed=await client.query(`UPDATE account_security.account_roles
                    SET role=$2,enabled=true WHERE profile_id=$1 RETURNING profile_id,role,enabled`,[profileId,targetRole]);
                if(changed.rows.length!==1)throw new LoginError('account_changed',409);
            }
            if(signal?.aborted)throw new LoginError('temporarily_unavailable',503);
            await client.query('COMMIT');committed=true;
            return {protocol:1,status:'saved',profileId,role:targetRole};
        }catch(error){if(error instanceof LoginError)throw error;throw new LoginError('temporarily_unavailable',503);}
        finally{if(!committed)try{await client.query('ROLLBACK');}catch{discard=true;}client.release(discard?new Error('Uncertain transaction'):undefined);}
    };
}
