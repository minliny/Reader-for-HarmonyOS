import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {foundationControls} from './lib/reader-foundation-control-probe.mjs';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const cases=selectContractCases({'foreground-recovery':'Actual SDK native editor Save actor recovers from a background-created snapshot on the local foreground StorageLink; live AppStorage still rejects before delivery.'});
const path=new URL('../entry/src/main/ets/features/source/ui/SourceToolsPage.ets',import.meta.url);
function check(original){
 const start=original.indexOf("        ReaderFormField({ scheme: this.appThemeScheme, specId: 'source-code'"),end=original.indexOf('});',start)+3,close=original.lastIndexOf('\n}');
 assert.ok(start>0&&end>start);
 const source=original.slice(0,close)+'\n @Builder private selectedEditorField(revision: number, inputRevision: number) {\n'+original.slice(start,end)+'\n }\n'+original.slice(close);
 let foreground=false;const saved=[],drafts=[],c=foundationControls();
 const methods=['snapshot','appForeground','appThemeScheme','temporaryBackIdentity','mounted','isOpeningCurrent','isInputAllowed','toolsOpeningIsCurrent','toolsInputIsCurrent','editorButtonEnabled','editorButtonLabel','editorButton','editorAction','canWriteSources','onSnapshotChanged','editorInputRevision','editorDraftIsEditable','editorDraftChange','selectedEditorField'];
 const {owner}=createReaderBuilderProbe(source,methods,{...c.dependencies,EMPTY_SOURCE_TOOLS_SNAPSHOT:{},AppStorage:{get:()=>foreground},sourceEditorReadbackPending:()=>false},c.hooks);
 owner.watches.set('snapshot',()=>{}); // Unrelated list/data-source projection is a finite port.
 Object.assign(owner,{appForeground:false,mounted:true,temporaryBackIdentity:'tools-back-1',isOpeningCurrent:()=>true,isInputAllowed:()=>foreground,
  snapshot:{editorRevision:7,editorSourceId:'source-one',editorText:'{}',busy:false,editorReadback:undefined,original:undefined},
  actionMinimumWidth:()=>60,onSaveEditor:revision=>saved.push(revision),onEditorDraftChanged:(text,revision)=>drafts.push([text,revision])});
 owner.selectedEditorField(7,0);owner.editorButton(7,'save');const field=c.nodes(owner).find(node=>node.type==='TextArea');assert.ok(field);assert.equal(field.enabled,false);const button=c.nodes(owner).find(node=>node.type==='Button');assert.ok(button);
 assert.equal(button.enabled,false);const actor=button;
 foreground=true;owner.appForeground=true;c.properties.flush();
 assert.equal(owner.editorButtonEnabled(7,'save'),true);
 assert.equal(button.enabled,true,'background-created Save actor recovers on foreground delivery');
 assert.equal(field.enabled,true,'background-created editor field recovers on foreground delivery');field.onChange('current');assert.deepEqual(drafts,[['current',7]]);
 assert.equal(c.nodes(owner).find(node=>node.type==='Button'),actor);
 button.onClick();assert.deepEqual(saved,[7]);
 foreground=false; // Deliberately keep the local StorageLink stale for first-input rejection.
 button.onClick();field.onChange('retired');assert.deepEqual(saved,[7]);assert.deepEqual(drafts,[['current',7]]);
 owner.appForeground=false;c.properties.flush();assert.equal(button.enabled,false);
 foreground=true;owner.appForeground=true;c.properties.flush();button.onClick();assert.deepEqual(saved,[7,7]);
 owner.snapshot={...owner.snapshot,editorRevision:8};c.properties.flush();button.onClick();assert.deepEqual(saved,[7,7],'old revision action stays retired');
 return {sameActor:true,accepted:2,liveBeforePropRejected:true,retiredRevisionRejected:true,boundary:c.properties.source};
}
for(const id of cases){const source=readFileSync(path,'utf8'),result=check(source);const old=source.replace('return this.appForeground && this.mounted && identity.length > 0','return this.mounted && identity.length > 0');assert.notEqual(old,source);assert.throws(()=>check(old),/background-created Save actor recovers/);console.log(JSON.stringify({case:id,result,rejectedOldPredicate:true}));recordContractCasePass(id);}
