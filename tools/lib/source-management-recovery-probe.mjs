import { actualReaderPostLayoutFrame } from './reader-post-layout-frame-probe.mjs';
import assert from 'node:assert/strict';
import { stripTypeScriptTypes } from 'node:module';
import { installedEtsCompiler } from './ets-compiler-runtime.mjs';
import { boundedSurfaceSdk } from './bounded-surface-sdk-probe.mjs';
import { readerRecoveryView } from '../../entry/src/main/ets/app/ReaderRecoveryProjection.ts';
import { actualSourceManagementGeometry } from './source-management-owner-probe.mjs';
import { createDefaultReaderWindowMetrics } from '../../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts';
import * as windowFacts from '../../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts';
import { readerTypographyRoles } from './reader-typography-probe.mjs';
import * as v9 from '../../entry/src/main/ets/features/source/presentation/SourceManagementV9.ts';
import * as sourceScroll from '../../entry/src/main/ets/features/source/presentation/SourceManagementScrollState.ts';
import * as surfaceResolvers from '../../entry/src/main/ets/ui/foundation/ReaderSurfaceResolvers.ts';
import { resolveSourceManagementLayout } from '../../entry/src/main/ets/features/source/presentation/SourceManagementLayout.ts';
import { readerSourceCategoryLabel } from '../../entry/src/main/ets/features/source/application/ReaderSourceCategory.ts';
import { foundationSpecs } from './reader-foundation-control-probe.mjs';
import { labeledIconSpecs } from './reader-labeled-icon-action-probe.mjs';
import { readerEditingSdk } from './reader-editing-sdk-probe.mjs';
import { READER_FEEDBACK_EXTENDED_MS } from '../../entry/src/main/ets/ui/feedback/ReaderTransientFeedback.ts';

// Only unrelated material/scroll rendering is outside this action proof.
// No Watch callback or member reachable from one may cross this seam.
const renderSeams = ['searchField', 'statsRow', 'filterArea', 'categoryFilter',
  'sourceRow'];
const roots = ['appThemeScheme', 'sources', 'operation', 'statusKind', 'statusMessage',
  'statusActionLabel', 'statusActionGeneration', 'mounted', 'appForeground',
  'temporaryBackIdentity', 'sourceList', 'pendingRecovery', 'statusAction'];

/** Compute the complete member/initializer/Watch dependency closure from the
 * current production struct instead of maintaining a list of fixture fields.
 * This is AST selection only, not a model of Source filtering or Watch logic. */
