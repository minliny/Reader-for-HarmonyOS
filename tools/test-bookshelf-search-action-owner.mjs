// Actual Index search-surface wiring and the shared library bar's 44vp leading
// actor. Method extraction uses the current owners; native hit/layout remain a
// separate device contract.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createReaderComponentProbe } from './lib/reader-component-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { builderComponentMembers } from './lib/ets-builder-probe.mjs';
import { installedEtsCompiler } from './lib/ets-compiler-runtime.mjs';
import { virtualFilePath } from './lib/tool-environment.mjs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { runtimeOwnerIdentityProbe } from './lib/reader-runtime-admission-probe.mjs';
import { readerAppColor } from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';

const root = new URL('../entry/src/main/ets/', import.meta.url);
const indexUrl = new URL('pages/Index.ets', root);
const surfaceUrl = new URL('features/search/ReaderLibrarySearchSurface.ets', root);
const fieldSource = readFileSync(new URL('features/common/ReaderSearchField.ets', root), 'utf8');
const { ts, options, require, root: sdkRoot } = installedEtsCompiler();
const componentMap = require(sdkRoot + '/lib/component_map.js');
const parse = (source, name) => ts.createSourceFile(virtualFilePath(name), source,
  ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
function sdkProbe(source, names, dependencies, hooks = {}) {
  const saved = new Map(componentMap.ID_ATTRS);
  componentMap.ID_ATTRS.clear();
  try {
    return createReaderComponentProbe(source, names, dependencies, hooks);
  } finally {
    componentMap.ID_ATTRS.clear();
    for (const [key, value] of saved) componentMap.ID_ATTRS.set(key, value);
  }
}

const indexSource = readFileSync(indexUrl, 'utf8');
const indexTree = parse(indexSource, 'BookshelfSearchActionIndex.ets');
assert.deepEqual(indexTree.parseDiagnostics, []);
const index = indexTree.statements.find(node => node.name?.text === 'Index');
assert.ok(index);
const wiringNames = ['librarySearchSurface', 'isCurrentSearchPresentation',
  'isCurrentBookshelfPresentation', 'isCurrentRuntime'];
const wiringBody = wiringNames.map(name => {
  const member = index.members.find(candidate => candidate.name?.getText(indexTree) === name);
  assert.ok(member, `production Index member ${name}`);
  return member.getText(indexTree);
}).join('\n');
const wiringSource = `@Component struct BookshelfSearchActionWiringProbe {
${wiringBody}
@Builder private librarySearchResults() {}
build() { Column() {} }
}`;
class View {
  constructor() { this.observers = []; this.children = new Map(); }
  finalizeConstruction() {}
  observeComponentCreation2(callback) {
    const element = this.observers.length + 1;
    this.observers.push([element, callback]);
    callback(element, true);
  }
  updateStateVarsOfChildByElmtId(element, params) {
    Object.assign(this.children.get(element).params, params);
  }
  static create() {}
}
class SurfacePort {
  constructor(parent, params, _storage, element) {
    Object.assign(this, { parent, params, element });
    parent.children.set(element, this);
  }
  enabled() { return this; }
  hitTestBehavior() { return this; }
}
const wiringFixture = sdkProbe(wiringSource, builderComponentMembers(wiringSource), {
  ViewPU: View, ReaderLibrarySearchSurface: SurfacePort,
  __Common__: { create() {}, enabled() {}, hitTestBehavior() {}, pop() {} },
}, {
  childSources: { ReaderLibrarySearchSurface: readFileSync(surfaceUrl, 'utf8') },
  createGlobals: () => ({}),
});

function createSurface(params) {
  const properties = createArkUIPropertyRuntimeProbe();
  const fixture = sdkProbe(readFileSync(surfaceUrl, 'utf8'),
    ['bar', 'presentedSearch', 'leadingAction'], {
      ...properties.sdk,
      ReaderSearchField: class FieldPort {},
      readerAppColor,
      READER_FONT_NOTO_SANS_SC_UI_BOLD: 'ReaderNotoSansSCUIBold',
      bookshelfHeaderSpec: () => ({ titleFontSize: 19, titleLineHeight: 28 }),
    }, {
      ...properties.hooks,
      childSources: { ReaderSearchField: fieldSource },
    });
  const surface = fixture.owner;
  Object.assign(surface, params, {
    mounted: true, mode: 'idle', transitionKind: 'none', scheme: 'day', searchMounted: false,
    identity: params.identity, navigationGeneration: params.navigationGeneration,
    mounting: params.mounting, moreIdentity: params.moreIdentity,
    model: { currentOwner: () => 0 },
    titleOpacity: () => 1, surfaceValue: () => 0, cardContentWidth: () => 358, barHeight: () => 52,
    moreAction: () => () => {},
  });
  surface.bar();
  return surface;
}

function actor(surface) {
  const nodes = [...surface.nodes.values()];
  const leading = nodes.find(node => node.type === 'Stack' && node.width === 44 && node.height === 44 &&
    node.accessibilityText === '搜索书籍');
  assert.ok(leading, 'actual shared library bar owns the native leading Search Stack');
  assert.equal(leading.borderRadius, 14);
  assert.deepEqual(leading.position, { x: 4, y: 4 });
  assert.equal(typeof leading.onClick, 'function');
  return leading.onClick;
}

const IndexBehavior = productionMotionMethods(indexUrl, ['openSearch'], {
  ReaderRuntimeOwner: runtimeOwnerIdentityProbe(() => undefined),
});
const productionOpenSearch = IndexBehavior.prototype.openSearch;
assert.equal(typeof productionOpenSearch, 'function');

function fixture() {
  const runtime = {}, calls = [];
  let current = runtime;
  const ReaderRuntimeOwner = runtimeOwnerIdentityProbe(() => current);
  const parent = Object.assign(new wiringFixture.Component(undefined, {}), {
    mountedRuntimeOwner: runtime, shelfReceiptRetired: false, route: 'bookshelf', navigationGeneration: 7,
    detailShelfAdmissionMount: 3, readingSessionActive: false, readingExitRequest: 'prior',
    exitToDetailOriginAfterReader: true, librarySearchIdentity: 5, librarySearchMode: 'idle',
    librarySearchAnimateOnAppear: false, librarySearchModel: { currentOwner: () => 0 },
    settingsSnapshot: { reduceMotion: false }, expandedLayout: () => false,
    searchHost: { prepareEntry: () => calls.push('prepare'), open: () => calls.push('open') },
    shelfMoreIdentity: 'more', shelfMoreGeneration: 7, shelfMoreHandler() {},
    shelfHeaderScrolled: false, isBookshelfVisualAdmitted: true, shelfHeaderHeight: 0,
    libraryContinueCardNavigation: 0, libraryContinueCardRect: undefined,
    nextNavigationGeneration() { calls.push('navigation'); return ++this.navigationGeneration; },
    resetSearchDetailWarmups: () => calls.push('warmup'),
    refreshSearchShelfMembership: () => calls.push('membership'),
    refreshSourceCatalog() {},
  });
  parent.openSearch = function () { return productionOpenSearch.call(this); };
  parent.isCurrentRuntime = owner => owner !== undefined && ReaderRuntimeOwner.isCurrent(owner);
  parent.librarySearchSurface(runtime, parent.searchHost);
  const port = [...parent.children.values()].find(child => child instanceof SurfacePort);
  assert.ok(port, 'Index mounts the current ReaderLibrarySearchSurface');
  return {
    parent, params: port.params, calls,
    setRuntime(value) { current = value; },
  };
}

let cases = 0;
{
  const f = fixture();
  const surface = createSurface(f.params);
  const click = actor(surface);
  click();
  assert.deepEqual(f.calls, ['prepare', 'navigation', 'warmup', 'membership', 'open']);
  assert.equal(f.parent.route, 'search');
  assert.equal(f.parent.librarySearchMode, 'input');
  assert.equal(f.parent.readingSessionActive, false);
  assert.equal(f.parent.readingExitRequest, undefined);
  assert.equal(f.parent.exitToDetailOriginAfterReader, false);
  click();
  assert.equal(f.calls.length, 5, 'retained physical click cannot open search twice after navigation');
  cases++;
}
for (const retirement of ['route', 'navigation', 'mount', 'identity', 'retired', 'runtime', 'mounted-owner']) {
  const f = fixture();
  const surface = createSurface(f.params);
  const click = actor(surface);
  f.parent.readingSessionActive = true;
  if (retirement === 'route') f.parent.route = 'reading';
  if (retirement === 'navigation') f.parent.navigationGeneration++;
  if (retirement === 'mount') f.parent.detailShelfAdmissionMount++;
  if (retirement === 'identity') f.parent.librarySearchIdentity++;
  if (retirement === 'retired') f.parent.shelfReceiptRetired = true;
  if (retirement === 'runtime') f.setRuntime({});
  if (retirement === 'mounted-owner') f.parent.mountedRuntimeOwner = {};
  const before = {
    route: f.parent.route, navigation: f.parent.navigationGeneration,
    exit: f.parent.readingExitRequest,
  };
  click();
  // Independently exercise the parent closure so a surface-local guard cannot
  // conceal a missing Index owner/generation/runtime admission.
  f.params.onOpen(5, 7, 3);
  assert.deepEqual(f.calls, [], retirement + ': no Host/navigation side effect');
  assert.equal(f.parent.readingSessionActive, true, retirement + ': preserve active reader');
  assert.deepEqual({
    route: f.parent.route, navigation: f.parent.navigationGeneration,
    exit: f.parent.readingExitRequest,
  }, before);
  cases++;
}
{
  const f = fixture();
  const surface = createSurface(f.params);
  const oldClick = actor(surface);
  f.parent.navigationGeneration = 8;
  surface.navigationGeneration = 8;
  surface.replay();
  const newClick = actor(surface);
  oldClick();
  assert.deepEqual(f.calls, [], 'old physical generation cannot be upgraded by a Prop update');
  newClick();
  assert.equal(f.parent.route, 'search');
  assert.equal(f.calls.at(-1), 'open');
  cases++;
}
console.log(`PASS ${cases} actual Index→ReaderLibrarySearchSurface 44vp leading search admission groups: ` +
  'current entry, duplicate, route/navigation/mount/identity/retirement/runtime rejection and retained-surface fresh actor. ' +
  'Native dispatch and device hit proof remain separate.');
