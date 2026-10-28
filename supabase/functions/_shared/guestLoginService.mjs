import {LoginError,validateLogin,normalizeLoginName,isProfileId} from './loginSecurity.mjs';

const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
// Returns null for ordinary member credentials. Successful guest credentials
// issue the same native Auth session and private assurance used by every screen.
export function createGuestLoginService({pool,keyFor,bridge,adminAuth,gateway,verifyToken,readiness,loginDomain,assuranceTtlMs,now=Date.now}){
    const sql=async(text,args)=>{
        try{return (await pool.query(text,args)).rows[0]?.result;}
        catch(error){throw new LoginError(error.code==='42501'?'invalid_login':'temporarily_unavailable',error.code==='42501'?401:503);}
    };
    return async(raw,context={})=>{
        const input=validateLogin(raw);
        if(!/^\d{4}$/.test(input.password))return null;
        if(!await readiness()||typeof context.clientKey!=='string'||!context.clientKey)throw new LoginError('temporarily_unavailable',503);
        const abort=()=>{if(context.signal?.aborted)throw new LoginError('temporarily_unavailable',503);};
        const prepared=await sql('SELECT account_security.prepare_guest_login($1,$2,$3,$4,$5,$6,$7,$8) AS result',[
            input.profileId||null,input.name||null,input.phone||null,input.password,
            await keyFor('guest-main-client',context.clientKey),await keyFor('guest-main-subject',input.profileId||input.name.replace(/\s*\(guest\)\s*$/i,'')),
            crypto.randomUUID(),loginDomain]);
        if(prepared?.kind==='member')return null;
        if(prepared?.kind!=='guest')throw new LoginError(prepared?.code||'invalid_login',prepared?.code==='try_later'?429:prepared?.code==='selection_required'?409:401);
        abort();let authUserId=prepared.authUserId,created=null;
        const nativePassword=async()=>bridge.providerPassword(prepared.profileId,await digest('guest-provider-v1:'+prepared.operationId));
        try{
            if(!authUserId){
                if(prepared.state==='creating'){
                    const recovered=await adminAuth.findUserByEmail(prepared.loginEmail,prepared.operationId,prepared.profileId);
                    if(recovered?.error)throw new LoginError('temporarily_unavailable',503);
                    if(isProfileId(recovered?.data?.user?.id))authUserId=recovered.data.user.id;
                }
                const winner=!authUserId&&await sql('SELECT account_security.claim_guest_auth_creation($1,$2) AS result',[prepared.profileId,prepared.operationId]);
                abort();
                if(winner){
                    const issued=await adminAuth.createUser({email:prepared.loginEmail,password:await nativePassword(),email_confirm:true,
                        app_metadata:{guest_login_profile:prepared.profileId,guest_login_operation:prepared.operationId}});
                    if(issued?.error||!isProfileId(issued?.data?.user?.id))throw new LoginError('temporarily_unavailable',503);
                    authUserId=issued.data.user.id;
                }else if(!authUserId){
                    const recovered=await adminAuth.findUserByEmail(prepared.loginEmail,prepared.operationId,prepared.profileId);
                    if(recovered?.error||!isProfileId(recovered?.data?.user?.id))throw new LoginError('temporarily_unavailable',503);
                    authUserId=recovered.data.user.id;
                }
                await sql('SELECT account_security.complete_guest_auth_creation($1,$2,$3) AS result',[prepared.profileId,prepared.operationId,authUserId]);
            }
            abort();
            if(prepared.operationId && (!prepared.credentialMode||prepared.credentialMode==='guest_phone_pin')){
                created=await gateway.signIn(prepared.loginEmail,await nativePassword(),{signal:context.signal});
            }else if(prepared.credentialMode==='legacy_bridge'&&prepared.legacyDigest){
                created=await gateway.signIn(prepared.loginEmail,await bridge.providerPassword(prepared.profileId,prepared.legacyDigest),{signal:context.signal});
            }else{
                const issued=await adminAuth.issueGuestSession(prepared.loginEmail,authUserId);
                if(issued?.error)throw new LoginError('temporarily_unavailable',503);created=issued.data;
            }
            abort();
            if(created?.user?.id!==authUserId||!created.access_token||!created.refresh_token)throw new LoginError('invalid_login',401);
            const principal=verifyToken.created?await verifyToken.created(created.access_token,authUserId):await verifyToken(created.access_token,{signal:context.signal});
            if(!principal||principal.authUserId!==authUserId||!isProfileId(principal.sessionId)||principal.isAnonymous!==false||principal.live!==true||principal.expiresAt<=now()+30000)
                throw new LoginError('invalid_login',401);
            abort();
            const result=await sql('SELECT account_security.finalize_guest_login($1,$2,$3,$4,$5,$6) AS result',[
                prepared.claimId,authUserId,principal.sessionId,await keyFor('name',normalizeLoginName(prepared.name)),await keyFor('phone',prepared.phone),new Date(now()+assuranceTtlMs)]);
            abort();
            return {protocol:1,profileId:result.profileId,authUserId:result.authUserId,
                session:{access_token:created.access_token,refresh_token:created.refresh_token,expires_at:principal.expiresAt/1000}};
        }catch(error){
            if(created?.access_token)try{await gateway.discardCreatedSession(created.access_token);}catch{/* assurance always rechecks live identity */}
            throw error instanceof LoginError?error:new LoginError('temporarily_unavailable',503);
        }
    };
}
