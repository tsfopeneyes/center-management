import {randomBytes} from 'node:crypto';
const response=await fetch(process.env.VITE_SUPABASE_URL+'/functions/v1/haifn-chat',{method:'POST',headers:{'Content-Type':'application/json',apikey:process.env.VITE_SUPABASE_ANON_KEY},body:JSON.stringify({action:'send',token:randomBytes(32).toString('hex'),body:'[연결 확인] 운영 시간 문의 알림 테스트입니다.'})});
const data=await response.json();if(!response.ok||data.error)throw new Error('Visitor send failed');console.log('Visitor test saved; messages:',data.messages.length);
