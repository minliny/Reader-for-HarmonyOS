import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import * as search from '../entry/src/main/ets/features/reading/ReaderControlSearchGeometry.ts';
import * as playback from '../entry/src/main/ets/features/reading/ReaderControlPlaybackGeometry.ts';
import * as actors from '../entry/src/main/ets/features/reading/ReaderControlActorGeometry.ts';
import * as scroll from '../entry/src/main/ets/features/reading/ReaderControlMorphScroll.ts';
import { readerAppColor } from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';

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
    near(f.results.y + f.firstResult.y, 42.993 + 15.007 * p, 'authored row screen path retained');
    assert.ok(f.firstResult.y >= -1e-6, 'first result starts within its clip');
    const action = nodes.find(n => n.accessibilityText === '搜索正文');
    assert.equal(action.border.color, readerAppColor('TOK_LINE', scheme));
    assert.equal(action.borderRadius, 8);
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

// Original Quick Header 736:3 is 24vp above playback. Keep the user's no-Back
// decision; PH51 supplies module/status in the existing vacant header slot.
assert.equal((read('ReaderControlAutoPageContent').match(/this\.quickHeader\(\);/g) ?? []).length, 2,
  'normal and retained Quick source each include the header');
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
    const header = nodes.find(n => n.type === 'Row' && n.height === 24);
    assert.equal(header.opacity, 1);
    assert.ok(header.position.y + header.height <= auto.frame().content.y);
    for (const text of nodes.filter(n => n.type === 'Text')) assert.match(text.fontColor, /^#[\da-f]{8}$/i);
  }
  for (const p of [0, .25, .5, 1, .5, 0]) {
    auto.motionProgress = p; auto.availableWidth = 286 + 52 * p; auto.replay();
    const header = [...auto.nodes.values()].find(n => n.type === 'Row' && n.height === 24);
    near(header.opacity, 1 - p, 'Quick row follows existing progress');
    assert.ok(header.position.x + header.width <= auto.availableWidth);
  }
}
console.log('PH50/51 actual SDK: Query bounds, first result, button outline, submit; Quick/source headers and reversible progress PASS');
