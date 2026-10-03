import {makeIndex} from './lib/reading-entry-sdk-consumer.mjs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {boundedSurfaceSdk} from './lib/bounded-surface-sdk-probe.mjs';
import {fixture,seed,book,session,deferred,until,tick} from './lib/reading-entry-index-fixture.mjs';
import {ProductionHost,read,setRuntime,readingEvidence as evidence} from './lib/reading-entry-owner-probe.mjs';
import * as geometry from '../entry/src/main/ets/features/common/SurfaceHorizontalGeometry.ts';
import * as metricsApi from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import {ReaderNativeAlertOwner} from '../entry/src/main/ets/app/ReaderNativeAlertOwner.ts';
const sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const require=createRequire(import.meta.url),ts=require(sdk+'/node_modules/typescript');
const parsed=(source)=>ts.createSourceFile('/tmp/EntryConsumer.ets',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,require(sdk+'/lib/ets_checker.js').compilerOptions);
const properties=source=>parsed(source).statements.find(n=>n.members&&n.members.some(m=>m.name?.getText()==='build')).members.filter(m=>ts.isPropertyDeclaration(m)&&ts.getAllDecorators(m).length>0).map(m=>m.name.getText());
const methods=['getReadingEntryHost','readingEntryLease','applyReadingEntrySnapshot','bindReadingEntryReader','retireReadingEntryPresentation',
 'readingPreparationContext','sharedReadingPreparationSeeds','preparePersistedShelfBooks','prepareVisibleReadingBooks','onSearchVisibilityChanged',
 'openLocalBookDetail','openRemoteBookDetail','onRemoteSessionReady','installRemoteReadingSession','probeRemoteContentVerdict','refreshCachedChapterFromPrompt','chooseCachedChapterRefresh',
 'refreshDetailAcquisitionProjection','openReading','isKnownDetailChapter','presentPreparedReading','returnToReadingOrigin','applyReaderDirectoryProjection',
 'nextNavigationGeneration','retireSourceSwitchPresentation','retireRssPresentation','isCurrentRuntime','showIndexAlert','showReadingFailure',
 'externalDirectory','detailContent','detailSurface','isCurrentDetailPresentation','detailShelfAdmissionIdentity','isCurrentDetailShelfAdmission','detailReadableAdmission','detailBookKey','remoteContentVerdictLabel'];
