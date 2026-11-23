import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
import { boundedSurfaceSdk } from './lib/bounded-surface-sdk-probe.mjs';

const selected = selectContractCases({
  'rules-preview': { description: 'Actual directory-rule preview Scroll starts short text at the top and retains the empty branch', resources: [] },
  'manga-action-body': { description: 'Actual phone and wide manga action-body Scroll retains horizontal placement and starts short flow below its header', resources: [] },
});
const read = path => readFileSync(new URL('../entry/src/main/ets/' + path, import.meta.url), 'utf8');
class ActionPort {
  constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); }
}

function rulesPreview(source, preview) {
  const sdk = boundedSurfaceSdk();
  sdk.hooks.childSources.ReaderButton = read('ui/controls/ReaderButton.ets');
  const owner = sdk.consumer(source, ['build'], { ReaderButton: ActionPort });
  Object.assign(owner, { focusTargetId: '', interactionEnabled: true, rules: [], preview,
    actorIdentity: () => 'opening', canEdit: () => false, recoveryView: () => ({ visible: false }),
    recoveryIdentity: () => 'recovery', loaded: true, busy: false, directoryRefreshFailed: false, message: '', scheme: 'day' });
  owner.initialRender(); sdk.properties.flush();
  const scrolls = [...owner.nodes.values()].filter(node => node.type === 'Scroll');
  assert.equal(scrolls.length, preview.length > 0 ? 1 : 0);
  if (preview.length > 0) {
    assert.equal(scrolls[0].height, 120);
    assert.equal(scrolls[0].align, 'Alignment.Top', 'short rule preview has an explicit top content origin');
    assert.ok([...owner.nodes.values()].some(node => node.type === 'Text' && node.create === preview[0]));
  }
}

function mangaActionBody(source) {
  for (const wide of [false, true]) for (const panel of ['mode', 'settings', 'more', 'downloads']) {
    const sdk = boundedSurfaceSdk(), calls = [];
    sdk.hooks.childSources.MangaDownloadOperationsPanel = read('features/manga/ui/MangaDownloadOperationsPanel.ets');
    const owner = sdk.consumer(source, ['actionPanelBody'], { MangaDownloadOperationsPanel: ActionPort });
    Object.assign(owner, { panel, widePanel: () => wide, panelContentHeight: () => 400, actionHeaderHeight: () => 60,
      panelContentInset: () => 16, modePanel: () => calls.push('mode'), settingsPanel: () => calls.push('settings'),
      morePanel: () => calls.push('more'), downloadActionsGeneration: 3, downloadActions: [],
      downloadActionsLoading: false, downloadActionsFailure: '', backgroundPreference: 'paper' });
    owner.actionPanelBody(7); sdk.properties.flush();
    const scroll = [...owner.nodes.values()].find(node => node.type === 'Scroll');
    assert.ok(scroll);
    assert.equal(scroll.align, 'Alignment.Top', 'fixed wide body keeps its flow origin directly below the header');
    assert.equal(scroll.layoutWeight, wide ? 1 : 0);
    assert.equal(scroll.constraintSize.maxHeight, 340);
    assert.equal(scroll.scrollBar, 'BarState.Auto');
    if (panel !== 'downloads') assert.deepEqual(calls, [panel]);
    else assert.equal(owner.children.size, 1, 'the original downloads actor remains bound to this generation');
  }
}

function alignmentReasoning() {
  // Official Alignment::GetAlignPosition starts with zero offset and applies
  // the selected alignment only on axes where parent >= child. This is an
  // arithmetic explanation of the source, not native layout execution.
  const position = (parent, child, axis) => parent >= child ? (1 + axis) * (parent - child) / 2 : 0;
  assert.equal(position(2832, 2246, 0), 293);
  assert.equal(position(2832, 2246, -1), 0);
  assert.equal(position(120, 18, 0), 51);
  assert.equal(position(120, 18, -1), 0);
  assert.equal(position(120, 240, 0), 0);
  assert.equal(position(120, 240, -1), 0);
  assert.equal(position(320, 240, 0), 40, 'Top retains the horizontal center coefficient');
}

for (const id of selected) {
  alignmentReasoning();
  if (id === 'rules-preview') {
    const source = read('features/reading/ui/ReaderDirectoryRules.ets');
    for (const preview of [[], ['第一章'], Array.from({ length: 30 }, (_, index) => '章节 ' + index)]) rulesPreview(source, preview);
    const old = source.replace('}.height(120).align(Alignment.Top);', '}.height(120);');
    assert.notEqual(old, source);
    assert.throws(() => rulesPreview(old, ['第一章']), /explicit top content origin/);
  } else {
    const source = read('features/manga/ui/MangaReadingSurface.ets');
    mangaActionBody(source);
    const old = source.replace('.layoutWeight(this.widePanel() ? 1 : 0).scrollBar(BarState.Auto).align(Alignment.Top);',
      '.layoutWeight(this.widePanel() ? 1 : 0).scrollBar(BarState.Auto);');
    assert.notEqual(old, source);
    assert.throws(() => mangaActionBody(old), /flow origin directly below/);
  }
  console.log('PASS ' + id + ': actual SDK Scroll alignment and old-default negative, native rendering remains open');
  recordContractCasePass(id);
}
