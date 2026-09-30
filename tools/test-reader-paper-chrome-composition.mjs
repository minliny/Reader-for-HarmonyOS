import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { findReaderTheme, readerThemeDefinition, READER_THEME_DEFINITIONS } from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import { ReaderRectVp } from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import { readerAppearanceThemeStyle, readerAppearanceChromeTone } from '../entry/src/main/ets/features/reading/ReaderAppearanceRenderStyle.ts';
import { readerWidthClass } from '../entry/src/main/ets/features/reading/ReaderLayoutGeometry.ts';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';

const read = file => readFileSync(new URL(`../entry/src/main/ets/${file}`, import.meta.url), 'utf8');
const paperSource = read('features/reading/ReaderPaperBackground.ets');
const statusSource = read('features/reading/ReaderStatusBarPaper.ets');
const surfaceSource = read('features/reading/ReadingSurface.ets');
const shellSource = read('features/shell/ReaderShell.ets');
const lreSource = read('features/reading/LocalReadingExperience.ets');
const require = createRequire(import.meta.url);
const sdkRoot = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const syntax = require(`${sdkRoot}/lib/validate_ui_syntax.js`);
function register(name, source) {
  syntax.componentCollection.customComponents.add(name);
  syntax.propCollection.set(name, new Set([...source.matchAll(/@Prop\s+(\w+)\s*:/g)].map(m => m[1])));
}
register('ReaderPaperBackground', paperSource);
register('ReaderStatusBarPaper', statusSource);
class Child { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
const enums = Object.fromEntries(['GradientDirection', 'ImageFit', 'ImageInterpolation', 'ImageRepeat'].map(name =>
  [name, new Proxy({}, { get: (_target, key) => `${name}.${key}` })]));
function paper(params) {
  const owner = createReaderBuilderProbe(paperSource, ['build', 'themeStyle', 'paperTexture', 'paperHighlight', 'paperShade'], {
    readerAppearanceThemeStyle, ...enums,
  }).owner;
  Object.assign(owner, { synchronousImages: false, ...params }); owner.initialRender(); return owner;
}
function status(params) {
  const owner = createReaderBuilderProbe(statusSource, ['build'], {
    findReaderTheme, readerThemeDefinition, ReaderPaperBackground: Child,
  }).owner;
  Object.assign(owner, params); owner.initialRender(); return owner;
}
function statusGeometry(owner, rect, viewport) {
  const nodes = [...owner.nodes.values()];
  const crop = nodes.find(n => n.clip === true);
  const background = nodes.find(n => n.type === '__Common__');
  assert.deepEqual([crop.width, crop.height, crop.position], [rect.width, rect.height, { x: rect.left, y: rect.top }]);
  assert.equal(crop.hitTestBehavior, 'HitTestMode.None');
  assert.deepEqual([background.width, background.height], viewport);
  assert.equal(crop.position.x + background.position.x, 0, 'texture origin stays in window coordinates');
  assert.equal(crop.position.y + background.position.y, 0, 'status crop never restarts or scales the paper texture');
}
let cases = 0;
for (const theme of READER_THEME_DEFINITIONS) for (const expanded of [false, true]) {
  const viewport = expanded ? [760, 960] : [390, 844];
  const page = paper({ theme: theme.id, expanded, synchronousImages: true });
  const rect = new ReaderRectVp(3, 2, viewport[0] - 6, 48);
  const band = status({ theme: theme.id, expanded, viewportWidth: viewport[0], viewportHeight: viewport[1], statusRect: rect,
    fallbackColor: theme.paperStart });
  statusGeometry(band, rect, viewport);
  const bandProps = [...band.children.values()][0].params;
  assert.deepEqual(bandProps, { theme: theme.id, expanded });
  const stripe = paper(bandProps);
  function signature(owner) {
    return [...owner.nodes.values()].filter(n => n.type !== 'If').map(n => ({
      type: n.type, create: n.create, linearGradient: n.linearGradient,
      backgroundColor: n.backgroundColor, backgroundImage: n.backgroundImage,
      backgroundImageSize: n.backgroundImageSize, backgroundImagePosition: n.backgroundImagePosition,
      width: n.width, height: n.height,
    }));
  }
  assert.deepEqual(signature(stripe), signature(page), `${theme.id}: page and status use identical SDK-emitted paper nodes`);
  const texture = [...page.nodes.values()].filter(n => n.backgroundImage);
  assert.equal(texture.length, theme.paperTexture ? 1 : 0);
  if (texture.length) {
    assert.deepEqual(texture[0].backgroundImage, [`app.media.reading_paper_${expanded ? 'tablet' : 'phone'}`, 'ImageRepeat.XY']);
    assert.deepEqual(texture[0].backgroundImageSize, { width: 100, height: 100 });
    assert.equal(texture[0].backgroundImagePosition, 'Alignment.TopStart');
  }
  const images = [...page.nodes.values()].filter(n => n.type === 'Image');
  assert.equal(images.length, theme.sourcePaperLighting ? 2 : 0);
  for (const image of images) assert.equal(image.syncLoad, true, 'synchronous page raster still forwards image admission');
  const paintNodes = [...page.nodes.values()];
  const baseIndex = paintNodes.findIndex(node => node.linearGradient);
  const textureIndex = paintNodes.findIndex(node => node.backgroundImage);
  assert.ok(baseIndex >= 0, 'every paper theme retains an opaque color base');
  for (const image of images) {
    assert.ok(baseIndex < paintNodes.indexOf(image), 'translucent lighting must be above the opaque paper base');
    if (textureIndex >= 0) assert.ok(paintNodes.indexOf(image) < textureIndex,
      'paper grain remains above lighting');
  }
  cases++;
}

const moving = status({ theme: 'paper', expanded: false, viewportWidth: 390, viewportHeight: 844,
  statusRect: new ReaderRectVp(), fallbackColor: '#FFEEE4D0' });
const count = moving.observers.length;
Object.assign(moving, { statusRect: new ReaderRectVp(4, 3, 382, 52), viewportWidth: 760, viewportHeight: 960,
  theme: 'paperNight', expanded: true });
moving.replay();
assert.equal(moving.observers.length, count, 'late geometry and theme changes retain the status composition');
statusGeometry(moving, moving.statusRect, [760, 960]);
assert.deepEqual([...moving.children.values()][0].params, { theme: 'paperNight', expanded: true });
for (const theme of ['', 'missing-theme']) {
  const fallback = status({ theme, expanded: false, viewportWidth: 390, viewportHeight: 844,
    statusRect: new ReaderRectVp(0, 0, 390, 48), fallbackColor: '#FF413020' });
  assert.equal(fallback.children.size, 0);
  assert.equal([...fallback.nodes.values()].find(n => n.clip).backgroundColor, '#FF413020',
    'unknown owner theme keeps the requested opaque underlay; never replaces it with default day paper');
}

for (const theme of READER_THEME_DEFINITIONS) for (const route of ['directory', 'reading'])
  for (const sourceSwitchVisible of [false, true]) {
  let metrics = { windowRect: new ReaderRectVp(0, 0, 390, 844), statusBarRect: new ReaderRectVp(2, 1, 386, 48) };
  const shell = createReaderBuilderProbe(shellSource, ['overlayStatusBarUnderlay', 'chromeMetrics'], {
    ReaderStatusBarPaper: Child, readerWidthClass, ReaderWindowCoordinator: { metrics: () => metrics },
  }).owner;
  Object.assign(shell, { visible: true, route, sourceSwitchVisible, isTablet: false,
    chromePaperThemeId: theme.id, chromeUnderlayColor: theme.paperStart, windowMetricsRevision: 1 });
  shell.overlayStatusBarUnderlay();
  const wrapper = [...shell.nodes.values()].find(n => n.id === 'reader-overlay-status-bar-underlay');
  if (sourceSwitchVisible || route !== 'directory') {
    assert.equal(wrapper, undefined, 'full-page source switching cannot retain a zIndex 10 reader-paper stripe');
    assert.equal(shell.children.size, 0);
    continue;
  }
  assert.equal(wrapper.zIndex, 10); assert.equal(wrapper.hitTestBehavior, 'HitTestMode.None');
  const props = [...shell.children.values()][0].params;
  assert.equal(props.theme, theme.id); assert.deepEqual(props.statusRect, metrics.statusBarRect);
  statusGeometry(status(props), metrics.statusBarRect, [390, 844]);
  metrics = { windowRect: new ReaderRectVp(0, 0, 760, 960), statusBarRect: new ReaderRectVp(1, 2, 758, 50) };
  shell.chromePaperThemeId = 'paperNight'; shell.windowMetricsRevision++;
  shell.replay();
  const updated = [...shell.children.values()][0].params;
  assert.equal(updated.theme, 'paperNight'); assert.equal(updated.expanded, true);
  statusGeometry(status(updated), metrics.statusBarRect, [760, 960]);
}

for (const extend of [false, true]) for (const controls of [false, true]) for (const windowChromeActive of [false, true]) {
  const owner = createReaderBuilderProbe(lreSource, ['readerStatusBarUnderlay', 'readerStatusBarMetrics'], {
    ReaderStatusBarPaper: Child, readerAppearanceThemeStyle,
    ReaderWindowCoordinator: { metrics: () => ({ statusBarRect: new ReaderRectVp(0, 0, 390, 48) }) },
  }).owner;
  Object.assign(owner, { windowChromeActive, readerSettingsSnapshot: { extendIntoCutout: extend },
    windowControlsPresented: controls, readerWindowMetricsRevision: 1, appearanceSnapshot: { activeTheme: 'paper' },
    readingLayout: () => ({ viewportWidth: 390, viewportHeight: 844, widthClass: 'compact' }) });
  owner.readerStatusBarUnderlay();
  assert.equal(owner.children.size, controls && windowChromeActive ? 1 : 0,
    'closed controls or App-owned full-page source switching cannot paint the stationary reader paper band');
  if (owner.children.size) {
    const wrapper = [...owner.nodes.values()].find(n => n.id === 'reader-status-bar-underlay');
    assert.equal(wrapper.zIndex, 10, 'only the presented control overlay owns stationary status paper');
    statusGeometry(status([...owner.children.values()][0].params), new ReaderRectVp(0, 0, 390, 48), [390, 844]);
  }
}

// Exercise the existing observed ownership edge, including both color and
// window policy. The source page releases ownership temporarily; returning to
// the same reader restores it without modifying persistent immersive settings.
{
  const requests = [], memory = new Map();
  class ChromeStyle {
    constructor(underlayColor, tone, contentColor, paperThemeId) {
      Object.assign(this, { underlayColor, tone, contentColor, paperThemeId });
    }
  }
  const Owner = productionMotionMethods(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url),
    ['onWindowChromeActiveChanged', 'applyWindowChrome', 'applyWindowPolicyForChromeOwner'], {
      readerAppearanceThemeStyle, readerAppearanceChromeTone, ReaderWindowChromeStyle: ChromeStyle,
      AppStorage: { setOrCreate: (key, value) => memory.set(key, value) },
      ReaderWindowCoordinator: {
        requestAppChrome: () => requests.push(['app']),
        requestReaderChrome: value => requests.push(['reader', value]),
        requestOverlayChrome: value => requests.push(['overlay', value]),
        requestAppWindowPolicy: () => { requests.push(['app-policy']); return Promise.resolve(); },
      },
    });
  const settings = Object.freeze({ extendIntoCutout: true, hideNavigationBar: true });
  const owner = Object.assign(new Owner(), { isReaderIdentityCurrent: () => true,
    appearanceSnapshot: { activeTheme: 'paperNight' }, readerSettingsSnapshot: settings,
    onControlInputBoundaryChanged() {}, syncVolumeKeyPolicy() {}, controlsPresentedForWindow: () => true,
    applyReaderWindowPolicy: (snapshot, showStatus) => {
      requests.push(['reader-policy', snapshot, showStatus]); return Promise.resolve();
    },
  });
  for (const [active, overlay, expected] of [[true, false, 'reader'], [false, false, 'app'],
    [true, false, 'reader'], [true, true, 'overlay']]) {
    requests.length = 0;
    Object.assign(owner, { windowChromeActive: active, windowChromeOverlayActive: overlay });
    owner.onWindowChromeActiveChanged();
    assert.equal(requests[0][0], expected);
    assert.equal(requests[1][0], active ? 'reader-policy' : 'app-policy');
    assert.equal(memory.get('readerTopInfoSuppressed'), active);
    if (active) {
      assert.equal(requests[0][1].paperThemeId, 'paperNight');
      assert.equal(requests[0][1].underlayColor, readerAppearanceThemeStyle('paperNight').paperStart);
      assert.equal(requests[1][1], settings, 'returning to the retained reader restores its same settings snapshot');
    }
    assert.deepEqual(settings, { extendIntoCutout: true, hideNavigationBar: true });
  }
}

assert.match(surfaceSource, /ReaderPaperBackground\(\{[\s\S]*?theme: this\.appearance\.activeTheme,[\s\S]*?expanded: this\.layout\.widthClass === 'expanded',[\s\S]*?synchronousImages: this\.snapshotSynchronousImages/);
assert.doesNotMatch(surfaceSource, /backgroundImage\(this\.paperTexture\(/, 'no second page-only paper implementation remains');
console.log(`PASS PH112: ${cases} actual SDK page/status paper compositions, full-window crops, stable late geometry/theme updates, directory paper and source-page exclusion, native visibility gates and opaque unknown-theme fallback. Device pixels are separate evidence.`);
