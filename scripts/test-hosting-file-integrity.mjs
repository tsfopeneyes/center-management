import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import {matchesHostingFileHash} from './hosting-file-integrity.mjs';

const body=Buffer.from('SCI Challenge asset\n'.repeat(1000));
const gzip=zlib.gzipSync(body,{level:9});
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
for(const os of [0,3,10,11,255]) {
    const producer=Buffer.from(gzip);producer[9]=os;
    assert.equal(matchesHostingFileHash(body,sha(producer)),true,`Producer OS ${os}`);
    assert.equal(matchesHostingFileHash(Buffer.concat([body,Buffer.from('changed')]),sha(producer)),false,'Reject changed content');
}
const damaged=Buffer.from(gzip);damaged[15]^=1;
assert.equal(matchesHostingFileHash(body,sha(damaged)),false,'Reject compressed payload changes');
assert.equal(matchesHostingFileHash(body,'not-a-sha256'),false);
console.log('PASS Hosting integrity: Unix/Windows producer headers match; changed content and compressed payloads are rejected.');
