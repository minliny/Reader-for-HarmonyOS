import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const READER_UI = process.env.READER_UI_REPO || path.resolve(REPO, '../Reader-UI');
const SOURCE_DIR = path.join(READER_UI, 'generated', 'arkts');
const DEST_DIR = path.join(REPO, 'entry', 'src', 'main', 'ets', 'contract', 'reader_ui');
const GRAPH_JSON = path.join(READER_UI, 'ui-spec', 'screen-graph.json');
const VIEW_STATE_FIXTURES = path.join(READER_UI, 'contracts', 'fixtures', 'view-state.fixtures.json');
const VIEW_STATE_RENDERER = path.join(REPO, 'entry', 'src', 'main', 'ets', 'ui', 'components', 'ViewStateRenderer.ets');
const COVERAGE_REGISTRY = path.join(REPO, 'entry', 'src', 'main', 'ets', 'ui', 'router', 'ReaderUIScreenGraphCoverage.ets');
const RETIREMENT_REGISTRY = path.join(REPO, 'entry', 'src', 'main', 'ets', 'ui', 'router', 'ReaderUIScreenGraphRetirementRegistry.ets');
const TAP_ZONE_ADAPTER = path.join(REPO, 'entry', 'src', 'main', 'ets', 'ui', 'router', 'ReaderUIScreenGraphTapZoneAdapter.ets');
const STATE_PRIMITIVE_ADAPTER = path.join(REPO, 'entry', 'src', 'main', 'ets', 'ui', 'router', 'ReaderUIScreenGraphStatePrimitiveAdapter.ets');
const BUTTON_ADAPTER = path.join(REPO, 'entry', 'src', 'main', 'ets', 'ui', 'router', 'ReaderUIScreenGraphButtonAdapter.ets');
const DIALOG_ADAPTER = path.join(REPO, 'entry', 'src', 'main', 'ets', 'ui', 'router', 'ReaderUIScreenGraphDialogAdapter.ets');
const CONTENT_ADAPTER = path.join(REPO, 'entry', 'src', 'main', 'ets', 'ui', 'router', 'ReaderUIScreenGraphContentAdapter.ets');
const EMPTY_ADAPTER = path.join(REPO, 'entry', 'src', 'main', 'ets', 'ui', 'router', 'ReaderUIScreenGraphEmptyAdapter.ets');
const TERMINAL_STATE_ADAPTER = path.join(REPO, 'entry', 'src', 'main', 'ets', 'ui', 'router', 'ReaderUIScreenGraphTerminalStateAdapter.ets');
const CAPABILITY_CLOSURE_REGISTRY = path.join(REPO, 'entry', 'src', 'main', 'ets', 'ui', 'router', 'ReaderCapabilityClosureRouteRegistry.ets');
const SHARED_COMPONENTS = path.join(REPO, 'entry', 'src', 'main', 'ets', 'ui', 'components', 'SharedComponents.ets');
const FILES = ['Route.ets', 'ViewState.ets', 'UiEvent.ets', 'UiState.ets', 'ScreenGraph.ets', 'Appearance.ets'];
const CHECK = process.argv.includes('--check');

function harmonyCompatibleSource(file, source) {
  // Reader UI now emits the explicit cross-file imports required by ArkTS.
  // Keep every consumer file byte-for-byte canonical so the independent
  // consumer gate can detect any future generator drift.
  void file;
  return source;
}

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value === null || typeof value !== 'object') return value;
  const result = {};
  for (const key of Object.keys(value).sort()) result[key] = canonicalValue(value[key]);
  return result;
}

function requiredMatch(source, pattern, label) {
  const match = source.match(pattern);
  if (!match) throw new Error(`ScreenGraph.ets missing ${label}`);
  return match[1];
}

function declaredStringArray(source, constantName) {
  const pattern = new RegExp(`export const ${constantName}:[^=]+?= \\[([\\s\\S]*?)\\n\\];`);
  const body = requiredMatch(source, pattern, constantName);
  return [...body.matchAll(/'([^']+)'/g)].map((match) => match[1]);
}

function sameStringSet(left, right) {
  if (left.size !== right.size) return false;
  for (const value of left) if (!right.has(value)) return false;
  return true;
}

function countComponents(components) {
  let count = 0;
  let bindings = 0;
  let stateEventEvidence = 0;
  for (const component of components || []) {
    count += 1;
    bindings += (component.bindings || []).length;
    stateEventEvidence += (component.stateEventEvidence || []).length;
    const child = countComponents(component.children || []);
    count += child.components;
    bindings += child.bindings;
    stateEventEvidence += child.stateEventEvidence;
  }
  return { components: count, bindings, stateEventEvidence };
}

function componentRecordKey(routeId, componentId) {
  return `${routeId}\u0000${componentId}`;
}

function readRetiredComponentEntries(source) {
  const body = requiredMatch(
    source,
    /export const READER_SCREEN_GRAPH_RETIRED_COMPONENT_INSTANCES:[^=]+?= \[([\s\S]*?)\n\];/,
    'READER_SCREEN_GRAPH_RETIRED_COMPONENT_INSTANCES',
  );
  return [...body.matchAll(
    /\{ routeId: '([^']+)', componentId: '([^']+)', reason: '([^']+)' \}/g,
  )].map((match) => ({ routeId: match[1], componentId: match[2], reason: match[3] }));
}

for (const file of FILES) {
  const sourcePath = path.join(SOURCE_DIR, file);
  if (!fs.existsSync(sourcePath)) throw new Error(`Reader UI generated ArkTS source missing: ${sourcePath}`);
}
if (!fs.existsSync(GRAPH_JSON)) throw new Error(`Reader UI screen graph JSON missing: ${GRAPH_JSON}`);
if (!fs.existsSync(VIEW_STATE_FIXTURES)) throw new Error(`Reader UI ViewState fixtures missing: ${VIEW_STATE_FIXTURES}`);

if (!CHECK) {
  fs.mkdirSync(DEST_DIR, { recursive: true });
  for (const file of FILES) {
    const source = fs.readFileSync(path.join(SOURCE_DIR, file), 'utf8');
    fs.writeFileSync(path.join(DEST_DIR, file), harmonyCompatibleSource(file, source));
  }
}

const failures = [];
for (const file of FILES) {
  const sourcePath = path.join(SOURCE_DIR, file);
  const destinationPath = path.join(DEST_DIR, file);
  if (!fs.existsSync(destinationPath)) {
    failures.push(`missing synced file ${file}`);
    continue;
  }
  const source = fs.readFileSync(sourcePath, 'utf8');
  const expected = harmonyCompatibleSource(file, source);
  const destination = fs.readFileSync(destinationPath, 'utf8');
  if (expected !== destination) failures.push(`deterministic sync drift ${file}`);
}

const screenGraphSource = fs.readFileSync(path.join(SOURCE_DIR, 'ScreenGraph.ets'), 'utf8');
const graphBytes = fs.readFileSync(GRAPH_JSON);
const graph = JSON.parse(graphBytes.toString('utf8'));
const viewStateFixtures = JSON.parse(fs.readFileSync(VIEW_STATE_FIXTURES, 'utf8'));
if (graph.schemaVersion !== '1.2.0') {
  failures.push(`ScreenGraph schemaVersion must be 1.2.0, got ${graph.schemaVersion}`);
}
if (!screenGraphSource.includes('stateAuthorities: string[]') ||
  !screenGraphSource.includes("compositionMode: 'contract-tree' | 'host-composite'") ||
  !screenGraphSource.includes('target: string')) {
  failures.push('ScreenGraph 1.2 ArkTS types must expose stateAuthorities, compositionMode, and binding.target');
}
const sourceSha = sha256(Buffer.from(screenGraphSource));
const canonicalSha = sha256(JSON.stringify(canonicalValue(graph)));
const declaredCanonicalSha = requiredMatch(screenGraphSource, /static readonly sha256: string = "([0-9a-f]{64})"/, 'canonical sha256');
const declaredRouteCount = Number(requiredMatch(screenGraphSource, /static readonly routeCount: number = (\d+)/, 'routeCount'));
const declaredVariantCount = Number(requiredMatch(screenGraphSource, /static readonly variantCount: number = (\d+)/, 'variantCount'));
const declaredComponentCount = Number(requiredMatch(screenGraphSource, /static readonly componentCount: number = (\d+)/, 'componentCount'));
const declaredBindingCount = Number(requiredMatch(screenGraphSource, /static readonly bindingCount: number = (\d+)/, 'bindingCount'));
const declaredStateEventEvidenceCount = Number(requiredMatch(screenGraphSource, /static readonly stateEventEvidenceCount: number = (\d+)/, 'stateEventEvidenceCount'));

let variantCount = 0;
let componentCount = 0;
let bindingCount = 0;
let stateEventEvidenceCount = 0;
let actionGapCount = 0;
for (const route of graph.routes || []) {
  variantCount += (route.variants || []).length;
  for (const variant of route.variants || []) {
    actionGapCount += (variant.actionGaps || []).length;
    const counts = countComponents(variant.components || []);
    componentCount += counts.components;
    bindingCount += counts.bindings;
    stateEventEvidenceCount += counts.stateEventEvidence;
  }
}

// Generated route unions are intentionally broader than the current Figma
// presentation. Keep the precise retirement list in native code, then prove
// every retired generated component is named by route + component ID. The
// generated Reader UI files remain immutable inputs to this audit.
const RETIRED_GENERATED_ROUTE_IDS = new Set([
  'source-switch-results',
  'source-switch-empty',
  'source-switch-error',
  'source-switch-timeout',
  'source-switch-loading',
  'source-switch-rollback',
  'source-switch-preview',
  'restore-scopes',
  'restore-preview',
  'restore-running',
  'restore-result',
  'restore-confirm',
  'restore-progress',
  'restore-conflict',
]);
const canonicalComponentRecords = [];
const collectCanonicalComponentRecords = (routeId, components) => {
  for (const component of components || []) {
    canonicalComponentRecords.push({ routeId, component });
    collectCanonicalComponentRecords(routeId, component.children || []);
  }
};
for (const route of graph.routes || []) {
  for (const variant of route.variants || []) {
    collectCanonicalComponentRecords(route.routeId, variant.components || []);
  }
}
const canonicalComponentRecordByKey = new Map();
for (const record of canonicalComponentRecords) {
  const key = componentRecordKey(record.routeId, record.component.id);
  // A generated component ID may recur across state variants of the same
  // route. Retirement intentionally covers that stable route/component pair
  // across all such variants; the registry itself remains one entry per key.
  canonicalComponentRecordByKey.set(key, record);
}
let retiredComponentEntries = [];
let retiredComponentKeys = new Set();
if (!fs.existsSync(RETIREMENT_REGISTRY)) {
  failures.push('missing exact ScreenGraph runtime retirement registry');
} else {
  const retirementSource = fs.readFileSync(RETIREMENT_REGISTRY, 'utf8');
  retiredComponentEntries = readRetiredComponentEntries(retirementSource);
  for (const entry of retiredComponentEntries) {
    const key = componentRecordKey(entry.routeId, entry.componentId);
    if (!RETIRED_GENERATED_ROUTE_IDS.has(entry.routeId)) {
      failures.push(`retirement registry may only cover withdrawn Source Switch/Restore routes: ${entry.routeId}/${entry.componentId}`);
    }
    if (retiredComponentKeys.has(key)) {
      failures.push(`duplicate ScreenGraph retirement registry entry: ${entry.routeId}/${entry.componentId}`);
    }
    if (!canonicalComponentRecordByKey.has(key)) {
      failures.push(`retirement registry references no canonical component: ${entry.routeId}/${entry.componentId}`);
    }
    retiredComponentKeys.add(key);
  }
  for (const record of canonicalComponentRecords) {
    if (!RETIRED_GENERATED_ROUTE_IDS.has(record.routeId)) continue;
    const key = componentRecordKey(record.routeId, record.component.id);
    if (!retiredComponentKeys.has(key)) {
      failures.push(`withdrawn generated component is not explicitly retired: ${record.routeId}/${record.component.id}`);
    }
  }
  if (retiredComponentKeys.has(componentRecordKey('source-switch', 'source-switch-flow'))) {
    failures.push('live source-switch window must not be retired from runtime coverage');
  }
}

