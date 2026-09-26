import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';

const read = name => readFileSync(new URL(`../entry/src/main/ets/features/reading/${name}.ets`, import.meta.url), 'utf8');
const stageSource = read('ReaderPageTurnStage');
const wholeSurface = read('ReadingSurface');
const surfaceSource = wholeSurface.slice(wholeSurface.lastIndexOf('@Component', wholeSurface.indexOf('export struct ReadingSurface')));
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const require = createRequire(import.meta.url);
const syntax = require(`${sdk}/lib/validate_ui_syntax.js`);
const ts = require(`${sdk}/node_modules/typescript`);
for (const [name, source] of [['ReaderPageTurnSurface', stageSource], ['ReadingSurface', wholeSurface], ['ReaderNativeParagraphView', read('ReaderNativeParagraphView')],
  ['ReaderPageChrome', read('ReaderPageChrome')], ['ReaderReadingTextFragment', wholeSurface], ['ReaderPaperBackground', read('ReaderPaperBackground')]]) {
  syntax.componentCollection.customComponents.add(name);
  syntax.propCollection.set(name, new Set([...source.matchAll(/@Prop(?:\s+@\w+(?:\([^)]*\))?)*\s+(\w+)\s*:/g)].map(match => match[1])));
}
class Child { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
const layout = { widthClass: 'compact', contentTop: 72, contentRight: 32, contentBottom: 48, contentLeft: 32,
  titleLineHeightFp: 32, titleToBodySpacingVp: 18 };
const measuredHeights = new Map();
const nativeOwnerJs = ts.transpileModule(read('ReaderNativeParagraph').replace(/^import.*$/gm, '').replace(/^export /gm, ''),
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const { NativeResource, NativeController } = new Function('NodeController', 'ReaderNativeTextMeasurement', nativeOwnerJs +
  ';return {NativeResource: ReaderNativeParagraphResource, NativeController: ReaderNativeParagraphController};')(
  class { rebuild() {} }, class { measure() { assert.fail('an available measured title must not be reshaped'); } clear() {} });
function measuredHeight(recipe) {
  const resource = new NativeResource({ matchesGeometry: () => true, selection() {}, close() {},
    configure: (first, last, gap) => assert.deepEqual([first, last, gap], [recipe.firstLine, recipe.lastLine, 0]),
    clipHeightVp: () => measuredHeights.get(recipe.key) });
  const controller = new NativeController();
  controller.prepare({}, recipe, 0, resource);
  const height = controller.heightVp();
  controller.close(); resource.release();
  return height;
}
function title(key, lines = 1) {
  // Instrumented native facts deliberately differ from lineHeight * count.
  measuredHeights.set(key, [0, 35.25, 68.5, 101.75][lines]);
  return { key, text: key, startScalar: 0, firstLine: 0, lastLine: lines - 1,
    style: { widthVp: 300, fontFamily: 'ReaderNotoSansSC', fontSize: 24, lineHeight: 32, alignment: 'center', breakAll: true } };
}
function fragments(recipe, bodyKey = 'body') {
  return [{ id: bodyKey, text: '正文', startScalar: 0, endScalar: 2, imageHeight: 0,
    nativeTitle: recipe, nativeParagraphFirst: true,
    nativeParagraph: { ...title(bodyKey), text: '正文' } }];
}
function slot(provider, revision = 1, params = {}) {
  const owner = createReaderBuilderProbe(stageSource, ['build'], { ReadingSurface: Child,
    COVER_OCCLUSION_RADIUS_VP: 16, COVER_OCCLUSION_OFFSET_X_VP: 6 }).owner;
  Object.assign(owner, { chapterTitle: 'fallback title', showChapterTitle: true, pageFragments: [],
    pageFragmentsProvider: provider, renderRevision: revision, layout, appearance: { activeTheme: 'paper', paragraphSpacing: 16 },
    staticSnapshotId: '', slotIdentity: 'slot-a', pageIdentity: 'page', shadowColor: () => '#00000000', ...params });
  owner.initialRender();
  const forwarded = [...owner.children.values()][0].params;
  assert.equal(forwarded.pageFragments, undefined, 'real page slot intentionally forwards a provider, not a copied array');
  return { owner, params: forwarded };
}
function surface(params, source = surfaceSource) {
  const owner = createReaderBuilderProbe(source, ['build', 'renderFragments', 'contentInsets', 'usesHighlightCanvas', 'dynamicHighlightBlend'], {
    ReaderPageChrome: Child, ReaderNativeParagraphView: Child, ReaderReadingTextFragment: Child, ReaderPaperBackground: Child,
    TYPE_READER_CHAPTER_TITLE: { fontFamily: 'ReaderNotoSansSC', fontWeight: 500, fontSizeFp: 24 },
    WordBreak: { BREAK_ALL: 'breakAll' }, GradientDirection: { Bottom: 'bottom' },
    Canvas: new Proxy({ name: 'Canvas' }, { get: (target, key) => key === 'name' ? target.name : () => {} }),
    BlendMode: { SRC_OVER: 'over', MULTIPLY: 'multiply' }, BlendApplyType: { FAST: 'fast' } }).owner;
  Object.assign(owner, { contentRevision: 1, pageFragments: [], pageParagraphs: [], showChapterTitle: true,
    chapterTitle: 'fallback title', layout, appearance: { activeTheme: 'paper', paragraphSpacing: 16 },
    bottomJustifyGap: 0, staticSnapshotId: '', themeStyle: () => ({ ink: '#222222', sourcePaperLighting: false, paperTexture: false }),
    ...params });
  owner.initialRender();
  return owner;
}
function assertMeasuredTitle(owner, expected) {
  const recipes = [...owner.children.values()].filter(child => child.params.recipe !== undefined).map(child => child.params.recipe);
  assert.equal(recipes[0], expected, 'first emitted title must be the exact recipe that reserved body space');
  assert.equal(recipes[1]?.text, '正文', 'body follows that same fragment owner');
  assert.equal([...owner.nodes.values()].filter(node => node.type === 'Text' && node.create === 'fallback title').length, 0,
    'measured paged title cannot fall back to an independently laid-out Text');
  const content = [...owner.nodes.values()].find(node => node.type === 'Column' && node.create?.space === layout.titleToBodySpacingVp);
  assert.deepEqual(content.padding, { top: 72, right: 32, bottom: 48, left: 32 });
  // The production native controller consumes the retained measured height;
  // this is an instrumented resource boundary, not a native pixel sample.
  return content.padding.top + measuredHeight(expected) + content.create.space;
}

// Actual slot -> actual ReadingSurface Builder. Title and body are read from
// one live owner on cold first publication and retained warm updates.
const first = title('chapter A', 2);
let current = fragments(first);
const live = slot(() => current);
const shown = surface(live.params);
const firstOrigin = assertMeasuredTitle(shown, first);
shown.replay();
assert.equal(assertMeasuredTitle(shown, first), firstOrigin, 'stable replay cannot change the declared title/body origin');
const second = title('chapter B', 3);
current = fragments(second); live.owner.renderRevision = 2; live.owner.replay();
Object.assign(shown, [...live.owner.children.values()][0].params); shown.replay();
const secondOrigin = assertMeasuredTitle(shown, second);
shown.replay();
assert.equal(assertMeasuredTitle(shown, second), secondOrigin, 'warm next-chapter recipe remains stable after first update');
assert.deepEqual([firstOrigin, secondOrigin], [158.5, 191.75]);

// A prepared next-chapter first page already occupies physical slot b during
// the turn. Exercise production role selection and both actual SDK component
// call boundaries when the same resident slot is promoted to current.
const StageMethods = productionMotionMethods(new URL('../entry/src/main/ets/features/reading/ReaderPageTurnStage.ets', import.meta.url),
  ['slotPage', 'refreshRenderPages', 'currentRenderPage', 'adjacentRenderPage']);
const stageOnly = stageSource.slice(stageSource.lastIndexOf('@Component', stageSource.indexOf('export struct ReaderPageTurnStage')));
const stage = createReaderBuilderProbe(stageOnly, ['build'], { ReaderPageTurnSurface: Child }).owner;
let currentPage = { identity: 'origin', renderRevision: 10, fragments: [], showChapterTitle: false };
const preparedFragments = fragments(title('prepared next chapter', 2));
let nextPage = { identity: 'prepared-next', renderRevision: 10, fragments: preparedFragments,
  chapterTitle: 'prepared next chapter', showChapterTitle: true };
Object.assign(stage, { contentRevision: 10, renderPagesRevision: -1, currentPageSlot: 'a', turnDirection: 'next',
  currentPageProvider: () => currentPage, previousPageProvider: () => undefined, nextPageProvider: () => nextPage,
  emptyPage: { fragments: [] }, layout, appearance: { activeTheme: 'paper', paragraphSpacing: 16 },
  slotIdentity: value => value, slotSnapshotId: () => '', slotX: () => 0, slotLayer: () => 0,
  slotVisible: () => true, slotShadow: () => 0, hasActiveTurn: () => true, hasLiveTurnWidth: () => true });
for (const name of ['slotPage', 'refreshRenderPages', 'currentRenderPage', 'adjacentRenderPage']) stage[name] = StageMethods.prototype[name];
stage.initialRender();
const resident = [...stage.children.values()].find(child => child.params.slotIdentity === 'b');
const promotedSlot = slot(resident.params.pageFragmentsProvider, resident.params.renderRevision, resident.params);
const promotedSurface = surface(promotedSlot.params);
const preparedOrigin = assertMeasuredTitle(promotedSurface, preparedFragments[0].nativeTitle);
const residentId = resident.id;
currentPage = { ...nextPage, identity: 'current-next', renderRevision: 11 };
nextPage = undefined;
stage.currentPageSlot = 'b'; stage.turnDirection = undefined; stage.contentRevision = 11; stage.replay();
assert.equal(stage.children.get(residentId), resident, 'logical promotion keeps the resident physical slot');
assert.equal(resident.params.showChapterTitle, true, 'the prepared first page never loses its title during promotion');
assert.equal(resident.params.pageFragmentsProvider(), preparedFragments, 'promotion keeps the exact prepared fragment owner');
Object.assign(promotedSlot.owner, resident.params); promotedSlot.owner.replay();
Object.assign(promotedSurface, [...promotedSlot.owner.children.values()][0].params); promotedSurface.replay();
assert.equal(assertMeasuredTitle(promotedSurface, preparedFragments[0].nativeTitle), preparedOrigin,
  'resident prepared and promoted current declare the same title/body origin');
promotedSurface.replay();
assert.equal(assertMeasuredTitle(promotedSurface, preparedFragments[0].nativeTitle), preparedOrigin);

// Compile the production offscreen Builder body through the same SDK method
// transform. The wrapper supplies only a component owner for the probe.
const textureSource = read('BookTurnTextureBuilder');
const textureMethod = textureSource.slice(textureSource.indexOf('@Builder\nexport function BookTurnTextureBuilder'))
  .replace('export function BookTurnTextureBuilder', 'private texture');
const texture = createReaderBuilderProbe(`@Component struct TextureProbe {\n${textureMethod}\nbuild() { Column() {} }\n}`,
  ['texture'], { ReadingSurface: Child }).owner;
texture.texture({ page: currentPage, layout, viewportWidth: 364, viewportHeight: 780,
  appearance: { activeTheme: 'paper', paragraphSpacing: 16 }, fragmentsProvider: () => preparedFragments });
const textureParams = [...texture.children.values()][0].params;
assert.equal(textureParams.snapshotSynchronousImages, true);
assert.equal(textureParams.pageFragments, preparedFragments);
const textureSurface = surface(textureParams);
assert.equal(assertMeasuredTitle(textureSurface, preparedFragments[0].nativeTitle), preparedOrigin,
  'simulation destination texture and promoted live slot use the same measured title/body origin');
textureSurface.replay();
assert.equal(assertMeasuredTitle(textureSurface, preparedFragments[0].nativeTitle), preparedOrigin);
const oldTitleReads = surfaceSource.replaceAll('this.renderFragments()[0]', 'this.pageFragments[0]');
assert.notEqual(oldTitleReads, surfaceSource);
const oldLive = surface([...promotedSlot.owner.children.values()][0].params, oldTitleReads);
assert.throws(() => assertMeasuredTitle(oldLive, preparedFragments[0].nativeTitle), /exact recipe/,
  'restoring only the old two reads reproduces the live-title mismatch');
const oldTexture = surface(textureParams, oldTitleReads);
assert.equal(assertMeasuredTitle(oldTexture, preparedFragments[0].nativeTitle), preparedOrigin,
  'the same old code already used the measured title in the simulation texture because its array was populated');

const legacy = title('legacy array');
assertMeasuredTitle(surface({ pageFragments: fragments(legacy), fragmentsProvider: undefined }), legacy);
const stale = title('stale copied array');
const authoritative = surface({ pageFragments: fragments(stale), fragmentsProvider: () => current });
assertMeasuredTitle(authoritative, second);
const empty = surface({ pageFragments: fragments(stale), fragmentsProvider: () => [], pageParagraphs: [] });
assert.equal([...empty.children.values()].filter(child => child.params.recipe !== undefined).length, 0,
  'empty live owner must never resurrect the copied title or body');
const laterPage = surface({ showChapterTitle: false, fragmentsProvider: () => current });
assert.deepEqual([...laterPage.children.values()].filter(child => child.params.recipe !== undefined).map(child => child.params.recipe.key), ['body'],
  'non-first pages still omit the semantic chapter title');
console.log('PASS actual SDK stage/slot/texture -> ReadingSurface and native resource owner: measured title/body origin stable through resident promotion, warm update, old-live/texture negative control, legacy array, empty owner and non-first page');
