import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createReaderBuilderProbe} from './reader-control-builder-probe.mjs';
import {labeledIconControls} from './reader-labeled-icon-action-probe.mjs';

const source=readFileSync(new URL('../../entry/src/main/ets/features/source/SourceManagementPage.ets',import.meta.url),'utf8');
export function sourceSharedActionFixture(names,deps={},params={}){
 const controls=labeledIconControls();
 const {owner}=createReaderBuilderProbe(source,names,{...controls.dependencies,...deps},controls.hooks);
 Object.assign(owner,{appThemeScheme:'day',contentFrame:()=>({width:326}),actionBottomInset:()=>0,...params});
 function action(specId,label){
  const actor=[...owner.children.values()].findLast(c=>c.specId===specId&&(label===undefined||c.label===label));
  assert.ok(actor instanceof controls.dependencies.ReaderButton||actor instanceof controls.dependencies.ReaderLabeledIconAction,'actual shared '+specId+' component');
  const native=controls.nodes(actor).find(n=>typeof n.onClick==='function');assert.ok(native,'actual '+specId+' native hit target');
  return{actor,native,click:native.onClick};
 }
 return{owner,controls,action};
}

export function updateSourceAction(fixture,actor,changes){
 const definition=fixture.controls.hooks.childSources[actor instanceof fixture.controls.dependencies.ReaderButton?'ReaderButton':'ReaderLabeledIconAction'];
 const names=[...definition.matchAll(/@Prop\s+(\w+)\s*:/g)].map(m=>m[1]);
 actor.updateStateVars({...Object.fromEntries(names.map(n=>[n,actor[n]])),...changes});
 fixture.controls.properties.flush();
}
