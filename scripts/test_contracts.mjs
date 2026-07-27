// Static consumer gate for the Reader-UI → HarmonyOS boundary.
//
// This file intentionally verifies the current single-authority arrangement:
// Reader-UI's revision-bound Figma registry and generated ArkTS contract are
// the visual inputs.  It must never require the retired Harmony-side
// Figma*Root / FigmaVisual*Policy parallel layer to exist.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const READER_UI = process.env.READER_UI_ROOT || path.resolve(REPO, '../Reader-UI');
const ETS = path.join(REPO, 'entry/src/main/ets');

function source(relativePath) {
  return fs.readFileSync(path.join(REPO, relativePath), 'utf8');
}

function readerUiSource(relativePath) {
  return fs.readFileSync(path.join(READER_UI, relativePath), 'utf8');
}

function json(relativePath) {
  return JSON.parse(readerUiSource(relativePath));
}

function exists(relativePath) {
  return fs.existsSync(path.join(REPO, relativePath));
}

function structSource(text, name) {
  const start = text.indexOf(`struct ${name}`);
  assert.ok(start >= 0, `missing ArkTS struct: ${name}`);
  const bodyStart = text.indexOf('{', start);
  assert.ok(bodyStart >= 0, `missing ArkTS body: ${name}`);
  let depth = 0;
  for (let index = bodyStart; index < text.length; index += 1) {
    if (text[index] === '{') depth += 1;
    else if (text[index] === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  assert.fail(`unterminated ArkTS struct: ${name}`);
}

function reachableStructSources(text, roots) {
  const names = new Set([...text.matchAll(/(?:export )?struct\s+(\w+)/g)].map((match) => match[1]));
  const reachable = new Map();
  const pending = [...roots];
  while (pending.length > 0) {
    const name = pending.pop();
    if (reachable.has(name)) continue;
    assert.ok(names.has(name), `missing reachable ArkTS struct: ${name}`);
    const body = structSource(text, name);
    reachable.set(name, body);
    for (const match of body.matchAll(/\b([A-Z]\w+)\s*\(/g)) {
      const child = match[1];
      if (child !== name && names.has(child)) pending.push(child);
    }
  }
  return reachable;
}

function etsFiles(root = ETS) {
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...etsFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.ets')) files.push(full);
  }
  return files;
}

let pass = 0;
let fail = 0;
function test(name, body) {
  try {
    body();
    pass += 1;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    fail += 1;
    const message = error instanceof Error ? error.message : String(error);
    console.log(`  ✗ ${name}\n      ${message}`);
  }
}

const registry = json('docs/design/FIGMA_VISUAL_ADMISSION_REGISTRY.json');
const liveSourceSnapshot = json('docs/design/FIGMA_LIVE_SOURCE_SNAPSHOT.json');
const ledgerSource = readerUiSource('docs/design/FIGMA_VISUAL_TOKEN_LEDGER.json');
const ledger = JSON.parse(ledgerSource);
const visualAdmission = source('entry/src/main/ets/contract/reader_ui/VisualAdmission.ets');
const routeReconstructionQuarantine = json('contracts/fixtures/route-reconstruction-quarantine.fixtures.json');
const routeTable = source('entry/src/main/ets/contract/generated/RouteTable.ets');
const routeRenderer = source('entry/src/main/ets/ui/router/RouteRenderer.ets');
const viewStateRenderer = source('entry/src/main/ets/ui/components/ViewStateRenderer.ets');
const viewStateTable = source('entry/src/main/ets/contract/generated/ViewStateTable.ets');
const overlayHost = source('entry/src/main/ets/ui/slots/OverlayHost.ets');
const stateHost = source('entry/src/main/ets/ui/slots/StateHost.ets');
const readerComponents = source('entry/src/main/ets/ui/components/ReaderComponents.ets');
const readerOverlays = source('entry/src/main/ets/ui/components/ReaderOverlayComponents.ets');
const readerReducer = source('entry/src/main/ets/ui/store/ReaderReducer.ets');
const readerUiStore = source('entry/src/main/ets/ui/store/ReaderUiStore.ets');
const ttsHost = source('entry/src/main/ets/host/adapters/TtsHostAdapter.ets');
const coreRuntime = source('entry/src/main/ets/bridge/CoreRuntime.ets');
const hostCapabilityManifest = source('entry/src/main/ets/host/HostCapabilityManifest.ets');
const readerUiHostPlatform = source('entry/src/main/ets/host/HarmonyReaderUiHostPlatform.ets');
const bookshelf = source('entry/src/main/ets/ui/components/BookshelfComponents.ets');
const bookDetail = source('entry/src/main/ets/ui/components/BookDetailComponents.ets');
const sourceSwitch = source('entry/src/main/ets/ui/components/SourceSwitchFlowComponents.ets');
const discover = source('entry/src/main/ets/ui/components/DiscoverComponents.ets');
const rss = source('entry/src/main/ets/ui/components/RssComponents.ets');
const sharedComponents = source('entry/src/main/ets/ui/components/SharedComponents.ets');
const readerShell = source('entry/src/main/ets/ui/shells/ReaderShell.ets');
const mainTabShell = source('entry/src/main/ets/ui/shells/MainTabShell.ets');
const libraryShell = source('entry/src/main/ets/ui/shells/LibraryShell.ets');
const effects = source('entry/src/main/ets/ui/store/ReaderEffects.ets');
const demoUiState = source('entry/src/main/ets/ui/fixtures/DemoUiState.ets');
const settings = source('entry/src/main/ets/ui/components/SettingsComponents.ets');
const settingsShell = source('entry/src/main/ets/ui/shells/SettingsShell.ets');
const structuralPages = source('entry/src/main/ets/ui/components/StructuralPageComponents.ets');
const entryAbility = source('entry/src/main/ets/entryability/EntryAbility.ets');
const packageJson = source('package.json');
const arktsTestPackageGate = source('scripts/test.mjs');
const arktsEmulatorRunner = source('scripts/run_ohos_device_tests.mjs');
const brightnessSunAsset = source('entry/src/main/resources/base/media/reader_control_brightness_sun.svg');
const readerControlIconEvidence = json('docs/design/FIGMA_READER_CONTROL_ICON_EXPORT_EVIDENCE.json');
const readerControlIconCrosswalk = json('docs/design/FIGMA_READER_CONTROL_ICON_CROSSWALK.json');
const readerQuickReplaceCloseIconEvidence = json('docs/design/FIGMA_READER_QUICK_REPLACE_CLOSE_ICON_EVIDENCE.json');
const sourceManagementIconEvidence = json('docs/design/FIGMA_SOURCE_MANAGEMENT_ICON_EXPORT_EVIDENCE.json');
const searchIconEvidence = json('docs/design/FIGMA_SEARCH_ICON_EXPORT_EVIDENCE.json');
const webdavIconEvidence = json('docs/design/FIGMA_WEBDAV_ICON_EXPORT_EVIDENCE.json');
const restoreBackupIconEvidence = json('docs/design/FIGMA_RESTORE_BACKUP_ICON_EXPORT_EVIDENCE.json');
const discoverIconEvidence = json('docs/design/FIGMA_DISCOVER_ICON_EXPORT_EVIDENCE.json');
const searchResultCoverEvidence = json('docs/design/FIGMA_SEARCH_RESULT_COVER_ADAPTATION_EVIDENCE.json');
const sharedShellGeometryEvidence = json('docs/design/FIGMA_SHARED_SHELL_GEOMETRY_EVIDENCE.json');

test('Reader-UI registry has one current Figma authority', () => {
  assert.equal(registry.kind, 'FIGMA_VISUAL_ADMISSION_REGISTRY');
  assert.equal(registry.authority.fileKey, 'klhs2jMM4MncaJFqZMfqEK');
  const revisions = [...new Set(registry.records
    .filter((record) => record.classification === 'exact-figma-binding')
    .map((record) => record.figma?.revision)
    .filter((revision) => typeof revision === 'string' && revision.length > 0))];
  assert.deepEqual(revisions, ['2379851596474967636']);
  assert.ok(registry.records.every((record) => Array.isArray(record.routeIds)),
    'every visual record must state the routes it governs');
});

test('generated visual admission artifact is synchronized to the current registry', () => {
  const expectedRevision = registry.records.find((record) => record.classification === 'exact-figma-binding')?.figma?.revision;
  assert.ok(visualAdmission.includes(`SOURCE_FILE_KEY: string = '${registry.authority.fileKey}'`));
  assert.ok(visualAdmission.includes(`SOURCE_REVISION: string = '${expectedRevision}'`));
  // The generator now emits a two-dimensional gate per entry: `sourceBound`
  // (Figma identity registered) and `implementationReady` (page family
  // delivered). A `candidate-backport` route is source-bound but NOT
  // implementation-ready; an `implementation-ready` route is both. The old
  // single `admitted` flag is gone — asserting it would let a
  // candidate-backport page be confused with a deliverable surface.
  for (const record of registry.records.filter((item) => item.classification === 'exact-figma-binding')) {
    const expectedAdmission = record.harmony?.status === 'implementation-ready'
      ? 'implementation-ready' : 'candidate-backport';
    const expectedImplementationReady = expectedAdmission === 'implementation-ready';
    for (const routeId of record.routeIds) {
      assert.ok(visualAdmission.includes(
        `routeId: '${routeId}', admission: '${expectedAdmission}', sourceBound: true, implementationReady: ${expectedImplementationReady}`),
        `generated admission is missing current exact route ${routeId} as ${expectedAdmission}`);
    }
  }
});

test('generated visual admission artifact is internally consistent — admission ↔ implementationReady', () => {
  // The two-dimensional gate must be self-consistent. This is the heart of
  // the execution gate: `candidate-backport` must never carry
  // `implementationReady: true`, and `implementation-ready` must never carry
  // `implementationReady: false`. Without this, a renderer that checks only
  // `implementationReady` (or only `admission`) could let a not-yet-delivered
  // page family through.
  const entryPattern = /\{ routeId: '[^']*', admission: '(implementation-ready|candidate-backport|blocked|retired)', sourceBound: (true|false), implementationReady: (true|false), recordIds: \[[^\]]*\] \}/g;
  const routeEntries = [...visualAdmission.matchAll(entryPattern)];
  assert.ok(routeEntries.length > 0, 'no route admission entries found in generated artifact');
  for (const match of routeEntries) {
    const admission = match[1];
    const sourceBound = match[2] === 'true';
    const implementationReady = match[3] === 'true';
    if (admission === 'implementation-ready') {
      assert.equal(implementationReady, true, `implementation-ready route must have implementationReady=true: ${match[0]}`);
      assert.equal(sourceBound, true, `implementation-ready route must have sourceBound=true: ${match[0]}`);
    } else if (admission === 'candidate-backport') {
      assert.equal(implementationReady, false, `candidate-backport route must have implementationReady=false: ${match[0]}`);
      assert.equal(sourceBound, true, `candidate-backport route must have sourceBound=true: ${match[0]}`);
    } else {
      assert.equal(implementationReady, false, `${admission} route must have implementationReady=false: ${match[0]}`);
    }
  }
  // The renderer gate methods must check === 'implementation-ready', not
  // just truthiness or a loose comparison. This is what makes
  // candidate-backport fail closed at runtime.
  assert.ok(visualAdmission.includes("admissionForRoute(routeId) === 'implementation-ready'"),
    'isRouteAdmitted must gate on === implementation-ready');
  assert.ok(visualAdmission.includes("admissionForRouteViewport(routeId, viewport) === 'implementation-ready'"),
    'isRouteAdmittedForViewport must gate on === implementation-ready');
  assert.ok(visualAdmission.includes("admissionForOverlay(overlayKind) === 'implementation-ready'"),
    'isOverlayAdmitted must gate on === implementation-ready');
  assert.ok(visualAdmission.includes("admissionForState(routeId, stateId) === 'implementation-ready'"),
    'isStateAdmitted must gate on === implementation-ready');
});

test('every admitted native visual has a live Figma node, master, and viewport source', () => {
  assert.equal(liveSourceSnapshot.fileKey, registry.authority.fileKey);
  assert.equal(liveSourceSnapshot.summary.allExpectedNodesFound, true);
  assert.equal(liveSourceSnapshot.summary.detachedSubstitutesAccepted, false);
  assert.equal(liveSourceSnapshot.summary.foundNodeCount, 110);
  const liveNodeIds = new Set(liveSourceSnapshot.nodes.map((node) => node.id));
  for (const record of registry.records.filter((item) => item.classification === 'exact-figma-binding')) {
    assert.ok(record.figma?.canonicalMasterId, `${record.id} has no canonical Figma master`);
    assert.ok(record.figma?.nodeId, `${record.id} has no current Figma node`);
    assert.ok(liveNodeIds.has(record.figma.canonicalMasterId), `${record.id} master is absent from live Figma snapshot`);
    assert.ok(liveNodeIds.has(record.figma.nodeId), `${record.id} node is absent from live Figma snapshot`);
    for (const [viewport, nodeId] of Object.entries(record.figma.viewportNodes || {})) {
      // Some overlay/route-variant masters intentionally have no individual
      // viewport child. Their canonical master remains the visual source.
      if (nodeId === null) continue;
      assert.ok(typeof nodeId === 'string' && nodeId.length > 0, `${record.id}/${viewport} has no viewport node`);
      assert.ok(liveNodeIds.has(nodeId), `${record.id}/${viewport} is absent from live Figma snapshot`);
    }
    for (const routeId of record.routeIds || []) {
      // Source-bound routes now appear as either `implementation-ready` or
      // `candidate-backport` depending on harmony.status. Both carry
      // `sourceBound: true`; the distinction is captured by
      // `implementationReady`. Asserting `admission: 'admitted'` here would
      // let a candidate-backport page family be confused with a deliverable.
      assert.ok(visualAdmission.includes(`routeId: '${routeId}', admission: `) &&
        visualAdmission.includes(`routeId: '${routeId}', admission: '`) &&
        /\{ routeId: '[^']*', admission: '(implementation-ready|candidate-backport)', sourceBound: true,/.test(
          visualAdmission.match(new RegExp(`\\{ routeId: '${routeId}',[^}]*\\}`))?.[0] || ''),
        `${record.id}/${routeId} is not source-bound in the generated Figma contract`);
    }
    for (const overlayKind of record.overlayKinds || []) {
      assert.ok(visualAdmission.includes(`overlayKind: '${overlayKind}', admission: `) &&
        /\{ overlayKind: '[^']*', admission: '(implementation-ready|candidate-backport)', sourceBound: true,/.test(
          visualAdmission.match(new RegExp(`\\{ overlayKind: '${overlayKind}',[^}]*\\}`))?.[0] || ''),
        `${record.id}/${overlayKind} is not source-bound in the generated Figma contract`);
    }
  }
});

