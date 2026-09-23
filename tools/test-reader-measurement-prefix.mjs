import assert from 'node:assert/strict';
import * as style from '../entry/src/main/ets/features/reading/ReaderAppearanceRenderStyle.ts';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { ReadingPaginationIndex, ReadingPaginationPrefix } from '../entry/src/main/ets/features/reading/ReadingPaginationIndex.ts';

const source = new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url);
class Fragment { constructor(id, text) { Object.assign(this, { id, text }); } }
const nativeSource=readFileSync(new URL('../entry/src/main/ets/features/reading/ReaderNativeTextWindow.ets',import.meta.url),'utf8');
const nativeHeightSource=nativeSource.slice(nativeSource.indexOf('export function readerNativeParagraphHeight'),nativeSource.indexOf('/** A viewport'));
const nativeHeight=new Function('graphicsText',stripTypeScriptTypes(nativeHeightSource).replace('export ','')+';return readerNativeParagraphHeight;')({RectWidthStyle:{TIGHT:0},RectHeightStyle:{TIGHT:0}});
let serial=0;
class Window {constructor(...args){this.args=args;}}
const Owner = productionMotionMethods(source,
  ['captureMeasurementAfterLayout', 'consumeMeasuredBatch', 'paragraphHasLayout', 'measureNativeParagraph', 'measuredPageEndLimit', 'scaledReadingImageHeight'], { ReadingSurfacePageFragment: Fragment, ...style, FontWeight:{Regular:400},TextAlign:{JUSTIFY:'justify',Start:'start'},
    ReaderNativeTextWindow:Window,readerNativeParagraphKey:()=>String(++serial),readerNativeParagraphHeight:nativeHeight });
const paginationKey = { sourceId: 'local', bookId: 'measurement-prefix', chapterIndex: 1,
  contentVersion: 'body-v1', layoutSignature: 'font20-width100' };
const paragraph = (id, heights, ready = true, startScalar = 0) => ({ id, isParagraphStart: true,
  chapterStartScalar: startScalar, text: id.repeat(heights.length), ready,
  controller: { getLayoutManager() { return { getLineCount: () => ready ? heights.length : 0,
    getLineMetrics:i=>({startIndex:i,endIndex:i+1,topHeight:heights.slice(0,i).reduce((a,b)=>a+b,0),height:heights[i]}),getRectsForRange:()=>[] }; } },
  lines: heights.map((height, i) => ({ height, lineIndex: i, startUtf16: i, endUtf16: i + 1,
    startScalar: startScalar + i, endScalar: startScalar + i + 1 })) });
function owner(batch) {
  const measuredIds = [];
  return Object.assign(new Owner(), {
    measuredIds, measurementNodeText: p => p.text,
    readerSettingsSnapshot:{navigationMode:'paged'},
    nativeTextMeasurement: { clear() {}, take(){return {};}, measure(_context, text){ measuredIds.push(text); } }, nativeParagraphResources:{set(){}},
    getUIContext:()=>({px2vp:v=>v,vp2px:v=>v,fp2px:v=>v}),measurementTextWidth:()=>100,
    lifecycleToken: 1, measurementBatch: batch, batchProcessing: false, measurementCompleting: false,
    paginationIndex: new ReadingPaginationIndex(), paginationDraft: undefined, requestedAnchor: 0,
    measuringDraft() { return this.paginationDraft; }, measurementPaginationKey: () => paginationKey,
    measuringRequestedAnchor() { return this.requestedAnchor; },
    currentMeasurementGeneration: () => 1, currentMeasurementSelection: () => 1,
    isMeasurementCurrent: () => true, hasValidUnicodeProbe: () => true,
    captureChapterTitleMeasurementAfterLayout: () => true, reportMeasurementGatePending() {},
    readingImageForParagraph: () => undefined, pendingPageBodyCapacity: () => 20,
    pendingPageFragments: [], pendingPageHeight: 0, appearanceSnapshot: { paragraphSpacing: 0,fontSize:20,lineHeight:1.5,indent:'none',activeTheme:'paper' },
    measuredLines: p => p.lines, requireMeasurementChapter: () => ({ chapterIndex: 1 }),
    presentationLineText: text => text, prepareNextMeasurementBatch: () => false,
    beginFirstPageCommit() { this.committed = true; }, fail(error) { throw error; },
  });
}
const full = owner([paragraph('a', [10, 10, 10]), paragraph('b', [10], false)]);
full.captureMeasurementAfterLayout();
assert.deepEqual(full.measuredIds, ['aaa'], 'unneeded suffix is never shaped');
assert.equal(full.committed, true, 'a full page must not wait for an unneeded later paragraph');
assert.deepEqual(full.pendingPageFragments.map(f => f.text), ['a', 'a']);
assert.equal(full.pendingPageFragments[0].nativeParagraph,full.pendingPageFragments[1].nativeParagraph);
assert.deepEqual(full.pendingPageFragments.map(f=>f.nativeParagraphFirst),[true,false]);
assert.equal(full.pendingPageFragments[0].nativeParagraph.lastLine,1,'overflow line cannot enter the displayed paragraph window');

