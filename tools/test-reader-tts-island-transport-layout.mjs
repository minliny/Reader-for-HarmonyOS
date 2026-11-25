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
  class IslandAction {
    constructor(parent, params, _storage, id) {
      Object.assign(this, { owner: parent, params, id });
    }
  }
  const props = source('ReaderIslandControlStyle');
  const contents = source('ReaderControlTtsContent');
  const members = ['islandPlaybackContents', 'islandPlaybackHeight', 'islandPlaybackLayout',
    'islandTransport', 'islandTransportAsset', 'controlText'];
  const layoutBindings = pureModuleProbe(props.slice(0, props.indexOf('/** Preserve')), 'ReaderIslandControlStyle.ets',
    readerTypographyRoles, ['readerIslandTtsPlaybackLayout', 'READER_ISLAND_PLAYBACK_INSET_X',
      'READER_ISLAND_PLAYBACK_INSET_Y', 'READER_ISLAND_PLAYBACK_STATUS_GAP', 'READER_ISLAND_PLAYBACK_ACTION_GAP']);
  const run = (width, fontScale, expectedRows, sourceOnly = 'none') => {
    const deps = { ReaderIslandAction: IslandAction, ReaderTtsWaveform: IslandAction, ...layoutBindings,
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
    const native = [...owner.nodes.values()];
    const viewport = native.find(node => node.type === 'Flex');
    const cells = native.filter(node => node.type === '__Common__');
    // The ArkUI probe records the actual emitted native layout attributes.
    // The CJK fixture budgets one full em per character, plus visible icon and padding.
    const required = 3 * readerTypographyRoles.TYPE_READER_APPEARANCE_RETAINED_STEPPER_ROW_VALUE.fontSizeFp * fontScale + 23;
    assert.equal(viewport?.create?.wrap, 'FlexWrap.Wrap');
    const rowGap = viewport.create.space.cross.value;
    const cellGap = viewport.create.space.main.value;
    const card = native.find(node => node.type === 'Column');
    const header = native.find(node => node.type === 'Row');
    const viewportWidth = width - card.padding.left - card.padding.right;
    assert.equal(cells.length, 4, 'each action has a native size and appears once');
    assert.ok(cells[0].width >= required && cells[3].width >= required,
      'both rendered sentence slots can fit three live CJK glyphs, icon and insets');
    let rows = 1;
    let rowWidth = 0;
    for (const cell of cells) {
      assert.ok(cell.width >= 44 && cell.height >= 44, 'every transport preserves its full touch target');
      if (rowWidth > 0 && rowWidth + cellGap + cell.width > viewportWidth) {
        rows++;
        rowWidth = 0;
      }
      rowWidth += (rowWidth > 0 ? cellGap : 0) + cell.width;
    }
    assert.equal(rows, expectedRows, 'native cell widths and gaps allocate the expected number of visual rows');
    assert.ok(owner.islandPlaybackHeight() >= card.padding.top + card.padding.bottom + card.create.space +
      header.height + cells[0].height * rows + rowGap * (rows - 1), 'visual rows fit inside the same measured card');
    if (fontScale === 1) {
      assert.equal(owner.islandPlaybackHeight(), 84, 'the regular one-row card preserves its baseline height');
      assert.ok(cells[1].width > cells[0].width, 'the original playback emphasis remains in one row');
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
