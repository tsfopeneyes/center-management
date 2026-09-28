import {createProfileReadService} from './profileReadService.mjs';
import {createProfileUpdateService} from './profileUpdateService.mjs';
import {createTermsAcceptanceService} from './termsAcceptanceService.mjs';

export function createProfileBundle({pool,verifyToken,readiness,profileImageOrigin,termsVersion,now=Date.now}){
    return Object.freeze({
        read:createProfileReadService({pool,verifyToken,readiness,now}),
        update:createProfileUpdateService({pool,verifyToken,readiness,profileImageOrigin,now}),
        acceptTerms:createTermsAcceptanceService({pool,verifyToken,readiness,termsVersion,now})
    });
}
