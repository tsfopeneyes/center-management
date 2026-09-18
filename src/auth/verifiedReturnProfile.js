const settling=new Set(['initializing','restoring','refreshing']);

export function verifiedReturnProfile(auth){
    if(settling.has(auth?.status))return {settling:true,profile:null};
    const profile=auth?.status==='authenticated'&&auth.profile?.id?auth.profile:null;
    return {settling:false,profile};
}
