import {AuthOperationError} from './loginTransport.js';

const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);

// A direct name login intentionally starts without exposing a profile id. When
// the server says that the sole matching account needs a password change, load
// that same bounded candidate projection before opening the restricted form.
export async function resolveTemporaryPasswordCandidate(candidate,loadCandidates){
    if(uuid(candidate?.id))return candidate;
    if(typeof candidate?.name!=='string'||!candidate.name.trim()||typeof loadCandidates!=='function')
        throw new AuthOperationError('account_changed');
    const matches=await loadCandidates(candidate.name);
    if(!Array.isArray(matches)||matches.length!==1||!uuid(matches[0]?.id))
        throw new AuthOperationError('account_changed');
    return matches[0];
}
