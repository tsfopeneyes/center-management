import {AuthOperationError} from './loginTransport.js';

const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);

export function createTemporaryPasswordController({credentials,exclusive}){
    if(typeof credentials!=='function'||typeof exclusive!=='function')throw new Error('Temporary password dependencies required');
    return ({profileId,temporaryPassword,newPassword},{signal}={})=>exclusive(async()=>{
        if(!uuid(profileId)||typeof temporaryPassword!=='string'||!/^[0-9]{4}$/.test(temporaryPassword)||
            typeof newPassword!=='string'||newPassword.length<6||newPassword.length>128||!newPassword.trim())
            throw new AuthOperationError('invalid_request');
        const result=await credentials({action:'change-temporary',protocol:1,profileId,temporaryPassword,newPassword},{signal});
        if(result?.protocol!==1||result.status!=='login_required')throw new AuthOperationError('account_changed');
        return {status:'saved'};
    },{signal});
}
