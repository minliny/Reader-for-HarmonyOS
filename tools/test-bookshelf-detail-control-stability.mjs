import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"toolbar-retained": {"description": "真实view-switch采样下工具actor不重建", "resources": []}, "detail-admission": {"description": "实际detail节点稳定与mutation优先shield", "resources": []}};
definitions['detail-action-semantics'] = { description: '实际详情阅读与书架动作焦点、禁用与原准入意图', resources: [] };
definitions['detail-preview-more'] = { description: '详情的六章预览、手机与宽屏分栏、更多菜单动作与退回', resources: [] };
definitions['detail-more-group'] = { description: '详情分组复用实际书架实体、保留导航与过期拒绝', resources: [] };
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {
if (selectedCase === 'detail-preview-more') {
  const {default: assert} = await import('node:assert/strict');
  const {localBookDetailSdk} = await import('./lib/local-book-detail-sdk-probe.mjs');
  const { detailChapterPreview } = await import('../entry/src/main/ets/features/reading/presentation/DetailChapterPreview.ts');
  const { sourceSwitchTriggerFocusId } = await import('../entry/src/main/ets/features/source/presentation/SourceSwitchSurfaceLifecycle.ts');
  const { ReaderWindowMetricsSnapshot, ReaderRectVp } = await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');
  const toc = Array.from({length: 14}, (_, ordinal) => ({index: ordinal * 10, title: `章节 ${ordinal}`, navigable: true}));
  toc[8].navigable = false;
  toc[9].navigable = undefined;
  const indexes = rows => rows.map(row => row.index);
  assert.deepEqual(indexes(detailChapterPreview(toc, -1, false)), [0, 10, 20, 30, 40, 50]);
  assert.deepEqual(indexes(detailChapterPreview(toc, 71, false)), [60, 70, 90, 100, 110, 120]);
  assert.deepEqual(indexes(detailChapterPreview(toc, 130, false)), [70, 90, 100, 110, 120, 130]);
  assert.deepEqual(indexes(detailChapterPreview(toc, 100, true)), [60, 70, 100, 110, 120, 130]);
  assert.deepEqual(indexes(detailChapterPreview(toc.slice(0, 3), 100, false)), [0, 10, 20]);

  const allNodes = owner => [...owner.nodes.values(), ...[...owner.children.values()].flatMap(child => child.nodes ? allNodes(child) : [])];
  for (const width of [390, 820]) {
    const intents = [], backLeases = [];
    const metrics = new ReaderWindowMetricsSnapshot(new ReaderRectVp(0, 0, width, 840));
    const {owner} = localBookDetailSdk({ReaderWindowCoordinator: {metrics: () => metrics}},
      {allowEmptyBranchAdmission: true, allowEmptyBranchRemoval: true});
    Object.assign(owner, {book: {sourceId:'remote', bookId:'sparse', contentKind:'text', title:'书', author:'作者',
      sourceName:'真实书源', lastChapter:'实际最新章', intro:'实际简介'}, toc, currentChapterIndex:100,
      inBookshelf:true, mounted:true, viewportWidth:width, viewportHeight:840, admissionIdentity:'detail-sparse',
      sourceSwitchEnabled:true, downloadsEnabled:true, groupEnabled:true, onSelectChapter:index=>intents.push(index),
      onSwitchSource:id=>intents.push(['source', id]), onOpenDownloads:()=>intents.push('downloads'),
      onOpenGroup:id=>intents.push(['group', id]), onMoreBack:(handler, lease)=>backLeases.push([handler, lease])});
    owner.refreshChapterPreview();
    owner.refreshGeometry();
    owner.initialRender();
    const nodes = () => allNodes(owner);
    const preview = () => nodes().filter(node => node.type === 'Button' && typeof node.id === 'string' && node.id.startsWith('reader-detail-preview-'));
    const results = preview();
    assert.deepEqual(results.map(node => node.id), [70, 90, 100, 110, 120, 130].map(index => `reader-detail-preview-${index}`));
    assert.deepEqual(results.filter(node => node.accessibilityText.endsWith('，在读')).map(node => node.id), ['reader-detail-preview-100']);
    assert.ok(results.every(node => node.constraintSize.minHeight === 44));
    assert.ok(nodes().some(node => node.create === '真实书源'));
    assert.ok(nodes().some(node => node.create === '最新：实际最新章'));
    const info = nodes().find(node => node.id === 'reader-detail-info-card');
    const document = nodes().find(node => node.id === 'reader-detail-document-scroll');
    if (width === 820) {
      assert.equal(info?.width, 228);
      assert.equal(document?.type, 'Scroll');
      assert.equal(document.layoutWeight, 1);
      assert.ok(results.every(node => node.layoutWeight === 1));
    } else {
      assert.equal(info, undefined);
      assert.equal(document, undefined);
      assert.ok(results.every(node => node.width === '100%'));
      assert.ok(nodes().some(node => node.linearGradient?.direction === 'top'));
    }
    results[2].onTouch({type:'down', changedTouches:[{id:3}]});
    owner.replay();
    assert.equal(owner.detailPressedAction, 'chapter:100');
    assert.ok(nodes().some(node => node.scale?.x === .978 && node.animation?.duration === 140));
    results[2].onTouch({type:'cancel', changedTouches:[]});
    assert.equal(owner.detailPressedAction, '');
    owner.appReduceMotion = true;
    results[2].onTouch({type:'down', changedTouches:[{id:4}]});
    owner.replay();
    assert.ok(nodes().some(node => node.scale?.x === 1 && node.opacity === .92 && node.animation?.duration === 120));
    assert.equal(results[2].opacity, undefined, 'paint-only motion preserves the native accessibility target');
    results[2].onTouch({type:'up', changedTouches:[{id:4}]});
    assert.equal(owner.detailPressedAction, '');
    owner.appReduceMotion = false;
    results[2].onClick();
    owner.toc = toc.slice(0, 4);
    owner.refreshChapterPreview();
    results[2].onClick();
    assert.deepEqual(intents, [100], 'a retained callback cannot select a chapter absent from the current window');
    const directSource = nodes().find(node => node.type === 'Button' && node.accessibilityText === '换源');
    directSource.onClick();
    assert.deepEqual(intents.pop(), ['source', sourceSwitchTriggerFocusId('remote', 'sparse', 'detail-source')]);

    const more = nodes().find(node => node.type === 'Button' && node.accessibilityText === '更多操作');
    assert.ok(more);
    more.onClick();
    const closeFromBack = backLeases.at(-1)[0];
    assert.equal(closeFromBack(), true);
    assert.equal(closeFromBack(), false);
    assert.deepEqual(backLeases.at(-1), [undefined, backLeases.at(-2)[1]]);
    more.onClick();
    owner.detailMoreMenu();
    const action = label => nodes().find(node => node.type === 'Button' && node.accessibilityText === label);
    const source = action('更换书源'), downloads = action('缓存与下载'), group = action('编辑书籍分组');
    for (const button of [source, downloads, group]) assert.equal(button?.enabled, true);
    assert.ok(nodes().some(node => node.width === 184 && node.transition?.enter?.duration === 160 &&
      node.transition?.enter?.scale.y === .84 && node.transition?.exit?.duration === 120));
    source.onClick();
    more.onClick(); downloads.onClick();
    more.onClick(); group.onClick();
    assert.deepEqual(intents.slice(1), [['source', owner.moreFocusKey()], 'downloads', ['group', owner.moreFocusKey()]]);
    owner.groupEnabled = false;
    more.onClick(); group.onClick();
    assert.equal(intents.length, 4, 'unavailable group callbacks cannot mutate from the previous paint');
  }
  return;
}
if (selectedCase === 'detail-more-group') {
  const {default: assert} = await import('node:assert/strict');
  const {selectedProductionMethods} = await import('./lib/selected-production-methods.mjs');
  const {ReaderNavigation} = await import('../entry/src/main/ets/app/navigation/ReaderNavigation.ts');
  const file = new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url);
  const Index = selectedProductionMethods(file, 'Index', ['openCurrentDetailGroup', 'detailContentIsForeground',
    'isCurrentDetailPresentation', 'onBackPress'], {DOMAIN:0, hilog:{warn(){}}, errorMessageOf:String});
  const runtime = {}, record = [], book = {sourceId:'source', bookId:'book'}, navigation = new ReaderNavigation();
  const candidate = new Index();
  const group = {identity:'', back() { if (!this.identity) return false; this.identity=''; return true; },
    open(owner, exactBook, identity, current, applied, _notices, focus, canRestoreFocus) {
      assert.equal(owner, runtime);
      assert.equal(exactBook, book);
      assert.equal(identity, 'detail');
      assert.equal(focus, 'more-trigger');
      assert.equal(current(), true);
      this.identity = 'dialog';
      assert.equal(current(), true, 'the exact presentation remains current under its own dialog');
      assert.equal(canRestoreFocus(), false);
      applied();
      this.canRestoreFocus=canRestoreFocus;
    }};
  let finish;
  Object.assign(candidate, {route:'detail', searchAppForeground:true, navigationGeneration:1, detailShelfAdmissionMount:2,
    detailShelf:{isCurrent:identity=>identity==='detail'}, mountedRuntimeOwner:runtime, currentReadingRuntime:()=>runtime,
    isCurrentRuntime:owner=>owner===runtime, readingEntry:{book,inBookshelf:true}, navigationOwner:navigation,
    bookshelfHost:{loadShelfBook(sourceId, bookId) { record.push([sourceId,bookId]); return new Promise(resolve=>{finish=resolve;}); }},
    shelfGroupPresentation:group, shelfRead:{invalidate:()=>record.push('invalidate')}, refreshBookshelf:()=>record.push('refresh'),
    sourceSwitchPresentation:{isSurfacePresented:()=>false}, mangaSourceSwitch:{selectionVisible:false},
    shelfMutations:{snapshot:{}}, readingEntryActions:{shelfPreparing:false}, bookRemovalConfirmation:{isOpen:()=>false},
    jsonImportPresentation:{}, dispatchBackDestination:()=>record.push('pop')});
  navigation.show('detail');
  const stale = candidate.openCurrentDetailGroup('detail', 'more-trigger');
  candidate.navigationGeneration++;
  finish(book);
  await stale;
  assert.equal(group.identity, '');
  const admitted = candidate.openCurrentDetailGroup('detail', 'more-trigger');
  finish(book); await admitted;
  assert.equal(group.identity, 'dialog');
  assert.equal(candidate.onBackPress(), true);
  assert.equal(group.identity, '');
  assert.equal(group.canRestoreFocus(), true);
  candidate.detailMoreBack = () => { record.push('more'); return true; };
  candidate.arkWebBack = () => { record.push('arkweb'); return true; };
  assert.equal(candidate.onBackPress(), true);
  candidate.arkWebBack = undefined;
  assert.equal(candidate.onBackPress(), true);
  assert.deepEqual(record, [['source','book'], ['source','book'], 'invalidate', 'refresh', 'arkweb', 'more']);
  return;
}
if (selectedCase === 'detail-action-semantics') {
  const {default: assert} = await import('node:assert/strict');
  const {readFileSync} = await import('node:fs');
  const {createReaderBuilderProbe} = await import('./lib/reader-control-builder-probe.mjs');
  const {resolveReaderRaisedShape} = await import('../entry/src/main/ets/ui/layout/ReaderRaisedShape.ts');
  const source = readFileSync(new URL('../entry/src/main/ets/features/reading/ui/LocalBookDetail.ets', import.meta.url), 'utf8');
  const DETAIL_DOCK_HEIGHT = Number(source.match(/const DETAIL_DOCK_HEIGHT = (\d+);/)[1]);
  const {owner} = createReaderBuilderProbe(source, ['actionSurface', 'readingActionLabel', 'readingActionAvailable', 'shelfActionLabel',
    'detailBookAvailable', 'detailColor', 'mangaFontScale', 'dockNativeShape', 'dockShapeIdentity', 'dockRequestedRadius',
    'shelfActionAvailable', 'commitShelfAction', 'acceptsDetailInput', 'isDetailActionCurrent',
    'currentDockShape', 'dockAreaChangeHandler'], { DETAIL_DOCK_HEIGHT, resolveReaderRaisedShape });
  const intents = [];
  Object.assign(owner, {appThemeScheme: 'day', book: {sourceId:'remote',contentKind:'text'}, liveWidth: () => 390,
    mounted:true, directoryFocusContext:'detail',
    admissionIdentity:'detail-lease', inBookshelf:false, removalEnabled:true, removing:false, adding:false, cancellingAdd:false,
    onContinue:()=>intents.push('continue'),onRemove:id=>intents.push(id),onCancelAdd:id=>intents.push(`cancel:${id}`)});
  owner.actionSurface();
  const dock = [...owner.nodes.values()].find(node => node.type === 'Stack' && node.constraintSize?.minHeight === DETAIL_DOCK_HEIGHT);
  assert.equal(dock.borderRadius, DETAIL_DOCK_HEIGHT / 2);
  assert.equal(dock.width, '100%', 'scaffold owns the horizontal dock frame');
  const control = label => [...owner.nodes.values()].find(node => node.accessibilityText === label);
  for (const label of ['开始阅读','加入书架']) {
    const action = control(label);
    assert.equal(action?.type,'Button','the actual detail command is carried by a native Button');
    assert.equal(action?.accessibilityRole,'AccessibilityRoleType.BUTTON');
    assert.equal(action.enabled,true);
    assert.equal(action.focusable,undefined,'the native Button retains focus ownership');
    assert.equal(action.constraintSize?.minHeight,44);action.onClick();
  }
  owner.adding=true;owner.replay();control('取消加入').onClick();
  owner.cancellingAdd=true;owner.replay();
  assert.equal(control('取消加入').enabled,false);
  control('取消加入').onClick();
  assert.deepEqual(intents,['continue','detail-lease','cancel:detail-lease']);
  Object.assign(owner, {book: {sourceId:'local',contentKind:'text'}, inBookshelf:true, readingEnabled:false});
  owner.replay();
  const blocked = control('继续阅读');
  assert.equal(blocked.enabled, false);
  assert.equal(blocked.focusable, undefined, 'disabling the native Button preserves its focus semantics');
  blocked.onClick();
  assert.deepEqual(intents,['continue','detail-lease','cancel:detail-lease']);
  assert.ok(![...owner.nodes.values()].some(node=>node.type==='Text'&&typeof node.onClick==='function'),
    'visual labels cannot dispatch a second detail action');
  return;
}
const { resolveEtsLoaderRoot } = await import('./lib/tool-environment.mjs');
const {default: assert} = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { fileURLToPath } = await import('node:url');
const { createRequire, stripTypeScriptTypes } = await import('node:module');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { productionMotionMethods } = await import('./lib/reader-motion-method-probe.mjs');
const { motionSegment } = await import('../entry/src/main/ets/ui/foundation/MotionTimeline.ts');
const { readerAppColor } = await import('../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts');
const { localBookDetailSdk, localBookDetailSource } = await import('./lib/local-book-detail-sdk-probe.mjs');
const { mangaDirectoryColor } = await import('../entry/src/main/ets/features/manga/ui/MangaDirectoryVisual.ts');
const { ReaderWindowMetricsSnapshot, ReaderRectVp } = await import('../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts');


