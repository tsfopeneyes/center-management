const normalized = value => String(value || '').trim().toLowerCase();

export const ACCOUNT_ROLES = Object.freeze({
    MEMBER: 'member',
    ADMIN: 'admin',
    MASTER: 'master',
});

export const normalizeAccountRole = value => {
    const role = normalized(value);
    return Object.values(ACCOUNT_ROLES).includes(role) ? role : ACCOUNT_ROLES.MEMBER;
};

export const isStaffAccountRole = value => ['admin', 'master'].includes(normalizeAccountRole(value));
export const isMasterAccountRole = value => normalizeAccountRole(value) === ACCOUNT_ROLES.MASTER;

// Runtime authorization and recipient classification consume only the
// canonical private role (or its public read-only projection).
export const isMasterStaff = profile => Boolean(profile) &&
    isMasterAccountRole(profile.account_role ?? profile.accountRole);

export const isStaffProfile = profile => Boolean(profile) &&
    isStaffAccountRole(profile.account_role ?? profile.accountRole);

export async function attachCanonicalAccountRoles(db, profiles) {
    const rows = Array.isArray(profiles) ? profiles : [];
    const ids = [...new Set(rows.map(profile => profile?.id).filter(Boolean))];
    if (!ids.length) return rows.map(profile => ({...profile, account_role: ACCOUNT_ROLES.MEMBER}));
    const {data,error}=await db.from('staff_directory').select('id,role').in('id',ids);
    if(error)throw error;
    const roles=new Map((data||[]).map(item=>[String(item.id),normalizeAccountRole(item.role)]));
    return rows.map(profile=>({...profile,account_role:roles.get(String(profile.id))||ACCOUNT_ROLES.MEMBER}));
}

// Bootstrap is the only legacy boundary. It converts historical profile fields
// once when creating the private account role; no runtime permission uses them.
export const legacyProfileToAccountRole = profile => {
    if (!profile) return ACCOUNT_ROLES.MEMBER;
    if (profile.is_master === true || profile.isMaster === true || normalized(profile.role) === 'master') {
        return ACCOUNT_ROLES.MASTER;
    }
    const legacyRole = normalized(profile.role);
    const legacyGroup = normalized(profile.user_group ?? profile.userGroup);
    return ['admin', 'staff', 'rok'].includes(legacyRole) || ['staff', '관리자'].includes(legacyGroup)
        ? ACCOUNT_ROLES.ADMIN
        : ACCOUNT_ROLES.MEMBER;
};
