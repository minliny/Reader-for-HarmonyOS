import { ReaderNativeAlertOwner } from '../entry/src/main/ets/app/ReaderNativeAlertOwner.ts';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
const source=readFileSync(new URL('../entry/src/main/ets/features/settings/SettingsPage.ets',import.meta.url),'utf8');
const overlay=readFileSync(new URL('../entry/src/main/ets/features/settings/SettingsSelectOverlay.ets',import.meta.url),'utf8');
const require=createRequire(import.meta.url),sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader',syntax=require(sdk+'/lib/validate_ui_syntax.js');
syntax.componentCollection.customComponents.add('SettingsSelectOverlay');syntax.propCollection.set('SettingsSelectOverlay',new Set([...overlay.matchAll(/@Prop\s+(?:@Watch\([^\n]+?\)\s+)?(\w+)\s*:/g)].map(m=>m[1])));
class Child{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}updateStateVars(params){Object.assign(this.params,params);}}
const {owner}=createReaderBuilderProbe(source,['nativeAlertOwner','onTemporaryBackBridge','temporaryBackIdentity','buildOverlay','currentValue','selectOptions','setSelectValue','toggleSelection','retireSelection','ownsSelection','commitSelection','dismissSelection','aboutToDisappear'],{ReaderNativeAlertOwner,SettingsSelectOverlay:Child,settingsSelectionGeneration:0});
Object.assign(owner,{mounted:true,openSelect:'',selectionId:'',selectionField:'',languageValue:'简体中文',startupValue:'书架',animationValue:'标准',isTablet:false,anchorRight:200,anchorBottom:180,originX:0,originY:0,resetRevision:0});
const render=()=>{owner.buildOverlay();return {...[...owner.children.values()].at(-1).params};};
owner.toggleSelection('language');const a=render();assert.ok(a.selectionId.startsWith('language:'));owner.toggleSelection('startup');owner.replay();const b=render();assert.notEqual(a.selectionId,b.selectionId);
a.onSelect('English',a.selectionId);a.onDismiss(a.selectionId);assert.equal(owner.openSelect,'startup');assert.equal(owner.languageValue,'简体中文');assert.equal(owner.startupValue,'书架');
b.onSelect('RSS',b.selectionId);assert.equal(owner.startupValue,'RSS');assert.equal(owner.openSelect,'');assert.equal(owner.selectionId,'');
owner.toggleSelection('startup');const c=render();assert.notEqual(c.selectionId,b.selectionId);b.onDismiss(b.selectionId);assert.equal(owner.openSelect,'startup');c.onSelect('not an option',c.selectionId);assert.equal(owner.openSelect,'startup');c.onDismiss(c.selectionId);assert.equal(owner.openSelect,'');
owner.toggleSelection('language');const d=render();owner.aboutToDisappear();d.onSelect('English',d.selectionId);assert.equal(owner.languageValue,'简体中文');assert.equal(owner.selectionId,'');owner.mounted=true;owner.toggleSelection('language');const e=render();assert.notEqual(e.selectionId,d.selectionId);d.onDismiss(d.selectionId);assert.equal(owner.openSelect,'language');
console.log('Settings real SDK owner selection: PASS (unique ID/live options/stale select/stale close/field switch/reopen/unmount).');