test('the visual token ledger is revision-bound and generated into the native contract', () => {
  assert.equal(ledger.kind, 'FIGMA_VISUAL_TOKEN_LEDGER');
  assert.equal(ledger.authority.registry, 'docs/design/FIGMA_VISUAL_ADMISSION_REGISTRY.json');
  assert.equal(ledger.authority.fileKey, registry.authority.fileKey);
  assert.equal(ledger.authority.revision, '2379851596474967636');
  const exactIds = new Set(registry.records
    .filter((record) => record.classification === 'exact-figma-binding')
    .map((record) => record.id));
  for (const token of ledger.tokens) {
    assert.ok(exactIds.has(token.recordId), `${token.id} points at non-exact record ${token.recordId}`);
    assert.ok(typeof token.nodeId === 'string' && token.nodeId.length > 0, `${token.id} has no node`);
    assert.ok(typeof token.property === 'string' && token.property.length > 0, `${token.id} has no provenance`);
    assert.ok(visualAdmission.includes(`static readonly ${token.id}:`), `${token.id} was not generated`);
  }
  const digest = crypto.createHash('sha256').update(ledgerSource).digest('hex');
  assert.ok(visualAdmission.includes(`LEDGER_SHA256: string = '${digest}'`), 'generated ledger digest is stale');
});

test('HarmonyOS has no Figma parallel root, policy, manifest, or token authority', () => {
  const retiredPaths = [
    'entry/src/main/ets/ui/tokens/FigmaReadingVisualTokens.ets',
    'entry/src/main/ets/ui/tokens/FigmaVisualConstraintManifest.ets',
    'entry/src/main/ets/ui/router/FigmaVisualRouteAdmissionPolicy.ets',
    'entry/src/main/ets/ui/router/FigmaVisualOverlayAdmissionPolicy.ets',
    'entry/src/main/ets/ui/router/FigmaVisualStateAdmissionPolicy.ets',
    'scripts/figma_reading_static_parity.test.mjs',
  ];
  for (const relativePath of retiredPaths) {
    assert.equal(exists(relativePath), false, `retired parallel authority still exists: ${relativePath}`);
  }
  for (const file of etsFiles()) {
    const base = path.basename(file);
    assert.equal(/^Figma.*Root\.ets$/.test(base), false, `parallel root survives: ${base}`);
    assert.equal(/^FigmaVisual.*(AdmissionPolicy|ConstraintManifest)\.ets$/.test(base), false,
      `parallel visual authority survives: ${base}`);
    assert.notEqual(base, 'FigmaExactRouteRenderer.ets', 'parallel exact-route renderer survives');
    assert.notEqual(base, 'ReaderControlIcon.ets', 'retired local control-icon parallel layer survives');
  }
});

test('all visual consumers consult the generated Reader-UI authority without hidden fallback nodes', () => {
  assert.ok(routeRenderer.includes("import { ReaderUiVisualAdmission } from '../../contract/reader_ui/VisualAdmission';"));
  assert.ok(routeRenderer.includes('isRouteAdmittedForViewport(this.displayedRouteId, this.viewportClass)'));
  assert.ok(routeRenderer.includes('shell !== null'), 'unadmitted routes must require a source-generated shell mapping');
  assert.equal(routeRenderer.includes('Column().width(0).height(0)'), false,
    'unadmitted routes must not use a hidden zero-size placeholder');
  assert.ok(viewStateRenderer.includes('ReaderUiVisualAdmission'), 'view-state renderer must consume generated admission');
  assert.ok(overlayHost.includes('ReaderUiVisualAdmission.isOverlayAdmitted(this.overlayKind)'));
  assert.equal(overlayHost.includes('Column().width(0).height(0)'), false,
    'unadmitted overlays must not use a hidden zero-size placeholder');
  assert.ok(stateHost.includes('STATE_HOST_RETIRED'),
    'the generic state fallback must be explicitly retired rather than rendered inert');
  assert.equal(stateHost.includes('@Component'), false,
    'the retired generic StateHost must not remain an instantiable visual component');
});

test('active Reader source quarantine removes only historical mappings whose owning record remains active', () => {
  assert.equal(routeReconstructionQuarantine.status, 'active');
  const trackedRouteIds = routeReconstructionQuarantine.entries.flatMap((entry) => entry.routeIds);
  assert.equal(trackedRouteIds.length, 16, 'A3 must retain the full audited Reader route set');
  assert.equal(new Set(trackedRouteIds).size, 16, 'a tracked route must have one source owner');
  const routeIds = routeReconstructionQuarantine.entries
    .filter((entry) => entry.status === 'active')
    .flatMap((entry) => entry.routeIds);
  assert.ok(routeIds.length > 0, 'at least one source record must remain actively quarantined');
  for (const routeId of routeIds) {
    assert.equal(routeTable.includes(`'${routeId}'`), false,
      `${routeId} must not remain in generated native RouteTable`);
    assert.equal(viewStateTable.includes(`\"routeId\": \"${routeId}\"`), false,
      `${routeId} must not remain in generated native ViewStateTable`);
  }
  assert.ok(routeRenderer.includes('const shell: string | null = this.shellOfDisplayedRoute();'),
    'RouteRenderer must resolve the source-generated shell once before any native shell mounts');
  assert.ok(routeRenderer.includes('this.isDisplayedRouteImplementationReady() && shell !== null'),
    'RouteRenderer must require both implementation readiness and a non-quarantined source shell');
});

test('candidate-backport page families fail closed at every active renderer execution gate', () => {
  // This is the execution gate that was missing on 2026-07-27: the renderers
  // consumed `isRouteAdmitted` / `isOverlayAdmitted` / `isStateAdmitted`
  // without distinguishing `candidate-backport` (source-bound but not
  // delivered) from `implementation-ready` (deliverable). The generated
  // artifact now gates on === 'implementation-ready', and every renderer must
  // document that `candidate-backport` is a stop condition, not a renderable
  // state. This test makes that contract enforceable, not just documentary.
  //
  // RouteRenderer: the shell gate must mention both `implementation-ready`
  // (the only passing status) and `candidate-backport` (the fail-closed
  // status) so a future edit cannot silently collapse the two dimensions.
  assert.ok(routeRenderer.includes('implementation-ready'),
    'RouteRenderer must document implementation-ready as the renderer execution gate');
  assert.ok(routeRenderer.includes('candidate-backport'),
    'RouteRenderer must document candidate-backport as a fail-closed stop condition');
  assert.ok(routeRenderer.includes('isDisplayedRouteImplementationReady'),
    'RouteRenderer must name its gate method after implementation-ready, not the old admitted flag');

  // ViewStateRenderer: the body gate must fail closed for candidate-backport.
  assert.ok(viewStateRenderer.includes('implementation-ready'),
    'ViewStateRenderer must document implementation-ready as the body execution gate');
  assert.ok(viewStateRenderer.includes('candidate-backport'),
    'ViewStateRenderer must document candidate-backport as a fail-closed stop condition');

  // OverlayHost: the overlay gate must fail closed for candidate-backport.
  assert.ok(overlayHost.includes('implementation-ready'),
    'OverlayHost must document implementation-ready as the overlay execution gate');
  assert.ok(overlayHost.includes('candidate-backport'),
    'OverlayHost must document candidate-backport as a fail-closed stop condition');

  // The generic StateHost had no exact Figma master, so the correct closure is
  // source-level removal from every shell rather than a fourth hidden gate.
  assert.ok(stateHost.includes('STATE_HOST_RETIRED'),
    'generic state host must be retired when no exact Figma state master exists');
  for (const shell of [readerShell, mainTabShell, libraryShell, settingsShell]) {
    assert.equal(shell.includes('StateHost('), false,
      'a shell must not mount the retired generic state host');
  }
});

test('legacy generated state primitives cannot draw a local loading or error page over an admitted Figma route', () => {
  assert.ok(viewStateRenderer.includes("component.type === 'Loading' || component.type === 'Empty' ||"),
    'ViewStateRenderer must identify legacy generated state primitives together');
  assert.ok(viewStateRenderer.includes('These old generated primitives have no component-level Figma master'),
    'the source-led state exception boundary must remain documented');
  for (const stateId of ['loading', 'empty', 'error']) {
    // The Search five-state master is source-bound but currently
    // candidate-backport (implementationReady: false). The state still
    // registers in the generated artifact so it cannot be silently dropped,
    // but it must fail closed at the renderer until the family is
    // implementation-ready.
    assert.ok(visualAdmission.includes(
      `{ routeId: 'book-search', stateId: '${stateId}', admission: 'candidate-backport', sourceBound: true, implementationReady: false, recordIds: ['search.five-state'] }`),
      `the confirmed Figma Search five-state master must register book-search/${stateId} as candidate-backport`);
  }
  for (const legacyMount of ['Loading', 'ErrorState', 'Offline']) {
    assert.equal(new RegExp(`\\b${legacyMount}\\(\\{`).test(viewStateRenderer), false,
      `ViewStateRenderer must not mount generic ${legacyMount} as a Figma substitute`);
  }
  for (const stale of ['Loading()', 'Empty()', 'ErrorState()', 'Offline()', 'ColorTokens.paper']) {
    assert.equal(stateHost.includes(stale), false,
      `StateHost must not revive generic state overlay ${stale}`);
  }
});

test('paper reading surface uses the current Figma layer and contains no synthetic shadow texture', () => {
  for (const token of [
    'readerPaperBaseStart', 'readerPaperBaseEnd', 'readerPaperVignetteTransparent',
    'readerPaperVignette', 'readerPaperHighlight', 'readerPaperHighlightTransparent',
  ]) {
    assert.ok(readerComponents.includes(`ReaderUiVisualTokens.${token}`), `paper layer misses ${token}`);
  }
  assert.ok(readerComponents.includes("$r('app.media.figma_reader_paper_tile')"));
  assert.ok(readerComponents.includes('objectRepeat(ImageRepeat.XY)'));
  for (const forbidden of ['textureLines()', 'starPoints()', 'night aura']) {
    assert.equal(readerComponents.includes(forbidden), false, `synthetic paper treatment remains: ${forbidden}`);
  }
});

