import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {registerHooks} from 'node:module';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
registerHooks({resolve(s,c,next){try{return next(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return next(s+'.ts',c);throw e;}}});
const {boundedSurfaceSdk,boundedMembers}=await import('./lib/bounded-surface-sdk-probe.mjs');
const {createReaderBuilderProbe}=await import('./lib/reader-control-builder-probe.mjs');
const {readingDirectoryRecovery,EMPTY_READING_DIRECTORY_RECOVERY}=await import('../entry/src/main/ets/features/reading/presentation/ReadingDirectoryRecovery.ts');
const {projectPersistedReceipt}=await import('../entry/src/main/ets/app/ReaderPersistedReceiptProjection.ts');
const selected=selectContractCases({
 'bookmark-facts':{description:'Actual reader projection and LRE shared recovery host classify current, partial, confirmed-readback, unknown and undispatched failure with original-owner retirement',resources:[]},
 'directory-consumers':{description:'Actual text/manga directory recovery consumers deliver retained activity Props and reject stale book, presentation, opening and locally hidden actors',resources:[]},
});
const read=name=>readFileSync(new URL('../entry/src/main/ets/features/reading/ui/'+name+'.ets',import.meta.url),'utf8');

function directoryConsumer(page, kind, interactive = true, initialState = {}) {
 const book = { sourceId: 'source-a', bookId: 'book-a', title: 'A', author: 'Author' };
 const operation = { action: 'createPosition', book, generation: 8, confirmedCount: 1,
  requestedCount: kind === 'readback' ? 1 : 3, completion: kind === 'readback' ? 'complete' : 'partial',
  canContinueOriginal: false,
  projection: projectPersistedReceipt({ confirmation: 'confirmed', readback: kind === 'readback' ? 'failed' : 'succeeded',
   generation: 8, canRetry: kind === 'readback', message: '原owner结果', refreshError: kind === 'readback' ? '列表读取失败' : undefined }) };
 const recovery = readingDirectoryRecovery('presentation-a', book, operation);
 const sdk = boundedSurfaceSdk(), messages = [], calls = [];
 class Feedback {
  show(_context, options, current) { if (!current()) return false; messages.push({ options, current }); return true; }
  reset() {}
 }
 const surfaceSource = read('ReaderDirectoryRecoverySurface');
 sdk.hooks.childSources.ReaderDirectoryRecoverySurface = surfaceSource;
 sdk.deps.ReaderDirectoryRecoverySurface = createReaderBuilderProbe(surfaceSource, boundedMembers(surfaceSource),
  { ...sdk.deps, ReaderTransientFeedback: Feedback, EMPTY_READING_DIRECTORY_RECOVERY }, sdk.hooks).Component;
 const source = read(page);
 const names = ['recoveryContent', 'recoveryPresentationIdentity', 'recoveryPresentationCurrent', 'directoryInputIsCurrent', 'identity'];
 const owner = sdk.consumer(source, boundedMembers(source).filter(name => names.includes(name)), { EMPTY_READING_DIRECTORY_RECOVERY });
 let opening = true;
 Object.assign(owner, { sourceId: book.sourceId, bookId: book.bookId, directoryRecovery: recovery,
  mounted: true, interactive, temporaryBackIdentity: 'mount-a', exitRequested: false,
  directoryRulesVisible: false, offlineMenuVisible: false, mangaFontsReady: true,
  downloadMenuVisible: false, admittedIdentity: 'source-a\u0000book-a', isOpeningCurrent: () => opening,
  onReconcileBookmarks: (...args) => calls.push(args), onContinueBookmarks: (...args) => calls.push(['continue', ...args]),
  onReconcileOffline: (...args) => calls.push(['offline', ...args]), onContinueOffline: (...args) => calls.push(['offline-continue', ...args]) });
 Object.assign(owner, initialState);
 owner.recoveryContent(); sdk.properties.flush();
 const shared = sdk.walk(owner).find(child => child instanceof sdk.deps.ReaderDirectoryRecoverySurface);
 assert.ok(shared, page + ' mounts the actual shared Surface');
 const button = label => {
  const action = sdk.walk(shared).find(child => child instanceof sdk.deps.ReaderRecoveryAction && child.label === label);
  assert.ok(action, page + ' actual action ' + label);
  const physical = [...action.nodes.values()].find(node => node.type === 'Button' && node.onClick);
  assert.ok(physical); return physical.onClick;
 };
 return { owner, shared, messages, calls, button, setOpening(value) { opening = value; },
  deliver() { owner.replayOnly([shared.id]); sdk.properties.flush();
   assert.equal(sdk.walk(owner).find(child => child instanceof sdk.deps.ReaderDirectoryRecoverySurface), shared,
    page + ' activity delivery retains the same Surface'); } };
}

function verifyDirectoryConsumers() {
 for (const page of ['ReaderFullDirectory', 'BookDirectoryPage']) {
  const retained = directoryConsumer(page, 'readback', false);
  assert.equal(retained.shared.presentationActive, false, page + ' passes its initial inactive state');
  assert.equal(retained.messages.length, 0, page + ' does not publish from an initially hidden retained caller');
  retained.shared.presentationActive = true;
  assert.equal(retained.messages.length, 0, 'a stale active Prop cannot borrow the real inactive directory lease');
  assert.equal(retained.shared.notifiedReadbacks.size, 0);
  retained.shared.presentationActive = false;
  retained.owner.interactive = true; retained.deliver();
  assert.equal(retained.shared.presentationActive, true);
  assert.equal(retained.messages.length, 1, page + ' delivers one newly current readback feedback');
  retained.owner.interactive = false; retained.deliver();
  retained.owner.interactive = true; retained.deliver();
  assert.equal(retained.messages.length, 1, 'the delivered readback identity survives hide/show without duplication');

  const axes = [
   ['interactive', x => { x.owner.interactive = false; }],
   ['opening', x => x.setOpening(false)],
   ['mounted', x => { x.owner.mounted = false; }],
   ['source', x => { x.owner.sourceId = 'source-b'; }],
   ['book', x => { x.owner.bookId = 'book-b'; }],
   ['presentation', x => { x.owner.directoryRecovery = { ...x.owner.directoryRecovery, presentationId: 'presentation-b' }; }],
   ['mount-identity', x => { x.owner.temporaryBackIdentity = 'mount-b'; }],
  ];
  if (page === 'ReaderFullDirectory') axes.push(
   ['rules', x => { x.owner.directoryRulesVisible = true; }],
   ['exit', x => { x.owner.exitRequested = true; }]);
  else axes.push(
   ['fonts', x => { x.owner.mangaFontsReady = false; }],
   ['download-menu', x => { x.owner.downloadMenuVisible = true; }],
   ['admission', x => { x.owner.admittedIdentity = 'source-a\u0000book-b'; }]);
  for (const [name, invalidate] of axes) {
   const result = directoryConsumer(page, 'result');
   const acknowledge = result.button('知道了');
   invalidate(result); acknowledge();
   assert.equal(result.shared.dismissedResults.length, 0, page + ' ' + name + ' blocks the old result before child Prop delivery');
   const readback = directoryConsumer(page, 'readback');
   const retry = readback.button('重新读取书签');
   assert.equal(readback.messages.length, 1);
   invalidate(readback); retry();
   assert.deepEqual(readback.calls, [], page + ' ' + name + ' blocks the old retry before child Prop delivery');
   assert.equal(readback.messages[0].current(), false, page + ' ' + name + ' retires the delivered feedback lease');
  }
  const current = directoryConsumer(page, 'result');
  if (page === 'ReaderFullDirectory') current.owner.offlineMenuVisible = true;
  current.button('知道了')();
  assert.equal(current.shared.dismissedResults.length, 1,
   page + ' acknowledges its current visible result, including the text directory local menu');
  if (page === 'BookDirectoryPage') {
   const menu = directoryConsumer(page, 'readback', true, { downloadMenuVisible: true });
   assert.equal(menu.messages.length, 0);
   assert.equal(menu.shared.presentationActive, false, 'the manga menu explicitly hides the retained recovery overlay');
   menu.owner.downloadMenuVisible = false; menu.deliver();
   assert.equal(menu.shared.presentationActive, true);
   assert.equal(menu.messages.length, 1);
  } else assert.equal(directoryConsumer(page, 'readback', true, { offlineMenuVisible: true }).messages.length, 1,
   'the local text menu leaves its actually visible recovery content active');
 }
}

for(const id of selected){
 if (id === 'directory-consumers') {
  verifyDirectoryConsumers();
  console.log('PASS actual text/manga directory recovery consumer activity and current-owner callbacks; no Core/native execution');
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
  const owner=sdk.consumer(read('LocalReadingExperience'),['readerRecoveryContent','readerRecoveryInputCurrent','hasReaderRecoveryContent','bookmarkRecoveryIdentity','reconcileBookmarkRecovery'],
   {EMPTY_READING_DIRECTORY_RECOVERY});
  let controls=kind==='readback';
  const empty={visible:false,canRetry:false,generation:0,message:''};
  Object.assign(owner,{bookmarkRecovery:recovery,lifecycleToken:4,readerRecoveryView:empty,readerSettingsRecovery:empty,
   ttsPreferencesRecovery:empty,ttsConfigurationRecovery:empty,replaceRecovery:empty,viewportWidth:366,
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
