// Website-only own-account confirmation. Never an MCP tool or grant action.
export function createIdentityHandler({ authorizeExistingSession, origin }) {
 const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Access-Control-Allow-Origin':origin,Vary:'Origin',
  'Access-Control-Allow-Headers':'authorization','Access-Control-Allow-Methods':'GET,OPTIONS'};
 const json=(body,status)=>Response.json(body,{status,headers});
 return async request=>{
  if(request.headers.get('Origin')!==origin)return json({error:'forbidden'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='GET'||new URL(request.url).search)return json({error:'invalid_request'},400);
  const bearer=request.headers.get('Authorization')||'';
  if(!/^Bearer [A-Za-z0-9._-]+$/.test(bearer)||bearer.length>8200)return json({error:'unauthorized'},401);
  if(typeof authorizeExistingSession!=='function')return json({error:'not_configured'},503);
  try{
   const actor=await authorizeExistingSession({accessToken:bearer.slice(7),action:'members.manage'});
   const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
   if(!uuid(actor.authUserId)||!uuid(actor.actorProfileId))throw new Error('Invalid principal');
   return json({verified:true,authUserId:actor.authUserId,profileId:actor.actorProfileId},200);
  }catch{return json({error:'identity_not_verified'},403);}
 };
}
