import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {registerHooks} from 'node:module';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
registerHooks({resolve(s,c,next){try{return next(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return next(s+'.ts',c);throw e;}}});
const {boundedSurfaceSdk,boundedMembers}=await import('./lib/bounded-surface-sdk-probe.mjs');
const {createReaderBuilderProbe}=await import('./lib/reader-control-builder-probe.mjs');
const {installedEtsCompiler}=await import('./lib/ets-compiler-runtime.mjs');
const {readingDirectoryRecovery,EMPTY_READING_DIRECTORY_RECOVERY}=await import('../entry/src/main/ets/features/reading/presentation/ReadingDirectoryRecovery.ts');
const {projectPersistedReceipt}=await import('../entry/src/main/ets/app/ReaderPersistedReceiptProjection.ts');
const selected=selectContractCases({
 'bookmark-facts':{description:'Actual reader projection and LRE shared recovery host classify current, partial, confirmed-readback, unknown and undispatched failure with original-owner retirement',resources:[]},
 'directory-consumers':{description:'Actual text/manga foreground directories defer recovery actors while retaining the original recovery DTO and callback contract',resources:[]},
});
const read=name=>readFileSync(new URL('../entry/src/main/ets/features/reading/ui/'+name+'.ets',import.meta.url),'utf8');

function verifyDirectoryConsumers() {
 const { ts, options } = installedEtsCompiler();
 const callbackNames = ['onReconcileBookmarks', 'onContinueBookmarks', 'onReconcileOffline', 'onContinueOffline'];
 function declaration(source, page) {
  const tree = ts.createSourceFile(page + '.ets', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  assert.deepEqual(tree.parseDiagnostics, []);
  const component = tree.statements.find(node => ts.isStructDeclaration(node));
  let actors = 0;
  const visit = node => {
   if ((ts.isCallExpression(node) || ts.isEtsComponentExpression(node)) &&
     node.expression.getText(tree) === 'ReaderDirectoryRecoverySurface') actors++;
   ts.forEachChild(node, visit);
  };
  visit(tree);
  assert.equal(actors, 0, page + ' yields original recovery presentation while its catalog owns the foreground');
  const fact = component.members.find(member => member.name?.getText(tree) === 'directoryRecovery');
  assert.equal(fact?.type?.getText(tree), 'ReadingDirectoryRecovery');
  assert.ok(ts.getAllDecorators(fact).some(decorator => decorator.getText(tree) === '@Prop'));
  for (const name of callbackNames) {
   const member = component.members.find(candidate => candidate.name?.getText(tree) === name);
   assert.equal(member?.type?.getText(tree), '(generation: number, identity: string) => void',
    page + ' keeps the original generation/presentation callback DTO for ' + name);
  }
 }
 for (const page of ['ReaderFullDirectory', 'BookDirectoryPage']) {
  const source = read(page);
  declaration(source, page);
  const sdk = boundedSurfaceSdk(), calls = [];
  const callbacks = Object.fromEntries(callbackNames.map(name => [name, (...args) => calls.push([name, ...args])]));
  const names = ['directoryRecovery', ...callbackNames];
  if (page === 'ReaderFullDirectory') names.push('bookmarkWriteEnabled');
  const owner = sdk.consumer(source, names, { EMPTY_READING_DIRECTORY_RECOVERY }, callbacks);
  const book = { sourceId: 'source-a', bookId: 'book-a', title: 'A', author: 'Author' };
  for (const confirmation of ['unknown', 'confirmed']) {
   const operation = { action: 'createPosition', book, generation: 8, confirmedCount: confirmation === 'confirmed' ? 1 : 0,
    requestedCount: 1, completion: confirmation === 'confirmed' ? 'complete' : 'unknown',
    canContinueOriginal: confirmation === 'unknown',
    projection: projectPersistedReceipt({ confirmation, readback: 'failed', generation: 8, canRetry: true }) };
   const recovery = readingDirectoryRecovery('presentation-a', book, operation);
   owner.updateStateVars({ directoryRecovery: recovery }); sdk.properties.flush();
   assert.deepEqual(owner.directoryRecovery, recovery, page + ' retains the original owner facts during foreground deferral');
   if (page === 'ReaderFullDirectory') assert.equal(owner.bookmarkWriteEnabled(), recovery.bookmarkWriteEnabled === true,
    'foreground deferral preserves the original write admission');
  }
  for (const name of callbackNames) owner[name](8, 'presentation-a');
  assert.deepEqual(calls, callbackNames.map(name => [name, 8, 'presentation-a']),
   page + ' constructor retains the original callback DTO without a replacement UI action');
  // The former actors are forbidden in the complete shipping declaration,
  // independent of which finite property members this SDK probe selects.
  const withRecovery = source.replace('  build() {', '  build() { ReaderDirectoryRecoverySurface({});');
  assert.notEqual(withRecovery, source);
  assert.throws(() => declaration(withRecovery, page), /yields original recovery presentation/);
 }
}

for(const id of selected){
 if (id === 'directory-consumers') {
  verifyDirectoryConsumers();
  console.log('PASS actual text/manga foreground recovery deferral and retained original DTO/callback contract; finite SDK ports, no Core/native execution');
  recordContractCasePass(id); continue;
 }
 const book={sourceId:'source-a',bookId:'book-a',title:'A',author:'Author'};
 const scenarios=[
  ['current','confirmed','succeeded','complete',1,1,false,'none'],
  ['partial','confirmed','succeeded','partial',1,3,false,'result'],
  ['readback','confirmed','failed','complete',1,1,false,'readback'],
  ['unknown','unknown','failed','unknown',0,1,true,'pending'],
  ['failure','undispatched','failed','notDispatched',0,1,false,'result'],
 ];
 for(const [name,confirmation,readback,completion,confirmedCount,requestedCount,canContinueOriginal,kind] of scenarios){
  const operation={action:'createPosition',book,generation:8,confirmedCount,requestedCount,completion,canContinueOriginal,
   projection:projectPersistedReceipt({confirmation,readback,generation:8,canRetry:readback==='failed',message:'原owner的具体原因',refreshError:readback==='failed'?'原owner的具体原因':undefined})};
  const recovery=readingDirectoryRecovery('presentation-a',book,operation);
  assert.equal(recovery.bookmarksKind,kind);
  const sdk=boundedSurfaceSdk(),messages=[],calls=[];
  class Feedback {show(_context,options,current){if(!current())return false;messages.push({options,current});return true;}reset(){}}
  const surface=read('ReaderDirectoryRecoverySurface');
  sdk.hooks.childSources.ReaderDirectoryRecoverySurface=surface;
  sdk.deps.ReaderDirectoryRecoverySurface=createReaderBuilderProbe(surface,boundedMembers(surface),
   {...sdk.deps,ReaderTransientFeedback:Feedback,EMPTY_READING_DIRECTORY_RECOVERY},sdk.hooks).Component;
  const owner=sdk.consumer(read('LocalReadingExperience'),['readerRecoveryContent','readerRecoveryInputCurrent','hasReaderRecoveryContent','bookmarkRecoveryIdentity','reconcileBookmarkRecovery',
   'hasReaderPendingGroup','readerBookmarkPending','readerOfflineRecoveryVisible','readerOfflinePending',
   'readerRecoveryItems','readerBookmarkRecoveryContent','readerOfflineRecoveryContent'],
   {EMPTY_READING_DIRECTORY_RECOVERY});
  let controls=kind==='readback';
  const empty={visible:false,canRetry:false,generation:0,message:''};
  Object.assign(owner,{mounted:true,exitRequested:false,readerRecoveryRequestCurrent:()=>true,
   controlVisible:()=>controls,bookmarkRecovery:recovery,lifecycleToken:4,readerRecoveryView:empty,readerSettingsRecovery:empty,
   appearanceSaveRecovery:empty,ttsPreferencesRecovery:empty,ttsConfigurationRecovery:empty,replaceRecovery:empty,viewportWidth:366,
   sourceSwitchPresentationVisible:false,controlMotionVisible:()=>controls,isControlInputEnabled:()=>true,
   isSessionActive:()=>true,controlLayout:()=>({topBarWidth:334}),readerRecoveryTop:()=>100,readerRecoveryViewportHeight:()=>180,
   readerRecoveryOverlayId:()=> 'test-recovery',onReconcileBookmarks:(generation,presentation)=>calls.push([generation,presentation]),
   onContinueBookmarks:(generation,presentation)=>calls.push(['continue',generation,presentation])});
  owner.readerRecoveryContent();sdk.properties.flush();
  const notices=sdk.walk(owner).filter(child=>child instanceof sdk.deps.ReaderRecoveryNotice);
  assert.equal(notices.length,kind==='pending'?1:0,name+' uses its original business fact category');
  const actions=sdk.walk(owner).filter(child=>child instanceof sdk.deps.ReaderRecoveryAction);
  if(kind==='none'){assert.equal(actions.length,0);assert.equal(messages.length,0);continue;}
  const shared=sdk.walk(owner).find(child=>child instanceof sdk.deps.ReaderDirectoryRecoverySurface);
  assert.equal(shared.recovery.offline.visible,false,'reader bookmark host does not mount an unrelated offline fact');
  if(kind==='readback'){
   assert.equal(messages.length,0,'a hidden retained surface does not publish its initial readback feedback');
   const initialActive=shared.presentationActive;
   shared.presentationActive=true;sdk.properties.flush();
   assert.equal(messages.length,0,'a stale active Prop cannot borrow a currently hidden caller lease');
   assert.equal(shared.notifiedReadbacks.size,0,'an undelivered feedback identity remains eligible for a later current presentation');
   shared.presentationActive=false;sdk.properties.flush();
   controls=false;
   shared.presentationActive=true;sdk.properties.flush();
   assert.equal(messages.length,1);assert.match(messages[0].options.message,/已确认.*读取失败/);
   assert.equal(initialActive,false,'the real reader bridge initially passes the hidden host activity Prop');
   assert.equal(shared.presentationActive,true,'the real child receives the current host activity Prop');
   controls=true;shared.presentationActive=false;sdk.properties.flush();
   controls=false;shared.presentationActive=true;sdk.properties.flush();
   assert.equal(messages.length,1,'a previously delivered readback identity is not repeated after hiding and showing');
   assert.ok(actions.some(action=>action.label==='重新读取书签'));
  }else assert.equal(messages.length,0);
  if(kind==='result'){
   assert.ok(actions.some(action=>action.label==='知道了'));
   const result=sdk.nodes(owner).find(node=>node.type==='Text'&&String(node.create).includes(name==='partial'?'部分书签已更新':'具体原因'));
   assert.ok(result,name+' keeps the owner result visible');
   assert.equal(calls.length,0);
   const known=actions.find(action=>action.label==='知道了');
   const physical=[...known.nodes.values()].find(node=>node.type==='Button'&&node.onClick);
   shared.isPresentationCurrent=undefined;
   shared.aboutToDisappear();physical.onClick();
   assert.equal(shared.dismissedResults.length,0,'retired ordinary-directory result actor cannot mutate dismissed state');
  }else{
   const retry=actions.find(action=>action.label===(kind==='pending'?'重新载入核对书签':'重新读取书签'));
   const button=[...retry.nodes.values()].find(node=>node.type==='Button'&&node.onClick);
   controls=true;button.onClick();assert.equal(calls.length,0,'hidden floating host cannot dispatch its retained action');
   controls=false;button.onClick();assert.deepEqual(calls,[[8,'presentation-a']]);
   owner.bookmarkRecovery={...recovery,presentationId:'presentation-b'};
   button.onClick();assert.equal(calls.length,1,'retired current-book presentation cannot borrow a successor');
   assert.equal(shared.isCurrent(shared.identities()[0]),false,'the nested feedback lease also retires before Prop delivery');
   if(messages.length)assert.equal(messages[0].current(),false);
   // Ordinary directory callers use the compatible default lease. Their
   // shared surface must retire without borrowing a parent-specific guard.
   shared.isPresentationCurrent=undefined;
   const direct=[];
   shared.onReconcileBookmarks=()=>direct.push('query');shared.onContinueBookmarks=()=>direct.push('continue');
   shared.aboutToDisappear();
   for(const action of actions){
    const retained=[...action.nodes.values()].find(node=>node.type==='Button'&&node.onClick);
    retained?.onClick();
   }
   assert.deepEqual(direct,[],'retired ordinary-directory retry and continuation actors cannot dispatch');
  }
 }
 console.log('PASS actual reader bookmark fact classification and shared current-owner actions; no Core/native execution');
 recordContractCasePass(id);
}