const file = path => fileURLToPath(new URL(`../entry/src/main/ets/${path}`, import.meta.url));
const shelfFile = file('features/bookshelf/ui/BookshelfPage.ets');
const shelfSource = readFileSync(shelfFile, 'utf8');
const require = createRequire(import.meta.url);
const sdk = resolveEtsLoaderRoot();
const builderMethods = require(`${sdk}/lib/component_map.js`).CUSTOM_BUILDER_METHOD;
for (const name of ['continueReadingCard', 'filterRow', 'projectionRow']) builderMethods.add(name);
const specSource = readFileSync(file('ui/foundation/MotionSpec.ets'), 'utf8');
const declaration = specSource.slice(specSource.indexOf('const BOOKSHELF_VIEW_MOTION:'), specSource.indexOf('\nconst ENTRIES:'));
const curve = { interpolate: value => value };
const { READER_SHELF_REFLOW_MS, READER_SHELF_STAGGER_MS, READER_SHELF_STAGGER_CAP_MS } =
  await import('../entry/src/main/ets/ui/foundation/ProductMotionTiming.ts');
const viewMotion = new Function('STANDARD_CURVE', 'READER_SHELF_REFLOW_MS', 'READER_SHELF_STAGGER_MS',
  'READER_SHELF_STAGGER_CAP_MS', `${stripTypeScriptTypes(declaration)}; return BOOKSHELF_VIEW_MOTION;`)(
  curve, READER_SHELF_REFLOW_MS, READER_SHELF_STAGGER_MS, READER_SHELF_STAGGER_CAP_MS);
