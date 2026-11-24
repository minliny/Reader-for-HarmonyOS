import { resolveEtsLoaderRoot, virtualFilePath } from './lib/tool-environment.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { motionSegment } from '../entry/src/main/ets/ui/foundation/MotionTimeline.ts';
import { READER_SHELF_REFLOW_MS, READER_SHELF_STAGGER_MS, READER_SHELF_STAGGER_CAP_MS } from '../entry/src/main/ets/ui/foundation/ProductMotionTiming.ts';
import { readerProbeCubicBezierProgress as bezier } from './lib/reader-motion-curve-fixture.mjs';
import { compileIconButtonSpecs } from './lib/reader-icon-button-probe.mjs';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';
import { readerTypographyRoles } from './lib/reader-typography-probe.mjs';
import { readerFoundationTokens } from './lib/reader-tokens-probe.mjs';
import { createDefaultReaderWindowMetrics } from '../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts';
import * as coverVisual from '../entry/src/main/ets/features/bookshelf/ui/BookshelfCoverVisual.ts';
import { ShelfBookPresentation } from '../entry/src/main/ets/features/bookshelf/presentation/ShelfBookPresentation.ts';

// Execute the real SDK-emitted Builder callbacks and production sample methods.
// This checks composition inputs and retained node identity, not native pixels.
const read = name => readFileSync(new URL(`../entry/src/main/ets/${name}`, import.meta.url), 'utf8');
const source = read('features/bookshelf/ui/BookshelfPage.ets');
const noCoverSource = read('ui/patterns/NoCoverCover.ets');
const motionSource = read('ui/foundation/MotionSpec.ets');
const tokensSource = read('ui/foundation/ReaderTokens.ets');
const require = createRequire(import.meta.url);
const sdk = resolveEtsLoaderRoot();
const ts = require(`${sdk}/node_modules/typescript`);
const options = require(`${sdk}/lib/ets_checker.js`).compilerOptions;
const syntax = require(`${sdk}/lib/validate_ui_syntax.js`);
const parse = text => ts.createSourceFile(virtualFilePath('BookshelfHandoffProbe.ets'), text, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
function constants(text, names, dependencies = {}) {
  const tree = parse(text);
  const declarations = tree.statements.filter(ts.isVariableStatement).flatMap(statement =>
    [...statement.declarationList.declarations].filter(declaration => names.includes(declaration.name.getText(tree)))
      .map(declaration => `const ${declaration.getText(tree)};`));
  assert.equal(declarations.length, names.length, 'read the current production constants');
  return new Function(...Object.keys(dependencies), `${stripTypeScriptTypes(declarations.join('\n'))} return { ${names.join(',')} };`)(...Object.values(dependencies));
}
const curves = { cubicBezierCurve: (...points) => ({ interpolate: value => bezier(value, ...points) }) };
const { BOOKSHELF_VIEW_MOTION: motion } = constants(motionSource, ['BOOKSHELF_VIEW_MOTION'],
  { STANDARD_CURVE: curves.cubicBezierCurve(0.2, 0, 0, 1),
    READER_SHELF_REFLOW_MS, READER_SHELF_STAGGER_MS, READER_SHELF_STAGGER_CAP_MS });
const tokens = constants(tokensSource, ['TOK_SPACE_XS', 'TOK_SPACE_CONTROL_INLINE']);
const grid = pureModuleProbe(read('features/bookshelf/ui/BookshelfGridSpec.ets'), 'BookshelfGridSpec.ets',
  { ...readerTypographyRoles, ...readerFoundationTokens, readerFontFamilyReady: () => false },
  ['bookshelfGridFrame', 'bookshelfCoverHeight', 'bookshelfListTextHeight', 'BookshelfListTextBudget',
    'BOOKSHELF_GRID_TEXT_GAP', 'BOOKSHELF_GRID_TITLE_LINES', 'BOOKSHELF_LIST_COLUMN_GAP',
    'BOOKSHELF_LIST_COVER_WIDTH', 'BOOKSHELF_LIST_COVER_HEIGHT', 'bookshelfColumnCount', 'bookshelfListCardWidth']);
const noCover = parse(noCoverSource);
const noCoverGlyphSource = noCover.statements.find(statement => ts.isFunctionDeclaration(statement) &&
  statement.name?.text === 'noCoverGlyph').getText(noCover);
const { noCoverGlyph } = pureModuleProbe(noCoverGlyphSource, 'NoCoverGlyph.ets', {}, ['noCoverGlyph']);
const metrics = createDefaultReaderWindowMetrics();
const motionTree = parse(motionSource);
const delay = motionTree.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === 'bookshelfViewCoverDelayMs');
assert.ok(delay);
const bookshelfViewCoverDelayMs = new Function('BOOKSHELF_VIEW_MOTION',
  `${stripTypeScriptTypes(delay.getText(motionTree)).replace(/^export /, '')}; return bookshelfViewCoverDelayMs;`)(motion);
