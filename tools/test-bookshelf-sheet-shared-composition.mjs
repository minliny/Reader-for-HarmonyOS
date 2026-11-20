import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"native-sheet-action-admission": {"description": "当前真实book sheet一次动作/旧opening/退役与intrinsic exterior", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {
const {default: assert} = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
const { boundedSurfaceSdk, boundedMembers } = await import('./lib/bounded-surface-sdk-probe.mjs');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { readerAppColor } = await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');


const read = path => readFileSync(new URL(`../entry/src/main/ets/${path}`, import.meta.url), 'utf8');
const source = read('features/bookshelf/BookshelfBookActionSheet.ets');
const actionsSource = read('features/common/ReaderSheetActionList.ets');
const actionIconApi = pureModuleProbe(read('features/common/ReaderActionIconResources.ets'), 'ReaderActionIconResources.ets', { $r: value => value }, ['readerActionIcon']);
const scaleApi = pureModuleProbe(read('features/common/ReaderSurfaceResolvers.ts'), 'ReaderSurfaceResolvers.ts', {}, ['readerReadableFontScale', 'readerScaledControlHeight']);
const touchApi = pureModuleProbe(read('features/common/ReaderActionAccessibility.ets'), 'ReaderActionAccessibility.ets', {}, ['readerActionTouchRegion']);


// Current user-approved scope: one native source-style exterior, intrinsic
// content/header flow and four vertical actions. Historical source remains
// provenance above, not an equality oracle for the rejected 270/24 box.
const approvedBookSheet={contentBottom:20,titleSize:16,titleLine:24,icon:22,tile:36,row:50,divider:.5,dividerInset:48};
const rendererSource=read('features/common/ReaderActionMenuSurface.ets');
const contentSource=read('features/common/ReaderActionSheetContent.ets');
// Preserve the current shared on-color foreground contract through the real
// themed stroke assets, rather than restoring the retired runtime tint matrix.
const themeRegistry=JSON.parse(readFileSync(new URL('../../Reader-UI/theme/registry.json',import.meta.url),'utf8'));
function verifyActionIcon(icon,scheme,kind){
  assert.deepEqual([icon.width,icon.height],[approvedBookSheet.icon,approvedBookSheet.icon]);
  assert.equal(icon.fillColor,undefined);assert.equal(icon.colorFilter,undefined,'theme paint belongs to the SVG recipe');
  const expected=`app.media.reader_action_${kind}${scheme==='night'?'_theme_night':''}`;
  assert.equal(icon.create,expected,'the actual row receives the corresponding day/night action resource');
  const svg=readFileSync(new URL('../entry/src/main/resources/base/media/'+expected.slice('app.media.'.length)+'.svg',import.meta.url),'utf8');
  const foreground=themeRegistry.appRoles.TOK_DOWNLOAD_GREEN_INK[scheme];
  const expectedStroke='#'+[foreground.r,foreground.g,foreground.b].map(channel=>channel.toString(16).padStart(2,'0')).join('').toUpperCase();
  const strokes=[...svg.matchAll(/\bstroke="(#[0-9a-fA-F]{6})"/g)].map(match=>match[1].toUpperCase());
  assert.ok(strokes.length>0,'the real resource retains stroke-bearing artwork');
  assert.ok(strokes.every(stroke=>stroke===expectedStroke),'the SVG foreground preserves the existing theme on-color contrast role');
}
// Message rendering/timers are outside this sheet-admission contract. Keep
// the real toast source registered for SDK Component/Prop syntax validation,
// while this explicit port carries priority/bounded through unchanged.
class ToastPort {
  constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id,nodes:new Map(),children:new Map()});}
  initialRender(){} aboutToAppear(){} aboutToDisappear(){}
  updateStateVars(next){Object.assign(this.params,next);}
}
function wireActionDependencies(p){
  p.hooks.childSources.ReaderTransientToast=read('features/common/ReaderTransientToast.ets');
  p.deps.ReaderTransientToast=ToastPort;
  Object.assign(p.deps,actionIconApi,scaleApi,touchApi,{ReaderWindowCoordinator:{metrics:()=>({systemFontScale:1})}});
  p.hooks.childSources.ReaderActionMenuSurface=rendererSource;
  p.deps.ReaderActionMenuSurface=createReaderBuilderProbe(rendererSource,boundedMembers(rendererSource),p.deps,p.hooks).Component;
  p.hooks.childSources.ReaderActionSheetContent=contentSource;
  p.deps.ReaderActionSheetContent=createReaderBuilderProbe(contentSource,boundedMembers(contentSource),p.deps,p.hooks).Component;
}

