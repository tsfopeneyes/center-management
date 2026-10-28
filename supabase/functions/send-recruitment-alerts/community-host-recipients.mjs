export function isRegisteredChallengeHost(program, userId) {
    if (program?.is_challenge !== true || !userId) return false;
    const ids = [program.host_id,
        ...(Array.isArray(program.host_ids) ? program.host_ids : []),
        ...(Array.isArray(program.hosts) ? program.hosts.map(host => host?.host_id) : [])];
    return ids.some(id => typeof id === 'string' && id.toLowerCase() === String(userId).toLowerCase());
}
