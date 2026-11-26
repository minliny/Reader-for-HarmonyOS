import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {projectOperationFacts} from '../entry/src/main/ets/app/ReaderOperationFacts.ts';
import {searchSharedActionFixture} from './lib/search-shared-action-probe.mjs';
const currentFixture=searchSharedActionFixture;
const source=readFileSync(new URL('../entry/src/main/ets/features/search/ui/SearchPage.ets',import.meta.url),'utf8');
const {owner}=createReaderBuilderProbe(source,['operation','retryOperation','isSweeping','isStoppedEmpty']);
let retries=0;owner.onRetry=()=>retries++;
owner.pageInputCurrent=()=>true;owner.observePageAction=()=>{};
const value={resultCount:1,totalSourceCount:2,completedSourceCount:1,failedSourceCount:0};
for(const [phase,canCancel,canRetry] of [['loading',true,false],['partial',true,false],['partial',false,true],['failed',false,true],['cancelled',false,true],['refreshing',true,false],['succeeded',false,false]]){
 const operation=projectOperationFacts({phase,value,canCancel,canRetry,generation:1});
 owner.presentation={kind:phase==='loading'?'loading':'results',operation,searching:canCancel,results:[]};
 assert.equal(owner.operation(),operation);assert.equal(owner.isSweeping(),canCancel,'the published search state controls the stop/spinner actor');
 const before=retries;owner.retryOperation();assert.equal(retries-before,canRetry?1:0,'read retry admits only the operation capability');
}
owner.presentation={kind:'empty',operation:projectOperationFacts({phase:'cancelled',canRetry:true}),stopped:false};assert.ok(owner.isStoppedEmpty(),'cancelled operation cannot masquerade as completed empty');
owner.presentation={kind:'initial'};assert.equal(owner.operation(),undefined);assert.equal(owner.isSweeping(),false);owner.retryOperation();
for(const [kind,spec,builder] of [['error','search-error-retry',p=>p.errorContent(7)],['results','search-retry-progress',p=>p.searchProgressDetails()],['empty','search-secondary',p=>p.emptyContent(()=>'原关键词',()=>7)]]){
 for(const canRetry of[false,true]){
  const operation=projectOperationFacts({phase:kind==='error'?'failed':kind==='empty'?'cancelled':'partial',value,canRetry,generation:3});
  // Whole-query error/empty retry is the fallback when no individual source
  // failure owns the task-panel action. Results exercise that actual panel.
  const f=currentFixture({kind,operation,...(kind==='results'?{}:{localSearchFailed:false,sourceListFailed:false,failedSourceCount:0})});
  builder(f.page);
  if(kind==='results'){
   const summary=f.taskTrigger();assert.ok(summary,'actual Search task summary trigger is retained');
   const trigger=f.controls.nodes(summary).find(n=>n.type==='Button'&&String(n.accessibilityText).startsWith('查看搜索进度，'));
   assert.ok(trigger,'the current task summary is one actual native Button');
   assert.equal(trigger.id,summary.triggerFocusId,'task return focus stays on the original actor');
   assert.ok(!f.controls.nodes(summary).some(n=>n.type==='Row'&&typeof n.onClick==='function'),
     'task summary visual Row does not retain a duplicate click handler');
   f.page.taskSheetContent();
   const panel=f.taskPanel();assert.ok(panel,'actual ReaderSearchTaskPanel owns result retry');
   if(!canRetry){
    assert.equal(f.actors(spec).length,0,'unavailable result retry is absent from the native task panel');
    const before=f.calls.filter(c=>c[0]==='retrySearch').length;
    panel.retryAction(panel.presentationIdentity,panel.retryIdentity)();
    assert.equal(f.calls.filter(c=>c[0]==='retrySearch').length,before,'actual panel callback also rejects unavailable retry');
    continue;
   }
  }
  const action=f.action(spec,kind==='empty'?'重新搜索':undefined);
  const before=f.calls.filter(c=>c[0]==='retrySearch').length;action.click();
  assert.equal(f.calls.filter(c=>c[0]==='retrySearch').length-before,canRetry?1:0,'actual '+kind+' parent/shared/native retry obeys owner capability');
  if(kind!=='empty')assert.equal(action.native.enabled,canRetry,'disabled retry is published to the actual native component');
  action.actor.aboutToDisappear();action.click();assert.equal(f.calls.filter(c=>c[0]==='retrySearch').length,before+(canRetry?1:0),'retired shared actor cannot retry');
 }
}
{
 const f=currentFixture({kind:'results',operation:projectOperationFacts({phase:'cancelled',canRetry:true}),stopped:false});f.page.searchProgressDetails();
 const labels=f.controls.nodes(f.taskTrigger()).filter(n=>n.type==='Text').map(n=>String(n.create));
 assert.ok(labels.some(label=>label==='已停止'),'actual native task status preserves interruption');
 assert.ok(labels.some(label=>label.includes('3/7 个书源')),'actual native task summary preserves interrupted progress');
}
{
 const f=currentFixture({kind:'results'});
 const page=f.page;
 page.listMounted=true;page.taskStatusExpanded=false;
 page.restoreClosedPanelFocus=()=>{};
 page.resultSheets();
 assert.equal(f.sheets().length,0,'the finished results own no cover');
 const opened=[];
 for(const kind of ['filter','task']){
  const identity=()=>kind==='filter'?page.filterPresentationIdentity():page.taskStatusIdentity();
  const show=kind==='filter'?'toggleSearchFilters':'toggleTaskStatus';
  page[show](identity(),false);
  assert.equal(page[kind==='filter'?'filterSheetIdentity':'taskSheetIdentity'],identity());
  page.resultSheets();f.controls.properties.flush();
  const host=f.sheets().findLast(c=>c.nativeId===`reader-search-sheet:${kind}`);
  assert.ok(host,'the actual SearchPage Builder mounted the native-cover owner');
  const anchor=[...host.nodes.values()].find(n=>n.bindContentCover);
  const options=anchor.bindContentCover[2];
  options.onWillAppear();
  options.onAppear();
  assert.equal(host.frameVisible,true,'the attached cover starts the first frame entrance');
  host.frameAttached=true;host.finishMotion(true);
  assert.equal(page.nativePanel?.identity,identity(),'SDK child opening callback captures the admitted identity');
  assert.equal(page.nativePanel?.kind,kind);
  options.onWillDismiss({});
  page.replay();f.controls.properties.flush();
  assert.equal(host.visible,false,'the owner delivers dismiss to the same keyed cover');
  assert.equal(host.coverVisible,true,'the attached frame remains hosted during exit');
  host.finishMotion(false);
  assert.equal(host.coverVisible,false,'completed frame exit releases the native cover');
  assert.equal(page.searchPanelOwnsInput(),true,'closing still owns input until native cover disappearance');
  options.onDisappear();
  assert.equal(page.searchPanelOwnsInput(),false,'native disappearance balances the original lease');
  opened.push([kind,options]);
 }
 page.toggleSearchFilters(page.filterPresentationIdentity(),false);page.resultSheets();f.controls.properties.flush();
 const current=f.sheets().filter(c=>c.nativeId==='reader-search-sheet:filter').at(-1);
 const options=[...current.nodes.values()].find(n=>n.bindContentCover).bindContentCover[2];
 options.onWillAppear();
 opened[0][1].onDisappear();
 assert.equal(page.nativePanel?.identity,page.filterPresentationIdentity(),'a retired native callback leaves the replacement open');
 options.onWillDismiss({});
 page.replay();f.controls.properties.flush();
 assert.equal(current.visible,false);
 options.onAppear();
 assert.equal(current.frameVisible,false,'Back before cover appearance prevents the first frame from starting');
 assert.equal(current.coverVisible,false);
 options.onDisappear();
 assert.equal(page.searchPanelOwnsInput(),false);
 page.toggleSearchFilters(page.filterPresentationIdentity(),false);
 page.dismissSearchFilters(page.filterPresentationIdentity());
 page.resultSheets();f.controls.properties.flush();
 const pending=f.sheets().filter(c=>c.nativeId==='reader-search-sheet:filter').at(-1);
 const inactiveAnchor=[...pending.nodes.values()].find(n=>n.bindContentCover);
 assert.equal(inactiveAnchor.bindContentCover[0],false);
 inactiveAnchor.onAppear();
 assert.equal(page.searchPanelOwnsInput(),false,'a collapsed show/hide still balances the pending mount');
}
{
 const mutant=source.replace('if (operation !== undefined && !operation.canRetry && !rerunsEmpty) return;','');assert.notEqual(mutant,source);
 const f=currentFixture({kind:'empty',operation:projectOperationFacts({phase:'cancelled',canRetry:false}),localSearchFailed:false,sourceListFailed:false,failedSourceCount:0},{pageDefinition:mutant});
 f.page.emptyContent(()=>'原关键词',()=>7);f.action('search-secondary','重新搜索').click();
 assert.equal(f.calls.filter(c=>c[0]==='retrySearch').length,1,'negative control: deleting the real business retry guard makes the same physical empty actor dispatch');
}
assert.match(source,/this\.operation\(\)\?\.fact === 'cancelled'/,'real results actor labels interrupted progress');
console.log('Search actual SDK operation consumer: PASS (loading/partial/read-failure/stopped/refresh/complete/capability/real retry actors).');
