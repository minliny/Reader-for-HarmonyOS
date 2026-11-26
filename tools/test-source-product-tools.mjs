import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function actor(method) {
 const {foundationControls}=await import('./lib/reader-foundation-control-probe.mjs');
 const {createReaderBuilderProbe}=await import('./lib/reader-control-builder-probe.mjs');
 const page=readFileSync(new URL('../entry/src/main/ets/features/source/ui/SourceToolsPage.ets',import.meta.url),'utf8');
 const controls=foundationControls(),owner=createReaderBuilderProbe(page,[method],controls.dependencies,controls.hooks).owner;Object.assign(owner,{appThemeScheme:'day',snapshot:{busy:false,sources:[{sourceId:'test'}]}});return{controls,owner};
}
async function exportAction(){
 const {controls,owner}=await actor('fullWidthActionButton');let actions=0;owner.fullWidthActionButton('导出全部书源',true,()=>actions++);
 const button=controls.nodes(owner).find(n=>n.type==='Button'&&n.onClick);assert.ok(button);assert.equal(button.width,'100%');assert.equal(button.layoutWeight,undefined,'standalone export is full-width rather than a row weight');
 assert.ok((button.height??button.constraintSize?.minHeight)>=44);
 button.onClick();assert.equal(actions,1);owner.snapshot.busy=true;controls.flush(owner);button.onClick();assert.equal(actions,1,'retained export actor reads current busy state');
 owner.snapshot.busy=false;owner.snapshot.sources=[];controls.flush(owner);button.onClick();
 assert.equal(actions,1,'retained export cannot run when the actual catalogue is empty');
}
async function compactAction(){
 const {controls,owner}=await actor('sourceRowButton');let actions=0,available=false;
 Object.assign(owner,{sourceRowButtonLabel:()=> '编辑',sourceRowButtonEnabled:()=>available,currentSourceRowAction:()=>()=>actions++});
 owner.sourceRowButton({source:{sourceId:'test'}},'edit');
 const button=controls.nodes(owner).find(n=>n.type==='Button'&&n.onClick);assert.ok(button);assert.equal(button.enabled,false);button.onClick();assert.equal(actions,0);
 available=true;controls.flush(owner);button.onClick();assert.equal(actions,1);
}
const cases={'export-action':exportAction,'compact-action':compactAction};
for(const id of selectContractCases({'export-action':'Actual full-width export shared actor and retained busy guard','compact-action':'Actual compact action rejects direct disabled physical click'})){await cases[id]();recordContractCasePass(id);}
