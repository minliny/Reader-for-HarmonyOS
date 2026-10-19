import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"native-sheet-action-admission": {"description": "当前真实book sheet一次动作/旧opening/退役与intrinsic exterior", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {
const {default: assert} = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { createHash } = await import('node:crypto');
const { boundedSurfaceSdk, boundedMembers } = await import('./lib/bounded-surface-sdk-probe.mjs');
const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
const { readerAppColor } = await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');


const read = path => readFileSync(new URL(`../entry/src/main/ets/${path}`, import.meta.url), 'utf8');
const source = read('features/bookshelf/BookshelfBookActionSheet.ets');
const actionsSource = read('features/common/ReaderSheetActionList.ets');
const baseline = JSON.parse(readFileSync(new URL('./fixtures/design/bookshelf-sheet-shared-baseline.json', import.meta.url)));


// Current user-approved scope: one native source-style exterior, intrinsic
// content/header flow and four vertical actions. Historical source remains
// provenance above, not an equality oracle for the rejected 270/24 box.
const approvedBookSheet={contentBottom:20,titleSize:24,titleLine:32.4,icon:22,tile:36,row:56,secondaryRow:72,divider:.5,dividerInset:48};
const rendererSource=read('features/common/ReaderActionMenuSurface.ets');
const contentSource=read('features/common/ReaderActionSheetContent.ets');
// ColorMetrics and ColorFilter are native ports. Feed the two actual theme
// resources as channels, and retain the production matrix without inventing
// a host rasterizer or replacing the bookshelf business/render methods.
const themeRegistry=JSON.parse(readFileSync(new URL('../../Reader-UI/theme/registry.json',import.meta.url),'utf8'));
const iconResources=new Map(['day','night'].map(scheme=>{
  const c=themeRegistry.appRoles.TOK_DOWNLOAD_GREEN_INK[scheme];
  return [readerAppColor('TOK_DOWNLOAD_GREEN_INK',scheme),{red:c.r,green:c.g,blue:c.b,alpha:Math.round(c.a*255)}];
}));
class NativeColorFilter {
  constructor(matrix){assert.equal(matrix.length,20);assert.ok(matrix.every(Number.isFinite));this.matrix=[...matrix];}
}
const iconPlatform={ColorMetrics:{resourceColor(value){assert.ok(iconResources.has(value),'only the approved icon foreground crosses the native color port');return iconResources.get(value);}},ColorFilter:NativeColorFilter};
const mapPixel=(matrix,pixel)=>Array.from({length:4},(_,row)=>
  matrix.slice(row*5,row*5+4).reduce((sum,value,index)=>sum+value*pixel[index],matrix[row*5+4]));
function verifyStrokeFilter(icon,scheme){
  assert.deepEqual([icon.width,icon.height],[approvedBookSheet.icon,approvedBookSheet.icon]);
  assert.equal(icon.fillColor,undefined,'fillColor alone cannot recolor the actual SVG stroke');
  assert.ok(icon.colorFilter instanceof NativeColorFilter,'the actual native Image receives the production color filter');
  const channels=iconResources.get(readerAppColor('TOK_DOWNLOAD_GREEN_INK',scheme)),matrix=icon.colorFilter.matrix;
  assert.deepEqual(matrix,[0,0,0,0,channels.red,0,0,0,0,channels.green,0,0,0,0,channels.blue,0,0,0,channels.alpha/255,0]);
  const resource=String(icon.create);assert.match(resource,/^app\.media\./);
  const svg=readFileSync(new URL('../entry/src/main/resources/base/media/'+resource.slice('app.media.'.length)+'.svg',import.meta.url),'utf8');
  const strokes=[...svg.matchAll(/\bstroke="(#[0-9a-fA-F]{6})"/g)].map(match=>match[1]);
  assert.ok(strokes.length>0,`${resource}: prove against the real stroke-bearing asset rather than a fill-only surrogate`);
  for(const stroke of strokes){
    const rgb=[1,3,5].map(index=>parseInt(stroke.slice(index,index+2),16));
    for(const alpha of [0,1,64,128,255]){
      const mapped=mapPixel(matrix,[...rgb,alpha]);
      assert.deepEqual(mapped.slice(0,3),[channels.red,channels.green,channels.blue],`${resource}: old black/grey/green/inverse stroke maps to the same theme foreground`);
      assert.equal(mapped[3],alpha*channels.alpha/255,`${resource}: transparent and antialiased alpha remains intact`);
    }
  }
}

function open(id = 'opening:1', options = {}, extra = {}) {
  const p = boundedSurfaceSdk(options);
  p.hooks.lifecycleChildren = true;
  p.hooks.childSources.ReaderActionMenuSurface=rendererSource;
  p.deps.ReaderActionMenuSurface=createReaderBuilderProbe(rendererSource,boundedMembers(rendererSource),{...p.deps,...iconPlatform},p.hooks).Component;
  p.hooks.childSources.ReaderActionSheetContent=contentSource;
  p.deps.ReaderActionSheetContent=createReaderBuilderProbe(contentSource,boundedMembers(contentSource),p.deps,p.hooks).Component;
  p.hooks.childSources.ReaderSheetActionList = actionsSource;
  p.deps.ReaderSheetActionList = createReaderBuilderProbe(actionsSource, boundedMembers(actionsSource), p.deps, p.hooks).Component;
  const calls = [];
  const input = options.leafSource ?? source;
  const owner = p.consumer(input, boundedMembers(input), {}, { presentationId: id,
    isCurrent: candidate => candidate === id,
    onMultiSelect: () => calls.push('select'), onBookInfo: () => calls.push('info'),
    onEditGroup: () => calls.push('group'), onRemoveFromBookshelf: () => calls.push('remove'), ...extra });
  owner.initialRender();
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

  assert.equal(title.width,'100%');assert.equal(title.position,undefined);
  assert.equal(headerNodes.some(node=>node.position!==undefined),false,'header no longer places its title/grip at fixed offsets');
  assert.equal(next.content.variant,'bookshelf','the book-specific vertical recipe cannot silently fall back to quick tiles');
  const contentNodes = next.p.walk(next.content).flatMap(child => [...child.nodes.values()]);
  for (const label of ['多选', '书籍信息', '编辑分组', '移除书架']) {
    assert.ok(contentNodes.some(node => node.type === 'Text' && node.create === label), `${scheme}: shared content renders ${label}`);
  }
  assert.ok(contentNodes.some(node => node.type === 'Text' && node.create === '多选' && node.fontColor === readerAppColor('TOK_INK', scheme)),
    `${scheme}: ordinary action keeps the current theme ink`);
  assert.ok(contentNodes.some(node => node.type === 'Text' && node.create === '移除后可在书籍详情中重新加入' && node.fontColor === readerAppColor('TOK_MUTED', scheme)),
    `${scheme}: secondary state keeps the current theme muted role`);
  assert.ok(contentNodes.some(node => node.type === 'Text' && node.create === '移除书架' && node.fontColor === readerAppColor('TOK_DOWNLOAD_DANGER', scheme)),
    `${scheme}: danger action keeps the shared danger role`);
  const hits=next.buttons();assert.equal(hits.length,4);
  assert.ok(hits.every(node=>node.type==='Row'),'every action is one vertical native row rather than a horizontal quick tile');

  assert.ok(hits.every(node=>node.height===undefined&&node.position===undefined),'row minimums admit natural content height');
  const tiles=contentNodes.filter(node=>node.type==='Stack'&&node.width===approvedBookSheet.tile&&node.height===approvedBookSheet.tile);
  assert.deepEqual(tiles.map(node=>node.backgroundColor),['TOK_GREEN','TOK_GREEN','TOK_GREEN','TOK_DOWNLOAD_DANGER'].map(role=>readerAppColor(role,scheme)));
  const icons=contentNodes.filter(node=>node.type==='Image');assert.equal(icons.length,4);
  for(const icon of icons)verifyStrokeFilter(icon,scheme);
  const secondary=contentNodes.find(node=>node.type==='Text'&&node.create==='移除后可在书籍详情中重新加入');
  assert.equal(secondary.maxLines,undefined);assert.equal(secondary.textOverflow,undefined,'the business consequence may grow with text/font scale');
  const lines=contentNodes.filter(node=>node.type==='Row'&&node.height===approvedBookSheet.divider);
  assert.equal(lines.length,3);
  const actionNodes=next.p.walk(next.actionOwner).flatMap(child=>[...child.nodes.values()]);
  assert.equal(actionNodes.some(node=>node.type==='Scroll'||node.position!==undefined||node.height==='100%'),false,'native fit-content owns the extent without an inner full-height scroll box');
  assert.equal(next.p.walk(next.owner).filter(child => child instanceof next.p.deps.ReaderBoundedSurface).length, 1);
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