test('reader chapter text frame preserves the exact Figma Phone and Tablet geometry', () => {
  const textFlow = structSource(readerComponents, 'ReadingTextFlow');
  const exactTokens = [
    'readerContentInk', 'readerContentBodyFontFamily', 'readerContentBodySize',
    'readerContentBodyLineHeight', 'readerContentParagraphIndent',
    'readerContentParagraphGap', 'readerContentSectionGap', 'readerContentTitleSize',
    'readerContentTitleLineHeight', 'readerContentPhoneLeft', 'readerContentPhoneTop',
    'readerContentPhoneRight', 'readerContentPhoneBottom', 'readerContentPhoneWidth',
    'readerContentPhoneHeight', 'readerContentTabletLeft', 'readerContentTabletTop',
    'readerContentTabletRight', 'readerContentTabletBottom', 'readerContentTabletWidth',
    'readerContentTabletHeight',
  ];
  for (const token of exactTokens) {
    assert.ok(visualAdmission.includes(`static readonly ${token}`),
      `Reader-UI ledger is missing ReadingSurface token ${token}`);
  }
  // Width/height are provenance for the two Figma canvases. The runtime uses
  // the corresponding four source insets so it can remain responsive without
  // pinning a wider device to a left-aligned 390/760px frame.
  const consumedFrameTokens = exactTokens.filter((token) =>
    !token.endsWith('PhoneWidth') && !token.endsWith('PhoneHeight') &&
    !token.endsWith('TabletWidth') && !token.endsWith('TabletHeight'));
  for (const token of consumedFrameTokens) {
    assert.ok(textFlow.includes(`ReaderUiVisualTokens.${token}`),
      `ReadingTextFlow must consume Figma ReadingSurface token ${token}`);
  }
  for (const nodeId of ['1023:18357', '1023:18373', '1197:10573', '1197:10574']) {
    assert.ok(ledger.tokens.some((token) => token.nodeId === nodeId),
      `ReadingSurface source node is not bound into the token ledger: ${nodeId}`);
  }
  assert.equal(textFlow.includes("reader.pageSpace.topMargin"), false,
    'a removed local page-margin setting must not change the Figma text frame');
  assert.equal(textFlow.includes("reader.pageSpace.sideMargin"), false,
    'a removed local side-margin setting must not change the Figma text frame');
  assert.equal(textFlow.includes('SpacingTokens.'), false,
    'ReadingTextFlow must not fall back to generic spacing for its source-exact frame');
  assert.equal(textFlow.includes('DemoAliasTokens.'), false,
    'ReadingTextFlow must not fall back to generic visual aliases');
});

test('reader page animation labels and layout mapping preserve the Figma rule', () => {
  assert.ok(readerOverlays.includes("values: ['覆盖', '滑动', '仿真', '滚动', '无动画']"));
  assert.ok(readerReducer.includes("return normalizePageAnimation(animation) === 'scroll' ? 'vertical' : 'horizontal';"));
  assert.ok(readerReducer.includes("options.pageAnimation = paginationMode === 'vertical'\n          ? 'scroll'"));
  assert.ok(readerComponents.includes("case 'scroll':\n      case '滚动':\n        return 'scroll';"));
  assert.ok(readerComponents.includes("private verticalReading(): boolean {\n    return this.paginationMode === 'vertical';"));
  assert.ok(readerComponents.includes('Scroll(this.verticalScroller)'), 'scroll reading must use a native Scroll');
});

test('reader top-bar more opens the dedicated reader control layer', () => {
  assert.ok(readerComponents.includes("accessibilityText('打开阅读控制栏')"));
  assert.ok(readerComponents.includes("ReaderUiStore.dispatch({ type: 'route-push', id: 'reader' })"));
  assert.equal(readerComponents.includes('更多操作当前不可用'), false,
    'the reader more affordance must not fall back to an unavailable or bookshelf action');
});

test('reader controls consume byte-exact current Figma icon exports', () => {
  assert.equal(readerControlIconEvidence.fileKey, registry.authority.fileKey);
  assert.equal(readerControlIconCrosswalk.fileKey, registry.authority.fileKey);
  assert.equal(readerControlIconEvidence.officialFileRevision, '2379851596474967636');
  assert.equal(readerControlIconEvidence.capture.readOnlyFigma, true);
  assert.equal(readerControlIconEvidence.capture.figmaWrites, false);
  assert.equal(readerControlIconEvidence.exports.length, 25);
  const moreBinding = readerControlIconCrosswalk.bindings.find((binding) => binding.semantic === 'more');
  assert.equal(moreBinding?.destinationSurfaceStatus, 'reader-control-home-bound');
  const visibleReaderSource = `${readerComponents}\n${readerOverlays}`;
  const expectedByResource = new Map(readerControlIconEvidence.exports.map((icon) => [icon.resource, icon]));
  for (const binding of readerControlIconCrosswalk.bindings) {
    for (const icon of binding.exports || []) {
      const current = expectedByResource.get(icon.resource);
      assert.ok(current, `Figma crosswalk lacks current export evidence: ${icon.resource}`);
      assert.equal(icon.sha256, current.sha256, `Figma crosswalk hash is stale: ${icon.resource}`);
      assert.equal(icon.bytes, current.bytes, `Figma crosswalk byte count is stale: ${icon.resource}`);
    }
  }
  for (const icon of readerControlIconEvidence.exports) {
    const localFile = path.resolve(REPO, '..', icon.localFile);
    assert.equal(fs.existsSync(localFile), true, `Figma icon is missing: ${icon.resource}`);
    const bytes = fs.readFileSync(localFile);
    const digest = crypto.createHash('sha256').update(bytes).digest('hex');
    assert.equal(digest, icon.sha256, `Figma icon drifted: ${icon.resource}`);
    assert.equal(bytes.length, icon.bytes, `Figma icon byte count drifted: ${icon.resource}`);
    assert.ok(visibleReaderSource.includes(`reader_control_${icon.resource.slice('reader_control_'.length)}`),
      `visible reader UI does not consume Figma icon: ${icon.resource}`);
  }
});

test('TTS stays inside the app and uses canonical Reader-UI events', () => {
  assert.ok(ttsHost.includes("import { textToSpeech } from '@kit.CoreSpeechKit';"));
  assert.ok(ttsHost.includes('TextToSpeechEngine'));
  assert.equal(/\bTextReader\b/.test(ttsHost), false, 'system full-screen TextReader is prohibited');
  assert.ok(readerOverlays.includes('ReaderUiStore.startTtsFromReaderSurface()'),
    'TTS controls must enter the active reader surface before starting');
  assert.ok(readerOverlays.includes("type: 'reader-tts-stop'"));
  assert.ok(readerUiStore.includes("ReaderUiStore.dispatch({ type: 'reader-tts-start' });"),
    'only the guarded active-reader transition may dispatch a TTS start');
  assert.ok(effects.includes("case 'reader-tts-start':"));
  assert.ok(effects.includes("case 'reader-tts-stop':"));
  const ttsEvidenceStart = hostCapabilityManifest.indexOf("'TtsSelfCheck': [");
  const ttsEvidenceEnd = hostCapabilityManifest.indexOf('],', ttsEvidenceStart);
  assert.ok(ttsEvidenceStart >= 0 && ttsEvidenceEnd > ttsEvidenceStart, 'TTS evidence map is missing');
  const ttsEvidence = hostCapabilityManifest.slice(ttsEvidenceStart, ttsEvidenceEnd);
  assert.ok(ttsEvidence.includes("'tts.system.start'"));
  assert.ok(ttsEvidence.includes("'tts.system.stop'"));
  assert.equal(ttsEvidence.includes("'tts.system.pause'"), false,
    'the start/stop self-check must not fabricate pause proof');
  assert.equal(ttsEvidence.includes("'tts.system.resume'"), false,
    'the start/stop self-check must not fabricate resume proof');
  assert.equal(coreRuntime.includes("case 'tts.system.pause':\n        case 'tts.system.resume':\n        case 'background.schedule':"), false,
    'Core availability must not claim unsupported pause/resume');
  assert.ok(readerUiHostPlatform.includes("case 'tts.system.resume':\n      case 'tts.pause': return false;"),
    'Reader-UI host platform must fail closed for unsupported pause/resume');
});

test('full TTS uses the current Figma layout, not the retired generic capability cards', () => {
  const start = readerOverlays.indexOf('struct ReaderFullTtsSwitch');
  const end = readerOverlays.indexOf('export struct ReaderFullAppearancePage');
  assert.ok(start >= 0 && end > start, 'full TTS block missing');
  const fullTts = readerOverlays.slice(start, end);
  for (const label of ['播放控制区', '定时', '语速', '详细配置', 'TTS 配置', '设备引擎']) {
    assert.ok(fullTts.includes(`'${label}'`), `full TTS misses current Figma section ${label}`);
  }
  for (const token of [
    'readerFullTtsTransportSurface', 'readerFullTtsPrimary', 'readerFullTtsInk',
    'readerFullTtsMuted', 'readerFullTtsControlInk', 'readerFullTtsFieldSurface',
    'readerFullTtsSwitchActive', 'readerFullTtsSwitchInactive',
  ]) {
    assert.ok(fullTts.includes(`ReaderUiVisualTokens.${token}`), `full TTS misses generated token ${token}`);
  }
  for (const geometry of ['ReaderFullTtsTimerDial', 'ReaderFullTtsSwitch', 'ReaderFullTtsEngineTab']) {
    assert.ok(fullTts.includes(geometry), `full TTS misses its current Figma structure: ${geometry}`);
  }
  assert.equal(fullTts.includes('ColorTokens.'), false,
    'full TTS must not fall back to the generic Harmony color palette');
  assert.equal(fullTts.includes('DemoAliasTokens.'), false,
    'full TTS must not fall back to generic rounded-card tokens');
  assert.equal(fullTts.includes("Text('—')"), false,
    'full TTS must not replace Figma switches with unavailable-state dashes');
  assert.ok(fullTts.includes("reader_control_tts_stop"), 'full TTS must use the exact Figma stop asset');
  for (const staleCopy of ['Host 未提供映射', 'Core/Host 未接入', 'HttpTTS 合同与凭据/播放闭环未接入']) {
    assert.equal(fullTts.includes(staleCopy), false, `retired generic full-TTS copy remains: ${staleCopy}`);
  }
});

test('quick directory uses the approved row source and does not invent bookmark state cards', () => {
  const start = readerOverlays.indexOf('export struct ReaderDirectoryPanel');
  const end = readerOverlays.indexOf('// ── Appearance panel', start);
  assert.ok(start >= 0 && end > start, 'quick Reader directory block is missing');
  const directory = readerOverlays.slice(start, end);
  assert.ok(directory.includes('ReaderFullBookmarkRow({ bookmark: bookmark })'));
  assert.equal(directory.includes('ReaderBookmarkLiveRow({ bookmark: bookmark })'), false,
    'quick directory must not revive the generic bookmark jump/delete card');
  assert.equal(directory.includes('ColorTokens.'), false,
    'quick directory must not use generic message palette as a missing Figma state');
  for (const stale of ['尚未打开书籍，无法读取 Core 书签。', '正在从 Core 读取当前书的书签…', '书签操作失败：', '当前书在 Core 中还没有书签。']) {
    assert.equal(directory.includes(stale), false, `unbound quick-directory state remains: ${stale}`);
  }
});

