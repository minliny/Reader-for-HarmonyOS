import { resolveEtsLoaderRoot } from './lib/tool-environment.mjs';
import {actualModeHost,readerRecoveryView} from './lib/bookshelf-view-mode-probe.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
import { SurfaceHorizontalFrame, SurfaceWidthSpec, resolveHorizontalFrame } from '../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts';
import { ReaderWindowMetricsSnapshot, ReaderRectVp, ReaderInsetsVp, readerVisualSafeLeft, readerVisualSafeRight,
  readerInteractiveSafeLeft, readerInteractiveSafeRight } from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import { readerAppColor } from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import { READER_FLOATING_TOP_BAR_HEIGHT, readerFloatingBarBottomInset } from './lib/reader-floating-bar-metrics-probe.mjs';
import { loadReaderTypographyRoles } from './lib/reader-typography-probe.mjs';
const typographySource = readFileSync(new URL('../entry/src/main/ets/features/common/ReaderTypography.ets', import.meta.url), 'utf8');
const { TYPE_PAGE_TITLE } = loadReaderTypographyRoles(typographySource);
const file = new URL('../entry/src/main/ets/features/bookshelf/BookshelfSettingsPage.ets', import.meta.url);
const source = readFileSync(file, 'utf8');
const headerSource = readFileSync(new URL('../entry/src/main/ets/features/common/PageBackBar.ets', import.meta.url), 'utf8');
const require = createRequire(import.meta.url);
const sdk = resolveEtsLoaderRoot();
const syntax = require(`${sdk}/lib/validate_ui_syntax.js`);
syntax.componentCollection.customComponents.add('PageBackBar');
syntax.componentCollection.customComponents.add('ReaderRecoveryNotice');
syntax.propCollection.set('ReaderRecoveryNotice',new Set(['view','actionLabel']));
syntax.propCollection.set('PageBackBar', new Set(['titleColor']));
class Header { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } }
let activeOwner, activeId;
const Toggle = new Proxy({ name: 'Toggle' }, { get: (target, key) => key === 'name' ? target.name : (...args) => {
  if (key !== 'pop') activeOwner.nodes.get(activeId)[key] = args.length === 1 ? args[0] : args;
} });
let metrics = new ReaderWindowMetricsSnapshot();
class Notice {constructor(owner,params,_s,id){Object.assign(this,{owner,params,id});}}
const deps = { readerRecoveryView,ReaderRecoveryNotice:Notice, PageBackBar: Header, Toggle, ToggleType: { Switch: 'switch' },
  ReaderWindowCoordinator: { metrics: () => metrics }, SurfaceHorizontalFrame, SurfaceWidthSpec, resolveHorizontalFrame,
  readerVisualSafeLeft, readerVisualSafeRight, readerInteractiveSafeLeft, readerInteractiveSafeRight,
  TOK_CONTENT_MAX_W_TABLET: 720, TOK_SCREEN_INSET: 19, TOK_SPACE_XS: 8, TOK_SPACE_MD: 16,
  READER_FLOATING_TOP_BAR_HEIGHT, readerFloatingBarBottomInset, TYPE_PAGE_TITLE };
const methods = ['build','settingsRecovery','settingsRecoveryIdentity','settingsRecoveryCurrent','retrySettingsRecovery', 'modeOption', 'pageContent', 'pageHeader'];
if (source.includes('private contentFrame(')) methods.push('contentFrame');
const { Component } = createReaderBuilderProbe(source, methods, deps,
  { onObserverEnter(owner, id) { activeOwner = owner; activeId = id; } });
