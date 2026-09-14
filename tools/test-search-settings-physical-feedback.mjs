import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { readerAppColor, READER_THEME_DEFINITIONS } from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import * as style from '../entry/src/main/ets/features/reading/ReaderControlAppearanceStyle.ts';
import { createDefaultReaderAppearanceSnapshot, setReaderAppearanceTheme, setReaderAppearanceDayTheme,
  setReaderAppearanceNightTheme } from '../entry/src/main/ets/features/reading/ReaderAppearanceState.ts';
import { sampleReaderControlAppearance } from '../entry/src/main/ets/features/reading/ReaderControlAppearanceGeometry.ts';

const base = process.env.READER_FEEDBACK_SOURCE_ROOT ?? fileURLToPath(new URL('../', import.meta.url));
const path = value => resolve(base, 'entry/src/main/ets', value);
const read = value => readFileSync(path(value), 'utf8');
const require = createRequire(import.meta.url);
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const syntax = require(`${sdk}/lib/validate_ui_syntax.js`);
const builders = require(`${sdk}/lib/component_map.js`).CUSTOM_BUILDER_METHOD;
function registerBuilders(source) { for (const m of source.matchAll(/@Builder\s+(?:private\s+)?(\w+)\s*\(/g)) builders.add(m[1]); }
class NativeChild {
  constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); }
}
for (const [name, file] of [['CategoryRow', 'features/settings/CategoryRow.ets'], ['PageBackBar', 'features/common/PageBackBar.ets'], ['MainTabBar', 'features/shell/MainTabBar.ets'], ['ReaderToggle', 'features/common/ReaderToggle.ets']]) {
  syntax.componentCollection.customComponents.add(name);
  syntax.propCollection.set(name, new Set([...read(file).matchAll(/@Prop\s+(\w+)\s*:/g)].map(m => m[1])));
  if (name === 'CategoryRow') syntax.builderParamObjectCollection.set(name, new Set(['content']));
}
const results = [];
async function check(name, body) {
  try { await body(); results.push({ name, status: 'PASS' }); }
  catch (error) { results.push({ name, status: 'FAIL', message: error.stack }); }
}
await check('PH24 native loading indicator preserves 13/36 sizes and responds without remounting', () => {
  const source = read('features/search/SearchSpinner.ets');
  for (const [diameter, light] of [[13, true], [36, false]]) {
    const { owner } = createReaderBuilderProbe(source, ['build', ...(source.includes('private shouldAnimate') ? ['shouldAnimate'] : [])]);
    Object.assign(owner, { active: true, foreground: true, reduceMotion: false, diameter, light, appThemeScheme: 'day' });
    owner.initialRender();
    const node = [...owner.nodes.values()].find(n => n.type === 'LoadingProgress');
    assert.ok(node, 'restore the earlier production native indicator');
    assert.equal(node.width, diameter); assert.equal(node.height, diameter);
    assert.equal(node.color, readerAppColor(light ? 'TOK_ON_PRIMARY' : 'TOK_GREEN', 'day'));
    assert.equal(node.enableLoading, true);
    for (const flags of [{ active: false, foreground: true, reduceMotion: false },
      { active: true, foreground: false, reduceMotion: false }, { active: true, foreground: true, reduceMotion: true },
      { active: true, foreground: true, reduceMotion: false }]) {
      Object.assign(owner, flags); owner.replay();
      assert.equal(node.enableLoading, flags.active && flags.foreground && !flags.reduceMotion);
    }
    assert.equal(owner.nodes.size, 2);
  }
});
await check('PH37 four Toggle states retain geometry, track role, click and thumb position', () => {
  const { owner } = createReaderBuilderProbe(read('features/common/ReaderToggle.ets'), ['build']);
  let taps = 0;
  Object.assign(owner, { appThemeScheme: 'day', value: false, radius: 999, onToggle: () => taps++ });
  owner.initialRender();
  const track = [...owner.nodes.values()].find(n => n.type === 'Stack');
  const thumb = [...owner.nodes.values()].find(n => n.type === 'Text');
  for (const scheme of ['day', 'night']) for (const value of [false, true]) {
    Object.assign(owner, { appThemeScheme: scheme, value }); owner.replay();
    assert.equal(track.backgroundColor, readerAppColor(value ? 'TOK_PRIMARY_DARK' : 'app.toggle.offTrack', scheme));
    assert.equal(track.width, 44); assert.equal(track.height, 24);
    assert.equal(thumb.position.x, value ? 22 : 2); assert.equal(thumb.width, 20);
    track.onClick();
  }
  assert.equal(taps, 4);
});
await check('PH7 real theme actions signal accepted defaults and reject wrong day/night type explicitly', () => {
  const source = read('features/reading/ReaderControlAppearanceContent.ets');
  const { owner } = createReaderBuilderProbe(source, ['themeAction', ...(source.includes('private defaultThemeActionLabel') ? ['defaultThemeActionLabel', 'requestDefaultTheme'] : [])], style);
  const notices = [], requests = [];
  Object.assign(owner, { snapshot: createDefaultReaderAppearanceSnapshot(), appThemeScheme: 'day', motionProgress: 1,
    fullInput: () => true, frame: () => sampleReaderControlAppearance(1, 338, 666), actorPosition: a => ({ x: a.x, y: a.y }),
    presentation: () => ({ contentOpacity: 1, contentBlur: 0 }),
    getUIContext: () => ({ getPromptAction: () => ({ showToast: notice => notices.push(notice.message) }) }),
    onSetDayTheme: id => { requests.push(id); owner.snapshot = setReaderAppearanceDayTheme(owner.snapshot, id); },
    onSetNightTheme: id => { requests.push(id); owner.snapshot = setReaderAppearanceNightTheme(owner.snapshot, id); },
  });
  owner.themeAction(true); owner.themeAction(false);
  const [day, night] = [...owner.nodes.values()].filter(n => n.type === 'Text');
  assert.equal(day.create, '已设为日间');
  owner.snapshot = setReaderAppearanceTheme(owner.snapshot, 'warm'); owner.replay();
  assert.equal(day.create, '设为日间主题'); day.onClick(); owner.replay();
  assert.equal(owner.snapshot.dayTheme, 'warm'); assert.equal(day.create, '已设为日间');
  night.onClick(); assert.equal(notices.at(-1), '请先选择夜间阅读主题'); assert.equal(requests.length, 1);
  owner.snapshot = setReaderAppearanceTheme(owner.snapshot, 'paperNight'); owner.replay(); night.onClick(); owner.replay();
  assert.equal(owner.snapshot.nightTheme, 'paperNight'); assert.equal(night.create, '已设为夜间');
  day.onClick(); assert.equal(notices.at(-1), '请先选择日间阅读主题'); assert.equal(requests.length, 2);
  owner.fullInput = () => false; night.onClick(); assert.equal(requests.length, 2, 'morphing cannot dispatch default updates');
});
await check('PH67 SDK previews use four approved light bases and retain four original night bases', () => {
  const reference = JSON.parse(readFileSync(new URL('../evidence/2026-09-11-appearance-make-v9/make-v9-reference.json', import.meta.url), 'utf8'));
  const source = read('features/reading/ReaderControlAppearanceContent.ets');
  const { owner } = createReaderBuilderProbe(source, ['themeSwatch'], style);
  Object.assign(owner, { frame: () => sampleReaderControlAppearance(1, 338, 666), snapshot: createDefaultReaderAppearanceSnapshot(),
    appThemeScheme: 'day', themeColor: style.readerControlAppearanceThemeSwatch, themeLabel: style.readerControlAppearanceThemeLabel,
    presentation: () => ({ contentOpacity: 1, contentBlur: 0 }), actorPosition: a => ({ x: a.x, y: a.y }),
    sharedClip: () => 'clip', fullInput: () => true, sharedInput: () => true, onThemeChange() {} });
  const approvedLight = { day: '#F7F3EA', warm: '#F2E8D3', paper: '#EEE4D0', green: '#E3EBDD' };
  READER_THEME_DEFINITIONS.forEach((theme, index) => {
    owner.themeSwatch(theme.id, index);
    const row = [...owner.nodes.values()].filter(n => n.type === 'Row').at(-1);
    const expected = '#FF' + (approvedLight[theme.id] ?? reference.themes.find(value => value.id === theme.id).swatch).slice(1);
    assert.equal(row.backgroundColor, expected);
    assert.equal(row.linearGradient, undefined);
  });
});
await check('PH36 real Index Back returns General to Settings before Bookshelf and preserves overlay priority', () => {
  const Index = productionMotionMethods(path('pages/Index.ets'), ['onBackPress']);
  const owner = Object.assign(new Index(), { route: 'settings', settingsSection: 'general',
    returnToBookshelf: () => { owner.route = 'bookshelf'; },
    sourceSwitchVisible: true, closeSourceSwitch: () => { owner.sourceSwitchVisible = false; } });
  assert.equal(owner.onBackPress(), true); assert.equal(owner.settingsSection, 'general');
  assert.equal(owner.onBackPress(), true); assert.equal(owner.route, 'settings'); assert.equal(owner.settingsSection, 'home');
  assert.equal(owner.onBackPress(), true); assert.equal(owner.route, 'bookshelf');
});
await check('PH34 actual General and Rules Scrolls align short contents at the top', () => {
  for (const file of ['features/shell/SettingsShell.ets', 'features/settings/RulesManagementPage.ets',
    'features/source/SourceToolsPage.ets', 'features/bookshelf/BookshelfManagementPage.ets',
    'features/sync/SyncPage.ets', 'features/rss/RssSubscriptionEditorPage.ets']) {
    const source = read(file); registerBuilders(source);
    for (const m of source.matchAll(/@BuilderParam\s+(\w+)\s*:/g)) builders.add(m[1]);
    const { owner } = createReaderBuilderProbe(source, ['build'], { PageBackBar: NativeChild, ReaderToggle: NativeChild });
    Object.assign(owner, { activeSection: 'general', showOverlay: false, appThemeScheme: 'day',
      contentFrame: () => ({ left: 18, right: 18 }), generalContent() {},
      statusCard() {}, bundleCard() {}, replaceCard() {}, txtTocCard() {}, dictCard() {}, subscriptionCard() {},
      onSectionChange() {}, onBack() {}, snapshot: { mode: 'create', batchCheck: { phase: 'idle' }, editorSourceId: '' },
      batchControlsRenderKey: () => 'idle', batchCard() {}, exportCard() {}, sourceCard() {}, debugCard() {},
      statisticsCard() {}, groupEditorCard() {}, groupsCard() {}, assignmentCard() {}, recordsCard() {},
      backBar() {}, webdavSection() {}, manualActionsSection() {}, autoBackupSection() {}, historySection() {},
      editorField() {}, sectionTitle() {} });
    owner.initialRender();
    const scroll = [...owner.nodes.values()].find(n => n.type === 'Scroll');
    assert.ok(scroll); assert.equal(scroll.align, 'Alignment.TopStart');
  }
});
await check('PH35 real cache action has intrinsic height, bounded width and retained pending/result label', async () => {
  const source = read('features/settings/SettingsPage.ets'); registerBuilders(source);
  const { owner } = createReaderBuilderProbe(source, ['cacheActionRow', 'clearTextCache'], { CategoryRow: NativeChild });
  let resolveClear, calls = 0;
  Object.assign(owner, { appThemeScheme: 'day', cacheActionLabel: '清理文字缓存', cacheCleanupInFlight: false,
    onClearCache: () => { calls++; return new Promise(resolve => { resolveClear = resolve; }); } });
  owner.cacheActionRow();
  const row = [...owner.children.values()][0];
  assert.ok(row); row.params.content();
  const container = [...owner.nodes.values()].find(n => n.type === 'Stack');
  const label = [...owner.nodes.values()].find(n => n.type === 'Text');
  assert.deepEqual(container.constraintSize, { minWidth: 66, maxWidth: '55%', minHeight: 34 });
  assert.equal(container.width, undefined); assert.equal(container.height, undefined);
  assert.equal(label.maxLines, 2); assert.equal(label.textAlign, 'TextAlign.Center');
  row.params.onRowClick(); row.params.onRowClick(); owner.replay();
  assert.equal(calls, 1); assert.equal(label.create, '清理中');
  resolveClear(true); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); owner.replay();
  assert.equal(label.create, '已清理'); assert.equal(owner.cacheCleanupInFlight, false);
  row.params.onRowClick(); resolveClear(false); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); owner.replay();
  assert.equal(label.create, '清理失败');
});
for (const result of results) console.log(JSON.stringify(result));
if (results.some(result => result.status === 'FAIL')) process.exitCode = 1;
else console.log(`search/settings physical feedback production/SDK regression PASS (${results.length} groups); native pixels/device acceptance remain separate.`);
