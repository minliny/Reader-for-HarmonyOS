// Explicit issue-local SDK/method evidence. This file is not a default gate.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
registerHooks({resolve(specifier, context, next) {
  try { return next(specifier, context); }
  catch (error) { if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) return next(specifier + '.ts', context); throw error; }
}});
const { boundedSurfaceSdk, boundedMembers } = await import('../../lib/bounded-surface-sdk-probe.mjs');
const { createReaderBuilderProbe } = await import('../../lib/reader-control-builder-probe.mjs');
const projection = await import('../../../entry/src/main/ets/features/downloads/SharedDownloadProjection.ts');
const visual = await import('../../../entry/src/main/ets/features/common/SharedDownloadVisualSpec.ts');
const metrics = await import('../../../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');
const {ReaderTransientFeedback} = await import('../../../entry/src/main/ets/features/common/ReaderTransientFeedback.ts');
const {findReaderTheme} = await import('../../../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
const read = path => readFileSync(new URL('../../../' + path, import.meta.url), 'utf8');
const pagePath = 'entry/src/main/ets/features/downloads/SharedDownloadPage.ets';
const source = read(pagePath);
const coordinatorSource=read('entry/src/main/ets/app/ReaderWindowCoordinator.ts');
const chromeClass=stripTypeScriptTypes(coordinatorSource.slice(coordinatorSource.indexOf('export class ReaderWindowChromeStyle'),coordinatorSource.indexOf('\nclass ReaderWindowChromeRequest'))).replace(/^export /gm,'');
const ReaderWindowChromeStyle=new Function('findReaderTheme',chromeClass+'\nreturn ReaderWindowChromeStyle;')(findReaderTheme);
const iconSource = stripTypeScriptTypes(read('entry/src/main/ets/features/common/ReaderActionIconResources.ets')).replace(/^export /gm, '');
const readerActionIcon = new Function('$r', iconSource + '\nreturn readerActionIcon;')(key => key);
const ui = boundedSurfaceSdk();
const viewport = metrics.createDefaultReaderWindowMetrics();
viewport.windowRect = {left:0,top:0,width:390,height:800};
const intents = [];
const pageDeps = {
  ...ui.deps,
  ...visual, ...projection, ...metrics, readerActionIcon, ReaderWindowChromeStyle, ReaderTransientFeedback,
  // Native color composition is outside this business/layout probe.
  readerScrimmedOpaqueColor: base => base,
  ReaderWindowCoordinator:{metrics:()=>viewport,requestOverlayChrome(){},requestAppChrome(){}},
};
// Register the concurrent dialog component's actual schema for SDK lowering.
// This probe does not render or claim acceptance of that separate dialog host.
const pageHooks = {...ui.hooks, componentName:'SharedDownloadPage', childSources:{
  ...ui.childSources,
  ReaderDialogSurface:read('entry/src/main/ets/features/common/ReaderDialogSurface.ets'),
}};
const owner = createReaderBuilderProbe(source, boundedMembers(source, 'SharedDownloadPage'), pageDeps, pageHooks).owner;
Object.assign(owner, {mounted:true, mountedIdentity:'approved-controls',presentationIdentity:'approved-controls',presentationGeneration:0,
  sheet:'book-actions', actionChapterIndices:[], actionBookKeys:['book'], operationsHeaderMeasuredHeight:60,
  pageHeight:780, onIntent:intent=>intents.push(intent), appThemeScheme:'day'});
const chapter = (index, localComplete, queueState) => ({key:`chapter:${index}`,sourceId:'source',bookId:'id',index,title:`chapter ${index}`,chapterId:`id:${index}`,navigable:true,localComplete,queueState,stateLabel:''});
const book = chapters => ({key:'book',sourceId:'source',bookId:'id',title:'实际书名',chapters,projectionStatus:'ready',totalChapters:3,downloadedChapters:chapters.filter(c=>c.localComplete).length});
for (const [name, chapters, expected] of [
  ['none',[chapter(0,false,'missing'),chapter(1,false,'missing'),chapter(2,false,'missing')],['download','下载',true]],
  ['running',[chapter(0,true,'cached'),chapter(1,false,'inProgress'),chapter(2,false,'queued')],['cancel','取消下载',true]],
  ['partial',[chapter(0,true,'cached'),chapter(1,false,'missing'),chapter(2,false,'missing')],['download','下载',true]],
  ['paused',[chapter(0,true,'cached'),chapter(1,false,'paused'),chapter(2,false,'missing')],['cancel','取消下载',true]],
  ['failed',[chapter(0,true,'cached'),chapter(1,false,'failed'),chapter(2,false,'missing')],['cancel','取消下载',true]],
  ['complete',[chapter(0,true,'cached'),chapter(1,true,'cached'),chapter(2,true,'cached')],['download','已下载',false]],
]) {
  owner.books=[book(chapters)];
  const rows=owner.operationsActions();
  assert.equal(rows.length,2,name+' always uses the same two existing rows');
  assert.deepEqual([rows[0].id,rows[0].label,rows[0].enabled],expected,name);
  assert.equal(rows[1].id,'deleteLocal');
}
owner.books=[{...book([chapter(0,true,'cached')]),totalChapters:3,downloadedChapters:3}];
assert.notEqual(owner.operationsActions()[0].label,'已下载','an incomplete catalog cannot prove all downloaded');
owner.books=[{...book([]),projectionStatus:'unavailable'}];
assert.equal(owner.operationsActions()[0].enabled,false,'unavailable facts cannot enable download');
owner.books=[book([chapter(0,true,'cached'),chapter(1,true,'cached'),chapter(2,true,'cached')])];
owner.performOperationsAction('download',0);
assert.equal(intents.length,0,'a stale click is rechecked against current completion');
owner.books=[book([chapter(0,true,'cached'),chapter(1,false,'inProgress'),chapter(2,false,'missing')])];
owner.performOperationsAction('cancel',0);
assert.equal(owner.confirmation,'cancel');
assert.equal(intents.length,0,'cancel still opens the original confirmation');
owner.sendAction('cancel');
assert.equal(intents[0].scope,'books');
assert.equal(intents[0].books[0].chapterIndices,undefined);
owner.sheet='chapter-actions';owner.actionChapterIndices=[1,2];
assert.deepEqual(owner.operationsActions().map(row=>row.label),['暂停','取消下载任务','删除本地内容']);
owner.sendAction('pause');
assert.equal(intents[1].scope,'chapters');
assert.deepEqual(Array.from(intents[1].books[0].chapterIndices),[1,2]);
const baseline=execFileSync('git',['show','8a8328822d9002a8f6fb044ed508a7cc6b000bac:'+pagePath],{encoding:'utf8',cwd:new URL('../../../',import.meta.url)});
for(const method of ['selectionDock','quickSelectChapters','captureSelection','sendAction','performOperationsAction','actionAvailable']) {
  const take=text=>{const start=text.indexOf(`private ${method}(`);assert.ok(start>=0);const next=text.indexOf('\n  private ',start+1);const builder=text.indexOf('\n  @Builder',start+1);const ends=[next,builder].filter(n=>n>=0);return text.slice(start,ends.length?Math.min(...ends):text.length).replaceAll('.clip(true)','').trim();};
  assert.equal(take(source),take(baseline),method+' retains existing chapter behavior');
}
owner.sheet='book-actions';owner.actionChapterIndices=[];
assert.equal(owner.sheetTitle(),'实际书名');
assert.equal(owner.operationsBottomInset(),20);
owner.bookOperationsBodyMeasuredHeight=134;
assert.equal(owner.bookOperationsBodyHeight(),134,'the book body follows the real content receipt');
owner.operationsBody();ui.properties.flush();
const bodyScroll=ui.nodes(owner).filter(n=>n.type==='Scroll').at(-1);
assert.equal(bodyScroll.height,134);
const content=ui.nodes(owner).find(n=>typeof n.onAreaChange==='function'&&n.padding?.bottom===0);
assert.ok(content,'book content has no second bottom padding');
assert.equal(owner.leftInset(),8);assert.equal(owner.dockLeftInset(),30);
owner.fontsReady=true;owner.managing=false;owner.detailKey='';owner.books=[];owner.bookPage();
const list=ui.nodes(owner).filter(n=>n.type==='List').at(-1);
assert.equal(list.padding,undefined,'native viewport is not shrunk by bar clearance');
assert.equal(list.contentStartOffset,owner.contentTop());
assert.equal(list.contentEndOffset,owner.contentBottom(visual.DOWNLOAD_VISUAL.contentBottom));
for(let i=0;i<4;i++)await Promise.resolve();
console.log('PASS issue-local production SDK/method probe: book states, live admission, original chapter scope, body height, native List offsets');
