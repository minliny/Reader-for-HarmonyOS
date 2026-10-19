import assert from 'node:assert/strict';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function run(id){

const { registerHooks }=await import('node:module');

// ArkTS uses extensionless relative imports. Let this Node-only test resolve
// those imports to their real TypeScript files without changing production
// module specifiers or adding a bundler.
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if ((specifier.startsWith('./') || specifier.startsWith('../')) &&
        !specifier.endsWith('.ts')) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw error;
    }
  },
});

const {
  RemoteReadingFlowGateway,
} = await import('../entry/src/main/ets/features/reading/RemoteReadingFlowGateway.ts');
const {
  ReadingSessionFlowGateway,
} = await import('../entry/src/main/ets/features/reading/ReadingSessionFlowGateway.ts');
const {
  ReadingChapterWindow,
} = await import('../entry/src/main/ets/features/reading/ReadingChapterWindow.ts');
const {
  ReadingPaginationIndex,
} = await import('../entry/src/main/ets/features/reading/ReadingPaginationIndex.ts');

const SOURCE_ID = 'source-1';
const BOOK_ID = '/book/42';
const calls = [];
const PIXEL_MAP = { fixture: 'pixel-map' };

class FakeRemoteReadingRuntime {
  async loadReadingImage(
    sourceId,
    bookId,
    chapterIndex,
    contentVersion,
    imageUrl,
    baseUrl,
    allowNetwork,
    shouldStayCurrent,
  ) {
    assert.equal(sourceId, SOURCE_ID);
    assert.equal(bookId, BOOK_ID);
    assert.equal(chapterIndex, 0);
    assert.equal(contentVersion, previousChapter.contentVersion);
    assert.equal(baseUrl, '/chapter/1');
    assert.equal(allowNetwork, true);
    if (shouldStayCurrent !== undefined && !shouldStayCurrent()) {
      throw new Error('reading body image request was cancelled');
    }
    if (imageUrl === 'failed.png') {
      throw new Error('fixture image failure');
    }
    return {
      pixelMap: PIXEL_MAP,
      fileUri: 'file:///fixture/body.png',
      width: 320,
      height: 180,
      revision: 'image-r1',
    };
  }