const { Component: HeaderComponent } = createReaderBuilderProbe(headerSource, ['trailing', 'build', 'leftInset', 'rightInset'], deps);
for (const [width, height, left, right, safeBottom] of [[365, 320, 0, 0, 0], [390, 844, 32, 24, 24], [1280, 800, 48, 32, 48]]) {
  metrics = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0, 0, width, height), undefined,
    new ReaderInsetsVp(0, 48, 0, safeBottom), new ReaderInsetsVp(left, 0, right, 0));
  const owner = new Component(); let backs = 0; const updates = [], selections = [];
  Object.assign(owner, { appThemeScheme: 'day', mode: 'cover', operation:{action:'load'}, error: '', autoCheckUpdate: true,
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
  const actors = current => [current, ...[...(current.children?.values() ?? [])].flatMap(actors)];
  const nodes = actors(owner).flatMap(current => [...(current.nodes?.values() ?? [])]);
  const root = nodes.find(node => node.type === 'Stack' && node.backgroundColor);
  assert.ok(root, 'the actual public scaffold paints the page');
  assert.equal(root.padding?.top, undefined, 'host alone consumes the top safe area');
  assert.equal(root.padding?.bottom, undefined, 'host alone consumes the bottom safe area');
  assert.equal(root.type, 'Stack');
  const scroll = nodes.find(node => node.type === 'Scroll');
  assert.ok(scroll); assert.equal(scroll.layoutWeight, undefined); assert.equal(scroll.align, 'Alignment.TopStart');
  assert.equal(scroll.height, '100%', 'the viewport extends behind the floating header even in short windows');
  const frame = resolveHorizontalFrame(width, left, right, new SurfaceWidthSpec(720, 19, 19));
  const content = nodes.find(node => node.type === 'Column' && node.padding?.top === 66);
  assert.deepEqual(content.padding, { left: frame.left, right: frame.right, top: 66, bottom: Math.max(16, safeBottom) });
  const toggle = nodes.find(node => node.type === 'Toggle');
  toggle.onChange(false); toggle.onChange(true); assert.deepEqual(updates, [false, true]);
  for (const label of ['封面', '列表']) nodes.find(node => node.type === 'Text' && node.create === label).onClick();
  assert.deepEqual(selections, ['cover', 'list']);
  for (const scheme of ['night', 'day']) {
    // StorageLink delivery is the platform seam: deliver one global scheme to
    // every retained public frame actor, then execute its real SDK observers.
    for (const actor of actors(owner)) { actor.appThemeScheme = scheme; actor.replay?.(); }
    header.appThemeScheme = scheme; header.replay();
    assert.equal(title.fontColor, readerAppColor('TOK_INK', scheme));
    assert.equal(root.backgroundColor, readerAppColor('TOK_PAPER', scheme));
    assert.equal(nodes.find(node => node.type === 'Text' && node.create === '封面').fontColor,
      readerAppColor('app.BookshelfSettingsPage.modeOption.onSelected', scheme));
  }
}
const retryOwner = new Component();
const retries=[];
Object.assign(retryOwner,{appThemeScheme:'day',mode:'cover',operation:{action:'load'},error:'pending',autoCheckUpdate:true,readerWindowMetricsRevision:1,
 viewModeRecovery:()=>({visible:true,message:'pending',canRetry:true,generation:9}),retryMode:g=>retries.push(g)});
retryOwner.initialRender();
const recovery=[...retryOwner.children.values()].find(c=>c instanceof Notice&&c.params.view?.visible);
recovery.params.onReconcile(9);assert.deepEqual(retries,[9],'visible recovery retains operation identity and reads only');
let persistedMode = 'cover';
let prepare = async () => {}, saved = [], load = async () => persistedMode,
  save = async mode => { saved.push(mode); persistedMode = mode; };
let fontRegistrations = 0;
const Model = productionMotionMethods(file, ['aboutToAppear', 'aboutToDisappear', 'persistRequestedMode', 'selectMode','viewModeRecovery','applyModeSnapshot','loadMode','retryMode'], {
  readerRecoveryView, registerReaderFonts: () => { fontRegistrations++; }, ReaderThemeHost: { prepareUserChange: () => prepare() },
  WebDavCredentialStore: { instance: { currentBookshelfViewMode:()=>persistedMode, loadBookshelfViewMode: () => load(), saveBookshelfViewMode: mode => save(mode) } },
});
const mount = () => { const owner = Object.assign(new Model(), { mode: 'cover', revision: 0, error: '',
  getUIContext: () => ({ getFont: () => ({}) }),viewModeHost:actualModeHost({currentBookshelfViewMode:()=>persistedMode,loadBookshelfViewMode:()=>load(),saveBookshelfViewMode:mode=>save(mode)},()=>prepare()),viewModeSnapshot:{canonical:undefined} }); owner.aboutToAppear(); return owner; };
const settle = () => new Promise(resolve => setImmediate(resolve));
let owner = mount(); owner.selectMode('list'); assert.equal(owner.mode, 'list'); await settle();
assert.deepEqual(saved, ['list']); assert.equal(owner.confirmed, 'list'); assert.equal(fontRegistrations, 1);
save = async () => { throw new Error('disk'); }; owner.selectMode('cover'); await settle();
assert.equal(owner.mode, 'list', 'failed optimistic change rolls back to the confirmed persisted mode');
assert.equal(owner.viewModeSnapshot.receipt.receipt.confirmation,'unknown');assert.match(owner.error,/等待核对/); assert.equal(owner.requestedMode, 'cover');
load = async () => 'list'; owner=mount();owner.selectMode('cover'); await settle(); assert.equal(owner.mode, 'list');
prepare = async () => { throw new Error('BOOKSHELF_RESTORE_PENDING'); }; owner=mount();owner.selectMode('cover'); await settle();
assert.equal(owner.error, '请先在同步设置中重试未完成的恢复'); assert.equal(owner.mode, 'list');
let release; prepare = () => new Promise(resolve => { release = resolve; }); saved = [];
save = async mode => { saved.push(mode); }; owner = mount(); owner.selectMode('list');
await settle();owner.aboutToDisappear(); release(); await settle(); assert.deepEqual(saved, []); assert.equal(owner.error, '');
let firstRelease; let preparations = 0;
prepare = () => ++preparations === 1 ? new Promise(resolve => { firstRelease = resolve; }) : Promise.resolve();
load = async () => 'cover'; owner = mount(); owner.selectMode('list'); owner.selectMode('cover'); await settle();
firstRelease(); await settle();await settle(); assert.deepEqual(saved, ['cover']); assert.equal(owner.mode, 'cover');
console.log('PASS SDK settings floating shared header/full viewport/content clearance/width/theme; async mode commit/rollback/stale admission and auto-update callbacks preserved');
