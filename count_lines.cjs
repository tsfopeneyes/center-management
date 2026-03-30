const fs = require('fs');
const path = require('path');

function getFiles(dir, files = []) {
    const list = fs.readdirSync(dir);
    for (const file of list) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory() && file !== 'node_modules' && file !== '.git') {
            getFiles(fullPath, files);
        } else if (stat.isFile() && (file.endsWith('.jsx') || file.endsWith('.js'))) {
            files.push(fullPath);
        }
    }
    return files;
}

const allFiles = getFiles('./src');
const fileSizes = allFiles.map(f => {
    const lines = fs.readFileSync(f, 'utf8').split('\n').length;
    const relPath = path.relative('./src', f).replace(/\\/g, '/');
    return { name: relPath, lines };
});

const validFiles = fileSizes.filter(f => !f.name.includes('.backup.'));
validFiles.sort((a, b) => b.lines - a.lines);

console.log(validFiles.slice(0, 15).map(f => `${f.name}: ${f.lines}줄`).join('\n'));
