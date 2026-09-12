import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const stage = readFileSync(
  new URL('../entry/src/main/ets/features/reading/ReaderPageTurnStage.ets', import.meta.url),
  'utf8',
);
const settings = readFileSync(
  new URL('../entry/src/main/ets/features/reading/ReaderSettingsState.ts', import.meta.url),
  'utf8',
);
const experience = readFileSync(
  new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url),
  'utf8',
);
const textureBuilder = readFileSync(
  new URL('../entry/src/main/ets/features/reading/BookTurnTextureBuilder.ets', import.meta.url),
  'utf8',
);

assert.match(stage, /export class ReaderPageTurnRenderPage/);
for (const field of [
  'identity', 'textureIdentity', 'renderRevision', 'chapterTitle', 'showChapterTitle', 'fragments', 'bottomJustifyGap',
  'chromeTopStartText', 'chromeTopEndText', 'chromeBottomStartText', 'chromeBottomEndText',
  'chromeSessionVisible', 'chromeSessionWidth', 'chromeSessionHeight',
]) {
  assert.match(stage, new RegExp(`\\b${field}:`), `render page must expose ${field}`);
}
assert.match(stage, /fragments: ReadingSurfacePageFragment\[\]/);
assert.match(stage, /export struct ReaderPageTurnStage/);
assert.match(settings, /pageTransition: 'slide'/,
  'Reader Settings must retain slide as the product default');
assert.match(stage,
  /@Prop pageTurnStyle: ReaderPageTurnStyle = readerPageTurnStyle\(createDefaultReaderSettingsSnapshot\(\)\);/,
  'the presentation stage must not introduce a second page-turn default');
