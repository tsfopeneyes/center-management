// Renders actual consent JSX with synthetic Auth/SDK dependencies only.
// Does not import Supabase client, .env, website login, or production data.
import { build } from 'esbuild';
import { mkdir,writeFile } from 'node:fs/promises';
await mkdir('artifacts/center-mcp',{recursive:true});
await build({entryPoints:['src/pages/OAuthConsent.jsx'],outfile:'artifacts/center-mcp/consent-fixture.jsx',bundle:true,format:'esm',external:['react'],plugins:[{
 name:'synthetic-consent',setup(build){
  build.onResolve({filter:/AuthProvider|supabaseClient|GuestMobileWelcome/},args=>({path:args.path,namespace:'synthetic'}));
  build.onLoad({filter:/.*/,namespace:'synthetic'},args=>({contents:args.path.includes('AuthProvider')?
   `export const useAuth=()=>({status:new URLSearchParams(window.location.search).get('auth_status')||'authenticated',refresh:async()=>{}});`:
   args.path.includes('supabaseClient')?`export const supabase={auth:{getSession:async()=>({data:{session:{access_token:'synthetic.invalid.token'}}}),oauth:{getAuthorizationDetails:async()=>({data:{authorization_id:'synthetic-request',scope:'openid'}})}}};`:
   `export default function SyntheticLogin(){return null;}`,loader:'js'}));
 }
}]});
await writeFile('artifacts/center-mcp/consent-fixture.html',`<!doctype html><html lang="ko"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>합성 동의 화면 검증</title><body><div id="root"></div><script type="module">import React from 'react';import{createRoot}from'react-dom/client';import Consent from './consent-fixture.jsx';import '/src/index.css';globalThis.fetch=async url=>{if(String(url).endsWith('/consent/identity'))return Response.json({verified:true,authUserId:'00000000-0000-4000-8000-000000000001',profileId:'00000000-0000-4000-8000-000000000002'});throw new Error('Synthetic fixture forbids network');};createRoot(document.getElementById('root')).render(React.createElement(Consent));</script></body></html>`);
console.log('Synthetic consent fixture ready; no real Auth/data imports');
