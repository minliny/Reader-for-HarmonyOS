import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const selected = selectContractCases({
  'journey-retention': 'Actual SourceJourneyPresentation and both operation owners retain copied filters/scroll only across the same Runtime Source-Tools-Source journey; no Core process.',
  'scroll-restoration': 'Actual Source page capture/restore methods preserve signed header offsets and same-layout itemY, use current-layout insets, and retire changed-filter/old-opening frames.',
});
if (selected.length) {
  registerHooks({ resolve(specifier, context, next) {
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
      const url = new URL(specifier + '.ts', context.parentURL);
      if (existsSync(fileURLToPath(url))) return next(url.href, context);
    }
    return next(specifier, context);
  } });
  const { copySourceManagementScroll, sourceManagementFilterKey } = await import('../entry/src/main/ets/features/source/presentation/SourceManagementScrollState.ts');
  const { actualSourceJourneyTypes } = await import('./lib/source-management-owner-probe.mjs');
  const { runtimeOwnerIdentityProbe } = await import('./lib/reader-runtime-admission-probe.mjs');
  const { selectedProductionMethods } = await import('./lib/selected-production-methods.mjs');
  const tick = () => new Promise(resolve => setImmediate(resolve));
  const filters={searchQuery:'晋江',status:'未检测',category:'novel',group:'自选'};
  const scroll={anchorId:'b',firstIndex:2,itemY:22,offset:345,filterKey:sourceManagementFilterKey(filters),layoutKey:'328:1:0'};
  async function journeyRetention() {
    let installed;
    const Runtime=runtimeOwnerIdentityProbe(()=>installed);
    const {SourceJourneyPresentation,SourceOrchestrator,SourceToolsOrchestrator}=actualSourceJourneyTypes({ReaderRuntimeOwner:Runtime,hilog:{info(){},warn(){},error(){}}});
    const runtime=()=>({supportsCoreCapability:()=>false,async request(method){assert.equal(method,'source.list');return{data:{sources:[]}};}});
    const settle=async(owner)=>{await tick();await SourceOrchestrator.forRuntime(owner)?.operationChain;await SourceToolsOrchestrator.forRuntime(owner)?.operationTail;await tick();};
    const owner=runtime();installed=owner;
    const journey=new SourceJourneyPresentation();
    let route='source';
    journey.openManagement(owner,'source:first',()=>route==='source');await settle(owner);
    assert.equal(journey.initialManagementViewState('source:first'),undefined);
    const requested={...filters,anchorSourceId:'b',anchorFallbackIndex:1,toolsEntry:'header',scroll:{...scroll}};
    assert.equal(journey.retainManagementViewForTools('source:old',requested),false);
    assert.equal(journey.retainManagementViewForTools('source:first',requested),true);
    requested.searchQuery='caller mutation';requested.scroll.offset=999;
    journey.retire();route='sourceTools';journey.openTools(owner,'tools:first',()=>route==='sourceTools');await settle(owner);
    journey.retire();route='source';journey.openManagement(owner,'source:return',()=>route==='source');await settle(owner);
    const returned=journey.initialManagementViewState('source:return');
    assert.deepEqual(returned,{...filters,anchorSourceId:'b',anchorFallbackIndex:1,toolsEntry:'header',scroll});
    returned.group='caller changed returned value';returned.scroll.itemY=-999;
    assert.equal(journey.initialManagementViewState('source:return').group,filters.group);
    assert.equal(journey.initialManagementViewState('source:return').scroll.itemY,22);
    assert.equal(journey.initialManagementViewState('source:first'),undefined);
    journey.retainManagementViewForTools('source:return',{...filters,anchorSourceId:'b',scroll});
    journey.retire();journey.retire();
    journey.openManagement(owner,'source:fresh',()=>true);await settle(owner);
    assert.equal(journey.initialManagementViewState('source:fresh'),undefined,'an extra route retirement ends the Tools handoff');
    journey.retainManagementViewForTools('source:fresh',{...filters,anchorSourceId:'b',scroll});journey.retire();
    route='sourceTools';journey.openTools(owner,'tools:second',()=>route==='sourceTools');await settle(owner);journey.retire();
    const next=runtime();installed=next;route='source';journey.openManagement(next,'source:new-runtime',()=>true);await settle(next);
    assert.equal(journey.initialManagementViewState('source:new-runtime'),undefined,'another Runtime owns a fresh presentation');
    assert.equal(copySourceManagementScroll({...scroll,offset:NaN}),undefined);
    assert.equal(copySourceManagementScroll({...scroll,itemY:Infinity}),undefined);
    assert.equal(copySourceManagementScroll({...scroll,firstIndex:-1}),undefined);
    assert.equal(copySourceManagementScroll({...scroll,anchorId:'',firstIndex:0,offset:-58}).offset,-58);
  }
  async function scrollRestoration() {
    const file=new URL('../entry/src/main/ets/features/source/ui/SourceManagementPage.ets',import.meta.url);
    const source=readFileSync(file,'utf8');
    const {installedEtsCompiler}=await import('./lib/ets-compiler-runtime.mjs');
    const {ts,options}=installedEtsCompiler();
    const tree=ts.createSourceFile('SourceScroll.ets',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
    const frame=tree.statements.find(node=>node.name?.getText(tree)==='SourceListLayoutFrame');assert.ok(frame);
    const emitted=ts.transpileModule(frame.getText(tree),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
    const SourceListLayoutFrame=new Function('FrameCallback',emitted+';return SourceListLayoutFrame;')(class{});
    const names=['currentFilterKey','scrollLayoutKey','cancelScrollRestore','captureScroll','requestOpenTools',
      'scheduleSourceAnchorRestore','sourceAnchorReadPending','sourceReturnFiltersMatch','managementOpeningIsCurrent','managementBackIsCurrent','cancelToolsReturnFocus'];
    const Page=selectedProductionMethods(file,'SourceManagementPage',names,{SourceListLayoutFrame,sourceManagementFilterKey,copySourceManagementScroll,
      readerScrollStartOffset:value=>value.startInset,ScrollAlign:{START:'start'},Edge:{Top:'top'}});
    function page(initial={...filters,anchorSourceId:'b',anchorFallbackIndex:1,scroll:{...scroll}}) {
      const actor=new Page(),frames=[],calls=[];
      Object.assign(actor,{mounted:true,appForeground:true,listMounted:true,temporaryBackIdentity:'source:current',
        searchQuery:filters.searchQuery,statusValue:filters.status,categoryValue:filters.category,groupValue:filters.group,
        initialViewState:initial,pendingSourceAnchor:initial.anchorSourceId,pendingScroll:copySourceManagementScroll(initial.scroll),
        firstVisibleListIndex:2,scrollRestoreEpoch:0,anchorRestoreScheduled:false,toolsFocusRevision:0,
        operation:{readFacts:{fact:'succeeded'}},statusKind:'idle',projectedSources:[{sourceId:'a'},{sourceId:'b'},{sourceId:'c'}],
        readerWindowMetricsRevision:0,contentFrame:()=>({width:328}),fontScale:()=>1,scrollLayout:()=>({startInset:58}),
        sourceScroller:{currentOffset:()=>({yOffset:345}),getItemRect:()=>({y:80,height:110}),
          scrollToIndex:(...args)=>calls.push(['index',...args]),scrollBy:(...args)=>calls.push(['by',...args]),
          scrollTo:value=>calls.push(['to',value]),scrollEdge:value=>calls.push(['edge',value])},
        getUIContext:()=>({postFrameCallback:callback=>frames.push(callback)})});
      return{actor,frames,calls,flush(){for(let i=0;i<5&&frames.length;i++)frames.shift().onIdle(1);assert.equal(frames.length,0,'bounded exact frame chain');}};
    }
    const same=page();same.actor.scheduleSourceAnchorRestore();same.flush();
    assert.deepEqual(same.calls,[['index',2,false,'start'],['by',0,58]],'same-layout anchor retains its item offset');
    const changed=page();changed.actor.fontScale=()=>2;changed.actor.scheduleSourceAnchorRestore();changed.flush();
    assert.deepEqual(changed.calls,[['index',2,false,'start'],['by',0,22]],'changed layout aligns to current header clearance');
    const top=page({...filters,anchorSourceId:'',scroll:{...scroll,anchorId:'',firstIndex:0,offset:-58}});
    top.actor.scheduleSourceAnchorRestore();top.flush();assert.deepEqual(top.calls,[['to',{xOffset:0,yOffset:-58,animation:false}]]);
    for(const retire of ['opening','filter','touch']) {
      const old=page();old.actor.scheduleSourceAnchorRestore();
      if(retire==='opening')old.actor.temporaryBackIdentity='source:successor';
      if(retire==='filter')old.actor.searchQuery='changed';
      if(retire==='touch')old.actor.cancelScrollRestore();
      old.flush();assert.deepEqual(old.calls,[],`${retire} retires queued restore`);
    }
    const capture=page();capture.actor.cancelScrollRestore();capture.actor.sourceScroller.getItemRect=()=>({y:22,height:110});
    let returned;capture.actor.onOpenTools=value=>returned=value;capture.actor.requestOpenTools('footer');
    assert.deepEqual(returned,{...filters,anchorSourceId:'b',anchorFallbackIndex:1,toolsEntry:'footer',scroll});
  }
  const cases={'journey-retention':journeyRetention,'scroll-restoration':scrollRestoration};
  for(const id of selected){await cases[id]();recordContractCasePass(id);}
}
