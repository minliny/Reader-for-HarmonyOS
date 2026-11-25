import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {selectedProductionMethods,selectedProductionComponentCallback} from './lib/selected-production-methods.mjs';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const cases=selectContractCases({'menu-first-input':'Actual Root/Journey/Scene/Destination/FullDirectory SDK More and menu action actors reject lost live input without consuming state or generation, and recover on the original owner.'});
const root=new URL('../',import.meta.url),file=path=>new URL('entry/src/main/ets/'+path,root);
const paths={root:'pages/Index.ets',journey:'app/composition/ReaderDirectoryJourney.ets',scene:'features/reading/ui/DetailDirectoryScene.ets',destination:'features/reading/ui/ReaderDirectoryDestination.ets',full:'features/reading/ui/ReaderFullDirectory.ets'};
const Root=selectedProductionMethods(file(paths.root),'Index',['directoryJourneyPorts','isDirectoryOpeningCurrent']);
const Journey=selectedProductionMethods(file(paths.journey),'ReaderDirectoryJourney',['isOpeningCurrent','matchesOpening']);
const Destination=selectedProductionMethods(file(paths.destination),'ReaderDirectoryDestination',['canHandle']);
class CapturedFull {constructor(owner,params){Object.assign(this,{owner,params});}}


function fixture(source,expanded){
  const runtime={};
  const rootOwner=Object.assign(new Root(),{mountedRuntimeOwner:runtime,detailShelfAdmissionMount:1,shelfReceiptRetired:false,searchAppForeground:true,arkWebCapturesInput:false,sourceSwitchPresentation:{isSurfacePresented:()=>false},mangaSourceSwitch:{selectionVisible:false},isCurrentRuntime:owner=>owner===runtime,readingEntry:{detailDirectoryPresentationGeneration:7}});
  const journey=Object.assign(new Journey(),{ports:rootOwner.directoryJourneyPorts(),navigation:{snapshot:()=>({route:'directory',directoryReturnTarget:'detail'})}});
  rootOwner.directoryJourney=journey;
  const scene={isOpeningCurrent:selectedProductionComponentCallback(file(paths.root),'DetailDirectoryScene','isOpeningCurrent',rootOwner)};
  const destination=Object.assign(new Destination(),{mounted:true,interactive:true,opening:7,isOpeningCurrent:selectedProductionComponentCallback(file(paths.scene),'ReaderDirectoryDestination','isOpeningCurrent',scene)});
  const assembly=createReaderBuilderProbe(readFileSync(file(paths.destination),'utf8'),['catalog'],{ReaderFullDirectory:CapturedFull},{childSources:{ReaderFullDirectory:source}}).owner;
  Object.assign(assembly,destination,{contentKind:'text',canHandle:destination.canHandle.bind(destination),bookmarkSelection:()=>undefined});
  assembly.catalog(7);
  const params=[...assembly.children.values()][0].params;
  const probe=createReaderBuilderProbe(source,['topBarActions','toggleTopBarMore','topBarMoreEnabled','topBarMoreLabel','isLocalBook','offlineMenuCanOpen','directoryInputCurrent','offlineBookAction','offlineBookMenuRow']);
  const full=probe.owner;
  Object.assign(full,params,{mounted:true,interactive:true,exitRequested:false,temporaryBackIdentity:'full-directory:1',bookId:'remote-book',sourceId:'remote-source',offlineMenuVisible:false,offlineMenuGeneration:0,offlineBookOperationActive:false,directoryRecovery:{offlineBlocked:false},directoryRulesVisible:false,appThemeScheme:'day',usesExpandedLayout:()=>expanded,headerControlHeight:()=>44,directoryRulesAvailable:()=>false,topBarSourceContent(){},topBarMoreIcon(){},switchDirectorySource(){},menuRowHeight:()=>44});
  full.topBarActions('full-directory:1','remote-book');
  const button=[...full.nodes.values()].find(node=>node.accessibilityText==='离线管理');
  assert.ok(button&&typeof button.onClick==='function','actual normal topBar More SDK callback exists');
  assert.equal(button.enabled,true,'normal More native/custom action is enabled before live loss');
  assert.equal(full.directoryInputCurrent('full-directory:1','remote-book'),true);
  return {rootOwner,full,button};
}


