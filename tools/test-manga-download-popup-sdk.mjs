import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {boundedMembers,boundedSurfaceSdk} from './lib/bounded-surface-sdk-probe.mjs';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {READER_MANGA_DOWNLOAD_POPUP} from '../entry/src/main/ets/features/common/ReaderMangaDownloadPopupSpec.ts';
import {READER_FONT_NOTO_SANS_SC_UI_REGULAR} from '../entry/src/main/ets/features/common/ReaderFontFamilies.ts';

const read=file=>readFileSync(new URL('../entry/src/main/ets/'+file,import.meta.url),'utf8');
const popupSource=read('features/common/ReaderMangaDownloadPopup.ets');
const panelSource=read('features/manga/MangaDownloadOperationsPanel.ets');
const pageSource=read('features/bookshelf/BookDirectoryPage.ets');
const sdk=boundedSurfaceSdk();
sdk.hooks.lifecycleChildren=true;
const deps={...sdk.deps,READER_MANGA_DOWNLOAD_POPUP,READER_FONT_NOTO_SANS_SC_UI_REGULAR,
  Placement:{BottomLeft:'Placement.BottomLeft'}};
sdk.hooks.childSources.MangaDownloadOperationsPanel=panelSource;
deps.MangaDownloadOperationsPanel=createReaderBuilderProbe(panelSource,boundedMembers(panelSource),deps,sdk.hooks).Component;
sdk.hooks.childSources.ReaderMangaDownloadPopup=popupSource;
deps.ReaderMangaDownloadPopup=createReaderBuilderProbe(popupSource,boundedMembers(popupSource),deps,sdk.hooks).Component;
const ownNodes=owner=>[...owner.nodes.values()];
const buttonLabel=node=>Array.isArray(node.createWithLabel)?node.createWithLabel[0]:node.createWithLabel;
function panel(owner){
  const panels=sdk.walk(owner).filter(child=>child instanceof deps.MangaDownloadOperationsPanel);
  assert.equal(panels.length,1,'mount the actual existing MangaDownloadOperationsPanel instance');
  return panels[0];
}
const panelNodes=owner=>sdk.nodes(panel(owner));
const actionButton=(owner,label)=>panelNodes(owner).find(node=>
  (node.type==='Button'&&buttonLabel(node)===label)||(node.type==='Row'&&node.accessibilityText===label));
const action={id:'downloadChapter',label:'下载本章'};
function popup(params){return createReaderBuilderProbe(popupSource,boundedMembers(popupSource),deps,
  {...sdk.hooks,initialParams:{specId:'manga-download',visible:true,generation:7,actions:[action],...params}}).owner;}

for(const availableWidth of [180,240,400]){
  const calls=[],owner=popup({availableWidth,onOpen:()=>calls.push('open'),onClosed:g=>calls.push(['closed',g]),
    onAction:(id,g)=>calls.push(['action',id,g]),onRetry:g=>calls.push(['retry',g])});
  owner.initialRender();
  const anchor=ownNodes(owner).find(n=>n.bindPopup),image=ownNodes(owner).find(n=>n.type==='Image');
  assert.deepEqual([anchor.width,anchor.height,image.width,image.height],[44,44,20,20]);
  anchor.onClick();assert.deepEqual(calls,['open']);
  const [visible,native]=anchor.bindPopup;
  assert.equal(visible,true);assert.equal(native.placement,'Placement.BottomLeft');assert.equal(native.enableArrow,false);
  owner.generation=8;native.builder();
  const scroll=ownNodes(owner).find(n=>n.type==='Scroll');
  assert.deepEqual([scroll.width,scroll.constraintSize.maxHeight,scroll.padding],[Math.min(240,availableWidth),340,8],
    'original native popup keeps measured width clamp including narrow windows');
  const button=actionButton(owner,action.label);
  assert.ok(button,'actual shared grouped action row is mounted inside the existing manga panel');
  assert.equal(button.constraintSize.minHeight,50,'the action exposes the shared minimum touch row while allowing larger text');
  const label=panelNodes(owner).find(n=>n.type==='Text'&&n.create===action.label);
  assert.deepEqual([label.fontSize,label.fontFamily],[14,READER_FONT_NOTO_SANS_SC_UI_REGULAR]);
  assert.ok(panelNodes(owner).some(n=>n.type==='Text'&&n.create==='下载任务'),'the download category is visible');
  button.onClick();native.onStateChange({isVisible:false});
  assert.deepEqual(calls,['open',['action',action.id,7],['closed',7]],'native popup callbacks retain their opening generation');
}
const unknown=popup({specId:'private99'});assert.throws(()=>unknown.initialRender(),/Unsupported manga download popup specification/);
const loading=popup({loading:true});loading.popupContent(7);
assert.ok(panelNodes(loading).some(n=>n.type==='Text'&&n.create==='正在读取下载状态…'));
const retryCalls=[],failed=popup({failureMessage:'下载状态暂时无法读取，请重试',onRetry:g=>retryCalls.push(g)});
failed.popupContent(7);actionButton(failed,'重试').onClick();
assert.deepEqual(retryCalls,[7]);

