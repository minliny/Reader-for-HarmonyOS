import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { runtimeOwnerIdentityProbe } from './lib/reader-runtime-admission-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { iconButtonControls } from './lib/reader-icon-button-probe.mjs';
import { foundationControls, readerFoundationTokens } from './lib/reader-foundation-control-probe.mjs';
import { boundedMembers } from './lib/bounded-surface-sdk-probe.mjs';
import { readerTypographyRoles } from './lib/reader-typography-probe.mjs';
import { readerAppColor } from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import { createDefaultReaderWindowMetrics, readerInteractiveSafeLeft, readerInteractiveSafeRight } from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';

const read = path => readFileSync(new URL('../entry/src/main/ets/' + path, import.meta.url), 'utf8');
const originalIndexProof = JSON.parse(readFileSync(new URL('./fixtures/icon-button-family/bookshelf-search-owner-before.json', import.meta.url), 'utf8'));
const originalIndexFixture = readFileSync(new URL('./fixtures/icon-button-family/bookshelfShellContent.before.ets', import.meta.url), 'utf8');
assert.equal(createHash('sha256').update(originalIndexFixture).digest('hex'), originalIndexProof.fixtureSha256, 'frozen actual original Index member cannot drift');
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const require = createRequire(import.meta.url), syntax = require(sdk + '/lib/validate_ui_syntax.js');
syntax.builderParamObjectCollection.set('BookshelfShell', new Set(['content']));
syntax.builderParamObjectCollection.set('AppTopBar', new Set(['trailing']));
syntax.builderParamObjectCollection.set('MainTabShell', new Set(['content']));
require(sdk + '/lib/component_map.js').CUSTOM_BUILDER_METHOD.add('bookshelfContent');
class ShellCarrier {
  constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); }
}

function fixture() {
  const runtime = {}, calls = [];
  let current = runtime;
  const ReaderRuntimeOwner = runtimeOwnerIdentityProbe(() => current);
  const Index = productionMotionMethods(new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
    ['isCurrentBookshelfPresentation', 'openSearch', 'registerTemporaryBackBridge'], { ReaderRuntimeOwner });
  // These are the navigation/Host side-effect seams. The production entry
  // method and owner guard run unchanged; no admission predicate is replaced.
  const index = Object.assign(new Index(), {
    mountedRuntimeOwner: runtime, shelfReceiptRetired: false, route: 'bookshelf', navigationGeneration: 7,
    detailShelfAdmissionMount: 3, readingSessionActive: false, readingExitRequest: 'prior', exitToDetailOriginAfterReader: true,
    searchHost: { prepareEntry: () => calls.push('prepare'), open: () => calls.push('open') },
    nextNavigationGeneration() { calls.push('navigation'); return ++this.navigationGeneration; },
    resetSearchDetailWarmups: () => calls.push('warmup'), refreshSearchShelfMembership: () => calls.push('membership'),
    shelfRecovery: () => ({ visible: false }), shelfReadRecovery: () => ({ visible: false }), canContinueShelfRemoval: () => false,
    shelfOperation: {}, settingsSnapshot: {}, shelfBooks: [], shelfProjectionRevision: '', isBookshelfVisualAdmitted: true,
  });
  const parentSource = process.env.READER_SHELF_SEARCH_INDEX_SOURCE ? readFileSync(process.env.READER_SHELF_SEARCH_INDEX_SOURCE, 'utf8') : read('pages/Index.ets');
  const parent = createReaderBuilderProbe(parentSource, ['bookshelfShellContent'],
    { BookshelfShell: ShellCarrier }, { childSources: { BookshelfShell: read('features/bookshelf/BookshelfShell.ets') } }).owner;
  Object.assign(parent, index);
  for (const name of ['isCurrentBookshelfPresentation', 'openSearch', 'registerTemporaryBackBridge']) parent[name] = index[name].bind(index);
  parent.bookshelfShellContent();
  const props = [...parent.children.values()].find(child => child instanceof ShellCarrier).params;
  const controls = iconButtonControls(), foundation = foundationControls();
  // The SDK carrier admits a new keyed actor and retains the old actor for
  // the negative callback check; native removal/layout are not simulated.
  controls.hooks.allowEmptyBranchAdmission = true;
  Object.assign(controls.dependencies, foundation.dependencies, readerFoundationTokens, readerTypographyRoles, {
    ReaderIconButton: controls.icon.Component, readerAppColor, ReaderWindowCoordinator: { metrics: createDefaultReaderWindowMetrics },
    readerInteractiveSafeLeft, readerInteractiveSafeRight, bookshelfTemporaryGeneration: 0,
  });
  const header = read('features/common/AppTopBar.ets');
  Object.assign(controls.hooks.childSources, foundation.hooks.childSources, {
    AppTopBar: header, MainTabShell: read('features/shell/MainTabShell.ets'),
    BookshelfMoreMenu: read('features/bookshelf/BookshelfMoreMenu.ets'),
  });
  controls.dependencies.AppTopBar = controls.consumer(header, boundedMembers(header)).constructor;
  const source = read('features/bookshelf/BookshelfShell.ets');
  const shell = controls.consumer(source, boundedMembers(source), {}, props);
  shell.mounted = true; shell.temporaryBackIdentity = 'bookshelf:7'; shell.moreMenuVisible = false;
  shell.topBar();
  const actors = () => controls.walk(shell).filter(child => child instanceof controls.icon.Component && child.specId === 'toolbar-standard');
  const event = actor => controls.nodes(actor).find(node => node.onClick).onClick;
  return { index, props, shell, controls, actors, event, calls, setRuntime(value) { current = value; } };
}

