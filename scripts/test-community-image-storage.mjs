import assert from 'node:assert/strict';
import { communityImagePath } from '../src/utils/communityImageStorage.js';

const base = 'https://example.supabase.co';
const profile = '72d5b461-a079-4845-98f4-c4f25f045044';
const challenge = '24b2c392-6c82-4b5f-b1a8-9499d9ae6bc7';
assert.equal(communityImagePath(`${base}/storage/v1/object/public/notice-images/mission/${profile}/photo.jpg`, profile, challenge, base), `mission/${profile}/photo.jpg`);
assert.equal(communityImagePath(`${base}/storage/v1/object/public/notice-images/challenge-community/${challenge}/${profile}/123.jpg`, profile, challenge, base), `challenge-community/${challenge}/${profile}/123.jpg`);
for (const url of [
    `${base}/storage/v1/object/public/notice-images/mission/other/photo.jpg`,
    `${base}/storage/v1/object/public/notice-images/challenge-community/other/${profile}/photo.jpg`,
    `https://evil.example/storage/v1/object/public/notice-images/mission/${profile}/photo.jpg`,
    `${base}/storage/v1/object/public/avatars/mission/${profile}/photo.jpg`,
    `${base}/storage/v1/object/public/notice-images/mission/${profile}/%2E%2E/photo.jpg`,
]) assert.equal(communityImagePath(url, profile, challenge, base), null);
console.log('Community image deletion only accepts this author’s challenge image paths.');
