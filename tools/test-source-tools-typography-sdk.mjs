import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { readerTypographyRoles } from './lib/reader-typography-probe.mjs';
import { readerAppColor } from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';

const source = readFileSync(new URL('../entry/src/main/ets/features/source/SourceToolsPage.ets', import.meta.url), 'utf8');
const baseline = JSON.parse(readFileSync(new URL('./fixtures/design/source-tools-typography-baseline.json', import.meta.url)));
const methods = [...source.matchAll(/@Builder\s+private\s+(\w+)\s*\(/g)].map(match => match[1]);
methods.push('batchCheckPercent', 'batchCheckPhaseLabel', 'batchResultLabel', 'confirmExportThen');
const properties = ['fontFamily', 'fontWeight', 'fontSize', 'lineHeight', 'letterSpacing'];
const result = { sourceName: '测试书源', sourceId: 'https://source.example', message: '能力检查完成', state: 'passed', traceId: 'trace' };
const bookSource = { name: '测试书源', sourceId: 'https://source.example', baseUrl: 'https://source.example', lastCheckSummary: '上次检测已完成' };
const fingerprint = node => JSON.stringify(Object.fromEntries(properties.filter(property => Object.hasOwn(node, property))
  .map(property => [property, node[property]])));
const allowed = new Set(baseline.nodes.map(node => fingerprint(node.tuple)));
const seen = new Set();
const make = (overrides = {}) => {
  const { owner } = createReaderBuilderProbe(source, methods, {
    // Virtual list painting is outside this typography probe. The actual row
    // Builders run separately below, with their real SDK observer closures.
    LazyForEach: { create() {}, pop() {} }, ...overrides,
  });
  const calls = [];
  Object.assign(owner, {
    appThemeScheme: 'day',
    snapshot: {
      busy: false, sources: [bookSource], selectedSourceIds: [bookSource.sourceId], selectedSourceCount: 1,
      statusMessage: '最近的操作已经完成', editorSourceId: bookSource.sourceId, editorText: '{}',
      editorReadback: { fact: 'confirmedRefreshFailed' }, checkMode: 'search', checkDepth: 2,
      debugSourceId: bookSource.sourceId, debugKey: '关键词', debugLogs: [],
      batchCheck: { phase: 'running', completed: 1, total: 2, currentSourceName: '测试书源', currentIndex: 2,
        passed: 1, failed: 0, errors: 0, results: [] },
    },
    sourceDataSource: {}, batchResultDataSource: {}, debugLogDataSource: {},
    onSelectAll: () => calls.push('selectAll'), onClearSelection: () => calls.push('clearSelection'),
    onStopCheck: () => calls.push('stopCheck'), onCheckSelected: () => calls.push('checkSelected'),
    onExportSelected: () => calls.push('exportSelected'), onExportAll: () => calls.push('exportAll'),
    onSetSelectedEnabled: () => calls.push('setEnabled'), onDeleteSelected: () => calls.push('deleteSelected'),
    onToggleSelection: () => calls.push('toggle'), onOpenEditor: () => calls.push('openEditor'),
    onDebugSource: () => calls.push('debugSource'), onEditorDraftChanged: value => calls.push(['editor', value]),
    onCancelEditor: () => calls.push('cancel'), onSaveEditor: () => calls.push('save'),
    onReconcileEditor: () => calls.push('reconcile'), onDebugKeyChanged: value => calls.push(['key', value]),
    onCheckSelectionChanged: (...values) => calls.push(['checkSelection', ...values]),
  });
  return { owner, calls };
};
const cases = [
  ['batchCard'], ['batchCheckCard'], ['batchCounter', '计数', '#status-color'],
  ['batchResultRow', result], ['statusCard'], ['exportCard'],
  ['sourceRow', { source: bookSource, selected: true, actionsEnabled: true }],
  ['editorCard'], ['debugCard'], ['debugLogRow', { state: 0, message: '请求完成' }, 0],
  ['heading', '工具标题'], ['smallButton', '小操作', true, () => {}],
  ['actionButton', '主操作', true, true, () => {}], ['fullWidthActionButton', '导出', true, () => {}],
];
for (const [name, ...args] of cases) {
  const { owner } = make();
  owner[name](...args);
  for (const node of owner.nodes.values()) if (Object.hasOwn(node, 'fontSize')) {
    const tuple = fingerprint(node);
    assert.ok(allowed.has(tuple), `${name}/${String(node.create)}: exact baseline tuple, including omitted AUTO modifiers`);
    seen.add(tuple);
  }
}
assert.deepEqual(seen, allowed, 'all 14 authored tuples have real SDK Builder evidence');

// The result branch and busy/phase colors use the same roles without replacing
// the actual callbacks, native input values or selected controls.
const { owner: progress } = make();
progress.snapshot.batchCheck.results = [result];
progress.batchCheckCard();
assert.ok([...progress.nodes.values()].some(node => node.create === '实时结果（最新在前）'));
for (const scheme of ['day', 'night', 'day']) {
  progress.appThemeScheme = scheme; progress.replay();
  const title = [...progress.nodes.values()].find(node => typeof node.create === 'string' && node.create.startsWith('检测进度'));
  assert.equal(title.fontColor, readerAppColor('TOK_INK', scheme));
}
const { owner: editor, calls: editorCalls } = make();
editor.editorCard(); editor.debugCard();
const code = [...editor.nodes.values()].find(node => node.type === 'TextArea');
const input = [...editor.nodes.values()].find(node => node.type === 'TextInput');
assert.equal(code.fontFamily, 'monospace'); assert.equal(code.height, 320);
assert.equal(input.height, 40);
code.onChange('{"edited":true}'); input.onChange('新的关键词');
assert.deepEqual(editorCalls.slice(-2), [['editor', '{"edited":true}'], ['key', '新的关键词']]);
const selects = [...editor.nodes.values()].filter(node => node.type === 'Select');
assert.equal(selects.length, 2);
assert.ok(selects.every(node => !Object.hasOwn(node, 'fontSize') && !Object.hasOwn(node, 'fontFamily')),
  'native Select typography remains at its current AUTO baseline');
selects[0].onSelect(1); selects[1].onSelect(2);
assert.deepEqual(editorCalls.slice(-2), [['checkSelection', 'explore', 2], ['checkSelection', 'search', 4]]);

const { owner: buttons } = make();
let accepted = 0;
buttons.actionButton('禁用', true, false, () => accepted++);
buttons.actionButton('允许', false, true, () => accepted++);
buttons.smallButton('禁用小操作', false, () => accepted++);
buttons.fullWidthActionButton('导出', true, () => accepted++);
const controls = [...buttons.nodes.values()].filter(node => typeof node.onClick === 'function');
controls.forEach(node => node.onClick());
assert.equal(accepted, 2, 'disabled action and small controls remain guarded');
buttons.snapshot.busy = true; buttons.replay();
controls.at(-1).onClick();
assert.equal(accepted, 2, 'busy full-width export callback remains guarded after observer replay');
for (const scheme of ['night', 'day']) {
  buttons.appThemeScheme = scheme; buttons.replay();
  assert.equal(controls[0].fontColor, readerAppColor('TOK_ON_PRIMARY', scheme));
  assert.equal(controls[1].fontColor, readerAppColor('TOK_PRIMARY_TEXT', scheme));
}

// One shared description role reaches export, editing and the active batch
// label. A bounded dependency override exercises propagation on real SDK nodes.
const { owner: propagated } = make({
  TYPE_SOURCE_TOOLS_DESCRIPTION: { ...readerTypographyRoles.TYPE_SOURCE_TOOLS_DESCRIPTION, fontSizeFp: 13 },
});
propagated.batchCheckCard(); propagated.exportCard(); propagated.editorCard();
const descriptionNodes = [...propagated.nodes.values()].filter(node => node.lineHeight === 17);
assert.equal(descriptionNodes.length, 3);
assert.ok(descriptionNodes.every(node => node.fontSize === 13), 'one role update propagates across three real consumers');
assert.ok([...propagated.nodes.values()].some(node => node.fontSize === 14), 'other heading variant remains unchanged');

console.log('PASS source-tools real SDK typography: 14 tuples, AUTO, state/theme replay, input and action callbacks, role propagation');