test('all current Reader Figma surfaces reject generic visual fallback tokens', () => {
  const currentSurfaces = [
    'ReaderControlSheet', 'ReaderBottomBar', 'ReaderDirectoryPanel', 'ReaderAppearancePanel',
    'ReaderTtsPanel', 'ReaderSettingsPanel', 'ReaderFullDirectoryPage', 'ReaderFullTtsPage',
    'ReaderFullAppearancePage', 'ReaderFullSettingsPage', 'ReaderSearchPanel',
    'ReaderReplacePanel', 'ReaderAutoScrollPanel',
  ];
  for (const name of currentSurfaces) {
    const current = structSource(readerOverlays, name);
    assert.equal(current.includes('ColorTokens.'), false, `${name} uses generic ColorTokens fallback`);
    assert.equal(current.includes('DemoAliasTokens.'), false, `${name} uses generic DemoAliasTokens fallback`);
    assert.equal(current.includes('ReaderTypography.'), false, `${name} uses generic ReaderTypography fallback`);
    assert.equal(/#[0-9A-Fa-f]{6,8}/.test(current), false, `${name} duplicates a visual literal outside Reader-UI ledger`);
  }
});

test('a current Reader Figma surface cannot regain a generic helper through its component graph', () => {
  const roots = [
    'ReaderControlSheet', 'ReaderBottomBar', 'ReaderDirectoryPanel', 'ReaderAppearancePanel',
    'ReaderTtsPanel', 'ReaderSettingsPanel', 'ReaderFullDirectoryPage', 'ReaderFullTtsPage',
    'ReaderFullAppearancePage', 'ReaderFullSettingsPage', 'ReaderSearchPanel',
    'ReaderReplacePanel', 'ReaderAutoScrollPanel',
  ];
  const reachable = reachableStructSources(readerOverlays, roots);
  for (const [name, current] of reachable) {
    assert.equal(current.includes('ColorTokens.'), false,
      `${name} is reachable from a current Figma surface but uses generic ColorTokens`);
    assert.equal(current.includes('DemoAliasTokens.'), false,
      `${name} is reachable from a current Figma surface but uses generic DemoAliasTokens`);
    assert.equal(current.includes('ReaderTypography.'), false,
      `${name} is reachable from a current Figma surface but uses generic ReaderTypography`);
    assert.equal(/#[0-9A-Fa-f]{6,8}/.test(current), false,
      `${name} is reachable from a current Figma surface but duplicates a raw visual literal`);
  }
});

test('quick replacement close uses the current Figma vector, not a text-glyph approximation', () => {
  assert.equal(readerQuickReplaceCloseIconEvidence.fileKey, registry.authority.fileKey);
  assert.equal(readerQuickReplaceCloseIconEvidence.officialFileRevision, '2379851596474967636');
  assert.equal(readerQuickReplaceCloseIconEvidence.capture.readOnlyFigma, true);
  assert.equal(readerQuickReplaceCloseIconEvidence.capture.figmaWrites, false);
  const exportPlan = readerQuickReplaceCloseIconEvidence.export;
  const localFile = path.resolve(REPO, '..', exportPlan.localFile);
  const bytes = fs.readFileSync(localFile);
  assert.equal(bytes.length, exportPlan.bytes, 'quick replacement close SVG byte count drifted');
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), exportPlan.sha256,
    'quick replacement close SVG drifted from the Figma export');
  const replace = structSource(readerOverlays, 'ReaderReplacePanel');
  assert.ok(replace.includes(`app.media.${exportPlan.resource}`));
  assert.equal(replace.includes("Text('×')"), false,
    'quick replacement close must not use a typographic × substitute');
});

test('Reader settings quick and full panels use the current Figma control set', () => {
  const quickStart = readerOverlays.indexOf('struct ReaderQuickSettingsSegment');
  const quickEnd = readerOverlays.indexOf('// ── Full reader pages', quickStart);
  assert.ok(quickStart >= 0 && quickEnd > quickStart, 'quick Reader settings panel is missing');
  const quick = readerOverlays.slice(quickStart, quickEnd);
  for (const label of ['屏幕方向', '翻页样式', '屏幕超时', '跟随系统', '竖屏', '横屏', '仿真', '滚动', '无动画', '始终开启']) {
    assert.ok(quick.includes(`'${label}'`), `quick Reader settings misses Figma label ${label}`);
  }
  for (const stale of ['自动翻页', '点击翻页方式', '阅读缓存与预取', '页脚进度信息', '触摸反馈', '未接入按键监听', '未接入方向 Host']) {
    assert.equal(quick.includes(stale), false, `quick Reader settings retains non-Figma row ${stale}`);
  }
  for (const token of [
    'readerQuickSettingsFontFamily', 'readerQuickSettingsPanelHeight', 'readerQuickSettingsSegmentSurface',
    'readerQuickSettingsSelectedSurface',
  ]) {
    assert.ok(quick.includes(`ReaderUiVisualTokens.${token}`), `quick Reader settings misses generated token ${token}`);
  }

  const fullStart = readerOverlays.indexOf('struct ReaderFullFigmaChoiceRow');
  const fullEnd = readerOverlays.indexOf('struct ReaderUtilitySummaryCard', fullStart);
  assert.ok(fullStart >= 0 && fullEnd > fullStart, 'full Reader settings panel is missing');
  const full = readerOverlays.slice(fullStart, fullEnd);
  for (const label of ['屏幕样式', '导航状态栏', '排版', '控制', '隐藏导航栏', '拓展到刘海（灵动岛）', '文字两端对齐', '息屏终止朗读', '长按选择文本']) {
    assert.ok(full.includes(`'${label}'`), `full Reader settings misses Figma label ${label}`);
  }
  for (const stale of ['自动翻页', '阅读缓存与预取', 'Core 状态、预取与清理已接入', '未接入按键监听', '未接入方向 Host']) {
    assert.equal(full.includes(stale), false, `full Reader settings retains non-Figma row ${stale}`);
  }
  assert.ok(full.includes('ReaderUiVisualTokens.readerFullSettingsFontFamily'));
});

test('reader brightness rail keeps the Figma geometry and automatic-brightness affordance', () => {
  const railStart = readerOverlays.indexOf('struct ReaderBrightnessRail');
  const railEnd = readerOverlays.indexOf('// ── Control sheet', railStart);
  assert.ok(railStart >= 0 && railEnd > railStart, 'Reader brightness rail is missing');
  const rail = readerOverlays.slice(railStart, railEnd);
  for (const token of [
    'readerBrightnessRailWidth', 'readerBrightnessRailHeight', 'readerBrightnessRailSurface',
    'readerBrightnessRailBorder', 'readerBrightnessTrackWidth', 'readerBrightnessTrackHeight',
    'readerBrightnessAutoHitWidth', 'readerBrightnessAutoInnerHighlight',
  ]) {
    assert.ok(rail.includes(`ReaderUiVisualTokens.${token}`), `brightness rail misses ${token}`);
  }
  assert.equal(rail.includes(".height('100%')"), false,
    'brightness rail must not stretch to an arbitrary module height');
  assert.ok(rail.includes("accessibilityText('自动亮度')"));
  assert.ok(brightnessSunAsset.includes('stroke="#2F6373"'));
  assert.ok(brightnessSunAsset.includes('stroke-width="1.45833"'));
});

test('reader control home consumes the exact Figma dock, module nav, and top bar rather than legacy generic chrome', () => {
  const sheetStart = readerOverlays.indexOf('export struct ReaderControlSheet');
  const sheetEnd = readerOverlays.indexOf('// ── Control bottom bar', sheetStart);
  const navStart = readerOverlays.indexOf('export struct ReaderBottomBar');
  const navEnd = readerOverlays.indexOf('// ── Panel shell', navStart);
  const topStart = readerComponents.indexOf('export struct ReaderTopArea');
  const topEnd = readerComponents.indexOf('// .fd-immersive-hotzone', topStart);
  assert.ok(sheetStart >= 0 && sheetEnd > sheetStart, 'reader control sheet block is missing');
  assert.ok(navStart >= 0 && navEnd > navStart, 'reader module nav block is missing');
  assert.ok(topStart >= 0 && topEnd > topStart, 'reader top bar block is missing');
  const controlHome = `${readerOverlays.slice(sheetStart, sheetEnd)}\n${readerOverlays.slice(navStart, navEnd)}\n${readerComponents.slice(topStart, topEnd)}`;

  for (const token of [
    'readerControlSurface', 'readerControlTranslucentSurface', 'readerControlQuickActionSurface',
    'readerControlModuleSurface', 'readerControlBorder', 'readerControlGrabber',
    'readerControlStepSurface', 'readerControlProgressTrack', 'readerControlProgressFill',
    'readerControlInk', 'readerControlMuted', 'readerControlModuleInactiveSurface',
    'readerControlModuleInactiveLabel', 'readerControlModuleActive',
    'readerControlTopFontFamily', 'readerControlFontFamily',
  ]) {
    assert.ok(controlHome.includes(`ReaderUiVisualTokens.${token}`),
      `reader control home misses its revision-bound Figma token ${token}`);
  }
  for (const stale of ['ColorTokens.', 'DemoAliasTokens.', 'ReaderTypography.']) {
    assert.equal(controlHome.includes(stale), false,
      `reader control home must not fall back to legacy generic chrome: ${stale}`);
  }
  for (const exactGeometry of [
    'mobileSheetInset: number = 13', 'mobileSheetBottom: number = 19',
    'controlTop: number = 29', 'dockRight: number = 25', 'navBottom: number = 33',
    'quickHeight: number = 75.438', 'return this.wideControlDock() ? 79 : 80',
    '.borderRadius(24)', '.width(77.5)', '.fontSize(10)',
    'return this.safeAreaTop + 19', '.margin({ top: this.topInset() })',
  ]) {
    assert.ok(controlHome.includes(exactGeometry), `reader control home misses Figma geometry: ${exactGeometry}`);
  }
});

test('RSS entry uses the current Figma search copy without a capability warning', () => {
  assert.ok(rss.includes("Text('搜索订阅源、文章标题或分组')"));
  assert.equal(rss.includes('筛选尚未接入'), false);
});

test('bookshelf actions are the approved direct reader, three-action menu, and no-group V1 flow', () => {
  assert.ok(bookshelf.includes('ReaderUiStore.dispatchContinueReading('));
  assert.ok(bookshelf.includes('.onAction(() => this.openBookActions())'),
    'both cover and list entries must invoke the shared long-press action owner');
  for (const label of ["title: '多选'", "title: '书籍信息'", "title: '移除书架'"]) {
    assert.ok(overlayHost.includes(label), `book action menu misses ${label}`);
  }
  assert.equal(overlayHost.includes("title: '分组管理'"), false, 'group management must not return in V1');
  assert.equal(bookshelf.includes('书架分组'), false, 'bookshelf must not expose group controls');
  assert.ok(bookshelf.includes('return isLoaded && books.length > 0;'), 'empty shelf must not reserve continue reading');
  assert.ok(visualAdmission.includes("routeId: 'bookshelf-group-management', admission: 'retired'"));
  assert.ok(bookDetail.includes('canSwitchBookSourceId'), 'local-book source switching guard is missing');
  assert.ok(bookDetail.includes('if (!canSwitchBookSourceId(this.currentBook?.sourceId)) return;'),
    'Book Detail must reject a local-book source-switch action before it can open');
  assert.ok(bookDetail.includes('if (canSwitchBookSourceId(this.currentBook.sourceId) && this.currentBook.sourceName.length > 0)'),
    'Book Detail must hide the source-switch row for local books');
});

test('Bookshelf and Book Detail consume their exact Figma masters without local visual substitutes', () => {
  for (const token of [
    'bookshelfPageSurface', 'bookshelfSectionSurface', 'bookshelfControlFontFamily',
    'bookshelfBookTitleFontFamily', 'bookshelfMainNavSurface', 'bookshelfMainNavActive',
  ]) {
    assert.ok(visualAdmission.includes(`static readonly ${token}`), `Reader-UI is missing ${token}`);
  }
  for (const token of [
    'bookDetailPageSurface', 'bookDetailSectionSurface', 'bookDetailTitleFontFamily',
    'bookDetailChapterSelectedSurface', 'bookDetailChapterCurrentIndicator',
    'bookDetailActionBarGradientOpaque',
  ]) {
    assert.ok(visualAdmission.includes(`static readonly ${token}`), `Reader-UI is missing ${token}`);
  }
  for (const forbidden of ['LocalBookBadge', '书架还空着', '从发现页添加你感兴趣的书', '未提供书籍信息']) {
    assert.equal(bookshelf.includes(forbidden), false, `Bookshelf retains local substitute: ${forbidden}`);
  }
  assert.ok(bookshelf.includes("Image($r('app.media.bookshelf_icon_search_dark'))"),
    'the fifth Figma SectionHeader action is missing');
  assert.ok(bookshelf.includes("id: 'book-search'"), 'SectionHeader search must use the admitted Figma search route');
  assert.equal(bookshelf.includes("Text('当前')"), false,
    'chapter selection must use Figma’s indicator rail, not an invented label');
  assert.ok(bookDetail.includes('ReaderUiVisualTokens.bookDetailChapterCurrentIndicator'));
  assert.ok(bookDetail.includes('ReaderUiVisualTokens.bookDetailChapterSelectedSurface'));
  assert.ok(libraryShell.includes('ReaderUiVisualTokens.bookDetailActionBarOuterHeight + this.safeAreaBottom'),
    'Book Detail must retain the Figma 10px gradient lead-in plus 52px action bar');
  assert.equal(libraryShell.includes('TokenAdapter.colorWithAlpha'), false,
    'Book Detail action gradient must come from the revision-bound Figma token ledger');
  assert.ok(mainTabShell.includes('ReaderUiVisualTokens.bookshelfPageSurface'));
  assert.ok(sharedComponents.includes('ReaderUiVisualTokens.bookshelfMainNavSurface'));
  assert.equal(sharedComponents.includes("this.routeId === 'book-detail' || this.routeId === 'book-detail-toc-preview' ||"), false,
    'Book Detail must not resurrect a non-Figma top-right more affordance');
});

