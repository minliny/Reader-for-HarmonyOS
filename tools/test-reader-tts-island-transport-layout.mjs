import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const selected = selectContractCases({
  reflow: { description: 'Fixed-island TTS fits both sentence labels at enlarged system text and preserves transport input and frozen-source identity', resources: [] },
});

async function verifyTransport() {
  const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
  const { readerTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
  const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
  const source = name => readFileSync(new URL(`../entry/src/main/ets/features/reading/ui/${name}.ets`, import.meta.url), 'utf8');
  const props = source('ReaderIslandControlStyle');
  const contents = source('ReaderControlTtsContent');
  const members = ['islandPlaybackContents', 'islandPlaybackHeight', 'islandPlaybackLayout',
    'islandTransportRow', 'islandTransport', 'islandTransportAsset', 'controlText'];
  const layoutBindings = pureModuleProbe(props.slice(0, props.indexOf('/** Preserve')), 'ReaderIslandControlStyle.ets',
    readerTypographyRoles, ['readerIslandTtsPlaybackLayout', 'READER_ISLAND_PLAYBACK_INSET_X',
      'READER_ISLAND_PLAYBACK_INSET_Y', 'READER_ISLAND_PLAYBACK_STATUS_GAP', 'READER_ISLAND_PLAYBACK_ACTION_GAP']);
  const run = (width, fontScale, expectedRows, sourceOnly = 'none') => {
    const rows = [], rowStack = [];
    const Row = {
      name: 'Row',
      create(options) {
        const row = { options, labels: [] };
        rows.push(row);
        rowStack.push(row);
      },
      width(value) { rowStack.at(-1).width = value; },
      height(value) { rowStack.at(-1).height = value; },
      pop() { rowStack.pop(); },
    };
    class IslandAction {
      constructor(parent, params, _storage, id) {
        Object.assign(this, { owner: parent, params, id });
        rowStack.at(-1)?.labels.push(params.label);
      }
    }
    const deps = { Row, ReaderIslandAction: IslandAction, ReaderTtsWaveform: IslandAction, ...layoutBindings,
      ReaderWindowCoordinator: { metrics: () => ({ systemFontScale: fontScale }) } };
    const { owner } = createReaderBuilderProbe(contents, members, deps,
      { childSources: { ReaderIslandAction: props, ReaderTtsWaveform: source('ReaderTtsWaveform') } });
    const actions = [];
    Object.assign(owner, {
      availableWidth: width, sourceOnly, appScheme: 'day', state: { status: 'paused' },
      statusText: () => '已暂停', isActivelySpeaking: () => false, hasActiveQueue: () => true,
      displayState: () => ({ status: 'paused' }),
      currentInputEnabled: () => true, onlineServicePage: () => false,
      onPrevious: () => actions.push('previous'), onNext: () => actions.push('next'),
      onStop: () => actions.push('stop'), onToggle: () => actions.push('toggle'), reportMorphActor() {},
    });
    owner.islandPlaybackContents();
    const controls = [...owner.children.values()];
    assert.deepEqual(controls.map(child => child.params.label), ['上一句', '播放', '停止', '下一句']);
    assert.deepEqual(controls.map(child => child.params.accessibleLabel), ['上一句', '开始或继续朗读', '停止朗读', '下一句']);
    assert.equal(rowStack.length, 0, 'all native Row containers close');
    const transportRows = rows.filter(row => row.labels.length !== 0);
    const expectedLabels = expectedRows === 1 ? [['上一句', '播放', '停止', '下一句']] :
      expectedRows === 2 ? [['上一句', '播放'], ['停止', '下一句']] : [['上一句'], ['播放'], ['停止'], ['下一句']];
    assert.deepEqual(transportRows.map(row => row.labels), expectedLabels,
      'all four actions are mounted under explicit native Rows, with each pair sharing its parent');
    const native = [...owner.nodes.values()];
    const cells = native.filter(node => node.type === '__Common__');
    // The ArkUI probe records the actual emitted native layout attributes.
    // The CJK fixture budgets one full em per character, plus visible icon and padding.
    const required = 3 * readerTypographyRoles.TYPE_READER_APPEARANCE_RETAINED_STEPPER_ROW_VALUE.fontSizeFp * fontScale + 23;
    const [card, transport] = native.filter(node => node.type === 'Column');
    const [header] = rows;
    const viewportWidth = width - card.padding.left - card.padding.right;
    assert.equal(cells.length, 4, 'each action has a native size and appears once');
    let nextCell = 0;
    for (const row of transportRows) {
      assert.equal(row.width, '100%');
      assert.ok(row.height >= 44);
      const entries = cells.slice(nextCell, nextCell + row.labels.length);
      const weight = entries.reduce((sum, cell) => sum + cell.layoutWeight, 0);
      const actionBudget = viewportWidth - row.options.space * (entries.length - 1);
      entries.forEach((cell, index) => {
        const actionWidth = actionBudget * cell.layoutWeight / weight;
        assert.ok(actionWidth >= 44 && cell.height >= 44, 'every transport preserves its full touch target');
        if (row.labels[index] === '上一句' || row.labels[index] === '下一句') {
          assert.ok(actionWidth >= required, 'each native sentence action fits all visible marks');
        }
      });
      nextCell += entries.length;
    }
    assert.ok(owner.islandPlaybackHeight() >= card.padding.top + card.padding.bottom + card.create.space +
      header.height + transportRows.reduce((height, row) => height + row.height, 0) +
      transport.create.space * (transportRows.length - 1), 'visual rows fit inside the same measured card');
    if (fontScale === 1) {
      assert.equal(owner.islandPlaybackHeight(), 84, 'the regular one-row card preserves its baseline height');
      assert.ok(cells[1].layoutWeight > cells[0].layoutWeight, 'the original playback emphasis remains in one row');
    }
    for (const [index, id] of ['previous', 'toggle', 'stop', 'next'].entries()) {
      const { params } = controls[index];
      assert.equal(params.nativeId, sourceOnly === 'none' ? `reader-control-tts-transport-${id}` : '');
      assert.equal(params.actionReady, sourceOnly === 'none');
      params.onAction();
    }
    assert.deepEqual(actions, sourceOnly === 'none' ? ['previous', 'toggle', 'stop', 'next'] : []);
  };
  run(326, 2, 2);
  run(326, 1, 1);
  run(326, 2, 2, 'quick');
  run(208, 2, 4);
  run(540, 2, 1);
}

for (const id of selected) {
  await verifyTransport();
  recordContractCasePass(id);
}