let cases = 0;
{
  const f = fixture(), click = f.event(f.actors()[0]);
  click();
  assert.deepEqual(f.calls, ['prepare', 'navigation', 'warmup', 'membership', 'open']);
  assert.equal(f.index.route, 'search'); assert.equal(f.index.readingSessionActive, false);
  assert.equal(f.index.readingExitRequest, undefined); assert.equal(f.index.exitToDetailOriginAfterReader, false);
  click(); assert.equal(f.calls.length, 5, 'retained physical click cannot open search twice after navigation'); cases++;
}
for (const retirement of ['route', 'navigation', 'mount', 'retired', 'runtime', 'mounted-owner']) {
  const f = fixture(), click = f.event(f.actors()[0]);
  f.index.readingSessionActive = true;
  if (retirement === 'route') f.index.route = 'reading';
  if (retirement === 'navigation') f.index.navigationGeneration++;
  if (retirement === 'mount') f.index.detailShelfAdmissionMount++;
  if (retirement === 'retired') f.index.shelfReceiptRetired = true;
  if (retirement === 'runtime') f.setRuntime({});
  if (retirement === 'mounted-owner') f.index.mountedRuntimeOwner = {};
  const before = { route: f.index.route, navigation: f.index.navigationGeneration, exit: f.index.readingExitRequest };
  click();
  // Independently exercise the actual Index callback too, so a leaf guard
  // cannot conceal a missing owner guard in the parent production closure.
  f.props.onSearchRequested(7);
  assert.deepEqual(f.calls, [], retirement + ': no Host/navigation side effect');
  assert.equal(f.index.readingSessionActive, true, retirement + ': preserve active reader');
  assert.deepEqual({ route: f.index.route, navigation: f.index.navigationGeneration, exit: f.index.readingExitRequest }, before); cases++;
}
{
  const f = fixture(), first = f.actors()[0], oldClick = f.event(first), owner = f.shell;
  f.index.navigationGeneration = 8;
  f.controls.update(f.shell, { navigationGeneration: 8 });
  f.shell.replay(); f.controls.properties.flush();
  oldClick(); assert.deepEqual(f.calls, [], 'old physical generation cannot be upgraded by a Prop update');
  const next = f.actors().find(actor => actor !== first);
  assert.ok(next, 'new action generation gets its own native actor');
  assert.equal(f.shell, owner, 'persistent bookshelf shell is retained');
  f.event(next)(); assert.equal(f.index.route, 'search'); assert.equal(f.calls.at(-1), 'open'); cases++;
}
console.log(`PASS ${cases} actual Index→Shell→Icon SDK search admission groups: current entry, duplicate, route/navigation/mount/runtime retirement, reader preservation and retained-shell fresh actor. Native dispatch is separate.`);
