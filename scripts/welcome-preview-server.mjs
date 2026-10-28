import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(process.argv[2] || 'dist');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.jpg':'image/jpeg','.json':'application/json'};
http.createServer((req,res)=>{let p=path.join(root,decodeURIComponent(req.url.split('?')[0])); if(!p.startsWith(root)){res.writeHead(403);return res.end();}if(!fs.existsSync(p)||fs.statSync(p).isDirectory())p=path.join(root,'index.html');res.setHeader('Content-Type',mime[path.extname(p)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');fs.createReadStream(p).pipe(res)}).listen(Number(process.argv[3] || 5180),'127.0.0.1');
