const fs = require('fs');

const logPath = 'C:/Users/david/.gemini/antigravity/brain/a4cae410-8810-45d6-b1ab-b43a579d972d/.system_generated/logs/transcript_full.jsonl';
const lines = fs.readFileSync(logPath, 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    try {
        const p = JSON.parse(lines[i]);
        if (p.step_index === 1027) {
            const regex = /\[diff_block_start\]([\s\S]*?)\[diff_block_end\]/g;
            let match;
            let count = 0;
            while ((match = regex.exec(p.content)) !== null) {
                const patchStr = `--- a/src/components/admin/rentals/AdminRentals.jsx\n+++ b/src/components/admin/rentals/AdminRentals.jsx\n` + match[1].trim() + '\n';
                fs.writeFileSync(`test1027_${count}.patch`, patchStr, 'utf8');
                count++;
            }
            console.log(`Wrote ${count} patches.`);
            break;
        }
    } catch(e) {}
}
