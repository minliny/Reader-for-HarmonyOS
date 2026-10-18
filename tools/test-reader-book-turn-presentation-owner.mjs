import assert from 'node:assert/strict';
import { createBookTurnTextureOwner } from './lib/reader-book-turn-owner-fixture.mjs';
const nativeCalls = [];
const session = createBookTurnTextureOwner(async (_slot, _map, _id, current) => current(), (...args) => { nativeCalls.push(args); return true; });
for (const [slot, id] of [[0,'previous'],[1,'current'],[2,'next']]) assert.equal(await session.uploadTexture(slot, {}, id, () => true), true);
session.commitSlots(5, 'next');
assert.deepEqual([0,1,2].map(slot => session.capturedIdentity(slot)), ['previous','current','next']);
session.onNativeEvent(7, 4, 0);
assert.equal(session.capturedIdentity(1), 'current', 'stale acknowledgement never promotes');
session.onNativeEvent(7, 5, 0);
assert.deepEqual([0,1,2].map(slot => session.capturedIdentity(slot)), ['current','next','']);
session.onNativeEvent(7, 5, 0);
assert.deepEqual([0,1,2].map(slot => session.capturedIdentity(slot)), ['current','next',''], 'duplicate ack promotes once');
session.commitSlots(6, 'previous'); session.onNativeEvent(7, 6, 0);
assert.deepEqual([0,1,2].map(slot => session.capturedIdentity(slot)), ['', 'current','next']);

let released = 0;
const pixel = () => ({ release() { released++; } });
session.retainPendingSnapshot('a', 10, pixel());
session.retainPendingSnapshot('b', 10, pixel()); assert.equal(released, 1);
assert.equal(session.takePendingSnapshot('other', 10), undefined); assert.equal(released, 1);
assert.equal(session.takePendingSnapshot('b', 11), undefined); assert.equal(released, 2);
const owned = pixel(); session.retainPendingSnapshot('c', 12, owned);
assert.equal(session.takePendingSnapshot('c', 12), owned); session.releasePendingSnapshot(); assert.equal(released, 2);
owned.release(); assert.equal(released, 3);
session.retainPendingSnapshot('d', 12, pixel()); session.clearCapturedTextures(); session.clearCapturedTextures();
assert.equal(released, 4); assert.deepEqual([0,1,2].map(slot => session.capturedIdentity(slot)), ['', '', '']);

let resolve;
const late = createBookTurnTextureOwner(() => new Promise(r => { resolve = r; }));
const pending = late.uploadTexture(1, {}, 'obsolete', () => true);
late.clearCapturedTextures(); resolve(true);
assert.equal(await pending, false); assert.equal(late.capturedIdentity(1), '');
const rejected = createBookTurnTextureOwner(async () => false);
assert.equal(await rejected.uploadTexture(1, {}, 'rejected', () => true), false);
assert.equal(rejected.capturedIdentity(1), '');

// LOST may be filtered after a replacement EGL surface has already become
// current. READY alone revokes the old ring, queued ACK and async copy owner.
let finishOldCopy;
let oldCopyAdmitted;
let snapshotReleases = 0;
const replacement = createBookTurnTextureOwner(async (_slot, _map, identity, current) => {
  if (identity !== 'old-copy') return current();
  oldCopyAdmitted = current;
  return new Promise(resolve => { finishOldCopy = resolve; });
});
for (const [slot, id] of [[0, 'previous'], [1, 'current'], [2, 'next']]) {
  assert.equal(await replacement.uploadTexture(slot, {}, id, () => true), true);
}
replacement.retainPendingSnapshot('old-bitmap', 12, {release() { snapshotReleases++; }});
replacement.commitSlots(40, 'next');
const oldCopy = replacement.uploadTexture(1, {}, 'old-copy', () => true);
let readyDelivered = false;
replacement.eventListener = event => {
  if (event.event !== 1) return;
  readyDelivered = true;
  assert.deepEqual([0, 1, 2].map(slot => replacement.capturedIdentity(slot)), ['', '', ''],
    'the owner observes READY only after old texture identities have been revoked');
};
replacement.onNativeEvent(1, 0, 0);
assert.equal(readyDelivered, true);
assert.equal(snapshotReleases, 1, 'READY releases the retained old-surface bitmap');
assert.equal(oldCopyAdmitted(), false, 'READY revokes the old async copy admission callback');
assert.equal(await replacement.uploadTexture(1, {}, 'replacement-current', () => true), true);
finishOldCopy(true);
assert.equal(await oldCopy, false, 'a late native copy result cannot publish into the replacement ring');
replacement.onNativeEvent(7, 40, 0);
assert.deepEqual([0, 1, 2].map(slot => replacement.capturedIdentity(slot)), ['', 'replacement-current', ''],
  'a late old slot ACK cannot rotate the replacement ring');
replacement.clearCapturedTextures();
replacement.clearCapturedTextures();
assert.equal(snapshotReleases, 1, 'later cleanup cannot release the old-surface bitmap twice');
console.log('native presentation owner: uploaded identity, matching slot ACK, stale upload and single bitmap release PASS');
console.log('READY-only replacement: old ring, pending bitmap, async copy and queued slot ACK revoked PASS');
