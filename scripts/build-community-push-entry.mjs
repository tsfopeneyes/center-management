import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('.local/community-push-entry',{recursive:true});
await writeFile('.local/community-push-entry/index.html','<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>커뮤니티 알림 이동 검증</title><link rel="stylesheet" href="./style.css"><div id="root"></div><script src="./bundle.js"></script></html>');
await build({entryPoints:['scripts/fixtures/community-push-entry.jsx'],bundle:true,format:'iife',outfile:'.local/community-push-entry/bundle.js',define:{'import.meta.env':'{}','process.env.NODE_ENV':'"development"'},plugins:[{name:'isolated-client',setup(b){
b.onResolve({filter:/supabaseClient$/},()=>({path:'client',namespace:'fixture'}));
b.onResolve({filter:/auth\/AuthProvider$/},()=>({path:'auth',namespace:'fixture'}));
b.onLoad({filter:/.*/,namespace:'fixture'},args=>({resolveDir:process.cwd(),contents:args.path==='auth'?`import {useState,useEffect} from 'react'; export const useAuth=()=>{const mode=new URLSearchParams(location.search).get('mode');const [ready,setReady]=useState(false);useEffect(()=>{const t=setTimeout(()=>setReady(true),1200);return()=>clearTimeout(t)},[]);return {status:mode==='anonymous'?'anonymous':ready?'authenticated':'restoring',profile:ready?{id:'reader',name:'검증 이용자',account_role:'member'}:null}};`:`export const supabaseUrl='https://fixture.invalid';export const supabase={auth:{getSession:async()=>({data:{session:{}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},from:()=>{throw Error('Unexpected fixture DB access')},channel:()=>({on(){return this},subscribe(){return this}}),removeChannel(){}};`}));
}}]});