function open(id = 'opening:1', options = {}, extra = {}) {
  const p = boundedSurfaceSdk(options);
  p.hooks.lifecycleChildren = true;
  wireActionDependencies(p);
  p.hooks.childSources.ReaderSheetActionList = actionsSource;
  p.deps.ReaderSheetActionList = createReaderBuilderProbe(actionsSource, boundedMembers(actionsSource), p.deps, p.hooks).Component;
  const calls = [];
  const input = options.leafSource ?? source;
  const owner = p.consumer(input, boundedMembers(input), {}, { presentationId: id,
    isCurrent: candidate => candidate === id,
    onMultiSelect: () => calls.push('select'), onBookInfo: () => calls.push('info'),
    onEditGroup: () => calls.push('group'), onRemoveFromBookshelf: () => calls.push('remove'), onDismiss: () => calls.push('dismiss'), ...extra });
  owner.aboutToAppear();owner.initialRender();
  const actionOwner = p.walk(owner).find(child => child instanceof p.deps.ReaderSheetActionList);
  const content = p.walk(owner).find(child => child instanceof p.deps.ReaderActionSheetContent);
  const frame = p.walk(owner).find(child => child instanceof p.deps.ReaderBoundedSurface);
  const header = p.walk(owner).find(child => child instanceof p.deps.ReaderBoundedSurfaceHeader);
  return { p, owner, actionOwner, frame, header, calls,
    content,
    buttons: () => p.walk(actionOwner).flatMap(child => [...child.nodes.values()]).filter(node => node.onClick) };
}
function verifyIntrinsicFrame(opened){
  const frame=[...opened.frame.nodes.values()].find(node=>node.type==='Column');assert.ok(frame,'book content is normal flow rather than an absolute Stack');
  assert.equal(frame.width,'100%');assert.deepEqual(frame.padding,{bottom:approvedBookSheet.contentBottom});
  for(const property of ['height','backgroundColor','border','borderRadius','shadow','position','clip'])
    assert.ok(!opened.frame.attributeCalls.some(call=>call.id===frame.id&&call.property===property),`${property} belongs to the native Sheet, not an inner fixed/painted frame`);
  return frame;
}

