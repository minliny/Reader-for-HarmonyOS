import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { SurfaceHorizontalFrame, SurfaceWidthSpec, resolveHorizontalFrame } from '../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts';
import { ReaderWindowMetricsSnapshot, ReaderRectVp, ReaderInsetsVp, readerVisualSafeLeft, readerVisualSafeRight,
  readerInteractiveSafeLeft, readerInteractiveSafeRight } from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import { readerAppColor } from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import * as fontFamilies from '../entry/src/main/ets/features/common/ReaderFontFamilies.ts';
const typographySource = readFileSync(new URL('../entry/src/main/ets/features/common/ReaderTypography.ets', import.meta.url), 'utf8');
const TYPE_PAGE_TITLE = new Function(...Object.keys(fontFamilies),
  `${stripTypeScriptTypes(typographySource.replace(/import[\s\S]*?from '[^']+';/g, '').replace(/\bexport /g, ''))}; return TYPE_PAGE_TITLE;`)(...Object.values(fontFamilies));
const file = new URL('../entry/src/main/ets/features/bookshelf/BookshelfSettingsPage.ets', import.meta.url);
const source = readFileSync(file, 'utf8');
const headerSource = readFileSync(new URL('../entry/src/main/ets/features/common/PageBackBar.ets', import.meta.url), 'utf8');
const require = createRequire(import.meta.url);
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const syntax = require(`${sdk}/lib/validate_ui_syntax.js`);
syntax.componentCollection.customComponents.add('PageBackBar');
syntax.propCollection.set('PageBackBar', new Set(['titleColor']));
class Header { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
let activeOwner, activeId;
const Toggle = new Proxy({ name: 'Toggle' }, { get: (target, key) => key === 'name' ? target.name : (...args) => {
  if (key !== 'pop') activeOwner.nodes.get(activeId)[key] = args.length === 1 ? args[0] : args;
} });
let metrics = new ReaderWindowMetricsSnapshot();
const deps = { PageBackBar: Header, Toggle, ToggleType: { Switch: 'switch' },
  ReaderWindowCoordinator: { metrics: () => metrics }, SurfaceHorizontalFrame, SurfaceWidthSpec, resolveHorizontalFrame,
  readerVisualSafeLeft, readerVisualSafeRight, readerInteractiveSafeLeft, readerInteractiveSafeRight,
  TOK_CONTENT_MAX_W_TABLET: 720, TOK_SCREEN_INSET: 19, TOK_SPACE_XS: 8, TOK_SPACE_MD: 16, TYPE_PAGE_TITLE };
const methods = ['build', 'modeOption'];
if (source.includes('private contentFrame(')) methods.push('contentFrame');
const { Component } = createReaderBuilderProbe(source, methods, deps,
  { onObserverEnter(owner, id) { activeOwner = owner; activeId = id; } });
const { Component: HeaderComponent } = createReaderBuilderProbe(headerSource, ['trailing', 'build', 'leftInset', 'rightInset'], deps);
for (const [width, height, left, right] of [[365, 320, 0, 0], [390, 844, 32, 24], [1280, 800, 48, 32]]) {
  metrics = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0, 0, width, height), undefined,
    new ReaderInsetsVp(0, 48, 0, 24), new ReaderInsetsVp(left, 0, right, 0));
  const owner = new Component(); let backs = 0; const updates = [], selections = [];
  Object.assign(owner, { appThemeScheme: 'day', mode: 'cover', error: '', autoCheckUpdate: true,
    readerWindowMetricsRevision: 1, onBack: () => { backs++; }, onAutoCheckUpdate: value => updates.push(value),
    selectMode: value => selections.push(value) });
  owner.initialRender();
  const headers = [...owner.children.values()].filter(child => child instanceof Header);
  assert.equal(headers.length, 1, 'settings must mount the shared PageBackBar, not a private return/text row');
  assert.equal(headers[0].params.title, '书架设置');
  const header = new HeaderComponent(undefined, {});
  Object.assign(header, headers[0].params, { appThemeScheme: 'day', readerWindowMetricsRevision: 1, titleColor: '' });
  header.initialRender();
  const headerNodes = [...header.nodes.values()];
  const hit = headerNodes.find(node => node.type === 'Stack');
  assert.deepEqual([hit.width, hit.height], [44, 44]); hit.onClick(); assert.equal(backs, 1);
  const title = headerNodes.find(node => node.type === 'Text');
  assert.deepEqual([title.fontFamily, title.fontSize, title.lineHeight],
    [TYPE_PAGE_TITLE.fontFamily, TYPE_PAGE_TITLE.fontSizeFp, TYPE_PAGE_TITLE.lineHeightFp]);
  const headerRow = headerNodes.find(node => node.type === 'Row');
  assert.equal(headerRow.height, 58); assert.equal(headerRow.width, '100%');
  assert.deepEqual(headerRow.padding, { left: Math.max(20, left), right: Math.max(20, right) });
  const nodes = [...owner.nodes.values()];
  const root = nodes[0]; assert.equal(root.padding, undefined, 'host alone consumes vertical safe areas');
  const scroll = nodes.find(node => node.type === 'Scroll');
  assert.ok(scroll); assert.equal(scroll.layoutWeight, 1); assert.equal(scroll.align, 'Alignment.TopStart');
  assert.equal(scroll.height, undefined, 'short windows scroll rather than clip a fixed viewport');
  const frame = resolveHorizontalFrame(width, left, right, new SurfaceWidthSpec(720, 19, 19));
  const content = nodes.find(node => node.type === 'Column' && node.padding?.top === 8);
  assert.deepEqual(content.padding, { left: frame.left, right: frame.right, top: 8, bottom: 16 });
  const toggle = nodes.find(node => node.type === 'Toggle');
  toggle.onChange(false); toggle.onChange(true); assert.deepEqual(updates, [false, true]);
  for (const label of ['封面', '列表']) nodes.find(node => node.type === 'Text' && node.create === label).onClick();
  assert.deepEqual(selections, ['cover', 'list']);
  for (const scheme of ['night', 'day']) {
    owner.appThemeScheme = scheme; owner.replay(); header.appThemeScheme = scheme; header.replay();
    assert.equal(title.fontColor, readerAppColor('TOK_INK', scheme));
    assert.equal(root.backgroundColor, readerAppColor('TOK_PAPER', scheme));
    assert.equal(nodes.find(node => node.type === 'Text' && node.create === '封面').fontColor,
      readerAppColor('app.BookshelfSettingsPage.modeOption.onSelected', scheme));
  }
}
const retryOwner = new Component();
const retries = [];
Object.assign(retryOwner, { appThemeScheme: 'day', mode: 'cover', error: '显示方式保存失败，点击重试',
  requestedMode: 'list', autoCheckUpdate: true, readerWindowMetricsRevision: 1,
  selectMode: mode => retries.push(mode) });
