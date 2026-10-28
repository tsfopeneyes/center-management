import pg from 'npm:pg@8.22.0';
import {createGuestCommunityService,GuestCommunityError} from '../_shared/guestCommunityService.mjs';
import {createStorageGateway} from '../_shared/storageGateway.mjs';

const required=(name:string)=>{const value=Deno.env.get(name)?.trim();if(!value)throw Error('Missing configuration');return value;};
const origins=required('ACCOUNT_ALLOWED_ORIGINS').split(',').map(value=>value.trim()).filter(Boolean);
const base=required('SUPABASE_URL');
const pool=new pg.Pool({connectionString:Deno.env.get('ACCOUNT_DATABASE_URL')?.trim()||required('SUPABASE_DB_URL'),
    max:2,idleTimeoutMillis:1000,connectionTimeoutMillis:5000,application_name:'guest-community'});
pool.on('error',()=>console.warn('[guest-community] database connection unavailable'));
const query=async(text:string,values:unknown[])=>{
    const client=await pool.connect();let committed=false,discard=false;
    try{
        await client.query('BEGIN');
        await client.query('SET LOCAL ROLE community_guest_worker');
        await client.query("SET LOCAL statement_timeout='8s'; SET LOCAL idle_in_transaction_session_timeout='10s'");
        const result=await client.query(text,values);
        await client.query('COMMIT');committed=true;return result;
    }finally{if(!committed)try{await client.query('ROLLBACK');}catch{discard=true;}client.release(discard?Error('Uncertain guest transaction'):undefined);}
};
const service=createGuestCommunityService({query,lookupSecret:required('ACCOUNT_LOOKUP_SECRET'),supabaseUrl:base,
    upload:createStorageGateway({supabaseUrl:base,serviceRoleKey:required('SUPABASE_SERVICE_ROLE_KEY')}),
    remove:async(paths:string[])=>{
        const key=required('SUPABASE_SERVICE_ROLE_KEY');
        const response=await fetch(base+'/storage/v1/object/notice-images',{method:'DELETE',
            headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({prefixes:paths})});
        if(!response.ok)throw new GuestCommunityError('temporarily_unavailable',503);
    }});
const readBody=async(request:Request,limit:number)=>{
    const reader=request.body?.getReader();if(!reader)return new Uint8Array();
    const parts:Uint8Array[]=[];let length=0;
    for(;;){const {value,done}=await reader.read();if(done)break;length+=value.length;
        if(length>limit){await reader.cancel();throw new GuestCommunityError('invalid_request',413);}parts.push(value);}
    const bytes=new Uint8Array(length);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}return bytes;
};
Deno.serve(async(request,info)=>{
    const origin=request.headers.get('Origin')||'';
    const headers={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
        'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Headers':'content-type,apikey,x-community-guest-token,x-community-channel',
        'Access-Control-Allow-Methods':'POST,OPTIONS'};
    const json=(value:unknown,status=200)=>Response.json(value,{status,headers});
    if(!origins.includes(origin))return Response.json({error:'origin_denied'},{status:403});
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(request.method!=='POST')return json({error:'method'},405);
    try{
        const path=new URL(request.url).pathname.split('/').pop();
        const token=request.headers.get('X-Community-Guest-Token')||'';
        if(path==='upload'){
            if(Number(request.headers.get('Content-Length'))>8*1024*1024)return json({error:'invalid_request'},413);
            return json(await service.upload({channelId:request.headers.get('X-Community-Channel'),
                contentType:request.headers.get('Content-Type')?.split(';')[0],file:await readBody(request,8*1024*1024)},token));
        }
        if(Number(request.headers.get('Content-Length'))>100000)return json({error:'invalid_request'},413);
        if(request.headers.get('Content-Type')?.split(';')[0]!=='application/json')return json({error:'invalid_request'},400);
        const raw=new TextDecoder().decode(await readBody(request,100000));
        const input=JSON.parse(raw);
        if(path==='verify')return json(await service.verify(input,info.remoteAddr.hostname));
        if(path==='action')return json({result:await service.action(input,token)});
        if(path==='cleanup')return json(await service.cleanup(input,token));
        return json({error:'not_found'},404);
    }catch(error){return json({error:error instanceof GuestCommunityError?error.code:'temporarily_unavailable'},error instanceof GuestCommunityError?error.status:503);}
});
