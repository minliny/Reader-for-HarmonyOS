import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

for (const id of selectContractCases({
  'chapter-action-admission': {
    description: 'Actual manga chapter action owner, native-end admission and stale seek fencing',
    resources: [],
  },
})) {
  await verifyChapterActionAdmission();
  recordContractCasePass(id);
}

async function verifyChapterActionAdmission() {
  const { default: assert } = await import('node:assert/strict');
  const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
  const Surface = productionMotionMethods(new URL('../entry/src/main/ets/features/manga/ui/MangaReadingSurface.ets', import.meta.url),
    ['adjacentChapter','pageOrdinal','positionIdentity','finalBoundaryConfirmed','releaseNextBoundary','resumeFromChapterEnd','openChapterEnd',
      'seekPage','nativeImageFailures','nativeFailureKey','wholeImageUnavailable','unavailableMarkerTile']);
  const chapter = { chapterIndex: 8, manifest: { chapter: { sourceId: 's', bookId: 'b', chapterId: '/8' } } };
  const owner = Object.assign(new Surface(), { sourceId: 's', bookId: 'b', mounted: true, opened: true,
    appForeground: true, windowChromeActive: true, interactionBlocked: false, pageTurnInputRevision: 0,
    horizontal: true, horizontalPage: 3, displayedPage: 3, horizontalPageCount: 4,
    confirmedPosition: { anchor: { ordinal: 3 } },
    controller: { chapter, totalPages: 4, pageAt: ordinal => ({pageId: `page-${ordinal}`}),
      tile: () => undefined, visiblePages: () => [], setVisible: async () => {} },
    remoteSession: { acquisitionMode: 'online', contentKind: 'manga', identity: { sourceId: 's', bookId: 'b' }, entries: [
      { index: 6, title: '上一可读卷', url: '/6', navigable: true },
      { index: 7, title: '卷组标题', url: '/7', navigable: false },
      { index: 8, title: '当前话', url: '/8', navigable: true },
      { index: 9, title: '下一卷分组', url: '/9', navigable: false },
      { index: 10, title: '下一可读话', url: '/10', navigable: true },
    ] },
    data: {projection: {index: ordinal => ordinal}, totalCount: () => 4,
      getData: index => ({key: `fixture:${index}`, ordinal: index, tileIndex: 0, known: false, width: 600, height: 800, sourceY: 0, sourceHeight: 800}), notify() {}},
    saveVisible: async () => {}, requestPanelFocus: () => {}, restore: () => {}, presentationGeneration: 0, layoutGeneration:0,
  });
  assert.equal(owner.adjacentChapter(-1).index, 6);
  assert.equal(owner.adjacentChapter(1).index, 10, 'chapter-end action skips non-readable groups');
  owner.remoteSession.identity.bookId = 'other';
  assert.equal(owner.adjacentChapter(1), undefined, 'foreign or stale catalog cannot invent a next chapter');
  owner.remoteSession.identity.bookId = 'b';
  owner.confirmedPosition = undefined;
  await owner.openChapterEnd();
  assert.equal(owner.chapterEnd, undefined, 'unmounted/unconfirmed last pixels do not certify completion');
  owner.confirmedPosition = { anchor: { ordinal: 3 } };
  await owner.openChapterEnd();
  assert.equal(owner.chapterEnd, true, 'horizontal mode admits a confirmed exact last ordinal');
  owner.resumeFromChapterEnd();
  assert.equal(owner.chapterEnd, false);
  owner.horizontalPage = 2;
  owner.confirmedPosition = { anchor: { ordinal: 2 } };
  await owner.openChapterEnd();
  assert.equal(owner.chapterEnd, false, 'horizontal mode still rejects a confirmed nonfinal ordinal');

  owner.remoteSession.entries.pop();
  let atEnd = false;
  const verticalPosition = { controller: owner.controller, manifest: chapter.manifest,
    identity: owner.positionIdentity(2), anchor: { ordinal: 2 } };
  Object.assign(owner, { horizontal: false, displayedPage: 2, confirmedPosition: verticalPosition,
    boundaryDragging: true, boundaryArmed: true, boundaryInputRevision: owner.pageTurnInputRevision,
    scroller: { isAtEnd: () => atEnd }, controlsVisible: false });
  await owner.releaseNextBoundary();
  assert.equal(owner.chapterEnd, false, 'a confirmed earlier page does not certify a mid-list release');
  owner.scroller.isAtEnd = () => { throw new Error('native list detached'); };
  await owner.releaseNextBoundary();
  assert.equal(owner.chapterEnd, false, 'unknown native end fails closed');
  owner.scroller.isAtEnd = () => atEnd;
  atEnd = true;
  owner.remoteSession.requiresContextRefresh = true;
  await owner.releaseNextBoundary();
  assert.equal(owner.chapterEnd, false, 'native end cannot certify an unconfirmed catalog boundary');
  owner.remoteSession.requiresContextRefresh = false;
  for (const stalePosition of [{ controller: {} }, { manifest: {} }, { identity: 'old-page' }, { anchor: { ordinal: 1 } }]) {
    owner.confirmedPosition = { ...verticalPosition, ...stalePosition };
    await owner.releaseNextBoundary();
    assert.equal(owner.chapterEnd, false, 'native end cannot certify a stale chapter position');
  }
  owner.confirmedPosition = verticalPosition;
  const invalidatedRelease = owner.releaseNextBoundary();
  owner.pageTurnInputRevision++;
  await invalidatedRelease;
  assert.equal(owner.chapterEnd, false, 'a release invalidated during panel admission does not open');
  owner.boundaryInputRevision = owner.pageTurnInputRevision;
  await owner.releaseNextBoundary();
  assert.equal(owner.chapterEnd, true, 'native list end admits the last chapter even when the first visible row precedes the final ordinal');
  owner.resumeFromChapterEnd();
  assert.equal(owner.chapterEnd, false);
  assert.equal(owner.controlsVisible, true, 'return restores reading controls without changing chapters');
  let setVisible;
  owner.controller.setVisible = () => new Promise(resolve => { setVisible = resolve; });
  let restores = 0;
  owner.restore = () => { restores++; };
  const seeking = owner.seekPage(2);
  await new Promise(resolve => setImmediate(resolve));
  owner.mounted = false;
  setVisible();
  await seeking;
  assert.equal(restores, 0, 'late page acquisition after disposal never moves a native viewport');
  console.log('PASS readable chapter neighbors, confirmed horizontal ordinal, vertical native end and safe return, stale position and input fencing, disposed seek');
}
