import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

export const CONTRACT_CASES = {
  "quick-search": {
    "description": "Actual SDK query/action, blank/loading admission, reversible bounded placement; no exact historical row path",
    "resources": []
  },
  "auto-page-header": {
    "description": "Actual Quick and retained-source header text/status and reversible progress; no call count contract",
    "resources": []
  }
};

async function case_quick_search() {
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const search = await import('../entry/src/main/ets/features/reading/ReaderControlSearchGeometry.ts');
const { readerAppColor } = await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
const read = name => readFileSync(new URL('../entry/src/main/ets/features/reading/' + name + '.ets', import.meta.url), 'utf8');
const near = (a, b, why = '') => assert.ok(Math.abs(a - b) < 1e-6, `${why}: ${a} vs ${b}`);
const { owner } = createReaderBuilderProbe(read('ReaderControlSearchContent'),
  ['frame', 'searchField', 'searchAction', 'canSearch', 'submit'], search);
let submits = 0;
Object.assign(owner, { motionProgress: 0, availableWidth: 286, availableHeight: 190,
  query: '', state: { kind: 'idle' }, interactionEnabled: true, appThemeScheme: 'day',
  resultsBody() {}, quickBack() {}, inputController: {}, onTemporaryLayerChange() {},
  onQueryChange(value) { this.query = value; }, onSearch() { submits++; },
  presentation: () => ({ contentOpacity: 1, contentBlur: 0 }) });
owner.searchField(); owner.searchAction();
for (const scheme of ['day', 'night']) for (const delta of [-24.285714, 0, 120]) {
  const poses = new Map();
  for (const p of [0, .25, .5, .75, 1, .75, .5, .25, 0]) {
    Object.assign(owner, { appThemeScheme: scheme, motionProgress: p, availableWidth: 286 + 52 * p + delta,
      availableHeight: 190 + 476 * p }); owner.replay();
    const f = owner.frame(), nodes = [...owner.nodes.values()];
    near(f.queryDivider.y, f.field.y + f.field.height + 5 + 4 * p, 'divider follows query bottom');
    near(f.results.y, f.queryDivider.y + 1, 'results immediately follow divider');
    assert.ok(Number.isFinite(f.results.y + f.firstResult.y), 'current row projection remains finite; an exact path needs separate approved design evidence');
    assert.ok(f.firstResult.y >= -1e-6, 'first result starts within its clip');
    const action = nodes.find(n => n.accessibilityText === '搜索正文');
    assert.equal(action.border.color, readerAppColor('TOK_LINE', scheme));
    assert.ok(action.borderRadius >= 0, 'platform receives a valid radius; exact style is not a behavior contract');
    assert.equal(action.opacity, 1, 'disabled query preserves button boundary');
    assert.ok(action.position.x + action.width <= owner.availableWidth);
    const field = nodes.find(n => n.type === 'Row' && n.height === f.field.height);
    assert.equal(field.border.color, readerAppColor('TOK_LINE', scheme));
    const geometry = JSON.stringify(f);
    if (poses.has(p)) assert.equal(geometry, poses.get(p)); else poses.set(p, geometry);
  }
}
const action = [...owner.nodes.values()].find(n => n.accessibilityText === '搜索正文');
action.onClick(); assert.equal(submits, 0);
owner.query = '雨夜'; owner.replay(); action.onClick(); assert.equal(submits, 1);
owner.state = { kind: 'loading' }; owner.replay(); action.onClick(); assert.equal(submits, 1);


}

async function case_auto_page_header() {
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const playback = await import('../entry/src/main/ets/features/reading/ReaderControlPlaybackGeometry.ts');
const actors = await import('../entry/src/main/ets/features/reading/ReaderControlActorGeometry.ts');
const scroll = await import('../entry/src/main/ets/features/reading/ReaderControlMorphScroll.ts');
const read = name => readFileSync(new URL('../entry/src/main/ets/features/reading/' + name + '.ets', import.meta.url), 'utf8');
const near = (a, b, why = '') => assert.ok(Math.abs(a - b) < 1e-6, `${why}: ${a} vs ${b}`);
for (const sourceOnly of ['none', 'quick']) {
  const { owner: auto } = createReaderBuilderProbe(read('ReaderControlAutoPageContent'),
    ['p', 'frame', 'headerMeta', 'quickHeader'],
    { ...playback, ...actors, ...scroll });
  Object.assign(auto, { motionProgress: 0, availableWidth: 286, availableHeight: 190,
    cachedProgress: -1, cachedWidth: -1, form: 'quick', sourceOnly, sourceDetached: false,
    status: 'stopped', appScheme: 'day', scroller: {}, scrollMotion: scroll.createReaderControlMorphScroll(),
    controlSection() {}, timerSection() {}, moduleHeader() {}, speedRow() {}, followHighlightRow() {},
    fullInput: () => false, actorId: () => '', measureActor() {}, reportActorVisible() {},
    presentation: () => ({ contentOpacity: 1, contentBlur: 0 }) });
  auto.quickHeader();
  for (const scheme of ['day', 'night']) for (const status of ['stopped', 'running', 'paused']) {
    Object.assign(auto, { appScheme: scheme, status, motionProgress: 0 }); auto.replay();
    const nodes = [...auto.nodes.values()];
    assert.equal(nodes.filter(n => n.type === 'Text' && n.create === '自动翻页').length, 1);
    assert.ok(nodes.some(n => n.type === 'Text' && n.create === ({ stopped: '未开始', running: '运行中', paused: '已暂停' })[status]));
    assert.ok(!nodes.some(n => n.type === 'Text' && n.create === '返回'));
    const header = nodes.find(n => n.type === 'Row' && n.position && n.opacity !== undefined);
    assert.equal(header.opacity, 1);
    assert.ok(header.position.y + header.height <= auto.frame().content.y);
    for (const text of nodes.filter(n => n.type === 'Text')) assert.match(text.fontColor, /^#[\da-f]{8}$/i);
  }
  for (const p of [0, .25, .5, 1, .5, 0]) {
    auto.motionProgress = p; auto.availableWidth = 286 + 52 * p; auto.replay();
    const header = [...auto.nodes.values()].find(n => n.type === 'Row' && n.position && n.opacity !== undefined);
    near(header.opacity, 1 - p, 'Quick row follows existing progress');
    assert.ok(header.position.x + header.width <= auto.availableWidth);
  }
}

}

const implementations = {'quick-search':case_quick_search,'auto-page-header':case_auto_page_header};
for (const id of selectContractCases(CONTRACT_CASES)) {
  await implementations[id]();
  recordContractCasePass(id);
}
