import {LoginError,isProfileId} from './loginSecurity.mjs';

export function createTermsAcceptanceService({pool,verifyToken,readiness=async()=>false,termsVersion,now=Date.now}){
    return async({accessToken,profileId,agreements,termsVersion:submittedVersion,source},{signal}={})=>{
        if(!isProfileId(profileId)||typeof accessToken!=='string'||!accessToken||submittedVersion!==termsVersion
            ||source!=='WEB_LOGIN'||!agreements||typeof agreements!=='object'||Array.isArray(agreements)
            ||!['art1','art2','art3','art4'].every(key=>agreements[key]===true))throw new LoginError('invalid_request',400);
        if(!await readiness())throw new LoginError('temporarily_unavailable',503);
        const principal=await verifyToken(accessToken,{signal});
        if(!principal||!isProfileId(principal.authUserId)||!isProfileId(principal.sessionId)||principal.live!==true
            ||principal.isAnonymous!==false||!Number.isFinite(principal.expiresAt)||principal.expiresAt<=now())throw new LoginError('invalid_login',401);
        const client=await pool.connect();let committed=false,discard=false;
        try{
            try{await client.query('BEGIN');}catch(error){discard=true;throw error;}
            await client.query("SET LOCAL statement_timeout='3s'");
            await client.query("SET LOCAL idle_in_transaction_session_timeout='5s'");
            await client.query("SELECT set_config('app.profile_id',$1,true)",[profileId]);
            if(signal?.aborted)throw new LoginError('temporarily_unavailable',503);
            const {rows}=await client.query(`UPDATE public.users u SET preferences=COALESCE(u.preferences,'{}'::jsonb)||jsonb_build_object(
                'terms_agreed',true,'terms_version',$5::text,'terms_agreed_at',clock_timestamp(),'terms_consent_source','WEB_LOGIN')
                WHERE u.id=$3::uuid AND u.status IS DISTINCT FROM 'withdrawn'
                AND u.user_group NOT IN ('게스트','미가입') AND COALESCE((u.preferences->>'is_temporary')::boolean,false)=false
                AND EXISTS(SELECT 1 FROM account_security.accounts a
                    JOIN account_security.session_assurances s ON s.profile_id=a.profile_id AND s.auth_user_id=a.auth_user_id
                    WHERE a.profile_id=u.id AND a.auth_user_id=$1::uuid AND s.session_id=$2::uuid
                    AND a.mapping_verified AND a.status='active' AND NOT a.must_change_password
                    AND s.status='trusted' AND s.credential_version=a.credential_version
                    AND to_timestamp($4::double precision/1000)>clock_timestamp())
                RETURNING u.preferences`,[principal.authUserId,principal.sessionId,profileId,principal.expiresAt,termsVersion]);
            if(rows.length!==1)throw new LoginError('forbidden',403);
            await client.query(`INSERT INTO account_security.member_terms_consents(
                profile_id,auth_user_id,session_id,terms_version,source,art1,art2,art3,art4,accepted_at)
                VALUES($1,$2,$3,$4,'WEB_LOGIN',true,true,true,true,clock_timestamp())
                ON CONFLICT(profile_id,terms_version) DO NOTHING`,[profileId,principal.authUserId,principal.sessionId,termsVersion]);
            if(signal?.aborted)throw new LoginError('temporarily_unavailable',503);
            await client.query('COMMIT');committed=true;
            return {protocol:1,status:'saved',preferences:rows[0].preferences};
        }catch(error){if(error instanceof LoginError)throw error;throw new LoginError('temporarily_unavailable',503);}
        finally{if(!committed)try{await client.query('ROLLBACK');}catch{discard=true;}client.release(discard?new Error('Uncertain transaction'):undefined);}
    };
}
