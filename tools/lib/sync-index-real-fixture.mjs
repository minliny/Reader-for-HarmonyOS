import { resolveEtsLoaderRoot, virtualFilePath } from './tool-environment.mjs';
import {boundedSurfaceSdk} from './bounded-surface-sdk-probe.mjs';
import {foundationControls} from './reader-foundation-control-probe.mjs';
import {createRequire} from 'node:module';
import {createReaderBuilderProbe} from './reader-control-builder-probe.mjs';
import * as windowMetrics from '../../entry/src/main/ets/ui/foundation/ReaderWindowMetrics.ts';
import {readerEditingSdk} from './reader-editing-sdk-probe.mjs';
import {pureModuleProbe} from './ets-pure-module-probe.mjs';
import {actualReaderPageLayout} from './reader-page-shell-runtime-probe.mjs';
import {actualReaderPostLayoutFrame} from './reader-post-layout-frame-probe.mjs';

import {createSyncOwnerFixture} from '../fixtures/sync/receipt-owner-fixture.mjs';
export const syncIndexFixture=createSyncOwnerFixture();

export function syncNativeSlotMeasurement(source=syncIndexFixture.source) {
  return pureModuleProbe(source('ui/layout/ReaderNativeSlotMeasurement.ets'),
    'ReaderNativeSlotMeasurement.ets',{ReaderPostLayoutFrame:actualReaderPostLayoutFrame(),
      readerMeasureSurfaceRect:()=>undefined},['ReaderNativeSlotMeasurement']).ReaderNativeSlotMeasurement;
}

export function fullSyncIndexPage(props,sharedChildren={},probeHooks={}){
  const f=syncIndexFixture,root=resolveEtsLoaderRoot();
  const require=createRequire(import.meta.url),ts=require(root+'/node_modules/typescript'),options=require(root+'/lib/ets_checker.js').compilerOptions;
  const text=f.source('features/sync/ui/SyncPage.ets'),tree=ts.createSourceFile(virtualFilePath('SyncPage.ets'),text,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
  const names=tree.statements.find(n=>n.members&&n.name?.text==='SyncPage').members.map(n=>n.name?.getText(tree)).filter(Boolean);

  class Child{constructor(owner,params,_s,id){Object.assign(this,{owner,params,id});}updateStateVars(params){Object.assign(this.params,params);}}
  class Card extends Child{initialRender(){this.params.content?.();}}
  const geometry=f.execute('ui/layout/SurfaceHorizontalGeometry.ts','({SurfaceWidthSpec,SurfaceHorizontalFrame,resolveHorizontalFrame})');
  const syntax=require(root+'/lib/validate_ui_syntax.js');syntax.builderParamObjectCollection.set('PageBackBar',new Set(['trailing']));
  const foundation=foundationControls();
  const messages=boundedSurfaceSdk({properties:foundation.properties,allowEmptyBranchAdmission:probeHooks.allowEmptyBranchAdmission});
  const layout=actualReaderPageLayout();
  const metrics=()=>{const result=windowMetrics.createDefaultReaderWindowMetrics();result.windowRect.width=390;return result;};
  const ReaderNativeSlotMeasurement=syncNativeSlotMeasurement();
  const result=createReaderBuilderProbe(text,names,{...foundation.dependencies,...messages.deps,...geometry,...layout,...windowMetrics,
    ...readerEditingSdk(),ReaderNativeSlotMeasurement,DEFAULT_SYNC_SNAPSHOT:f.DEFAULT_SYNC_SNAPSHOT,readerRecoveryView:f.readerRecoveryView,
    ReaderCard:Card,PageBackBar:Child,...sharedChildren,
    registerReaderFonts(){},ReaderWindowCoordinator:{metrics},readerWindowMetrics:metrics,
    readerVisualSafeLeft:()=>0,readerVisualSafeRight:()=>0,readerFloatingBarBottomInset:()=>18,
    READER_FLOATING_TOP_BAR_HEIGHT:56,InputType:{Password:'Password'},TOK_CONTENT_MAX_W_TABLET:722,TOK_SCREEN_INSET:18,
  },{...foundation.hooks,...messages.hooks,allowEmptyBranchAdmission:true,...probeHooks,mountChildren:true,initialParams:props,
    childSources:{...foundation.hooks.childSources,...messages.childSources,...probeHooks.childSources,
      ReaderCard:f.source('ui/surfaces/ReaderCard.ets'),PageBackBar:f.source('ui/chrome/PageBackBar.ets')}});
  const replay=result.owner.replay.bind(result.owner);result.owner.replay=()=>{replay();foundation.properties.flush();};
  result.owner.aboutToAppear();
  result.owner.initialRender();
  const shell=[...result.owner.children.values()].find(actor=>actor.boundedOverlayVisible!==undefined);
  const measured=[...shell.nodes.values()].find(node=>node.type==='__Common__'&&node.onAreaChange);
  measured.onAreaChange({width:0,height:0},{width:390,height:844});
  foundation.properties.flush();
  return result.owner;
}

export function syncPageActors(owner) {
  return [owner,...[...(owner.children?.values()??[])].flatMap(syncPageActors)];
}

export function syncRecoveryAction(page,label) {
  return syncPageActors(page).filter(actor=>actor.label===label&&actor.generation!==undefined).map(actor=>({
    actor, node:[...actor.nodes.values()].find(node=>node.type==='Button'&&node.onClick),
  }));
}

export function updateSyncRecoveryAction(actor,patch) {
  const {label,generation,variant,focusId,minimumWidth,actionEnabled,isBusy}=actor;
  actor.updateStateVars({label,generation,variant,focusId,minimumWidth,actionEnabled,isBusy,...patch});
}