const pending = paragraph('b', [10], false);
const partial = owner([paragraph('a', [10]), pending]);
partial.captureMeasurementAfterLayout();
assert.equal(partial.committed, undefined, 'never publish an incomplete page across unmeasured text');
assert.equal(partial.batchProcessing, false, 'a later layout notification can resume');
assert.deepEqual(partial.pendingPageFragments.map(f => f.text), ['a']);
assert.deepEqual(partial.measurementBatch, [pending], 'only the unconsumed suffix remains');
pending.controller = { getLayoutManager: () => ({ getLineCount: () => 1,getLineMetrics:()=>({startIndex:0,endIndex:1,topHeight:0,height:10}),getRectsForRange:()=>[] }) };
partial.captureMeasurementAfterLayout();
assert.equal(partial.committed, true);
assert.deepEqual(partial.pendingPageFragments.map(f => f.text), ['a', 'b'], 'resume never duplicates prior paragraphs');

assert.deepEqual(partial.measuredIds, ['a', 'b'], 'resuming a pending controller does not shape a paragraph again');

const cancelled = owner([paragraph('a', [10])]);
cancelled.isMeasurementCurrent = () => false;
cancelled.captureMeasurementAfterLayout();
assert.deepEqual(cancelled.pendingPageFragments, []);
const titlePending = owner([paragraph('a', [10, 10, 10])]);
titlePending.captureChapterTitleMeasurementAfterLayout = () => false;
titlePending.captureMeasurementAfterLayout();
assert.deepEqual(titlePending.pendingPageFragments, [], 'title geometry still precedes body admission');
const unbound = paragraph('a', [10]);
unbound.controller = { getLayoutManager() { throw Error('not bound yet'); } };
const later = owner([unbound]);
later.captureMeasurementAfterLayout();
assert.equal(later.batchProcessing, false);
assert.equal(later.committed, undefined, 'a pending controller is neither an empty page nor a fatal layout error');
unbound.controller = { getLayoutManager: () => ({ getLineCount: () => 1,getLineMetrics:()=>({startIndex:0,endIndex:1,topHeight:0,height:10}),getRectsForRange:()=>[] }) };
later.captureMeasurementAfterLayout();
assert.equal(later.committed, true);
console.log('Production measurement prefix: full-page early commit, pending suffix resume and cancellation PASS');

for (const remaining of [0, 0.5, 1, 5]) {
  const nextImage = owner([paragraph('image', [1], true, 3)]);
  nextImage.appearanceSnapshot.lineHeightMultiplier = 1.5;
  nextImage.pendingPageFragments = [{ text: 'already measured' }];
  nextImage.pendingPageHeight = 20 - remaining;
  nextImage.pendingPageEndScalar = 3;
  nextImage.readingImageForParagraph = () => ({ state: 'pending', startScalar: 3, endScalar: 4 });
  let requested = false;
  nextImage.resolvePendingReadingImage = () => { requested = true; };
  nextImage.consumeMeasuredBatch(1, 1, 1);
  assert.equal(requested, remaining >= 1, 'only the proven image minimum can justify deferring an unknown decode');
  assert.equal(nextImage.committed === true, remaining < 1);
  assert.equal(nextImage.pendingPageEndScalar, 3, 'deferring next-page decode never consumes the image anchor');
}
console.log('PASS full text page commits before decoding a later image; unknown dimensions still resolve when space remains');

const localImageSource = `reader-local-epub://${Buffer.from('local:' + 'a'.repeat(64)).toString('base64url')}/${Buffer.from('OPS/logo.png').toString('base64url')}`;
for (const state of ['pending', 'failed']) {
  const known = owner([paragraph('image', [1], true, 0), paragraph('body', [10], true, 2)]);
  known.pendingPageBodyCapacity = () => 50;
  known.readingImageForParagraph = p => p.chapterStartScalar === 0 ? {
    source: localImageSource, state, intrinsicWidth: 357, intrinsicHeight: 359,
    imageWidthBasisPoints: 3000, startScalar: 0, endScalar: 1,
  } : undefined;
  known.resolvePendingReadingImage = () => assert.fail('known geometry cannot await image decode');
  known.captureMeasurementAfterLayout();
  assert.equal(known.committed, true, 'first-page image plus text is committed in the same turn without pixels');
  assert.deepEqual(known.pendingPageFragments.map(f => f.text), ['', 'b']);
  assert.ok(Math.abs(known.pendingPageHeight - (30 * 359 / 357 + 10)) < 1e-9,
    'failed pixels preserve exactly the same page geometry as pending pixels');
}
console.log('PASS known immutable local image geometry admits following text synchronously; pixel failure cannot collapse page height');