assert.match(experience,
  /ReaderPageTurnStage\(\{[\s\S]*currentPageProvider: \(\): ReaderPageTurnRenderPage => this\.currentPageTurnRenderPage\(\),[\s\S]*previousPageProvider: \(\): ReaderPageTurnRenderPage \| undefined => this\.preparedPageTurnRenderPage\('previous'\),[\s\S]*nextPageProvider: \(\): ReaderPageTurnRenderPage \| undefined => this\.preparedPageTurnRenderPage\('next'\),[\s\S]*pageTurnStyle: this\.effectivePageTurnStyle\(\),[\s\S]*turnDirection: this\.pageTurnDirection,[\s\S]*offsetX: this\.pageTurnOffsetX,[\s\S]*viewportWidth: this\.pageTurnStageViewportWidth\(\),[\s\S]*layout: this\.readingLayout\(\),[\s\S]*appearance: this\.appearanceSnapshot/,
  'LocalReadingExperience must connect prepared pages and live geometry to the stage');
assert.match(experience,
  /const origin = this\.pageTurnPreparation\?\.origin;[\s\S]*?const chapterIndex = origin\?\.chapter\.chapterIndex \?\? this\.chapter\?\.chapterIndex \?\? -1;/,
  'current-page identity must stay bound to the visible origin during cross-chapter preparation');

for (const prop of [
  'contentRevision', 'currentPageSnapshotId', 'pageTurnStyle', 'turnDirection', 'offsetX',
  'viewportWidth', 'translateY', 'layout', 'appearance', 'ttsHighlightStart', 'ttsHighlightEnd',
  'longPressSelectText',
]) {
  assert.match(stage, new RegExp(`@Prop(?:\\s+@\\w+\\([^)]*\\))?\\s+${prop}:`),
    `stage must receive ${prop} from its owner`);
}
assert.match(stage,
  /return \(this\.pageTurnStyle === 'slide' \|\| this\.pageTurnStyle === 'cover'\) &&\s*Number\.isFinite\(this\.viewportWidth\) && this\.viewportWidth > 0;/,
  'only the retained two-page modes may enter adjacent-page rendering');
// Every mode/role lives in the same two physical component call sites.
const build = stage.slice(stage.indexOf('  build() {', stage.indexOf('export struct ReaderPageTurnStage')), stage.indexOf('  private slotPage('));
assert.equal((build.match(/ReaderPageTurnSurface\(\{/g) ?? []).length, 2);
assert.doesNotMatch(build, /\bif\s*\(|\bForEach\s*\(/, 'input/role changes must not select a different component branch');
assert.match(stage, /\.opacity\(this\.pageVisible \? 1 : 0\)/);
assert.match(stage, /\.enabled\(this\.pageVisible\)/, 'retained hidden page must not intercept input');
assert.doesNotMatch(stage, /^\s*@Builder\b/m, 'complex page data must go directly to component props');
assert.match(textureBuilder, /@Builder\s+export function BookTurnTextureBuilder/);
assert.doesNotMatch(textureBuilder, /ttsHighlight|autoPageHighlight/);
assert.match(stage, /\.renderGroup\(this\.compositorIsolation\)/);
assert.match(stage, /offsetX: COVER_OCCLUSION_OFFSET_X_VP \* this\.shadowStrength/);
assert.doesNotMatch(stage, /PanGesture|TapGesture|SwipeGesture|\.gesture\(|animateTo|onTurn|requestPageTurn/);

// Execute production placement helpers across actual slot-role changes.
const methods = ['slotPage', 'refreshRenderPages', 'currentRenderPage', 'adjacentRenderPage', 'slotIdentity', 'slotSnapshotId', 'slotPresented', 'hasActiveTurn', 'slotVisible',
  'slotX', 'slotLayer', 'slotShadow', 'hasLiveTurnWidth', 'previousPageX', 'nextPageX',
  'turnProgress', 'coverOcclusionStrength'].map(name => {
  const start = stage.indexOf(`  private ${name}(`);
  const end = stage.indexOf('\n  private ', start + 10);
  return stage.slice(start, end < 0 ? stage.lastIndexOf('\n}') : end);
});
const { stripTypeScriptTypes } = await import('node:module');
const Subject = new Function('READER_PAGE_TURN_SLOT_A', 'READER_PAGE_TURN_SLOT_B',
  stripTypeScriptTypes(`class Subject {${methods.join('\n')}}`, { mode: 'strip' }) + '\nreturn Subject;')('reader-page-slot-a','reader-page-slot-b');
const origin = { identity: 'origin', renderRevision: 1 }, next = { identity: 'next', renderRevision: 1 }, previous = { identity: 'previous', renderRevision: 1 };
const x = Object.assign(new Subject(), { currentPage: origin, currentPageSlot: 'a', nextPage: next,
  previousPage: previous, viewportWidth: 400, offsetX: 0, pageTurnStyle: 'slide', emptyPage: { fragments: [] } });
Object.assign(x, { contentRevision: 1, currentPageProvider: () => x.currentPage, previousPageProvider: () => x.previousPage, nextPageProvider: () => x.nextPage });
assert.equal(x.slotVisible('a'), true); assert.equal(x.slotVisible('b'), false);
for (const currentSlot of ['a', 'b']) {
  x.currentPageSlot = currentSlot;
  const adjacentSlot = currentSlot === 'a' ? 'b' : 'a';
  for (const mode of ['slide', 'cover']) {
    x.pageTurnStyle = mode;
    x.turnDirection = 'next'; x.offsetX = -120;
    assert.equal(x.slotPage(currentSlot), origin);
    assert.equal(x.slotPage(adjacentSlot), next);
    assert.equal(x.slotX(currentSlot), -120);
    assert.equal(x.slotX(adjacentSlot), mode === 'slide' ? 280 : 0);
    assert.ok(x.slotLayer(currentSlot) > x.slotLayer(adjacentSlot));
    x.turnDirection = 'previous'; x.offsetX = 120;
    assert.equal(x.slotX(currentSlot), mode === 'slide' ? 120 : 0);
    assert.equal(x.slotX(adjacentSlot), -280);
    assert.equal(x.slotLayer(adjacentSlot) > x.slotLayer(currentSlot), mode === 'cover');
    assert.equal(x.slotIdentity('a'), 'reader-page-slot-a');
    assert.equal(x.slotIdentity('b'), 'reader-page-slot-b');
  }
}
x.pageTurnStyle = 'slide'; x.currentPageSlot = 'b'; x.currentPage = next;
x.turnDirection = undefined; x.previousPage = origin; x.nextPage = undefined; x.contentRevision++;
// The outgoing page already owns slot a at the promotion boundary.
x.slotPageA = origin;
assert.equal(x.slotPage('b'), next); assert.equal(x.slotPage('a'), origin);
assert.equal(x.slotX('b'), 0); assert.equal(x.slotVisible('a'), false);
x.pageTurnStyle = 'simulation'; x.currentPageSnapshotId = 'native-current';
assert.equal(x.slotIdentity('b'), 'reader-page-slot-b', 'snapshot identity belongs to inner static content, never the physical slot');
assert.equal(x.slotPage('a'), origin, 'simulation keeps already-bound outgoing text hidden instead of clearing and rebuilding it');
let presented = 0; x.onCurrentPagePresented = () => presented++;
x.slotPresented('a', 1); x.slotPresented('b', 0); assert.equal(presented, 0);
x.slotPresented('b', 1); assert.equal(presented, 1);
assert.doesNotMatch(stage, /@Prop (?:currentPage|previousPage|nextPage):/, 'gesture updates must not deep-copy whole page projections');
assert.doesNotMatch(build, /pageFragments:/, 'slot content is invalidated by revision, not array copying per MOVE');
console.log('reader page-turn stable slot geometry and role transition: PASS');

// Idle prefetch completion must not evict the outgoing page from its slot.
x.pageTurnStyle = 'slide'; x.nextPage = { identity: 'third', renderRevision: 2 }; x.contentRevision++;
assert.equal(x.slotPage('a'), origin, 'idle reserve retains the outgoing page for immediate reversal');
let providerReads = 0;
x.currentPageProvider = () => { providerReads++; return next; };
x.previousPageProvider = () => { providerReads++; return origin; };
x.nextPageProvider = () => { providerReads++; return x.nextPage; };
x.contentRevision++;
for (let frame = 0; frame < 100; frame++) {
  x.currentRenderPage(); x.adjacentRenderPage('next'); x.adjacentRenderPage('previous');
}
assert.equal(providerReads, 3, 'one projection read per role/revision, independent of geometry expression count');

// Snapshot lookup stays bound to a physical subtree through both promotions.
x.currentPageSnapshotId = 'native-current';
for (const role of ['a', 'b', 'a', 'b']) {
  x.currentPageSlot = role;
  assert.equal(x.slotSnapshotId('a'), 'native-current-a');
  assert.equal(x.slotSnapshotId('b'), 'native-current-b');
  assert.notEqual(x.slotSnapshotId(role), x.slotSnapshotId(role === 'a' ? 'b' : 'a'));
}
x.currentPageSnapshotId = '';
assert.equal(x.slotSnapshotId('a'), ''); assert.equal(x.slotSnapshotId('b'), '');

// Both non-flat modes retain only pages that actually occupied a slot. A cold
// reserve cannot invoke speculative providers; promotion must publish the new
// current revision rather than acknowledge the hidden outgoing revision.
for (const mode of ['simulation', 'none']) {
  const y = Object.assign(new Subject(), {
    pageTurnStyle: mode, viewportWidth: 400, currentPageSlot: 'a', emptyPage: {},
    contentRevision: 1, currentPageProvider: () => origin,
    previousPageProvider: () => undefined, nextPageProvider: () => next,
  });
  assert.equal(y.slotPage('b'), y.emptyPage);
  assert.equal(y.renderPagesRevision, undefined, 'cold reserve does not request page projections');
  assert.equal(y.slotPage('a'), origin);
  y.currentPageSlot = 'b'; y.contentRevision = 2;
  const promoted = { identity: 'next-revised', renderRevision: 2 };
  y.currentPageProvider = () => promoted;
  assert.equal(y.slotPage('b'), promoted);
  assert.equal(y.slotPage('a'), origin);
  assert.equal(y.slotVisible('a'), false);
  assert.equal(y.slotVisible('b'), true);
  const acknowledgements = [];
  y.onCurrentPagePresented = revision => acknowledgements.push(revision);
  y.slotPresented('a', 1); y.slotPresented('b', 1); y.slotPresented('b', 2);
  assert.deepEqual(acknowledgements, [2]);
}