  async request(method, params = {}, options = {}) {
    calls.push({ method, params, options });
    if(method==='reading.progress.update') {
      assert.equal(options.shouldCancel,undefined,'dispatched durable write must not be cancelled by a later retired route');
      assert.equal(options.canDispatch?.(),true,'write retains original captured final dispatch admission');
    } else assert.equal(options.shouldCancel?.(), false,
      `${method} must retain the current route/request guard`);
    switch (method) {
      case 'book.detail':
        assert.equal(params.sourceId, SOURCE_ID);
        assert.equal(params.bookUrl, BOOK_ID);
        assert.deepEqual(params.book.variables, { searchOnly: 's', token: 'search' });
        return { data: {
          sourceId: SOURCE_ID,
          book: {
            bookId: BOOK_ID,
            title: 'Remote Book',
            author: 'Author',
            coverUrl: 'https://example.invalid/cover.jpg',
          },
          tocUrl: '/book/42/toc',
          variables: { detailOnly: 'd', token: 'detail' },
        } };
      case 'book.toc':
        assert.deepEqual(params.variables, {
          detailOnly: 'd',
          searchOnly: 's',
          token: 'detail',
        });
        return { data: {
          sourceId: SOURCE_ID,
          bookId: BOOK_ID,
          toc: [
            { index: 0, title: 'Chapter 1', url: '/chapter/1', variables: { token: 'chapter' } },
            { index: 1, title: 'Chapter 2', url: '/chapter/2', variables: { chapterOnly: 'c' } },
          ],
        } };
      case 'chapter.content':
        if (params.chapterIndex === 1) {
          assert.equal(params.chapterUrl, '/chapter/2');
          assert.deepEqual(params.variables, {
            chapterOnly: 'c',
            detailOnly: 'd',
            searchOnly: 's',
            token: 'detail',
          });
          return { data: {
            sourceId: SOURCE_ID,
            bookId: BOOK_ID,
            chapterTitle: 'Chapter 2',
            content: 'Second remote chapter body.',
            via: 'rule',
          } };
        }
        assert.equal(params.chapterIndex, 0);
        assert.equal(params.chapterUrl, '/chapter/1');
        assert.deepEqual(params.variables, {
          detailOnly: 'd',
          searchOnly: 's',
          token: 'chapter',
        });
        return { data: {
          sourceId: SOURCE_ID,
          bookId: BOOK_ID,
          chapterTitle: 'Chapter 1',
          content: 'First remote chapter body has enough text for two test pages.',
          via: 'rule',
        } };
      case 'search.content':
        assert.equal(params.sourceId, SOURCE_ID);
        assert.equal(params.bookId, BOOK_ID);
        assert.equal(params.keyword, 'remote');
        assert.equal(params.maxResults, 50);
        return { data: {
          results: [{
            sourceId: SOURCE_ID,
            bookId: BOOK_ID,
            bookName: 'Remote Book',
            chapterIndex: 0,
            chapterOffset: 6,
            matchLength: 6,
            snippetStart: 0,
            chapterTitle: 'Chapter 1',
            snippet: 'First remote chapter body.',
          }],
        } };
      case 'reading.progress.get':
        return { data: {
          sourceId: SOURCE_ID,
          bookId: BOOK_ID,
          found: true,
          progress: {
            sourceId: SOURCE_ID,
            bookId: BOOK_ID,
            chapterIndex: 0,
            chapterOffset: 6,
            chapterProgress: 0.25,
            updatedAt: 100,
            locationRevision: 'revision-old',
          },
        } };
      case 'reader.location.resolve':
        assert.deepEqual(params.anchor, { chapterOffset: 12, chapterProgress: 0.5 });
        assert.deepEqual(params.layout, {
          viewportWidth: 390,
          viewportHeight: 844,
          fontScale: 1,
          lineHeight: 35.28,
        });
        return { data: {
          resolved: true,
          canonicalLocation: {
            bookId: BOOK_ID,
            chapterIndex: 0,
            chapterOffset: 12,
            // Core canonical progress is authoritative. The primary scalar
            // anchor is still exact even if an f64 JSON round trip changes
            // the final decimal digit.
            chapterProgress: 0.5000000000000001,
            locationRevision: 'revision-new',
          },
          resolverVersion: 'reader.location.resolve.v1.reflow',
          reflow: {
            strategy: 'offsetAnchor',
            primaryAnchor: 'chapterOffset',
            fallbackAnchor: 'chapterProgress',
            layoutIndependent: true,
          },
        } };
      case 'reading.progress.update':
        assert.equal(params.locationRevision, 'revision-new');
        assert.equal(params.chapterProgress, 0.5000000000000001);
        return { data: {
          stored: true,
          sourceId: SOURCE_ID,
          bookId: BOOK_ID,
          chapterIndex: 0,
          chapterOffset: 12,
          chapterProgress: 0.5000000000000001,
          updatedAt: 101,
          locationRevision: 'revision-new',
          ...(params.transactionId === undefined ? {} : {
            transactionId: params.transactionId,
            sourceSwitchFinalized: true,
          }),
        } };
      default:
        throw new Error(`unexpected command: ${method}`);
    }
  }
}

const runtime=new FakeRemoteReadingRuntime(),gateway=new RemoteReadingFlowGateway(runtime),isCurrent=()=>true;let previousChapter;
const session={identity:{sourceId:SOURCE_ID,bookId:BOOK_ID},acquisitionMode:'online',detailUrl:BOOK_ID,tocUrl:'/book/42/toc',book:{title:'Remote Book',author:'Author'},hostRequirements:[],continuationVariables:[{name:'detailOnly',value:'d'},{name:'searchOnly',value:'s'},{name:'token',value:'detail'}],entries:[{index:0,title:'Chapter 1',url:'/chapter/1',variables:[{name:'token',value:'chapter'}]},{index:1,title:'Chapter 2',url:'/chapter/2',variables:[{name:'chapterOnly',value:'c'}]}]};
const readingSessionGateway = new ReadingSessionFlowGateway(
  SOURCE_ID,
  BOOK_ID,
  { kind: 'remote', session },
  runtime,
);