for (const scheme of ['day', 'night']) {
  const next = open();
  for (const child of next.p.walk(next.owner)) if ('appThemeScheme' in child) child.appThemeScheme = scheme;
  next.p.properties.flush();
  verifyIntrinsicFrame(next);
  const headerNodes=[...next.header.nodes.values()],title=headerNodes.find(node=>node.type==='Text'&&node.create==='书籍操作');

  assert.equal(title.layoutWeight,1);assert.equal(title.position,undefined);
  assert.equal(title.fontFamily,'ReaderNotoSansSCUIMedium');assert.equal(title.fontWeight,500);
  assert.equal(title.fontSize,approvedBookSheet.titleSize);assert.equal(title.lineHeight,approvedBookSheet.titleLine);
  assert.equal(headerNodes.some(node=>node.position!==undefined),false,'header no longer places its title at fixed offsets');
  assert.equal(next.content.variant,'bookshelf','the book-specific vertical recipe cannot silently fall back to quick tiles');
  const contentNodes = next.p.walk(next.content).flatMap(child => [...child.nodes.values()]);
  for (const label of ['多选', '书籍信息', '编辑分组', '移除书架']) {
    assert.ok(contentNodes.some(node => node.type === 'Text' && node.create === label), `${scheme}: shared content renders ${label}`);
  }
  assert.ok(contentNodes.some(node => node.type === 'Text' && node.create === '多选' && node.fontColor === readerAppColor('TOK_INK', scheme)),
    `${scheme}: ordinary action keeps the current theme ink`);
  assert.ok(contentNodes.some(node => node.type === 'Text' && node.create === '移除书架' && node.fontColor === readerAppColor('TOK_DOWNLOAD_DANGER', scheme)),
    `${scheme}: danger action keeps the shared danger role`);
  const hits=next.buttons();assert.equal(hits.length,4);
  assert.ok(hits.every(node=>node.type==='Row'),'every action is one vertical native row rather than a horizontal quick tile');

  assert.ok(hits.every(node=>node.height===undefined&&node.position===undefined),'row minimums admit natural content height');
  const tiles=contentNodes.filter(node=>node.type==='Stack'&&node.width===approvedBookSheet.tile&&node.height===approvedBookSheet.tile);
  assert.deepEqual(tiles.map(node=>node.backgroundColor),['TOK_GREEN','TOK_GREEN','TOK_GREEN','TOK_DOWNLOAD_DANGER'].map(role=>readerAppColor(role,scheme)));
  const icons=contentNodes.filter(node=>node.type==='Image');assert.equal(icons.length,4);
  icons.forEach((icon,index)=>verifyActionIcon(icon,scheme,['check','info','folder','trash'][index]));
  assert.ok(hits.every(node=>node.constraintSize.minHeight===50));
  assert.ok(hits.every(node=>node.padding.top===4&&node.padding.bottom===4));
  assert.ok(tiles.every(node=>node.borderRadius===14));
  for(const label of contentNodes.filter(node=>node.type==='Text')) {
    assert.equal(label.fontFamily,'ReaderNotoSansSCUIMedium');assert.equal(label.fontWeight,500);
    assert.equal(label.fontSize,14);assert.equal(label.lineHeight,20);
  }
  const lines=contentNodes.filter(node=>node.type==='Row'&&node.height===approvedBookSheet.divider);
  assert.equal(lines.length,3);assert.ok(lines.every(node=>node.width==='calc(100% - 48vp)'&&node.margin.left===48));
  const actionNodes=next.p.walk(next.actionOwner).flatMap(child=>[...child.nodes.values()]);
  assert.equal(actionNodes.some(node=>node.type==='Scroll'||node.position!==undefined||node.height==='100%'),false,'native fit-content owns the extent without an inner full-height scroll box');
  assert.equal(next.p.walk(next.owner).filter(child => child instanceof next.p.deps.ReaderBoundedSurface).length, 1);
}
// Header close is independently admitted and never claims a business row.
{
  const opened=open();const close=[...opened.header.nodes.values()].find(node=>node.onClick);
  assert.ok(close);close.onClick();assert.deepEqual(opened.calls,['dismiss']);
  const saved=opened.owner.dismissAction('opening:1');
  opened.owner.updateStateVars({presentationId:'opening:2'});opened.p.properties.flush();
  saved();assert.deepEqual(opened.calls,['dismiss'],'old close cannot borrow the new presentation');
  opened.owner.aboutToDisappear();opened.owner.dismissAction('opening:2')();assert.deepEqual(opened.calls,['dismiss']);
}
for(const isCurrent of [()=>false,()=>{throw Error('retired');}]){
  const opened=open('opening:1',{}, {isCurrent});
  [...opened.header.nodes.values()].find(node=>node.onClick).onClick();assert.deepEqual(opened.calls,[]);
}
// More keeps the same five immediate menu actions and its own close callback.
for(const scheme of ['day','night']){
  const p=boundedSurfaceSdk();wireActionDependencies(p);const calls=[];
  const more=read('features/bookshelf/BookshelfMoreActionSheet.ets');
  const owner=p.consumer(more,boundedMembers(more),{}, {presentationId:'more:1',canCheckUpdates:true,
    isCurrent:id=>id==='more:1',onDismiss:()=>calls.push('dismiss'),onBatchManage:()=>calls.push('batch'),
    onLocalImport:()=>calls.push('import'),onCheckUpdates:()=>calls.push('update'),onDownloadsRequested:()=>calls.push('downloads'),onBookshelfSettings:()=>calls.push('settings')});
  owner.appThemeScheme=scheme;owner.aboutToAppear();owner.initialRender();
  for(const child of p.walk(owner))if('appThemeScheme' in child)child.appThemeScheme=scheme;p.properties.flush();
  const header=p.walk(owner).find(child=>child instanceof p.deps.ReaderBoundedSurfaceHeader);
  [...header.nodes.values()].find(node=>node.onClick).onClick();assert.deepEqual(calls,['dismiss']);
  const actionContent=p.walk(owner).find(child=>child instanceof p.deps.ReaderActionSheetContent);
  const rows=p.walk(actionContent).flatMap(child=>[...child.nodes.values()]).filter(node=>node.onClick);assert.equal(rows.length,5);
  const icons=p.walk(actionContent).flatMap(child=>[...child.nodes.values()]).filter(node=>node.type==='Image');
  icons.forEach((icon,index)=>verifyActionIcon(icon,scheme,['check','import','refresh','download','more'][index]));
  rows[0].onClick();rows[1].onClick();assert.deepEqual(calls,['dismiss','batch'],'More remains once-only immediate action semantics');
  const oldClose=owner.dismissAction('more:1');owner.updateStateVars({presentationId:'more:2'});p.properties.flush();oldClose();assert.deepEqual(calls,['dismiss','batch']);
  owner.aboutToDisappear();owner.dismissAction('more:2')();assert.deepEqual(calls,['dismiss','batch']);
}
for (const [index, action] of ['select', 'info', 'group', 'remove'].entries()) {
  const opened = open(); opened.buttons()[index].onClick();
  for (const button of opened.buttons()) button.onClick();
  assert.deepEqual(opened.calls, [action], 'all four operations are exclusive and claimed before dispatch');
}
{
  const opened = open(); const oldButtons = opened.buttons();
  opened.actionOwner.updateStateVars({ presentationId: 'opening:2' });
  opened.actionOwner.isCurrent = id => id === 'opening:2';
  opened.p.properties.flush();
  for (const button of oldButtons) button.onClick();
  assert.deepEqual(opened.calls, [], 'captured old physical handlers cannot dispatch to replacement opening');
  const fresh = opened.buttons().filter(button => !oldButtons.includes(button));
  assert.equal(fresh.length, 4); fresh[1].onClick();
  assert.deepEqual(opened.calls, ['info']);
  opened.actionOwner.aboutToDisappear(); fresh[2].onClick();
  assert.deepEqual(opened.calls, ['info']);
}
for (const isCurrent of [() => false, () => { throw Error('owner retired'); }]) {
  const opened = open('opening:1', {}, { isCurrent });
  for (const button of opened.buttons()) button.onClick();
  assert.deepEqual(opened.calls, [], 'retired or unavailable identity refuses all actions');
}
{
  const opened = open('opening:1', {}, { onBookInfo: () => { throw Error('actual business failure'); } });
  assert.throws(() => opened.buttons()[1].onClick(), /actual business failure/);
  for (const button of opened.buttons()) button.onClick();
  assert.deepEqual(opened.calls, [], 'business failure is not swallowed or replayed');
  const blank = open(''); for (const button of blank.buttons()) button.onClick(); assert.deepEqual(blank.calls, []);
}
assert.throws(() => {
  const bad = open('opening:1', { leafSource: source.replace('actions: (): void => { this.sheetActions(); }', 'actions: this.sheetActions') });
  assert.equal(bad.actionOwner.presentationId, 'opening:1', 'direct Builder reference loses the business receiver');
}, /opening:1/);
const frameSource = read('features/common/ReaderBoundedSurface.ets');
const frameMarker="instance.width('100%').padding({ bottom: spec.contentBottom });";
assert.ok(frameSource.includes(frameMarker));
const changedFrame = frameSource.replace(frameMarker,"instance.width('100%').height(270).padding({ bottom: spec.contentBottom });");
assert.notEqual(frameSource, changedFrame);
const changed = open('opening:1', { ReaderBoundedSurface: changedFrame });
assert.throws(()=>verifyIntrinsicFrame(changed),/height belongs to the native Sheet/,'restoring a second fixed box is rejected in the actual SDK frame');

}
