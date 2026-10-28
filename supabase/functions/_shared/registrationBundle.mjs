import {createRegistrationFormValidator} from './registrationForm.mjs';
import {createRegistrationStore} from './registrationStore.mjs';
import {createRegistrationService} from './registrationService.mjs';
import {createMembershipFinalizer} from './membershipFinalizer.mjs';
import {LoginError} from './loginSecurity.mjs';

// Preserves the current form: no OTP, approval screen or extra question is
// introduced. The server validates every existing field and rejects adoption
// or merging of an existing profile.
export function createRegistrationBundle({registrationPool,membershipPool,limits,keyFor,adminAuth,gateway,verifyToken,
    readiness,passwordPolicy,termsVersion,loginDomain,lifetimeMs=3600000,now=Date.now}){
    const validateForm=createRegistrationFormValidator({termsVersion,now});
    const verifyEnrollment=async({enrollmentId,details},context)=>{
        const validated=validateForm(details);
        if(validated.guestUserId){
            const {rows}=await registrationPool.query('SELECT account_security.guest_has_account($1) AS mapped',[validated.guestUserId]);
            if(rows[0]?.mapped){
                const principal=context.accessToken?await verifyToken(context.accessToken,{signal:context.signal}):null;
                if(!principal||principal.live!==true||principal.isAnonymous!==false)throw new LoginError('registration_review_required',409);
                const proof=await registrationPool.query('SELECT account_security.can_upgrade_guest($1,$2,$3) AS allowed',[validated.guestUserId,principal.authUserId,principal.sessionId]);
                if(!proof.rows[0]?.allowed)throw new LoginError('registration_review_required',409);
            }
        }
        return {allowed:true,enrollmentId,identity:'phone:'+validated.profile.phone.replace(/\D/g,''),
            canonicalDetails:validated.canonicalDetails,validUntil:now()+60000};
    };
    const finalizeMembership=createMembershipFinalizer({pool:membershipPool,keyFor,validateForm,verifyToken,readiness,now,mappedGuestUpgrade:true});
    return createRegistrationService({store:createRegistrationStore(registrationPool),limits,keyFor,adminAuth,gateway,verifyToken,
        verifyEnrollment,readiness,passwordPolicy,loginDomain,lifetimeMs,finalizeMembership,now});
}