const rendererSource = fs.readFileSync(VIEW_STATE_RENDERER, 'utf8');
const rendererEntry = rendererSource.indexOf('@Builder renderComponent(component: ViewStateComponent)');
if (rendererEntry < 0) throw new Error('ViewStateRenderer.ets missing renderComponent entry');
const rendererDispatchSource = rendererSource.slice(rendererEntry);
const rendererMappings = new Set(
  [...rendererDispatchSource.matchAll(/component\.type === '([^']+)'/g)].map((match) => match[1]),
);
const referencedComponentTypes = (graph.componentCatalog || [])
  .filter((entry) => entry.status === 'referenced')
  .map((entry) => entry.type);
const explicitGapComponentTypes = (graph.componentCatalog || [])
  .filter((entry) => entry.status === 'explicit-gap')
  .map((entry) => entry.type);
const missingRendererMappings = referencedComponentTypes.filter((type) => !rendererMappings.has(type));
if (missingRendererMappings.length > 0) {
  failures.push(`missing renderer mappings: ${missingRendererMappings.join(',')}`);
}
if (!rendererSource.includes('Reader UI 组件契约漂移')) {
  failures.push('unknown ComponentType is not visibly fail-closed');
}

if (!fs.existsSync(COVERAGE_REGISTRY)) {
  failures.push('missing machine-executable ScreenGraph coverage registry');
}