test('empty bookshelf consumes Figma State/BookshelfEmpty and preserves its two approved actions', () => {
  const emptyShelf = structSource(bookshelf, 'BookshelfEmptyState');
  for (const token of [
    'bookshelfEmptySurface', 'bookshelfEmptyBorder', 'bookshelfEmptyWidth', 'bookshelfEmptyHeight',
    'bookshelfEmptyTitleInk', 'bookshelfEmptyBodyInk', 'bookshelfEmptyPrimarySurface',
    'bookshelfEmptyPrimaryLabel', 'bookshelfEmptySecondarySurface', 'bookshelfEmptySecondaryInk',
  ]) {
    assert.ok(visualAdmission.includes(`static readonly ${token}`),
      `State/BookshelfEmpty Figma token is absent: ${token}`);
    assert.ok(emptyShelf.includes(`ReaderUiVisualTokens.${token}`),
      `State/BookshelfEmpty does not consume its Figma token: ${token}`);
  }
  assert.ok(emptyShelf.includes("Image($r('app.media.figma_bookshelf_empty_icon'))"),
    'State/BookshelfEmpty must consume the canonical Figma bookshelf icon asset');
  assert.ok(exists('entry/src/main/resources/base/media/figma_bookshelf_empty_icon.svg'),
    'canonical Figma bookshelf icon asset is missing');
  assert.ok(emptyShelf.includes("type: 'source-import-open'"),
    'empty shelf primary action must open the system multi-file picker');
  assert.ok(emptyShelf.includes("type: 'route-push', id: 'book-search'"),
    'empty shelf secondary action must use the admitted book-search route');
  assert.equal(emptyShelf.includes('Column().width(0).height(0)'), false,
    'Figma State/BookshelfEmpty must not fail closed into a zero-sized blank body');
  assert.ok(viewStateRenderer.includes('BookshelfEmptyState()'),
    'the direct bookshelf-empty route must bypass the generic StatePanel substitute');
  assert.equal(viewStateRenderer.includes('BookshelfEmptyPage({'), false,
    'the generic bookshelf empty page must not remain in the production route');
});

test('generic state host is explicitly removed instead of hidden above Figma controls', () => {
  assert.ok(stateHost.includes('STATE_HOST_RETIRED'),
    'StateHost source must retain an explicit retirement marker');
  assert.equal(stateHost.includes('@Component'), false,
    'StateHost must not leave an invisible component in the visual tree');
  assert.equal(stateHost.includes('Column().width(0).height(0)'), false,
    'StateHost retirement must not use a zero-size hiding node');
  for (const shell of [readerShell, mainTabShell, libraryShell, settingsShell]) {
    assert.equal(shell.includes('StateHost('), false,
      'no production shell may mount the retired generic state host');
  }
});

test('bookshelf multi-select keeps the Figma header and grid pinned to the top of its overlay', () => {
  const multiSelect = structSource(overlayHost, 'OverlayHost');
  assert.ok(multiSelect.includes('@StorageProp(SafeAreaAdapter.K_TOP) safeAreaTop'),
    'a full-screen multi-select overlay must read the measured system top inset');
  assert.ok(multiSelect.includes('.padding({ top: this.safeAreaTop })'),
    'multi-select must reserve the real status-bar region instead of clipping its Figma header under it');
  assert.ok(multiSelect.includes('.height(56)') && multiSelect.includes('.alignItems(VerticalAlign.Center)'),
    'multi-select header must keep its Figma control row vertically centered');
  assert.ok(multiSelect.includes("Text('取消')") && multiSelect.includes('.lineHeight(44)'),
    'multi-select controls must center their Figma text inside the existing 44pt hit targets');
  assert.ok(multiSelect.includes(".layoutWeight(1)\n      .width('100%')\n      .align(Alignment.Top)"),
    'multi-select grid must start below its header instead of vertically centering in the available scroll viewport');
});

test('initial bookshelf state keeps Figma cover mode in context, not in the admission-gated page state', () => {
  const readerUiFixtures = readerUiSource('contracts/fixtures/view-state.fixtures.json');
  assert.ok(readerUiFixtures.includes('"routeId": "bookshelf"') &&
    readerUiFixtures.includes('"pageState": "default"') &&
    readerUiFixtures.includes('"bookshelfViewMode": "cover-mode"'),
  'Reader-UI fixture must keep the default bookshelf master distinct from its cover-mode context');
  assert.ok(demoUiState.includes("routeId: 'bookshelf'"),
    'HarmonyOS must start on the bookshelf route');
  assert.ok(demoUiState.includes("pageState: 'default'"),
    'HarmonyOS initial bookshelf must use Figma-admitted default pageState');
  assert.equal(demoUiState.includes("pageState: 'cover-mode'"), false,
    'cover-mode must not be passed through the page-state admission gate');
});

test('visible shared navigation and back headers cannot fall back to the generic Harmony palette', () => {
  for (const name of ['AppTopBar', 'BackTopBar', 'BottomNav']) {
    const current = structSource(sharedComponents, name);
    for (const stale of ['ColorTokens.', 'DemoAliasTokens.', 'ReaderTypography.']) {
      assert.equal(current.includes(stale), false,
        `${name} must not use generic fallback styling on an admitted Figma surface`);
    }
  }
  for (const token of ['settingsTitleFontFamily', 'settingsTitleInk', 'settingsTitleSize', 'settingsBackBarHeight']) {
    assert.ok(visualAdmission.includes(`static readonly ${token}`),
      `Settings General shared-header token is absent: ${token}`);
    assert.ok(sharedComponents.includes(`ReaderUiVisualTokens.${token}`),
      `BackTopBar does not consume the current Settings General token ${token}`);
  }
  for (const shell of [mainTabShell, settingsShell, libraryShell]) {
    assert.equal(shell.includes('ColorTokens.paper'), false,
      'shell fallback surface must come from Reader-UI visual admission, not ColorTokens.paper');
  }
});

test('shared Phone and Tablet shell geometry is generated from the current Figma masters', () => {
  assert.equal(sharedShellGeometryEvidence.fileKey, registry.authority.fileKey);
  assert.equal(sharedShellGeometryEvidence.officialFileRevision, '2379851596474967636');
  assert.equal(sharedShellGeometryEvidence.capture.readOnlyFigma, true);
  assert.equal(sharedShellGeometryEvidence.capture.figmaWrites, false);
  assert.equal(sharedShellGeometryEvidence.nodes.phoneMainNavigation.height, 68);
  assert.equal(sharedShellGeometryEvidence.nodes.tabletMainNavigation.width, 82);
  assert.equal(sharedShellGeometryEvidence.nodes.tabletMainNavigation.height, 268);
  for (const token of [
    'navigationHeaderHeight', 'navigationHeaderHorizontalInset', 'navigationHeaderTopInset',
    'navigationTopBarActionGap', 'navigationTopBarActionSize', 'navigationTopBarTitleSize',
    'navigationBackActionSize', 'navigationBackIconSize', 'navigationBackTitleGap',
    'navigationBackTitleSize', 'navigationMainNavPhoneHeight',
    'navigationMainNavPhoneHorizontalInset', 'navigationMainNavPhoneBottomInset',
    'navigationMainNavPhoneItemHeight', 'navigationMainNavPhoneIconShellSize',
    'navigationMainNavTabletWidth', 'navigationMainNavTabletHeight',
    'navigationMainNavTabletRailFootprint', 'navigationMainNavTabletItemHeight',
    'navigationMainNavTabletIconShellSize', 'navigationMainNavTabletItemGap',
    'rssHeaderControlGap', 'rssHeaderStatusHeight', 'rssHeaderManageWidth',
    'bookDetailContentHorizontalInset', 'bookDetailActionBarOuterHeight',
    'bookDetailActionBarHeight', 'bookDetailActionBarButtonHeight',
    'bookDetailActionBarButtonGap', 'bookDetailActionBarContentTopInset',
    'settingsContentTopInset', 'settingsContentBottomInset',
    'sourceManagementContentTopInset', 'sourceManagementContentBottomInset',
    'sourceManagementBottomActionBottomInset', 'webdavContentBottomInset',
    'syncContentBottomInset', 'syncPageSurface',
  ]) {
    assert.ok(visualAdmission.includes(`static readonly ${token}`),
      `shared Figma shell token is missing: ${token}`);
  }
  for (const token of [
    'navigationHeaderHeight', 'navigationHeaderHorizontalInset', 'navigationTopBarActionGap',
    'navigationTopBarActionSize', 'navigationBackActionSize', 'navigationBackTitleGap',
    'navigationMainNavPhoneHeight', 'navigationMainNavPhoneItemHeight',
    'navigationMainNavTabletWidth', 'navigationMainNavTabletHeight', 'rssHeaderControlGap',
    'bookDetailContentHorizontalInset', 'bookDetailActionBarOuterHeight',
    'bookDetailActionBarButtonHeight', 'bookDetailActionBarButtonGap',
    'settingsContentTopInset', 'settingsContentBottomInset',
    'sourceManagementContentTopInset', 'sourceManagementContentBottomInset',
    'sourceManagementBottomActionBottomInset', 'webdavContentBottomInset',
    'syncContentBottomInset', 'syncPageSurface',
  ]) {
    assert.ok(sharedComponents.includes(`ReaderUiVisualTokens.${token}`) ||
      mainTabShell.includes(`ReaderUiVisualTokens.${token}`) ||
      libraryShell.includes(`ReaderUiVisualTokens.${token}`) ||
      settingsShell.includes(`ReaderUiVisualTokens.${token}`),
    `shared native shell does not consume current Figma token: ${token}`);
  }
  const visibleShell = `${structSource(sharedComponents, 'AppTopBar')}\n${structSource(sharedComponents, 'BackTopBar')}\n${structSource(sharedComponents, 'BottomNav')}\n${structSource(mainTabShell, 'MainTabShell')}`;
  assert.equal(visibleShell.includes('SizeTokens.'), false,
    'current Figma shell cannot revive generic dimension tokens');
  assert.equal(visibleShell.includes('SpacingTokens.safeAreaHorizontal'), false,
    'current Figma shell cannot infer its visible horizontal geometry from the legacy demo spacing');
  assert.equal(libraryShell.includes('SpacingTokens.'), false,
    'Book Detail shell cannot retain a generic spacing authority');
  assert.equal(settingsShell.includes('112 + this.safeAreaBottom'), false,
    'Settings shell cannot retain the retired oversized generic bottom padding');
  assert.equal(settingsShell.includes('this.safeAreaBottom + 18'), false,
    'Sync Backup cannot borrow a generic 18px shell inset instead of its Figma token');
});

test('an unbound page state cannot fall through to a default generic body', () => {
  assert.ok(viewStateRenderer.includes("this.pageState !== 'default'"),
    'non-default page states need an explicit current Figma admission');
  assert.ok(viewStateRenderer.includes('ReaderUiVisualAdmission.isStateAdmitted(this.routeId, this.pageState)'),
    'renderer does not consult generated Reader-UI state admission');
  assert.ok(viewStateRenderer.includes('if (!ReaderUiVisualAdmission.isRouteAdmittedForViewport(this.routeId, this.viewportClass)) return [];'),
    'route admission must remain first before any body state is selected');
  assert.equal(viewStateRenderer.includes('Reader UI 组件契约漂移'), false,
    'unknown component types must not render a local diagnostic card');
  assert.ok(viewStateRenderer.includes('Column().width(0).height(0)'),
    'unknown component types must fail closed with no user-facing substitute');
});