for (const [name, props] of [['NoCoverCover', ['coverWidth', 'coverHeight']], ['ShelfBookListDetails', ['book', 'textFrame']],
  ['ReaderIconButton', ['specId', 'icon', 'accessibilityLabel', 'focusId']]]) {
  syntax.componentCollection.customComponents.add(name);
  syntax.propCollection.set(name, new Set(props));
}
class Child { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
const childPropsFor = owner => [...owner.children.values()].map(child => {
  const { onTap, ...props } = child.params;
  return structuredClone(props);
});
const methods = ['sampleViewSwitch', 'resetViewSwitchMotion', 'setRestingProjectionOpacity',
  'captureViewSwitchRanks', 'projectionDetailsOpacity', 'projectionListProgress', 'projectionRowHeight',
  'projectionBookWidth', 'projectionBookHeight',
  'projectionBookTranslateX', 'projectionBookTranslateY', 'projectionCoverScale', 'projectionCoverRadius',
  'projectionCoverScaleY',
  'projectionCoverCompensationX', 'projectionCoverCompensationY', 'projectionListDetailsWidth',
  'projectionCoverLayerOpacity', 'gridBookCardHeight', 'gridProgressLabel', 'listCoverWidth', 'listCoverHeight', 'listRowHeight', 'listTextFrame', 'listTextBudget', 'listTextFontRevision',
  'shelfBookCardWidth', 'bookCardWidth', 'bookCardHeight', 'bookRowSpace', 'hasCover',
  'projectionBookCover', 'projectionBookCoverLayer', 'projectionGridDetails', 'projectionListDetails',
  'bookActionFocusKey', 'bookActionPresentationHandler', 'isShelfPresentationCurrent', 'bookCoverMotionId',
  'measureBookOrigin', 'shelfViewportMotionId'];
function fixture(text = source) {
  const properties = createArkUIPropertyRuntimeProbe();
  const { owner } = createReaderBuilderProbe(text, methods, { ...properties.sdk, ...readerFoundationTokens, ...tokens, ...grid, ...coverVisual,
    ReaderWindowCoordinator: { metrics: () => metrics }, resolveReaderIconButtonSpec: compileIconButtonSpecs(),
    motionSegment, bookshelfViewCoverDelayMs, noCoverGlyph, NoCoverCover: Child, ShelfBookListDetails: Child, ReaderIconButton: Child, ShelfBookPresentation,
    ImageFit: { Cover: 'cover' } }, properties.hooks);
  Object.assign(owner, { viewMotion: motion, viewContentCurve: curves.cubicBezierCurve(.4, 0, .2, 1),
    viewFadeCurve: curves.cubicBezierCurve(0, 0, .58, 1), viewMoveCurve: curves.cubicBezierCurve(.2, 0, 0, 1),
    viewScaleCurve: curves.cubicBezierCurve(.25, .1, 0, 1), appThemeScheme: 'day', reduceMotion: false,
    viewSwitchToken: 0, viewSwitchRanks: new Map(Array.from({ length: 9 }, (_, i) => [i, i])),
    mounted: true, navigationGeneration: 1, shelfContentWidth: tablet => tablet ? 650 : 326 });
  return owner;
}
function sample(owner, from, to, time) {
  Object.assign(owner, { viewSwitchSourceMode: from, viewSwitchDestinationMode: to, pendingViewMode: to,
    viewSwitchRunning: true, viewSwitchTimeMs: time });
  owner.sampleViewSwitch();
}
// For coincident opaque cover actors, source-over composition must retain a
// fully opaque cover while ownership fades between them. This is independent
// of the implementation's particular opacity expressions.
function coverOpacity(owner) {
  const destination = owner.projectionCoverLayerOpacity(false), morph = owner.projectionCoverLayerOpacity(true);
  for (const value of [destination, morph]) assert.ok(value >= 0 && value <= 1, 'cover opacity is within 0..1');
  return morph + destination * (1 - morph);
}
function verifyGroupedCoverActors(owner) {
  const actors = [...owner.nodes.values()].filter(node => node.type === 'Stack' && node.linearGradient !== undefined);
  assert.equal(actors.length, 2, 'the actual two gradient cover stacks own the whole-cover composite');
  for (const actor of actors) {
    assert.equal(actor.renderGroup, true, 'each cover must composite its background, text, and image as one group');
    const writes = owner.attributeCalls.filter(call => call.id === actor.id && call.property === 'renderGroup');
    assert.ok(writes.length > 0 && writes.every(call => call.args[0] === true),
      'both cover groups remain enabled throughout the animation and reset');
  }
}
function verifyDetailsInput(owner) {
  const list = [...owner.nodes.values()].find(node => node.type === 'Row' && node.width === owner.projectionListDetailsWidth(false));
  const grid = [...owner.nodes.values()].find(node => node.type === 'Column' && node.translate?.y !== undefined);
  assert.ok(list && grid, 'actual retained grid/list detail parents are mounted');
  assert.equal(list.enabled, owner.viewMode === 'list', 'hidden list disables every descendant, including More');
  assert.equal(grid.enabled, owner.viewMode === 'cover', 'hidden grid disables its retained descendants');
  assert.equal(list.hitTestBehavior, owner.viewMode === 'list' ? 'HitTestMode.Default' : 'HitTestMode.None');
  assert.equal(grid.hitTestBehavior, owner.viewMode === 'cover' ? 'HitTestMode.Default' : 'HitTestMode.None');
}
function verifyHandoff(owner, from, to, start, end) {
  let previous = 1;
  for (let time = start; time <= end; time += 1) {
    sample(owner, from, to, time);
    const opacity = coverOpacity(owner);
    assert.ok(opacity >= previous - 1e-12, `${from}->${to} cover fades backwards at ${time}ms: ${previous} -> ${opacity}`);
    assert.ok(Math.abs(opacity - 1) < 1e-12, `${from}->${to} cover must not expose the shelf background at ${time}ms`);
    previous = opacity;
  }
}
const actual = fixture();
verifyHandoff(actual, 'cover', 'list', motion.movingCoverFadeStartMs, motion.totalMs);
verifyHandoff(actual, 'list', 'cover', motion.morphCoverIncomingStartMs, motion.totalMs);

assert.deepEqual(Array.from({ length: 9 }, (_, i) => bookshelfViewCoverDelayMs(i)),
  [0, 24, 48, 72, 96, 120, 120, 120, 120]);
assert.equal(motion.coverMoveDurationMs + bookshelfViewCoverDelayMs(8), motion.totalMs);
const viewport = fixture();
Object.assign(viewport, { firstVisibleItem: 2, lastVisibleItem: 6, shelfHeaderItems: () => 1,
  rowDataSource: { totalCount: () => 6, getData: row => Array.from({ length: 3 }, (_, col) => row * 3 + col) },
  measureBookOrigin: book => book === 3 ? undefined : {} });
viewport.captureViewSwitchRanks();
assert.deepEqual([...viewport.viewSwitchRanks.keys()], [4, 5, 6, 7, 8, 9, 10, 11, 12]);
sample(viewport, 'cover', 'list', 1);
assert.equal(viewport.projectionListProgress(2), 1, 'offscreen previous row takes final layout immediately');
assert.equal(viewport.projectionListProgress(13), 1, 'covers after the first visible group take final layout immediately');
assert.equal(viewport.projectionListProgress(3, false, true), viewport.projectionListProgress(4),
  'row keeps the same timing when its first cover is clipped');
assert.equal(viewport.projectionListProgress(5), 0, 'second visible cover waits for its stagger');

// Final sampled geometry tolerates finite endpoint interpolation rounding.
// Visible opacity, frame fields and actor identity retain strict comparisons.
function near(actual, expected, message) {
  assert.ok(Number.isFinite(actual) && Number.isFinite(expected), `${message} uses finite geometry`);
  assert.ok(Math.abs(actual - expected) <= 1e-9, `${message}: ${actual} vs ${expected}`);
}
const book = { sourceId: 'local', bookId: 'handoff', title: '封面交接', author: '作者', readProgress: 3245 };
function frame(owner, tablet, index) {
  const columns = grid.bookshelfColumnCount(tablet);
  const column = index % columns;
  return { rowHeight: owner.projectionRowHeight(Array(columns).fill(book), tablet, index - column),
    width: owner.projectionBookWidth(tablet, index), height: owner.projectionBookHeight(book, tablet, index),
    x: owner.projectionBookTranslateX(column, tablet, index), y: owner.projectionBookTranslateY(column, tablet, index),
    scale: owner.projectionCoverScale(tablet, index), scaleY: owner.projectionCoverScaleY(tablet, index),
    radius: owner.projectionCoverRadius(tablet, index),
    compensationX: owner.projectionCoverCompensationX(tablet, index), compensationY: owner.projectionCoverCompensationY(tablet, index),
    detailsWidth: owner.projectionListDetailsWidth(tablet), coverOpacity: coverOpacity(owner),
    headerOpacity: owner.viewSwitchHeaderOpacity, gridOpacity: owner.viewSwitchGridContentOpacity,
    listOpacity: owner.viewSwitchListContentOpacity };
}
for (const [from, to] of [['cover', 'list'], ['list', 'cover']]) {
  for (const scale of [1, 1.3, 1.6, 2]) {
    metrics.systemFontScale = scale;
    for (const tablet of [false, true]) {
      for (let index = 0; index < 12; index += 1) {
        sample(actual, from, to, motion.totalMs);
        const before = frame(actual, tablet, index);
        actual.resetViewSwitchMotion();
        const after = frame(actual, tablet, index);
        assert.deepEqual(Object.keys(after), Object.keys(before), 'reset retains every frame field');
        for (const name of ['rowHeight', 'width', 'height', 'x', 'y', 'scale', 'scaleY', 'radius', 'compensationX', 'compensationY', 'detailsWidth']) {
          near(after[name], before[name], `${from}->${to} reset retains final ${name}`);
        }
        for (const name of ['coverOpacity', 'headerOpacity', 'gridOpacity', 'listOpacity']) {
          assert.equal(after[name], before[name], `${from}->${to} reset retains final ${name}`);
        }
        if (to === 'list') {
          const minimumHeight = grid.bookshelfListTextHeight(scale);
          assert.ok(Number.isFinite(before.height) && Number.isFinite(minimumHeight) && before.height >= minimumHeight - 1e-9,
            'final list card reserves the shared four-line font budget');
          const coverColumns = grid.bookshelfColumnCount(tablet);
          const listColumns = grid.bookshelfColumnCount(tablet, true);
          const rows = coverColumns / listColumns;
          near(before.rowHeight, before.height * rows + tokens.TOK_SPACE_CONTROL_INLINE * (rows - 1), 'final projection row pays every list card and gap');
          near(before.y, Math.floor((index % coverColumns) / listColumns) * (before.height + tokens.TOK_SPACE_CONTROL_INLINE),
            'final projection offset pays the list stride');
          near(before.x, ((index % coverColumns) % listColumns) * (before.width + grid.BOOKSHELF_LIST_COLUMN_GAP),
            'final projection offset pays the list column');
        } else {
          assert.equal(grid.bookshelfColumnCount(tablet), tablet ? 4 : 3);
        }
      }
    }
  }
}

const measured = fixture();
let width = 54, height = 76, viewportWidth = 326;
const currentId = measured.bookCoverMotionId(book,false), viewportId = measured.shelfViewportMotionId();
const node = (x,y) => ({getPositionToWindowWithTransform:()=>({x,y})});
Object.assign(measured,{viewMode:'list',viewSwitchRunning:false,isWideViewport:()=>false,
  continueCardFrame:()=>({coverWidth:56,coverHeight:78}),shelfHeaderClearance:()=>52,shelfContentEndInset:()=>68,
  getUIContext:()=>({getFrameNodeById:id=>id===currentId?node(20,70):id===viewportId?node(0,0):null,
    getComponentUtils:()=>({getRectangleById:id=>id===currentId?{size:{width,height},scale:{x:1,y:1}}:
      {size:{width:viewportWidth,height:700}}}),px2vp:value=>value})});
assert.equal(measured.measureBookOrigin(book,false).radius,6);
assert.equal(measured.measureBookOrigin({...book,sourceId:'different'},false),undefined,'same bookId in another source has no origin');
measured.viewMode='cover';
assert.equal(measured.measureBookOrigin(book,false),undefined,'the old list dimensions cannot fly in the cover projection');
width=grid.bookshelfGridFrame(viewportWidth,false).cardWidth;height=grid.bookshelfCoverHeight(width,false);
assert.equal(measured.measureBookOrigin(book,false).radius,8);
viewportWidth=650;
assert.equal(measured.measureBookOrigin(book,false),undefined,'a sample from the retired viewport shape cannot fly');

// Mount production cover/list builders once, then replay the real observer
// closures. Retain both default-cover children or both native Image nodes
// through the handoff and reset; do not swap a final cover subtree into place.
for (const hasImage of [false, true]) {
  for (const [from, to] of [['cover', 'list'], ['list', 'cover']]) {
    const owner = fixture();
    const rowBook = Object.freeze({ ...book, ...(hasImage ? { coverUrl: 'https://example.test/handoff.jpg' } : {}) });
    let branches = [];
    const updateBranch = owner.ifElseBranchUpdateFunction.bind(owner);
    owner.ifElseBranchUpdateFunction = (branch, builder) => { branches.push(branch); updateBranch(branch, builder); };
    sample(owner, from, to, 0);
    owner.projectionBookCover(rowBook, false, () => 5);
    owner.projectionGridDetails(rowBook, false);
    owner.projectionListDetails(rowBook, false);
    verifyGroupedCoverActors(owner);
    verifyDetailsInput(owner);
    const initialBranches = branches.slice();
    const nodeIds = [...owner.nodes.keys()], childIds = [...owner.children.keys()];
    const childProps = childPropsFor(owner);
    const covers = [...owner.nodes.values()].filter(node => node.type === 'Image' && node.create === rowBook.coverUrl);
    assert.equal(covers.length, hasImage ? 2 : 0, 'the two cover actors use the same current image');
    const defaultCovers = [...owner.children.values()].filter(child => 'coverWidth' in child.params);
    assert.equal(defaultCovers.length, hasImage ? 0 : 2);
    if (!hasImage) assert.deepEqual(defaultCovers[0].params, defaultCovers[1].params, 'both default-cover actors have identical geometry');
    const imageProps = covers.map(node => ({ id: node.id, source: node.create, width: node.width, height: node.height, fit: node.objectFit }));
    for (const time of [0, 12, 24, 60, 120, 180, 200, motion.movingCoverFadeStartMs,
      motion.totalMs - 20, motion.totalMs, 'reset']) {
      if (time === 'reset') owner.resetViewSwitchMotion(); else sample(owner, from, to, time);
      branches = [];
      owner.replay();
      verifyGroupedCoverActors(owner);
      verifyDetailsInput(owner);
      assert.deepEqual(branches, initialBranches, 'opacity updates do not replace a conditional cover subtree');
      assert.deepEqual([...owner.nodes.keys()], nodeIds);
      assert.deepEqual([...owner.children.keys()], childIds);
      assert.deepEqual(childPropsFor(owner), childProps);
      assert.deepEqual(covers.map(node => ({ id: node.id, source: node.create, width: node.width, height: node.height, fit: node.objectFit })), imageProps);
    }
    for (const id of nodeIds) {
      const groups = owner.attributeCalls.filter(call => call.id === id && call.property === 'renderGroup').map(call => call.args[0]);
      assert.ok(groups.length === 0 || groups.every(value => value === groups[0]), 'renderGroup never changes at animation completion');
    }
  }
}

// None excludes the container itself, while its descendants remain eligible
// for native hit testing. Restore the former missing subtree gates in the
// real SDK input and require the emitted-parent contract to reject them.
const ungatedDetailsSource = source
  .replace("    .enabled(this.viewMode === 'cover')\n", '')
  .replace("    .enabled(this.viewMode === 'list')\n", '');
assert.notEqual(ungatedDetailsSource, source);
for (const mode of ['cover', 'list']) {
  const ungated = fixture(ungatedDetailsSource);
  Object.assign(ungated, { viewMode: mode, viewSwitchGridContentOpacity: mode === 'cover' ? 1 : 0,
    viewSwitchListContentOpacity: mode === 'list' ? 1 : 0 });
  ungated.projectionGridDetails(book, false);
  ungated.projectionListDetails(book, false);
  assert.throws(() => verifyDetailsInput(ungated), /hidden list disables|hidden grid disables/,
    'legacy None-only retained details remain input-eligible despite zero opacity');
}

// Render the real default-cover text body, not a test replica of its labels.
const defaultBuilderSource = noCoverSource.replace('  build() {', '  build() { Column() {} }\n  @Builder\n  coverContent() {');
const { owner: defaultCover } = createReaderBuilderProbe(defaultBuilderSource, ['coverContent', 'x', 'y', 'scale'],
  { ...readerTypographyRoles, ...readerFoundationTokens });
const defaultFrame = grid.bookshelfGridFrame(326, false);
Object.assign(defaultCover, { coverWidth: defaultFrame.cardWidth,
  coverHeight: defaultFrame.coverHeight, appThemeScheme: 'day', glyph: '海边旧书店', kindLabel: '小说' });
defaultCover.coverContent();
const textActors = [...defaultCover.nodes.values()].filter(node => node.type === 'Text');
assert.deepEqual(textActors.map(node => node.create), ['海边旧书店', '无封面 · 小说']);
assert.equal(textActors[0].maxLines, 2);
assert.equal(textActors[1].maxLines, 1);
const textFrames = textActors.map(node => structuredClone(node));
for (let index = 0; index < 10; index += 1) defaultCover.replay();
assert.deepEqual(textActors.map(node => structuredClone(node)), textFrames, 'default cover labels/rules retain text and layout inputs');

// Counterfactual: put the historical opacity assignments back into the actual
// sample method only. Both assertions must reject that former implementation.
const tree = parse(source);
const shelf = tree.statements.find(statement => statement.members?.some(member => member.name?.getText(tree) === 'sampleViewSwitch'));
const sampler = shelf.members.find(member => member.name?.getText(tree) === 'sampleViewSwitch');
const samplerText = sampler.getText(tree);
const legacySampler = samplerText.replace(/this\.viewSwitchDestinationCoverOpacity\s*=\s*[^;]+;/g,
  "this.viewSwitchDestinationCoverOpacity = this.viewSwitchDestinationMode === 'list' ? incoming : " +
  '1 - motionSegment(t, m.morphCoverIncomingStartMs, m.morphCoverIncomingDurationMs, fade);');
assert.notEqual(legacySampler, samplerText, 'counterfactual changes the current cover opacity assignment');
const legacySource = source.slice(0, sampler.getStart(tree)) + legacySampler + source.slice(sampler.end);
const legacy = fixture(legacySource);
assert.throws(() => verifyHandoff(legacy, 'list', 'cover', motion.morphCoverIncomingStartMs, motion.totalMs),
  /cover fades backwards|expose the shelf background/);

// Counterfactual: correct layer alpha alone is insufficient when the engine
// blends a cover background and its glyphs separately. Remove only the real
// cover layer's grouping modifier and require the emitted-node check to fail.
const coverLayer = shelf.members.find(member => member.name?.getText(tree) === 'projectionBookCoverLayer');
const groupedText = coverLayer.getText(tree);
const ungroupedText = groupedText.replace(/\.renderGroup\(true\)/g, '');
assert.notEqual(ungroupedText, groupedText, 'counterfactual removes the production whole-cover group');
const ungroupedSource = source.slice(0, coverLayer.getStart(tree)) + ungroupedText + source.slice(coverLayer.end);
for (const hasImage of [false, true]) {
  const ungrouped = fixture(ungroupedSource);
  const rowBook = { ...book, ...(hasImage ? { coverUrl: 'https://example.test/handoff.jpg' } : {}) };
  sample(ungrouped, 'cover', 'list', motion.movingCoverFadeStartMs + 20);
  ungrouped.projectionBookCover(rowBook, false, () => 5);
  assert.equal(coverOpacity(ungrouped), 1, 'the counterexample deliberately still passes layer-alpha composition');
  assert.throws(() => verifyGroupedCoverActors(ungrouped), /each cover must composite/,
    'the default and image cover both require complete-layer grouping');
}

console.log('PASS bookshelf cover handoff: bidirectional opacity, whole-cover composition, final-frame continuity, retained default/image actors, mode-gated descendant input and historical negative controls; native pixels/hit scheduling remain separate');