let faithfulCoverageCount = 0;
let genericCoverageCount = 0;
let partialCoverageCount = 0;
let insufficientCoverageCount = 0;
let faithfulInstanceCount = 0;
let genericInstanceCount = 0;
let partialInstanceCount = 0;
let insufficientInstanceCount = 0;
let retiredRuntimeInstanceCount = 0;
let buttonCount = 0;
let boundButtonCount = 0;
let gapButtonCount = 0;
let wiredButtonCount = 0;
let dialogCount = 0;
let dialogChildButtonCount = 0;
let boundDialogChildButtonCount = 0;
let gapDialogChildButtonCount = 0;
let contentCount = 0;
let contentStateEvidenceCount = 0;
let emptyCount = 0;
let emptyStateEvidenceCount = 0;
let errorCount = 0;
let errorStateEvidenceCount = 0;
let permissionCount = 0;
let permissionStateEvidenceCount = 0;
if (fs.existsSync(COVERAGE_REGISTRY)) {
  const coverageSource = fs.readFileSync(COVERAGE_REGISTRY, 'utf8');
  const declaredDispatch = declaredStringArray(
    coverageSource,
    'READER_SCREEN_GRAPH_REFERENCED_DISPATCH_TYPES',
  );
  const declaredGeneric = declaredStringArray(
    coverageSource,
    'READER_SCREEN_GRAPH_GENERIC_USABLE_TYPES',
  );
  const declaredLiveStateProjection = declaredStringArray(
    coverageSource,
    'READER_SCREEN_GRAPH_LIVE_STATE_PROJECTION_TYPES',
  );
  const partialBody = requiredMatch(
    coverageSource,
    /export const READER_SCREEN_GRAPH_PARTIAL_ENTRIES:[^=]+?= \[([\s\S]*?)\n\];/,
    'READER_SCREEN_GRAPH_PARTIAL_ENTRIES',
  );
  const declaredPartial = [...partialBody.matchAll(/type: '([^']+)'/g)].map((match) => match[1]);
  const referencedSet = new Set(referencedComponentTypes);
  const declaredDispatchSet = new Set(declaredDispatch);
  const actualReferencedDispatchSet = new Set(
    [...rendererMappings].filter((type) => referencedSet.has(type)),
  );
  const genericSet = new Set(declaredGeneric);
  const liveStateProjectionSet = new Set(declaredLiveStateProjection);
  const partialSet = new Set(declaredPartial);

  if (!sameStringSet(declaredDispatchSet, actualReferencedDispatchSet)) {
    failures.push('coverage dispatch registry does not match ViewStateRenderer referenced branches');
  }
  if (!sameStringSet(declaredDispatchSet, referencedSet)) {
    failures.push('coverage dispatch registry does not exactly cover canonical referenced types');
  }
  for (const type of genericSet) {
    if (!referencedSet.has(type)) failures.push(`generic coverage type is not canonical referenced: ${type}`);
    if (partialSet.has(type)) failures.push(`coverage type is both generic and partial: ${type}`);
  }
  for (const type of partialSet) {
    if (!referencedSet.has(type)) failures.push(`partial coverage type is not canonical referenced: ${type}`);
  }
  for (const type of liveStateProjectionSet) {
    if (!referencedSet.has(type)) failures.push(`live-state projection type is not canonical referenced: ${type}`);
    if (!genericSet.has(type)) failures.push(`live-state projection type must remain generic usable: ${type}`);
    if (partialSet.has(type)) failures.push(`live-state projection type must not also be partial: ${type}`);
  }

  // Derive the partial set from the actual renderer body: a branch is partial
  // when canonical instances carry props or children that the branch never
  // consumes. Dedicated ArkUI pages may still read live Store state, but they
  // cannot be promoted as faithful ScreenGraph/ViewState adapters until this
  // canonical data is explicitly bridged.
  const branchMatches = [...rendererDispatchSource.matchAll(/(?:if|else if) \(component\.type === '([^']+)'\) \{/g)];
  const branchBodies = new Map();
  for (let index = 0; index < branchMatches.length; index += 1) {
    const start = branchMatches[index].index;
    const end = index + 1 < branchMatches.length
      ? branchMatches[index + 1].index
      : rendererDispatchSource.indexOf('    } else {', start);
    branchBodies.set(branchMatches[index][1], rendererDispatchSource.slice(start, end));
  }
  const appearanceBranch = branchBodies.get('ReaderAppearancePanel') || '';
  if (!appearanceBranch.includes('renderReadOnlyAppearanceState') ||
    !appearanceBranch.includes('component.props.section') ||
    !appearanceBranch.includes('component.children')) {
    failures.push('ReaderAppearancePanel must consume canonical section/children through its read-only state renderer');
  }
  const appearanceReadOnlyStart = rendererSource.indexOf('@Builder renderReadOnlyAppearanceChildren');
  const appearanceReadOnlyEnd = rendererSource.indexOf('@Builder renderReadOnlyAppearanceState', appearanceReadOnlyStart);
  const appearanceReadOnlySource = appearanceReadOnlyStart >= 0 && appearanceReadOnlyEnd > appearanceReadOnlyStart
    ? rendererSource.slice(appearanceReadOnlyStart, appearanceReadOnlyEnd)
    : '';
  if (!appearanceReadOnlySource.includes('.enabled(false)') ||
    !appearanceReadOnlySource.includes('.hitTestBehavior(HitTestMode.None)') ||
    appearanceReadOnlySource.includes('.onClick(') ||
    appearanceReadOnlySource.includes('ReaderUiStore.dispatch')) {
    failures.push('ReaderAppearancePanel canonical actions must remain visibly read-only and fail closed');
  }
  const replaceBranch = branchBodies.get('ReaderReplacePanel') || '';
  if (!replaceBranch.includes('renderReadOnlyReplaceState') ||
    !replaceBranch.includes('component.props.section') ||
    !replaceBranch.includes('component.children')) {
    failures.push('ReaderReplacePanel must consume canonical section/children through its read-only state renderer');
  }
  const replaceReadOnlyStart = rendererSource.indexOf('@Builder renderReadOnlyReplaceChildren');
  const replaceReadOnlyEnd = rendererSource.indexOf('@Builder renderReadOnlyReplaceState', replaceReadOnlyStart);
  const replaceReadOnlySource = replaceReadOnlyStart >= 0 && replaceReadOnlyEnd > replaceReadOnlyStart
    ? rendererSource.slice(replaceReadOnlyStart, replaceReadOnlyEnd)
    : '';
  if (!replaceReadOnlySource.includes('.enabled(false)') ||
    !replaceReadOnlySource.includes('.hitTestBehavior(HitTestMode.None)') ||
    replaceReadOnlySource.includes('.onClick(') ||
    replaceReadOnlySource.includes('ReaderUiStore.dispatch')) {
    failures.push('ReaderReplacePanel canonical actions must remain visibly read-only and fail closed');
  }
  const sourceSwitchBranch = branchBodies.get('SourceSwitchFlowPage') || '';
  if (!sourceSwitchBranch.includes('if (component.children.length > 0)') ||
    !sourceSwitchBranch.includes('Column().width(0).height(0)') ||
    !sourceSwitchBranch.includes('SourceSwitchFlowPage()')) {
    failures.push('SourceSwitchFlowPage must isolate withdrawn generated state-matrix children and retain only the live Figma window');
  }
  if (rendererSource.includes('renderReadOnlySourceSwitchChildren') ||
    rendererSource.includes('renderReadOnlySourceSwitchState')) {
    failures.push('withdrawn SourceSwitch state-matrix renderers must not remain in the native presentation path');
  }
  const readingTextBranch = branchBodies.get('ReadingTextFlow') || '';
  if (!readingTextBranch.includes('renderReadOnlyReadingTextState') ||
    !readingTextBranch.includes('renderReadingTextFlowMetadata') ||
    !readingTextBranch.includes('component.props.phase') ||
    !readingTextBranch.includes('component.props.state') ||
    !readingTextBranch.includes('component.props.fontFamily') ||
    !readingTextBranch.includes('component.children')) {
    failures.push('ReadingTextFlow must consume canonical phase/state/fontFamily/children without replacing native content');
  }
  const readingTextReadOnlyStart = rendererSource.indexOf('@Builder renderReadOnlyReadingTextChildren');
  const readingTextReadOnlyEnd = rendererSource.indexOf('@Builder renderReadOnlyReadingTextState', readingTextReadOnlyStart);
  const readingTextReadOnlySource = readingTextReadOnlyStart >= 0 && readingTextReadOnlyEnd > readingTextReadOnlyStart
    ? rendererSource.slice(readingTextReadOnlyStart, readingTextReadOnlyEnd)
    : '';
  const readingTextMetadataStart = rendererSource.indexOf('@Builder renderReadingTextFlowMetadata');
  const readingTextMetadataEnd = rendererSource.indexOf('  private debugTone', readingTextMetadataStart);
  const readingTextMetadataSource = readingTextMetadataStart >= 0 && readingTextMetadataEnd > readingTextMetadataStart
    ? rendererSource.slice(readingTextMetadataStart, readingTextMetadataEnd)
    : '';
  if (!readingTextReadOnlySource.includes("child.props.uiEventTrigger, '') === 'state-evidence'") ||
    !readingTextReadOnlySource.includes('child.props.uiEvent') ||
    !readingTextReadOnlySource.includes('.enabled(false)') ||
    !readingTextReadOnlySource.includes('.hitTestBehavior(HitTestMode.None)') ||
    readingTextReadOnlySource.includes('.onClick(') ||
    readingTextReadOnlySource.includes('ReaderUiStore.dispatch') ||
    !readingTextMetadataSource.includes('ReadingTextFlow()') ||
    readingTextMetadataSource.includes('ReadingTextFlow({') ||
    readingTextMetadataSource.includes('.onClick(') ||
    readingTextMetadataSource.includes('ReaderUiStore.dispatch')) {
    failures.push('ReadingTextFlow canonical evidence must remain read-only while native Core content stays authoritative');
  }
  const promotedStatePrimitiveTypes = ['Loading', 'ErrorState', 'Offline'];
  for (const type of promotedStatePrimitiveTypes) {
    const branch = branchBodies.get(type) || '';
    if (!branch.includes('this.statePrimitiveTitle(component)') ||
      !branch.includes('this.statePrimitiveMessage(component)')) {
      failures.push(`${type} faithful adapter must consume canonical title/message through the state primitive adapter`);
    }
  }
  const errorStateBranch = branchBodies.get('ErrorState') || '';
  if (!errorStateBranch.includes('retryEnabled: this.statePrimitiveRetryEnabled(component)')) {
    failures.push('ErrorState canonical projection must disable the primitive implicit retry action');
  }
  if (!fs.existsSync(STATE_PRIMITIVE_ADAPTER)) {
    failures.push('missing exact ScreenGraph state primitive adapter');
  } else {
    const adapterSource = fs.readFileSync(STATE_PRIMITIVE_ADAPTER, 'utf8');
    if (!promotedStatePrimitiveTypes.every((type) => adapterSource.includes(`component.type !== '${type}'`)) ||
      !adapterSource.includes('component.children.length !== 0') ||
      !adapterSource.includes('component.bindings.length !== 0') ||
      !adapterSource.includes('component.props.label') ||
      !adapterSource.includes("trigger !== 'state-evidence'") ||
      !adapterSource.includes('this.retryEnabled = false') ||
      adapterSource.includes("from '../store/ReaderUiStore'") ||
      adapterSource.includes('ReaderUiStore.dispatch')) {
      failures.push('state primitive adapter must stay Store-free, leaf-only, state-evidence-only, and action-free');
    }
  }
  const sharedComponentsSource = fs.readFileSync(SHARED_COMPONENTS, 'utf8');
  const errorStateStart = sharedComponentsSource.indexOf('export struct ErrorState');
  const errorStateEnd = sharedComponentsSource.indexOf('export struct Offline', errorStateStart);
  const errorStateSource = errorStateStart >= 0 && errorStateEnd > errorStateStart
    ? sharedComponentsSource.slice(errorStateStart, errorStateEnd)
    : '';
  if (!errorStateSource.includes('@Prop retryEnabled: boolean = true') ||
    !errorStateSource.includes('if (this.retryEnabled)') ||
    !errorStateSource.includes("type: 'retry-last-operation'")) {
    failures.push('ErrorState must preserve native retry by default while allowing canonical state projection to disable it');
  }
  const tapZonesBranch = branchBodies.get('TapZones') || '';
  const readerBaseBranch = branchBodies.get('ReaderBase') || '';
  if (!tapZonesBranch.includes('contractBindingsDefined: true') ||
    !tapZonesBranch.includes('contractBindings: component.bindings') ||
    !tapZonesBranch.includes('ReaderCapabilityClosureRouteRegistry.has(this.routeId)') ||
    !tapZonesBranch.includes('this.renderCapabilityClosureNode(') ||
    tapZonesBranch.includes('component.props.enabled')) {
    failures.push('TapZones must consume admitted targets while capability-route targets remain visibly fail-closed');
  }
  if (!readerBaseBranch.includes('readerBaseHasTapZones(component)') ||
    !readerBaseBranch.includes('readerBaseTapZoneBindings(component)') ||
    !readerBaseBranch.includes('ReaderCapabilityClosureRouteRegistry.has(this.routeId)') ||
    !readerBaseBranch.includes('this.renderCapabilityClosureNode(') ||
    readerBaseBranch.includes('this.renderChildren(')) {
    failures.push('ReaderBase must preserve the admitted native composite and render planned document anatomy fail-closed');
  }
  if (!fs.existsSync(TAP_ZONE_ADAPTER)) {
    failures.push('missing read-only ScreenGraph TapZones target adapter');
  } else {
    const adapterSource = fs.readFileSync(TAP_ZONE_ADAPTER, 'utf8');
    if (!adapterSource.includes("target === 'previous'") ||
      !adapterSource.includes("selected.event === 'reader.page.prev'") ||
      !adapterSource.includes("target === 'control'") ||
      !adapterSource.includes("selected.event === 'reader.control.toggle'") ||
      !adapterSource.includes("target === 'next'") ||
      !adapterSource.includes("selected.event === 'reader.page.next'") ||
      adapterSource.includes("from '../store/ReaderUiStore'") ||
      adapterSource.includes('ReaderUiStore.dispatch')) {
      failures.push('TapZones target adapter must stay Store-free and map only the three supported canonical actions');
    }
  }
  const nodes = [];
  const walkNodes = (components) => {
    for (const component of components || []) {
      nodes.push(component);
      walkNodes(component.children || []);
    }
  };
  for (const route of graph.routes || []) {
    for (const variant of route.variants || []) walkNodes(variant.components || []);
  }
  const activeRuntimeNodes = canonicalComponentRecords
    .filter((record) => !retiredComponentKeys.has(componentRecordKey(record.routeId, record.component.id)))
    .map((record) => record.component);
  // Button action closure is intentionally smaller than Button visual
  // coverage. Historical ScreenGraph entries synthesize self bindings from
  // ViewState uiEvent props; Reader UI 3.0 capability routes publish bindings
  // directly in ViewState. Prove both representations before the narrow
  // adapter may admit any route-owned action.
  const buttonRecords = [];
  const walkButtons = (routeId, pageState, components) => {
    for (const component of components || []) {
      if (component.type === 'Button') buttonRecords.push({ routeId, pageState, component });
      walkButtons(routeId, pageState, component.children || []);
    }
  };
  for (const route of graph.routes || []) {
    for (const variant of route.variants || []) {
      walkButtons(route.routeId, variant.pageState, variant.components || []);
    }
  }
  const boundButtonRecords = buttonRecords.filter((record) =>
    (record.component.bindings || []).length > 0);
  const gapButtonRecords = buttonRecords.filter((record) =>
    (record.component.bindings || []).length === 0);
  buttonCount = buttonRecords.length;
  boundButtonCount = boundButtonRecords.length;
  gapButtonCount = gapButtonRecords.length;
  if (buttonRecords.length !== 59 || boundButtonRecords.length !== 57 ||
    gapButtonRecords.length !== 2) {
    failures.push(`Button closure count changed: buttons=${buttonRecords.length} bound=${boundButtonRecords.length} gaps=${gapButtonRecords.length}`);
  }
  const allowedButtonProps = new Set([
    'action', 'availability', 'label', 'uiEvent', 'uiEventPayload', 'uiEventTrigger',
  ]);
  const invalidButtonRecord = buttonRecords.find((record) => {
    const component = record.component;
    const props = component.props || {};
    return component.compositionMode !== 'contract-tree' ||
      !sameStringSet(new Set(component.stateAuthorities || []), new Set(['contract'])) ||
      (component.children || []).length !== 0 ||
      (component.stateEventEvidence || []).length !== 0 ||
      typeof props.label !== 'string' || props.label.length === 0 ||
      props.enabled !== undefined || props.selected !== undefined ||
      Object.keys(props).some((key) => !allowedButtonProps.has(key));
  });
  if (invalidButtonRecord !== undefined) {
    failures.push(`Button exact data projection changed: ${invalidButtonRecord.routeId}/${invalidButtonRecord.component.id}`);
  }
  const viewStateButtonRecords = [];
  const walkViewStateButtons = (routeId, pageState, components) => {
    for (const component of components || []) {
      if (component.type === 'Button') viewStateButtonRecords.push({ routeId, pageState, component });
      walkViewStateButtons(routeId, pageState, component.children || []);
    }
  };
  for (const fixture of viewStateFixtures || []) {
    walkViewStateButtons(fixture.routeId, fixture.pageState, fixture.components || []);
  }
  const viewStateButtonsByKey = new Map();
  for (const record of viewStateButtonRecords) {
    const key = `${record.routeId}/${record.pageState}/${record.component.id}`;
    if (viewStateButtonsByKey.has(key)) failures.push(`duplicate ViewState Button key: ${key}`);
    viewStateButtonsByKey.set(key, record.component);
  }
  if (viewStateButtonRecords.length !== 59 || viewStateButtonsByKey.size !== 59) {
    failures.push(`ViewState Button count changed: records=${viewStateButtonRecords.length} unique=${viewStateButtonsByKey.size}`);
  }
  for (const record of buttonRecords) {
    const key = `${record.routeId}/${record.pageState}/${record.component.id}`;
    const viewStateComponent = viewStateButtonsByKey.get(key);
    if (viewStateComponent === undefined || viewStateComponent.type !== 'Button' ||
      (viewStateComponent.children || []).length !== 0 ||
      JSON.stringify(canonicalValue(viewStateComponent.props || {})) !==
        JSON.stringify(canonicalValue(record.component.props || {}))) {
      failures.push(`Button ViewState/ScreenGraph data drift: ${key}`);
    }
  }
  for (const record of boundButtonRecords) {
    const component = record.component;
    const bindings = component.bindings || [];
    const binding = bindings[0];
    const props = component.props || {};
    const viewStateKey = `${record.routeId}/${record.pageState}/${component.id}`;
    const viewStateComponent = viewStateButtonsByKey.get(viewStateKey);
    const viewStateProps = viewStateComponent?.props || {};
    const viewStateBindings = viewStateComponent?.bindings || [];
    const directBindingMatches = viewStateBindings.length === 1 &&
      binding.target === viewStateBindings[0].target &&
      binding.event === viewStateBindings[0].event &&
      binding.trigger === viewStateBindings[0].trigger &&
      JSON.stringify(canonicalValue(binding.payload || {})) ===
        JSON.stringify(canonicalValue(viewStateBindings[0].payload || {}));
    const synthesizedBindingMatches = viewStateBindings.length === 0 && binding.target === 'self' &&
      binding.event === props.uiEvent && binding.trigger === props.uiEventTrigger &&
      JSON.stringify(canonicalValue(binding.payload || {})) ===
        JSON.stringify(canonicalValue(props.uiEventPayload || {})) &&
      binding.event === viewStateProps.uiEvent && binding.trigger === viewStateProps.uiEventTrigger &&
      JSON.stringify(canonicalValue(binding.payload || {})) ===
        JSON.stringify(canonicalValue(viewStateProps.uiEventPayload || {}));
    const bindingEvidenceMatches = directBindingMatches
      ? binding.evidenceProperty === 'explicitBinding'
      : binding.evidenceProperty === 'uiEvent';
    if (bindings.length !== 1 || !bindingEvidenceMatches ||
      (!directBindingMatches && !synthesizedBindingMatches)) {
      failures.push(`Button ViewState/ScreenGraph binding drift: ${record.routeId}/${component.id}`);
    }
  }
  const actualButtonGaps = new Set(gapButtonRecords.map((record) =>
    `${record.routeId}/${record.component.id}`));
  const expectedButtonGaps = new Set([
    'import-parsing/import_parsing-action',
    'reader-progress-restore/reader-progress-start-over',
  ]);
  if (!sameStringSet(actualButtonGaps, expectedButtonGaps) ||
    gapButtonRecords.some((record) => record.component.props?.uiEvent !== undefined ||
      record.component.props?.uiEventTrigger !== undefined)) {
    failures.push('Button action gaps changed; labels must not be promoted without explicit bindings');
  }
  const actualSafeButtons = new Set(buttonRecords.filter((record) => {
    const props = record.component.props || {};
    return props.uiEvent === 'source.import.open' && props.uiEventTrigger === 'tap' &&
      Object.keys(props.uiEventPayload || {}).length === 0;
  }).map((record) => `${record.routeId}/${record.component.id}`));
  const expectedSafeButtonRecords = new Map([
    ['import-permission-denied/import_permission_denied-action',
      { pageState: 'permission', label: '重新选择文件' }],
    ['import-format-unsupported/import_format_unsupported-action',
      { pageState: 'error', label: '重新选择文件' }],
    ['import-empty-file/import_empty_file-action',
      { pageState: 'empty', label: '重新选择文件' }],
    ['import-result-detail/import_result_detail-action',
      { pageState: 'default', label: '继续导入' }],
  ]);
  const expectedSafeButtons = new Set(expectedSafeButtonRecords.keys());
  wiredButtonCount = actualSafeButtons.size;
  const safeButtonMetadataChanged = buttonRecords.some((record) => {
    const key = `${record.routeId}/${record.component.id}`;
    const expected = expectedSafeButtonRecords.get(key);
    if (expected === undefined) return false;
    return record.pageState !== expected.pageState || record.component.props?.label !== expected.label;
  });
  if (!sameStringSet(actualSafeButtons, expectedSafeButtons) || safeButtonMetadataChanged) {
    failures.push('audited source.import.open Button allowlist changed');
  }
  if (!fs.existsSync(BUTTON_ADAPTER)) {
    failures.push('missing fail-closed ScreenGraph Button adapter');
  } else {
    const adapterSource = fs.readFileSync(BUTTON_ADAPTER, 'utf8');
    if (!adapterSource.includes('pageState: string') ||
      !adapterSource.includes('component.bindings.length !== 0') ||
      !adapterSource.includes('component.props.enabled !== undefined') ||
      !adapterSource.includes('component.props.selected !== undefined') ||
      !adapterSource.includes("component.props.uiEvent !== 'source.import.open'") ||
      !adapterSource.includes("component.props.uiEventTrigger !== 'tap'") ||
      !adapterSource.includes("return { type: 'source-import-open' }") ||
      ![...expectedSafeButtonRecords.entries()].every(([entry, expected]) => {
        const parts = entry.split('/');
        return adapterSource.includes(`routeId === '${parts[0]}'`) &&
          adapterSource.includes(`pageState === '${expected.pageState}'`) &&
          adapterSource.includes(`componentId === '${parts[1]}'`) &&
          adapterSource.includes(`label === '${expected.label}'`);
      }) || adapterSource.includes("from '../store/ReaderUiStore'") ||
      adapterSource.includes('ReaderUiStore.dispatch')) {
      failures.push('Button adapter must remain Store-free and exact-match only the four audited route-owned actions');
    }
  }
  const canonicalButtonStart = rendererSource.indexOf('@Builder renderCanonicalButton');
  const canonicalButtonEnd = rendererSource.indexOf('  @Builder renderDebuggedComponent', canonicalButtonStart);
  const canonicalButtonSource = canonicalButtonStart >= 0 && canonicalButtonEnd > canonicalButtonStart
    ? rendererSource.slice(canonicalButtonStart, canonicalButtonEnd)
    : '';
  if (!canonicalButtonSource.includes('this.routeId, this.pageState, component') ||
    !canonicalButtonSource.includes('if (event !== null) ReaderUiStore.dispatch(event)') ||
    !canonicalButtonSource.includes('this.renderInertCanonicalButton(component)') ||
    !rendererSource.includes("return component.props.label ?? ''") ||
    !canonicalButtonSource.includes('.enabled(false)') ||
    !canonicalButtonSource.includes('.hitTestBehavior(HitTestMode.None)')) {
    failures.push('Button renderer must consume exact labels, dispatch only adapter-approved actions, and keep all rejected Buttons inert');
  }
  const expectedCapabilityClosureRouteIds = new Set([
    'onboarding-welcome', 'onboarding-capability-setup', 'permission-recovery',
    'local-format-support', 'pdf-reader', 'manga-reader', 'http-tts-management',
    'http-tts-editor', 'http-tts-test', 'content-edit', 'book-cover-change',
    'book-cover-search', 'chapter-reviews', 'bookmarks-manager', 'download-queue',
    'download-task-detail', 'storage-management', 'webview-login', 'webview-captcha',
    'webview-challenge', 'webview-cookie-return', 'settings-tts', 'settings-storage',
    'settings-accessibility',
  ]);
  const capabilityRoutes = (graph.routes || []).filter((route) =>
    expectedCapabilityClosureRouteIds.has(route.routeId));
  const capabilityCounts = capabilityRoutes.reduce((totals, route) => {
    totals.variants += (route.variants || []).length;
    for (const variant of route.variants || []) {
      const counts = countComponents(variant.components || []);
      totals.components += counts.components;
      totals.bindings += counts.bindings;
    }
    return totals;
  }, { variants: 0, components: 0, bindings: 0 });
  const capabilityButtonCount = buttonRecords.filter((record) =>
    expectedCapabilityClosureRouteIds.has(record.routeId)).length;
  if (capabilityRoutes.length !== 24 || capabilityCounts.variants !== 24 ||
    capabilityCounts.components !== 93 || capabilityCounts.bindings !== 51 ||
    capabilityButtonCount !== 26) {
    failures.push(`Reader UI 3.0 capability closure changed: routes=${capabilityRoutes.length} variants=${capabilityCounts.variants} components=${capabilityCounts.components} bindings=${capabilityCounts.bindings} buttons=${capabilityButtonCount}`);
  }
  if (!fs.existsSync(CAPABILITY_CLOSURE_REGISTRY)) {
    failures.push('missing Reader UI 3.0 capability closure registry');
  } else {
    const capabilityRegistrySource = fs.readFileSync(CAPABILITY_CLOSURE_REGISTRY, 'utf8');
    const capabilityDefinitions = [...capabilityRegistrySource.matchAll(
      /(plannedRouteDefinition|coreRouteDefinition|nativeRouteDefinition)\(\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*\[([^\]]*)\]\s*\)/g,
    )].map((match) => ({
      helper: match[1],
      routeId: match[2],
      title: match[3],
      shell: match[4],
      pageState: match[5],
      topLevelTypes: [...match[6].matchAll(/'([^']+)'/g)].map((typeMatch) => typeMatch[1]),
    }));
    const declaredCapabilityRoutes = new Set(capabilityDefinitions.map((definition) => definition.routeId));
    const coreBackedRoutes = new Set(capabilityDefinitions
      .filter((definition) => definition.helper === 'coreRouteDefinition')
      .map((definition) => definition.routeId));
    const expectedCoreBackedRoutes = new Set(['bookmarks-manager']);
    const nativeBackedRoutes = new Set(capabilityDefinitions
      .filter((definition) => definition.helper === 'nativeRouteDefinition')
      .map((definition) => definition.routeId));
    const expectedNativeBackedRoutes = new Set([
      'onboarding-welcome', 'onboarding-capability-setup',
      'permission-recovery', 'settings-accessibility',
    ]);
    if (!sameStringSet(declaredCapabilityRoutes, expectedCapabilityClosureRouteIds) ||
      capabilityDefinitions.length !== 24 ||
      !sameStringSet(coreBackedRoutes, expectedCoreBackedRoutes) ||
      !sameStringSet(nativeBackedRoutes, expectedNativeBackedRoutes) ||
      capabilityDefinitions.filter((definition) => definition.helper === 'plannedRouteDefinition').length !== 19 ||
      !capabilityRegistrySource.includes("CoreBacked = 'CoreBacked'") ||
      !capabilityRegistrySource.includes("NativeBacked = 'NativeBacked'") ||
      !capabilityRegistrySource.includes("PlannedFailClosed = 'PlannedFailClosed'") ||
      !capabilityRegistrySource.includes('executionPolicy: CapabilityClosureExecutionPolicy.CoreBacked') ||
      !capabilityRegistrySource.includes('executionPolicy: CapabilityClosureExecutionPolicy.NativeBacked') ||
      !capabilityRegistrySource.includes('executionPolicy: CapabilityClosureExecutionPolicy.PlannedFailClosed')) {
      failures.push('capability closure registry must pin 19 planned fail-closed, 4 Slice 12 native-backed, and 1 Slice 10 Core-backed route');
    }
    for (const definition of capabilityDefinitions) {
      const canonicalRoute = capabilityRoutes.find((route) => route.routeId === definition.routeId);
      const canonicalVariant = canonicalRoute?.variants?.[0];
      const canonicalTopLevelTypes = (canonicalVariant?.components || []).map((component) => component.type);
      if (canonicalRoute === undefined || canonicalVariant === undefined ||
        canonicalRoute.title !== definition.title || canonicalRoute.shell !== definition.shell ||
        canonicalVariant.pageState !== definition.pageState ||
        JSON.stringify(canonicalTopLevelTypes) !== JSON.stringify(definition.topLevelTypes)) {
        failures.push(`capability closure route structure drift: ${definition.routeId}`);
      }
    }
  }
  const capabilityBuilderStart = rendererSource.indexOf('@Builder renderCapabilityClosureNode');
  const capabilityBuilderEnd = rendererSource.indexOf('  @Builder renderCanonicalButton', capabilityBuilderStart);
  const capabilityBuilderSource = capabilityBuilderStart >= 0 && capabilityBuilderEnd > capabilityBuilderStart
    ? rendererSource.slice(capabilityBuilderStart, capabilityBuilderEnd)
    : '';
  if (!rendererSource.includes("from '../router/ReaderCapabilityClosureRouteRegistry'") ||
    !capabilityBuilderSource.includes('planned action · fail-closed') ||
    !capabilityBuilderSource.includes('.enabled(false)') ||
    !capabilityBuilderSource.includes('.hitTestBehavior(HitTestMode.None)') ||
    capabilityBuilderSource.includes('.onClick(') ||
    capabilityBuilderSource.includes('ReaderUiStore.dispatch')) {
    failures.push('capability closure structure must stay visible, Store-free, and hit-test disabled');
  }
  // Dialog closure is visual/data faithful but not yet interaction faithful:
  // five of its six Button children have canonical bindings which do not have
  // exact Host/reducer/runtime ownership in this consumer. Prove all nine
  // Dialog shapes and keep that blocker executable rather than silently
  // promoting a disabled action surface.
  const dialogRecords = [];
  const walkDialogs = (routeId, pageState, components) => {
    for (const component of components || []) {
      if (component.type === 'Dialog') dialogRecords.push({ routeId, pageState, component });
      walkDialogs(routeId, pageState, component.children || []);
    }
  };
  for (const route of graph.routes || []) {
    for (const variant of route.variants || []) {
      walkDialogs(route.routeId, variant.pageState, variant.components || []);
    }
  }
  dialogCount = dialogRecords.length;
  const expectedDialogKeys = new Set([
    'reader-font-import-confirm/default/reader_font_import_confirm-state',
    'reader-font-delete-confirm/default/reader_font_delete_confirm-state',
    'reader-theme-delete-confirm/default/reader_theme_delete_confirm-state',
    'reader-typography-reset-confirm/default/reader_typography_reset_confirm-state',
    'reader-replace-delete-confirm/default/reader_replace_delete_confirm-state',
    'source-switch-rollback/default/source_switch_rollback-state',
    'reader-progress-restore/default/reader-progress-restore-dialog',
    'import-duplicate/default/import_duplicate-state',
    'import-conflict-resolve/default/import_conflict_resolve-state',
  ]);
  const actualDialogKeys = new Set(dialogRecords.map((record) =>
    `${record.routeId}/${record.pageState}/${record.component.id}`));
  if (dialogRecords.length !== 9 || !sameStringSet(actualDialogKeys, expectedDialogKeys)) {
    failures.push(`Dialog closure identity changed: dialogs=${dialogRecords.length}`);
  }
  const allowedDialogProps = new Set([
    'message', 'title', 'uiEvent', 'uiEventPayload', 'uiEventTrigger',
  ]);
  const invalidDialogRecord = dialogRecords.find((record) => {
    const component = record.component;
    const props = component.props || {};
    const evidence = component.stateEventEvidence || [];
    if (component.compositionMode !== 'contract-tree' ||
      !sameStringSet(new Set(component.stateAuthorities || []), new Set(['contract'])) ||
      (component.bindings || []).length !== 0 ||
      typeof props.title !== 'string' || props.title.length === 0 ||
      Object.keys(props).some((key) => !allowedDialogProps.has(key)) ||
      (component.children || []).some((child) =>
        child.type !== 'Button' || (child.children || []).length !== 0)) return true;
    const key = `${record.routeId}/${record.pageState}/${component.id}`;
    if (key === 'import-duplicate/default/import_duplicate-state') {
      return evidence.length !== 1 || props.uiEventTrigger !== 'state-evidence' ||
        props.uiEvent !== 'import.duplicate.found' ||
        evidence[0].classification !== 'state-evidence' ||
        evidence[0].event !== props.uiEvent ||
        JSON.stringify(canonicalValue(evidence[0].payload || {})) !==
          JSON.stringify(canonicalValue(props.uiEventPayload || {}));
    }
    return evidence.length !== 0 || props.uiEvent !== undefined ||
      props.uiEventPayload !== undefined || props.uiEventTrigger !== undefined;
  });
  if (invalidDialogRecord !== undefined) {
    failures.push(`Dialog exact data projection changed: ${invalidDialogRecord.routeId}/${invalidDialogRecord.component.id}`);
  }
  const messageDialogCount = dialogRecords.filter((record) =>
    typeof record.component.props?.message === 'string' && record.component.props.message.length > 0).length;
  const dialogChildButtons = dialogRecords.flatMap((record) => record.component.children || []);
  const boundDialogChildButtons = dialogChildButtons.filter((child) => (child.bindings || []).length === 1);
  const gapDialogChildButtons = dialogChildButtons.filter((child) => (child.bindings || []).length === 0);
  dialogChildButtonCount = dialogChildButtons.length;
  boundDialogChildButtonCount = boundDialogChildButtons.length;
  gapDialogChildButtonCount = gapDialogChildButtons.length;
  const dialogChildEvents = new Set(boundDialogChildButtons.map((child) => child.bindings[0].event));
  const expectedDialogChildEvents = new Set([
    'reader.font.import',
    'reader.font.delete',
    'reader.theme.delete',
    'reader.typography.reset',
    'reader.progress.restore',
  ]);
  if (messageDialogCount !== 8 || dialogChildButtons.length !== 6 ||
    boundDialogChildButtons.length !== 5 || gapDialogChildButtons.length !== 1 ||
    !sameStringSet(dialogChildEvents, expectedDialogChildEvents) ||
    gapDialogChildButtons[0]?.id !== 'reader-progress-start-over') {
    failures.push(`Dialog child action closure changed: messages=${messageDialogCount} buttons=${dialogChildButtons.length} bound=${boundDialogChildButtons.length} gaps=${gapDialogChildButtons.length}`);
  }
  const viewStateDialogRecords = [];
  const walkViewStateDialogs = (routeId, pageState, components) => {
    for (const component of components || []) {
      if (component.type === 'Dialog') viewStateDialogRecords.push({ routeId, pageState, component });
      walkViewStateDialogs(routeId, pageState, component.children || []);
    }
  };
  for (const fixture of viewStateFixtures || []) {
    walkViewStateDialogs(fixture.routeId, fixture.pageState, fixture.components || []);
  }
  const viewStateDialogsByKey = new Map(viewStateDialogRecords.map((record) => [
    `${record.routeId}/${record.pageState}/${record.component.id}`, record.component,
  ]));
  if (viewStateDialogRecords.length !== 9 || viewStateDialogsByKey.size !== 9) {
    failures.push(`ViewState Dialog count changed: records=${viewStateDialogRecords.length} unique=${viewStateDialogsByKey.size}`);
  }
  for (const record of dialogRecords) {
    const key = `${record.routeId}/${record.pageState}/${record.component.id}`;
    const viewStateDialog = viewStateDialogsByKey.get(key);
    const graphChildren = record.component.children || [];
    const viewStateChildren = viewStateDialog?.children || [];
    const childParity = graphChildren.length === viewStateChildren.length &&
      graphChildren.every((child, index) => {
        const viewStateChild = viewStateChildren[index];
        return viewStateChild !== undefined && child.type === viewStateChild.type &&
          child.id === viewStateChild.id && (viewStateChild.children || []).length === 0 &&
          (viewStateChild.bindings || []).length === 0 &&
          JSON.stringify(canonicalValue(child.props || {})) ===
            JSON.stringify(canonicalValue(viewStateChild.props || {}));
      });
    if (viewStateDialog === undefined || (viewStateDialog.bindings || []).length !== 0 ||
      JSON.stringify(canonicalValue(record.component.props || {})) !==
        JSON.stringify(canonicalValue(viewStateDialog.props || {})) || !childParity) {
      failures.push(`Dialog ViewState/ScreenGraph data drift: ${key}`);
    }
  }
  if (!fs.existsSync(DIALOG_ADAPTER)) {
    failures.push('missing exact ScreenGraph Dialog adapter');
  } else {
    const adapterSource = fs.readFileSync(DIALOG_ADAPTER, 'utf8');
    if (!adapterSource.includes("component.type !== 'Dialog'") ||
      !adapterSource.includes('component.bindings.length !== 0') ||
      !adapterSource.includes('validStateEvidence(component)') ||
      !adapterSource.includes('validButtonChild(component.children[index])') ||
      adapterSource.includes("from '../store/ReaderUiStore'") ||
      adapterSource.includes('ReaderUiStore.dispatch')) {
      failures.push('Dialog adapter must remain Store-free and exact-project only canonical data and Button child shapes');
    }
  }
  const canonicalDialogStart = rendererSource.indexOf('@Builder renderCanonicalDialog');
  const canonicalDialogEnd = rendererSource.indexOf('  @Builder renderDebuggedComponent', canonicalDialogStart);
  const canonicalDialogSource = canonicalDialogStart >= 0 && canonicalDialogEnd > canonicalDialogStart
    ? rendererSource.slice(canonicalDialogStart, canonicalDialogEnd)
    : '';
  const dialogBranch = branchBodies.get('Dialog') || '';
  if (!canonicalDialogSource.includes('Text(projection.title)') ||
    !canonicalDialogSource.includes("if (projection.message !== '')") ||
    !canonicalDialogSource.includes('this.renderChildren(projection.children)') ||
    !canonicalDialogSource.includes('Dialog 契约漂移') ||
    !dialogBranch.includes('ReaderUIScreenGraphDialogAdapter.project(component)') ||
    !rendererSource.includes("else if (child.type === 'Dialog')") ||
    !genericSet.has('Dialog') ||
    !coverageSource.includes('5 executable nested Button bindings remain inert')) {
    failures.push('Dialog renderer must consume exact projection, keep all appearance dialogs on the dedicated branch, and retain its executable-child blocker');
  }
  // Four historical Content leaves retain their strict state projection. The
  // two Reader UI 3.0 document surfaces are structurally explicit but remain
  // generic/fail-closed until PDF and manga Host renderer owners are admitted.
  const contentRecords = [];
  const walkContent = (routeId, pageState, components) => {
    for (const component of components || []) {
      if (component.type === 'Content') contentRecords.push({ routeId, pageState, component });
      walkContent(routeId, pageState, component.children || []);
    }
  };
  for (const route of graph.routes || []) {
    for (const variant of route.variants || []) {
      walkContent(route.routeId, variant.pageState, variant.components || []);
    }
  }
  contentCount = contentRecords.length;
  const expectedStrictContentKeys = new Set([
    'reader-replace-apply-result/default/reader_replace_apply_result-state',
    'reader-replace-preview/default/reader_replace_preview-state',
    'import-partial-success/default/import_partial_success-state',
    'import-result-detail/default/import_result_detail-state',
  ]);
  const expectedCapabilityContentProps = new Map([
    ['pdf-reader/default/pdf-page-surface', { page: 12, pageCount: 218, zoom: 1 }],
    ['manga-reader/default/manga-image-surface', {
      imageIndex: 6, imageCount: 42, readingDirection: 'vertical',
    }],
  ]);
  const expectedContentKeys = new Set([
    ...expectedStrictContentKeys,
    ...expectedCapabilityContentProps.keys(),
  ]);
  const actualContentKeys = new Set(contentRecords.map((record) =>
    `${record.routeId}/${record.pageState}/${record.component.id}`));
  if (contentRecords.length !== 6 || !sameStringSet(actualContentKeys, expectedContentKeys)) {
    failures.push(`Content closure identity changed: contents=${contentRecords.length}`);
  }
  const allowedContentProps = new Set([
    'message', 'title', 'uiEvent', 'uiEventPayload', 'uiEventTrigger',
  ]);
  contentStateEvidenceCount = contentRecords.reduce(
    (count, record) => count + (record.component.stateEventEvidence || []).length,
    0,
  );
  const invalidContentRecord = contentRecords.find((record) => {
    const component = record.component;
    const props = component.props || {};
    const evidence = component.stateEventEvidence || [];
    const key = `${record.routeId}/${record.pageState}/${component.id}`;
    const expectedCapabilityProps = expectedCapabilityContentProps.get(key);
    if (expectedCapabilityProps !== undefined) {
      return component.compositionMode !== 'contract-tree' ||
        !sameStringSet(new Set(component.stateAuthorities || []), new Set(['contract'])) ||
        (component.children || []).length !== 0 || (component.bindings || []).length !== 0 ||
        evidence.length !== 0 ||
        JSON.stringify(canonicalValue(props)) !== JSON.stringify(canonicalValue(expectedCapabilityProps));
    }
    if (!expectedStrictContentKeys.has(key)) return true;
    if (component.compositionMode !== 'contract-tree' ||
      !sameStringSet(new Set(component.stateAuthorities || []), new Set(['contract'])) ||
      (component.children || []).length !== 0 || (component.bindings || []).length !== 0 ||
      typeof props.title !== 'string' || props.title.length === 0 ||
      typeof props.message !== 'string' || props.message.length === 0 ||
      Object.keys(props).some((key) => !allowedContentProps.has(key))) return true;
    if (key === 'import-partial-success/default/import_partial_success-state') {
      return evidence.length !== 1 || props.uiEventTrigger !== 'state-evidence' ||
        props.uiEvent !== 'import.partial.success' ||
        evidence[0].classification !== 'state-evidence' ||
        evidence[0].event !== props.uiEvent ||
        JSON.stringify(canonicalValue(evidence[0].payload || {})) !==
          JSON.stringify(canonicalValue(props.uiEventPayload || {}));
    }
    return evidence.length !== 0 || props.uiEvent !== undefined ||
      props.uiEventPayload !== undefined || props.uiEventTrigger !== undefined;
  });
  if (contentStateEvidenceCount !== 1 || invalidContentRecord !== undefined) {
    const invalidKey = invalidContentRecord === undefined
      ? 'state-evidence-count'
      : `${invalidContentRecord.routeId}/${invalidContentRecord.component.id}`;
    failures.push(`Content exact state projection changed: ${invalidKey}`);
  }
  const viewStateContentRecords = [];
  const walkViewStateContent = (routeId, pageState, components) => {
    for (const component of components || []) {
      if (component.type === 'Content') viewStateContentRecords.push({ routeId, pageState, component });
      walkViewStateContent(routeId, pageState, component.children || []);
    }
  };
  for (const fixture of viewStateFixtures || []) {
    walkViewStateContent(fixture.routeId, fixture.pageState, fixture.components || []);
  }
  const viewStateContentByKey = new Map(viewStateContentRecords.map((record) => [
    `${record.routeId}/${record.pageState}/${record.component.id}`, record.component,
  ]));
  if (viewStateContentRecords.length !== 6 || viewStateContentByKey.size !== 6) {
    failures.push(`ViewState Content count changed: records=${viewStateContentRecords.length} unique=${viewStateContentByKey.size}`);
  }
  for (const record of contentRecords) {
    const key = `${record.routeId}/${record.pageState}/${record.component.id}`;
    const viewStateContent = viewStateContentByKey.get(key);
    if (viewStateContent === undefined || (viewStateContent.children || []).length !== 0 ||
      (viewStateContent.bindings || []).length !== 0 ||
      JSON.stringify(canonicalValue(record.component.props || {})) !==
        JSON.stringify(canonicalValue(viewStateContent.props || {}))) {
      failures.push(`Content ViewState/ScreenGraph data drift: ${key}`);
    }
  }
  if (!fs.existsSync(CONTENT_ADAPTER)) {
    failures.push('missing strict ScreenGraph Content adapter');
  } else {
    const adapterSource = fs.readFileSync(CONTENT_ADAPTER, 'utf8');
    if (!adapterSource.includes("component.type !== 'Content'") ||
      !adapterSource.includes('component.children.length !== 0') ||
      !adapterSource.includes('component.bindings.length !== 0') ||
      !adapterSource.includes("trigger === 'state-evidence'") ||
      adapterSource.includes("from '../store/ReaderUiStore'") ||
      adapterSource.includes('ReaderUiStore.dispatch')) {
      failures.push('Content adapter must remain Store-free, strict-leaf, and state-evidence-only');
    }
  }
  const canonicalContentStart = rendererSource.indexOf('@Builder renderCanonicalContent');
  const canonicalContentEnd = rendererSource.indexOf('  @Builder renderDebuggedComponent', canonicalContentStart);
  const canonicalContentSource = canonicalContentStart >= 0 && canonicalContentEnd > canonicalContentStart
    ? rendererSource.slice(canonicalContentStart, canonicalContentEnd)
    : '';
  const contentBranch = branchBodies.get('Content') || '';
  if (!canonicalContentSource.includes('Text(projection.title)') ||
    !canonicalContentSource.includes('projection.message !== projection.title') ||
    !canonicalContentSource.includes('Text(projection.message)') ||
    !canonicalContentSource.includes('Content 契约漂移') ||
    canonicalContentSource.includes('.onClick(') ||
    canonicalContentSource.includes('ReaderUiStore.dispatch') ||
    !contentBranch.includes('ReaderUIScreenGraphContentAdapter.project(component)') ||
    !contentBranch.includes('ReaderCapabilityClosureRouteRegistry.has(this.routeId)') ||
    !contentBranch.includes('this.renderCapabilityClosureNode(') ||
    !genericSet.has('Content') || partialSet.has('Content')) {
    failures.push('Content renderer must preserve strict historical leaves and keep planned document surfaces visibly fail-closed');
  }
  // Empty is also an exact contract-owned state leaf. Both canonical
  // occurrences carry state-evidence only; the dedicated projection renders
  // title/message while deliberately exposing no action or Store callback.
  const emptyRecords = [];
  const walkEmpty = (routeId, pageState, components) => {
    for (const component of components || []) {
      if (component.type === 'Empty') emptyRecords.push({ routeId, pageState, component });
      walkEmpty(routeId, pageState, component.children || []);
    }
  };
  for (const route of graph.routes || []) {
    for (const variant of route.variants || []) {
      walkEmpty(route.routeId, variant.pageState, variant.components || []);
    }
  }
  emptyCount = emptyRecords.length;
  const expectedEmptyProps = new Map([
    ['source-switch-empty/empty/source_switch_empty-state', {
      message: '无可用源',
      title: '无可用源',
      uiEvent: 'source.switch.empty',
      uiEventPayload: { bookId: 'bk-001', sourceId: 'source-old' },
      uiEventTrigger: 'state-evidence',
    }],
    ['import-empty-file/empty/import_empty_file-state', {
      message: '文件为空',
      title: '文件为空',
      uiEvent: 'import.file.empty',
      uiEventPayload: { fileName: 'empty.txt', size: 0 },
      uiEventTrigger: 'state-evidence',
    }],
  ]);
  const actualEmptyKeys = new Set(emptyRecords.map((record) =>
    `${record.routeId}/${record.pageState}/${record.component.id}`));
  if (emptyRecords.length !== 2 ||
    !sameStringSet(actualEmptyKeys, new Set(expectedEmptyProps.keys()))) {
    failures.push(`Empty closure identity changed: empties=${emptyRecords.length}`);
  }
  const allowedEmptyProps = new Set([
    'message', 'title', 'uiEvent', 'uiEventPayload', 'uiEventTrigger',
  ]);
  emptyStateEvidenceCount = emptyRecords.reduce(
    (count, record) => count + (record.component.stateEventEvidence || []).length,
    0,
  );
  const invalidEmptyRecord = emptyRecords.find((record) => {
    const component = record.component;
    const props = component.props || {};
    const evidence = component.stateEventEvidence || [];
    const key = `${record.routeId}/${record.pageState}/${component.id}`;
    const expectedProps = expectedEmptyProps.get(key);
    return component.compositionMode !== 'contract-tree' ||
      !sameStringSet(new Set(component.stateAuthorities || []), new Set(['contract'])) ||
      (component.children || []).length !== 0 || (component.bindings || []).length !== 0 ||
      typeof props.title !== 'string' || props.title.length === 0 ||
      typeof props.message !== 'string' || props.message.length === 0 ||
      Object.keys(props).some((prop) => !allowedEmptyProps.has(prop)) ||
      expectedProps === undefined ||
      JSON.stringify(canonicalValue(props)) !== JSON.stringify(canonicalValue(expectedProps)) ||
      evidence.length !== 1 || props.uiEventTrigger !== 'state-evidence' ||
      evidence[0].classification !== 'state-evidence' || evidence[0].event !== props.uiEvent ||
      JSON.stringify(canonicalValue(evidence[0].payload || {})) !==
        JSON.stringify(canonicalValue(props.uiEventPayload || {}));
  });
  if (emptyStateEvidenceCount !== 2 || invalidEmptyRecord !== undefined) {
    const invalidKey = invalidEmptyRecord === undefined
      ? 'state-evidence-count'
      : `${invalidEmptyRecord.routeId}/${invalidEmptyRecord.component.id}`;
    failures.push(`Empty exact state projection changed: ${invalidKey}`);
  }
  const viewStateEmptyRecords = [];
  const walkViewStateEmpty = (routeId, pageState, components) => {
    for (const component of components || []) {
      if (component.type === 'Empty') viewStateEmptyRecords.push({ routeId, pageState, component });
      walkViewStateEmpty(routeId, pageState, component.children || []);
    }
  };
  for (const fixture of viewStateFixtures || []) {
    walkViewStateEmpty(fixture.routeId, fixture.pageState, fixture.components || []);
  }
  const viewStateEmptyByKey = new Map(viewStateEmptyRecords.map((record) => [
    `${record.routeId}/${record.pageState}/${record.component.id}`, record.component,
  ]));
  if (viewStateEmptyRecords.length !== 2 || viewStateEmptyByKey.size !== 2) {
    failures.push(`ViewState Empty count changed: records=${viewStateEmptyRecords.length} unique=${viewStateEmptyByKey.size}`);
  }
  for (const record of emptyRecords) {
    const key = `${record.routeId}/${record.pageState}/${record.component.id}`;
    const viewStateEmpty = viewStateEmptyByKey.get(key);
    if (viewStateEmpty === undefined || (viewStateEmpty.children || []).length !== 0 ||
      (viewStateEmpty.bindings || []).length !== 0 ||
      JSON.stringify(canonicalValue(record.component.props || {})) !==
        JSON.stringify(canonicalValue(viewStateEmpty.props || {}))) {
      failures.push(`Empty ViewState/ScreenGraph data drift: ${key}`);
    }
  }
  if (!fs.existsSync(EMPTY_ADAPTER)) {
    failures.push('missing strict ScreenGraph Empty adapter');
  } else {
    const adapterSource = fs.readFileSync(EMPTY_ADAPTER, 'utf8');
    if (!adapterSource.includes("component.type !== 'Empty'") ||
      !adapterSource.includes('component.children.length !== 0') ||
      !adapterSource.includes('component.bindings.length !== 0') ||
      !adapterSource.includes("component.props.uiEventTrigger === 'state-evidence'") ||
      adapterSource.includes("from '../store/ReaderUiStore'") ||
      adapterSource.includes('ReaderUiStore.dispatch')) {
      failures.push('Empty adapter must remain Store-free, strict-leaf, and state-evidence-only');
    }
  }
  const canonicalEmptyStart = rendererSource.indexOf('@Builder renderCanonicalEmpty');
  const canonicalEmptyEnd = rendererSource.indexOf('  @Builder renderDebuggedComponent', canonicalEmptyStart);
  const canonicalEmptySource = canonicalEmptyStart >= 0 && canonicalEmptyEnd > canonicalEmptyStart
    ? rendererSource.slice(canonicalEmptyStart, canonicalEmptyEnd)
    : '';
  const emptyBranch = branchBodies.get('Empty') || '';
  if (!canonicalEmptySource.includes('Text(projection.title)') ||
    !canonicalEmptySource.includes('projection.message !== projection.title') ||
    !canonicalEmptySource.includes('Text(projection.message)') ||
    !canonicalEmptySource.includes('Empty 契约漂移') ||
    canonicalEmptySource.includes('.onClick(') ||
    canonicalEmptySource.includes('ReaderUiStore.dispatch') ||
    !emptyBranch.includes('ReaderUIScreenGraphEmptyAdapter.project(component)') ||
    genericSet.has('Empty') || partialSet.has('Empty')) {
    failures.push('Empty faithful renderer must consume strict title/message state projection without an action callback');
  }
  // Error and Permission have different strict schemas even though both are
  // contract-owned terminal leaves. Error exposes retryability as inert state;
  // Permission validates its denial evidence. Neither owns an action binding.
  const terminalStateRecords = new Map([
    ['Error', []],
    ['Permission', []],
  ]);
  const walkTerminalStates = (routeId, pageState, components) => {
    for (const component of components || []) {
      if (terminalStateRecords.has(component.type)) {
        terminalStateRecords.get(component.type).push({ routeId, pageState, component });
      }
      walkTerminalStates(routeId, pageState, component.children || []);
    }
  };
  for (const route of graph.routes || []) {
    for (const variant of route.variants || []) {
      walkTerminalStates(route.routeId, variant.pageState, variant.components || []);
    }
  }
  const errorRecords = terminalStateRecords.get('Error');
  const permissionRecords = terminalStateRecords.get('Permission');
  errorCount = errorRecords.length;
  permissionCount = permissionRecords.length;
  errorStateEvidenceCount = errorRecords.reduce(
    (count, record) => count + (record.component.stateEventEvidence || []).length,
    0,
  );
  permissionStateEvidenceCount = permissionRecords.reduce(
    (count, record) => count + (record.component.stateEventEvidence || []).length,
    0,
  );
  const expectedErrorKey = 'state-error/error/global-error';
  const invalidErrorRecord = errorRecords.find((record) => {
    const component = record.component;
    const key = `${record.routeId}/${record.pageState}/${component.id}`;
    return key !== expectedErrorKey || component.compositionMode !== 'contract-tree' ||
      !sameStringSet(new Set(component.stateAuthorities || []), new Set(['contract'])) ||
      (component.children || []).length !== 0 || (component.bindings || []).length !== 0 ||
      (component.stateEventEvidence || []).length !== 0 ||
      JSON.stringify(canonicalValue(component.props || {})) !==
        JSON.stringify(canonicalValue({ message: '网络异常', retryable: true }));
  });
  if (errorRecords.length !== 1 || errorStateEvidenceCount !== 0 || invalidErrorRecord !== undefined) {
    failures.push(`Error exact retryable leaf changed: errors=${errorRecords.length} evidence=${errorStateEvidenceCount}`);
  }
  const expectedPermissionKey = 'import-permission-denied/permission/import_permission_denied-state';
  const expectedPermissionProps = {
    message: '导入权限被拒绝',
    title: '导入权限被拒绝',
    uiEvent: 'import.permission.denied',
    uiEventPayload: { permission: 'storage', reason: 'denied' },
    uiEventTrigger: 'state-evidence',
  };
  const invalidPermissionRecord = permissionRecords.find((record) => {
    const component = record.component;
    const key = `${record.routeId}/${record.pageState}/${component.id}`;
    const evidence = component.stateEventEvidence || [];
    return key !== expectedPermissionKey || component.compositionMode !== 'contract-tree' ||
      !sameStringSet(new Set(component.stateAuthorities || []), new Set(['contract'])) ||
      (component.children || []).length !== 0 || (component.bindings || []).length !== 0 ||
      JSON.stringify(canonicalValue(component.props || {})) !==
        JSON.stringify(canonicalValue(expectedPermissionProps)) ||
      evidence.length !== 1 || evidence[0].classification !== 'state-evidence' ||
      evidence[0].event !== component.props.uiEvent ||
      JSON.stringify(canonicalValue(evidence[0].payload || {})) !==
        JSON.stringify(canonicalValue(component.props.uiEventPayload || {}));
  });
  if (permissionRecords.length !== 1 || permissionStateEvidenceCount !== 1 ||
    invalidPermissionRecord !== undefined) {
    failures.push(`Permission exact denial leaf changed: permissions=${permissionRecords.length} evidence=${permissionStateEvidenceCount}`);
  }
  const viewStateTerminalRecords = new Map([
    ['Error', []],
    ['Permission', []],
  ]);
  const walkViewStateTerminalStates = (routeId, pageState, components) => {
    for (const component of components || []) {
      if (viewStateTerminalRecords.has(component.type)) {
        viewStateTerminalRecords.get(component.type).push({ routeId, pageState, component });
      }
      walkViewStateTerminalStates(routeId, pageState, component.children || []);
    }
  };
  for (const fixture of viewStateFixtures || []) {
    walkViewStateTerminalStates(fixture.routeId, fixture.pageState, fixture.components || []);
  }
  for (const [type, records] of terminalStateRecords) {
    const viewStateRecords = viewStateTerminalRecords.get(type);
    const viewStateByKey = new Map(viewStateRecords.map((record) => [
      `${record.routeId}/${record.pageState}/${record.component.id}`, record.component,
    ]));
    if (records.length !== 1 || viewStateRecords.length !== 1 || viewStateByKey.size !== 1) {
      failures.push(`${type} ViewState/ScreenGraph count changed`);
      continue;
    }
    const record = records[0];
    const key = `${record.routeId}/${record.pageState}/${record.component.id}`;
    const viewStateComponent = viewStateByKey.get(key);
    if (viewStateComponent === undefined || (viewStateComponent.children || []).length !== 0 ||
      (viewStateComponent.bindings || []).length !== 0 ||
      JSON.stringify(canonicalValue(record.component.props || {})) !==
        JSON.stringify(canonicalValue(viewStateComponent.props || {}))) {
      failures.push(`${type} ViewState/ScreenGraph data drift: ${key}`);
    }
  }
  if (!fs.existsSync(TERMINAL_STATE_ADAPTER)) {
    failures.push('missing strict ScreenGraph Error/Permission adapter');
  } else {
    const adapterSource = fs.readFileSync(TERMINAL_STATE_ADAPTER, 'utf8');
    if (!adapterSource.includes('static projectError(') ||
      !adapterSource.includes("component.type !== 'Error'") ||
      !adapterSource.includes("['message', 'retryable']") ||
      !adapterSource.includes("typeof component.props.retryable !== 'boolean'") ||
      !adapterSource.includes('static projectPermission(') ||
      !adapterSource.includes("component.type !== 'Permission'") ||
      !adapterSource.includes("component.props.uiEvent !== 'import.permission.denied'") ||
      !adapterSource.includes("component.props.uiEventTrigger !== 'state-evidence'") ||
      !adapterSource.includes("payload.permission === 'storage'") ||
      !adapterSource.includes("payload.reason === 'denied'") ||
      !adapterSource.includes('component.children.length !== 0') ||
      !adapterSource.includes('component.bindings.length !== 0') ||
      adapterSource.includes("from '../store/ReaderUiStore'") ||
      adapterSource.includes('ReaderUiStore.dispatch')) {
      failures.push('Error/Permission adapter must preserve separate exact schemas and remain Store-free');
    }
  }
  const canonicalErrorStart = rendererSource.indexOf('@Builder renderCanonicalError');
  const canonicalErrorEnd = rendererSource.indexOf('  @Builder renderCanonicalPermission', canonicalErrorStart);
  const canonicalErrorSource = canonicalErrorStart >= 0 && canonicalErrorEnd > canonicalErrorStart
    ? rendererSource.slice(canonicalErrorStart, canonicalErrorEnd)
    : '';
  const canonicalPermissionStart = rendererSource.indexOf('@Builder renderCanonicalPermission');
  const canonicalPermissionEnd = rendererSource.indexOf('  @Builder renderDebuggedComponent', canonicalPermissionStart);
  const canonicalPermissionSource = canonicalPermissionStart >= 0 && canonicalPermissionEnd > canonicalPermissionStart
    ? rendererSource.slice(canonicalPermissionStart, canonicalPermissionEnd)
    : '';
  const errorBranch = branchBodies.get('Error') || '';
  const permissionBranch = branchBodies.get('Permission') || '';
  if (!canonicalErrorSource.includes('Text(projection.message)') ||
    !canonicalErrorSource.includes('if (projection.retryable)') ||
    !canonicalErrorSource.includes("Text('可重试')") ||
    !canonicalErrorSource.includes('.enabled(false)') ||
    !canonicalErrorSource.includes('.hitTestBehavior(HitTestMode.None)') ||
    canonicalErrorSource.includes('.onClick(') ||
    canonicalErrorSource.includes('ReaderUiStore.dispatch') ||
    !errorBranch.includes('ReaderUIScreenGraphTerminalStateAdapter.projectError(component)') ||
    errorBranch.includes('ErrorState({') || genericSet.has('Error') || partialSet.has('Error')) {
    failures.push('Error faithful renderer must expose retryability as inert state without synthesizing retry');
  }
  if (!canonicalPermissionSource.includes('Text(projection.title)') ||
    !canonicalPermissionSource.includes('projection.message !== projection.title') ||
    !canonicalPermissionSource.includes('Text(projection.message)') ||
    canonicalPermissionSource.includes('.onClick(') ||
    canonicalPermissionSource.includes('ReaderUiStore.dispatch') ||
    !permissionBranch.includes('ReaderUIScreenGraphTerminalStateAdapter.projectPermission(component)') ||
    permissionBranch.includes('PermissionRequiredPage({') ||
    permissionBranch.includes('component.props.action') ||
    genericSet.has('Permission') || partialSet.has('Permission')) {
    failures.push('Permission faithful renderer must consume exact denial evidence as display-only state');
  }
  // Promote only exact contract-owned state leaves. Visual text is consumed by
  // the dedicated ArkUI primitive; uiEvent fields are state evidence, never an
  // inferred tap action. Any children/bindings/authority drift reopens audit.
  const expectedStatePrimitivePromotions = new Map([
    ['Loading', { count: 9, evidence: 3 }],
    ['ErrorState', { count: 5, evidence: 5 }],
    ['Offline', { count: 4, evidence: 2 }],
  ]);
  const allowedStatePrimitiveProps = new Set([
    'title', 'label', 'message', 'uiEvent', 'uiEventPayload', 'uiEventTrigger',
  ]);
  for (const [type, expected] of expectedStatePrimitivePromotions) {
    const instances = nodes.filter((node) => node.type === type);
    const evidenceCount = instances.reduce(
      (count, instance) => count + (instance.stateEventEvidence || []).length,
      0,
    );
    const invalid = instances.some((instance) => {
      if (instance.compositionMode !== 'contract-tree' ||
        !sameStringSet(new Set(instance.stateAuthorities || []), new Set(['contract'])) ||
        (instance.children || []).length !== 0 || (instance.bindings || []).length !== 0 ||
        Object.keys(instance.props || {}).some((key) => !allowedStatePrimitiveProps.has(key))) return true;
      if (instance.props.title !== undefined && typeof instance.props.title !== 'string') return true;
      if (instance.props.label !== undefined && typeof instance.props.label !== 'string') return true;
      if (instance.props.message !== undefined && typeof instance.props.message !== 'string') return true;
      const trigger = instance.props.uiEventTrigger;
      const evidence = instance.stateEventEvidence || [];
      if (trigger === undefined) return evidence.length !== 0 || instance.props.uiEvent !== undefined;
      if (trigger !== 'state-evidence' || typeof instance.props.uiEvent !== 'string' || evidence.length !== 1) return true;
      return evidence[0].classification !== 'state-evidence' || evidence[0].event !== instance.props.uiEvent ||
        JSON.stringify(canonicalValue(evidence[0].payload || {})) !==
          JSON.stringify(canonicalValue(instance.props.uiEventPayload || {}));
    });
    if (genericSet.has(type) || instances.length !== expected.count ||
      evidenceCount !== expected.evidence || invalid) {
      failures.push(`${type} faithful state primitive evidence changed; re-audit props, state evidence, or action ownership`);
    }
  }
  // ScreenGraph 1.2 makes composite ownership explicit. These four types are
  // native composites: their children are declarative anatomy/action metadata,
  // never a request for the generic renderer to instantiate a second tree.
  const expectedHostCompositeCatalog = new Map([
    ['ReaderBase', { count: 49, authorities: ['core', 'reader-ui-runtime', 'host-store', 'host-layout'] }],
    ['ReaderTopArea', { count: 48, authorities: ['core', 'reader-ui-runtime', 'host-store'] }],
    ['ReaderBottomBar', { count: 11, authorities: ['reader-ui-runtime', 'host-store'] }],
    ['TapZones', { count: 7, authorities: ['reader-ui-runtime', 'host-layout'] }],
  ]);
  const hostCompositeCatalog = (graph.componentCatalog || [])
    .filter((entry) => entry.status === 'referenced' && entry.compositionMode === 'host-composite');
  if (hostCompositeCatalog.length !== expectedHostCompositeCatalog.size) {
    failures.push(`host-composite catalog count changed: ${hostCompositeCatalog.length}`);
  }
  for (const [type, expected] of expectedHostCompositeCatalog) {
    const entry = hostCompositeCatalog.find((candidate) => candidate.type === type);
    if (entry === undefined || entry.instanceCount !== expected.count ||
      !sameStringSet(new Set(entry.stateAuthorities || []), new Set(expected.authorities))) {
      failures.push(`host-composite ownership drift: ${type}`);
    }
    const branch = branchBodies.get(type) || '';
    if (branch.length === 0 || branch.includes('this.renderChildren(') ||
      branch.includes('this.renderComponent(')) {
      failures.push(`host-composite renderer must not recursively render canonical children: ${type}`);
    }
  }
  const targetBindings = nodes.flatMap((node) => (node.bindings || []).filter((binding) =>
    typeof binding.target === 'string' && binding.target.length > 0));
  if (targetBindings.length !== bindingCount) {
    failures.push(`ScreenGraph 1.2 requires every action binding to have an explicit target: ${targetBindings.length}/${bindingCount}`);
  }
  // ReaderBase cannot be promoted merely by referencing canonical fields. Its
  // native composite owns live Core text, route-dependent control layers, and
  // pagination actions, while the current canonical fixtures only describe a
  // lossy visual subset. Pin the exact evidence gap so future contract growth
  // forces an explicit ownership review instead of silently clearing partial.
  const readerBaseInstances = nodes.filter((node) => node.type === 'ReaderBase');
  const readerBaseSignatures = new Map();
  for (const instance of readerBaseInstances) {
    const signature = (instance.children || []).map((child) => child.type).join('+');
    readerBaseSignatures.set(signature, (readerBaseSignatures.get(signature) || 0) + 1);
  }
  const expectedReaderBaseSignatures = new Map([
    ['', 26],
    ['Content+TapZones', 2],
    ['ReadingBackgroundLayer', 13],
    ['ReadingBackgroundLayer+ReadingTextFlow+ReadingInfoLayer', 3],
    ['ReadingBackgroundLayer+ReadingTextFlow+ReadingInfoLayer+TapZones', 5],
  ]);
  const readerBaseOwnBindings = readerBaseInstances.flatMap((instance) => instance.bindings || []);
  const readerBaseOwnStateEventEvidenceCount = readerBaseInstances.reduce(
    (count, instance) => count + (instance.stateEventEvidence || []).length,
    0,
  );
  const readerBasePropKeys = new Set(readerBaseInstances.flatMap((instance) => Object.keys(instance.props || {})));
  const readerBaseChildren = readerBaseInstances.flatMap((instance) => instance.children || []);
  const readerBaseTapZones = readerBaseChildren.filter((child) => child.type === 'TapZones');
  const tapZoneBindings = readerBaseTapZones.flatMap((child) => child.bindings || []);
  const tapZoneStateEvidenceCount = readerBaseTapZones.reduce(
    (count, child) => count + (child.stateEventEvidence || []).length,
    0,
  );
  const enabledTapZones = readerBaseTapZones.filter((child) => child.props?.enabled === true).length;
  const disabledTapZones = readerBaseTapZones.filter((child) => child.props?.enabled === false).length;
  const readerTextChildren = readerBaseChildren.filter((child) => child.type === 'ReadingTextFlow');
  const contentOwnershipFields = ['paragraphs', 'content', 'contentIdentity', 'bookId', 'chapterId', 'pageIndex', 'anchor'];
  const hasReaderTextOwnership = readerTextChildren.some((child) =>
    contentOwnershipFields.some((field) => Object.prototype.hasOwnProperty.call(child.props || {}, field)));
  const readerControlChildren = readerBaseChildren.filter((child) =>
    child.type === 'ControlDismissZone' || child.type === 'SessionCapsule' ||
    child.type === 'ReaderTopArea' || child.type === 'ReaderBottomBar');
  const validTapZoneBinding = (binding) => {
    if (binding.trigger !== 'tap') return false;
    const payloadKeys = Object.keys(binding.payload || {});
    if (binding.target === 'previous') {
      return binding.event === 'reader.page.prev' && payloadKeys.length === 0;
    }
    if (binding.target === 'next') {
      return binding.event === 'reader.page.next' && payloadKeys.length === 0;
    }
    return binding.target === 'control' && binding.event === 'reader.control.toggle' &&
      payloadKeys.length === 1 && payloadKeys[0] === 'overlay' &&
      binding.payload.overlay === 'reader-control';
  };
  const tapZoneTargetCounts = new Map();
  for (const binding of tapZoneBindings) {
    tapZoneTargetCounts.set(binding.target, (tapZoneTargetCounts.get(binding.target) || 0) + 1);
  }
  const expectedReaderBasePropKeys = new Set([
    'availability', 'coreSupport', 'documentKind', 'executionOwner', 'hostBasis', 'theme',
  ]);
  const validPlannedDocumentOpen = (instance) => {
    if ((instance.bindings || []).length === 0) return instance.props?.documentKind === undefined;
    if ((instance.bindings || []).length !== 1) return false;
    const binding = instance.bindings[0];
    const expected = instance.props?.documentKind === 'pdf'
      ? { event: 'pdf.open', documentId: 'local-pdf-001', positionKey: 'page', position: 12 }
      : instance.props?.documentKind === 'image-sequence'
        ? { event: 'manga.open', documentId: 'local-manga-001', positionKey: 'imageIndex', position: 6 }
        : undefined;
    if (expected === undefined) return false;
    const payloadKeys = Object.keys(binding.payload || {}).sort();
    return binding.target === 'document' && binding.trigger === 'appear' &&
      binding.evidenceProperty === 'explicitBinding' && binding.event === expected.event &&
      payloadKeys.length === 2 && payloadKeys[0] === 'documentId' &&
      payloadKeys[1] === expected.positionKey && binding.payload.documentId === expected.documentId &&
      binding.payload[expected.positionKey] === expected.position;
  };
  if (!partialSet.has('ReaderBase') || readerBaseInstances.length !== 49 ||
    !sameStringSet(new Set(readerBaseSignatures.keys()), new Set(expectedReaderBaseSignatures.keys())) ||
    [...expectedReaderBaseSignatures].some(([signature, count]) => readerBaseSignatures.get(signature) !== count) ||
    readerBaseOwnBindings.length !== 2 || readerBaseOwnStateEventEvidenceCount !== 0 ||
    readerBaseInstances.some((instance) => !validPlannedDocumentOpen(instance)) ||
    !sameStringSet(readerBasePropKeys, expectedReaderBasePropKeys) ||
    readerBaseInstances.some((instance) => instance.compositionMode !== 'host-composite' ||
      !sameStringSet(new Set(instance.stateAuthorities || []),
        new Set(['core', 'reader-ui-runtime', 'host-store', 'host-layout']))) ||
    readerBaseTapZones.length !== 7 || tapZoneBindings.length !== 16 || tapZoneStateEvidenceCount !== 0 ||
    tapZoneTargetCounts.get('previous') !== 5 || tapZoneTargetCounts.get('control') !== 6 ||
    tapZoneTargetCounts.get('next') !== 5 || tapZoneBindings.some((binding) => !validTapZoneBinding(binding)) ||
    readerBaseTapZones.some((child) => child.compositionMode !== 'host-composite' ||
      !sameStringSet(new Set(child.stateAuthorities || []), new Set(['reader-ui-runtime', 'host-layout']))) ||
    enabledTapZones !== 6 || disabledTapZones !== 1 ||
    hasReaderTextOwnership || readerControlChildren.length !== 0) {
    failures.push('ReaderBase canonical ownership evidence changed; re-audit host-composite theme/text/info, TapZones targets, and control-layer authority');
  }
  const derivedPartialSet = new Set();
  for (const type of referencedComponentTypes) {
    const instances = activeRuntimeNodes.filter((node) => node.type === type);
    if (instances.length === 0) continue;
    const hostComposite = instances.length > 0 &&
      instances.every((node) => node.compositionMode === 'host-composite');
    // ReaderBase deliberately remains visible partial: its canonical anatomy
    // and target bindings still do not carry live Core text/theme/layout state.
    if (type === 'ReaderBase') {
      derivedPartialSet.add(type);
      continue;
    }
    if (expectedStatePrimitivePromotions.has(type)) continue;
    // Dialog props/children are consumed through the exact projection checked
    // above; its remaining gap is interaction parity, tracked as generic.
    if (type === 'Dialog') continue;
    if (type === 'Content') continue;
    if (type === 'Empty') continue;
    if (type === 'Error') continue;
    if (type === 'Permission') continue;
    if (hostComposite) continue;
    if (liveStateProjectionSet.has(type)) {
      const branch = branchBodies.get(type) || '';
      if (!branch.includes(`${type}()`) || branch.includes('component.props') ||
        branch.includes('component.children')) {
        failures.push(`live-state projection must reject fixture props/children in direct branch: ${type}`);
      }
      continue;
    }
    const hasProps = instances.some((node) => Object.keys(node.props || {}).length > 0);
    const hasChildren = instances.some((node) => (node.children || []).length > 0);
    const branch = branchBodies.get(type) || '';
    const usesProps = branch.includes('component.props');
    const usesChildren = branch.includes('component.children');
    if ((hasProps && !usesProps) || (hasChildren && !usesChildren)) derivedPartialSet.add(type);
  }
  if (!sameStringSet(partialSet, derivedPartialSet)) {
    const missing = [...derivedPartialSet].filter((type) => !partialSet.has(type));
    const stale = [...partialSet].filter((type) => !derivedPartialSet.has(type));
    failures.push(`partial coverage drift missing=[${missing.join(',')}] stale=[${stale.join(',')}]`);
  }

  // The generated graph remains the complete contract ledger above. These
  // numbers are specifically the active ArkUI coverage ledger, so exact
  // retired route/component pairs must not inflate generic or faithful work.
  const activeRuntimeRecords = canonicalComponentRecords.filter((record) =>
    !retiredComponentKeys.has(componentRecordKey(record.routeId, record.component.id)));
  const activeRuntimeTypes = new Set(activeRuntimeRecords.map((record) => record.component.type));
  const activeInstanceCounts = new Map();
  for (const record of activeRuntimeRecords) {
    const type = record.component.type;
    activeInstanceCounts.set(type, (activeInstanceCounts.get(type) || 0) + 1);
  }
  const activeReferencedTypes = referencedComponentTypes.filter((type) => activeRuntimeTypes.has(type));
  const activeGenericSet = new Set([...genericSet].filter((type) => activeRuntimeTypes.has(type)));
  const activePartialSet = new Set([...partialSet].filter((type) => activeRuntimeTypes.has(type)));
  const insufficientSet = new Set(activeReferencedTypes.filter((type) => !declaredDispatchSet.has(type)));
  const faithfulSet = new Set(activeReferencedTypes.filter(
    (type) => declaredDispatchSet.has(type) && !genericSet.has(type) && !partialSet.has(type),
  ));
  const sumInstances = (types) => [...types].reduce(
    (sum, type) => sum + (activeInstanceCounts.get(type) || 0),
    0,
  );
  faithfulCoverageCount = faithfulSet.size;
  genericCoverageCount = activeGenericSet.size;
  partialCoverageCount = activePartialSet.size;
  insufficientCoverageCount = insufficientSet.size;
  faithfulInstanceCount = sumInstances(faithfulSet);
  genericInstanceCount = sumInstances(activeGenericSet);
  partialInstanceCount = sumInstances(activePartialSet);
  insufficientInstanceCount = sumInstances(insufficientSet);
  retiredRuntimeInstanceCount = canonicalComponentRecords.length - activeRuntimeRecords.length;
}

