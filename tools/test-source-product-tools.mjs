import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function actor(method) {
 const {foundationControls}=await import('./lib/reader-foundation-control-probe.mjs');
 const {createReaderBuilderProbe}=await import('./lib/reader-control-builder-probe.mjs');
 const page=readFileSync(new URL('../entry/src/main/ets/features/source/SourceToolsPage.ets',import.meta.url),'utf8');
 const controls=foundationControls(),owner=createReaderBuilderProbe(page,[method],controls.dependencies,controls.hooks).owner;Object.assign(owner,{appThemeScheme:'day',snapshot:{busy:false}});return{controls,owner};
}
async function exportAction(){
 const {controls,owner}=await actor('fullWidthActionButton');let actions=0;owner.fullWidthActionButton('导出全部书源',true,()=>actions++);
 const text=controls.nodes(owner).find(n=>n.type==='Text');assert.ok(text);assert.equal(text.width,'100%');assert.equal(Object.hasOwn(text,'layoutWeight'),false,'standalone export is full-width rather than a row weight');
 const spec=controls.dependencies.resolveReaderButtonSpec('source-action');assert.equal(text.height,spec.height);assert.equal(text.borderRadius,spec.radius);
 text.onClick();assert.equal(actions,1);owner.snapshot.busy=true;controls.flush(owner);text.onClick();assert.equal(actions,1,'retained export actor reads current busy state');
}
async function compactAction(){
 const {controls,owner}=await actor('smallButton');let actions=0;owner.smallButton('不可用',false,()=>actions++);const disabled=controls.nodes(owner).find(n=>n.type==='Text'&&n.create==='不可用');assert.ok(disabled);assert.equal(disabled.enabled,false);disabled.onClick();assert.equal(actions,0);
 owner.smallButton('可用',true,()=>actions++);const enabled=controls.nodes(owner).find(n=>n.type==='Text'&&n.create==='可用');assert.ok(enabled);enabled.onClick();assert.equal(actions,1);
}
const cases={'export-action':exportAction,'compact-action':compactAction};
for(const id of selectContractCases({'export-action':'Actual full-width export shared actor and retained busy guard','compact-action':'Actual compact action rejects direct disabled physical click'})){await cases[id]();recordContractCasePass(id);}
