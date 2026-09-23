import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { motionSegment } from '../entry/src/main/ets/features/common/MotionTimeline.ts';
import { readerAppearanceCubicBezierProgress as bezier } from '../entry/src/main/ets/features/reading/ReaderAppearanceMotionGeometry.ts';

// Execute the real SDK-emitted Builder callbacks and production sample methods.
// This checks composition inputs and retained node identity, not native pixels.
const read = name => readFileSync(new URL(`../entry/src/main/ets/features/${name}`, import.meta.url), 'utf8');
const source = read('bookshelf/BookshelfPage.ets');
const noCoverSource = read('bookshelf/NoCoverCover.ets');
const motionSource = read('common/MotionSpec.ets');
const tokensSource = read('common/ReaderTokens.ets');
const require = createRequire(import.meta.url);
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts = require(`${sdk}/node_modules/typescript`);
const options = require(`${sdk}/lib/ets_checker.js`).compilerOptions;
const syntax = require(`${sdk}/lib/validate_ui_syntax.js`);
const parse = text => ts.createSourceFile('/tmp/BookshelfHandoffProbe.ets', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
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
  { curves, Curve: { Linear: 'linear', EaseOut: 'ease-out' } });
const tokens = constants(tokensSource, ['TOK_SPACE_XS', 'TOK_SPACE_CONTROL_INLINE']);
const geometry = constants(source, ['PHONE_BOOK_WIDTH', 'PHONE_BOOK_HEIGHT_RATIO', 'TABLET_BOOK_WIDTH',
  'TABLET_BOOK_HEIGHT_RATIO', 'PHONE_LIST_COVER_WIDTH', 'PHONE_LIST_COVER_HEIGHT', 'TABLET_LIST_COVER_WIDTH', 'TABLET_LIST_COVER_HEIGHT']);
const motionTree = parse(motionSource);
const delay = motionTree.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === 'bookshelfViewCoverDelayMs');
assert.ok(delay);
const bookshelfViewCoverDelayMs = new Function('BOOKSHELF_VIEW_MOTION',
  `${stripTypeScriptTypes(delay.getText(motionTree)).replace(/^export /, '')}; return bookshelfViewCoverDelayMs;`)(motion);
