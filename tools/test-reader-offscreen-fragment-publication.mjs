import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';

const read = name => readFileSync(new URL(`../entry/src/main/ets/features/reading/${name}.ets`, import.meta.url), 'utf8');
const wholeSurface = read('ReadingSurface');
const surfaceSource = wholeSurface.slice(wholeSurface.lastIndexOf('@Component', wholeSurface.indexOf('export struct ReadingSurface')));
const textureSource = read('BookTurnTextureBuilder');
const textureMethod = textureSource.slice(textureSource.indexOf('@Builder\nexport function BookTurnTextureBuilder'))
  .replace('export function BookTurnTextureBuilder', 'private texture');
const inputClass = textureSource.slice(textureSource.indexOf('export class BookTurnTextureBuildInput'), textureSource.indexOf('/** A bounded offscreen'));
const BookTurnTextureBuildInput = new Function(`${stripTypeScriptTypes(inputClass.replace('export class', 'class'))}; return BookTurnTextureBuildInput;`)();
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const require = createRequire(import.meta.url);
const syntax = require(`${sdk}/lib/validate_ui_syntax.js`);
for (const [name, source] of [['ReadingSurface', wholeSurface], ['ReaderNativeParagraphView', read('ReaderNativeParagraphView')],
  ['ReaderPageChrome', read('ReaderPageChrome')], ['ReaderReadingTextFragment', wholeSurface], ['ReaderPaperBackground', read('ReaderPaperBackground')]]) {
  syntax.componentCollection.customComponents.add(name);
  syntax.propCollection.set(name, new Set([...source.matchAll(/@Prop(?:\s+@\w+(?:\([^)]*\))?)*\s+(\w+)\s*:/g)].map(match => match[1])));
}
class Child { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
const layout = { widthClass: 'compact', contentTop: 72, contentRight: 32, contentBottom: 48, contentLeft: 32,
  titleLineHeightFp: 32, titleToBodySpacingVp: 18 };
const appearance = { activeTheme: 'paper', paragraphSpacing: 16 };
const title = key => ({ key, text: key, firstLine: 0, lastLine: 0, style: { lineHeight: 32 } });
const text = (id, nativeTitle) => ({ id, text: id, nativeTitle, imageHeight: 0, nativeParagraphFirst: true,
  nativeParagraph: { key: id, text: id } });
const image = (id, nativeTitle) => ({ id, text: '', nativeTitle, imageHeight: 80,
  imageWidthBasisPoints: 10000, fileUri: `file:///${id}.png` });
const page = (identity, fragments, extra = {}) => ({ identity, textureIdentity: identity, renderRevision: 7,
  chapterTitle: 'same title', showChapterTitle: true, fragments, bottomJustifyGap: 0, ...extra });

function reactiveSurface(params, source = surfaceSource) {
  const runtime = createArkUIPropertyRuntimeProbe();
  const { owner } = createReaderBuilderProbe(source,
    ['chapterTitle', 'showChapterTitle', 'pageFragments', 'contentRevision', 'fragmentsProvider', 'build',
      'renderFragments', 'contentInsets', 'usesHighlightCanvas', 'dynamicHighlightBlend', 'onHighlightContentChanged'], {
      ...runtime.sdk,
      ReaderPageChrome: Child, ReaderNativeParagraphView: Child, ReaderReadingTextFragment: Child, ReaderPaperBackground: Child,
      TYPE_READER_CHAPTER_TITLE: { fontFamily: 'ReaderNotoSansSC', fontWeight: 500, fontSizeFp: 24 },
      WordBreak: { BREAK_ALL: 'breakAll' }, GradientDirection: { Bottom: 'bottom' },
      Canvas: new Proxy({ name: 'Canvas' }, { get: (target, key) => key === 'name' ? target.name : () => {} }),
      BlendMode: { SRC_OVER: 'over', MULTIPLY: 'multiply' }, BlendApplyType: { FAST: 'fast' },
      ImageFit: { Contain: 'contain' }, ImageInterpolation: { High: 'high' },
    }, { ...runtime.hooks, allowEmptyBranchAdmission: true, initialParams: params });
  Object.assign(owner, { pageParagraphs: [], snapshotSynchronousImages: true, bottomJustifyGap: 0, staticSnapshotId: '',
    layout, appearance, themeStyle: () => ({ ink: '#222', sourcePaperLighting: false, paperTexture: false }),
    scheduleDynamicHighlights() {} });
  // Instrument only the native ForEach boundary, preserving the production
  // observer and generator. Historical child records are not native removal
  // evidence; the last emitted data/key list is the requested current body.
  const forEach = owner.forEachUpdateFunction;
  const lists = [];
  owner.forEachUpdateFunction = function(id, data, generator, key) {
    lists.push(data.map((fragment, index) => key(fragment, index)));
    return forEach.call(this, id, data, generator, key);
  };
  owner.initialRender();
  return { owner, runtime, lists,
    body: () => lists.at(-1) ?? [],
    title: () => [...owner.children.values()].find(child => child.params.recipe?.style?.lineHeight !== undefined)?.params.recipe.key,
    images: () => [...owner.nodes.values()].filter(node => node.type === 'Image').map(node => ({ uri: node.create, sync: node.syncLoad })),
  };
}

function retainedTexture(source = surfaceSource) {
  let input, surface, updates = 0;
  class SurfaceChild {
    constructor(owner, params, _storage, id) {
      Object.assign(this, { owner, params, id });
      surface = reactiveSurface(params, source);
    }
    updateStateVars(params) { Object.assign(this.params, params); surface.owner.updateStateVars(params); }
  }
  const texture = createReaderBuilderProbe(`@Component struct TextureProbe {\n${textureMethod}\nbuild() { Column() {} }\n}`,
    ['texture'], { ReadingSurface: SurfaceChild }).owner;
  return {
    mount(value) { input = value; texture.texture(input); },
    update(value) {
      // Instrument ComponentContent's input delivery to the retained exported
      // Builder closure. Only that parent boundary runs; the Surface is never
      // force-replayed, and its observers run only from actual SDK Prop reads.
      Object.assign(input, value); updates += 1; texture.replay(); surface.runtime.flush();
    },
    get surface() { return surface; }, get updates() { return updates; }, get texture() { return texture; },
  };
}

async function captureSequence(pages, source = surfaceSource) {
  let mounts = 0, content;
  class ComponentContent {
    constructor(_context, _builder, input) {
      mounts += 1; content = retainedTexture(source); content.mount(input);
    }
    update(input) { content.update(input); }
  }
  const Capture = productionMotionMethods(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url),
    ['captureBookTurnTexture'], { ComponentContent, BookTurnTextureBuildInput,
      BookTurnTextureBuilder: () => {}, wrapBuilder: value => value, BOOK_TURN_TEXTURE_CURRENT: 0 });
  const capture = new Capture();
  Object.assign(capture, { bookTurnTextureCaptureGeneration: 1, pageTurnGeneration: 1, mounted: true, phase: 'ready',
    sessionLaunchRenderWorkBlocked: () => false, usesBookTurnSimulation: () => true, controlVisible: () => false,
    pageTurnInputPhase: () => 'idle', bookTurnCapturedIdentity: () => '', takeBookTurnPendingSnapshot: () => undefined,
    getUIContext: () => ({ getComponentSnapshot: () => ({}) }), viewportWidth: 364, viewportHeight: 780,
    readingLayout: () => layout, appearanceSnapshot: appearance,
    captureDecodedBookTurnPage: async () => ({ release() {} }),
    bookTurnSession: { uploadTexture: async () => true }, failBookTurnTextureCapture: (_slot, _generation, message) => assert.fail(message),
  });
  const states = [];
  for (const current of pages) {
    // Next/previous captures always use the offscreen lane, including text-only
    // pages. Production changes its provider owner and calls content.update.
    assert.equal(await capture.captureBookTurnTexture(1, current, 1), true);
    states.push({ body: content.surface.body(), title: content.surface.title(), images: content.surface.images() });
  }
  assert.equal(mounts, 1, 'one ComponentContent is retained across consecutive snapshots');
  assert.equal(content.updates, pages.length - 1);
  assert.equal(content.texture.children.size, 1, 'same ReadingSurface child retained');
  return { states, content };
}

