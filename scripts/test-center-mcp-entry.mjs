import assert from 'node:assert/strict';
import { build } from 'esbuild';
import vm from 'node:vm';
// Bundle the ACTUAL Edge entry and helpers. Replace only npm DB dependency;
// no installed credentials, Supabase SDK session, DB or network are used.
const bundle = await build({entryPoints:['supabase/functions/center-statistics-mcp/index.ts'],bundle:true,write:false,format:'cjs',platform:'node',plugins:[{
 name:'no-production-db',setup(build){
  build.onResolve({filter:/^npm:pg@/},()=>({path:'pg-synthetic',namespace:'fixture'}));
  build.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export default {Pool: class { constructor(){throw new Error("DB access forbidden in fixture");} }};',loader:'js'}));
 }
}]});
let serve, environmentReads=0;
vm.runInNewContext(bundle.outputFiles[0].text,{Request,Response,URL,TextEncoder,TextDecoder,AbortSignal,
 fetch:()=>{throw new Error('Network forbidden');},Deno:{serve:handler=>{serve=handler;},env:{get:()=>{environmentReads++;return undefined;}}},console});
assert.equal(environmentReads,0);
const resource='https://erecqalsxoxrufggvmcc.supabase.co/functions/v1/center-statistics-mcp';
assert.equal((await serve(new Request(resource+'/.well-known/oauth-protected-resource'))).status,200);
assert.equal((await serve(new Request(resource))).status,401);assert.equal(environmentReads,0);
assert.equal((await serve(new Request(resource+'/consent/identity',{method:'OPTIONS',headers:{Origin:'https://app.schoolchurchimpact.org'}}))).status,204);assert.equal(environmentReads,0);
assert.equal((await serve(new Request(resource+'/consent/identity',{headers:{Origin:'https://app.schoolchurchimpact.org'}}))).status,401);assert.equal(environmentReads,0);
assert.equal((await serve(new Request(resource,{method:'POST',headers:{Authorization:'Bearer synthetic.invalid.token'},body:'{"method":"tools/call"}'}))).status,503);
assert.equal((await serve(new Request(resource+'/consent/prepare',{method:'OPTIONS',headers:{Origin:'https://app.schoolchurchimpact.org'}}))).status,204);
assert.equal((await serve(new Request(resource+'/consent/prepare',{method:'OPTIONS',headers:{Origin:'https://sci-center-6f265.web.app'}}))).status,403);
assert.equal((await serve(new Request(resource+'/consent/prepare',{method:'POST',headers:{Origin:'https://evil.invalid'}}))).status,403);
console.log('Actual Edge entry bundles; discovery/401 need no env/DB; disabled bearer/consent fail closed (synthetic only)');
