import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';

const cases=selectContractCases({'text-row-target':'Real SDK text Tree row uses the same full-height carrier/response as its current production parent at 1/1.3/1.45/2; group, current, disabled and independent accessory lanes. No native hit or glyph claim.'});
for(const id of cases){
 const {default:assert}=await import('node:assert/strict');
 const {readFileSync}=await import('node:fs');
 const {createReaderBuilderProbe}=await import('./lib/reader-control-builder-probe.mjs');
 const {boundedSurfaceSdk}=await import('./lib/bounded-surface-sdk-probe.mjs');
 const {pureModuleProbe}=await import('./lib/ets-pure-module-probe.mjs');
 const {selectedProductionMethods}=await import('./lib/selected-production-methods.mjs');
 const {installedEtsCompiler}=await import('./lib/ets-compiler-runtime.mjs');
 const base=new URL('../entry/src/main/ets/features/',import.meta.url),read=name=>readFileSync(new URL(name,base),'utf8');
 const source=read('reading/ReaderDirectoryNavigationList.ets');
 const scaleHelpers=pureModuleProbe(read('common/ReaderSurfaceResolvers.ts'),'ReaderSurfaceResolvers.ts',{},['readerReadableFontScale','readerScaledControlHeight']);
 const accessibility=pureModuleProbe(read('common/ReaderActionAccessibility.ets'),'ReaderActionAccessibility.ets',{AccessibilityRoleType:{BUTTON:'button'}},['readerActionTouchRegion','ReaderActionAccessibility']);
 const samples=[];
 function render(candidate,scale,kind,current,accessories){
  const sdk=boundedSurfaceSdk(),metrics={systemFontScale:scale};
  const deps={...sdk.deps,...scaleHelpers,...accessibility,ReaderWindowCoordinator:{metrics:()=>metrics}};
  const Panel=selectedProductionMethods(new URL('reading/FullDirectoryPanel.ets',base),'FullDirectoryPanel',['fontScale','directoryRowHeight','directoryListRowHeight','controlProgress'],deps);
  const panel=Object.assign(new Panel(),{readerWindowMetricsRevision:1,embeddedInControl:false,motionProgress:1});
  const Control=selectedProductionMethods(new URL('reading/ReaderControlDirectoryContent.ets',base),'ReaderControlDirectoryContent',['fontScale','rowHeight'],deps);
  const control=Object.assign(new Control(),{readerWindowMetricsRevision:1,tab:'directory'});
  const height=panel.directoryListRowHeight();assert.equal(control.rowHeight(),height,'both actual text Tree parents reserve the same lane');
  const row={nodeId:'chapter17',kind,title:'第17章 native carrier',depth:0,level:1,chapterIndex:kind==='target'?16:undefined,hasChildren:kind==='group'||accessories,expanded:false};
  const item={key:'chapter17',index:16,node:row},events=[];
  const owner=createReaderBuilderProbe(candidate,['row','isCurrentNode','displayLevel'],deps,sdk.hooks).owner;
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
  const y=height*3;assert.equal(y+title.responseRegion.y,y);assert.equal(y+title.responseRegion.y+title.responseRegion.height,y+height,'target never enters either adjacent row');
  const accessoryNodes=nodes.filter(n=>n.onClick&&n!==title);for(const node of accessoryNodes){assert.equal(node.height,height);assert.equal(node.width,44);assert.equal(node.responseRegion.height,height);assert.equal(node.responseRegion.y,0);assert.equal(node.responseRegion.x,0);}
  assert.equal(accessoryNodes.length,kind==='group'?1:accessories?3:0);
  if(kind!=='disabled'){title.onClick();assert.deepEqual(events,[[kind==='group'?'toggle':'select',row.nodeId]]);}
  else assert.equal(title.enabled,false,'disabled state remains owned by the production accessibility modifier');
  samples.push({scale,kind,current,accessories,parentHeight:height,carrierHeight:title.height,responseHeight:title.responseRegion.height,adjacentOverlap:0});
 }
 for(const scale of[1,1.3,1.45,2])for(const [kind,current,accessories]of[['target',false,false],['target',true,true],['group',false,false],['disabled',false,false]])render(source,scale,kind,current,accessories);
 const {ts,options}=installedEtsCompiler();
 const tree=ts.createSourceFile('ReaderDirectoryNavigationList.ets',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);assert.deepEqual(tree.parseDiagnostics,[]);
 const all=(node,predicate)=>{const found=[];const visit=n=>{if(predicate(n))found.push(n);ts.forEachChild(n,visit);};visit(node);return found;};
 const unwrap=node=>ts.isParenthesizedExpression(node)?unwrap(node.expression):node;
 const title=all(tree,node=>(ts.isCallExpression(node)||ts.isEtsComponentExpression(node))&&node.expression.getText(tree)==='Text'&&node.arguments[0]&&unwrap(node.arguments[0]).getText(tree)==='item.node.title');assert.equal(title.length,1);
 let statement=title[0];while(statement&&!ts.isExpressionStatement(statement))statement=statement.parent;assert.ok(statement);
 const heights=all(statement,node=>ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text==='height');assert.equal(heights.length,1);
 const height=heights[0],withoutCarrier=source.slice(0,height.getStart(tree))+height.expression.expression.getText(tree)+source.slice(height.end);
 const equivalent=source.replaceAll('Math.max(44, this.rowHeight)','Math.max(this.rowHeight, 44)').replace('Text(item.node.title)','Text((item.node.title))');assert.notEqual(equivalent,source);render(equivalent,1.45,'target',true,true);
 assert.notEqual(withoutCarrier,source,'negative removes exactly the production chapter carrier');
 assert.throws(()=>render(withoutCarrier,1,'target',false,false),/chapter Text must own the full parent carrier/,'old natural-height Text must fail even when response says44');
 console.log(JSON.stringify({kind:'directory-text-row-target-evidence',proof:'SDK declared carrier/response/parent extents; actual Native hit and glyph remain separate',samples}));
 recordContractCasePass(id);
}
