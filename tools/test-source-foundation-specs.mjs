import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const definitions = {
  'action-admission': { description: 'Actual source actions, captured identity, busy and retired actors', resources: [] },
  'responsive-chip': { description: 'Finite status chip touch area inside the scrolling viewport', resources: [] },
  'trailing-tools': { description: 'Real shared native icon action through the current PageBackBar slot', resources: [] },
};

const read = relative => readFileSync(new URL(relative, import.meta.url), 'utf8');
const component = name => read('../entry/src/main/ets/features/common/' + name + '.ets');

async function runCase(id) {
  const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
  const { labeledIconControls } = await import('./lib/reader-labeled-icon-action-probe.mjs');
  const source = read('../entry/src/main/ets/features/source/SourceManagementPage.ets');
  const fixture = JSON.parse(read('./fixtures/design/source-management-action-baseline.json'));

  if (id === 'action-admission') {
    const { readerSourceCategoryLabel } = await import('../entry/src/main/ets/features/source/ReaderSourceCategory.ts');
    const supportMethods = {
      detectButton: ['sourceDetectEnabled', 'sourceActionLabel'],
      loginButton: ['sourceActionEnabled', 'sourceActionLabel'],
      bottomActionBar: ['openTools'],
    };
    for (const { id, method, label, scheme, active } of fixture.cases.filter(row => row.method !== 'statusBanner')) {
      const controls = labeledIconControls();
      const { owner } = createReaderBuilderProbe(source, [method, ...(supportMethods[method] ?? [])], {
        ...controls.dependencies, readerSourceCategoryLabel, ScrollDirection: { Horizontal: 'ScrollDirection.Horizontal' },
      }, controls.hooks);
      const calls = [];
      const book = { sourceId: 'exact-source', name: '测试书源', checkState: active ? 'checking' : 'idle' };
      Object.assign(owner, {
        appThemeScheme: scheme, mounted: true, temporaryBackIdentity: 'source-list', operation: {}, sources: [book],
        categoryValue: active ? 'all' : 'novel', statusValue: active ? label : '全部',
        filterControlWidth: () => 280, contentFrame: () => ({ width: 350 }),
        layoutBudget: () => ({ filterHeight: 44, footerHeight: 44 }), actionBottomInset: () => 0,
        rebuildSourceProjection: () => calls.push('filter'),
        onDetectSource: value => calls.push(['detect', value]), onLoginSource: value => calls.push(['login', value]),
        captureScroll() {}, onOpenTools: () => calls.push('manage'), onAddSource: () => calls.push('add'),
      });
      const busy = active && ['detectButton', 'loginButton'].includes(method);
      if (method === 'chip') owner.chip(label, id.endsWith('wide') ? 72 : 58, !active);
      else if (method === 'detectButton' || method === 'loginButton') owner[method](book);
      else owner[method]();
      const actor = [...owner.children.values()].find(child =>
        child.specId === id && child.label === (busy && method === 'detectButton' ? '检测中' : label));
      assert.ok(actor, id + ' mounts the finite production control');
      const nodes = controls.orderedNodes(actor);
      assert.ok(nodes.some(node => node.type === 'Text' && node.create === actor.label));
      const hit = nodes.find(node => node.onClick);
      assert.ok(hit);
      hit.onClick();
      const fired = !busy && !(method === 'chip' && active);
      assert.equal(calls.length, fired ? 1 : 0, id + ' dispatches only the admitted action');
      if (fired && method === 'detectButton') {
        assert.deepEqual(calls[0], ['detect', 'exact-source']);
        owner.temporaryBackIdentity = 'different-source-list';
        hit.onClick();
        assert.equal(calls.length, 1, 'old detection callback cannot borrow a new page identity');
      }
      if (fired && method === 'loginButton') assert.deepEqual(calls[0], ['login', 'exact-source']);
      actor.aboutToDisappear();
      hit.onClick();
      assert.equal(calls.length, fired ? 1 : 0, id + ' rejects a late physical click after retirement');
    }

    // The current reconciliation action belongs to the original pending owner.
    // The shared SDK stack emits the click and passes its captured generation.
    const { boundedSurfaceSdk } = await import('./lib/bounded-surface-sdk-probe.mjs');
    for (const scheme of ['day', 'night']) {
      const surfaces = boundedSurfaceSdk();
      const owner = surfaces.consumer(source, ['originalRecovery', 'originalRecoveryView',
        'originalActionIdentities', 'originalActionCurrent']);
      const reconciled = [];
      Object.assign(owner, { appThemeScheme: scheme, mounted: true, temporaryBackIdentity: 'source-list',
        operation: { original: { blocked: true, operationId: 'original', generation: 9,
          writeStage: 'write', message: '真实消息' } },
        onReconcile: generation => reconciled.push(generation) });
      owner.originalRecovery();
      const walk = node => [...(node.nodes?.values() ?? []), ...[...(node.children?.values() ?? [])].flatMap(walk)];
      const click = walk(owner).find(node => node.onClick && node.accessibilityText === '核对');
      assert.ok(click, 'current original-operation notice exposes the real native action');
      click.onClick();
      assert.deepEqual(reconciled, [9]);
      owner.operation = { original: { ...owner.operation.original, generation: 10 } };
      click.onClick();
      owner.mounted = false;
      click.onClick();
      assert.deepEqual(reconciled, [9], 'retired operation and page reject an old physical action');
    }
  } else if (id === 'responsive-chip') {
    const widthsByUnit = new Map();
    for (const { availableWidth, width } of fixture.widths) {
      const controls = labeledIconControls();
      const { owner } = createReaderBuilderProbe(source, ['chip'], controls.dependencies, controls.hooks);
      Object.assign(owner, { appThemeScheme: 'day', statusValue: '全部',
        filterControlWidth: () => availableWidth, rebuildSourceProjection() {} });
      owner.chip('有限状态', width, true);
      const actor = [...owner.children.values()].at(-1);
      const actual = controls.nodes(actor).find(node => node.type === 'Text').width;
      assert.ok(Number.isFinite(actual) && actual >= 44, 'each unit keeps its finite touch width');
      if (!widthsByUnit.has(width)) widthsByUnit.set(width, new Set());
      widthsByUnit.get(width).add(actual);
    }
    for (const widths of widthsByUnit.values()) assert.equal(widths.size, 1, 'a narrow viewport scrolls fixed units');
  } else {
    const { iconButtonControls } = await import('./lib/reader-icon-button-probe.mjs');
    for (const scheme of ['day', 'night']) {
      const controls = labeledIconControls();
      const Icon = iconButtonControls({ properties: controls.properties }).icon.Component;
      // Only the trailing slot is under test. The header port keeps the
      // actual SDK slot declaration and renders it through its real parent.
      class BackBar {
        constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }, params); }
        initialRender() {}
      }
      const { owner } = createReaderBuilderProbe(source, ['backBar', 'openTools'],
        { ...controls.dependencies, ReaderIconButton: Icon, PageBackBar: BackBar },
        { ...controls.hooks, childSources: { ...controls.hooks.childSources,
          ReaderIconButton: component('ReaderIconButton'), PageBackBar: component('PageBackBar') } });
      const calls = [];
      Object.assign(owner, { appThemeScheme: scheme, captureScroll: () => calls.push('capture'),
        onOpenTools: () => calls.push('tools'), onBack() {} });
      owner.backBar();
      const bar = [...owner.children.values()].find(child => child instanceof BackBar);
      bar.trailing();
      const icon = [...owner.children.values()].find(child => child instanceof Icon);
      const nodes = controls.nodes(icon);
      const hit = nodes.find(node => node.type === 'Stack' && node.onClick);
      assert.ok(hit && nodes.some(node => node.type === 'Image'));
      hit.onClick();
      assert.deepEqual(calls, ['capture', 'tools']);
    }
  }
  console.log('PASS source controls: ' + id);
}

for (const id of selectContractCases(definitions)) {
  await runCase(id);
  recordContractCasePass(id);
}
