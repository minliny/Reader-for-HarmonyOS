// Explicit production-method and installed-SDK Builder checks only.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const definitions = {
  'status-labels': { description: 'Actual summary label omits active search text and retains stopped, failed, partial and completed terminal states', resources: [] },
  'task-summary': { description: 'Actual task facts distinguish this-query failures from skipped sources, retain the accepted header and offer one terminal retry', resources: [] },
  'retry-owner': { description: 'Actual task retry callback admits skipped-only terminal work and rejects retired page/query/operation or absent permission', resources: [] },
  'summary-builder': { description: 'Actual SDK parent constructs one task-panel projection with shared message action role and separate filter lane; the native Sheet is not executed', resources: [] },
};
const pageFile = new URL('../entry/src/main/ets/features/search/SearchPage.ets', import.meta.url);
const methods = ['searchStopped', 'searchStatusLabel', 'searchProgressText', 'hasSearchNotice',
  'hasDisplayedSearchNotice', 'captureSearchNoticeFacts', 'displayedSearchNoticeFacts', 'acceptResultNoticeFacts',
  'hasAnySearchNotice', 'searchNoticeText', 'searchNoticeActionEnabled', 'searchNoticeRetryKind',
  'searchNoticeOffersRetry', 'hasSearchNoticeRetry', 'searchProgressRetryHandler', 'searchNoticeActionKey',
  'partialSearchFailure'];

function configure(page, { searching = false, failed = 2, skipped = 3, partial = false, canRetry = true } = {}) {
  const state = { searching, operation: { generation: 12, canRetry }, retries: 0, anchors: [] };
  Object.assign(page, { pageMounted: true, pageEpoch: 4, viewState: { revision: 8 },
    presentation: { kind: 'results', keyword: '真实书名', totalSourceCount: 10, completedSourceCount: 6,
      failedSourceCount: failed, skippedSourceCount: skipped, localSearchFailed: partial,
      localFailureMessage: partial ? '读取未完成，请重试' : undefined },
    operation: () => state.operation, isSweeping: () => state.searching,
    onCardDisplayFactsChange: () => state.anchors.push(page.resultNoticeFacts.progressText),
    retryOperation: () => { state.retries++; } });
  return state;
}

