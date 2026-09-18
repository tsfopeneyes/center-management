import assert from 'node:assert/strict';
import { installChunkRecovery, isMissingChunkError } from '../src/utils/chunkRecovery.js';

assert.equal(isMissingChunkError(new TypeError('Failed to fetch dynamically imported module: /assets/AdminDashboard.old.js')), true);
assert.equal(isMissingChunkError(new Error('ordinary application error')), false);

const listeners = new Map();
const saved = new Map();
let reloads = 0;
const browser = {
    addEventListener: (name, listener) => listeners.set(name, listener),
    sessionStorage: { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value) },
    location: { reload: () => { reloads += 1; } },
};
installChunkRecovery(browser);
let prevented = 0;
listeners.get('vite:preloadError')({ preventDefault: () => { prevented += 1; } });
listeners.get('unhandledrejection')({ reason: new TypeError('Failed to fetch dynamically imported module') });
assert.equal(reloads, 1, 'a missing old asset only triggers one automatic reload');
assert.equal(prevented, 1);
console.log('Missing lazy-loaded assets trigger one reload and never enter a reload loop.');
