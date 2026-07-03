const http = require('http');
const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, 'public', 'cards');
if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

const server = http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.method === 'POST' && req.url === '/upload') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const { page, dataUrl } = JSON.parse(body);
                const base64Data = dataUrl.replace(/^data:image\/jpeg;base64,/, "");
                const filePath = path.join(outDir, `${page}.jpg`);
                fs.writeFileSync(filePath, base64Data, 'base64');
                console.log(`Saved page ${page} to ${filePath}`);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (err) {
                console.error(err);
                res.writeHead(500);
                res.end("Error");
            }
        });
    } else if (req.method === 'POST' && req.url === '/done') {
        console.log("All pages extracted successfully.");
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        setTimeout(() => {
            process.exit(0);
        }, 1000);
    } else {
        // Serve static files minimally
        const filePath = req.url === '/' ? '/extract.html' : req.url;
        const absPath = path.join(__dirname, 'public', filePath);
        if (fs.existsSync(absPath)) {
            res.writeHead(200);
            res.end(fs.readFileSync(absPath));
        } else {
            res.writeHead(404);
            res.end('Not Found');
        }
    }
});

server.listen(8088, () => {
    console.log('Extractor server running at http://localhost:8088/');
});
