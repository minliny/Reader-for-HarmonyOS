import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
import {selectedProductionMethods,selectedProductionComponentCallback,selectedProductionClasses} from './lib/selected-production-methods.mjs';
const selected=selectContractCases({
  'root-first-actions':'Actual Startup retry/exit/back, LRE loading Back and Manga ordinary Back consume live admission; dispatched/accepted navigation keeps original completion.',
  'native-selection-copy':'Actual native menu interception -> current paragraph/original-text clipboard callback and paged fallback reject live-retired COPY while consuming default.',
  'rules-first-write':'Actual presentation/normal Surface callbacks -> Orchestrator -> durable intent -> Core: live before first dispatch, finite fetch/head waits, fixed plan after first rejected ACK.',
  'rules-draft-input':'Actual SDK Rules dict form: queued native edit/toggle/save after live retirement preserve accepted draft and remount original editor identity, then accept fresh input.',
});
const root=new URL('../entry/src/main/ets/',import.meta.url),file=path=>new URL(path,root);
const calls=[];
async function rootFirstActions(){
  let current;const Startup=selectedProductionMethods(file('pages/ReaderStartupRecovery.ets'),'ReaderStartupRecovery',
    ['recoveryAction','onBackPress'],{ReaderStartupContentOwner:{current:()=>current}});
  current={retry:()=>calls.push('retry'),exit:async()=>calls.push('exit')};
  const s=Object.assign(new Startup(),{owner:current,appForeground:true,publication:3,state:{canRetry:true}});
  const retry=s.recoveryAction(3,false),exit=s.recoveryAction(3,true);s.appForeground=false;
  retry();exit();s.onBackPress();assert.deepEqual(calls,[]);s.appForeground=true;retry();exit();s.onBackPress();assert.deepEqual(calls,['retry','exit','exit']);
  s.publication++;retry();exit();assert.equal(calls.length,3,'old retry/exit publication remains retired');
  const hostPolicy=await import('../entry/src/main/ets/features/reading/ui/ReaderControlHostSession.ts');
  const Lre=selectedProductionMethods(file('features/reading/ui/LocalReadingExperience.ets'),'ReadingExperience',['readerInputIsCurrent'],hostPolicy);
  let live=true,back=0;const lre=Object.assign(new Lre(),{mounted:true,exitRequested:false,appForeground:true,windowChromeActive:true,
    interactionBlocked:false,controlObscured:false,inputCurrent:()=>live,beginExit:()=>back++});
  const loadingBack=selectedProductionComponentCallback(file('features/reading/ui/LocalReadingExperience.ets'),'ReaderChapterLoadingState','onBack',lre);
  live=false;loadingBack();assert.equal(back,0);live=true;loadingBack();assert.equal(back,1);
  const Manga=selectedProductionMethods(file('features/manga/ui/MangaReadingSurface.ets'),'MangaReadingSurface',
    ['handleBack','readerPanelForeground','performPanelAction']);
  for(const branch of ['boundary','panel','chapterEnd','zoom','exit']){
    const events=[],owner=Object.assign(new Manga(),{mounted:true,exiting:false,appForeground:true,windowChromeActive:true,windowChromeOverlayActive:false,
      interactionBlocked:false,isReaderIdentityCurrent:()=>true,inputCurrent:()=>live,boundaryBusy:branch==='boundary',boundaryDragging:false,
      panel:branch==='panel'?'directory':'',panelPhase:'open',chapterEnd:branch==='chapterEnd',zoom:branch==='zoom'?2:1,
      panelGeneration:1,panelActionGeneration:0,controller:{chapter:{},close:async()=>events.push('close')},
      cancelBoundaryChapter:async()=>events.push('boundary'),closePanel:async()=>{events.push('panel');owner.panel='';return true;},
      changeZoom:scale=>{events.push('zoom');owner.zoom=scale;},saveVisible:async()=>{events.push('save');return true;},
      onBack:()=>events.push('back'),requestPanelFocus(){},onExitCancelled:()=>events.push('cancelled')});
    live=false;await owner.handleBack();assert.deepEqual(events,[],`${branch}: no first local effect while live input retired`);
    assert.equal(owner.chapterEnd,branch==='chapterEnd');assert.equal(owner.zoom,branch==='zoom'?2:1);
    live=true;await owner.handleBack();assert.ok(branch==='chapterEnd'?!owner.chapterEnd:events.length>0,'same opening can accept after restoration');
  }
  for(const intent of [undefined,'navigation']){
    let release;const save=new Promise(resolve=>{release=resolve;}),events=[];
    const owner=Object.assign(new Manga(),{mounted:true,exiting:false,appForeground:true,windowChromeActive:true,windowChromeOverlayActive:false,
      interactionBlocked:false,isReaderIdentityCurrent:()=>true,inputCurrent:()=>live,boundaryBusy:false,boundaryDragging:false,panel:'',panelPhase:'closed',
      chapterEnd:false,zoom:1,panelGeneration:1,panelActionGeneration:0,controller:{chapter:{},close:async()=>events.push('close')},
      saveVisible:()=>{events.push('save');return save;},closePanel:async()=>true,requestPanelFocus(){},onBack:()=>events.push('back'),onExitCancelled:()=>events.push('cancelled')});
    live=intent===undefined;const task=owner.handleBack(intent);live=false;release(true);await task;
    assert.deepEqual(events,['save','close','back'],'accepted Back/navigation keeps its original completion after live input retires');
  }
}