try{
if(id==='acquisition'){
const session = await gateway.openSession({
  sourceId: SOURCE_ID,
  bookId: BOOK_ID,
  detailUrl: BOOK_ID,
  title: 'Search title',
  author: 'Search author',
  searchVariables: [
    { name: 'token', value: 'search' },
    { name: 'searchOnly', value: 's' },
  ],
}, { isCurrent });
assert.equal(session.entries.length, 2);
assert.deepEqual(session.continuationVariables, [
  { name: 'detailOnly', value: 'd' },
  { name: 'searchOnly', value: 's' },
  { name: 'token', value: 'detail' },
]);


}
if(id==='search-scalars'){
assert.equal(readingSessionGateway.supportsContentSearch(), true);
const matches = await readingSessionGateway.searchContent(BOOK_ID, 'remote', 50, isCurrent);
assert.equal(matches.length, 1);
assert.equal(matches[0].sourceId, SOURCE_ID);
assert.equal(matches[0].chapterOffset, 6);

const currentChapter = await readingSessionGateway.loadChapter(BOOK_ID, 1, isCurrent);
previousChapter = await readingSessionGateway.loadChapter(BOOK_ID, 0, isCurrent);
assert.equal(previousChapter.sourceId, SOURCE_ID);
assert.equal(previousChapter.bookId, BOOK_ID);
assert.equal(previousChapter.extractionVia, 'rule');
assert.match(previousChapter.contentVersion, /^reader-content-v1:/);
assert.equal(
  Array.from(previousChapter.content)
    .slice(matches[0].chapterOffset, matches[0].chapterOffset + matches[0].matchLength)
    .join(''),
  'remote',
  'an online search result must select the exact scalar range rendered by the shared ReadingDocument',
);


}
if(id==='image-ownership'){
previousChapter=await readingSessionGateway.loadChapter(BOOK_ID,0,isCurrent);
const pendingImage = {
  source: 'body.png',
  baseUrl: '/chapter/1',
  startScalar: 4,
  endScalar: 5,
  state: 'pending',
  pixelMap: undefined,
  fileUri: '',
  intrinsicWidth: 0,
  intrinsicHeight: 0,
  revision: 'pending',
};
const readyImage = await readingSessionGateway.resolveReadingImage(previousChapter, pendingImage, isCurrent);
assert.equal(readyImage.state, 'ready');
assert.equal(readyImage.pixelMap, PIXEL_MAP);
assert.equal(readyImage.intrinsicWidth, 320);
assert.equal(readyImage.revision, 'image-r1');
const failedImage = await readingSessionGateway.resolveReadingImage(previousChapter, {
  ...pendingImage,
  source: 'failed.png',
}, isCurrent);
assert.equal(failedImage.state, 'failed', 'one failed image must not reject its chapter');
assert.equal(failedImage.pixelMap, undefined);
await assert.rejects(
  readingSessionGateway.resolveReadingImage(previousChapter, pendingImage, () => false),
  /cancelled/,
  'a stale image request must cancel instead of publishing a failed placeholder',
);

let imageStillCurrent = true;
let stalePixelReleaseCount = 0;
const stalePixel = { fixture: 'stale-pixel-map' };
const staleImageGateway = new ReadingSessionFlowGateway(
  SOURCE_ID,
  BOOK_ID,
  { kind: 'remote', session },
  {
    async request() {
      throw new Error('request is not used by the stale image test');
    },
    async loadReadingImage() {
      imageStillCurrent = false;
      return {
        pixelMap: stalePixel,
        fileUri: 'file:///fixture/stale.png',
        width: 10,
        height: 10,
        revision: 'stale-r1',
      };
    },
    releaseReadingImage(fileUri, pixelMap) {
      assert.equal(fileUri, 'file:///fixture/stale.png');
      assert.equal(pixelMap, stalePixel);
      stalePixelReleaseCount += 1;
    },
  },
);
await assert.rejects(
  staleImageGateway.resolveReadingImage(previousChapter, pendingImage, () => imageStillCurrent),
  /cancelled/,
  'an image that becomes stale after decode must not publish its native handle',
);
assert.equal(stalePixelReleaseCount, 1,
  'a decoded PixelMap that loses ownership before admission must be released exactly once');


}
if(id==='window-pagination'){
previousChapter=await readingSessionGateway.loadChapter(BOOK_ID,0,isCurrent);
const currentChapter=await readingSessionGateway.loadChapter(BOOK_ID,1,isCurrent);
const chapterWindow = new ReadingChapterWindow();
chapterWindow.configure(SOURCE_ID, BOOK_ID, [0, 1]);
chapterWindow.setCurrent(currentChapter);
assert.equal(chapterWindow.admitNeighbour(previousChapter), true);
assert.equal(chapterWindow.previous()?.chapterIndex, 0,
  'the online reading session must retain its real TOC predecessor');
const imageWindow = new ReadingChapterWindow();
imageWindow.configure(SOURCE_ID, BOOK_ID, [0]);
imageWindow.setCurrent({ ...previousChapter, images: [{pixelMap:PIXEL_MAP}] });
assert.equal(imageWindow.retainedImages()[0].pixelMap, PIXEL_MAP,
  'the bounded window must expose the native handles that remain live');

const pagination = new ReadingPaginationIndex();
const layoutSignature = 'runtime-test-layout-v1';
const currentKey = {
  sourceId: SOURCE_ID,
  bookId: BOOK_ID,
  chapterIndex: currentChapter.chapterIndex,
  contentVersion: currentChapter.contentVersion,
  layoutSignature,
};
const previousKey = {
  sourceId: SOURCE_ID,
  bookId: BOOK_ID,
  chapterIndex: previousChapter.chapterIndex,
  contentVersion: previousChapter.contentVersion,
  layoutSignature,
};
pagination.recordChapter({
  key: currentKey,
  contentScalarLength: Array.from(currentChapter.content).length,
  pageStartScalars: [0],
});
assert.deepEqual(pagination.findPreviousPage(currentKey, 0, previousKey), {
  kind: 'manifestRequired',
  key: previousKey,
}, 'a cold chapter-boundary turn must wait for a real predecessor manifest');
pagination.recordChapter({
  key: previousKey,
  contentScalarLength: Array.from(previousChapter.content).length,
  pageStartScalars: [0, 30],
});
const crossChapterPrevious = pagination.findPreviousPage(currentKey, 0, previousKey);
assert.equal(crossChapterPrevious.kind, 'page');
assert.equal(crossChapterPrevious.page.key.chapterIndex, 0);
assert.equal(crossChapterPrevious.page.startScalar, 30,
  'the measured predecessor must enter at its actual final physical page');


}
if(id==='canonical-progress'){
const progress = await gateway.loadProgress(session.identity, isCurrent);
assert.equal(progress.kind, 'restored');
assert.equal(progress.progress.locationRevision, 'revision-old');

const resolved = await gateway.resolveLocation(
  session.identity,
  'Chapter 1',
  { chapterIndex: 0, chapterOffset: 12, chapterProgress: 0.5 },
  { viewportWidth: 390, viewportHeight: 844, fontScale: 1, lineHeight: 35.28 },
  isCurrent,
);
assert.equal(resolved.locationRevision, 'revision-new');
assert.equal(resolved.chapterProgress, 0.5000000000000001,
  'the gateway must persist Core canonical progress while guarding the exact scalar anchor');
const stored = await gateway.updateProgress(session.identity, {
  chapterIndex: resolved.chapterIndex,
  chapterOffset: resolved.chapterOffset,
  chapterProgress: resolved.chapterProgress,
  locationRevision: resolved.locationRevision,
}, isCurrent);
assert.equal(stored.locationRevision, 'revision-new');


}
if(id==='transaction-once'){
const resolved={chapterIndex:0,chapterOffset:12,chapterProgress:0.5000000000000001,locationRevision:'revision-new'};
const sourceSwitchTransactionId = 'ss-first-canonical-progress';
const sourceSwitchSessionGateway = new ReadingSessionFlowGateway(
  SOURCE_ID,
  BOOK_ID,
  { kind: 'remote', session },
  runtime,
  sourceSwitchTransactionId,
);
await sourceSwitchSessionGateway.updateProgress(BOOK_ID, {
  chapterIndex: resolved.chapterIndex,
  chapterOffset: resolved.chapterOffset,
  chapterProgress: resolved.chapterProgress,
  locationRevision: resolved.locationRevision,
}, isCurrent);
assert.equal(calls.at(-1).params.transactionId, sourceSwitchTransactionId,
  'the first canonical target progress must carry the Core transaction id');
await sourceSwitchSessionGateway.updateProgress(BOOK_ID, {
  chapterIndex: resolved.chapterIndex,
  chapterOffset: resolved.chapterOffset,
  chapterProgress: resolved.chapterProgress,
  locationRevision: resolved.locationRevision,
}, isCurrent);
assert.equal(calls.at(-1).params.transactionId, undefined,
  'a successful atomic finalize must consume the session transaction id exactly once');


}
if(id==='cancelled'){
let staleRequestCount = 0;
const staleGateway = new RemoteReadingFlowGateway({
  async request(method, _params, options) {
    staleRequestCount += 1;
    assert.equal(method, 'book.detail');
    assert.equal(options.shouldCancel(), true,
      'a stale route must reach Core through shouldCancel rather than a UI-only flag');
    throw new Error('request cancelled');
  },
});
await assert.rejects(
  staleGateway.openSession({
    sourceId: SOURCE_ID,
    bookId: BOOK_ID,
    detailUrl: BOOK_ID,
    title: 'Stale book',
    author: '',
  }, { isCurrent: () => false }),
  (error) => error.code === 'cancelled' && error.command === 'book.detail',
);
assert.equal(staleRequestCount, 0,
  'a cancelled detail request must not continue into TOC or chapter work');

let staleChapterRequestCount = 0;
const staleChapterGateway = new RemoteReadingFlowGateway({
  async request(method, _params, options) {
    staleChapterRequestCount += 1;
    assert.equal(method, 'chapter.content');
    assert.equal(options.shouldCancel(), true,
      'a superseded predecessor measurement must cancel at the Core request boundary');
    throw new Error('request cancelled');
  },
});
await assert.rejects(
  staleChapterGateway.loadChapter(session, 0, () => false),
  (error) => error.code === 'cancelled' && error.command === 'chapter.content',
);
assert.equal(staleChapterRequestCount, 0);


}
if(id==='identity'){
let mismatchRequestCount = 0;
const mismatchGateway = new RemoteReadingFlowGateway({
  async request(method) {
    mismatchRequestCount += 1;
    assert.equal(method, 'book.detail');
    return { data: {
      sourceId: 'different-source',
      book: {
        bookId: BOOK_ID,
        title: 'Wrong source response',
        author: '',
      },
      tocUrl: '/must-not-be-used',
    } };
  },
});
await assert.rejects(
  mismatchGateway.openSession({
    sourceId: SOURCE_ID,
    bookId: BOOK_ID,
    detailUrl: BOOK_ID,
    title: 'Identity guarded book',
    author: '',
  }),
  (error) => error.code === 'identityMismatch' && error.command === 'book.detail',
);
assert.equal(mismatchRequestCount, 1,
  'a mismatched detail identity must stop before TOC acquisition');


}
if(id==='progress-serial'){
const serialOrder = [];
let releaseFirstCommit = () => {};
let markFirstCommitStarted = () => {};
const firstCommitGate = new Promise((resolve) => {
  releaseFirstCommit = resolve;
});
const firstCommitStarted = new Promise((resolve) => {
  markFirstCommitStarted = resolve;
});
const firstCommit = gateway.runProgressCommitSerial(async () => {
  serialOrder.push('first:start');
  markFirstCommitStarted();
  await firstCommitGate;
  serialOrder.push('first:end');
});
const secondCommit = gateway.runProgressCommitSerial(async () => {
  serialOrder.push('second:start');
  serialOrder.push('second:end');
});
await firstCommitStarted;
assert.deepEqual(serialOrder, ['first:start'],
  'a later progress write must wait for the active write');
releaseFirstCommit();
await Promise.all([firstCommit, secondCommit]);
assert.deepEqual(serialOrder, [
  'first:start',
  'first:end',
  'second:start',
  'second:end',
]);


}
if(id==='force-refresh'){
const refreshStart=calls.length;
await readingSessionGateway.loadChapter(BOOK_ID,0,isCurrent,true);
const forcedCalls=calls.slice(refreshStart).filter(c=>c.method==='chapter.content');
assert.equal(forcedCalls.length,1);assert.equal(forcedCalls[0].params.forceRefresh,true);
assert.equal(forcedCalls[0].params.sourceId,SOURCE_ID);assert.equal(forcedCalls[0].params.bookId,BOOK_ID);
assert.ok(calls.slice(0,refreshStart).filter(c=>c.method==='chapter.content').every(c=>!('forceRefresh' in c.params)),
 'ordinary cache-first reads retain the old default contract');
const offlineStart=calls.length;
await gateway.loadChapter({...session,acquisitionMode:'offline',hostRequirements:[]},0,isCurrent,true);
assert.equal(calls.slice(offlineStart).filter(c=>c.method==='chapter.content')[0].params.forceRefresh,true,
 'explicit refresh bypasses the offline-only cache probe while preserving source identity');
const failedRefreshGateway=new RemoteReadingFlowGateway({async request(method,params){
 assert.equal(method,'chapter.content');assert.equal(params.forceRefresh,true);throw Error('source transport failed');}});
await assert.rejects(failedRefreshGateway.loadChapter(session,0,isCurrent,true),/source transport failed/,
 'explicit refresh does not disguise source failure as a successful old-cache reload');

}
if(id==='media'){
for (const contentKind of ['manga','audio']) {
 const reached=[];
 const mediaGateway=new RemoteReadingFlowGateway({async request(method){
  reached.push(method);assert.equal(method,'book.detail');
  return {data:{sourceId:SOURCE_ID,contentKind,book:{bookId:BOOK_ID,title:'Media',author:'Writer',contentKind:'text'},tocUrl:'/toc'}};
 }});
 const mediaSeed={sourceId:SOURCE_ID,bookId:BOOK_ID,detailUrl:BOOK_ID,title:'Media',author:'Writer'};
 await assert.rejects(mediaGateway.openSession(mediaSeed),(error)=>error.code==='nonTextChapter'&&error.command==='book.detail');
 assert.deepEqual(reached,['book.detail'],'outer Core media fact blocks TOC/body even if book object differs');
 reached.length=0;
 await assert.rejects(mediaGateway.openCachedSession({...mediaSeed,contentKind}),(error)=>error.code==='nonTextChapter');
 await assert.rejects(mediaGateway.openSession({...mediaSeed,contentKind}),(error)=>error.code==='nonTextChapter');
 assert.deepEqual(reached,[],'known non-text cached/fresh entry performs no request');
}

}
if(id==='directory-metadata'){
{
  const metadata = { displayTitle: '１００（上）', isVip: true, isPay: false, contextTitle: '第一部 / 第二卷' };
  const raw = { index: 0, title: '✿·１００（上）', url: '/chapter/100', level: 1, ...metadata };
  const decoded = gateway.decodeToc([raw])[0];
  for (const [key, value] of Object.entries(metadata)) assert.equal(decoded[key], value);
  assert.equal(decoded.title, raw.title); assert.equal(decoded.index, 0); assert.equal(decoded.url, raw.url);
  assert.equal(gateway.decodeToc([{ ...raw, title: '' }])[0].title, '', 'raw missing titles reach the shared display fallback');
  for (const malformed of [{ isVip: 1 }, { isPay: 'false' }, { displayTitle: 7 }, { contextTitle: [] }]) {
    assert.throws(() => gateway.decodeToc([{ ...raw, ...malformed }]), error =>
      error instanceof Error && error.code === 'invalidResponse' && error.command === 'book.toc' && /directory .* invalid/.test(error.message));
  }
  const Local = (await import('../entry/src/main/ets/features/reading/LocalReadingFlowGateway.ts')).LocalReadingFlowGateway;
  const local = new Local({ async request(method, params) {
    assert.equal(method, 'local_book.toc'); assert.equal(params.bookId, 'metadata-local');
    return { data: { sourceId: 'local', bookId: 'metadata-local', toc: [raw] } };
  } });
  const localEntry = (await local.loadToc('metadata-local')).entries[0];
  for (const [key, value] of Object.entries(metadata)) assert.equal(localEntry[key], value);
  assert.equal(localEntry.title, raw.title); assert.equal(localEntry.downloadState, 'unknown');
  const cachedGateway = new RemoteReadingFlowGateway({ async request(method) {
    assert.equal(method, 'cache.book.status');
    return { data: { sourceId: SOURCE_ID, bookId: BOOK_ID, tocAvailable: true,
      chapters: [{ ...raw, chapterIndex: 0, navigable: true }] } };
  } });
  const cached = await cachedGateway.openCachedSession({ sourceId: SOURCE_ID, bookId: BOOK_ID,
    detailUrl: BOOK_ID, title: 'Cached metadata', author: 'Author' });
  for (const [key, value] of Object.entries(metadata)) assert.equal(cached.entries[0][key], value);
  assert.equal(cached.entries[0].title, raw.title);
  const malformedCache = new RemoteReadingFlowGateway({ async request(method) {
    assert.equal(method, 'cache.book.status');
    return { data: { sourceId: SOURCE_ID, bookId: BOOK_ID, tocAvailable: true,
      chapters: [{ ...raw, chapterIndex: 0, navigable: true, isVip: 'true' }] } };
  } });
  await assert.rejects(() => malformedCache.openCachedSession({ sourceId: SOURCE_ID, bookId: BOOK_ID,
    detailUrl: BOOK_ID, title: 'Cached metadata', author: 'Author' }), error =>
    error.code === 'cacheDerivedCorrupt' && error.command === 'cache.book.status' &&
    error.causeValue?.code === 'invalidResponse' && /directory isVip is invalid/.test(error.message),
  'malformed optional cached metadata reaches the existing derived-cache corruption classification');
}


}
if(id==='offline-manga'){
{
 const {productionMotionMethods}=await import('./lib/reader-motion-method-probe.mjs');
 const {MangaSessionGateway}=await import('../entry/src/main/ets/features/manga/MangaSessionGateway.ts');
 const {MangaSessionController}=await import('../entry/src/main/ets/features/manga/MangaSessionController.ts');
 const {MangaBookPresentation}=await import('../entry/src/main/ets/features/manga/MangaBookPresentation.ts');
 const {mangaDirectoryDisplay}=await import('../entry/src/main/ets/features/manga/MangaDirectoryDisplay.ts');
 const Surface=productionMotionMethods(new URL('../entry/src/main/ets/features/manga/MangaReadingSurface.ets',import.meta.url),
  ['open','acquireCatalog','effectiveFit','configureAdjacentChapter','directoryEntries','directoryCurrentIndex','directoryCurrentCatalogEntry','directoryCurrentTitle','adjacentChapter'],
  {RemoteReadingFlowGateway,MangaSessionGateway,MangaBookPresentation,mangaDirectoryDisplay,AppStorage:{setOrCreate(){}}});
 const mangaSeed={sourceId:SOURCE_ID,bookId:BOOK_ID,detailUrl:BOOK_ID,title:'Cached manga',author:'Writer',contentKind:'manga',sourceVersion:'v1'};
 for(const scenario of ['verified','legacy','wrong-version','partial-proof','empty-proof']){
  const requests=[],images=[],releases=[];
  const pageId='mp1:'+'a'.repeat(64),resourceRef='manga:'+pageId;
  const chapter={chapterIndex:0,chapterTitle:'✿·199回\n',cached:true,resources:[],manifest:{
   chapter:{sourceId:SOURCE_ID,bookId:BOOK_ID,chapterId:'/cached/199'},sourceRuleVersion:'v1',manifestVersion:'cached-manifest',decodeRevision:'identity-v1',
   pages:[{ordinal:0,pageId,resourceRef}]}};
  const status={sourceId:SOURCE_ID,bookId:BOOK_ID,tocAvailable:true,continuationVariables:{},
   ...(scenario==='legacy'?{}:scenario==='partial-proof'?{catalogVersion:'catalog',contextVersion:'context'}:
    {sourceVersion:scenario==='wrong-version'?'v2':'v1',catalogVersion:scenario==='empty-proof'?' ':'catalog',contextVersion:'context'}),
   chapters:[{chapterIndex:0,title:chapter.chapterTitle,url:chapter.manifest.chapter.chapterId,variables:{},navigable:true,
    proofState:scenario==='legacy'?'legacyUnknown':'verified',level:1,displayTitle:'199回',isVip:true}]};
  const runtime={supportsCoreCapability:capability=>['manga.entry.v1','manga.chapter.v1'].includes(capability),
   async request(method,params={}){
    requests.push({method,params});
    if(method==='manga.entry.get')return{data:{entry:null}};
    if(method==='cache.book.status'){assert.equal(params.sourceId,SOURCE_ID);assert.equal(params.bookId,BOOK_ID);return{data:status};}
    if(method==='reading.progress.get')return{data:{token:{epoch:900,revision:0},location:null}};
    if(method==='manga.chapter.get'){assert.equal(params.policy,'cacheOnly');assert.equal(params.chapterIndex,0);return{data:chapter};}
    throw Error('offline catalog cannot dispatch '+method);
   },bookAcquisitions(){throw Error('offline cannot acquire a source catalog');},
   async loadReadingImage(...args){images.push(args);assert.equal(args[6],false,'actual image adapter has no network authority');
    return{fileUri:'file://offline-199',width:600,height:800,revision:'cached-pixels'};},
   releaseReadingImage:uri=>releases.push(uri)};
  const controller=new MangaSessionController(runtime);
  const surface=Object.assign(new Surface(),{runtime,controller,mounted:true,offline:true,sourceId:SOURCE_ID,bookId:BOOK_ID,
   remoteBookSeed:mangaSeed,remoteSession:undefined,fitPreference:'width',horizontal:false,directoryProjection:[],
   isReaderIdentityCurrent:()=>true,publish(){},updateViewport:async()=>{},
   onRemoteSessionReady:value=>{surface.remoteSession=value;}});
  await surface.open(controller);
  assert.equal(surface.opened,true,scenario+': typed manga cold catalog reaches cached pixels without a prepared session');
  assert.equal(surface.error??'','');assert.equal(surface.remoteSession.contentKind,'manga');
  assert.equal(surface.remoteSession.acquisitionMode,'offline');assert.equal(surface.remoteSession.requiresContextRefresh,true);
  assert.equal(requests.filter(row=>row.method==='cache.book.status').length,1);
  assert.ok(requests.every(row=>['manga.entry.get','cache.book.status','reading.progress.get','manga.chapter.get'].includes(row.method)));
  assert.ok(images.length>0);assert.ok(controller.visiblePages().some(page=>page.status==='ready'));
  const entries=surface.directoryEntries();assert.equal(entries.length,1);assert.equal(entries[0].title,chapter.chapterTitle);
  assert.equal(surface.directoryCurrentCatalogEntry(0).index,0);
  assert.equal(surface.directoryCurrentTitle(),scenario==='verified'?'199回':chapter.chapterTitle);
  assert.equal(entries[0].level,scenario==='verified'?1:undefined);assert.equal(entries[0].displayTitle,scenario==='verified'?'199回':undefined);
  assert.equal(entries[0].isVip,scenario==='verified'?true:undefined,'unknown/old-version presentation stays a plain canonical row');
  const oldSession=surface.remoteSession;
  surface.remoteSession={...oldSession,identity:{sourceId:'foreign',bookId:BOOK_ID}};
  assert.deepEqual(surface.directoryEntries(),[],'a foreign cache cannot borrow the admitted reader identity');
  surface.remoteSession={...oldSession,entries:[{...oldSession.entries[0],url:'/different'}]};
  assert.deepEqual(surface.directoryEntries(),[],'offline catalog must still include the current immutable manifest chapter');
  surface.remoteSession=oldSession;
  await controller.close();assert.ok(releases.includes('file://offline-199'));
 }
 const reached=[],mediaGateway=new RemoteReadingFlowGateway({async request(method){reached.push(method);return{data:{sourceId:SOURCE_ID,bookId:BOOK_ID,
  tocAvailable:true,chapters:[{chapterIndex:0,title:'Original',url:'/cached/199',variables:{}}]}};}});
 await assert.rejects(mediaGateway.openCachedCatalogSession(mangaSeed),error=>error.code==='nonTextChapter');
 await assert.rejects(mediaGateway.openCachedCatalogSession({...mangaSeed,contentKind:'audio'},()=>true,false,true),error=>error.code==='nonTextChapter');
 assert.deepEqual(reached,[],'ordinary catalog and audio admission never borrow explicit manga permission');
 for(const contentKind of ['text','audio']){
  const surface=Object.assign(new Surface(),{runtime:{request(){throw Error('wrong-type Surface cannot read Core');}},offline:true,
   remoteBookSeed:{...mangaSeed,contentKind}});
  await assert.rejects(surface.acquireCatalog(()=>true),/MANGA_SESSION_IDENTITY_MISMATCH/);
 }
 const novel=await mediaGateway.openCachedCatalogSession({...mangaSeed,contentKind:'text'});
 assert.equal(novel.acquisitionMode,'offline');assert.equal(novel.entries[0].title,'Original');assert.deepEqual(reached,['cache.book.status']);
}

}
}finally{}
}
const definitions={"acquisition": "acquisition actual scoped owner/gateway/storage path; controlled Core/OS ports", "search-scalars": "search-scalars actual scoped owner/gateway/storage path; controlled Core/OS ports", "image-ownership": "image-ownership actual scoped owner/gateway/storage path; controlled Core/OS ports", "window-pagination": "window-pagination actual scoped owner/gateway/storage path; controlled Core/OS ports", "canonical-progress": "canonical-progress actual scoped owner/gateway/storage path; controlled Core/OS ports", "transaction-once": "transaction-once actual scoped owner/gateway/storage path; controlled Core/OS ports", "cancelled": "cancelled actual scoped owner/gateway/storage path; controlled Core/OS ports", "identity": "identity actual scoped owner/gateway/storage path; controlled Core/OS ports", "progress-serial": "progress-serial actual scoped owner/gateway/storage path; controlled Core/OS ports", "force-refresh": "force-refresh actual scoped owner/gateway/storage path; controlled Core/OS ports", "media": "media actual scoped owner/gateway/storage path; controlled Core/OS ports", "directory-metadata": "directory-metadata actual scoped owner/gateway/storage path; controlled Core/OS ports", "offline-manga": "offline-manga actual scoped owner/gateway/storage path; controlled Core/OS ports"};
for(const id of selectContractCases(definitions)){await run(id);recordContractCasePass(id);}
