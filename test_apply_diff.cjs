const fs = require('fs');
const Diff = require('diff');

const logPath = 'C:/Users/david/.gemini/antigravity/brain/a4cae410-8810-45d6-b1ab-b43a579d972d/.system_generated/logs/transcript_full.jsonl';

const raw = fs.readFileSync(logPath, 'utf8');
const lines = raw.split('\n');

let diffContent = '';
for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    try {
        const p = JSON.parse(lines[i]);
        if (p.step_index === 1340) {
            diffContent = p.content;
            break;
        }
    } catch(e) {}
}

const regex = /\[diff_block_start\]([\s\S]*?)\[diff_block_end\]/g;
let match;
const blocks = [];
while ((match = regex.exec(diffContent)) !== null) {
    blocks.push(match[1].trim() + '\n');
}

let fileContent = fs.readFileSync('c:/Users/david/.gemini/antigravity/scratch/center-management-main/src/components/admin/rentals/AdminRentals.jsx', 'utf8');

for (const block of blocks) {
    const patchStr = "--- a/file\n+++ b/file\n" + block;
    // applyPatch expects standard unified diff
    // but diff-match-patch might be safer? Let's see if this works on current file
    const newContent = Diff.applyPatch(fileContent, patchStr);
    if (!newContent) {
        console.log("Failed to apply block:", block.substring(0, 100));
    } else {
        console.log("Successfully applied block!");
        fileContent = newContent;
    }
}
