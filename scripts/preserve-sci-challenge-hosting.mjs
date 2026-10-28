// Firebase publishes a full site, not a subdirectory patch. Keep the independently
// operated Challenge app when rebuilding Center. Failure must stop deployment.
import fs from 'node:fs';
import path from 'node:path';
import {matchesHostingFileHash} from './hosting-file-integrity.mjs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const root=path.resolve(import.meta.dirname,'..');
const auth=require('firebase-tools/lib/auth');
const options={project:'sci-center-6f265'};
const account=auth.getGlobalDefaultAccount();
if(account)auth.setActiveAccount(options,account);
// CI uses the existing Firebase service account through application credentials.
await require('firebase-tools/lib/requireAuth').requireAuth(options);
const hosting=require('firebase-tools/lib/hosting/api');
const {Client}=require('firebase-tools/lib/apiv2');
const client=new Client({urlPrefix:'https://firebasehosting.googleapis.com',apiVersion:'v1beta1',auth:true});
const live=await hosting.getChannel('-','sci-center-6f265','live');
let files=[],token='';
do{
 const response=await client.get('/'+live.release.version.name+'/files',{queryParams:{pageSize:1000,...(token?{pageToken:token}:{})}});
 files.push(...response.body.files||[]);token=response.body.nextPageToken||'';
}while(token);
files=files.filter(f=>f.path.startsWith('/sci-challenge/'));
if(!files.some(f=>f.path==='/sci-challenge/index.html'))throw Error('SCI Challenge is missing from live Hosting. Restore it before deploying Center; refusing to publish a broken game path.');
const dist=path.join(root,'dist');
let index=0;
await Promise.all(Array.from({length:6},async()=>{
 while(index<files.length){
  const file=files[index++],target=path.resolve(dist,'.'+file.path);
  if(!target.startsWith(path.join(dist,'sci-challenge')+path.sep))throw Error('Unsafe Challenge asset path');
  const response=await fetch('https://sci-center-6f265.web.app'+file.path,{signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error('Cannot preserve Challenge asset: '+file.path);
  const body=Buffer.from(await response.arrayBuffer());
  if(!matchesHostingFileHash(body,file.hash))throw Error('Challenge asset changed while preparing: '+file.path);
  fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,body);
 }
}));
const latest=await hosting.getChannel('-','sci-center-6f265','live');
if(latest.release.version.name!==live.release.version.name)throw Error('Hosting changed during preparation. Retry deployment to preserve the newest Challenge.');
const config=JSON.parse(fs.readFileSync(path.join(root,'firebase.json'),'utf8'));
if(!config.hosting.rewrites?.some(r=>r.source==='/sci-challenge'&&r.destination==='/sci-challenge/index.html'))throw Error('Challenge Hosting rewrite is missing');
console.log('Preserved SCI Challenge: '+files.length+' verified files from '+live.release.version.name);