// These fixtures use the production bound resolver and real local/index facts.
// A shorter reverse page must not grow when it is rematerialized forward, even
// if the same layout also has an older chapter-head manifest.
const knownPage = owner([paragraph('a', [5, 5, 5], true, 2), paragraph('b', [5], false, 5)]);
knownPage.paginationIndex.recordChapter({ key: paginationKey, contentScalarLength: 6, pageStartScalars: [0, 2, 4] });
knownPage.paginationDraft = new ReadingPaginationPrefix(paginationKey,
  { requestScalar: 2, startScalar: 2, endScalarExclusive: 3 });
knownPage.requestedAnchor = 2;
knownPage.captureMeasurementAfterLayout();
assert.equal(knownPage.committed, true);
assert.deepEqual(knownPage.pendingPageFragments.map(fragment => fragment.text), ['a'],
  'the known local end stops admission before spare space can absorb another line');
assert.equal(knownPage.pendingPageEndScalar, 3,
  'local page facts take precedence over the older canonical page ending at 4');
assert.deepEqual(knownPage.measuredIds, ['aaa'], 'known-page replay never shapes an unneeded suffix');

const requestInsideLine = owner([]);
requestInsideLine.paginationDraft = new ReadingPaginationPrefix(paginationKey,
  { requestScalar: 101, startScalar: 100, endScalarExclusive: 110 });
requestInsideLine.requestedAnchor = 101;
assert.equal(requestInsideLine.measuredPageEndLimit(), 110, 'the original interior request retains its page end');
requestInsideLine.requestedAnchor = 100;
assert.equal(requestInsideLine.measuredPageEndLimit(), 110, 'revisiting the actual line start retains that same end');
requestInsideLine.requestedAnchor = 105;
assert.equal(requestInsideLine.measuredPageEndLimit(), undefined, 'an arbitrary interior jump is a new page request');
requestInsideLine.requestedAnchor = 100;
requestInsideLine.measurementPaginationKey = () => ({ ...paginationKey, contentVersion: 'body-v2' });
assert.equal(requestInsideLine.measuredPageEndLimit(), undefined, 'a changed document cannot reuse old page bounds');
requestInsideLine.measurementPaginationKey = () => ({ ...paginationKey, layoutSignature: 'font24-width100' });
assert.equal(requestInsideLine.measuredPageEndLimit(), undefined, 'a changed layout cannot reuse old page bounds');

const canonicalPage = owner([]);
canonicalPage.paginationIndex.recordChapter({ key: paginationKey, contentScalarLength: 6, pageStartScalars: [0, 2, 4] });
canonicalPage.requestedAnchor = 2;
assert.equal(canonicalPage.measuredPageEndLimit(), 4, 'an exact canonical start can reuse its measured end');
canonicalPage.requestedAnchor = 3;
assert.equal(canonicalPage.measuredPageEndLimit(), undefined,
  'a containing canonical page cannot truncate a newly restored local page');
console.log('PASS production known-page bounds: local precedence, exact rematerialization and stale-scope rejection');

const Title = productionMotionMethods(source, ['captureChapterTitleMeasurementAfterLayout'], {
 ...style, TYPE_READER_CHAPTER_TITLE:{fontFamily:'system',fontWeight:500,fontSizeFp:24},TextAlign:{Center:'center'},
 ReaderNativeTextWindow:Window,readerNativeParagraphKey:()=>String(++serial),readerNativeParagraphHeight:nativeHeight,
});
{
 let takes=0,sets=0;
 const manager={getLineCount:()=>2,getLineMetrics:i=>({startIndex:i,endIndex:i+1,topHeight:i*20,height:20}),
  getRectsForRange:()=>[{rect:{top:0,bottom:45}}]};
 const title=Object.assign(new Title(),{measurementIncludesChapterTitle:()=>true,
  chapterTitleMeasurementController:{getLayoutManager:()=>manager},getUIContext:()=>({px2vp:v=>v,vp2px:v=>v}),
  measurementTextWidth:()=>300,readingLayout:()=>({titleLineHeightFp:20}),appearanceSnapshot:{activeTheme:'paper'},
  requireMeasurementChapter:()=>({chapterTitle:'标题'}),nativeTextMeasurement:{take(){takes++;return {};}},
  nativeParagraphResources:{set(){sets++;}},fail:e=>{throw e;}});
 assert.equal(title.captureChapterTitleMeasurementAfterLayout(1),true);
 assert.equal(title.measuredNativeTitle.text,'标题');
 assert.equal(title.measuredNativeTitle.lastLine,1);
 assert.equal(title.measuredChapterTitleHeightVp,nativeHeight(manager,0,1));
 assert.equal(title.captureChapterTitleMeasurementAfterLayout(1),true);
 assert.equal(takes,1);assert.equal(sets,1,'title ownership transfers once across body batches');
}
console.log('PASS production title transfer: same geometry and one retained native layout across body batches');
