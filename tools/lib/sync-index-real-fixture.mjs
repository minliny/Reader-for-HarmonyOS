import { resolveEtsLoaderRoot, virtualFilePath } from './tool-environment.mjs';
import {foundationControls} from './reader-foundation-control-probe.mjs';
import { runtimeOwnerIdentityProbe } from './reader-runtime-admission-probe.mjs';
import { randomUUID } from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRequire,stripTypeScriptTypes} from 'node:module';
import {createReaderBuilderProbe} from './reader-control-builder-probe.mjs';
import {createDefaultReaderWindowMetrics} from '../../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';

// Reuse the existing actual AssetStore/Gateway/owner fixture, without running
// that test's scenarios or replacing production methods. Index supplies the
// constructor through the same feature factory exercised by the application.
const url=new URL('../test-sync-receipt-owner-closure.mjs',import.meta.url);
let fixtureSource=readFileSync(url,'utf8').split('\nasync function open(f)')[0]
  .replace(/^import[^\n]+\n/gm,'')
  .replaceAll('import.meta.url',JSON.stringify(url.href))
  .replace('function fixture({empty=false,preserveAsset=false}={})','function fixture({empty=false,preserveAsset=false,createOwner}={})')
  .replace('const owner=new Orchestrator(', 'const owner=createOwner ? createOwner() : new Orchestrator(');
export const syncIndexFixture=new Function('readFileSync','createRequire','stripTypeScriptTypes','createReaderBuilderProbe','runtimeOwnerIdentityProbe','randomUUID','foundationControls','resolveEtsLoaderRoot',
  fixtureSource+';return {fixture,asset,config,ReaderRuntimeOwner,Store,Gateway,Orchestrator,DEFAULT_SYNC_SNAPSHOT,source,readerRecoveryView,pause,execute,setRuntimeOwner:(owner)=>{currentOwner=owner;},setTransport:(execute)=>{transport=execute;},setPreferences:(store)=>{nativePreferences=store;}};')
  (readFileSync,createRequire,stripTypeScriptTypes,createReaderBuilderProbe,runtimeOwnerIdentityProbe,randomUUID,foundationControls,resolveEtsLoaderRoot);

export function fullSyncIndexPage(props,sharedChildren={},probeHooks={}){
  const f=syncIndexFixture,root=resolveEtsLoaderRoot();
  const require=createRequire(import.meta.url),ts=require(root+'/node_modules/typescript'),options=require(root+'/lib/ets_checker.js').compilerOptions;
  const text=f.source('features/sync/SyncPage.ets'),tree=ts.createSourceFile(virtualFilePath('SyncPage.ets'),text,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
  const names=tree.statements.find(n=>n.members&&n.name?.text==='SyncPage').members.map(n=>n.name?.getText(tree)).filter(Boolean);
  class Property{constructor(value,owner,name){Object.assign(this,{value,owner,name});}get(){return this.value;}set(v){this.value=v;this.owner.watches?.get(this.name)?.call(this.owner,this.name);}reset(v){this.set(v);}purgeDependencyOnElmtId(){}aboutToBeDeleted(){}}
  class Child{constructor(owner,params,_s,id){Object.assign(this,{owner,params,id});}updateStateVars(params){Object.assign(this.params,params);}}
  class Card extends Child{initialRender(){this.params.content?.();}}
  const geometry=f.execute('features/common/SurfaceHorizontalGeometry.ts','({SurfaceWidthSpec,SurfaceHorizontalFrame,resolveHorizontalFrame})');
  const syntax=require(root+'/lib/validate_ui_syntax.js');syntax.builderParamObjectCollection.set('PageBackBar',new Set(['trailing']));
  const foundation=foundationControls();
  const result=createReaderBuilderProbe(text,names,{...foundation.dependencies,...geometry,DEFAULT_SYNC_SNAPSHOT:f.DEFAULT_SYNC_SNAPSHOT,readerRecoveryView:f.readerRecoveryView,
    ReaderCard:Card,PageBackBar:Child,ReaderRecoveryNotice:Child,ReaderRecoveryAction:Child,...sharedChildren,
    ...Object.fromEntries(['ObservedPropertySimplePU','ObservedPropertyObjectPU','SynchedPropertySimpleOneWayPU','SynchedPropertyObjectOneWayPU'].map(k=>[k,Property])),
    registerReaderFonts(){},ReaderWindowCoordinator:{metrics:()=>{const metrics=createDefaultReaderWindowMetrics();metrics.windowRect.width=390;return metrics;}},readerVisualSafeLeft:()=>0,readerVisualSafeRight:()=>0,readerFloatingBarBottomInset:()=>18,
    READER_FLOATING_TOP_BAR_HEIGHT:56,InputType:{Password:'Password'},TOK_CONTENT_MAX_W_TABLET:722,TOK_SCREEN_INSET:18,
  },{...foundation.hooks,...probeHooks,mountChildren:true,initialParams:props,childSources:{...foundation.hooks.childSources,...probeHooks.childSources,ReaderCard:f.source('features/common/ReaderCard.ets'),PageBackBar:f.source('features/common/PageBackBar.ets')}});
  const replay=result.owner.replay.bind(result.owner);result.owner.replay=()=>{replay();foundation.properties.flush();};
  result.owner.aboutToAppear();result.owner.initialRender();return result.owner;
}