test('every admitted default route avoids the retired generic component branches', () => {
  const prefix = 'static readonly ENTRIES: ViewStateEntry[] = JSON.parse(`';
  const start = viewStateTable.indexOf(prefix);
  const end = viewStateTable.indexOf('`) as ViewStateEntry[];', start + prefix.length);
  assert.ok(start >= 0 && end > start, 'generated ViewState table cannot be inspected');
  const entries = JSON.parse(viewStateTable.slice(start + prefix.length, end));
  const admittedRoutes = new Set(registry.records
    .filter((record) => record.classification === 'exact-figma-binding')
    .flatMap((record) => record.routeIds));
  const retiredGenericTypes = new Set([
    'Loading', 'Empty', 'ErrorState', 'Offline', 'DemoButton', 'DemoList',
    'Card', 'List', 'FormSection', 'Input', 'ListRow', 'FloatingPageControl',
    'Toast', 'FilterBar', 'Overlay',
  ]);
  const collect = (nodes, found) => {
    for (const node of nodes) {
      if (retiredGenericTypes.has(node.type)) found.push(`${node.type}#${node.id}`);
      collect(node.children ?? [], found);
    }
  };
  for (const entry of entries) {
    if (entry.pageState !== 'default' || !admittedRoutes.has(entry.routeId)) continue;
    const found = [];
    collect(entry.components, found);
    assert.deepEqual(found, [],
      `${entry.routeId} can reach a retired generic visual component: ${found.join(', ')}`);
  }
});

test('source switching is immediate and the retired state matrix cannot be rendered', () => {
  assert.ok(sourceSwitch.includes(".onClick(() => ReaderUiStore.requestSourceSwitch(this.candidate.id))"));
  for (const forbidden of ['确认切换', '状态矩阵', 'SourceSwitchResultsPanel', 'requestSourceSwitchConfirm']) {
    assert.equal(sourceSwitch.includes(forbidden), false, `source switch retains unsupported flow: ${forbidden}`);
  }
  assert.equal(exists('entry/src/main/ets/ui/components/W3SourceSwitchStateComponents.ets'), false,
    'old source-switch matrix component still exists');
  for (const routeId of ['source-switch-empty', 'source-switch-error', 'source-switch-loading', 'source-switch-results']) {
    assert.ok(visualAdmission.includes(`routeId: '${routeId}', admission: 'retired'`),
      `retired source-switch route not blocked: ${routeId}`);
  }
});

test('source switch consumes the current Figma dense window instead of generic sheet styling', () => {
  const window = structSource(sourceSwitch, 'SourceSwitchWindow');
  const row = structSource(sourceSwitch, 'SourceSwitchCandidateRow');
  const page = structSource(sourceSwitch, 'SourceSwitchFlowPage');
  for (const token of [
    'sourceSwitchWindowSurface', 'sourceSwitchWindowBorder', 'sourceSwitchWindowWidth',
    'sourceSwitchWindowHeight', 'sourceSwitchWindowRadius', 'sourceSwitchPhoneTop',
    'sourceSwitchTabletRightInset', 'sourceSwitchHeaderHeight', 'sourceSwitchColumnHeaderHeight',
    'sourceSwitchCandidateHeight', 'sourceSwitchFooterHeight', 'sourceSwitchHeaderSurface',
    'sourceSwitchSortSurface', 'sourceSwitchCloseSurface', 'sourceSwitchDivider',
    'sourceSwitchSelectedSurface', 'sourceSwitchControlFontFamily',
  ]) {
    assert.ok(visualAdmission.includes(`static readonly ${token}`),
      `Reader-UI ledger is missing Source Switch Figma token ${token}`);
    assert.ok(sourceSwitch.includes(`ReaderUiVisualTokens.${token}`),
      `Source Switch does not consume Figma token ${token}`);
  }
  for (const current of [window, row, page]) {
    assert.equal(current.includes('ColorTokens.'), false,
      'current Source Switch surface must not fall back to ColorTokens');
    assert.equal(current.includes('DemoAliasTokens.'), false,
      'current Source Switch surface must not fall back to generic radius tokens');
    assert.equal(/#[0-9A-Fa-f]{6,8}/.test(current), false,
      'current Source Switch surface duplicates a visual literal outside the Figma ledger');
  }
  assert.ok(window.includes("Text('书源')"));
  assert.ok(window.includes("Text('延迟')"));
  assert.ok(window.includes("Text('当前章节')"));
  assert.ok(window.includes('Text(`共 ${this.getCandidates().length} 个书源`)'));
  assert.equal(row.includes("Text('当前')"), false,
    'Figma selection is a dense row highlight, not an invented 当前 label');
  assert.ok(row.includes('.height(ReaderUiVisualTokens.sourceSwitchCandidateHeight)'));
  assert.ok(window.includes('.width(ReaderUiVisualTokens.sourceSwitchWindowWidth)'));
  assert.ok(window.includes('.height(ReaderUiVisualTokens.sourceSwitchWindowHeight)'));
});

test('immersive reader status and session capsule consume their exact Figma footer sources', () => {
  const info = structSource(readerComponents, 'ReadingInfoLayer');
  const capsule = structSource(readerComponents, 'SessionCapsule');
  const readerBase = structSource(readerComponents, 'ReaderBase');
  for (const token of [
    'readerImmersiveMetaInk', 'readerImmersiveMetaFontFamily', 'readerImmersiveMetaSize',
    'readerImmersiveMetaLineHeight', 'readerImmersiveInset', 'readerImmersiveFooterBottom',
    'readerImmersiveStatusHeight', 'readerImmersiveStatusIconSize', 'readerImmersiveStatusIconGap',
    'readerSessionCapsuleAutoWidth', 'readerSessionCapsuleTtsWidth', 'readerSessionCapsuleHeight',
    'readerSessionCapsuleSurface', 'readerSessionCapsuleBorder', 'readerSessionCapsuleShadow',
    'readerSessionCapsulePrimary', 'readerSessionCapsulePrimaryInk', 'readerSessionCapsuleInk',
    'readerSessionCapsuleFontFamily', 'readerSessionCapsuleLabelSize',
  ]) {
    assert.ok(visualAdmission.includes(`static readonly ${token}`),
      `Reader-UI ledger is missing immersive Figma token ${token}`);
    assert.ok(readerComponents.includes(`ReaderUiVisualTokens.${token}`),
      `immersive Reader does not consume Figma token ${token}`);
  }
  for (const stale of ['ColorTokens.', 'DemoAliasTokens.', 'RadiusTokens.']) {
    assert.equal(info.includes(stale), false,
      `ReadingInfoLayer must not use generic local visual token ${stale}`);
    assert.equal(capsule.includes(stale), false,
      `SessionCapsule must not use generic local visual token ${stale}`);
  }
  for (const asset of [
    'figma_reader_immersive_signal.svg', 'figma_reader_immersive_wifi.svg',
    'figma_reader_immersive_battery.svg', 'figma_reader_session_pause.svg',
    'figma_reader_session_play.svg', 'figma_reader_session_tts.svg',
  ]) {
    assert.ok(exists(`entry/src/main/resources/base/media/${asset}`),
      `missing exact Reader Figma asset ${asset}`);
  }
  assert.ok(ledger.tokens.some((token) => token.nodeId === '697:24'),
    'current Figma immersive-info node must remain ledger-bound');
  assert.ok(ledger.tokens.some((token) => token.nodeId === '1164:10227'),
    'current Figma session-capsule node must remain ledger-bound');
  assert.ok(info.includes('SessionCapsule()'),
    'the Figma footer must compose the active session capsule with the page label');
  assert.equal(readerBase.includes('SessionCapsule()'), false,
    'ReaderBase must not draw a second, independently positioned session capsule');
  for (const localSubstitute of ['阅读中', '朗读中', '🔊']) {
    assert.equal(capsule.includes(localSubstitute), false,
      `SessionCapsule retains a non-Figma local substitute: ${localSubstitute}`);
  }
});

test('local import is the approved system multi-select → spinner → per-book result overlay', () => {
  assert.ok(effects.includes('startLocalImportFromSystemPicker()'));
  assert.ok(effects.includes('DocumentViewPicker'));
  assert.ok(effects.includes('localImportDialogPhase !== \'loading\''));
  assert.ok(effects.includes("type: 'local-import-dialog-loading'"));
  assert.ok(effects.includes("type: 'local-import-dialog-result'"));
  assert.ok(overlayHost.includes("this.localImportDialogPhase === 'loading'"));
  assert.ok(overlayHost.includes("this.localImportDialogPhase === 'result'"));
  assert.ok(overlayHost.includes('ForEach(this.localImportDialogResults'));
  assert.equal(overlayHost.includes('重试导入'), false, 'approved import result has no retry matrix');
  assert.ok(visualAdmission.includes("overlayKind: 'local-import', admission: 'candidate-backport', sourceBound: true, implementationReady: false"),
    'local-import overlay must register as candidate-backport (source-bound, not yet implementation-ready)');
});

test('Bookshelf overlays consume their revision-bound Figma masters without a local overlay skin', () => {
  for (const token of [
    'actionSheetHandle', 'actionSheetControlFontFamily', 'actionDangerLabel',
    'actionSheetDialogCancelSurface', 'actionSheetDialogDanger',
    'multiSelectSelectedFill', 'multiSelectUnselectedSurface', 'multiSelectCheckboxBorder',
    'multiSelectCheckboxShadow', 'multiSelectCheckboxLabel', 'multiSelectTitleFontFamily',
    'localImportTitleFontFamily', 'localImportControlFontFamily', 'localImportFailureBadge',
    'localImportSummaryWarningSurface', 'localImportScrim',
  ]) {
    assert.ok(visualAdmission.includes(`static readonly ${token}`), `Figma overlay token missing: ${token}`);
    assert.ok(overlayHost.includes(`ReaderUiVisualTokens.${token}`), `OverlayHost misses Figma token: ${token}`);
  }
  assert.equal(overlayHost.includes('ColorTokens'), false,
    'admitted Bookshelf overlays must not fall back to generic ColorTokens');
  assert.equal(overlayHost.includes('ReaderTypography'), false,
    'admitted Bookshelf overlays must not fall back to generic typography');
  assert.equal(overlayHost.includes("title: '移出书架'"), false,
    'the action-sheet control must use the Figma label 移除书架');
  assert.ok(overlayHost.includes("title: '移除书架'"));
  assert.ok(overlayHost.includes('.fontSize(18)'), 'the local-import result heading must retain the Figma 18px title');
  assert.ok(overlayHost.includes('.fontSize(14)'), 'the Figma importing title must retain its 14px size');
  assert.ok(overlayHost.includes('.width(22)'), 'multi-select delete and checkbox geometry must retain Figma 22px targets');
});

test('Settings General is the current Figma master, not the retired explanatory skeleton', () => {
  const start = settings.indexOf('export struct SettingsGeneralPage');
  const end = settings.indexOf('export struct BookshelfSearchSettingsPage');
  assert.ok(start >= 0 && end > start, 'current Settings General block is missing');
  const general = settings.slice(start, end);
  for (const label of ['基础偏好', '行为与反馈', '系统权限', 'App主题']) {
    assert.ok(general.includes(`'${label}'`), `Settings General misses Figma label ${label}`);
  }
  assert.ok(general.includes('FigmaSettingsThemeSegment'), 'Settings General misses the Figma theme segment');
  assert.ok(general.includes('FigmaSettingsResetRow()'), 'Settings General misses the Figma reset row');
  for (const label of ['恢复默认', '跟随', '浅色', '深色']) {
    assert.ok(settings.includes(`'${label}'`), `Settings components miss Figma label ${label}`);
  }
  for (const stale of ['阅读扩展', '设置归属与重置', '开发者动效设置', '合同缺失', '当前没有', 'Owner：']) {
    assert.equal(general.includes(stale), false, `retired Settings copy remains visible: ${stale}`);
  }
  for (const token of [
    'settingsFontFamily', 'settingsPageSurface', 'settingsSectionSurface', 'settingsRowDivider',
    'settingsSegmentSurface', 'settingsSegmentSelectedBorder', 'settingsSelectSurface',
    'settingsSwitchOn', 'settingsSwitchOff', 'settingsInlineActionSurface', 'settingsDangerText',
  ]) {
    assert.ok(visualAdmission.includes(`static readonly ${token}:`), `Settings token missing from generated artifact: ${token}`);
    assert.ok(settings.includes(`ReaderUiVisualTokens.${token}`) || settingsShell.includes(`ReaderUiVisualTokens.${token}`),
      `Settings consumer misses generated token ${token}`);
  }
  assert.ok(settings.includes('.justifyContent(FlexAlign.End)'), 'Settings trailing controls must be right-aligned');
  assert.ok(settings.includes("fontFamily(ReaderUiVisualTokens.settingsFontFamily)"),
    'Settings labels must use the Figma Inter family token');
  assert.ok(entryAbility.includes("familyName: 'Inter'"), 'the bundled Inter family is not registered');
  assert.ok(entryAbility.includes("familySrc: $rawfile('font/InterVariable.ttf')"),
    'the registered Inter asset is not the bundled source');
  assert.ok(settingsShell.includes('ReaderUiVisualTokens.settingsPageSurface'),
    'Settings shell must use the Figma page surface rather than a generic paper fallback');
  assert.equal(general.includes('compact'), false, 'Settings General must not revive compact layout');
});