const selectedCases = selectContractCases(definitions);
if (selectedCases.length) {
const resolution = registerHooks({ resolve(specifier, context, next) {
  try { return next(specifier, context); }
  catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier))
      return next(specifier + '.ts', context);
    throw error;
  }
} });
try {
for (const selected of selectedCases) {
  const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
  const Page = selectedProductionMethods(pageFile, 'SearchPage', methods);
  if (selected === 'status-labels') {
    const page = new Page(), state = configure(page, { searching: true });
    assert.equal(page.searchStatusLabel(), '', 'live progress and Stop are the active search indication');
    state.searching = false; assert.equal(page.searchStatusLabel(), '部分失败');
    page.presentation.failedSourceCount = 0; assert.equal(page.searchStatusLabel(), '搜索完成');
    page.presentation.stopped = true; assert.equal(page.searchStatusLabel(), '已停止');
    page.presentation = { kind: 'error' }; assert.equal(page.searchStatusLabel(), '搜索失败');
  } else if (selected === 'task-summary') {
    const page = new Page(), state = configure(page, { searching: true });
    assert.equal(page.searchNoticeText('failed'), '2 个书源本次搜索失败。');
    assert.equal(page.searchNoticeText('skipped'), '已跳过 3 个暂不可用的书源。');
    assert.equal(page.hasSearchNoticeRetry(), false, 'active work does not mount a disabled retry slot');
    page.acceptResultNoticeFacts(); state.searching = false; page.presentation.completedSourceCount = 10;
    assert.equal(page.displayedSearchNoticeFacts().progressText, '已处理 6/10 个书源');
    assert.equal(page.hasSearchNoticeRetry(), false, 'interaction-retained active facts do not gain a terminal action');
    page.acceptResultNoticeFacts();
    assert.deepEqual(state.anchors, ['已处理 6/10 个书源'], 'capture previous header geometry before replacing admitted facts');
    assert.equal(page.searchNoticeRetryKind(), 'failed');
    assert.equal(page.searchNoticeOffersRetry('failed'), true); assert.equal(page.searchNoticeOffersRetry('skipped'), false);
    page.presentation.localSearchFailed = true; page.presentation.localFailureMessage = '读取未完成，请重试';
    page.acceptResultNoticeFacts();
    assert.equal(page.searchNoticeRetryKind(), 'partial'); assert.equal(page.searchNoticeOffersRetry('failed'), false);
    const skippedOnly = new Page(), skippedState = configure(skippedOnly, { failed: 0, skipped: 5 });
    assert.equal(skippedOnly.searchNoticeRetryKind(), 'skipped'); assert.equal(skippedOnly.hasSearchNoticeRetry(), true);
    assert.equal(skippedOnly.displayedSearchNoticeFacts().failed, 0, 'health omissions are never added to this-query failure count');
    skippedState.operation.canRetry = false; assert.equal(skippedOnly.hasSearchNoticeRetry(), false);
    skippedState.operation = undefined; assert.equal(skippedOnly.hasSearchNoticeRetry(), false, 'missing operation is not retry permission');
    const clean = new Page(); configure(clean, { failed: 0, skipped: 0 });
    assert.equal(clean.hasAnySearchNotice(), false); assert.equal(clean.hasSearchNoticeRetry(), false);
  } else if (selected === 'retry-owner') {
    const page = new Page(), state = configure(page, { failed: 0, skipped: 5 });
    const admitted = page.searchProgressRetryHandler('skipped'); admitted(); assert.equal(state.retries, 1);
    state.searching = true; admitted(); assert.equal(state.retries, 1);
    state.searching = false; state.operation.canRetry = false; admitted(); assert.equal(state.retries, 1);
    state.operation.canRetry = true; page.pageEpoch++; admitted(); assert.equal(state.retries, 1);
    const oldQuery = page.searchProgressRetryHandler('skipped'); page.viewState.revision++; oldQuery(); assert.equal(state.retries, 1);
    const oldOperation = page.searchProgressRetryHandler('skipped'); state.operation.generation++; oldOperation(); assert.equal(state.retries, 1);
    const retired = page.searchProgressRetryHandler('skipped'); page.pageMounted = false; retired(); assert.equal(state.retries, 1);
    page.pageMounted = true; page.presentation.skippedSourceCount = 0;
    page.searchProgressRetryHandler('skipped')(); assert.equal(state.retries, 1, 'removed task facts cannot dispatch work');
  } else if (selected === 'summary-builder') {
    const { createReaderComponentProbe: createReaderBuilderProbe } = await import('./lib/reader-component-probe.mjs');
    const { foundationSpecs } = await import('./lib/reader-foundation-control-probe.mjs');
    const { readerMessageStyles, readerTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
    const { selectedProductionClasses } = await import('./lib/selected-production-methods.mjs');
    const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
    const { readerAppColor } = await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
    const source = readFileSync(pageFile, 'utf8');
    const { ReaderTextStyle } = selectedProductionClasses(new URL('../entry/src/main/ets/features/common/ReaderTypography.ets', import.meta.url), ['ReaderTextStyle']);
    const specs = foundationSpecs({ ...readerTypographyRoles, ReaderTextStyle });
    const spec = specs.resolveReaderButtonSpec('search-retry-progress');
    assert.deepEqual(spec.text, readerMessageStyles.MESSAGE_ACTION, 'retry uses the shared static message action role');
    // Execute the actual child label modifier independently of the native
    // custom-component port; no copied typography tuple supplies the answer.
    const { ReaderButtonLabelModifier } = selectedProductionClasses(new URL('../entry/src/main/ets/features/common/ReaderButton.ets', import.meta.url),
      ['ReaderButtonLabelModifier'], { ...specs, readerAppColor, TextAlign: { Center: 'center' } });
    const attributes = {};
    new ReaderButtonLabelModifier('search-retry-progress', false, 'day', 1).applyNormalAttribute(
      new Proxy({}, { get: (_target, name) => value => { attributes[name] = value; } }));
    assert.equal(attributes.fontFamily, readerMessageStyles.MESSAGE_ACTION.fontFamily);
    assert.equal(attributes.fontSize, readerMessageStyles.MESSAGE_ACTION.fontSizeFp);
    const { SEARCH_RESULT_GEOMETRY } = await import('../entry/src/main/ets/features/search/SearchResultGeometry.ts');
    class TaskPanelPort { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
    function renderSummary(definition, setup) {
      const properties = createArkUIPropertyRuntimeProbe();
      const fixture = createReaderBuilderProbe(definition, [...methods, 'searchProgressDetails', 'taskStatusIdentity'],
        { ...properties.sdk, ...readerMessageStyles, SEARCH_RESULT_GEOMETRY, ReaderSearchTaskPanel: TaskPanelPort },
        { ...properties.hooks, childSources: {
          ReaderSearchTaskPanel: readFileSync(new URL('../entry/src/main/ets/features/search/ReaderSearchTaskPanel.ets', import.meta.url), 'utf8'),
        } });
      const page = fixture.owner; configure(page, setup);
      Object.assign(page, { appThemeScheme: 'day', searchFontScale: () => 1, searchResultWidth: () => 326,
        taskStatusExpanded: false, taskStatusGeneration: 1 });
      page.searchProgressDetails();
      const nodes = [...page.nodes.values()], task = [...page.children.values()].find(child => child instanceof TaskPanelPort);
      assert.ok(task, 'the actual parent constructs one registered task component; leaf Sheet behavior is outside this port');
      assert.equal(task.params.progressText, '已处理 6/10 个书源');
      assert.equal(task.params.failed, setup.failed ?? 2); assert.equal(task.params.skipped, setup.skipped ?? 3);
      assert.equal(task.params.searching, setup.searching);
      assert.equal(task.params.canRetry, !setup.searching, 'active work forwards no retry permission');
      assert.equal(task.params.statusLabel, setup.searching ? '' : (setup.failed === 0 ? '搜索完成' : '部分失败'));
      assert.ok(task.params.triggerWidth > 0 && task.params.triggerWidth + SEARCH_RESULT_GEOMETRY.filterActionSize + 8 <= 326,
        'task trigger leaves the filter lane and its clearance');
      assert.equal(task.params.failedText, `${setup.failed ?? 2} 个书源本次搜索失败。`);
      assert.equal(task.params.skippedText, `已跳过 ${setup.skipped ?? 3} 个暂不可用的书源。`);
      assert.ok(!nodes.some(node => node.type === 'Scroll' || node.type === 'List' || node.type === 'Text'),
        'the parent does not duplicate failure text or retry rows outside the task component');
    }
    for (const setup of [{ searching: true }, { searching: false }, { searching: false, failed: 0, skipped: 4 }])
      renderSummary(source, setup);
    const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
    const { ts, options } = installedEtsCompiler();
    const tree = ts.createSourceFile('SearchTaskProjection.ets', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
    assert.deepEqual(tree.parseDiagnostics, []);
    const owner = tree.statements.find(node => node.name?.text === 'SearchPage');
    const member = owner.members.find(node => node.name?.text === 'searchProgressDetails'), widths = [];
    const visit = node => { if (ts.isPropertyAssignment(node) && node.name.getText(tree) === 'triggerWidth') widths.push(node.initializer); ts.forEachChild(node, visit); };
    visit(member); assert.equal(widths.length, 1);
    const width = widths[0];
    const equivalent = source.slice(0, width.getStart(tree)) + '(' + width.getText(tree) + ')' + source.slice(width.end);
    renderSummary(equivalent, { searching: false });
    const overlap = source.slice(0, width.getStart(tree)) + 'this.searchResultWidth()' + source.slice(width.end);
    assert.throws(() => renderSummary(overlap, { searching: false }), /task trigger leaves the filter lane/, 'lost parent reservation fails actual SDK output');

  }
  recordContractCasePass(selected);
}

} finally { resolution.deregister(); }
}
