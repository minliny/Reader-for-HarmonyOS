import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {registerHooks} from 'node:module';
import {selectedProductionMethods,selectedProductionComponentCallback} from './lib/selected-production-methods.mjs';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {boundedSurfaceSdk,boundedMembers} from './lib/bounded-surface-sdk-probe.mjs';
import {foundationControls} from './lib/reader-foundation-control-probe.mjs';
import {readerTypographyRoles} from './lib/reader-typography-probe.mjs';
import {readerControlHostInputEnabled} from '../entry/src/main/ets/features/reading/ui/ReaderControlHostSession.ts';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const cases=selectContractCases({'first-input':'Actual SDK Save and manager form callbacks reject lost live input before first mutation/Host enqueue and recover on the same actor, including accepted temporary minimum reflow.','accepted-receipt':'Actual submitted HTTP write retains its original Host receipt and busy cleanup when foreground changes after dispatch.'});
const resolution=registerHooks({resolve(specifier,context,next){try{return next(specifier,context);}catch(error){if(specifier.startsWith('.')&&context.parentURL&&existsSync(new URL(specifier+'.ts',context.parentURL)))return next(specifier+'.ts',context);throw error;}}});
try{
const {ReaderTtsConfigurationHost}=await import('../entry/src/main/ets/features/reading/application/ReaderTtsConfigurationHost.ts');
const root=new URL('../entry/src/main/ets/',import.meta.url),file=p=>new URL(p,root),read=p=>readFileSync(file(p),'utf8');
const lre=file('features/reading/ui/LocalReadingExperience.ets'),panelFile=file('features/reading/ui/ReaderControlPanel.ets');
const contentSource=read('features/reading/ui/ReaderControlTtsContent.ets'),overlaySource=read('features/reading/ui/ReaderTtsConfigOverlay.ets');
const Local=selectedProductionMethods(lre,'ReadingExperience',['saveHttpTtsEngine','deleteHttpTtsEngine','isSessionActive','isMountedToken','readerInputIsCurrent','isControlInputEnabled'],{readerControlHostInputEnabled});
const Panel=selectedProductionMethods(panelFile,'ReaderControlPanel',['moduleEditorInputEnabled','contentInputEnabled','hasCurrentTemporaryInput','currentTemporaryInputScope']);
const overlayMethods=['acceptsInput','submit','deleteEngine','selectEngine','clearDraft','changeDraftText','canSubmit','setBusy','current','resetDraft'];
class Child{constructor(owner,params){Object.assign(this,{owner,params});}}
const turn=async()=>{for(let i=0;i<40;i++)await Promise.resolve();};
function setup({minimumReady=true,holdReply=false,holdCredential=false,overlayText=overlaySource,contentText=contentSource}={}){
 const writes=[],config={engine:'system',rate:10,ratePercent:100,pitch:0,followSys:false};let stored,release;
 const pending=new Promise(resolve=>{release=resolve;});
 const local=Object.assign(new Local(),{appForeground:true,windowChromeActive:true,interactionBlocked:false,controlObscured:false,
  isReaderIdentityCurrent:()=>true,inputCurrent:()=>!local.rootCovered,lifecycleToken:1,ttsConfigMutationGeneration:0,mounted:true,exitRequested:false,notifyTtsConfigurationFailure(){}});
 const host=new ReaderTtsConfigurationHost({http:{put:async(value,dispatch)=>{writes.push({kind:'put',foreground:local.appForeground});dispatch?.();if(holdReply)await pending;stored=value;return value;},get:async()=>stored,list:async()=>stored?[stored]:[],delete:async(_id,dispatch)=>{writes.push({kind:'delete',foreground:local.appForeground});dispatch?.();stored=undefined;return{};}},config:{putConfig:async(value,dispatch)=>{dispatch?.();return value;},getConfig:async()=>config},coordinator:{stop:async()=>{},probeAvailability:async()=>true},credentials:{create:async()=>{if(holdCredential)await pending;return 'alias';},remove:async()=>{}},isCurrent:()=>local.isSessionActive(1),fallbackConfig:()=>config,publish(){},log(){}},config);
 local.requireTtsConfigurationHost=()=>host;
 const panel=Object.assign(new Panel(),{inputEnabled:true,inputCurrent:selectedProductionComponentCallback(lre,'ReaderControlPanel','inputCurrent',local),
  preparedMinimumRequired:true,currentMinimumIdentity:()=> 'owner7',committedMinimumIdentity:()=> 'owner7',minimumInputReady:()=>minimumReady,
  visualVisibilityProgress:1,visualTransitionKind:'',visualHeldPointerId:-1,controlObscured:false,sourceId:'source',bookTitle:'book',controlOpenRevision:7,
  contentLocation:()=>panel.location,location:{level:'secondary',module:'tts',directoryTab:'directory'},temporaryInputActive:true,temporaryLayerActive:true,
  onTtsHttpEnginePut:selectedProductionComponentCallback(lre,'ReaderControlPanel','onTtsHttpEnginePut',local),
  onTtsHttpEngineDelete:selectedProductionComponentCallback(lre,'ReaderControlPanel','onTtsHttpEngineDelete',local)});
 panel.temporaryInputScope=panel.currentTemporaryInputScope();
 const content=createReaderBuilderProbe(contentText,['managerOverlay','managerCurrent','managerInputEnabled'],{ReaderTtsConfigOverlay:Child},{childSources:{ReaderTtsConfigOverlay:overlayText}}).owner;
 Object.assign(content,{configField:'manage',configIdentity:'manager7',onlineEngineId:()=> 'system',
  editorInputCurrent:selectedProductionComponentCallback(panelFile,'ReaderControlTtsContent','editorInputCurrent',panel),
  onHttpEnginePut:selectedProductionComponentCallback(panelFile,'ReaderControlTtsContent','onHttpEnginePut',panel),
  onHttpEngineDelete:selectedProductionComponentCallback(panelFile,'ReaderControlTtsContent','onHttpEngineDelete',panel),dismissConfiguration(){}});
 content.managerOverlay('manager7');const params=[...content.children.values()][0].params;
 const overlay=createReaderBuilderProbe(overlayText,overlayMethods).owner;
 Object.assign(overlay,params,{mounted:true,busy:false,generation:0,draftId:77,draftName:'test',draftUrl:'https://example.invalid/tts',draftApiKey:holdCredential?'test-secret':'',draftVoice:'voice',draftFormat:'mp3',draftClearApiKey:false,onClose(){}});
 const actions=boundedSurfaceSdk(),source=read('ui/surfaces/ReaderBoundedSurfaceActions.ets');const owner=actions.consumer(source,boundedMembers(source));
 Object.assign(owner,{specId:'tts-manager',primaryLabel:'保存',primaryEnabled:true,cancelEnabled:true,onAction:selectedProductionComponentCallback(file('features/reading/ui/ReaderTtsConfigOverlay.ets'),'ReaderBoundedSurfaceActions','onAction',overlay)});owner.initialRender();
 const button=actions.nodes(owner).find(n=>n.type==='Button'&&n.accessibilityText==='保存');assert.ok(button);
 return {local,panel,content,overlay,host,writes,save:()=>button.onClick(),release};
}
async function firstInput(options={}){
 const samples=[];
 for(const lost of ['none','foreground','window','root','module','opening']){
  const s=setup({...options,minimumReady:false});
  if(lost==='foreground')s.local.appForeground=false;
  if(lost==='window')s.local.windowChromeActive=false;
  if(lost==='root')s.local.rootCovered=true;
  if(lost==='module')s.panel.location={...s.panel.location,module:'directory'};
  if(lost==='opening')s.panel.controlOpenRevision++;
  s.save();await turn();assert.equal(s.writes.length,lost==='none'?1:0,`${lost} first native Save dispatch`);
  if(lost!=='none'){
   assert.equal(s.overlay.busy,false);assert.equal(s.overlay.draftName,'test','rejected input does not clear the draft');
   s.overlay.deleteEngine(77);s.overlay.clearDraft();s.overlay.changeDraftText('name','retired');await turn();
   assert.equal(s.writes.length,0);assert.equal(s.overlay.draftName,'test');
   s.local.appForeground=true;s.local.windowChromeActive=true;s.local.rootCovered=false;
   s.panel.location={...s.panel.location,module:'tts'};s.panel.controlOpenRevision=7;
   s.save();await turn();assert.equal(s.writes.length,1,`${lost} same manager recovers`);
  }
  samples.push(lost);
 }
 return {samples,minimumReflowAccepted:true};
}
async function acceptedReceipt(){const samples=[];for(const phase of ['before-dispatch','after-dispatch']){const s=setup({holdReply:phase==='after-dispatch',holdCredential:phase==='before-dispatch'});s.save();await turn();assert.equal(s.writes.length,phase==='after-dispatch'?1:0);assert.equal(s.overlay.busy,true);s.local.appForeground=false;s.release();await turn();assert.equal(s.writes.length,1);assert.equal(s.host.snapshot().durable.receipt.fact,'confirmedCurrent');assert.equal(s.overlay.busy,false);assert.equal(s.overlay.draftName,'','accepted success retains its draft cleanup');samples.push({phase,dispatchForeground:s.writes[0].foreground});}return {samples,backgroundAck:'confirmedCurrent',busyReleased:true};}
async function draftInput(){
 const s=setup(),controls=foundationControls();
 const owner=createReaderBuilderProbe(overlaySource,['managerForm','formatChoice','acceptsInput','changeDraftText'],{...controls.dependencies,...readerTypographyRoles,readerAppColor:()=> '#000'},controls.hooks).owner;
 Object.assign(owner,{mounted:true,busy:false,inputCurrent:s.overlay.inputCurrent,appThemeScheme:'day',draftName:'name',draftUrl:'url',draftApiKey:'key',draftVoice:'voice',draftClearApiKey:false,draftFormat:'mp3',errorText:'',formatActionHeight:()=>44});
 owner.managerForm();const fields=controls.nodes(owner).filter(node=>node.type==='TextInput');assert.equal(fields.length,4);
 const format=controls.nodes(owner).find(node=>node.type==='Button'&&node.accessibilityText==='WAV');assert.ok(format);
 const clear=controls.nodes(owner).find(node=>node.type==='Button'&&node.accessibilityText==='清除已保存密钥');assert.ok(clear);
 s.local.appForeground=false;fields.forEach(field=>field.onChange('retired'));format.onClick();clear.onClick();
 assert.deepEqual([owner.draftName,owner.draftUrl,owner.draftApiKey,owner.draftVoice,owner.draftFormat,owner.draftClearApiKey],['name','url','key','voice','mp3',false]);
 s.local.appForeground=true;fields.forEach((field,index)=>field.onChange('current'+index));format.onClick();clear.onClick();
 assert.deepEqual([owner.draftName,owner.draftUrl,owner.draftApiKey,owner.draftVoice,owner.draftFormat,owner.draftClearApiKey],['current0','current1','','current3','wav',true]);
 return {nativeFields:4,nativeChoices:2};
}
for(const id of cases){const result=await({'first-input':firstInput,'accepted-receipt':acceptedReceipt}[id])();if(id==='first-input'){result.draft=await draftInput();const oldOverlay=overlaySource.replace('return this.mounted && (this.inputCurrent?.() ?? true);','return this.mounted;');const oldContent=contentSource.replace('return this.managerCurrent(identity) && (this.editorInputCurrent?.() ?? this.currentInputEnabled());','return this.managerCurrent(identity);');assert.notEqual(oldOverlay,overlaySource);assert.notEqual(oldContent,contentSource);await assert.rejects(()=>firstInput({overlayText:oldOverlay,contentText:oldContent}),/foreground first native Save dispatch/);result.rejectedOldPredicates=true;}console.log(JSON.stringify({case:id,result,boundary:'Actual SDK Save callback, production Panel/Content/Overlay/LRE and Host. Native geometry, IO and frame scheduling are finite ports. No device.'}));recordContractCasePass(id);}
}finally{resolution.deregister();}
