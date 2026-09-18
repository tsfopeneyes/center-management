import {supabase} from '../supabaseClient';
import {getAccountAuthClient,isAccountAuthEnabled} from './accountAuthRuntime';
import {uploadWithSession} from './uploadWithSession';

export async function uploadAccountImage({profileId,kind,file}){
    if(!isAccountAuthEnabled())return null;
    return uploadWithSession({auth:supabase.auth,upload:getAccountAuthClient().upload,profileId,kind,file});
}

export function cachedAccountProfileId(){
    for(const key of ['admin_user','user'])try{const value=JSON.parse(localStorage.getItem(key)||'null');if(value?.id)return value.id;}catch{}
    return null;
}
