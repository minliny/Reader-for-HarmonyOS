import { themeDayDesignSource } from './lib/reader-theme-design-source.mjs';
import * as morphScroll from '../entry/src/main/ets/features/reading/ReaderControlMorphScroll.ts';
import * as presentation from '../entry/src/main/ets/features/reading/ReaderControlMotionPresentation.ts';
const motionDeps = { ...presentation, RectShape: class { width(value) { this.widthValue = value; return this; } height(value) { this.heightValue = value; return this; } }, PathShape: class { commands(path) { this.path = path; return this; } } };
const motionProps = { fullContentHeight: 666, quickContentHeight: 190, fullViewportHeight: 666,
  scrollMotion: morphScroll.createReaderControlMorphScroll(), getUIContext: () => ({ vp2px: n => n * 3 }) };
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { readerControlSearchSourceField, readerControlSearchSourceResult, sampleReaderControlSearch }
  from '../entry/src/main/ets/features/reading/ReaderControlSearchGeometry.ts';
import { readerControlSettingsLabel, readerControlSettingsBar, readerControlSettingsChoice,
  readerControlSettingsScreenTitle, readerControlSettingsAddedGroup, readerControlSettingsAddedChild,
  sampleReaderControlSettings }
  from '../entry/src/main/ets/features/reading/ReaderControlSettingsGeometry.ts';
import * as settingsPolicy from '../entry/src/main/ets/features/reading/ReaderSettingsState.ts';
import { readerControlLerp, readerControlUnit } from '../entry/src/main/ets/features/reading/ReaderControlActorGeometry.ts';
import { splitReaderSearchSnippet } from '../entry/src/main/ets/features/reading/ReaderSearchHighlight.ts';
import { createReaderBuilderProbe, readerBuilderSdkAvailable } from './lib/reader-control-builder-probe.mjs';
import { productionSettingsOptionModifier } from './lib/reader-control-option-modifier-probe.mjs';
import * as searchScroll from '../entry/src/main/ets/features/reading/ReaderControlSearchScroll.ts';
import { assertSearchListBuilderGeometry } from './lib/reader-content-search-list-probe.mjs';

const read = path => themeDayDesignSource(readFileSync(new URL('../' + path, import.meta.url), 'utf8'));
const fixture = JSON.parse(read('tools/fixtures/reader-control-search-settings-live-20260905.json'));
const clipFixture = JSON.parse(read('tools/fixtures/reader-control-search-results-clip-live-20260906.json'));
assert.equal(fixture.fileKey, 'klhs2jMM4MncaJFqZMfqEK');
const source = key => fixture.sources.find(s => s.key === key);
const text = key => source(key).result.content.map(block => block.text).join('\n');
const searchMotion = JSON.parse(text('searchMotion')).nodes;
const settingsMotion = JSON.parse(text('settingsMotion')).nodes;
assert.equal(searchMotion.length, 9);
assert.equal(settingsMotion.length, 44);
assert.match(text('searchMetadata'), /id="1938:5085"[^>]*x="14" y="58" width="336" height="665"/);
assert.match(text('searchMetadata'), /id="1938:5086"[^>]*x="1" y="1"/);
assert.match(text('searchMetadata'), /id="1938:5101"[^>]*x="0" y="51"/);
assert.match(text('settingsDesign'), /data-node-id="1692:3684"/);
const seen = new Set();
function track(nodes, id, property, p) {
  const node = nodes.find(n => n.nodeId === id);
  assert.ok(node, id);
  seen.add(id);
  const css = node.codeSnippets.css;
  const key = id.replace(':', '_');
  const start = css.indexOf('@keyframes kf_' + key + '_' + property + '_0');
  assert.ok(start >= 0, id + '/' + property);
  const end = css.indexOf('@keyframes', start + 1);
  const body = css.slice(start, end < 0 ? undefined : end);
  const at = pct => {
    const match = body.match(new RegExp('(?:^|\\s)' + pct + '% \\{ ([^}]+)\\}'));
    assert.ok(match, id + ' ' + pct + '%');
    const value = match[1].match(new RegExp(property + ': ([^;]+);'))?.[1];
    assert.ok(value);
    return value.split(' ').map(Number.parseFloat);
  };
  const a = at(0), b = at(100);
  return a.map((v, i) => v + (b[i] - v) * p);
}
const near = (a, b, why = '') => assert.ok(Math.abs(a - b) < 1e-8, why + ': ' + a + ' != ' + b);
const points = [0, .1, .25, .5, .731, .9, 1];
const queryParent = clipFixture.nodes.find(n => n.id === '1938:5088');
const resultsParent = clipFixture.nodes.find(n => n.id === '1938:5101');
const firstResultActor = clipFixture.nodes.find(n => n.id === '1939:382');
assert.equal(clipFixture.fileKey, fixture.fileKey);
assert.equal(queryParent.strokeBottomWeight, 1);
assert.equal(queryParent.strokeAlign, 'INSIDE');
assert.equal(queryParent.y + queryParent.height, resultsParent.y);
assert.equal(resultsParent.clipsContent, true);
assert.equal(resultsParent.overflowDirection, 'VERTICAL');
assert.equal(firstResultActor.parentId, resultsParent.id);
assert.match(text('searchSheetDesign'), /px-\[10px\] py-\[5px\]/,
  'Results source contains distinct horizontal and vertical inner padding');
