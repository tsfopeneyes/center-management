import { readFile, writeFile, mkdir } from 'node:fs/promises';
const source = await readFile('scripts/test-unified-surveys.mjs', 'utf8');
const setup = source.slice(source.indexOf('const db = new PGlite();'), source.indexOf('let checks = 0;'));
const body = `
await db.exec('ALTER TABLE notices ADD COLUMN is_recruiting boolean, ADD COLUMN is_challenge boolean');
const live = JSON.parse(await readFile('artifacts/program-feedback-audit/read-only.json','utf8'));
await db.exec(live.functions.find(f=>f.proname==='guard_survey_entry').definition);
await db.exec('GRANT SELECT ON notice_responses,notices,users TO authenticated');
const uid='00000000-0000-4000-8000-000000000001';
const definition={title:'브라우저 피드백 검증',questions:[{id:'rating',title:'오늘 프로그램은 어땠나요?',type:'star',required:true,metric:'satisfaction'},{id:'comment',title:'느낀 점을 적어주세요',type:'text',required:true}]};
await db.query('INSERT INTO users VALUES ($1,$2)',[uid,'테스트 학생']);
await db.exec("INSERT INTO notices(id,title,program_date,program_status,is_recruiting,is_challenge,guest_properties) VALUES (9001,'검증 프로그램',now()-interval '1 minute','ACTIVE',true,false,'{\\\"schedule_mode\\\":\\\"SINGLE\\\"}')");
await db.query("INSERT INTO notice_responses(notice_id,user_id,status,is_attended) VALUES (9001,$1,'JOIN',true)",[uid]);
const form=(await db.query("INSERT INTO survey_forms(title,kind) VALUES ('검증','PROGRAM') RETURNING id")).rows[0].id;
const version=(await db.query('INSERT INTO survey_versions(form_id,definition) VALUES ($1,$2) RETURNING id',[form,definition])).rows[0].id;
const link=(await db.query("INSERT INTO survey_links(form_id,version_id,event,notice_id,audience,timing) VALUES ($1,$2,'PROGRAM',9001,'ATTENDED','AFTER_END') RETURNING id",[form,version])).rows[0].id;
const http=await import('node:http');
let saved=0,edited=0;
let queue=Promise.resolve();
http.createServer(async(req,res)=>{
 res.setHeader('Access-Control-Allow-Origin','http://127.0.0.1:1000');res.setHeader('Access-Control-Allow-Headers','content-type');
 if(req.method==='OPTIONS'){res.end();return;}
 if(req.url==='/health'){res.end(JSON.stringify({isolated:true,saved,edited}));return;}
 if(req.url!=='/query'||req.method!=='POST'){res.writeHead(404);res.end();return;}
 let raw='';for await(const chunk of req)raw+=chunk;
 const task=async()=>{
  try {
   const {table,ops,admin}=JSON.parse(raw);
   await db.exec("RESET ROLE; SET test.uid='"+uid+"'; SET test.staff='"+(admin?'true':'false')+"'; SET ROLE authenticated");
   const write=ops.find(o=>['insert','update','delete','upsert'].includes(o[0]));
   let data=[];
   if(write){
    if(table!=='survey_entries'||!['insert','update'].includes(write[0]))throw Error('Unexpected test write');
    if(write[0]==='insert'){
     const p=write[1];data=(await db.query('INSERT INTO survey_entries(link_id,version_id,user_id,answers) VALUES ($1,$2,$3,$4) RETURNING *',[p.link_id,p.version_id,p.user_id,p.answers])).rows;saved++;
    }else{
     const id=ops.find(o=>o[0]==='eq'&&o[1]==='id')?.[2];
     data=(await db.query('UPDATE survey_entries SET answers=$1 WHERE id=$2 RETURNING *',[write[1].answers,id])).rows;edited++;
    }
   }else if(table==='survey_links')data=(await db.query('SELECT l.*,to_jsonb(v) version,to_jsonb(f) form FROM survey_links l JOIN survey_versions v ON v.id=l.version_id JOIN survey_forms f ON f.id=l.form_id')).rows;
   else if(table==='survey_entries'){
    const clauses=[],params=[];
    for(const [kind,key,value] of ops)if(kind==='eq'&&['id','link_id','notice_id','user_id','response_key'].includes(key)){params.push(value);clauses.push(key+'=$'+params.length);}
    data=(await db.query('SELECT * FROM survey_entries'+(clauses.length?' WHERE '+clauses.join(' AND '):''),params)).rows.map(r=>({...r,users:{id:uid,name:'테스트 학생',school:'테스트 학교'},notices:{title:'검증 프로그램',guest_properties:{}}}));
    const range=ops.find(o=>o[0]==='range');if(range)data=data.slice(range[1],range[2]+1);
   }else if(table==='notice_responses')data=(await db.query('SELECT * FROM notice_responses')).rows;
   if(ops.some(o=>['single','maybeSingle'].includes(o[0])))data=data[0]||null;
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data,error:null}));
  }catch(e){res.end(JSON.stringify({data:null,error:{message:e.message,code:e.code}}));}
 };
 queue=queue.then(task,task);
}).listen(1003,'127.0.0.1',()=>console.log('Isolated feedback test server ready on 1003; no production writes.'));
`;
await mkdir('.local', { recursive: true });
await writeFile('.local/feedback-test-server.mjs', "import assert from 'node:assert/strict';\nimport {readFile} from 'node:fs/promises';\nimport {PGlite} from '@electric-sql/pglite';\n" + setup + body);
await import('../.local/feedback-test-server.mjs');
