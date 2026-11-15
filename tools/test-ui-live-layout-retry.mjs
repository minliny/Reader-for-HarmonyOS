import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const args = process.argv.slice(2);
const output = args.find(arg => arg.startsWith('--evidence-path='))?.slice('--evidence-path='.length);
if (output) assert.ok(output.startsWith('.reader-artifacts/') && !output.includes('..'));
const selected = selectContractCases({
  'directory-tab-renewal': 'Actual retained Full directory Tabs keep accepting current transitions after openList renews the generation.',
  'filter-geometry': 'Actual Search filter body consumes current same-branch geometry in inline/stacked and bounded-scroll layouts.',
  'fixture-font-retry': 'Actual verification menu retries two failed font attempts, succeeds on the third and rejects older retry callbacks.',
}, { argv: args.filter(arg => !arg.startsWith('--evidence-path=')) });

if (selected.length) {
  const { foundationControls } = await import('./lib/reader-foundation-control-probe.mjs');
  const { boundedSurfaceSdk } = await import('./lib/bounded-surface-sdk-probe.mjs');
  const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
  const { SearchFilterGeometry } = await import('../entry/src/main/ets/features/search/ui/SearchFilterGeometry.ts');
  const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
  const { ts, options } = installedEtsCompiler();
  const root = new URL('../', import.meta.url);
  const filterPath = 'entry/src/main/ets/features/search/ui/ReaderSearchFilterPanel.ets';
  const directoryPath = 'entry/src/main/ets/features/reading/ui/ReaderControlDirectoryContent.ets';
  const fixturePath = 'entry/src/main/ets/pages/ReaderPageStructureVerification.ets';
  const read = path => readFileSync(new URL(path, root), 'utf8');
  const results = {};

  function filterGeometry(source = read(filterPath)) {
    let samples = 0;
    for (const stacked of [false, true]) for (const scroll of [false, true]) {
      const controls = foundationControls();
      const owner = createReaderBuilderProbe(source, ['scheme', 'selectedGroup', 'selectedType', 'sheetBody',
        'optionContent', 'optionGroup', 'groupLabel', 'choiceRows', 'typeChip', 'groupChip', 'contentType', 'sourceGroup'],
      controls.dependencies, controls.hooks).owner;
      let width = stacked ? 240 : 320;
      let limit = scroll ? 120 : 600;
      const geometry = () => new SearchFilterGeometry(width, limit, stacked ? 40 : 20, 24,
        stacked ? [80, 80, 80] : [60, 60, 60], 44, 18);
      const initial = geometry();
      assert.equal(initial.stackedLabels, stacked); assert.equal(initial.scrollRequired, scroll);
      const calls = [];
      Object.assign(owner, { scheme: 'day', selectedType: '全部类型', selectedGroup: '全部',
        sheetGeometry: geometry, bodyHeightLimit: () => limit, systemFontScale: () => 1,
        accepts: identity => identity === 'filter-current',
        onGroup: (label, identity) => calls.push([label, identity]), onType() {} });
      owner.sheetBody('filter-current');
      const groups = controls.nodes(owner).filter(node => node.type === (stacked ? 'Column' : 'Row') && node.width === initial.innerWidth);
      assert.equal(groups.length, 2);
      const actors = [...owner.observers];
      width -= 20; limit -= 10; owner.replay(); controls.properties.flush();
      assert.deepEqual(groups.map(node => node.width), [geometry().innerWidth, geometry().innerWidth],
        'retained filter groups consume current window geometry');
      if (stacked) {
        const labels = controls.nodes(owner).filter(node => node.type === 'Text' && ['内容', '来源'].includes(node.create));
        assert.equal(labels.length, 2);
        assert.ok(labels.every(node => node.width === geometry().innerWidth), 'stacked labels consume current geometry');
      }
      if (scroll) assert.equal(controls.nodes(owner).find(node => node.type === 'Scroll').constraintSize.maxHeight, limit);
      const group = controls.nodes(owner).find(node => node.type === 'Button' && node.accessibilityText === '筛选来源:本地');
      assert.ok(group); group.onClick(); assert.deepEqual(calls, [['本地', 'filter-current']]);
      assert.deepEqual(owner.observers, actors, 'same layout and choice keys retain their SDK actors');
      samples++;
    }
    return { samples, currentGroupWidths: 8, currentStackedLabelWidths: 4, currentGroupActions: 4,
      boundary: 'Actual SDK body/controls and geometry contract. Finite native measurement input. Native branch replacement, glyphs and sheet rendering remain separate.' };
  }

  async function fixtureFontRetry(source = read(fixturePath)) {
    const controls = foundationControls();
    const feedback = boundedSurfaceSdk({ properties: controls.properties });
    const hooks = { ...controls.hooks, ...feedback.hooks,
      childSources: { ...controls.hooks.childSources, ...feedback.childSources } };
    let registrations = 0;
    const owner = createReaderBuilderProbe(source, ['fontState', 'fontAttempt', 'menu', 'fontPreparationState',
      'retryFonts', 'loadFonts', 'debugBuild'], { ...controls.dependencies, ...feedback.deps,
      DEBUG: true, BUILD_MODE_NAME: 'debug', readerWindowMetrics: () => ({ systemFontScale: 1 }),
      prepareReaderFonts: async () => { if (++registrations < 3) throw Error('finite font failure'); },
      hilog: { error() {} } }, hooks).owner;
    Object.assign(owner, { mounted: true, admitted: true, scene: 'menu', presentation: 7,
      requestedWidth: 320, actualWidth: 320, actualHeight: 600, menuBottomInset: () => 0, record() {} });
    await owner.loadFonts(); assert.equal(owner.fontAttempt, 1); assert.equal(owner.fontState, 'failed');
    owner.menu();
    const retry = () => feedback.nodes(owner).findLast(node => node.type === 'Button' && node.accessibilityText === '重试字体准备');
    const old = retry(); assert.ok(old); old.onClick();
    await Promise.resolve(); await Promise.resolve(); controls.properties.flush();
    assert.equal(owner.fontAttempt, 2); assert.equal(owner.fontState, 'failed');
    const current = retry(); assert.ok(current); current.onClick();
    await Promise.resolve(); await Promise.resolve();
    assert.equal(owner.fontAttempt, 3, 'current retry action survives a second font preparation failure');
    assert.equal(owner.fontState, 'ready'); assert.equal(registrations, 3);
    old.onClick(); assert.equal(registrations, 3, 'old attempt cannot retry after successful readiness');
    owner.fontState = 'failed'; old.onClick();
    assert.equal(registrations, 3, 'old attempt callback remains rejected when another failure is visible');
    controls.properties.flush();
    const latest = retry(); assert.ok(latest);
    owner.presentation = 8; latest.onClick(); assert.equal(registrations, 3, 'old menu presentation cannot retry current attempt');
    owner.presentation = 7; owner.mounted = false; latest.onClick();
    assert.equal(registrations, 3, 'current attempt cannot retry after owner retirement');
    return { fontAttempts: 3, failures: 2, successfulReadiness: true, oldAttemptRejected: true, retiredOwnerRejected: true,
      boundary: 'Actual retry/load methods and shared native Button callbacks. Finite font registrar failures. Native keyed removal and rendering remain separate.' };
  }

  function directoryTabs(source = read(directoryPath)) {
    const controls = foundationControls();
    const owner = createReaderBuilderProbe(source, ['tab', 'layoutPresentation', 'tabButton', 'currentContent', 'openList'],
      { ...controls.dependencies, DEBUG: false }, controls.hooks).owner;
    const calls = [];
    Object.assign(owner, { mounted: true, lifecycle: 0, layoutRestoreTicket: 0, sessionKey: 'current-book',
      layoutPresentation: 1, progress: 1, fontScale: () => 1, tabWidth: () => 140, tabHeight: () => 44,
      value: (quick, full) => full, presentation: () => ({ contentOpacity: 1, contentBlur: 0 }),
      tabsInteractive: () => true, currentInputEnabled: () => true, syncContentLayout() {},
      rowHeight: () => 40, refreshData() {}, placement: { open() {} },
      onTabChange: tab => { calls.push(tab); owner.updateStateVars({ tab }); controls.properties.flush(); } });
    owner.tabButton('directory', '章节'); owner.tabButton('bookmarks', '书签');
    const tabs = controls.nodes(owner).filter(node => node.type === 'Button'); assert.equal(tabs.length, 2);
    const actorIds = tabs.map(node => node.id);
    tabs[1].onClick(); assert.deepEqual(calls, ['bookmarks']); assert.equal(owner.layoutPresentation, 2);
    tabs[0].onClick();
    assert.deepEqual(calls, ['bookmarks', 'directory'], 'retained Full directory tabs accept the return after generation renewal');
    tabs[1].onClick(); assert.deepEqual(calls, ['bookmarks', 'directory', 'bookmarks']);
    assert.equal(owner.layoutPresentation, 4);
    assert.deepEqual(controls.nodes(owner).filter(node => node.type === 'Button').map(node => node.id), actorIds);
    owner.tabButton('directory', '旧短头', () => 1);
    controls.nodes(owner).filter(node => node.type === 'Button').at(-1).onClick();
    assert.equal(calls.length, 3, 'old short-header generation is still rejected');
    owner.tabsInteractive = () => false; tabs[0].onClick(); assert.equal(calls.length, 3);
    owner.tabsInteractive = () => true; owner.mounted = false; tabs[0].onClick(); assert.equal(calls.length, 3);
    return { currentTransitions: 3, currentLayoutGeneration: 4, retainedFullTabActors: 2, oldShortHeaderRejected: true,
      boundary: 'Actual tab Builders and openList PropWatch with finite layout/data ports. Native marker branch replacement and focus remain separate.' };
  }

  function captureGeometry(source) {
    const tree = ts.createSourceFile('Filter.ets', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
    assert.equal(tree.parseDiagnostics.length, 0);
    const names = new Set(['optionContent', 'optionGroup', 'groupLabel', 'choiceRows', 'typeChip', 'groupChip']);
    const edits = [];
    const visit = node => {
      if (ts.isMethodDeclaration(node) && names.has(node.name.getText(tree))) {
        edits.push({ start: node.parameters.end, end: node.parameters.end, text: ', geometry: SearchFilterGeometry' });
        const reads = child => {
          if (ts.isCallExpression(child) && child.expression.getText(tree) === 'this.sheetGeometry')
            edits.push({ start: child.getStart(tree), end: child.end, text: 'geometry' });
          ts.forEachChild(child, reads);
        };
        reads(node.body);
      }
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
          node.expression.expression.kind === ts.SyntaxKind.ThisKeyword && names.has(node.expression.name.text)) {
        let parent = node.parent;
        while (parent && !ts.isMethodDeclaration(parent)) parent = parent.parent;
        const value = parent && names.has(parent.name.getText(tree)) ? 'geometry' : 'this.sheetGeometry()';
        edits.push({ start: node.arguments.end, end: node.arguments.end, text: ', ' + value });
      }
      ts.forEachChild(node, visit);
    };
    visit(tree); assert.ok(edits.length > 10);
    for (const edit of edits.sort((a, b) => b.start - a.start)) source = source.slice(0, edit.start) + edit.text + source.slice(edit.end);
    return source;
  }

  for (const id of selected) {
    if (id === 'directory-tab-renewal') {
      results[id] = directoryTabs();
      const original = read(directoryPath), mutant = original
        .replace('presentation: () => number = (): number => this.layoutPresentation ?? 0', 'presentation: number = this.layoutPresentation ?? 0')
        .replace('this.currentContent(presentation())', 'this.currentContent(presentation)')
        .replaceAll("this.tabButton('directory', '章节', (): number => presentation)", "this.tabButton('directory', '章节', presentation)")
        .replaceAll("this.tabButton('bookmarks', '书签', (): number => presentation)", "this.tabButton('bookmarks', '书签', presentation)");
      assert.notEqual(mutant, original);
      assert.throws(() => directoryTabs(mutant), /retained Full directory tabs accept the return after generation renewal/);
      results[id].negativeControlsRejected = 1;
    } else if (id === 'filter-geometry') {
      results[id] = filterGeometry();
      assert.throws(() => filterGeometry(captureGeometry(read(filterPath))), /retained filter groups consume current window geometry/);
      results[id].negativeControlsRejected = 1;
    } else {
      results[id] = await fixtureFontRetry();
      const original = read(fixturePath), mutant = original.replace('ForEach([this.fontAttempt]', 'ForEach([1]');
      assert.notEqual(mutant, original);
      await assert.rejects(() => fixtureFontRetry(mutant), /current retry action survives a second font preparation failure/);
      results[id].negativeControlsRejected = 1;
    }
    recordContractCasePass(id);
  }
  if (output) {
    const inputs = [directoryPath, filterPath, fixturePath, 'entry/src/main/ets/features/search/ui/SearchFilterGeometry.ts',
      'tools/test-ui-live-layout-retry.mjs'].map(path => ({ path, sha256: createHash('sha256').update(read(path)).digest('hex') }));
    writeFileSync(new URL(output, root), JSON.stringify({ status: 'PASS', cases: selected, results, inputs }, null, 2) + '\n');
  }
}