const recipe = title('one measured title');
const a = page('chapter-14', [text('chapter-14:body', recipe)]);
const b = page('chapter-15', [image('chapter-15:image', recipe), text('chapter-15:body', recipe)]);
const c = page('chapter-16', [text('chapter-16:body', recipe)]);
const expected = fragments => fragments.map(fragment => fragment.text.length === 0 && fragment.imageHeight > 0 ?
  `${fragment.id}:image:${fragment.fileUri}:file` : fragment.id);
const same = await captureSequence([a, b, c, a]);
console.log('same title/showTitle/revision captures:', JSON.stringify(same.states));
assert.deepEqual(same.states.map(state => state.body), [a, b, c, a].map(current => expected(current.fragments)),
  'same-revision retained captures must publish current text/image body, including warm return');
assert.deepEqual(same.states.map(state => state.title), Array(4).fill(recipe.key));
assert.ok(same.states[1].images.some(entry => entry.uri === b.fragments[0].fileUri && entry.sync === true),
  'image is emitted with the offscreen synchronous decode policy on the first B update');

const changedTitle = title('new chapter title');
const turn = await captureSequence([
  page('last-page', [text('chapter-14:last')], { chapterTitle: 'old', showChapterTitle: false }),
  page('new-first', [image('chapter-15:first-image', changedTitle), text('chapter-15:first-body', changedTitle)], { chapterTitle: 'new' }),
]);
assert.equal(turn.states[1].title, changedTitle.key);
assert.deepEqual(turn.states[1].body, ['chapter-15:first-image:image:file:///chapter-15:first-image.png:file', 'chapter-15:first-body'],
  'last-page to first-page does not mix the new title with the old body');

