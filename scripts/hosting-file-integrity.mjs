import crypto from 'node:crypto';
import zlib from 'node:zlib';

// Hosting hashes the gzip upload. zlib writes the producer OS at header byte 9;
// Windows (10) and Unix (3) may therefore hash the same content differently.
// Accept only a full SHA-256 match after changing that non-content header byte.
export function matchesHostingFileHash(body, expectedHash) {
    if (!/^[a-f0-9]{64}$/.test(expectedHash || '')) return false;
    const gzip = zlib.gzipSync(body,{level:9});
    for (const os of new Set([gzip[9],0,3,10,11,255])) {
        gzip[9] = os;
        if (crypto.createHash('sha256').update(gzip).digest('hex') === expectedHash) return true;
    }
    return false;
}