const Runtime={current:()=>{throw Error('consumer must use captured mounted Runtime');},isCurrent:owner=>ProductionHost.forRuntime(owner).owns(owner)};
const emptyAdmission={key:'',generation:0,adding:false,cancelling:false,message:'',confirmation:'none'};
const checks=[];
{
 const f=fixture(),x=makeIndex(f,{route:'bookshelf'});x.idx.readingOriginRoute='bookshelf';
 x.idx.openRemoteBookDetail(seed(),'Source',book(),true);
 assert.equal(x.idx.route,'reading');assert.equal(x.idx.readingSessionActive,true);assert.equal(x.idx.detailBook.bookId,'book');
 assert.equal(x.idx.remoteReadingSeed.detailUrl,'book');assert.equal(f.calls.filter(c=>!['intent'].includes(c.method)).length,0);
 const scope=x.owner().snapshot().scopeId;assert.equal(x.idx.readingEntryScopeId,scope);
 assert.equal(x.idx.remoteReadingSession,undefined);assert.equal(x.idx.detailToc.length,0);
 x.idx.shelfReceiptRetired=true;x.idx.retireReadingEntryPresentation();f.close();checks.push('actual-Index-remote-shelf-first-reader-route-no-parent-detail-body-IO');
}
{
 const f=fixture(),x=makeIndex(f,{route:'bookshelf'});x.idx.readingOriginRoute='bookshelf';
 x.idx.openLocalBookDetail(book('local-book','local'),true);
 assert.equal(x.idx.route,'reading');assert.equal(x.idx.detailBook.sourceName,'本地书籍');assert.equal(f.calls.length,0);
 x.idx.applyReaderDirectoryProjection([{index:0,title:'Native first chapter',navigable:true}]);
 const scope=x.owner().snapshot().scopeId;assert.equal(x.owner().snapshot().toc[0].title,'Native first chapter');
 assert.ok(x.idx.pendingLocalDirectoryProjection);assert.equal(f.calls.length,0,'no IO before actual first-frame readiness');
 x.idx.presentPreparedReading(0);await tick();await f.settle();
 assert.equal(x.owner().snapshot().scopeId,scope,'native TOC refresh never remounts/rebinds reader scope');
 assert.equal(f.calls.filter(c=>c.method==='bookmark.list').length,1);f.close();checks.push('actual-local-reader-native-TOC-owner-same-scope-postframe-shared-directory');
}
{
 const f=fixture(),x=makeIndex(f);x.idx.openRemoteBookDetail(seed(),'Source');
 assert.equal(x.idx.route,'detail');assert.equal(x.idx.detailLoadingMessage,'正在获取在线目录…');
 const loadingLeaf=x.render();assert.equal(loadingLeaf.loadingMessage,'正在获取在线目录…');assert.equal(loadingLeaf.readingEnabled,false);
 await until(()=>x.idx.remoteContentVerdict==='readable');await f.settle();
 assert.equal(f.calls.filter(c=>c.method==='book.detail').length,1);assert.equal(f.calls.filter(c=>c.method==='book.toc').length,1);
 assert.equal(f.calls.filter(c=>c.method==='bookmark.list').length,1);
 x.idx.replay();const leaf=loadingLeaf;assert.equal(x.p.walk(x.idx).filter(c=>c instanceof x.leaf).length,1,'same-admission detail remains mounted through async property updates');assert.equal(leaf.loadingMessage,'');assert.equal(leaf.book.bookId,'book');assert.equal(leaf.toc.length,3);assert.equal(leaf.readingEnabled,true);
 assert.equal(leaf.readingBlockedReason,'');leaf.actionArea();
 const action=x.p.nodes(leaf).find(n=>n.type==='Stack'&&n.height===46&&n.accessibilityText==='开始阅读');assert.ok(action?.onClick);
 assert.equal(action.borderRadius,999);const before=f.calls.length;action.onClick();
 assert.equal(x.idx.route,'reading');assert.equal(x.idx.readingSessionActive,true);assert.equal(f.calls.length,before,'actual native action does not run parent probe again');
 f.close();checks.push('actual-Gateway-Coordinator-Entry-Index-decorated-detail-and-native-reading-action');
}
{
 const f=fixture(),x=makeIndex(f);const gate=deferred();f.gates.set('book.detail:'+f.key('s1','first'),gate);
 x.idx.openRemoteBookDetail(seed('first'),'First');await until(()=>f.calls.some(c=>c.method==='book.detail'));
 const old=x.render(),oldContinue=old.onContinue,oldBack=old.onBack;
 x.idx.openRemoteBookDetail(seed('second'),'Second');await until(()=>x.idx.remoteContentVerdict==='readable');
 const current=x.render();assert.notEqual(old,current,'different admission owns fresh regular callbacks');
 gate.resolve();await f.settle();await tick();assert.equal(x.idx.detailBook.bookId,'second');
 const nav=x.idx.navigationGeneration;oldContinue();oldBack();assert.equal(x.idx.navigationGeneration,nav);assert.equal(x.idx.route,'detail');
 current.onContinue();assert.equal(x.idx.route,'reading');f.close();checks.push('actual-old-IO-and-retained-native-detail-callback-cannot-read-new-admission');
}
{
 const f=fixture(),first=makeIndex(f);first.idx.openRemoteBookDetail(seed(),'Source');await until(()=>first.idx.remoteContentVerdict==='readable');
 const retained=first.owner();const successor=makeIndex(f,{mount:2});successor.idx.openRemoteBookDetail(seed('successor'),'Source');await until(()=>successor.idx.remoteContentVerdict==='readable');
 const scope=retained.snapshot().scopeId;first.idx.shelfReceiptRetired=true;first.idx.retireReadingEntryPresentation();
 assert.equal(successor.owner(),retained);assert.equal(retained.snapshot().scopeId,scope,'old precise teardown does not retire successor lease');
 assert.equal(successor.idx.detailBook.bookId,'successor');f.close();checks.push('actual-same-Runtime-owner-reuse-old-Index-teardown-cannot-retire-successor');
}
{
 const source=read('pages/Index.ets');
 const start=source.indexOf('  private isCurrentDetailPresentation('),end=source.indexOf('\n  @Builder',start);
 assert.ok(start>=0&&end>start);
 const broken=source.slice(0,start)+'  private isCurrentDetailPresentation(_identity: string, _owner: ReaderRuntimeOwner | undefined): boolean { return true; }\n'+source.slice(end);
 const f=fixture(),x=makeIndex(f,{indexSource:broken});x.idx.openRemoteBookDetail(seed('first'),'Source');await until(()=>x.idx.remoteContentVerdict==='readable');
 const old=x.render();x.idx.openRemoteBookDetail(seed('second'),'Source');await until(()=>x.idx.remoteContentVerdict==='readable');
 old.onContinue();assert.equal(x.idx.route,'reading','negative control proves the old physical handler borrows the new entry if its real admission guard is removed');
 assert.equal(x.idx.detailBook.bookId,'second');f.close();checks.push('negative-removed-admission-guard-exposes-real-native-old-handler-new-owner-borrow');
}
for(const mode of ['success','decline','leave','runtime-unavailable','rules-changed']){
 const f=fixture(),x=makeIndex(f);x.idx.openRemoteBookDetail(seed(),'Source',book(),true);
 x.idx.onRemoteSessionReady(session());const error=new (await import('../entry/src/main/ets/features/reading/RemoteReadingFlowGateway.ts')).RemoteChapterCacheRefreshError(session(),0,undefined,false);
 const gate=deferred();f.gates.set('chapter.content:'+f.key('s1','book'),gate);
 const work=x.idx.refreshCachedChapterFromPrompt(error,()=>!x.idx.shelfReceiptRetired);
 await until(()=>f.nativeAlert!==undefined);f.nativeAlert[mode==='decline'?'secondaryButton':'primaryButton'].action();await tick();
 if(mode==='leave')x.idx.nextNavigationGeneration();
 if(mode==='runtime-unavailable'){f.runtime.closed=true;setRuntime(undefined);}
 if(mode==='rules-changed')f.coordinator.projectionRevision+=1;
 gate.resolve();const index=await work;
 if(mode==='success'){assert.equal(index,0);assert.equal(x.idx.remoteContentVerdict,'readable');assert.equal(x.idx.remoteReadingSession.preparedChapter.chapter.chapterIndex,0);}
 else {assert.equal(index,undefined);assert.equal(x.idx.remoteReadingSession?.preparedChapter,undefined);}
 if(mode==='decline')assert.equal(f.calls.some(c=>c.p.forceRefresh),false);
 f.close();checks.push('actual-native-cache-choice-owner-exact-revision-'+mode);
}
{
 const f=fixture(),x=makeIndex(f,{route:'bookshelf'});x.idx.prepareVisibleReadingBooks([book()]);await f.settle();
 assert.ok(f.calls.some(c=>c.method==='context'));assert.equal(f.preparations.paused,false);
 x.idx.route='detail';x.idx.onSearchVisibilityChanged();assert.equal(f.preparations.paused,true);f.close();
 checks.push('actual-Index-visible-idle-preparation-delegation-context-and-pause');
}
console.log(JSON.stringify({status:'PASS',checks,scope:'full actual Entry/Gateways/Coordinator/Preparation + Index methods + decorated SDK Detail child/native closures; native layout/device/visual acceptance excluded'}));
