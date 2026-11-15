import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const args = process.argv.slice(2);
const evidenceArgs = args.filter(arg => arg.startsWith('--evidence-path='));
assert.ok(evidenceArgs.length <= 1);
const evidencePath = evidenceArgs[0]?.slice('--evidence-path='.length);
if (evidencePath) assert.ok(evidencePath.startsWith('.reader-artifacts/') && !evidencePath.includes('..'));
const selected = selectContractCases({
  batch: 'Retained actual SDK batch controls, current selection proof, busy/unknown/stopping/opening guards and keyed-remount negative. Native alert is a finite adapter seam.',
  rows: 'Retained actual SDK source row controls, current catalog/selection bindings, entity and opening retirement, stale snapshot rejection and stale binding negatives.',
}, { argv: args.filter(arg => !arg.startsWith('--evidence-path=')) });

if (selected.length) {
  const { foundationControls, withReaderSectionHeading } = await import('./lib/reader-foundation-control-probe.mjs');
  const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
  const { boundedMembers } = await import('./lib/bounded-surface-sdk-probe.mjs');
  const { selectedProductionClasses } = await import('./lib/selected-production-methods.mjs');
  const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
  const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
  const { ReaderTransientFeedback } = await import('../entry/src/main/ets/ui/feedback/ReaderTransientFeedback.ts');
  const { readerTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
  const { readerAppColor } = await import('../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts');
  const { resolveSourceToolsRowLayout } = await import('../entry/src/main/ets/features/source/presentation/SourceToolsLayout.ts');
  const root = new URL('../', import.meta.url);
  const path = 'entry/src/main/ets/features/source/ui/SourceToolsPage.ets';
  const read = name => readFileSync(new URL(name, root), 'utf8');
  const original = read(path);
  const classes = selectedProductionClasses(new URL(path, root), ['SourceToolListRow', 'SourceToolListDataSource',
    'SourceCheckResultDataSource', 'SourceDebugLogDataSource']);
  const orchestratorPath = 'entry/src/main/ets/features/source/application/SourceToolsOrchestrator.ets';
  const state = pureModuleProbe(read(orchestratorPath), 'SourceToolsOrchestrator.ets', {},
    ['EMPTY_SOURCE_TOOLS_SNAPSHOT', 'sourceEditorReadbackPending']);
  const { ts, options } = installedEtsCompiler();
  const sources = ['a', 'b'].map(id => ({ sourceId: `https://${id}.test`, name: `书源${id}`,
    baseUrl: `https://${id}.test`, lastCheckSummary: '上次检测', enabled: true }));
  const snapshot = (patch = {}) => ({ ...state.EMPTY_SOURCE_TOOLS_SNAPSHOT, sources,
    sourceListRevision: 1, selectionRevision: 1, selectedSourceIds: [sources[0].sourceId], selectedSourceCount: 1, ...patch });

  function definition(kind, source) {
    const tree = ts.createSourceFile('SourceToolsPage.ets', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
    assert.deepEqual(tree.parseDiagnostics, []);
    const page = tree.statements.find(node => node.name?.getText(tree) === 'SourceToolsPage');
    const build = page.members.find(node => node.name?.getText(tree) === 'build');
    const content = page.members.find(node => node.name?.getText(tree) === 'pageContent');
    const batch = content.body.statements.filter(node => node.getText(tree).includes('this.batchCard('));
    assert.equal(batch.length, 1, 'one actual production batch mount statement');
    const body = kind === 'batch' ? batch[0].getText(tree) : 'this.sourceRow(this.sourceDataSource.getData(0));';
    return source.slice(0, build.body.getStart(tree)) + `{ ${body} }` + source.slice(build.body.end);
  }

  function fixture(kind, initial = snapshot(), source = original) {
    const metrics = { systemFontScale: 1, densityPixels: 1 };
    const controls = withReaderSectionHeading(foundationControls({ windowMetrics: () => metrics }));
    const alerts = [];
    // The unchanged platform alert adapter owns actual presentation and native
    // retirement. This finite seam records the page's exact options/predicate.
    class AlertPort {
      present(_show, variant, options, current) { alerts.push({ variant, options, current }); }
      retire() {}
    }
    const fragment = definition(kind, source);
    const builders = new Set(['batchCard', 'batchButton', 'sourceRow', 'sourceRowInfo', 'sourceRowButtons', 'sourceRowButton']);
    const excluded = new Set([...fragment.matchAll(/@Builder\s+private\s+(\w+)\s*\(/g)]
      .map(match => match[1]).filter(name => !builders.has(name)));
    const members = boundedMembers(fragment).filter(name => !excluded.has(name));
    const probe = createReaderBuilderProbe(fragment, members, {
      ...controls.dependencies, ...classes, ...state, ...readerTypographyRoles, ReaderTransientFeedback,
      ReaderNativeAlertOwner: AlertPort, readerAppColor, resolveSourceToolsRowLayout,
      ReaderWindowCoordinator: { metrics: () => metrics }, AppStorage: { get: () => true },
      uiContext: { getFont: () => ({}), px2vp: value => value,
        getMeasureUtils: () => ({ measureText: input => input.textContent.length * 12 }) },
      LengthMetrics: { vp: value => value }, FlexWrap: { Wrap: 'wrap' },
      FlexDirection: { Row: 'row', Column: 'column' }, HorizontalAlign: { Start: 'start' },
      TextOverflow: { Ellipsis: 'ellipsis' },
    }, { ...controls.hooks, lifecycleChildren: true, initialParams: { snapshot: initial } });
    const owner = probe.owner, calls = [];
    let inputAllowed = true;
    Object.assign(owner, { mounted: true, temporaryBackIdentity: 'tools-current', sourceListWidth: 282,
      isInputAllowed: () => inputAllowed,
      onSelectAll: () => calls.push(['all']), onClearSelection: () => calls.push(['clear']),
      onStopCheck: () => calls.push(['stop']), onCheckSelected: value => calls.push(['check', value]),
      onExportSelected: value => calls.push(['export', value]),
      onSetSelectedEnabled: (value, enabled) => calls.push(['enabled', value, enabled]),
      onDeleteSelected: value => calls.push(['delete', value]),
      onToggleSelection: id => calls.push(['toggle', id]), onOpenEditor: id => calls.push(['edit', id]),
      onDebugSource: id => calls.push(['debug', id]) });
    owner.syncListDataSources();
    owner.initialRender();
    const walk = actor => [actor, ...[...actor.children.values()].flatMap(walk)];
    const buttons = () => walk(owner).filter(actor => actor instanceof controls.dependencies.ReaderButton);
    const nodes = () => walk(owner).flatMap(actor => [...actor.nodes.values()]);
    const native = button => {
      const matches = [...button.nodes.values()].filter(node => node.type === 'Button' && typeof node.onClick === 'function');
      assert.equal(matches.length, 1);
      return matches[0];
    };
    const publish = patch => {
      owner.updateStateVars({ snapshot: { ...owner.snapshot, ...patch } });
      controls.properties.flush();
    };
    return { owner, calls, alerts, buttons, nodes, native, publish, output: probe.output,
      inputAllowed(value) { inputAllowed = value; } };
  }

  const results = {};
  function batchScenario(source = original) {
    const f = fixture('batch', snapshot(), source), initial = f.buttons(), all = initial[0];
    assert.equal(initial.length, 7);
    const carriers = initial.map(f.native);
    const ensureRetained = () => {
      assert.deepEqual(f.buttons(), initial, 'selection keeps the same actual batch child actors');
      assert.deepEqual(initial.map(f.native), carriers);
    };
    f.native(all).onClick();
    assert.deepEqual(f.calls, [['all']]);
    f.publish({ selectedSourceIds: sources.map(source => source.sourceId), selectedSourceCount: 2, selectionRevision: 2 });
    ensureRetained();
    assert.ok(f.nodes().some(node => node.type === 'Text' && node.create === '批量管理（已选 2/2）'));
    const enable = initial.find(button => button.label === '启用');
    f.native(enable).onClick();
    assert.deepEqual(f.calls.at(-1), ['enabled', { sourceIds: sources.map(source => source.sourceId), sourceListRevision: 1, selectionRevision: 2 }, true]);
    const frozen = f.owner.batchSelectionAction(f.owner.batchControlsRenderKey(), value => f.calls.push(['frozen', value]));
    f.publish({ selectedSourceIds: [], selectedSourceCount: 0, selectionRevision: 3 });
    ensureRetained();
    assert.equal(f.native(enable).enabled, false);
    assert.equal(f.native(all).enabled, true);
    const count = f.calls.length;
    f.native(enable).onClick(); frozen();
    assert.equal(f.calls.length, count, 'disabled native and old exact selection proof reject');
    return { f, initial, ensureRetained };
  }

  if (selected.includes('batch')) {
    const { f, initial, ensureRetained } = batchScenario();
    f.publish({ selectedSourceIds: [sources[1].sourceId], selectedSourceCount: 1, selectionRevision: 4 });
    const enable = initial.find(button => button.label === '启用');
    for (const patch of [{ busy: true }, { busy: false, original: { blocked: true } },
      { original: undefined, receipt: { facts: { generation: 1 }, receipt: { confirmation: 'unknown' } } },
      { receipt: undefined, editorReadback: { confirmation: 'unknown' } },
      { editorReadback: { fact: 'confirmedRefreshFailed' } }]) {
      f.publish(patch); ensureRetained();
      const count = f.calls.length;
      assert.equal(f.native(enable).enabled, false);
      f.native(enable).onClick(); assert.equal(f.calls.length, count);
    }
    f.publish({ editorReadback: undefined });
    const exportButton = initial.find(button => button.label === '导出所选');
    f.native(exportButton).onClick();
    const alert = f.alerts.at(-1);
    assert.equal(alert.variant, 'confirmation-cancelable');
    assert.equal(alert.current(), true);
    alert.options.primaryButton.action();
    assert.deepEqual(f.calls.at(-1), ['export', { sourceIds: [sources[1].sourceId], sourceListRevision: 1, selectionRevision: 4 }]);
    f.publish({ selectionRevision: 5 });
    assert.equal(alert.current(), false, 'unchanged alert adapter receives current source/selection admission');
    f.inputAllowed(false);
    const count = f.calls.length;
    f.native(initial[0]).onClick(); assert.equal(f.calls.length, count);
    f.inputAllowed(true);
    f.owner.temporaryBackIdentity = 'replacement';
    f.native(initial[0]).onClick(); assert.equal(f.calls.length, count, 'old physical handler rejects another opening');
    const running = fixture('batch', snapshot({ busy: true,
      batchCheck: { ...state.EMPTY_SOURCE_TOOLS_SNAPSHOT.batchCheck, phase: 'running' } }));
    const stop = running.buttons().find(button => button.label === '停止检测');
    assert.ok(stop); assert.equal(running.native(stop).enabled, true);
    running.native(stop).onClick(); assert.deepEqual(running.calls, [['stop']]);
    running.publish({ batchCheck: { ...running.owner.snapshot.batchCheck, phase: 'stopping' } });
    assert.equal(stop.label, '停止中…'); assert.equal(running.native(stop).enabled, false);
    running.native(stop).onClick(); assert.deepEqual(running.calls, [['stop']]);
    // Restore only the historical selection-keyed parent around this current
    // subtree. The same assertion rejects its additional actual child actors.
    const keyed = original.replace('    this.batchCard();',
      '    ForEach([this.batchControlsRenderKey()], (_key: string) => { this.batchCard(); }, (key: string): string => key);');
    assert.notEqual(keyed, original);
    assert.throws(() => batchScenario(keyed), /same actual batch child actors/);
    results.batch = { retainedButtons: 7, selectionCounts: [1, 2, 0, 1], busyAndWriteGuards: 5,
      exactCurrentSelection: true, oldProofRejected: true, stoppingRetained: true, keyedParentNegativeRejected: true };
    recordContractCasePass('batch');
  }

  function rowScenario(source = original) {
    const f = fixture('rows', snapshot(), source), initial = f.buttons(), select = initial[0];
    const row = f.owner.sourceDataSource.getData(0), key = f.owner.sourceRowKey(row);
    const oldProof = f.owner.sourceRowAction(row, 'select');
    assert.equal(initial.length, 3); assert.equal(select.label, '已选');
    f.native(select).onClick();
    assert.deepEqual(f.calls, [['toggle', sources[0].sourceId]]);
    f.publish({ selectedSourceIds: [], selectedSourceCount: 0, selectionRevision: 2 });
    assert.deepEqual(f.buttons(), initial);
    assert.equal(f.owner.sourceRowKey(f.owner.sourceDataSource.getData(0)), key, 'same source keeps its native row key');
    assert.equal(select.label, '选择', 'retained select label reads current selection');
    const count = f.calls.length;
    oldProof(); assert.equal(f.calls.length, count);
    f.native(select).onClick(); assert.equal(f.calls.length, count + 1);
    f.publish({ selectedSourceIds: [sources[0].sourceId], selectedSourceCount: 1, selectionRevision: 3 });
    assert.equal(select.label, '已选');
    f.publish({ sourceListRevision: 2, sources: [{ ...sources[0], name: '更新的书源a', lastCheckSummary: '本次检测' }, sources[1]] });
    assert.ok(f.nodes().some(node => node.type === 'Text' && node.create === '更新的书源a'), 'retained actual Text reads current DTO');
    assert.equal(f.owner.sourceRowKey(f.owner.sourceDataSource.getData(0)), key);
    assert.ok(f.nodes().some(node => node.type === 'Text' && node.create === '本次检测'));
    assert.deepEqual(f.buttons(), initial);
    return { f, initial, row };
  }

  if (selected.includes('rows')) {
    const { f, initial, row } = rowScenario();
    const old = f.owner.sourceRowAction(row, 'debug');
    const count = f.calls.length;
    old(); assert.equal(f.calls.length, count, 'old catalog revision rejects');
    f.native(initial[2]).onClick(); assert.deepEqual(f.calls.at(-1), ['debug', sources[0].sourceId]);
    f.publish({ busy: true });
    assert.ok(initial.every(button => f.native(button).enabled === false));
    const busyCount = f.calls.length;
    initial.forEach(button => f.native(button).onClick()); assert.equal(f.calls.length, busyCount);
    f.publish({ busy: false, sourceListRevision: 3, sources: [sources[1]] });
    assert.ok(initial.every(button => f.native(button).enabled === false));
    initial.forEach(button => f.native(button).onClick()); assert.equal(f.calls.length, busyCount);
    // The SDK recorder does not remove native branches. Explicitly execute
    // the actual child lifecycle before testing a delayed removed handler.
    initial.forEach(button => button.aboutToDisappear());
    f.publish({ sourceListRevision: 4, sources });
    initial.forEach(button => f.native(button).onClick()); assert.equal(f.calls.length, busyCount);
    const opening = fixture('rows');
    opening.owner.temporaryBackIdentity = 'replacement';
    opening.buttons().forEach(button => opening.native(button).onClick());
    assert.deepEqual(opening.calls, []);
    const staleLabel = original.replace("if (action === 'select') return this.snapshot.selectedSourceIds.includes(row.source.sourceId) ? '已选' : '选择';",
      "if (action === 'select') return row.selected ? '已选' : '选择';");
    assert.notEqual(staleLabel, original);
    assert.throws(() => rowScenario(staleLabel), /retained select label/);
    const keyed = original.replace('return row.source.sourceId;',
      'return `${row.source.sourceId}:${row.sourceListRevision}:${row.selected}:${row.actionsEnabled}`;');
    assert.notEqual(keyed, original);
    assert.throws(() => rowScenario(keyed), /same source keeps its native row key/);
    results.rows = { retainedButtons: 3, acceptedToggles: 2, currentCatalogText: true,
      busyAndRemovedRejected: true, retiredChildRejected: true, staleProofRejected: true,
      staleLabelNegativeRejected: true, keyedRowNegativeRejected: true };
    recordContractCasePass('rows');
  }

  const inputs = [path, orchestratorPath, 'entry/src/main/ets/ui/controls/ReaderButton.ets',
    'entry/src/main/ets/ui/controls/ReaderControlSpecs.ets', 'tools/test-source-tools-selection.mjs',
    'tools/lib/reader-control-builder-probe.mjs', 'tools/lib/reader-foundation-control-probe.mjs',
    'tools/lib/arkui-property-runtime-probe.mjs', 'tools/lib/selected-production-methods.mjs'];
  const report = { status: 'PASS', cases: selected, results,
    inputs: inputs.map(path => ({ path, sha256: createHash('sha256').update(read(path)).digest('hex') })),
    boundary: 'Actual SDK lowering and V1 property dependency delivery, actual shared children/native attributes/actions and ordinary page proof methods. Native scheduling, branch removal and focus require VM evidence. Alert presentation is an unchanged adapter seam.' };
  if (evidencePath) writeFileSync(new URL(evidencePath, root), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
}
