import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import {boundedSurfaceSdk} from './lib/bounded-surface-sdk-probe.mjs';
import {pureModuleProbe} from './lib/ets-pure-module-probe.mjs';
import {selectedProductionMethods} from './lib/selected-production-methods.mjs';

const cases=selectContractCases({'text-row-target':'Real SDK text Tree row uses the same full-height carrier/response as its current production parent at 1/1.3/1.45/2; group, current, disabled and independent accessory lanes. No native hit or glyph claim.'});
const base=new URL('../entry/src/main/ets/features/',import.meta.url),read=name=>readFileSync(new URL(name,base),'utf8');
for(const id of cases){
 const source=read('reading/ui/ReaderDirectoryNavigationList.ets');
 const scaleHelpers=pureModuleProbe(read('../ui/foundation/ReaderSurfaceResolvers.ts'),'ReaderSurfaceResolvers.ts',{},['readerReadableFontScale','readerScaledControlHeight']);
 const accessibility=pureModuleProbe(read('../ui/controls/ReaderActionAccessibility.ets'),'ReaderActionAccessibility.ets',{AccessibilityRoleType:{BUTTON:'button'}},['readerActionTouchRegion','ReaderActionAccessibility']);
 const samples=[];
 function render(candidate,scale,kind,current,accessories,form='standalone'){
  const sdk=boundedSurfaceSdk(),metrics={systemFontScale:scale};
  const deps={...sdk.deps,...scaleHelpers,...accessibility,readerWindowMetrics:()=>metrics};
  const Panel=selectedProductionMethods(new URL('reading/ui/FullDirectoryPanel.ets',base),'FullDirectoryPanel',['fontScale','directoryRowHeight','directoryListRowHeight','controlProgress'],deps);
  const panel=Object.assign(new Panel(),{readerWindowMetricsRevision:1,embeddedInControl:false,motionProgress:1});
  const Control=selectedProductionMethods(new URL('reading/ui/ReaderControlDirectoryContent.ets',base),'ReaderControlDirectoryContent',['fontScale','rowHeight','selectedMinimum','preparedProfile','value'],deps);
  const control=Object.assign(new Control(),{readerWindowMetricsRevision:1,minimumMetricsRevision:1,minimumProfiles:new Map(),minimumKey:'',tab:'directory',progress:form==='controlQuick'?0:1});
  const height=form==='standalone'?panel.directoryListRowHeight():control.rowHeight();
  if(form!=='controlQuick')assert.equal(control.rowHeight(),panel.directoryListRowHeight(),'both Full text Tree parents reserve the same lane');
  if(scale===1)assert.equal(height,form==='controlQuick'?32:40,'original Quick32/Full40 parent allocation');
  const row={nodeId:'chapter17',kind,title:'第17章 native carrier',depth:0,level:1,chapterIndex:kind==='target'?16:undefined,hasChildren:kind==='group'||accessories,expanded:false};
  const item={key:'chapter17',index:16,node:row},events=[];
  const owner=createReaderBuilderProbe(candidate,['row','isCurrentNode','displayLevel','positionRowHeight','bookmarkActionEnabled'],deps,sdk.hooks).owner;
  Object.assign(owner,{view:{currentVisibleIndex:current?16:undefined,currentAncestorNodeId:current?row.nodeId:undefined},dataSource:{loadedNode:()=>current?row:undefined},
   rowHeight:height,appThemeScheme:'day',interactionEnabled:true,chapterDownloadEnabled:accessories,chapterDownloadActionsEnabled:false,
   chapterByIndex:new Map(accessories?[[16,{index:16,navigable:true,downloadState:'idle',bookmarks:[]}]]:[]),
   selectTarget:node=>events.push(['select',node.nodeId]),toggleNode:node=>events.push(['toggle',node.nodeId]),marker:entry=>events.push(['marker',entry.index]),
   canDownloadTarget:()=>true,downloadTarget:node=>events.push(['download',node.nodeId])});
  owner.row(item);const nodes=[...owner.nodes.values()],title=nodes.find(n=>n.type==='Text'&&n.create===row.title);
  assert(title);const parent=nodes.find(n=>n.type==='Row'&&n.width==='100%'&&n.height===height);assert(parent);
  assert.equal(title.height,height,'chapter Text must own the full parent carrier, not its natural glyph height');
  assert.equal(title.responseRegion.y,0);assert.equal(title.responseRegion.height,height,'carrier and response use one scaled extent');
  assert.equal(title.responseRegion.width,'100%');assert.equal(title.layoutWeight,1);assert.equal(title.maxLines,1);
  assert.equal(title.fontSize,sdk.deps.TYPE_READER_DIRECTORY_TITLE.fontSizeFp,'approved glyph role remains unchanged');
  assert.equal(title.fontFamily,sdk.deps.TYPE_READER_DIRECTORY_TITLE.fontFamily);
  assert.equal(owner.positionRowHeight(16),height,'scroll anchors consume the same actual row lane');
  const y=height*3;assert.equal(y+title.responseRegion.y,y);assert.equal(y+title.responseRegion.y+title.responseRegion.height,y+height,'target never enters either adjacent row');
  const accessoryNodes=nodes.filter(n=>n.onClick&&n!==title);for(const node of accessoryNodes){assert.equal(node.height,height);assert.equal(node.width,44);assert.equal(node.responseRegion.height,height);assert.equal(node.responseRegion.y,0);assert.equal(node.responseRegion.x,0);}
  assert.equal(accessoryNodes.length,kind==='group'?1:accessories?3:0);
  if(kind!=='disabled'){title.onClick();assert.deepEqual(events,[[kind==='group'?'toggle':'select',row.nodeId]]);}
  else assert.equal(title.enabled,false,'disabled state remains owned by the production accessibility modifier');
  samples.push({scale,form,kind,current,accessories,parentHeight:height,carrierHeight:title.height,responseHeight:title.responseRegion.height,complete44:height>=44,conflict:height<44?'host':'none',adjacentOverlap:0});
 }
 for(const scale of[1,1.3,1.45,2])for(const form of['standalone','controlQuick','controlFull'])for(const [kind,current,accessories]of[['target',false,false],['target',true,true],['group',false,false],['disabled',false,false]])render(source,scale,kind,current,accessories,form);
 const withoutCarrier=source.replace("Text(item.node.title)\n          .height(this.rowHeight)","Text(item.node.title)");
 assert.notEqual(withoutCarrier,source,'negative removes exactly the production chapter carrier');
 assert.throws(()=>render(withoutCarrier,1,'target',false,false),/chapter Text must own the full parent carrier/,'natural-height Text fails even when a response rectangle is declared');
 const inflated=source.replace("Text(item.node.title)\n          .height(this.rowHeight)","Text(item.node.title)\n          .height(Math.max(44, this.rowHeight))");
 assert.notEqual(inflated,source);
 assert.throws(()=>render(inflated,1,'target',true,false,'controlQuick'),/chapter Text must own the full parent carrier/,'uniform44 cannot exceed the actual32 parent lane');
 console.log(JSON.stringify({kind:'directory-text-row-target-evidence',proof:'SDK declared carrier/response/parent extents; actual Native hit and glyph remain separate',samples}));
 recordContractCasePass(id);
}