test('Settings General components use only revision-bound Figma visual values through their full component graph', () => {
  const current = reachableStructSources(settings, ['SettingsGeneralPage']);
  for (const [name, component] of current) {
    assert.equal(component.includes('ColorTokens.'), false,
      `${name} is reachable from Settings General but uses generic ColorTokens`);
    assert.equal(component.includes('DemoAliasTokens.'), false,
      `${name} is reachable from Settings General but uses generic DemoAliasTokens`);
    assert.equal(component.includes('ReaderTypography.'), false,
      `${name} is reachable from Settings General but uses generic ReaderTypography`);
    assert.equal(/#[0-9A-Fa-f]{6,8}/.test(component), false,
      `${name} is reachable from Settings General but duplicates a raw visual literal`);
  }
  for (const token of [
    'settingsSegmentSelectedInk', 'settingsSegmentInactiveInk',
    'settingsSelectInk', 'settingsInlineActionInk',
  ]) {
    assert.ok(visualAdmission.includes(`static readonly ${token}:`),
      `Settings General current Figma token missing: ${token}`);
    assert.ok(settings.includes(`ReaderUiVisualTokens.${token}`),
      `Settings General does not consume current Figma token ${token}`);
  }
  assert.ok(settingsShell.includes('ReaderUiVisualTokens.settingsContentHorizontalInset'),
    'Settings shell must use the current Figma horizontal inset rather than the generic shell spacing');
});

test('Source Management is rebuilt from the current Figma Phone and Tablet master', () => {
  const start = structuralPages.indexOf('export struct SourceManagementPage');
  const end = structuralPages.indexOf('export struct SourceDetailPage', start);
  assert.ok(start >= 0 && end > start, 'current Source Management block is missing');
  const componentStart = structuralPages.indexOf('struct FigmaSourceStatusFilter');
  assert.ok(componentStart >= 0 && componentStart < start, 'current Source Management Figma components are missing');
  const componentEnd = structuralPages.indexOf('struct SourceDetailHeader', componentStart);
  assert.ok(componentEnd > componentStart, 'current Source Management Figma component boundary is missing');
  const sourceManagement = `${structuralPages.slice(componentStart, componentEnd)}\n${structuralPages.slice(start, end)}`;
  for (const label of ['搜索书源名称或域名', '全部', '启用', '异常', '未检测', '自定义', '分组', '全部分组', '检测']) {
    assert.ok(sourceManagement.includes(`'${label}'`), `Source Management misses Figma label ${label}`);
  }
  for (const token of [
    'sourceManagementPageSurface', 'sourceManagementSearchHeight', 'sourceManagementFilterHeight',
    'sourceManagementGroupHeight', 'sourceManagementRowHeight', 'sourceManagementContentHorizontalInset',
    'sourceManagementBottomActionHeight',
  ]) {
    assert.ok(`${sourceManagement}\n${settingsShell}`.includes(`ReaderUiVisualTokens.${token}`),
      `Source Management misses revision-bound Figma token ${token}`);
  }
  for (const stale of ['Core 书源列表', '仅展示已持久化书源', '正在读取 Core 书源', '导入书源', 'source-detail-open', 'source-export']) {
    assert.equal(sourceManagement.includes(stale), false, `retired Source Management behavior remains: ${stale}`);
  }
  assert.equal(sourceManagement.includes("Text('刷新')"), false,
    'the retired visible refresh action must not return');
  assert.equal(sourceManagement.includes("type: 'route-push'"), false,
    'the Figma page must not invent a route without an admitted Figma target');
  const sourceActionStart = settingsShell.indexOf("if (this.routeId === 'source-management')");
  assert.ok(sourceActionStart >= 0, 'Source Management action bar is missing');
  const sourceAction = settingsShell.slice(sourceActionStart);
  assert.ok(sourceAction.includes("Text('批量管理')"));
  assert.ok(sourceAction.includes("Text('＋  新增书源')"));
  assert.equal(sourceAction.includes('linearGradient'), false,
    'Source Management actions must not use the retired gradient floating bar');
  assert.equal(sourceAction.includes("type: 'route-push'"), false,
    'Source Management bottom actions must not route into withdrawn pages');

  assert.equal(sourceManagementIconEvidence.fileKey, registry.authority.fileKey);
  assert.equal(sourceManagementIconEvidence.officialFileRevision, '2379851596474967636');
  assert.equal(sourceManagementIconEvidence.capture.readOnlyFigma, true);
  assert.equal(sourceManagementIconEvidence.capture.figmaWrites, false);
  for (const icon of sourceManagementIconEvidence.exports) {
    const localFile = path.resolve(REPO, '..', icon.localFile);
    const bytes = fs.readFileSync(localFile);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), icon.sha256,
      `Source Management icon drifted: ${icon.resource}`);
    assert.equal(bytes.length, icon.bytes, `Source Management icon byte count drifted: ${icon.resource}`);
    assert.ok(sourceManagement.includes(`app.media.${icon.resource}`),
      `Source Management does not consume its current Figma icon: ${icon.resource}`);
  }
  const record = registry.records.find((item) => item.id === 'source-management.final');
  assert.deepEqual(record?.harmony?.targets, [
    'Reader-for-HarmonyOS/entry/src/main/ets/ui/components/StructuralPageComponents.ets#SourceManagementPage',
    'Reader-for-HarmonyOS/entry/src/main/ets/ui/shells/SettingsShell.ets#renderBottomActionBar',
  ]);
});

test('Search, WebDAV, Sync Backup, and Restore consume their current Figma sources without generic fallback pages', () => {
  const searchStart = structuralPages.indexOf('struct FigmaSearchPage');
  const searchEnd = structuralPages.indexOf('export struct SearchHomePage', searchStart);
  assert.ok(searchStart >= 0 && searchEnd > searchStart, 'Figma Search component block is missing');
  const search = structuralPages.slice(searchStart, searchEnd);
  for (const resource of ['search_page_back', 'search_page_magnifier', 'search_page_clear']) {
    assert.ok(search.includes(`app.media.${resource}`), `Search misses Figma icon ${resource}`);
  }
  assert.ok(settingsShell.includes('ReaderUiVisualTokens.webdavPageSurface'),
    'sync and WebDAV shell must use the Figma warm surface');

  const webdavStart = structuralPages.indexOf('struct WebDavInputRow');
  const webdavEnd = structuralPages.indexOf('struct ActionPair', webdavStart);
  assert.ok(webdavStart >= 0 && webdavEnd > webdavStart, 'WebDAV Figma component block is missing');
  const webdav = structuralPages.slice(webdavStart, webdavEnd);
  for (const token of [
    'webdavPageSurface', 'webdavPanelSurface', 'webdavPanelBorder', 'webdavFieldSurface',
    'webdavInputSurface', 'webdavActionPrimary', 'webdavActionHeight', 'webdavAdvancedRowHeight',
  ]) {
    assert.ok(`${webdav}\n${settingsShell}`.includes(`ReaderUiVisualTokens.${token}`),
      `WebDAV misses Figma token ${token}`);
  }
  for (const stale of ['HUKS', '打开 WebDAV 配置', '远端备份和恢复会保持关闭']) {
    assert.equal(webdav.includes(stale), false, `WebDAV retains generic substitute copy: ${stale}`);
  }

  const syncStart = structuralPages.indexOf('export struct SyncBackupPage');
  const syncEnd = structuralPages.indexOf('export struct GlobalSettingsPage', syncStart);
  assert.ok(syncStart >= 0 && syncEnd > syncStart, 'Sync/Restore block is missing');
  const sync = structuralPages.slice(syncStart, syncEnd);
  for (const label of ['WebDAV 配置', '自动备份配置', '历史备份', '保存位置', '备份频率', '备份范围']) {
    assert.ok(sync.includes(`'${label}'`), `Sync Backup misses Figma section label ${label}`);
  }
  assert.equal((sync.match(/ForEach\(this\.visibleHistory\(/g) || []).length, 1,
    'Sync Backup must render one Core-projected history list only');
  for (const stale of [
    '创建本机备份', '备份到 WebDAV', '从备份文件恢复', '从 WebDAV 恢复',
    '确认原子恢复 Core 数据', '确认替换完整 Core 数据', 'Core 数据恢复完成',
  ]) {
    assert.equal(sync.includes(stale), false, `withdrawn generic Sync/Restore surface remains: ${stale}`);
  }
  assert.ok(structuralPages.includes("type: 'core-backup-prepare-local', coreBackupPath: this.entry.path"),
    'a backup row must prepare its exact Core-validated path');
  assert.ok(sync.includes('RestoreBackupOverlayMotionCoordinator.beginConfirmToLoading'),
    'Restore overlay misses its Figma presentation coordinator');
  assert.ok(sync.includes("type: 'core-restore-apply-request'"),
    'Restore confirmation must still enter the real Core apply path');
  assert.ok(sync.includes("type: 'route-replace', id: 'sync-backup'"),
    'complete restore toast must return to its Figma base surface');
  assert.ok(settingsShell.includes('private isRestoreOverlayRoute(): boolean'),
    'Settings shell must distinguish the live Figma overlay routes');
  assert.ok(settingsShell.includes('SyncBackupPage()'),
    'Restore overlay must keep the Sync Backup Figma surface beneath it');
  assert.ok(settingsShell.includes('RestoreBackupOverlay()'),
    'Restore overlay must mount over the admitted Sync Backup surface');

  const iconEvidences = [
    [searchIconEvidence, search],
    [webdavIconEvidence, webdav],
    [restoreBackupIconEvidence, sync],
  ];
  for (const [evidence, consumer] of iconEvidences) {
    assert.equal(evidence.fileKey, registry.authority.fileKey);
    assert.equal(evidence.officialFileRevision, '2379851596474967636');
    assert.equal(evidence.capture.readOnlyFigma, true);
    assert.equal(evidence.capture.figmaWrites, false);
    for (const icon of evidence.exports) {
      const localFile = path.resolve(REPO, '..', icon.localFile);
      const bytes = fs.readFileSync(localFile);
      assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), icon.sha256,
        `Figma icon drifted: ${icon.resource}`);
      assert.equal(bytes.length, icon.bytes, `Figma icon byte count drifted: ${icon.resource}`);
      assert.ok(consumer.includes(`app.media.${icon.resource}`),
        `live visual consumer does not use Figma icon ${icon.resource}`);
    }
  }

  const webdavRecord = registry.records.find((item) => item.id === 'webdav.config');
  assert.ok(webdavRecord?.harmony?.targets.includes(
    'Reader-for-HarmonyOS/entry/src/main/ets/ui/shells/SettingsShell.ets#SettingsShell'));
  const syncRecord = registry.records.find((item) => item.id === 'sync-backup.page-and-restore-overlay');
  for (const target of [
    'Reader-for-HarmonyOS/entry/src/main/ets/ui/components/StructuralPageComponents.ets#SyncBackupPage',
    'Reader-for-HarmonyOS/entry/src/main/ets/ui/components/StructuralPageComponents.ets#RestoreBackupOverlay',
    'Reader-for-HarmonyOS/entry/src/main/ets/ui/shells/SettingsShell.ets#SettingsShell',
  ]) {
    assert.ok(syncRecord?.harmony?.targets.includes(target), `Sync Backup registry target is missing: ${target}`);
  }
});

