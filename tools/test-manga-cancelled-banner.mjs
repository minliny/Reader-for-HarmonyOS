import assert from 'node:assert/strict';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';

const Surface = productionMotionMethods(new URL('../entry/src/main/ets/features/manga/MangaReadingSurface.ets', import.meta.url),
  ['saveVisible', 'positionIdentity', 'updateViewport']);
const manifest = { chapter: { sourceId: 's', bookId: 'b', chapterId: '/second' }, manifestVersion: 'v1' };
const facts = [0, 1, 2].map(ordinal => ({ ordinal, pageId: `page-${ordinal}` }));
const failures = [];
let rejectSave;
const controller = {
  chapter: { manifest }, pageAt: ordinal => facts[ordinal],
  savePosition: () => new Promise((_resolve, reject) => { rejectSave = reject; }),
  setVisible: async () => {}, setTileWindow: async () => {},
  tile: () => ({ image: { fileUri: '/already-visible-third-image' } }),
};
const surface = Object.assign(new Surface(), {
  mounted: true, opened: true, horizontal: true, horizontalPage: 1,
  presentationGeneration: 1, viewportGeneration: 0, restoringAnchor: true,
  error: '', controller, data: { totalCount: () => 1, getData: () => ({ ordinal: 2, tileIndex: 0, known: true }) },
  first: 0, last: 0, requestedLast: () => 0,
  onSaveFailure: message => failures.push(message),
});
surface.confirmedPosition = {
  controller, manifest, identity: surface.positionIdentity(1), anchor: { ordinal: 1, x: 0, y: 0 },
};
const oldSave = surface.saveVisible();
surface.horizontalPage = 2;
surface.presentationGeneration++;
surface.confirmedPosition = {
  controller, manifest, identity: surface.positionIdentity(2), anchor: { ordinal: 2, x: 0, y: 0 },
};
rejectSave(new Error('MANGA_SESSION_CANCELLED'));
await oldSave;
assert.equal(surface.error, '', 'cancelled save of previous visible page must not show over current image');
assert.deepEqual(failures, ['MANGA_SESSION_CANCELLED'], 'uncertain old CAS still reaches the owner without an image banner');

controller.savePosition = async () => { throw new Error('MANGA_SESSION_CANCELLED'); };
await surface.saveVisible();
assert.deepEqual(failures, ['MANGA_SESSION_CANCELLED', 'MANGA_SESSION_CANCELLED'], 'current uncertain progress write must still notify the owner');
surface.error = '';

controller.setVisible = async () => { throw new Error('MANGA_SESSION_CANCELLED'); };
await surface.updateViewport();
assert.equal(surface.error, '', 'superseded viewport cancellation must not become a persistent banner');

controller.setVisible = async () => { throw new Error('MANGA_PAGE_FACT_REQUIRED'); };
await surface.updateViewport();
assert.equal(surface.error, 'MANGA_PAGE_FACT_REQUIRED', 'current genuine viewport failures remain visible');

let openingSelections = 0;
surface.error = '';
surface.opened = false;
controller.setVisible = async () => { openingSelections++; };
await surface.updateViewport();
assert.equal(openingSelections, 0, 'native row mounting before entry admission must not replace the saved opening page');
console.log('PASS actual manga surface methods: stale save/viewport cancellation does not obscure a visible image; current failures remain visible');