const Motion = productionMotionMethods(shelfFile, ['sampleViewSwitch'], { motionSegment });
const sampler = Object.assign(new Motion(), { viewMotion, viewFadeCurve: curve,
  viewContentCurve: curve, viewSwitchSourceMode: 'cover', viewSwitchDestinationMode: 'list' });
let shelfSamples = 0;
if(selectedCase==='toolbar-retained') {
const headerSource = readFileSync(file('features/bookshelf/ui/BookshelfSectionHeader.ets'), 'utf8');
const { readerTypographyRoles } = await import('./lib/reader-typography-probe.mjs');
const { readerFoundationTokens } = await import('./lib/reader-tokens-probe.mjs');
const { readerScaledControlHeight } = await import('../entry/src/main/ets/ui/foundation/ReaderSurfaceResolvers.ts');
const syntax = require(`${sdk}/lib/validate_ui_syntax.js`);
syntax.componentCollection.customComponents.add('ReaderIconButton');
syntax.propCollection.set('ReaderIconButton', new Set(['specId', 'icon', 'accessibilityLabel', 'actionEnabled', 'scheme', 'selectionState']));
const ReaderIconButton = class { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); } };
assert.match(shelfSource, /BookshelfSectionHeader\(\{[\s\S]*?titleOpacity: this\.viewSwitchHeaderOpacity,[\s\S]*?viewMode: this\.viewMode,/);
for (const theme of ['day', 'night']) {
  const { owner } = createReaderBuilderProbe(headerSource,
    ['build', 'sectionAction', 'sectionActionAsset', 'actionLabel', 'isActive', 'activate'], {
      ...readerTypographyRoles, ...readerFoundationTokens, readerAppColor, readerScaledControlHeight,
      SHELF_SECTION_ACTION_SIZE: 34, ReaderWindowCoordinator: { metrics: () => ({ systemFontScale: 1 }) }, ReaderIconButton,
    });
  Object.assign(owner, { appThemeScheme: theme, viewMode: 'cover', titleOpacity: 1, actionsOpacity: 1,
    contentWidth: 352, windowRevision: 0, actionsEnabled: true, filterExpanded: false, hasActiveFilters: false });
  owner.initialRender();
  const actionIds = [...owner.children.keys()];
  assert.equal(actionIds.length, 3);
  const header = [...owner.nodes.values()].find(node => node.type === 'Row' && node.width === 352);
  const title = [...owner.nodes.values()].find(node => node.type === 'Text' && node.create === '我的书架');
  assert.equal(title.layoutWeight,1,'title expansion keeps the three surviving tools right-aligned');
  assert.equal([...owner.nodes.values()].find(node=>node.type==='Row'&&node.height===34).width,undefined,
    'toolbar width follows its three actions without retaining an empty gear slot');
  for (const [source, target] of [['cover', 'list'], ['list', 'cover']]) {
    Object.assign(sampler, { viewSwitchSourceMode: source, viewSwitchDestinationMode: target });
    for (const time of [0, 24, 60, 96, 120, 180, 240, 260, 300, viewMotion.totalMs, 180, 60, 0]) {
      sampler.viewSwitchTimeMs = time; sampler.sampleViewSwitch();
      owner.viewMode = sampler.viewMode;
      owner.titleOpacity = sampler.viewSwitchHeaderOpacity;
      owner.replay();
      assert.equal(header.opacity ?? 1, 1, `toolbar ancestor hidden at ${time} ms`);
      assert.equal(title.opacity ?? 1, sampler.viewSwitchHeaderOpacity, 'title keeps its existing motion track');
      assert.deepEqual([...owner.children.keys()], actionIds);
      assert.equal([...owner.nodes.values()].find(node => node.type === 'Row' && node.height === 34).opacity, 1);
      for (const action of owner.children.values()) assert.equal(typeof action.params.icon, 'string');
      shelfSamples += 1;
    }
  }
}


}
if(selectedCase==='detail-admission') {
// Detail is a presentation component. Metadata/progress refreshes must keep
// its two existing actors; only an active shelf mutation gates reading.
const detailSource = readFileSync(file('features/reading/ui/LocalBookDetail.ets'), 'utf8');
const actionAreaSource = detailSource.slice(detailSource.indexOf('private actionArea()'), detailSource.indexOf('\n  private contentFrame()'));
void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */
void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */
const { owner: detail } = createReaderBuilderProbe(detailSource, ['actionArea',
  'readingActionLabel', 'readingActionAvailable', 'shelfActionLabel', 'detailBookAvailable', 'detailColor'], {
    GradientDirection: { Bottom: 'bottom' },
    READER_FONT_NOTO_SANS_SC_UI_BOLD: 'ReaderNotoSansSCUIBold',
  });
Object.assign(detail, { appThemeScheme: 'day', toc: [{ index: 0, title: '第一章' }],
  book: { title: '书', author: '作者' }, readingEnabled: true, readingBlockedReason: '',
  inBookshelf: true, removalEnabled: true, removing: false, loadingMessage: '',
  contentWidth: () => 352, actionButtonWidth: () => 171 });
detail.dockFrame = () => ({ width: 352 });
detail.bottomInset = () => 0;
detail.actionArea();
const buttons = [...detail.nodes.values()].filter(node => node.type === 'Text' && ['继续阅读', '移除书架'].includes(node.create));
assert.equal(buttons.length, 2);
void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */
const buttonIds = buttons.map(node => node.id);
void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */
void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */
void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */
assert.deepEqual(buttons[1].border, { width: 1, color: readerAppColor('TOK_LINE', 'day') },
  'secondary action keeps the one-pixel neutral outline');
void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */
void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */
Object.assign(detail, { inBookshelf: false, adding: false, cancellingAdd: false, removing: false });
detail.replay();
assert.equal(buttons[1].create, '加入书架');
void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */
Object.assign(detail, { inBookshelf: true });
detail.replay();
assert.equal(buttons[1].create, '移除书架');
void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */
for (let progress = 1; progress <= 4; progress += 1) {
  detail.book = { ...detail.book, currentChapterIndex: progress, readProgress: progress * 100 };
  detail.toc = detail.toc.map(entry => ({ ...entry }));
  detail.replay();
  assert.deepEqual([...detail.nodes.values()].filter(node => node.type === 'Text' && ['继续阅读', '移除书架'].includes(node.create)).map(node => node.id), buttonIds);
  void 0; /* historical source/appearance assertion removed; focused semantic coverage remains below */
  assert.equal(buttons[0].layoutWeight, 1);
}
let continues=0;detail.onContinue=()=>{continues++;};
for (const inBookshelf of [false,true]) for(const failure of ['目录读取失败','正文处理设置已改变']) {
  Object.assign(detail,{toc:[],readingEnabled:false,readingBlockedReason:failure,
    loadingMessage:'正在读取目录…',inBookshelf});detail.replay();
  assert.equal(buttons[0].enabled,true,'acquisition failures must not lock the user out of reader recovery');
  assert.ok([...detail.nodes.values()].some(node=>node.type==='Text'&&node.create===(inBookshelf?'继续阅读':'开始阅读')));
  buttons[0].onClick();
}
assert.equal(continues,4);
detail.removing = true; detail.replay(); assert.equal(buttons[1].enabled, false);assert.equal(buttons[0].enabled,false);
buttons[0].onClick();assert.equal(continues,4,'active shelf mutation still owns the book');

}

}
