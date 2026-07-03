const fs = require('fs');
const path = require('path');
const DiffMatchPatch = require('diff-match-patch');
const dmp = new DiffMatchPatch();

dmp.Match_Distance = 1000;
dmp.Match_Threshold = 0.5;

const logPath = 'C:/Users/david/.gemini/antigravity/brain/a4cae410-8810-45d6-b1ab-b43a579d972d/.system_generated/logs/transcript_full.jsonl';
const originalRoot = 'c:/Users/david/.gemini/antigravity/scratch/center-management-main';
const targetDir = 'C:/Users/david/.gemini/antigravity/brain/a4cae410-8810-45d6-b1ab-b43a579d972d/scratch/reconstruct_july1';
const CUTOFF_STEP = 2104; // Reconstruct exactly to July 1st

function normalizeString(str) {
    return (str || '').replace(/\r\n/g, '\n');
}

function applyFuzzyEdit(content, target, replacement, startLine, endLine) {
    if (!target) return { newContent: content, success: true };
    const contentStr = normalizeString(content);
    let targetStr = normalizeString(target);
    const replacementStr = normalizeString(replacement);
    
    let exactIdx = contentStr.indexOf(targetStr);
    if (exactIdx === -1) {
        targetStr = targetStr.trim();
        exactIdx = contentStr.indexOf(targetStr);
    }
    
    if (exactIdx !== -1) {
        const newContent = contentStr.substring(0, exactIdx) + replacementStr + contentStr.substring(exactIdx + targetStr.length);
        return { newContent, success: true };
    }
    
    let loc = 0;
    if (startLine) {
        const lines = contentStr.split('\n');
        loc = lines.slice(0, startLine - 1).join('\n').length;
    }
    
    const matchIdx = dmp.match_main(contentStr, targetStr, loc);
    if (matchIdx !== -1) {
        let i = matchIdx;
        let j = 0;
        while (j < targetStr.length && i < contentStr.length) {
            if (contentStr[i] === targetStr[j]) {
                i++; j++;
            } else if (/\s/.test(contentStr[i])) {
                i++;
            } else if (/\s/.test(targetStr[j])) {
                j++;
            } else {
                i++; j++;
            }
        }
        const newContent = contentStr.substring(0, matchIdx) + replacementStr + contentStr.substring(i);
        return { newContent, success: true, fuzzy: true };
    }
    return { newContent: content, success: false };
}

function reconstruct() {
    const raw = fs.readFileSync(logPath, 'utf8');
    const lines = raw.split('\n');
    let count = 0;
    let fails = 0;
    let fuzzies = 0;
    
    for (let i = 0; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        try {
            const p = JSON.parse(lines[i]);
            if (p.step_index > CUTOFF_STEP) break;
            
            if (p.tool_calls) {
                for (const tc of p.tool_calls) {
                    if (tc.name === 'write_to_file') {
                        let fpath = tc.args.TargetFile;
                        if (!fpath) continue;
                        fpath = fpath.replace(/\\\\/g, '/').replace(/"/g, '');
                        if (fpath.includes('center-management-main')) {
                            const rel = path.relative(originalRoot, fpath);
                            const pth = path.resolve(targetDir, rel);
                            fs.mkdirSync(path.dirname(pth), {recursive: true});
                            fs.writeFileSync(pth, normalizeString(tc.args.CodeContent));
                            count++;
                        }
                    } else if (tc.name === 'replace_file_content' || tc.name === 'multi_replace_file_content') {
                        let fpath = tc.args.TargetFile;
                        if (!fpath) continue;
                        fpath = fpath.replace(/\\\\/g, '/').replace(/"/g, '');
                        if (fpath.includes('center-management-main')) {
                            const rel = path.relative(originalRoot, fpath);
                            const pth = path.resolve(targetDir, rel);
                            if (!fs.existsSync(pth)) continue;
                            
                            let content = fs.readFileSync(pth, 'utf8');
                            let allSuccess = true;
                            
                            if (tc.name === 'replace_file_content') {
                                const res = applyFuzzyEdit(content, tc.args.TargetContent, tc.args.ReplacementContent, tc.args.StartLine, tc.args.EndLine);
                                content = res.newContent;
                                if (res.fuzzy) fuzzies++;
                                if (!res.success) {
                                    console.log(`Failed at step ${p.step_index} file ${path.basename(pth)}`);
                                    fails++;
                                    allSuccess = false;
                                }
                            } else {
                                const chunks = tc.args.ReplacementChunks || [];
                                for (let c = chunks.length - 1; c >= 0; c--) {
                                    const res = applyFuzzyEdit(content, chunks[c].TargetContent, chunks[c].ReplacementContent, chunks[c].StartLine, chunks[c].EndLine);
                                    content = res.newContent;
                                    if (res.fuzzy) fuzzies++;
                                    if (!res.success) {
                                        console.log(`Failed chunk ${c} at step ${p.step_index} file ${path.basename(pth)}`);
                                        fails++;
                                        allSuccess = false;
                                    }
                                }
                            }
                            fs.writeFileSync(pth, content);
                            count++;
                        }
                    }
                }
            }
        } catch(e) {}
    }
    console.log(`Replayed ${count} edits. Fails: ${fails}. Fuzzies: ${fuzzies}`);
}

reconstruct();
