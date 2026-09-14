import {attachCanonicalAccountRoles,isMasterStaff,isStaffProfile} from './staffRoles.mjs';

const normalizeSchoolName=(name='')=>String(name).replace(/\s+/g,'')
    .replace(/여자고등학교$/,'여고').replace(/여자중학교$/,'여중')
    .replace(/과학고등학교$/,'과고').replace(/외국어고등학교$/,'외고')
    .replace(/고등학교$/,'고').replace(/중학교$/,'중').replace(/초등학교$/,'초');


export async function filterProgramUsersByRegions(db,users,regions) {
    const selected=Array.isArray(regions)?regions.filter(Boolean):[];
    if(!selected.length || selected.length>=2)return users;

    const [{data:schools,error:schoolsError},{data:configRow,error:configError}]=await Promise.all([
        db.from('schools').select('name').in('region',selected),
        db.from('notices').select('content').eq('category','SYSTEM').eq('title','STAFF_PRESENCE_CONFIG').maybeSingle(),
    ]);
    if(schoolsError)throw schoolsError;
    if(configError)throw configError;

    const schoolKeys=new Set((schools||[]).map(row=>normalizeSchoolName(row.name)).filter(Boolean));
    let staffConfig={"하이픈":[],"이높플레이스":[]};
    try {
        const parsed=JSON.parse(configRow?.content||'{}');
        staffConfig=Array.isArray(parsed)
            ? {"하이픈":parsed,"이높플레이스":parsed}
            : {...staffConfig,...(parsed&&typeof parsed==='object'?parsed:{})};
    } catch {}
    const centerIds=new Set(selected.flatMap(region=>
        staffConfig[region==='강서'?'이높플레이스':'하이픈']||[]).map(String));

    const canonicalUsers=await attachCanonicalAccountRoles(db,users);
    return canonicalUsers.filter(user=>{
        if(isStaffProfile(user))return isMasterStaff(user) || centerIds.has(String(user.id));
        return schoolKeys.has(normalizeSchoolName(user.school));
    });
}