// Legacy static array callers still update without a provider. Live provider
// callers retain revision invalidation without supplying/copied fragment arrays.
const legacy = retainedTexture();
legacy.mount(new BookTurnTextureBuildInput(a, 364, 780, layout, appearance));
legacy.update(new BookTurnTextureBuildInput(b, 364, 780, layout, appearance));
assert.deepEqual(legacy.surface.body(), expected(b.fragments));
let current = a.fragments;
const live = reactiveSurface({ chapterTitle: a.chapterTitle, showChapterTitle: true, contentRevision: 7, fragmentsProvider: () => current });
const liveCopies = live.runtime.copies.filter(copy => copy.name === 'pageFragments' && copy.object).length;
current = b.fragments;
live.owner.updateStateVars({ chapterTitle: a.chapterTitle, showChapterTitle: true, contentRevision: 8 }); live.runtime.flush();
assert.deepEqual(live.body(), expected(current));
assert.equal(live.runtime.copies.filter(copy => copy.name === 'pageFragments' && copy.object).length, liveCopies,
  'live revision-only update does not copy a fragment array');

// A changed publication array is an invalidation signal, never authority over
// the provider. Even stale nonempty backup arrays cannot revive their content.
current = a.fragments;
const authority = retainedTexture();
authority.mount(new BookTurnTextureBuildInput(a, 364, 780, layout, appearance, () => current));
current = b.fragments;
authority.update(new BookTurnTextureBuildInput(page('stale', [text('stale-backup', title('stale-title'))]), 364, 780, layout, appearance, () => current));
assert.deepEqual(authority.surface.body(), expected(b.fragments));
assert.equal(authority.surface.title(), recipe.key);
const empty = retainedTexture();
empty.mount(new BookTurnTextureBuildInput(page('stale-one', [text('stale-one')], { showChapterTitle: false }), 364, 780, layout, appearance, () => []));
empty.update(new BookTurnTextureBuildInput(page('stale-two', [text('stale-two')], { showChapterTitle: false }), 364, 780, layout, appearance, () => []));
assert.deepEqual(empty.surface.body(), [], 'an authoritative empty provider never revives stale backup content');

// Restore only the old dependency omission. This negative control must retain
// old body keys while the production capture input advances to the image page.
const oldSource = surfaceSource.replace('const fragments = this.pageFragments;', '')
  .replace('this.fragmentsProvider() : fragments;', 'this.fragmentsProvider() : this.pageFragments;');
assert.notEqual(oldSource, surfaceSource);
const old = await captureSequence([a, b], oldSource);
assert.deepEqual(old.states[1].body, expected(a.fragments));
assert.equal(old.states[1].images.length, 0);
console.log('SDK evidence:', JSON.stringify(same.content.surface.runtime.source));
console.log('PASS production capture -> retained offscreen Builder -> real SDK Prop response: same-title/same-revision text/image/text/warm-return, new-title publication, provider authority, empty provider, legacy array and revision-only live path; old-code negative control reproduces missing image');