test('Discover and RSS consume only their current Figma masters and Core-projected values', () => {
  const discoverRecord = registry.records.find((item) => item.id === 'discover.page');
  const rssRecord = registry.records.find((item) => item.id === 'rss.page');
  // `candidate-backport` here is intentional: it records that the Figma
  // source is bound but the page family has NOT completed Reader-UI source-
  // side conversion + HarmonyOS consumption. The generated artifact must
  // reflect the same status so the renderer execution gate fails closed for
  // these routes. This is the stop condition the protocol requires, not a
  // license to advance a virtual-machine or device cycle on these families.
  assert.equal(discoverRecord?.harmony?.status, 'candidate-backport');
  assert.equal(rssRecord?.harmony?.status, 'candidate-backport');
  assert.ok(visualAdmission.includes("routeId: 'discover', admission: 'candidate-backport', sourceBound: true, implementationReady: false"),
    'Discover route must be candidate-backport in the generated artifact');
  assert.ok(visualAdmission.includes("routeId: 'rss', admission: 'candidate-backport', sourceBound: true, implementationReady: false"),
    'RSS route must be candidate-backport in the generated artifact');
  for (const target of [
    'Reader-for-HarmonyOS/entry/src/main/ets/ui/components/DiscoverComponents.ets#DiscoverSourceBar',
    'Reader-for-HarmonyOS/entry/src/main/ets/ui/components/DiscoverComponents.ets#DiscoverEntryRow',
    'Reader-for-HarmonyOS/entry/src/main/ets/ui/components/DiscoverComponents.ets#DiscoverFilterTrigger',
    'Reader-for-HarmonyOS/entry/src/main/ets/ui/components/DiscoverComponents.ets#DiscoverListHead',
    'Reader-for-HarmonyOS/entry/src/main/ets/ui/components/DiscoverComponents.ets#DiscoverBookList',
    'Reader-for-HarmonyOS/entry/src/main/ets/ui/components/SharedComponents.ets#AppTopBar',
    'Reader-for-HarmonyOS/entry/src/main/ets/ui/shells/MainTabShell.ets#MainTabShell',
  ]) {
    assert.ok(discoverRecord?.harmony?.targets.includes(target), `Discover registry target is missing: ${target}`);
  }
  for (const target of [
    'Reader-for-HarmonyOS/entry/src/main/ets/ui/components/RssComponents.ets#RssSearchEntry',
    'Reader-for-HarmonyOS/entry/src/main/ets/ui/components/RssComponents.ets#RssModeRow',
    'Reader-for-HarmonyOS/entry/src/main/ets/ui/components/RssComponents.ets#RssSourceOverview',
    'Reader-for-HarmonyOS/entry/src/main/ets/ui/components/RssComponents.ets#RssArticleSection',
    'Reader-for-HarmonyOS/entry/src/main/ets/ui/components/SharedComponents.ets#AppTopBar',
    'Reader-for-HarmonyOS/entry/src/main/ets/ui/shells/MainTabShell.ets#MainTabShell',
  ]) {
    assert.ok(rssRecord?.harmony?.targets.includes(target), `RSS registry target is missing: ${target}`);
  }

  for (const token of [
    'discoverSourceCardSurface', 'discoverSourceIconSurface', 'discoverPrimary',
    'discoverResultRadius', 'discoverResultsSurface',
  ]) {
    assert.ok(discover.includes(`ReaderUiVisualTokens.${token}`), `Discover misses Figma token ${token}`);
  }
  const discoverLive = discover.slice(0, discover.indexOf('// The remaining generated discovery routes'));
  for (const staleCopy of ['暂无书源', '当前没有启用发现的书源', '启用发现后，可以在这里浏览']) {
    assert.equal(discoverLive.includes(staleCopy), false, `Discover resurrects generic copy: ${staleCopy}`);
  }
  assert.equal(discoverLive.includes('.opacity(0.1)'), false,
    'Discover source icon must use its Figma alpha surface, not fade the whole icon stack');
  assert.equal(discoverIconEvidence.fileKey, registry.authority.fileKey);
  assert.equal(discoverIconEvidence.officialFileRevision, '2379851596474967636');
  assert.equal(discoverIconEvidence.capture.readOnlyFigma, true);
  assert.equal(discoverIconEvidence.capture.figmaWrites, false);
  for (const icon of discoverIconEvidence.exports) {
    const localFile = path.resolve(REPO, '..', icon.localFile);
    const bytes = fs.readFileSync(localFile);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), icon.sha256,
      `Discover Figma icon drifted: ${icon.resource}`);
    assert.equal(bytes.length, icon.bytes, `Discover Figma icon byte count drifted: ${icon.resource}`);
    assert.ok(discoverLive.includes(`app.media.${icon.resource}`),
      `Discover live visual consumer does not use Figma icon ${icon.resource}`);
  }

  for (const token of [
    'rssSearchSurface', 'rssModeHeight', 'rssCardSurface', 'rssSourceRowHeight',
    'rssSourceIconSurface',
  ]) {
    assert.ok(rss.includes(`ReaderUiVisualTokens.${token}`), `RSS misses Figma token ${token}`);
  }
  const rssCurrentEnd = rss.indexOf('// The all/unread controls');
  assert.ok(rssCurrentEnd > 0, 'RSS current-master boundary is missing');
  const rssLive = rss.slice(0, rssCurrentEnd);
  for (const staleCopy of ['正在读取订阅源…', '暂无订阅源', '等待 Core 返回', '读取失败：']) {
    assert.equal(rssLive.includes(staleCopy), false, `RSS resurrects generic copy: ${staleCopy}`);
  }
  const rssMode = rss.slice(rss.indexOf('export struct RssModeRow'), rss.indexOf('export struct RssSourceOverview'));
  assert.equal(rssMode.includes('.onClick'), false,
    'RSS tabs without an admitted Figma destination must be inert');

  for (const token of ['discoverPageSurface', 'rssPageSurface']) {
    assert.ok(mainTabShell.includes(`ReaderUiVisualTokens.${token}`),
      `main shell does not consume the ${token} Figma surface`);
  }
  for (const token of ['discoverHeaderFontFamily', 'discoverHeaderTitleSize', 'rssHeaderFontFamily', 'rssHeaderTitleSize']) {
    assert.ok(sharedComponents.includes(`ReaderUiVisualTokens.${token}`),
      `main header misses Figma token ${token}`);
  }
  const rssHeader = sharedComponents.slice(sharedComponents.indexOf('@Builder renderRssHeader()'),
    sharedComponents.indexOf('private openTopMore()', sharedComponents.indexOf('@Builder renderRssHeader()')));
  assert.equal(rssHeader.includes("route-push', id: 'rss-subscription-management'"), false,
    'RSS management visual must not lead to an unadmitted route');
});

test('current RSS and structural Figma roots cannot reach a generic visual fallback', () => {
  const currentRss = reachableStructSources(rss, [
    'RssSearchEntry', 'RssModeRow', 'RssSourceOverview', 'RssArticleSection',
  ]);
  const currentStructural = reachableStructSources(structuralPages, [
    'SearchHomePage', 'SearchResultsPage', 'SearchStatePage',
    'SourceManagementPage', 'SyncBackupPage', 'RestoreBackupOverlay',
  ]);
  for (const [surface, graph] of [['RSS', currentRss], ['Search/Source/Sync', currentStructural]]) {
    for (const [name, component] of graph) {
      assert.equal(component.includes('ColorTokens.'), false,
        `${surface} ${name} uses generic ColorTokens`);
      assert.equal(component.includes('DemoAliasTokens.'), false,
        `${surface} ${name} uses generic DemoAliasTokens`);
      assert.equal(component.includes('ReaderTypography.'), false,
        `${surface} ${name} uses generic ReaderTypography`);
      assert.equal(/#[0-9A-Fa-f]{6,8}/.test(component), false,
        `${surface} ${name} duplicates a raw visual literal`);
    }
  }
});

test('current Figma search results retain the exact cover fallback and source images never inject a generic grey placeholder', () => {
  const sourceCover = source('entry/src/main/ets/ui/components/SourceCoverImage.ets');
  const asset = searchResultCoverEvidence.localAsset;
  const localFile = path.resolve(REPO, '..', asset.localFile);
  const bytes = fs.readFileSync(localFile);
  assert.equal(searchResultCoverEvidence.fileKey, registry.authority.fileKey);
  assert.equal(searchResultCoverEvidence.officialFileRevision, '2379851596474967636');
  assert.equal(searchResultCoverEvidence.source.capture.readOnlyFigma, true);
  assert.equal(searchResultCoverEvidence.source.capture.figmaWrites, false);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), asset.sha256,
    'Figma search cover fallback drifted');
  assert.equal(bytes.length, asset.bytes, 'Figma search cover fallback byte count drifted');
  assert.ok(structuralPages.includes(`app.media.${asset.resource}`),
    'current search result card does not use its Figma-derived cover fallback');
  assert.equal(sourceCover.includes('ColorTokens.'), false,
    'source image fallback must not insert the retired generic grey cover surface');
});

test('ArkTS assertions use the real Stage ohosTest runner and cannot reuse stale host output', () => {
  assert.ok(packageJson.includes('"test:arkts-compile": "node scripts/test.mjs"'));
  // The emulator-only suite is named `test:arkts-emulator`, not
  // `test:arkts-device`. The old name conflated emulator unit tests with
  // device/visual delivery, which let a 465/465 emulator pass be reported as
  // if it proved frontend or device completion. The script itself is still
  // run_ohos_device_tests.mjs (the file name is historical), but the npm
  // script name must say emulator.
  assert.ok(packageJson.includes('"test:arkts-emulator": "node scripts/run_ohos_device_tests.mjs"'));
  assert.equal(packageJson.includes('"test:arkts-device"'), false,
    'the old test:arkts-device name must not survive — it conflated emulator unit tests with device delivery');
  assert.ok(packageJson.includes('"test:raw": "hvigorw onDeviceTest --mode module -p module=entry@default --no-daemon"'));
  assert.equal(packageJson.includes('"test:raw": "hvigorw test '), false,
    'the hanging local UnitTest command must never be the raw test path');
  for (const required of [
    'entry/src/ohosTest/module.json5',
    'Hypium.hypiumTest',
    '../../../test/List.test',
    'assembleHap',
    'module=entry@ohosTest',
  ]) {
    assert.ok(arktsTestPackageGate.includes(required), `ArkTS compile gate misses ${required}`);
  }
  for (const required of [
    'emulator-only runner',
    "'onDeviceTest'",
    "'module=entry@default'",
    'readExactlyOneTarget',
    'isHarmonyEmulatorTarget',
    'REQUIRED_EMULATOR_TARGET',
    'target !== REQUIRED_EMULATOR_TARGET',
    'physical-device signing is intentionally skipped',
    'COVERAGE_LOG',
    'mtimeMs < startedAt',
    'Tests run:',
  ]) {
    assert.ok(arktsEmulatorRunner.includes(required), `ArkTS emulator runner misses ${required}`);
  }
});

test('current Figma visual values are not duplicated as raw native literals', () => {
  const nativeFiles = etsFiles().filter((file) => !file.includes('/contract/'));
  const rawFigmaColors = new Set(ledger.tokens.filter((token) => token.type === 'color').map((token) => token.value));
  for (const file of nativeFiles) {
    if (file.includes('/contract/reader_ui/VisualAdmission.ets')) continue;
    const contents = fs.readFileSync(file, 'utf8');
    for (const value of rawFigmaColors) {
      assert.equal(contents.includes(value), false,
        `${path.relative(REPO, file)} duplicates current Figma literal ${value}`);
    }
  }
});

test('token lint and visual source generator remain the only allowed generation path', () => {
  const tokenLint = source('scripts/lint_tokens.mjs');
  const contractSync = source('scripts/gen_contracts.mjs');
  assert.equal(tokenLint.includes('FigmaReadingVisualTokens.ets'), false,
    'token lint must not grandfather the retired native Figma token file');
  assert.ok(contractSync.includes("VisualAdmission.ets"), 'contract sync must carry Reader-UI visual artifact');
  assert.ok(readerUiSource('tools/design/generate-visual-admission-contract.mjs')
    .includes('FIGMA_VISUAL_TOKEN_LEDGER'), 'Reader-UI generator must own visual token emission');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
