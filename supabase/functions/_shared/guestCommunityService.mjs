import {createHash,createHmac,randomBytes} from 'node:crypto';

export class GuestCommunityError extends Error {
    constructor(code,status=400){super(code);this.status=status;this.code=code;}
}
export const guestTokenHash=token=>createHash('sha256').update(token).digest('hex');
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const operations=new Set(['context','posts','candidates','submissions','read_at','mark_read','create_post','edit_post','delete_post','create_comment','edit_comment','delete_comment','post_reaction','comment_reaction','logout']);

export function createGuestCommunityService({query,lookupSecret,supabaseUrl,upload,remove}) {
    if(typeof query!=='function'||typeof lookupSecret!=='string'||lookupSecret.length<32)throw Error('Guest community dependencies required');
    const key=(namespace,value)=>createHmac('sha256',lookupSecret).update(namespace+'\0'+value).digest('hex');
    const call=async(sql,values)=>{
        try{return (await query(sql,values)).rows[0]?.result;}
        catch(error){if(error.code==='42501')throw new GuestCommunityError('access_changed',403);
            if(['23514','22023','22P02'].includes(error.code))throw new GuestCommunityError('invalid_request',400);
            throw new GuestCommunityError('temporarily_unavailable',503);}
    };
    const action=async({channelId,action,payload={}},token)=>{
        if(!uuid(channelId)||!operations.has(action)||!payload||typeof payload!=='object'||Array.isArray(payload)
            ||JSON.stringify(payload).length>100000||typeof token!=='string'||!/^gc_[A-Za-z0-9_-]{43}$/.test(token))
            throw new GuestCommunityError('invalid_request');
        const hash=guestTokenHash(token);
        // Check the session and current participation before validating uploads or executing a mutation.
        if(action==='create_post'||action==='edit_post'){
            const context=await call('SELECT community_security.guest_action($1,$2,\'context\',\'{}\') AS result',[hash,channelId]);
            const validateUrls=urls=>{
                if(!Array.isArray(urls)||urls.length>10)throw new GuestCommunityError('invalid_request');
                for(const value of urls){
                    let url;try{url=new URL(value);}catch{throw new GuestCommunityError('invalid_request');}
                    const own=`/storage/v1/object/public/notice-images/challenge-community/${context.notice.id}/${context.user.id}/`;
                    const mission=`/storage/v1/object/public/notice-images/mission/${context.user.id}/`;
                    if(url.origin!==new URL(supabaseUrl).origin||url.search||url.hash||(!url.pathname.startsWith(own)&&!url.pathname.startsWith(mission)))
                        throw new GuestCommunityError('invalid_request');
                }
            };
            if(payload.image_urls!==undefined)validateUrls(payload.image_urls);
            if(payload.next_urls!==undefined)validateUrls(payload.next_urls);
        }
        return call('SELECT community_security.guest_action($1,$2,$3,$4) AS result',[hash,channelId,action,payload]);
    };
    return {
        async verify(input,clientKey){
            if(!input||typeof input!=='object'||!uuid(input.channelId)||typeof clientKey!=='string'||!clientKey)throw new GuestCommunityError('invalid_request');
            const name=String(input.name||'').trim().replace(/\s*\(guest\)\s*$/i,'');
            const pin=String(input.pin||'');
            if(name.length<1||name.length>100||!/^\d{4}$/.test(pin))throw new GuestCommunityError('invalid_request');
            const token='gc_'+randomBytes(32).toString('base64url');
            const result=await call('SELECT community_security.verify_guest($1,$2,$3,$4,$5,$6) AS result',[
                input.channelId,name,pin,key('guest-client',clientKey),key('guest-identity',input.channelId+'|'+name),guestTokenHash(token)]);
            if(!result?.allowed)throw new GuestCommunityError(result?.code==='try_later'?'try_later':'verification_failed',result?.code==='try_later'?429:403);
            return {...result.context,token};
        },
        action,
        async upload({channelId,file,contentType},token){
            if(!uuid(channelId)||typeof upload!=='function'||!['image/jpeg','image/png','image/webp','image/gif'].includes(contentType)
                ||!(file instanceof Uint8Array)||file.byteLength<1||file.byteLength>8*1024*1024)throw new GuestCommunityError('invalid_request');
            if(typeof token!=='string'||!/^gc_[A-Za-z0-9_-]{43}$/.test(token))throw new GuestCommunityError('invalid_request');
            const context=await call('SELECT community_security.guest_action($1,$2,\'upload_context\',\'{}\') AS result',[guestTokenHash(token),channelId]);
            const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'}[contentType];
            const path=`challenge-community/${context.notice.id}/${context.user.id}/${randomBytes(16).toString('hex')}.${ext}`;
            const url=await upload({bucket:'notice-images',path,contentType,bytes:file});
            return {path,url};
        },
        async cleanup({channelId,paths},token){
            if(typeof remove!=='function'||!Array.isArray(paths)||paths.length>10)throw new GuestCommunityError('invalid_request');
            const context=await action({channelId,action:'context'},token);
            const prefix=`challenge-community/${context.notice.id}/${context.user.id}/`;
            for(const path of paths)if(typeof path!=='string'||!path.startsWith(prefix)||!(/^[a-f0-9]{32}\.(jpg|png|webp|gif)$/.test(path.slice(prefix.length))))
                throw new GuestCommunityError('invalid_request');
            const unused=await call('SELECT community_security.guest_action($1,$2,\'unused_paths\',$3) AS result',[guestTokenHash(token),channelId,{paths}]);
            if(unused.length)await remove(unused);
            return {removed:unused.length};
        }
    };
}