assert.deepEqual(sampleReaderControlSearch(1, 338, 666).results,
  { x: 2, y: 53, width: 334, height: 612, opacity: 1 },
  'canonical Full uses the real Results parent, not the old first-row viewport');
assert.equal(searchMotion.some(n => n.nodeId === resultsParent.id || n.nodeId === queryParent.id), false,
  'the clipped Results parent and Query border have no authored motion');
for (const p of points) {
  const f = sampleReaderControlSearch(p, 286 + 52 * p, 190 + 476 * p);
  const shell = track(searchMotion, '1938:5074', 'translate', p);
  near(f.queryDivider.y - (f.field.y + f.field.height), 5 + 4 * p,
    'PH50 Query bottom stays adjacent to the actual field in both forms');
  near(f.queryDivider.y + f.queryDivider.height, f.results.y,
    'inside Query bottom border ends where the clipped Results viewport begins');
  const motion = track(searchMotion, firstResultActor.id, 'translate', p);
  const sourceResultsY = 2 + 28.443 * (1 - p) + resultsParent.y;
  near(f.results.y + f.firstResult.y, sourceResultsY + firstResultActor.y + motion[1],
    'viewport adaptation preserves the authored first result screen path');
  near(f.firstResult.x, firstResultActor.x + motion[0]);
}
for (const p of points) {
  const width = 286 + 52 * p, height = 190 + 476 * p;
  const f = sampleReaderControlSearch(p, width, height);
  const shell = track(searchMotion, '1938:5074', 'translate', p);
  const field = track(searchMotion, '1939:346', 'translate', p);
  const local = readerControlSearchSourceField(p);
  near(local.x, 10 + field[0]); near(local.y, 9 + field[1]);
  near(local.width, track(searchMotion, '1939:346', 'width', p)[0]);
  near(local.height, track(searchMotion, '1939:346', 'height', p)[0]);
  // Compare two independent coordinate chains: actual Stage + production slot
  // versus the archived source shell + Viewport + Section + actor local track.
  near(13 + 13 + f.field.x, 13 + shell[0] + 14 + 1 + 10 + field[0], 'field screen X');
  near(89 + 406 * (1 - p) + 29 + 28 * p + f.field.y,
    89 + shell[1] + 58 + 1 + 9 + field[1], 'field screen Y');
  const action = track(searchMotion, '1939:365', 'translate', p);
  near(26 + f.action.x, 13 + shell[0] + 15 + 292 + action[0]);
  near(f.action.width, track(searchMotion, '1939:365', 'width', p)[0]);
  near(f.action.height, track(searchMotion, '1939:365', 'height', p)[0]);
  for (const [index, id, y] of [[0, '1939:382', 5], [1, '1939:399', 77]]) {
    const row = readerControlSearchSourceResult(index, p);
    const translate = track(searchMotion, id, 'translate', p);
    near(row.x, 10 + translate[0]); near(row.y, y + translate[1]);
    near(row.width, track(searchMotion, id, 'width', p)[0]);
    near(row.height, track(searchMotion, id, 'height', p)[0]);
    near(26 + f.results.x + f.firstResult.x,
      13 + shell[0] + 14 + 1 + 10 + translate[0], 'row screen X retains the Results and row parents');
    near(89 + 406 * (1 - p) + 29 + 28 * p + f.results.y + f.firstResult.y + index * f.rowHeight,
      89 + shell[1] + 58 + 1 + 51 + y + translate[1], 'real rows share exact spacing');
  }
  near(readerControlSearchSourceResult(100, p).y - readerControlSearchSourceResult(0, p).y,
    100 * f.rowHeight, 'dynamic results extend the real row layout, not two fake actors');
  near(89 + 406 * (1 - p) + 29 + 28 * p + f.back.y,
    536.99 + track(searchMotion, '1938:5545', 'translate', p)[1], 'screen sibling Back');
  near(f.back.opacity, track(searchMotion, '1938:5545', 'opacity', p)[0]);
  assert.deepEqual(sampleReaderControlSearch(p, width, height), f, 'reverse/regrab uses the same pose');

  const title = readerControlSettingsScreenTitle(p);
  near(title.y, 9 * p, 'settings title follows the repaired compact-to-full lane');
  near(title.opacity, track(settingsMotion, '1692:3685', 'opacity', p)[0]);
  for (const [i, labelId, barId, firstChoice, count] of [
    [0, '1692:3686', '1692:3687', 3688, 3],
    [1, '1692:3691', '1692:3692', 3693, 5],
    [2, '1692:3698', '1692:3699', 3700, 5],
  ]) {
    const label = readerControlSettingsLabel(i, p);
    const labelT = track(settingsMotion, labelId, 'translate', p);
    near(label.x, labelT[0]);
    near(label.y, 18 + 19 * p + (54 + 18 * p) * i, 'settings labels stay below the title lane');
    for (const prop of ['width', 'height']) near(label[prop], track(settingsMotion, labelId, prop, p)[0]);
    const bar = readerControlSettingsBar(i, p, width);
    const barT = track(settingsMotion, barId, 'translate', p);
    near(bar.x, barT[0]);
    near(bar.y, 35 + 26 * p + (54 + 18 * p) * i, 'settings bars stay below their labels');
    for (const prop of ['width', 'height']) near(bar[prop], track(settingsMotion, barId, prop, p)[0]);
    for (let c = 0; c < count; c++) {
      const id = '1692:' + (firstChoice + c);
      const choice = readerControlSettingsChoice(count, c, p, bar.width);
      const translate = track(settingsMotion, id, 'translate', p);
      const x = count === 3 ? [3, 104.66, 206.32][c] : 3 + 61 * c;
      near(choice.x, x + translate[0]); near(choice.y, 3 + translate[1]);
      near(choice.width, track(settingsMotion, id, 'width', p)[0]);
      near(choice.height, track(settingsMotion, id, 'height', p)[0]);
    }
  }
  for (const [name, groupId, start, baseY, count] of [
    ['status', '1692:3952', 3953, 263, 3],
    ['typography', '1692:3997', 3998, 394, 2],
    ['control', '1692:4032', 4033, 525, 3],
  ]) {
    const group = readerControlSettingsAddedGroup(name, p, width);
    near(group.y, baseY + track(settingsMotion, groupId, 'translate', p)[1]);
    near(group.opacity, track(settingsMotion, groupId, 'opacity', p)[0]);
    for (let c = 0; c < count + 2; c++) {
      const kind = c === 0 ? 'divider' : c === 1 ? 'title' : 'row';
      const index = Math.max(0, c - 2);
      const baseChildY = c === 0 ? 0 : c === 1 ? 21 : 43 + 38 * index;
      const id = '1692:' + (start + c);
      const child = readerControlSettingsAddedChild(kind, index, p, group.width);
      near(child.y, baseChildY + track(settingsMotion, id, 'translate', p)[1]);
      near(child.opacity, track(settingsMotion, id, 'opacity', p)[0]);
      near(group.opacity * child.opacity, p * p, 'parent + child alpha retained');
      near(group.y + child.y, baseY + baseChildY +
        track(settingsMotion, groupId, 'translate', p)[1] +
        track(settingsMotion, id, 'translate', p)[1], 'both ancestor translations retained');
    }
  }
}
assert.equal(seen.size, 43, '6 Search source actors incl shell + all 37 Settings content actors');
// Shared Stage owns the 7 remaining Settings root/shell/viewport/brightness/nav
// tracks and Search's header/brightness/nav; this test does not claim them.
for (const p of points) {
  const w = 220 + 52 * p;
  const search = sampleReaderControlSearch(p, w, 160);
  assert.ok(search.field.width >= 0 && search.results.height >= 0);
  assert.ok(search.action.x + search.action.width <= w, 'narrow width reflows instead of text scaling');
  const bar = readerControlSettingsBar(0, p, w);
  const last = readerControlSettingsChoice(3, 2, p, bar.width);
  assert.ok(last.x + last.width <= bar.width);
}