for (const [name, props] of [['NoCoverCover', ['coverWidth', 'coverHeight']], ['ShelfBookListDetails', ['book']]]) {
  syntax.componentCollection.customComponents.add(name);
  syntax.propCollection.set(name, new Set(props));
}
class Child { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
const methods = ['sampleViewSwitch', 'resetViewSwitchMotion', 'setRestingProjectionOpacity',
  'projectionListProgress', 'projectionRowHeight', 'projectionBookWidth', 'projectionBookHeight',
  'projectionBookTranslateX', 'projectionBookTranslateY', 'projectionCoverScale', 'projectionCoverRadius',
  'projectionCoverCompensationX', 'projectionCoverCompensationY', 'projectionListDetailsWidth',
  'projectionCoverLayerOpacity', 'gridBookCardHeight', 'listCoverWidth', 'listCoverHeight',
  'shelfBookCardWidth', 'bookCardWidth', 'bookCardHeight', 'bookRowSpace', 'hasCover',
  'projectionBookCover', 'projectionBookCoverLayer', 'projectionListDetails'];
function fixture(text = source) {
  const { owner } = createReaderBuilderProbe(text, methods, { ...tokens, ...geometry,
    motionSegment, bookshelfViewCoverDelayMs, NoCoverCover: Child, ShelfBookListDetails: Child,
    ImageFit: { Cover: 'cover' } });
  Object.assign(owner, { viewMotion: motion, viewContentCurve: curves.cubicBezierCurve(.4, 0, .2, 1),
    viewFadeCurve: curves.cubicBezierCurve(0, 0, .58, 1), viewMoveCurve: curves.cubicBezierCurve(.2, 0, 0, 1),
    viewScaleCurve: curves.cubicBezierCurve(.25, .1, 0, 1), appThemeScheme: 'day', reduceMotion: false,
    viewSwitchToken: 0, shelfContentWidth: tablet => tablet ? 650 : 326 });
  return owner;
}
function sample(owner, from, to, time) {
  Object.assign(owner, { viewSwitchSourceMode: from, viewSwitchDestinationMode: to,
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
verifyHandoff(actual, 'cover', 'list', 690, 820);
verifyHandoff(actual, 'list', 'cover', 150, 180);

// The final sampled geometry and visible opacity must be exactly the resting
// frame, including every staggered column and the last capped row cadence.
const book = { sourceId: 'local', bookId: 'handoff', title: '封面交接', author: '作者', readProgress: 3245 };
function frame(owner, tablet, index) {
  return { rowHeight: owner.projectionRowHeight([book, book, book], tablet, index - index % 3),
    width: owner.projectionBookWidth(tablet, index), height: owner.projectionBookHeight(book, tablet, index),
    x: owner.projectionBookTranslateX(index % 3, tablet, index), y: owner.projectionBookTranslateY(index % 3, tablet, index),
    scale: owner.projectionCoverScale(tablet, index), radius: owner.projectionCoverRadius(tablet, index),
    compensationX: owner.projectionCoverCompensationX(tablet, index), compensationY: owner.projectionCoverCompensationY(tablet, index),
    detailsWidth: owner.projectionListDetailsWidth(tablet), coverOpacity: coverOpacity(owner),
    headerOpacity: owner.viewSwitchHeaderOpacity, gridOpacity: owner.viewSwitchGridContentOpacity,
    listOpacity: owner.viewSwitchListContentOpacity };
}
for (const [from, to] of [['cover', 'list'], ['list', 'cover']]) {
  for (const tablet of [false, true]) {
    for (let index = 0; index < 12; index += 1) {
      sample(actual, from, to, motion.totalMs);
      const before = frame(actual, tablet, index);
      actual.resetViewSwitchMotion();
      assert.deepEqual(frame(actual, tablet, index), before, `${from}->${to} reset changed the final visible frame`);
    }
  }
}

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
    owner.projectionBookCover(rowBook, false, 5);
    owner.projectionListDetails(rowBook, false);
    verifyGroupedCoverActors(owner);
    const initialBranches = branches.slice();
    const nodeIds = [...owner.nodes.keys()], childIds = [...owner.children.keys()];
    const childProps = [...owner.children.values()].map(child => structuredClone(child.params));
    const covers = [...owner.nodes.values()].filter(node => node.type === 'Image' && node.create === rowBook.coverUrl);
    assert.equal(covers.length, hasImage ? 2 : 0, 'the two cover actors use the same current image');
    const defaultCovers = [...owner.children.values()].filter(child => 'coverWidth' in child.params);
    assert.equal(defaultCovers.length, hasImage ? 0 : 2);
    if (!hasImage) assert.deepEqual(defaultCovers[0].params, defaultCovers[1].params, 'both default-cover actors have identical geometry');
    const imageProps = covers.map(node => ({ id: node.id, source: node.create, width: node.width, height: node.height, fit: node.objectFit }));
    for (const time of [0, 150, 165, 180, 600, 690, 700, 710, 720, 800, 820, 999, motion.totalMs, 'reset']) {
      if (time === 'reset') owner.resetViewSwitchMotion(); else sample(owner, from, to, time);
      branches = [];
      owner.replay();
      verifyGroupedCoverActors(owner);
      assert.deepEqual(branches, initialBranches, 'opacity updates do not replace a conditional cover subtree');
      assert.deepEqual([...owner.nodes.keys()], nodeIds);
      assert.deepEqual([...owner.children.keys()], childIds);
      assert.deepEqual([...owner.children.values()].map(child => structuredClone(child.params)), childProps);
      assert.deepEqual(covers.map(node => ({ id: node.id, source: node.create, width: node.width, height: node.height, fit: node.objectFit })), imageProps);
    }
    for (const id of nodeIds) {
      const groups = owner.attributeCalls.filter(call => call.id === id && call.property === 'renderGroup').map(call => call.args[0]);
      assert.ok(groups.length === 0 || groups.every(value => value === groups[0]), 'renderGroup never changes at animation completion');
    }
  }
}

// Render the real default-cover text body, not a test replica of its labels.
const defaultBuilderSource = noCoverSource.replace('  build() {', '  build() { Column() {} }\n  @Builder\n  coverContent() {');
const { owner: defaultCover } = createReaderBuilderProbe(defaultBuilderSource, ['coverContent', 'ruleWidth', 'labelWidth']);
Object.assign(defaultCover, { coverWidth: geometry.PHONE_BOOK_WIDTH,
  coverHeight: geometry.PHONE_BOOK_WIDTH * geometry.PHONE_BOOK_HEIGHT_RATIO, appThemeScheme: 'day' });
defaultCover.coverContent();
const textActors = [...defaultCover.nodes.values()].filter(node => node.type === 'Text');
assert.deepEqual(textActors.map(node => node.create), ['', '暂无封面', '']);
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
  '1 - motionSegment(t, m.morphCoverIncomingStartMs, m.morphCoverIncomingDurationMs, fade) + incoming;');
assert.notEqual(legacySampler, samplerText, 'counterfactual changes the current cover opacity assignment');
const legacySource = source.slice(0, sampler.getStart(tree)) + legacySampler + source.slice(sampler.end);
const legacy = fixture(legacySource);
assert.throws(() => verifyHandoff(legacy, 'cover', 'list', 690, 820), /cover fades backwards|expose the shelf background/);
assert.throws(() => verifyHandoff(legacy, 'list', 'cover', 150, 180), /cover fades backwards|expose the shelf background/);

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
  sample(ungrouped, 'cover', 'list', 710);
  ungrouped.projectionBookCover(rowBook, false, 5);
  assert.equal(coverOpacity(ungrouped), 1, 'the counterexample deliberately still passes layer-alpha composition');
  assert.throws(() => verifyGroupedCoverActors(ungrouped), /each cover must composite/,
    'the default and image cover both require complete-layer grouping');
}

console.log('PASS bookshelf cover handoff: bidirectional opacity, whole-cover composition, final-frame continuity, retained default/image actors, historical negative controls; native pixels remain separate');