export function sourceManagementRecoveryClosure(source, parameterNames = [], additionalRoots = []) {
  const { ts, options } = installedEtsCompiler();
  const tree = ts.createSourceFile('SourceManagementRecoveryClosure.ets', source,
    ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  assert.equal(tree.parseDiagnostics.length, 0, 'production Source struct parses');
  const struct = tree.statements.find(node => node.name?.getText(tree) === 'SourceManagementPage');
  assert.ok(struct?.members, 'exact SourceManagementPage declaration');
  const members = new Map(struct.members.filter(node => node.name)
    .map(node => [node.name.getText(tree), node]));
  const dependencies = new Map();
  const watchers = new Map();
  for (const [name, member] of members) {
    const refs = new Set(), watch = new Set();
    const visit = node => {
      if (ts.isPropertyAccessExpression(node) && node.expression.kind === ts.SyntaxKind.ThisKeyword)
        refs.add(node.name.text);
      if (ts.isElementAccessExpression(node) && node.expression.kind === ts.SyntaxKind.ThisKeyword &&
        ts.isStringLiteral(node.argumentExpression)) refs.add(node.argumentExpression.text);
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'Watch') {
        const callback = node.arguments[0];
        assert.ok(callback && ts.isStringLiteral(callback), 'literal production Watch callback: ' + name);
        watch.add(callback.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(member);
    dependencies.set(name, refs);
    watchers.set(name, watch);
  }
  const close = (seeds, seams) => {
    const selected = new Set(), inherited = new Set(), pending = [...seeds];
    while (pending.length) {
      const name = pending.pop();
      if (selected.has(name) || seams.has(name)) continue;
      if (!members.has(name)) { inherited.add(name); continue; }
      selected.add(name);
      pending.push(...dependencies.get(name), ...watchers.get(name));
    }
    return { selected, inherited };
  };
  const seams = new Set(renderSeams.filter(name => !additionalRoots.includes(name)));
  const active = close([...roots, ...additionalRoots, ...parameterNames.filter(name => members.has(name))], seams);
  const watchRoots = new Set([...active.selected].flatMap(name => [...watchers.get(name)]));
  const watch = close(watchRoots, new Set());
  for (const name of watch.selected) {
    assert.ok(!seams.has(name), 'a real Watch dependency cannot be stubbed: ' + name);
    assert.ok(active.selected.has(name), 'complete real Watch dependency: ' + name);
  }
  const support = ['SourceListDataSource', 'SourceListLayoutFrame'].map(name => {
    const node = tree.statements.find(candidate => candidate.name?.getText(tree) === name);
    assert.ok(node, 'actual finite Source support class: ' + name);
    return node.getText(tree);
  }).join('\n');
  return { members: [...active.selected].sort(), watchRoots: [...watchRoots].sort(),
    watchMembers: [...watch.selected].sort(), inheritedPorts: [...active.inherited].sort(),
    renderSeams: [...seams], support };
}

/** Actual recovery producers and every participating Watch/initializer run.
 * Original SourceJourney/Index callbacks are passed unchanged. Only unrelated
 * header/row materialization/scroll geometry and platform frames are bounded. */
export function sourceManagementRecoveryProbe(source, params = {}, options = {}) {
  const sdk = options.sdk ?? boundedSurfaceSdk();
  const closure = sourceManagementRecoveryClosure(source, Object.keys(params));
  const metrics = createDefaultReaderWindowMetrics();
  metrics.windowRect.width = 366;
  metrics.windowRect.height = 844;
  const FramePort = class {};
  const support = new Function('FrameCallback',
    'ReaderPostLayoutFrame', stripTypeScriptTypes(closure.support) + ';return {SourceListDataSource,SourceListLayoutFrame};')(FramePort, actualReaderPostLayoutFrame());
  const owner = sdk.consumer(source, closure.members, {
    ...actualSourceManagementGeometry(metrics), ...windowFacts, ...readerTypographyRoles, ...sourceScroll, ...surfaceResolvers, ...v9,
    ...foundationSpecs(), ...labeledIconSpecs(), ...readerEditingSdk(), READER_FEEDBACK_EXTENDED_MS,
    resolveSourceManagementLayout, readerSourceCategoryLabel, readerRecoveryView, ...support,
    ReaderUIVerificationProbe: { enabled: () => false },
    hilog: { info() {}, warn() {}, error() {} },
    ViewStackProcessor: { StartGetAccessRecordingFor() {}, StopGetAccessRecording() {} },
    BarState: { Off: 'BarState.Off' },
    // DataSource.replace and Source filtering remain production methods.
    // Native row materialization itself is not part of a recovery-action proof.
    LazyForEach: { create() {}, pop() {} },
  }, params);
  const missing = name => () => { throw Error('Missing original Source callback: ' + name); };
  // As in the real component, initial properties arrive before mounted=true.
  // Their Watch callbacks still execute, including projection/data-source work.
  owner.mounted = false;
  Object.assign(owner, {
    appThemeScheme: options.scheme ?? 'day', appForeground: true,
    temporaryBackIdentity: 'source-recovery-producer',
    onReconcile: missing('onReconcile'), onRetryLoad: missing('onRetryLoad'),
    onStatusAction: missing('onStatusAction'), onContinueOriginal: missing('onContinueOriginal'),
    searchField() {}, statsRow() {}, filterArea() {}, categoryFilter() {}, sourceRow() {},
    viewportWidth: 366, viewportHeight: 844,
    ...params,
  });
  owner.sources = params.sources ?? [];
  owner.operation = params.operation ?? { action: 'load', sourceId: '' };
  owner.mounted = true;
  owner.refreshGeometry();
  owner.sourceList();
  // ArkUI emits native ListItem bodies as lazy deep-render callbacks. The
  // recorder stores them; execute those exact callbacks for the visible
  // permanent header/empty state, without synthesizing recovery children.
  const rendered = new Set();
  for (let pass = 0; pass < 32; pass++) {
    const pending = [...owner.nodes.values()].filter(node => node.type === 'ListItem')
      .flatMap(node => (Array.isArray(node.create) ? node.create : [node.create])
        .filter(value => typeof value === 'function' && !rendered.has(value))
        .map(callback => ({ callback, id: node.id })));
    if (pending.length === 0) break;
    assert.ok(pass < 31, 'finite actual ListItem deferred body closure');
    for (const { callback, id } of pending) {
      if (rendered.has(callback)) continue;
      rendered.add(callback);
      callback.call(owner, id, true);
    }
  }
  owner.pendingRecovery();
  return { owner, sdk, closure };
}

/** Return the real common component's native Button callback; no synthetic
 * retry callback or mock success stands in for the production producer. */
export function sourceRecoveryNativeAction(projection, label) {
  const { owner, sdk } = projection;
  const labels = label ? [label] : ['核对', '刷新列表', '重试'];
  const actions = sdk.walk(owner).filter(actor =>
    actor instanceof sdk.deps.ReaderRecoveryAction && labels.includes(actor.label));
  assert.equal(actions.length, 1, 'one actual Source recovery native action: ' + labels.join('/') + JSON.stringify({ sources: owner.sources?.length, recovery: owner.recovery(), statusKind: owner.statusKind, nodes: [...owner.nodes.values()].map(n=>n.type), keys:[...owner.keys], actors: sdk.walk(owner).map(actor => ({ type: actor.constructor.name, label: actor.label })) }));
  const actor = actions[0];
  const native = sdk.nodes(actor).find(node => typeof node.onClick === 'function');
  assert.ok(native, 'actual ReaderRecoveryAction native Button callback');
  assert.equal(native.enabled, true, 'actual common recovery native enabled admission');
  return { actor, native, onClick: native.onClick };
}