const actual = {
  routeCount: (graph.routes || []).length,
  variantCount,
  componentCount,
  bindingCount,
  stateEventEvidenceCount,
};
const declared = {
  routeCount: declaredRouteCount,
  variantCount: declaredVariantCount,
  componentCount: declaredComponentCount,
  bindingCount: declaredBindingCount,
  stateEventEvidenceCount: declaredStateEventEvidenceCount,
};
if (declaredCanonicalSha !== canonicalSha) failures.push('canonical screen-graph.json sha256 drift');
for (const key of Object.keys(actual)) {
  if (actual[key] !== declared[key]) failures.push(`${key} declared=${declared[key]} actual=${actual[key]}`);
}

if (failures.length > 0) {
  console.error(`[screen-graph-consumer] FAIL sourceSha256=${sourceSha} canonicalSha256=${canonicalSha}`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `[screen-graph-consumer] PASS authority=Shadow sourceSha256=${sourceSha} ` +
  `canonicalSha256=${canonicalSha} routes=${actual.routeCount} variants=${actual.variantCount} ` +
  `components=${actual.componentCount} bindings=${actual.bindingCount} ` +
  `stateEvidence=${actual.stateEventEvidenceCount} actionGaps=${actionGapCount} ` +
  `componentTypes=${referencedComponentTypes.length}+${explicitGapComponentTypes.length}gap ` +
  `rendererMappings=${rendererMappings.size} ` +
  `buttons=${buttonCount}/${boundButtonCount}bound/${gapButtonCount}gap/${wiredButtonCount}wired ` +
  `dialogs=${dialogCount}/${dialogChildButtonCount}buttons/${boundDialogChildButtonCount}bound/${gapDialogChildButtonCount}gap ` +
  `contents=${contentCount}/${contentStateEvidenceCount}evidence ` +
  `empties=${emptyCount}/${emptyStateEvidenceCount}evidence ` +
  `errors=${errorCount}/${errorStateEvidenceCount}evidence ` +
  `permissions=${permissionCount}/${permissionStateEvidenceCount}evidence ` +
  `coverage=${faithfulCoverageCount}faithful+${genericCoverageCount}generic+` +
  `${partialCoverageCount}partial+${insufficientCoverageCount}insufficient ` +
  `instances=${faithfulInstanceCount}faithful+${genericInstanceCount}generic+` +
  `${partialInstanceCount}partial+${insufficientInstanceCount}insufficient ` +
  `retiredRuntimeInstances=${retiredRuntimeInstanceCount}`
);