async function nativeSelectionCopy(){
  const projection=await import('../entry/src/main/ets/features/reading/ui/ReaderTextSelectionProjection.ts');
  const {ReaderTextSelectionActivity}=await import('../entry/src/main/ets/features/reading/application/ReaderKeyboardShortcuts.ts');
  const menuId={equals:value=>value==='COPY'},range={start:0,end:2},copied=[];let live=true,menu;
  const Native=selectedProductionMethods(file('features/reading/ui/ReaderNativeTextWindow.ets'),'ReaderNativeTextWindow',['selection'],
    {CopyOptions:{InApp:'inapp',None:'none'},TextMenuItemId:{COPY:'COPY'}});
  let onSelectionChange;
  const attrs={copyOption(){return this;},selectedBackgroundColor(){return this;},editMenuOptions(value){menu=value;return this;},
    onTextSelectionChange(value){onSelectionChange=value;return this;}};
  const native=Object.assign(new Native(),{closed:false,selectionEpoch:0,node:{attribute:attrs},controller:{closeSelectionMenu(){}}});
  const View=selectedProductionMethods(file('features/reading/ui/ReaderNativeParagraphView.ets'),'ReaderNativeParagraphView',['updateSelection'],
    {...projection,copyReaderSelection:text=>copied.push(text)});
  const selection = new ReaderTextSelectionActivity();
  const owner=Object.assign(new View(),{mounted:true,epoch:1,selectionEpoch:0,selectionEnabled:true,selectionInputCurrent:()=>live,
    selectionShareAnchor:'paragraph-a',onSelectionActivity:(source,active)=>selection.change(source,active),
    recipe:{text:'原文内容'},controller:{selection:(...args)=>native.selection(...args),visibleStartUtf16:()=>0,visibleEndUtf16:()=>4}});
  owner.updateSelection();
  const retiredObserver=onSelectionChange;
  onSelectionChange(0,2);assert.equal(selection.active(),true);
  onSelectionChange(-1,-1);assert.equal(selection.active(),false);
  owner.updateSelection();retiredObserver(0,2);assert.equal(selection.active(),false);
  live=false;onSelectionChange(0,2);assert.equal(selection.active(),false);
  live=true;owner.updateSelection();
  const currentCopy=menu.onMenuItemClick;live=false;
  assert.equal(currentCopy({id:menuId},range),true,'retired COPY is still consumed rather than running system default');assert.deepEqual(copied,[]);
  live=true;assert.equal(currentCopy({id:menuId},range),true);assert.deepEqual(copied,['原文']);
  owner.epoch++;currentCopy({id:menuId},range);assert.equal(copied.length,1,'old geometry epoch still retires copy');
  const Fragment=selectedProductionMethods(file('features/reading/ui/ReadingSurface.ets'),'ReaderReadingTextFragment',
    ['onTextMenuItemClick','indentPrefix'],{...projection,TextMenuItemId:{COPY:'COPY'},copyReaderSelection:text=>copied.push(text)});
  const fragment=Object.assign(new Fragment(),{highlightMounted:true,longPressSelectText:true,selectionInputCurrent:()=>live,
    text:'正文内容',isParagraphStart:false,textController:{closeSelectionMenu(){}}});
  live=false;assert.equal(fragment.onTextMenuItemClick({id:menuId},range),true);assert.equal(copied.length,1);
  live=true;fragment.onTextMenuItemClick({id:menuId},range);assert.equal(copied.at(-1),'正文');
  fragment.highlightMounted=false;fragment.onTextMenuItemClick({id:menuId},range);assert.equal(copied.length,2);
}

