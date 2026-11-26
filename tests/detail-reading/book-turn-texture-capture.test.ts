import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BOOK_TURN_TEXTURE_CURRENT as CURRENT,
  BOOK_TURN_TEXTURE_NEXT as NEXT,
  BOOK_TURN_TEXTURE_PREVIOUS as PREVIOUS,
  BookTurnTextureCapture,
  bookTurnTextureSnapshotScale,
  captureDecodedBookTurnBitmap,
  type BookTurnTextureCache,
  type BookTurnTextureHost,
  type BookTurnTexturePage,
  type BookTurnTextureSlot,
  type BookTurnTextureStep,
} from '../../entry/src/main/ets/features/reading/ui/BookTurnTextureCapture.ts';
import type { ReaderPageTurnDirection } from '../../entry/src/main/ets/features/reading/ui/ReaderPageGestureState.ts';

interface Bitmap { name: string; }
interface PendingBitmap { identity: string; generation: number; bitmap: Bitmap; }

function lease<T>(): { result: Promise<T>; finish: (value: T) => void } {
  let finish!: (value: T) => void;
  const result = new Promise<T>((resolve) => { finish = resolve; });
  return { result, finish };
}

function nextTask(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

function fixture() {
  const events: string[] = [];
  const frames: (() => void)[] = [];
  const identities = ['', '', ''];
  let pending: PendingBitmap | undefined;
  let direction: ReaderPageTurnDirection = 'next';
  let pageGeneration = 2;
  let permit = true;
  let neighbours = true;
  let mounted = true;
  let paintReady = true;
  let observeRelease = false;
  let dispatchSnapshot = (slot: BookTurnTextureSlot): Promise<Bitmap> => Promise.resolve({ name: String(slot) });
  let admitUpload = (canPublish: () => boolean): Promise<boolean> => Promise.resolve(canPublish());

  const host: BookTurnTextureHost<BookTurnTexturePage, Bitmap> = {
    postFrame: (callback) => { frames.push(callback); },
    mounted: () => mounted,
    plan: () => paintReady ? {
      current: { textureIdentity: 'current' },
      previous: neighbours ? { textureIdentity: 'previous' } : undefined,
      next: neighbours ? { textureIdentity: 'next' } : undefined,
    } : undefined,
    preferredDirection: () => direction,
    pageGeneration: () => pageGeneration,
    allows: (stage: BookTurnTextureStep) => mounted && (permit || stage === 'retain'),
    snapshot: (slot, _page, reusable) => {
      if (reusable) { events.push(`reuse ${slot}`); return undefined; }
      events.push(`read ${slot}`);
      return dispatchSnapshot(slot);
    },
    captureFailed: (_slot, _generation, message) => { events.push(`failed ${message}`); },
    release: (bitmap) => { if (observeRelease) events.push(`release ${bitmap.name}`); },
  };
  const cache: BookTurnTextureCache<Bitmap> = {
    capturedIdentity: (slot) => identities[slot],
    takePendingSnapshot: (identity, generation) => {
      if (pending?.identity !== identity || pending.generation !== generation) return undefined;
      const bitmap = pending.bitmap;
      pending = undefined;
      return bitmap;
    },
    retainPendingSnapshot: (identity, generation, bitmap) => {
      events.push(`retain ${bitmap.name}`);
      pending = { identity, generation, bitmap };
    },
    uploadTexture: async (slot, bitmap, identity, canPublish) => {
      events.push(`upload ${slot} ${bitmap.name}`);
      if (!await admitUpload(canPublish)) return false;
      identities[slot] = identity;
      return true;
    },
  };
  return {
    owner: new BookTurnTextureCapture(host, cache), events, frames, identities,
    frame: () => {
      const callback = frames.shift();
      assert.ok(callback);
      callback();
    },
    snapshot: (dispatch: typeof dispatchSnapshot) => { dispatchSnapshot = dispatch; },
    upload: (admit: typeof admitUpload) => { admitUpload = admit; },
    preferPrevious: () => { direction = 'previous'; },
    advancePage: () => { pageGeneration += 1; },
    blockCapture: () => { permit = false; },
    resumeCapture: () => { permit = true; },
    mount: (value: boolean) => { mounted = value; },
    paint: (value: boolean) => { paintReady = value; },
    currentOnly: () => { neighbours = false; },
    traceRelease: () => { observeRelease = true; },
  };
}

test('texture refresh coalesces requests and reads the preferred neighbour after CURRENT', async () => {
  const view = fixture();
  const current = lease<Bitmap>();
  view.snapshot((slot) => slot === CURRENT ? current.result : Promise.resolve({ name: String(slot) }));
  view.owner.schedule();
  view.owner.schedule();
  assert.equal(view.frames.length, 1);
  view.frame();
  assert.deepEqual(view.events, ['read 1']);
  view.preferPrevious();
  current.finish({ name: 'first' });
  await nextTask();
  assert.equal(view.frames.length, 1);
  view.frame();
  await nextTask();
  assert.equal(view.frames.length, 1);
  view.frame();
  await nextTask();
  assert.deepEqual(view.events, ['read 1', 'upload 1 first', 'read 0', 'upload 0 0', 'read 2', 'upload 2 2']);
});

test('unacknowledged current revision and previously uploaded slots avoid snapshot work', async () => {
  const view = fixture();
  view.paint(false);
  await view.owner.refresh();
  assert.deepEqual(view.events, []);
  view.paint(true);
  view.identities[CURRENT] = 'current';
  view.identities[NEXT] = 'next';
  await view.owner.refresh();
  assert.deepEqual(view.events, [`read ${PREVIOUS}`, `upload ${PREVIOUS} ${PREVIOUS}`]);
  assert.equal(view.frames.length, 0);
});

test('an idle snapshot invalidated by input keeps one bitmap on the same page and surface', async () => {
  const view = fixture();
  view.currentOnly();
  view.traceRelease();
  const snapshot = lease<Bitmap>();
  view.snapshot(() => snapshot.result);
  const first = view.owner.refresh();
  view.owner.invalidate(true);
  view.blockCapture();
  snapshot.finish({ name: 'held' });
  await first;
  assert.deepEqual(view.events, ['read 1', 'retain held']);
  view.resumeCapture();
  await view.owner.refresh();
  assert.deepEqual(view.events, ['read 1', 'retain held', 'reuse 1', 'upload 1 held', 'release held']);
});

test('surface or page replacement releases stale pixels even if input still owns the lane', async () => {
  for (const replaceSurface of [true, false]) {
    const view = fixture();
    view.currentOnly();
    view.traceRelease();
    const snapshot = lease<Bitmap>();
    view.snapshot(() => snapshot.result);
    const refresh = view.owner.refresh();
    if (replaceSurface) view.owner.replaceSurface();
    else { view.advancePage(); view.owner.invalidate(true); }
    view.blockCapture();
    snapshot.finish({ name: 'stale' });
    await refresh;
    assert.deepEqual(view.events, ['read 1', 'release stale']);
  }
});

test('an in-flight upload holds pixels and detached content until its promise settles', async () => {
  const view = fixture();
  view.currentOnly();
  view.traceRelease();
  const nativeRead = lease<boolean>();
  const publishGate: (() => boolean)[] = [];
  view.upload((canPublish) => { publishGate.push(canPublish); return nativeRead.result.then(() => canPublish()); });
  const refresh = view.owner.refresh();
  await nextTask();
  assert.equal(publishGate[0](), true);
  view.owner.invalidate(true);
  view.mount(false);
  view.owner.disposeAfterRefresh(() => { view.events.push('dispose'); });
  const queued = view.owner.refresh();
  assert.equal(publishGate[0](), false);
  assert.deepEqual(view.events, ['read 1', 'upload 1 1']);
  nativeRead.finish(true);
  await refresh;
  await queued;
  assert.deepEqual(view.events, ['read 1', 'upload 1 1', 'release 1', 'dispose']);
  assert.equal(view.identities[CURRENT], '');
});

test('checked decode retries only the configured transient error and stops when the ticket is stale', async () => {
  const delayed: number[] = [];
  const pending = new Error('decode pending');
  const corrupt = new Error('decode rejected');
  let current = true;
  const attempted = await captureDecodedBookTurnBitmap(async (delay) => {
    delayed.push(delay);
    if (delay === 16) current = false;
    throw pending;
  }, () => current, (error) => error === pending);
  assert.equal(attempted, undefined);
  assert.deepEqual(delayed, [0, 16]);
  delayed.length = 0;
  await assert.rejects(captureDecodedBookTurnBitmap(async (delay) => {
    delayed.push(delay);
    throw pending;
  }, () => true, (error) => error === pending), pending);
  assert.deepEqual(delayed, [0, 16, 64, 128]);
  delayed.length = 0;
  await assert.rejects(captureDecodedBookTurnBitmap(async (delay) => {
    delayed.push(delay);
    throw corrupt;
  }, () => true, (error) => error === pending), corrupt);
  assert.deepEqual(delayed, [0]);
  assert.equal(bookTurnTextureSnapshotScale(1024, 2048), 1);
  assert.ok(bookTurnTextureSnapshotScale(1178, 2548) < 1);
});