const searchUI = read('entry/src/main/ets/features/reading/ReaderControlSearchContent.ets');
const settingsUI = read('entry/src/main/ets/features/reading/ReaderControlSettingsContent.ets');
for (const ui of [searchUI, settingsUI]) {
  assert.doesNotMatch(ui, /animateTo\(|\.animation\(|setInterval\(|\.scale\(/);
  assert.doesNotMatch(ui, /Reader(?:Search|Settings)FullPanel\(/);
  assert.doesNotMatch(ui, /private get /, 'ArkUI component state must use actual methods');
  assert.match(ui, /@Prop(?: @Watch\('(?:onResultLayoutChanged|onMotionChanged)'\))? motionProgress: number/);
}
assert.equal((searchUI.match(/TextInput\(\{/g) ?? []).length, 1, 'one real input across morph');
assert.equal((searchUI.match(/List\(\{ space: 0, scroller: this\.resultScroller \}\)/g) ?? []).length, 1);
assert.doesNotMatch(searchUI, /Scroll\(this\.resultScroller\)/);
assert.equal((searchUI.match(/setTimeout\(/g) ?? []).length, 1,
  'one coalesced native-layout admission timer, not an independent animation clock');
assert.match(searchUI, /this\.resultNativeFollowTimer = setTimeout\([\s\S]*?\}, 0\);/);
assert.doesNotMatch(settingsUI, /setTimeout\(/);
assert.match(searchUI, /onEditChange\(\(editing: boolean\): void => this\.onTemporaryLayerChange\(editing\)\)/);
assert.match(searchUI, /@Watch\('dismissTemporaryLayer'\)/);
assert.match(searchUI, /\.stopEditing\(\)/);
assert.match(searchUI, /\.fontColor\(TOK_DANGER\)/, 'match highlight uses the restored danger token');
assert.doesNotMatch(searchUI, /reader_directory_input_search/,
  'PH91 removes the redundant search icon inside the text field');
assert.equal((settingsUI.match(/Scroll\(this\.scroller\)/g) ?? []).length, 1);
assert.match(settingsUI, /\.height\(this\.scrollContentHeight\(\)\)/);
assert.match(settingsUI, /\.translate\(\{ y: this\.sharedScrollTranslation\(\) \}\)/);
assert.match(settingsUI, /\.translate\(\{ y: this\.fullOnlyScrollTranslation\(\) \}\)/);
assert.match(settingsUI, /\.onDidScroll\(\(\): void => this\.onFullDidScroll\(\)\)/);
assert.match(settingsUI, /\.opacity\(this\.group\(group\)\.opacity \* this\.presentation\(\)\.contentOpacity\)/,
  'settings groups remain mounted and follow the shared expansion opacity');
assert.doesNotMatch(settingsUI, /\.renderGroup\(true\)/,
  'dynamic settings content must not use an off-screen renderGroup cache');
assert.doesNotMatch(settingsUI, /\.visibility\(this\.p\(\) === 0 \? Visibility\.Hidden/,
  'settings groups must not mount/unmount at the expansion endpoint');
assert.match(settingsUI, /\.hitTestBehavior\(this\.p\(\) > 0 \? HitTestMode\.Default : HitTestMode\.None\)/,
  'hidden settings groups stay mounted but inert');
assert.match(settingsUI, /ReaderControlSwitchTrack\(\{ value: this\.toggleValue\(key\) \}\)/);
assert.match(settingsUI, /this\.onJustifyTextChange\(!this\.justifyText\)/);
assert.equal((settingsUI.match(/Row\(\{ space: 20 \}\)/g) ?? []).length, 2,
  'toggle text 244 + 20 gap + 44 track matches the 308vp source row');

function method(src, name) {
  const start = src.indexOf('  private ' + name + '(');
  assert.ok(start >= 0, name);
  const open = src.indexOf('{', start);
  let depth = 1, end = open + 1;
  while (depth && end < src.length) {
    if (src[end] === '{') depth++;
    if (src[end] === '}') depth--;
    end++;
  }
  return src.slice(start, end);
}
const settingsMethods = ['groupOptions', 'groupLabel', 'optionLabel', 'isSegmentActive',
  'isSegmentAvailable', 'segmentAccessibilityText', 'handleSegment', 'toggleValue', 'toggleAccessibilityText',
  'handleToggle', 'handleJustify'];
const settingsConstants = new Function(stripTypeScriptTypes(
  [...settingsUI.matchAll(/^const SETTINGS_\w+[^\n]+/gm)].map(m => m[0]).join('\n')) +
  '; return { SETTINGS_DIRECTION_OPTIONS, SETTINGS_PAGE_OPTIONS, SETTINGS_TIMEOUT_OPTIONS };')();
const Settings = new Function(...Object.keys(settingsPolicy),
  ...Object.keys(settingsConstants),
  stripTypeScriptTypes('class Probe { ' + settingsMethods.map(n => method(settingsUI, n)).join('\n') + ' }') +
  '; return Probe;')(...Object.values(settingsPolicy), ...Object.values(settingsConstants));
const settings = new Settings();
const calls = [];
Object.assign(settings, { snapshot: settingsPolicy.createDefaultReaderSettingsSnapshot(),
  interactionEnabled: true, pageTurnSimulationAvailable: true,
  onScreenDirectionChange: value => calls.push(['direction', value]),
  onPageTurnStyleChange: value => calls.push(['pageTurn', value]),
  onScreenTimeoutChange: value => calls.push(['timeout', value]) });
assert.deepEqual(settings.groupOptions('pageTurn'), ['cover', 'slide', 'simulation', 'scroll', 'none'],
  'source ordering, not legacy Full wrong ordering');
for (const group of ['direction', 'pageTurn', 'timeout']) {
  for (const option of settings.groupOptions(group)) {
    const before = calls.length;
    settings.handleSegment(group, option);
    assert.equal(calls.length, before + (settings.isSegmentAvailable(group, option) ? 1 : 0));
  }
}
settings.pageTurnSimulationAvailable = false;
const before = calls.length;
settings.handleSegment('pageTurn', 'simulation');
assert.equal(calls.length, before, 'capability-gated simulation cannot leak a callback');
settings.interactionEnabled = false;
settings.handleSegment('pageTurn', 'slide');
assert.equal(calls.length, before);
const toggles = [], justify = [];
Object.assign(settings, { interactionEnabled: true, justifyText: true, p: () => 1,
  onToggleChange: (key, value) => toggles.push([key, value]),
  onJustifyTextChange: value => justify.push(value) });
const originalSnapshot = structuredClone(settings.snapshot);
for (const key of ['hideNavigationBar', 'extendIntoCutout', 'alignPageBottom',
  'volumeKeysTurnPage', 'stopTtsOnScreenOff', 'longPressSelectText']) {
  settings.handleToggle(key);
  assert.deepEqual(toggles.at(-1), [key, !settings.snapshot[key]]);
}
assert.deepEqual(settings.snapshot, originalSnapshot, 'content dispatches without owning/persisting state');
settings.handleToggle('justifyText'); assert.equal(toggles.length, 6, 'no second justification owner');
settings.handleJustify(); assert.deepEqual(justify, [false], 'Appearance owns justification');
settings.p = () => 0; settings.handleToggle('extendIntoCutout'); settings.handleJustify();
assert.equal(toggles.length, 6); assert.deepEqual(justify, [false], 'hidden AddedModules reject input');
settings.p = () => 1; settings.interactionEnabled = false;
settings.handleToggle('extendIntoCutout'); settings.handleJustify();
assert.equal(toggles.length, 6); assert.deepEqual(justify, [false]);
const Search = new Function(stripTypeScriptTypes('class Probe {' +
  ['canSearch', 'submit', 'statusText', 'dismissTemporaryLayer', 'onInputChanged'].map(n =>
    method(searchUI, n)).join('\n') + '}') + ';return Probe;')();
const search = new Search(); let submit = 0, stopped = 0;
Object.assign(search, { query: ' 雨夜 ', interactionEnabled: true, state: { kind: 'idle' },
  onSearch: () => submit++, inputController: { stopEditing() { stopped++; } },
  onResultLayoutChanged() {},
  onTemporaryLayerChange: active => assert.equal(active, false) });
search.submit(); assert.equal(submit, 1);
search.state = { kind: 'loading', keyword: '雨夜' }; search.submit(); assert.equal(submit, 1);
assert.equal(search.statusText(), '正在搜索…');
search.state = { kind: 'error', message: '网络错误' }; assert.equal(search.statusText(), '网络错误');
search.state = { kind: 'empty', keyword: '雨夜' }; assert.equal(search.statusText(), '未找到“雨夜”');
search.interactionEnabled = false; search.onInputChanged(); assert.equal(stopped, 1);
search.submit(); assert.equal(submit, 1);
const resultState = { kind: 'results', keyword: '雨夜', results: [{ chapterIndex: 9, chapterOffset: 40 }] };
const scroller = { x: 0, y: 108 };
Object.assign(search, { state: resultState, resultScroller: scroller });
search.onInputChanged();
assert.equal(search.query, ' 雨夜 ');
assert.equal(search.state, resultState, 'morph input protection does not replace query/results');
assert.equal(search.resultScroller, scroller, 'keyboard dismissal never recreates/reset the result Scroller');
assert.deepEqual(scroller, { x: 0, y: 108 });
// Full event/receipt ownership and 50/2000/10000-row native-range regressions
// now live in test-reader-content-search-native-list.mjs. The semantic Scroll
// policy retains its independent tests; Scroll-specific min-extent assumptions
// are replaced by the actual normalized List bindings below.
assert.match(searchUI, /\.childrenMainSize\(this\.resultItemSizes\)\.cachedCount\(READER_SEARCH_LIST_CACHE_COUNT, true\)/);
assert.match(searchUI, /\.height\(this\.resultListFrame\(\)\.viewportHeightVp\)/);
assert.match(searchUI, /\.contentEndOffset\(this\.resultListFrame\(\)\.contentEndOffsetVp\)/);
assert.match(searchUI, /offsetRemain: this\.onResultWillScroll\(offset, source\)\.yOffset/);
assert.match(searchUI, /\.onDidScroll\([^\n]+this\.onResultDidScroll\(\)/);
assert.match(searchUI, /\.edgeEffect\(EdgeEffect\.None\)/);
if (readerBuilderSdkAvailable) {
  function checkMountedInputInsets(source) {
    const { owner } = createReaderBuilderProbe(source, ['frame', 'searchField', 'presentation'], { sampleReaderControlSearch, ...motionDeps });
    Object.assign(owner, { motionProgress: 0, availableWidth: 286, availableHeight: 190, query: '', inputController: {} });
    owner.searchField();
    const input = [...owner.nodes.values()].find(node => node.type === 'TextInput');
    for (const p of [0, .5, 1, 0]) {
      Object.assign(owner, { motionProgress: p, availableWidth: 286 + 52 * p,
        availableHeight: 190 + 476 * p, query: '他' }); owner.replay();
      assert.deepEqual(input.padding, { left: 2, right: 2, top: 0, bottom: 0 },
        'compact input explicitly clears both native vertical content insets');
      assert.equal(input.create.text, '他', 'same native input receives current query');
      assert.equal(input.fontSize, 10); assert.equal(input.height, 14);
      assert.ok(input.height <= owner.frame().field.height, 'text line stays inside the authored field at every p');
      assert.ok(input.height - input.padding.top - input.padding.bottom >= input.fontSize,
        'declared content box is not exhausted by vertical padding; native glyph visibility still needs validation');
    }
  }
  checkMountedInputInsets(searchUI);
  assert.throws(() => checkMountedInputInsets(searchUI.replace(
    '.padding({ left: 2, right: 2, top: 0, bottom: 0 })', '.padding({ left: 2, right: 2 })')),
  /compact input explicitly/, 'reject returning to unspecified platform vertical padding');
  assertSearchListBuilderGeometry(searchUI);
  console.log('Actual SDK normalized List: parent clip, authored child origin, extent, same-instance roundtrip PASS');
  const searchMembers = ['frame', 'resultRow', 'resultSnippet', 'resultTitle', 'currentResult', 'currentResultIndex',
    'currentSnippet', 'selectCurrentResult', 'presentation', 'resultClip', 'resultScrollFrame', 'resultLayout'];
  function checkMountedSearchResults(source, frozen = false) {
    const { owner } = createReaderBuilderProbe(source, searchMembers, { sampleReaderControlSearch, splitReaderSearchSnippet, ...searchScroll, ...motionDeps });
    const result = { sourceId: 's', bookId: 'b', chapterIndex: 9, chapterOffset: 2, chapterTitle: '旧标题', snippet: '甲乙他旧',
      snippetStart: 0, matchLength: 1 };
    Object.assign(owner, { motionProgress: 0, availableWidth: 286, availableHeight: 190,
      ...motionProps, resultScrollPosition: searchScroll.createReaderControlSearchScroll(),
      interactionEnabled: true, state: { kind: 'results', keyword: '他', results: [result] } });
    const selected = []; owner.onSelectResult = value => selected.push(value);
    if (frozen) owner.resultRow(9, 2, result.sourceId, result.bookId, result);
    else owner.resultRow(9, 2, result.sourceId, result.bookId);
    const row = owner.nodes.get(0), click = row.onClick;
    assert.equal(owner.nodes.get(1).create, '旧标题');
    const next = { ...result, chapterTitle: '新标题', snippet: '甲乙他新尾' };
    owner.state = { kind: 'results', keyword: '他', results: [next] };
    for (const p of [1, .5, 0, .25, 1]) {
      Object.assign(owner, { motionProgress: p, availableWidth: 286 + 52 * p, availableHeight: 190 + 476 * p });
      owner.replay();
      assert.equal(owner.nodes.get(1).create, '新标题', 'same-key replacement updates mounted title');
      assert.deepEqual([...owner.nodes.values()].filter(n => n.type === 'Span').map(n => n.create), ['甲乙', '他', '新尾']);
      assert.equal(row.height, 54 + 18 * p, 'mounted result row uses live shared p');
      assert.equal(row.width, owner.frame().firstResult.width);
    }
    click(); assert.equal(selected.at(-1), next, 'retained click selects current result payload');
    owner.interactionEnabled = false; click(); assert.equal(selected.length, 1);
    owner.interactionEnabled = true; owner.state = { kind: 'loading', keyword: '他' };
    owner.replay(); click(); assert.equal(selected.length, 1, 'removed/invalidated result cannot dispatch stale selection');
  }
  checkMountedSearchResults(searchUI);
  const staleSearch = searchUI
    .replace("private resultRow(chapterIndex: number, chapterOffset: number, sourceId: string = '', bookId: string = '')",
      "private resultRow(chapterIndex: number, chapterOffset: number, sourceId: string = '', bookId: string = '', capturedResult: ReadingContentSearchResult)")
    .replace('Text(this.resultTitle(this.currentResult(chapterIndex, chapterOffset)))', 'Text(this.resultTitle(capturedResult))');
  assert.notEqual(staleSearch, searchUI);
  assert.throws(() => checkMountedSearchResults(staleSearch, true), /same-key replacement/,
    'SDK-mounted observer regression rejects an old ForEach result object captured by value');

  // Settings Builder args are already stable group/key/index identities. Do
  // not rewrite them: prove their current owner reads remain live in the SDK.
  const settingsBuilderMembers = ['p', 'geometry', 'groupWidth', 'label', 'bar', 'choice', 'optionModifier', 'child', 'segmentRow', 'toggleRow',
    'presentation', 'sharedRect', 'sharedClip', ...settingsMethods];
  let geometrySamples = 0, paintSamples = 0;
  const { owner } = createReaderBuilderProbe(settingsUI, [...new Set(settingsBuilderMembers)], {
    ReaderControlSettingsOptionModifier: productionSettingsOptionModifier(),
    ...settingsPolicy, ...settingsConstants, ...motionDeps, readerControlUnit, readerControlSettingsLabel, readerControlSettingsBar,
    sampleReaderControlSettings: (...args) => { geometrySamples++; return sampleReaderControlSettings(...args); },
    sampleReaderControlMotionPresentation: (...args) => { paintSamples++; return presentation.sampleReaderControlMotionPresentation(...args); },
    readerControlSettingsChoice, readerControlSettingsAddedChild });
  Object.assign(owner, { motionProgress: 0, availableWidth: 286, interactionEnabled: true,
    ...motionProps, optionModifiers: [], clipEndpointWidth: -1, clipFullRects: [], clipQuickRects: [],
    clipCache: new presentation.ReaderControlMotionClipCache(path => new motionDeps.PathShape().commands(path), () => new motionDeps.RectShape().width('100%').height('100%')), snapshot: settingsPolicy.createDefaultReaderSettingsSnapshot(), pageTurnSimulationAvailable: true });
  owner.segmentRow('pageTurn', 1); owner.toggleRow('拓展到刘海', 'extendIntoCutout', 0);
  assert.equal(geometrySamples, 1, 'all mounted actor attributes share one pose');
  assert.equal(paintSamples, 1, 'all mounted paint attributes share one presentation');
  const label = owner.nodes.get(0);
  const choices = [...owner.nodes.values()].filter(n => n.type === 'Text' && ['覆盖', '滑动', '仿真', '滚动', '无动画'].includes(n.create));
  assert.equal(choices.length, 5);
  const changes = []; owner.onToggleChange = (...args) => changes.push(args);
  const toggleClick = [...owner.nodes.values()].find(n => n.accessibilityText?.startsWith('拓展到刘海')).onClick;
  for (const p of [1, .25, 0, .5, 1]) {
    const samplesBefore = geometrySamples, paintBefore = paintSamples;
    Object.assign(owner, { motionProgress: p, availableWidth: 286 + 52 * p,
      snapshot: { ...owner.snapshot, pageTransition: 'cover', extendIntoCutout: true }, pageTurnSimulationAvailable: false });
    owner.replay();
    assert.equal(geometrySamples, samplesBefore + 1, 'one new pose per changed progress/width');
    assert.equal(paintSamples, paintBefore + 1, 'one paint sample per changed progress');
    const pose = owner.geometry();
    owner.replay();
    assert.equal(owner.geometry(), pose, 'same pose retains identity across observer replay');
    assert.equal(geometrySamples, samplesBefore + 1);
    assert.deepEqual(pose.labels, [0, 1, 2].map(i => readerControlSettingsLabel(i, p)));
    assert.deepEqual(pose.bars, [0, 1, 2].map(i => readerControlSettingsBar(i, p, owner.availableWidth)));
    for (const group of ['direction', 'pageTurn', 'timeout']) {
      const count = owner.groupOptions(group).length;
      for (let i = 0; i < count; i++) assert.deepEqual(owner.choice(group, 1, i),
        readerControlSettingsChoice(count, i, p, pose.bars[1].width));
    }
    assert.deepEqual(label.position, { x: owner.label(1).x, y: owner.label(1).y });
    assert.equal(label.height, owner.label(1).height);
    assert.equal(choices.find(n => n.create === '仿真').enabled, false, 'live capability change updates the mounted option');
    assert.equal(choices.find(n => n.create === '覆盖').backgroundColor, '#BDFFFCF8');
    assert.equal(choices.find(n => n.create === '滑动').backgroundColor, 'Color.Transparent', 'selected option follows live V4 snapshot');
    assert.equal([...owner.children.values()][0].params.value, true, 'current snapshot reaches the same switch child');
  }
  const lastPose = owner.geometry(), beforeWidth = geometrySamples, beforeWidthPaint = paintSamples;
  owner.availableWidth += 27; owner.replay();
  assert.notEqual(owner.geometry(), lastPose, 'width change at constant progress invalidates geometry');
  assert.equal(geometrySamples, beforeWidth + 1); assert.equal(paintSamples, beforeWidthPaint);
  owner.fullViewportHeight -= 80; owner.scrollMotion.fullScrollOffset = 170; owner.replay();
  assert.equal(geometrySamples, beforeWidth + 1, 'viewport and scrolling remain live without resampling unrelated actors');
  assert.deepEqual(label.clipShape.path, owner.sharedClip(1, false).path,
    'clip still reflects the current viewport, scrolling and density outside the actor cache');
  toggleClick(); owner.snapshot = { ...owner.snapshot, extendIntoCutout: false }; owner.replay(); toggleClick();
  assert.deepEqual(changes, [['extendIntoCutout', false], ['extendIntoCutout', true]], 'retained Settings click uses latest snapshot');
  console.log('Actual SDK Search/Settings mounted Builder observers: live payload/geometry/capability/switch changes PASS');
} else console.log('Mounted Builder SDK regression SKIP: ETS loader unavailable');
console.log('PASS Search/Settings real actor geometry + production callback methods; not native/visual acceptance');