async function rulesFirstWrite(){
  const {fixture,compile,until,deferred,ReaderWriteEvidence,cleanupDurableFixtures,durableFixtureToolEvidence}=await import('./lib/rules-mutation-durable-probe.mjs');
  const facts=await import('../entry/src/main/ets/app/ReaderOperationFacts.ts'),projection=await import('../entry/src/main/ets/app/ReaderPersistedReceiptProjection.ts');
  const policy=await import('../entry/src/main/ets/platform/network/HttpTransportPolicy.ts'),category=await import('../entry/src/main/ets/features/source/application/ReaderSourceCategory.ts'),errors=await import('../entry/src/main/ets/app/ErrorMessage.ts');
  const draft={name:'dict',urlRule:'https://dict.invalid/{{key}}',showRule:'',enabled:true,sortNumber:0};
  const sub={id:33,name:'subscription',url:'https://example.test/rules',type:0,autoUpdate:false,customOrder:0,update:0};
  const doc=JSON.stringify([{bookSourceUrl:'https://invalid.example.test'},{bookSourceName:'valid',bookSourceUrl:'https://good.example.test'}]);
  console.log(JSON.stringify({kind:'reader-contract-tool-evidence',...durableFixtureToolEvidence()}));let passed=false;
  const releases=[];
  async function scene(){
    const f=await fixture(true),Source=compile('features/source/application/SourceGateway.ts','SourceGateway',{ReaderRuntimeOwner:f.Runtime,...policy,...category,...errors},true);
    const types=compile('features/settings/application/RulesManagementOrchestrator.ets','*',{ReaderRuntimeOwner:f.Runtime,ReaderWriteEvidence,
      RulesManagementGateway:f.Gateway,SourceGateway:Source,RssGateway:class{observeWrites(){}},...facts,...projection,hilog:{error(){}}},true);
    const {RulesManagementPresentation:Presentation}=selectedProductionClasses(file('features/settings/presentation/RulesManagementPresentation.ets'),
      ['RulesManagementPresentation'],types);let live=true;
    const presentation=new Presentation();presentation.open(f.runtime,'normal',()=>true,()=>live);const host=presentation.operations('normal');await host.operationTail;
    const surface={presentation,identity:'normal'};const callback=name=>selectedProductionComponentCallback(file('features/settings/ui/RulesManagementSurface.ets'),'RulesManagementPage',name,surface);
    return {f,host,presentation,callback,setLive:value=>{live=value;}};
  }
  try{
    {
      const x=await scene(),before=x.f.calls.length,save=x.callback('onSaveDict');x.setLive(false);save(draft);await x.host.operationTail;
      assert.equal(x.f.calls.length,before,'normal retained Surface callback performs no new IO after live input loss');
      x.setLive(true);save(draft);await x.host.operationTail;assert.equal((await x.f.command('dict-rule.list')).data.rules.length,1);
    }
    for(const boundary of ['head','apply','fetch']){
      const x=await scene(),gate=deferred(),entered=deferred();releases.push(gate.resolve);
      if(boundary==='fetch')x.f.runtime.loadOnlineJsonDocument=async()=>{entered.resolve();await gate.promise;return{text:doc};};
      else {x.f.options[boundary==='head'?'pauseMethod':'beforeStart']=boundary==='head'?'rules.mutation.query':'rules.mutation.apply';x.f.options.gate=gate;}
      if(boundary==='fetch')x.callback('onRefreshSubscription')(sub);else x.callback('onSaveDict')(draft);
      if(boundary==='fetch')await entered.promise;else await until(()=>x.f.calls.some(c=>c.method===(boundary==='head'?'rules.mutation.query':'rules.mutation.apply')));
      x.setLive(false);gate.resolve();await x.host.operationTail;
      assert.equal((await x.f.command('dict-rule.list')).data.rules.length,0,`${boundary}: no first mutation after awaited input retirement`);
      assert.equal((await x.f.command('source.list')).data.sources.length,0);
      assert.notEqual(x.host.latestReceipt?.receipt.confirmation,'confirmed');
    }
    {
      const x=await scene(),gate=deferred();releases.push(gate.resolve);x.f.options.pauseMethod='rules.mutation.apply';x.f.options.gate=gate;
      x.callback('onSaveDict')(draft);await until(()=>x.f.calls.some(c=>c.method==='rules.mutation.apply'));x.setLive(false);gate.resolve();await x.host.operationTail;
      assert.equal(x.host.latestReceipt.receipt.confirmation,'confirmed','dispatched ordinary ACK retains original receipt owner in background');
      assert.equal((await x.f.command('dict-rule.list')).data.rules.length,1);
    }
    {
      const x=await scene();x.f.runtime.loadOnlineJsonDocument=async()=>({text:doc});const original=x.f.runtime.request;let actual=0;
      x.f.runtime.request=async(...args)=>{const event=await original(...args);if(args[0]==='rules.mutation.apply'&&++actual===1)x.setLive(false);return event;};
      x.callback('onRefreshSubscription')(sub);await x.host.operationTail;
      assert.equal(actual,3,'first rejected actual dispatch keeps the fixed second source and timestamp plan despite count decrement');
      assert.equal(x.f.owner.snapshot().subscription.failedParts,1);assert.equal(x.f.owner.snapshot().subscription.metadataConfirmed,true);
      assert.equal((await x.f.command('source.list')).data.sources.length,1);
    }
    passed=true;
  }finally{for(const release of releases)release();const cleanup=await cleanupDurableFixtures({retain:!passed});if(!passed)console.error(JSON.stringify({kind:'retained-failed-rules-fixtures',...cleanup}));}
}