retryOwner.initialRender();
[...retryOwner.nodes.values()].find(node => node.type === 'Text' && node.create === retryOwner.error).onClick();
assert.deepEqual(retries, ['list'], 'the visible retry keeps the last requested mode');
let persistedMode = 'cover';
let prepare = async () => {}, saved = [], load = async () => persistedMode,
  save = async mode => { saved.push(mode); persistedMode = mode; };
let fontRegistrations = 0;
const Model = productionMotionMethods(file, ['aboutToAppear', 'aboutToDisappear', 'persistRequestedMode', 'selectMode'], {
  registerReaderFonts: () => { fontRegistrations++; }, ReaderThemeHost: { prepareUserChange: () => prepare() },
  WebDavCredentialStore: { instance: { loadBookshelfViewMode: () => load(), saveBookshelfViewMode: mode => save(mode) } },
});
const mount = () => { const owner = Object.assign(new Model(), { mode: 'cover', revision: 0, error: '',
  getUIContext: () => ({ getFont: () => ({}) }) }); owner.aboutToAppear(); return owner; };
const settle = () => new Promise(resolve => setImmediate(resolve));
let owner = mount(); owner.selectMode('list'); assert.equal(owner.mode, 'list'); await settle();
assert.deepEqual(saved, ['list']); assert.equal(owner.confirmed, 'list'); assert.equal(fontRegistrations, 1);
save = async () => { throw new Error('disk'); }; owner.selectMode('cover'); await settle();
assert.equal(owner.mode, 'list', 'failed optimistic change rolls back to the confirmed persisted mode');
assert.equal(owner.error, '显示方式保存失败，点击重试'); assert.equal(owner.requestedMode, 'cover');
load = async () => 'list'; owner.selectMode('cover'); await settle(); assert.equal(owner.mode, 'list');
prepare = async () => { throw new Error('BOOKSHELF_RESTORE_PENDING'); }; owner.selectMode('cover'); await settle();
assert.equal(owner.error, '请先在同步设置中重试未完成的恢复'); assert.equal(owner.mode, 'list');
let release; prepare = () => new Promise(resolve => { release = resolve; }); saved = [];
save = async mode => { saved.push(mode); }; owner = mount(); owner.selectMode('list');
owner.aboutToDisappear(); release(); await settle(); assert.deepEqual(saved, []); assert.equal(owner.error, '');
let firstRelease; let preparations = 0;
prepare = () => ++preparations === 1 ? new Promise(resolve => { firstRelease = resolve; }) : Promise.resolve();
load = async () => 'cover'; owner = mount(); owner.selectMode('list'); owner.selectMode('cover'); await settle();
firstRelease(); await settle(); assert.deepEqual(saved, ['cover']); assert.equal(owner.mode, 'cover');
console.log('PASS SDK settings shared header/hit/width/theme and vertical ownership; async mode commit/rollback/stale admission and auto-update callbacks preserved');
