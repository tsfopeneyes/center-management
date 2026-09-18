import {supabase} from '../supabaseClient';
import {getAccountAuthClient,isAccountAuthEnabled} from './accountAuthRuntime';
import {uploadWithSession} from './uploadWithSession';

export async function uploadAccountImage({profileId,kind,file,sessionToken}){
    if(!isAccountAuthEnabled())return null;
    const client=getAccountAuthClient();
    return uploadWithSession({auth:supabase.auth,upload:client.upload,verifySession:client.session,profileId,kind,file,sessionToken});
}

export function cachedAccountProfileId(){
    for(const key of ['admin_user','user'])try{const value=JSON.parse(localStorage.getItem(key)||'null');if(value?.id)return value.id;}catch{}
    return null;
}