async function rulesDraftInput(){
  const {foundationControls}=await import('./lib/reader-foundation-control-probe.mjs');
  const {switchControls}=await import('./lib/reader-switch-control-probe.mjs');
  const {createReaderBuilderProbe}=await import('./lib/reader-control-builder-probe.mjs');
  const controls=foundationControls(),toggles=switchControls({properties:controls.properties});
  const snapshot={replaceRules:[],txtTocRules:[],dictRules:[],subscriptions:[],busy:false,statusMessage:''};
  const names=['appThemeScheme','appForeground','inputEnabled','mounted','draftOpening','replaceDraftRevision','txtDraftRevision','dictDraftRevision','subscriptionDraftRevision',
    'snapshot','dictName','dictUrl','dictShow','dictOrder','dictEnabled','dictCard','input','booleanField','actionButton','integerOrZero',
    'draftKey','draftIsCurrent','ownsDraftKey','restoreNativeDraft','inputAllowed','actionAllowed'];
  const hooks={...controls.hooks,...toggles.hooks,childSources:{...controls.hooks.childSources,...toggles.hooks.childSources}};
  const page=createReaderBuilderProbe(readFileSync(file('features/settings/ui/RulesManagementPage.ets'),'utf8'),names,
    {...controls.dependencies,...toggles.dependencies,EMPTY_RULES_MANAGEMENT_SNAPSHOT:snapshot},hooks).owner;
  const Index=selectedProductionMethods(file('pages/Index.ets'),'Index',['rulesManagementInputAllowed']);
  const index=Object.assign(new Index(),{searchAppForeground:true,arkWebCapturesInput:false,jsonImportPresentation:{opening:undefined}});
  const surface={identity:'normal',inputEnabled:true,presentation:{inputAllowed:()=>index.rulesManagementInputAllowed()}};
  const deliverInput=()=>{
    surface.inputEnabled=selectedProductionComponentCallback(file('pages/Index.ets'),'RulesManagementSurface','inputEnabled',index);
    page.updateStateVars({inputEnabled:selectedProductionComponentCallback(file('features/settings/ui/RulesManagementSurface.ets'),'RulesManagementPage','inputEnabled',surface)});
    controls.properties.flush();
  };
  let saved=0;Object.assign(page,{mounted:true,draftOpening:1,
    inputCurrent:selectedProductionComponentCallback(file('features/settings/ui/RulesManagementSurface.ets'),'RulesManagementPage','inputCurrent',surface),
    dictName:'accepted',heading(){},onSaveDict:()=>saved++});
  page.dictCard();const walk=owner=>[owner,...[...owner.children.values()].flatMap(walk)];
  const fields=()=>walk(page).filter(actor=>actor instanceof controls.dependencies.ReaderFormField&&actor.inputIdentity.startsWith(page.draftKey('dict')+':'));
  const input=field=>[...field.nodes.values()].find(node=>node.type==='TextInput');
  const save=()=>controls.nodes(page).findLast(node=>node.type==='Button'&&(node.create==='保存字典规则'||node.accessibilityText==='保存字典规则'));
  assert.equal(fields().length,4);const text=input(fields()[0]).onChange,oldSave=save().onClick;
  index.jsonImportPresentation.opening={identity:'existing import'};text('queued covered edit');oldSave();
  assert.equal(page.dictName,'accepted');assert.equal(saved,0);assert.equal(page.dictDraftRevision,1,'rejected queued native buffer retires only its original editor key');
  controls.properties.flush();assert.equal(fields().length,4);assert.equal(fields()[0].text,'accepted');
  text('old native callback after rekey');assert.equal(page.dictDraftRevision,1,'retired callback cannot rekey successor editor');
  // Modal opening/closing changes Root input while app foreground stays true.
  // Deliver the actual Page Prop rather than treating a live getter as a peer.
  deliverInput();index.jsonImportPresentation.opening=undefined;deliverInput();
  input(fields()[0]).onChange('accepted current input');controls.properties.flush();
  assert.equal(page.dictName,'accepted current input');assert.equal(fields()[0].text,'accepted current input');
  oldSave();assert.equal(saved,0,'old draft save cannot act on remounted successor editor');save().onClick();assert.equal(saved,1);
  const toggle=controls.nodes(page).findLast(node=>node.type==='Toggle'&&node.onChange);assert.ok(toggle);
  index.jsonImportPresentation.opening={identity:'next import'};toggle.onChange(false);controls.properties.flush();assert.equal(page.dictEnabled,true);
}
for(const id of selected){await ({'root-first-actions':rootFirstActions,'native-selection-copy':nativeSelectionCopy,
  'rules-first-write':rulesFirstWrite,'rules-draft-input':rulesDraftInput})[id]();recordContractCasePass(id);}