function check(source){
 const samples=[];
 for(const expanded of [false,true])for(const loss of ['foreground','covered']){
  const s=fixture(source,expanded);let dispatched=0;
  const lose=()=>{if(loss==='foreground')s.rootOwner.searchAppForeground=false;else s.rootOwner.arkWebCapturesInput=true;};
  const restore=()=>{s.rootOwner.searchAppForeground=true;s.rootOwner.arkWebCapturesInput=false;};
  s.button.onClick();assert.equal(s.full.offlineMenuVisible,true);assert.equal(s.full.offlineMenuGeneration,1);
  s.button.onClick();assert.equal(s.full.offlineMenuVisible,false);
  lose();assert.equal(s.full.directoryInputCurrent('full-directory:1','remote-book'),false);
  s.button.onClick();assert.equal(s.full.offlineMenuVisible,false,'lost live input cannot first open More');assert.equal(s.full.offlineMenuGeneration,1);
  restore();s.button.onClick();assert.equal(s.full.offlineMenuVisible,true);assert.equal(s.full.offlineMenuGeneration,2);
  const action=s.full.offlineBookAction(2,()=>dispatched++);
  s.full.offlineBookMenuRow('下载整书','下载整书',action);
  const menu=[...s.full.nodes.values()].find(node=>node.accessibilityText==='下载整书');assert.ok(menu&&typeof menu.onClick==='function');
  lose();s.button.onClick();menu.onClick();
  assert.equal(s.full.offlineMenuVisible,true,'lost live input cannot consume the original menu');assert.equal(s.full.offlineMenuGeneration,2);assert.equal(dispatched,0);
  restore();menu.onClick();assert.equal(s.full.offlineMenuVisible,false);assert.equal(dispatched,1);
  s.button.onClick();const oldBook=s.full.offlineBookAction(3,()=>dispatched++);s.full.bookId='successor-book';oldBook();
  assert.equal(s.full.offlineMenuVisible,true,'old book callback cannot consume a successor menu');assert.equal(dispatched,1);
  s.full.bookId='remote-book';oldBook();assert.equal(dispatched,2);assert.equal(s.full.offlineMenuVisible,false);
  s.button.onClick();const oldOpening=s.full.offlineBookAction(4,()=>dispatched++);s.full.temporaryBackIdentity='full-directory:2';oldOpening();s.button.onClick();
  assert.equal(s.full.offlineMenuVisible,true);assert.equal(s.full.offlineMenuGeneration,4);assert.equal(dispatched,2,'original opening rejects without dispatch');
  samples.push({expanded,loss,more:s.button.type,menu:menu.type,dispatched});
 }
 return {samples,boundary:'Actual installed SDK native/custom buttons and original Root-to-Full callback chain. Runtime/navigation/geometry and final business sinks finite. No device action.'};
}
for(const id of cases){const source=readFileSync(file(paths.full),'utf8'),result=check(source);
 const noMore=source.replace('    if (!this.directoryInputCurrent(identity, bookId)) return;\n    if (this.directoryRulesAvailable() &&','    if (this.directoryRulesAvailable() &&');assert.notEqual(noMore,source);assert.throws(()=>check(noMore),/lost live input cannot first open More/);
 const noAction=source.replace('if (!this.directoryInputCurrent(identity, bookId) || !this.offlineMenuVisible || generation !== this.offlineMenuGeneration) return;','if (!this.mounted || this.exitRequested || !this.offlineMenuVisible || generation !== this.offlineMenuGeneration) return;');assert.notEqual(noAction,source);assert.throws(()=>check(noAction),/lost live input cannot consume the original menu/);
 console.log(JSON.stringify({case:id,result,rejectedOldMore:true,rejectedOldMenuConsumption:true}));recordContractCasePass(id);
}
