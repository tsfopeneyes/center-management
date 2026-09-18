const staleCodes=new Set(['invalid_login','account_changed','session_apply_failed']);

export async function recoverCredentialSession(error,{auth,storage=globalThis.localStorage}={}){
    if(!staleCodes.has(error?.code)&&!staleCodes.has(error?.message))return false;
    try{await auth?.signOut?.({scope:'local'});}catch{/* local state is cleared below even if the remote session is gone */}
    storage?.removeItem?.('user');
    storage?.removeItem?.('admin_user');
    return true;
}
