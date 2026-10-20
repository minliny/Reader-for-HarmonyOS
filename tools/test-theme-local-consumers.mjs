import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={"role-registry": {"description": "本地role alpha/颜色格式声明，无46/11冻结", "resources": []}, "sync-actions": {"description": "实际Sync finite Button角色/retained scheme及错误role负例", "resources": []}, "source": {"description": "实际Source shared角色消费", "resources": []}, "rss-feed": {"description": "实际RSS feed shared角色消费", "resources": []}, "rss": {"description": "实际RSS list shared角色消费", "resources": []}, "discover": {"description": "实际Discover shared角色消费", "resources": []}, "segment": {"description": "实际SegmentedControl live scheme及frozen-day负例", "resources": []}, "bookmark-empty": {"description": "实际bookmark empty→PageState→Action live scheme", "resources": []}, "status-semantics": {"description": "实际source status三状态成功绿/失败红语义", "resources": []}};
for(const id of selectContractCases(definitions)){await runSelectedCase(id);recordContractCasePass(id);}
async function runSelectedCase(selectedCase){
const { boundedSurfaceSdk } = await import('./lib/bounded-surface-sdk-probe.mjs');
const {switchControls,segmentSource} = await import('./lib/reader-switch-control-probe.mjs');
const {default: assert} = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { readerAppColor } = await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
const {selectedProductionMethods} = await import('./lib/selected-production-methods.mjs');
const { foundationControls, foundationSpecs } = await import('./lib/reader-foundation-control-probe.mjs');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { labeledIconControls } = await import('./lib/reader-labeled-icon-action-probe.mjs');
const { readerTypographyRoles } = await import('./lib/reader-typography-probe.mjs');


// Snapshot of the actual replaced local constants, captured before migration.
// Verify authored Day/alpha and the live consumers, not just registry presence.
const rows = JSON.parse(readFileSync(new URL('./fixtures/design/theme-consumers.json', import.meta.url)))
  .filter(row => row.originalConstant !== undefined);

// Migrated Sync actions consume these same roles through the actual shared
// Button. Execute the SDK-emitted parent and child, then retain the authored
// palette checks below; registry presence or a new whitelist is insufficient.
const syncFile = 'features/sync/SyncPage.ets';
const syncSource = readFileSync(new URL(`../entry/src/main/ets/${syncFile}`, import.meta.url), 'utf8');
const sharedRoles = new Set();
function syncActions(specs = foundationSpecs()) {
  const shared = foundationControls({ specs });
  const { owner } = createReaderBuilderProbe(syncSource,
    ['configActions', 'manualActionButton', 'canMutate', 'effectiveWebdavUrl', 'effectiveWebdavUser', 'effectiveWebdavPath'],
    shared.dependencies, shared.hooks);
  Object.assign(owner, { appThemeScheme: 'day', snapshot: { busy: false },
    webdavUrlEdited: true, webdavUserEdited: true, webdavPathEdited: true,
    webdavUrl: '', webdavUser: '', webdavPath: '', webdavPass: '', backupPass: '',
    onTestConnection: () => {}, onSaveConfig: () => {} });
  owner.configActions();
  owner.manualActionButton('立即备份', true, () => {});
  owner.manualActionButton('恢复最新备份', false, () => {});
  return { owner, shared };
}
function checkSyncActions(probe, scheme) {
  probe.owner.appThemeScheme = scheme;
  probe.shared.flush(probe.owner);
  for (const child of probe.owner.children.values()) {
    assert.equal(child.constructor, probe.shared.button.Component, 'actual shared Button consumer');
    const spec = probe.shared.dependencies.resolveReaderButtonSpec(child.specId);
    const node = probe.shared.nodes(child).find(n => n.onClick);
    const surface = child.primary ? spec.primarySurface : spec.secondarySurface;
    const border = child.primary ? spec.primaryBorder : spec.secondaryBorder;
    const authoredSurface = child.primary ? 'app.SyncPage.SOLID_BG' : 'app.SyncPage.GHOST_BG';
    assert.equal(surface, authoredSurface, 'authored Sync surface role retained through finite spec');
    assert.equal(node.backgroundColor, readerAppColor(authoredSurface, scheme), 'live shared surface follows current scheme');
    sharedRoles.add(surface);
    if (spec.hasBorder && (!child.primary || spec.primaryHasBorder)) {
      assert.equal(border, child.primary ? 'app.SyncPage.SOLID_BG' : 'app.SyncPage.GHOST_BORDER', 'authored Sync border role retained');
      assert.equal(node.border.color, readerAppColor(border, scheme), 'live shared border follows current scheme');
      sharedRoles.add(border);
    }
  }
}
if(selectedCase==='sync-actions') {
const sync = syncActions();
checkSyncActions(sync, 'day');
checkSyncActions(sync, 'night');
checkSyncActions(sync, 'day');
}
const sharedBindings = new Map();
function captureSharedConsumer(file, methods, render) {
  const shared = labeledIconControls();
  const source = readFileSync(new URL(`../entry/src/main/ets/${file}`, import.meta.url), 'utf8');
  const { owner } = createReaderBuilderProbe(source, methods,
    { ...shared.dependencies, ...readerTypographyRoles,ScrollDirection:{Horizontal:'ScrollDirection.Horizontal'},BarState:{Off:'BarState.Off'} }, shared.hooks);
  Object.assign(owner, { appThemeScheme: 'day', activeMode: 'all', filterValue: 'all',
    filterControlWidth: () => 280, contentFrame: () => ({ width: 350 }), actionBottomInset: () => 0,
    onOpenTools: () => {}, onAddSource: () => {}, onModeRequested: () => {},
    presentation:{activeKindIndex:0,kinds:[{title:'默认'},{title:'其他'}],filterKey:'all',loading:false},
    onSelectKind:()=>{},onCycleFilter:()=>{},onRefresh:()=>{} });
  render(owner);
  const roles = new Set(rows.filter(row => row.file === file).map(row => row.role));
  const witnesses = new Map();
  for (const scheme of ['day', 'night', 'day']) {
    owner.appThemeScheme = scheme;
    shared.flush(owner);
    for (const child of owner.children.values()) {
      const button = child.constructor === shared.button.Component;
      assert.ok(button || child.constructor === shared.component, 'actual shared Button or labeled Icon');
      const spec = button ? shared.dependencies.resolveReaderButtonSpec(child.specId) :
        shared.dependencies.resolveReaderLabeledIconActionSpec(child.specId);
      const nativeColors = shared.nodes(child).flatMap(node => [node.backgroundColor, node.fontColor, node.border?.color,...(node.linearGradient?.colors??[]).map(stop=>stop[0])] );
      for (const role of Object.values(spec).filter(value => roles.has(value))) {
        if (!nativeColors.includes(readerAppColor(role, scheme))) continue;
        if (!witnesses.has(role)) witnesses.set(role, new Set());
        witnesses.get(role).add(scheme);
      }
    }
  }
  sharedBindings.set(file, new Set([...witnesses].filter(([, schemes]) => schemes.size === 2).map(([role]) => role)));
}
if(selectedCase==='source') captureSharedConsumer('features/source/SourceManagementPage.ets', ['chip', 'bottomActionBar'], owner => {
  owner.chip('未检测', 58, false, true); owner.bottomActionBar();
});
if(selectedCase==='rss-feed') captureSharedConsumer('features/rss/RssSourceFeedPage.ets', ['actionTarget'], owner => owner.actionTarget('刷新', 'icon', () => {}));
if(selectedCase==='rss') captureSharedConsumer('features/rss/RssPage.ets', ['statusTab', 'filterPill', 'recentUnreadHeader'], owner => {
  owner.statusTab('未读', 'unread'); owner.filterPill('未读'); owner.recentUnreadHeader();
});
if(selectedCase==='discover') captureSharedConsumer('features/discover/DiscoverPage.ets', ['categoryChips','kindTitles','filterRow','currentFilterText'], owner => {
  owner.categoryChips();owner.filterRow();
});
// F04's same theme palette now belongs to the actual finite enum producer.
function captureSegmentTheme(source = segmentSource) {
  const control = switchControls({ segmentDefinition: source });
  const owner = control.mount(control.segment, { inputIdentity: 'theme-palette', options: ['跟随','浅色','深色'], optionIds: ['system','day','night'], selectedIndex: 0 });
  const roles = new Set(rows.filter(row => row.file === 'features/common/ReaderSegmentedControl.ets').map(row => row.role));
  const witnessed = new Map();
  for (const scheme of ['day', 'night', 'day']) {
    owner.appThemeScheme = scheme; control.properties.flush();
    const native = control.nodes(owner).flatMap(node => [node.backgroundColor,node.fontColor,node.border?.color]);
    for (const role of roles) if (native.includes(readerAppColor(role,scheme))) {
      if (!witnessed.has(role)) witnessed.set(role,new Set());
      witnessed.get(role).add(scheme);
    }
  }
  return new Set([...witnessed].filter(([,schemes])=>schemes.size===2).map(([role])=>role));
}
if(selectedCase==='segment') {
sharedBindings.set('features/common/ReaderSegmentedControl.ets', captureSegmentTheme());
assert.notDeepEqual(captureSegmentTheme(segmentSource.replaceAll('this.appThemeScheme', "'day'")), sharedBindings.get('features/common/ReaderSegmentedControl.ets'), 'frozen Day shared enum cannot qualify Night role consumption');
}
if(selectedCase==='bookmark-empty') {
// C03 intentionally replaces this one historical empty-state button color
// with the approved message family. Keep its original registry tuple above,
// and prove the real wrapper -> PageState -> Action and both live schemes.
const bookmarkEmptyFile='features/reading/ReaderBookmarkEmptyState.ets';
const bookmarkEmptySource=readFileSync(new URL(`../entry/src/main/ets/${bookmarkEmptyFile}`,import.meta.url),'utf8');
const bookmarkMessages=boundedSurfaceSdk();let returned=0;
const bookmarkEmpty=bookmarkMessages.consumer(bookmarkEmptySource,undefined,{}, {onReturnToDirectory:()=>returned++});bookmarkEmpty.initialRender();
assert.equal(bookmarkMessages.walk(bookmarkEmpty).filter(actor=>actor instanceof bookmarkMessages.deps.ReaderPageState).length,1);
for(const scheme of ['day','night','day']){
 for(const actor of bookmarkMessages.walk(bookmarkEmpty))actor.appThemeScheme=scheme;
 bookmarkMessages.properties.flush();
 const action=bookmarkMessages.walk(bookmarkEmpty).find(actor=>actor instanceof bookmarkMessages.deps.ReaderRecoveryAction);
 const label=bookmarkMessages.nodes(action).find(node=>node.type==='Text'&&node.create==='返回目录');
 assert.equal(label.fontColor,readerAppColor('TOK_MESSAGE_SOFT_INK',scheme));
 bookmarkMessages.nodes(action).find(node=>node.onClick).onClick();
}
assert.equal(returned,3);
}
if(selectedCase==='role-registry') for(const role of new Set(rows.map(row=>row.role))){const day=readerAppColor(role,'day'),night=readerAppColor(role,'night');assert.match(day,/^#[0-9A-Fa-f]{8}$/);assert.match(night,/^#[0-9A-Fa-f]{8}$/);assert.equal(day.slice(1,3),night.slice(1,3),'local-role alpha is an explicit semantic invariant; color values may evolve');}
// Negative controls prove that a hard-coded Day scheme or wrong finite role
// cannot be admitted as a successfully migrated consumer.
if(selectedCase==='sync-actions') {
const frozenScheme = syncActions();
frozenScheme.owner.replay = () => {};
assert.throws(() => checkSyncActions(frozenScheme, 'night'), /live shared surface/);
const actualSpecs = foundationSpecs();
const wrongRole = syncActions({ ...actualSpecs, resolveReaderButtonSpec: id => ({
  ...actualSpecs.resolveReaderButtonSpec(id), primarySurface: 'TOK_PAPER',
}) });
assert.throws(() => checkSyncActions(wrongRole, 'day'), /authored Sync surface role/,
  'wrong spec role is rejected by the same authored consumer checks');

}
if(selectedCase==='status-semantics') {
const SourcePage = selectedProductionMethods(new URL('../entry/src/main/ets/features/source/SourceManagementPage.ets', import.meta.url),'SourceManagementPage',
  ['statusBadgeBackground', 'statusBadgeDot'],{readerAppColor});
const page = new SourcePage();
for (const scheme of ['day', 'night']) {
  page.appThemeScheme = scheme;
  const good = page.statusBadgeDot({ checkState: 'passed' });
  const error = page.statusBadgeDot({ checkState: 'failed' });
  const muted = page.statusBadgeDot({ checkState: 'unchecked' });
  assert.equal(new Set([good, error, muted]).size, 3, 'status meanings remain distinct');
  const channels = color => [color.slice(3, 5), color.slice(5, 7), color.slice(7, 9)].map(v => parseInt(v, 16));
  const [gr, gg, gb] = channels(good), [er, eg, eb] = channels(error);
  assert.ok(gg > gr && gg > gb, 'success remains green');
  assert.ok(er > eg && er > eb, 'failure remains red');
  for (const state of ['passed', 'failed', 'unchecked']) {
    const background = page.statusBadgeBackground({ checkState: state });
    assert.match(background,/^#[0-9a-f]{8}$/i,'current semantic tint is a valid native color');
  }
}
}
console.log('selected local-theme actual consumer case PASS: '+selectedCase);

}