// The visual adapter cannot dispatch a row whose authoritative action list has
// changed while its captured callback is still reachable.
const revokedCalls=[],revoked=popup({onAction:id=>revokedCalls.push(id)});
revoked.popupContent(7);const revokedButton=actionButton(revoked,action.label),revokedPanel=panel(revoked);
revokedPanel.loading=true;revokedButton.onClick();
revokedPanel.loading=false;revokedPanel.failureMessage='状态读取失败';revokedButton.onClick();
revokedPanel.failureMessage='';revokedPanel.actions=[];revokedButton.onClick();
assert.deepEqual(revokedCalls,[],'loading, failed and revoked rows cannot dispatch');
const cleanup=popup({actions:[action,{id:'deleteDownloads',label:'删除下载'},{id:'clearCache',label:'清除普通阅读缓存'}]});
cleanup.popupContent(7);
const cleanupTexts=panelNodes(cleanup).filter(n=>n.type==='Text');
assert.deepEqual(cleanupTexts.filter(n=>['下载任务','存储清理'].includes(n.create)).map(n=>n.create),['下载任务','存储清理']);
const deleteLabel=cleanupTexts.find(n=>n.create==='删除下载');
assert.notEqual(deleteLabel.fontColor,cleanupTexts.find(n=>n.create===action.label).fontColor,'storage deletion has a distinct danger tone');
assert.equal(panelNodes(loading).some(n=>n.type==='Row'&&n.accessibilityText===action.label),false,'loading does not expose stale actions');
assert.equal(panelNodes(failed).some(n=>n.type==='Row'&&n.accessibilityText===action.label),false,'failure exposes retry only');

// Exercise original parent methods and captured native callbacks. The shared
// chrome cannot bypass book identity, load generation, ready rows or teardown.
const pending=[],downloads=[];
const page=createReaderBuilderProbe(pageSource,['mangaDownloadMenuButton','openDownloadActions','performDownloadAction','identity',
  'downloadMenuVisible','downloadActions','downloadActionsLoading','downloadActionsFailure',
  'downloadMenuChapterIndex','downloadMenuGeneration','downloadMenuIdentity'],deps,sdk.hooks).owner;
assert.equal(page.downloadMenuGeneration,0,'use the real production constructor rather than an undefined/NaN load clock');
Object.assign(page,{mounted:true,sourceId:'source',bookId:'one',contentKind:'manga',mangaDownloadEnabled:true,
  contentFrame:()=>({width:180}),onLoadDownloadActions:index=>new Promise(resolve=>pending.push({index,resolve})),
  onDownloadAction:async(id,index)=>{downloads.push([id,index]);}});
const menu=async index=>{
  const promise=page.openDownloadActions(index);
  pending.at(-1).resolve([action]);await promise;
  page.mangaDownloadMenuButton();
  const child=[...page.children.values()].filter(c=>c instanceof deps.ReaderMangaDownloadPopup).at(-1);
  const anchor=ownNodes(child).find(n=>n.bindPopup);return {child,native:anchor.bindPopup[1]};
};
const old=await menu(2);
const nextPromise=page.openDownloadActions(3),nextGeneration=page.downloadMenuGeneration;
old.native.builder();const oldButton=actionButton(old.child,action.label);
oldButton.onClick();old.child.onRetry(nextGeneration-1);old.native.onStateChange({isVisible:false});
assert.equal(pending.length,2,'old retry cannot create another load');assert.equal(page.downloadMenuVisible,true);
assert.deepEqual(downloads,[],'old native action cannot dispatch against the new generation');
pending.at(-1).resolve([action]);await nextPromise;
page.bookId='two';old.child.onAction(action.id,page.downloadMenuGeneration);old.child.onRetry(page.downloadMenuGeneration);
old.child.onClosed(page.downloadMenuGeneration);
assert.equal(page.downloadMenuVisible,true);assert.equal(pending.length,2);assert.deepEqual(downloads,[],
  'captured old book identity rejects even a supplied current generation');
const active=await menu(4);active.native.builder();
actionButton(active.child,action.label).onClick();
assert.deepEqual(downloads,[[action.id,4]]);assert.equal(page.downloadMenuVisible,false);
page.mounted=false;active.child.onOpen();active.child.onRetry(page.downloadMenuGeneration);
assert.equal(pending.length,3,'unmounted parent cannot reopen');
console.log('PASS manga native popup: grouped shared download actions, danger hierarchy, loading/failure/revocation admission, finite popup geometry, native generation and parent identity/teardown fencing');
