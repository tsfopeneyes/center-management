const fs = require('fs');
const path = require('path');
const Diff = require('diff');

const logPath = 'C:/Users/david/.gemini/antigravity/brain/a4cae410-8810-45d6-b1ab-b43a579d972d/.system_generated/logs/transcript_full.jsonl';
const CUTOFF_STEP = 2104;

const raw = fs.readFileSync(logPath, 'utf8');
const lines = raw.split('\n');

const state = {}; // { filepath: content }

const steps = [];
for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    try {
        const p = JSON.parse(lines[i]);
        if (p.step_index <= CUTOFF_STEP) {
            steps.push(p);
        }
    } catch(e) {}
}

let pendingDiffs = {}; 
let failedCount = 0;
let successCount = 0;

function normalizeString(str) {
    return (str || '').replace(/\r\n/g, '\n');
}

function getFileState(filepath) {
    if (state[filepath] !== undefined) {
        return state[filepath];
    }
    if (fs.existsSync(filepath)) {
        const content = fs.readFileSync(filepath, 'utf8');
        state[filepath] = normalizeString(content);
        return state[filepath];
    }
    return '';
}

function sanitizeDiffBlock(block) {
    const lines = block.split('\n');
    let inHunk = false;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('@@ ')) {
            inHunk = true;
            continue;
        }
        if (inHunk) {
            if (lines[i] === '') {
                lines[i] = ' ';
            } else if (![' ', '+', '-', '\\'].includes(lines[i][0])) {
                lines[i] = ' ' + lines[i];
            }
        }
    }
    return lines.join('\n');
}

for (let i = 0; i < steps.length; i++) {
    const p = steps[i];
    
    if (p.tool_calls) {
        for (const tc of p.tool_calls) {
            if (tc.name === 'write_to_file' && tc.args.TargetFile) {
                const target = tc.args.TargetFile;
                if (target.includes('center-management-main')) {
                    state[target] = normalizeString(tc.args.CodeContent);
                    console.log(`Step ${p.step_index}: write_to_file ${path.basename(target)}`);
                }
            }
            if ((tc.name === 'replace_file_content' || tc.name === 'multi_replace_file_content') && tc.args.TargetFile) {
                const target = tc.args.TargetFile;
                if (target.includes('center-management-main')) {
                    pendingDiffs[p.step_index] = { filepath: target };
                }
            }
        }
    }
    
    if (p.content && p.content.includes('[diff_block_start]')) {
        let matchedFile = null;
        for (const [stepIdx, info] of Object.entries(pendingDiffs)) {
            if (p.content.includes(info.filepath) || p.content.includes(path.basename(info.filepath))) {
                matchedFile = info.filepath;
                delete pendingDiffs[stepIdx];
                break;
            }
        }
        
        if (matchedFile) {
            const regex = /\[diff_block_start\]([\s\S]*?)\[diff_block_end\]/g;
            let match;
            while ((match = regex.exec(p.content)) !== null) {
                let diffBlock = match[1];
                diffBlock = normalizeString(diffBlock);
                diffBlock = sanitizeDiffBlock(diffBlock);
                
                const patchStr = `--- a/file\n+++ b/file\n` + diffBlock;
                
                let oldContent = getFileState(matchedFile);
                const newContent = Diff.applyPatch(oldContent, patchStr);
                
                if (!newContent) {
                    console.log(`FAILED to apply patch at Step ${p.step_index} for ${path.basename(matchedFile)}`);
                    failedCount++;
                } else {
                    state[matchedFile] = newContent;
                    successCount++;
                }
            }
        }
    }
}

for (const [filepath, content] of Object.entries(state)) {
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filepath, content, 'utf8');
}
console.log(`Reconstruction complete. Success: ${successCount}, Failed: ${failedCount}`);
