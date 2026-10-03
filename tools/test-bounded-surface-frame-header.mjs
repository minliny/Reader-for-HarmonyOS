import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { boundedSurfaceSdk } from './lib/bounded-surface-sdk-probe.mjs';
const read=path=>readFileSync(new URL(`../entry/src/main/ets/${path}`,import.meta.url),'utf8');
const source=read('features/source/SourceSwitchWindow.ets'),tts=read('features/reading/ReaderTtsConfigOverlay.ets');
for(const [specId,width,height,radius,type] of [['source-switch-window',300,385,20,'Column'],['tts-config-manager','100%',574,22,'Column'],['tts-config-picker',260,172,14,'Column'],['local-import-selection',350,399.75,20,'Column'],['local-import-progress',350,228,20,'Stack'],['local-import-result-content',350,500,undefined,'Column'],['reader-replace-editor',338,666,12,'Column']]){
  const probe=boundedSurfaceSdk(),calls=[];
  const f=new probe.deps.ReaderBoundedSurface(undefined,{specId,width,height});
  Object.assign(f,{header:()=>calls.push('header'),body:()=>calls.push('body'),actions:()=>calls.push('actions')});f.initialRender();
  assert.deepEqual(calls,['header','body','actions']);const shell=[...f.nodes.values()].find(n=>n.type===type);assert.equal(shell.width,width);assert.equal(shell.height,height);assert.equal(shell.borderRadius,radius);
  f.updateStateVars({specId,width,height:height-40});probe.properties.flush();assert.equal(shell.height,height-40,'actual SDK property update keeps the same frame node');
  if(specId==='source-switch-window')for(const property of ['constraintSize','shadow','clip'])assert.ok(!f.attributeCalls.some(c=>c.property===property),`${property} stays absent rather than explicit undefined`);
  if(specId==='local-import-result-content'){assert.equal(shell.backgroundColor,undefined);assert.equal(shell.alignItems,'HorizontalAlign.Start');}
}
for(const specId of ['source-switch-window','tts-config-manager','tts-config-picker']){
  const probe=boundedSurfaceSdk();let close=0;
  const h=new probe.deps.ReaderBoundedSurfaceHeader(undefined,{specId,title:'original',width:300,enabled:true,onClose:()=>close++});h.initialRender();
  const title=[...h.nodes.values()].find(n=>n.type==='Text'&&n.create==='original');const target=[...h.nodes.values()].find(n=>n.onClick);target.onClick();assert.equal(close,1);
  h.updateStateVars({specId,title:'replacement',width:280,enabled:false});probe.properties.flush();assert.equal(title.create,'replacement');target.onClick();assert.equal(close,1,'retained shared close callback uses live admission');
  assert.equal(target.enabled,false);if(specId==='source-switch-window'){assert.equal(target.width,44);assert.equal(target.height,44);}else{
    assert.deepEqual(target.responseRegion,{x:-6,y:-6,width:28,height:28});
    for(const property of ['height','lineHeight','constraintSize','margin'])assert.ok(!h.attributeCalls.some(c=>c.id===title.id&&c.property===property),`TTS AUTO ${property} is never authored`);
  }
}
{
  const probe=boundedSurfaceSdk();
  const f=new probe.deps.ReaderBoundedSurface(undefined,{specId:'bookshelf-book-action',width:99,height:99});f.initialRender();
  const shell=[...f.nodes.values()].find(n=>n.type==='Stack');assert.equal(shell.width,'100%');assert.equal(shell.height,270);assert.deepEqual(shell.borderRadius,{topLeft:24,topRight:24,bottomLeft:0,bottomRight:0});
  const h=new probe.deps.ReaderBoundedSurfaceHeader(undefined,{specId:'bookshelf-book-action',title:'书籍操作',width:99,enabled:true});h.initialRender();
  const title=[...h.nodes.values()].find(n=>n.type==='Text');assert.ok(!h.attributeCalls.some(c=>c.id===title.id&&c.property==='width'),'sheet title AUTO is actually omitted');assert.deepEqual(title.position,{x:14,y:34});assert.equal([...h.nodes.values()].some(n=>n.onClick),false,'sheet header owns no close');
}
for(const specId of ['local-file-selection','local-import-result','tts-manager','replace-editor']){
  const probe=boundedSurfaceSdk(),actions=[];let measured=0;
  const a=new probe.deps.ReaderBoundedSurfaceActions(undefined,{specId,primaryLabel:'保存',primaryEnabled:true,cancelEnabled:true,actionWidth:318,availableHeight:400,onAction:id=>actions.push(id),onAreaChanged:()=>measured++});a.initialRender();
  const primary=[...a.nodes.values()].find(n=>n.onClick&&(n.type==='Text'?n.create==='保存':n.type==='Row'&&n.borderRadius=== (specId==='local-import-result'?20:22)));
  assert.ok(primary);const count=a.nodes.size;primary.onClick();assert.deepEqual(actions,['primary']);
  a.updateStateVars({specId,primaryLabel:'正在保存',primaryEnabled:false,cancelEnabled:false,actionWidth:300,availableHeight:80});probe.properties.flush();primary.onClick();assert.deepEqual(actions,['primary']);assert.equal(primary.enabled,false);assert.equal(a.nodes.size,count);
  const label=[...a.nodes.values()].find(n=>n.type==='Text'&&n.create==='正在保存');assert.ok(label);
  if(specId==='local-import-result'){assert.equal(primary.width,300);const footer=[...a.nodes.values()].find(n=>n.onAreaChange);footer.onAreaChange({},{});assert.equal(measured,1);assert.deepEqual(footer.padding,{left:16,right:16,top:16,bottom:20});assert.ok(!a.attributeCalls.some(c=>c.id===primary.id&&c.property==='layoutWeight'));}
  if(specId==='local-file-selection')assert.ok(!a.attributeCalls.some(c=>c.id===primary.id&&c.property==='width'));
}
// All style inputs are finite. Native node reuse between incompatible family IDs
// is intentionally absent: callers retain same-family instances per opening.
assert.match(source,/ReaderBoundedSurface\(\{[^]*header: \(\): void => \{ this\.header\(\); \}, body: \(\): void => \{ this\.windowBody\(\); \}, actions: \(\): void => \{ this\.footer\(\); \}/);
assert.match(tts,/ReaderBoundedSurface\(\{[^]*header: \(\): void => \{ this\.boundedHeader\(\); \}, body: \(\): void => \{ this\.boundedContent\(\); \}, actions: \(\): void => \{ this\.boundedActions\(\); \}/);
assert.doesNotMatch(source,/\.backgroundColor\(readerAppColor\(this\.surfaceSpec\(\)\.surfaceBackgroundRole/);
assert.doesNotMatch(tts,/\.borderRadius\(this\.manager \? this\.managerSurfaceSpec/);
console.log('bounded Frame/Header/Actions PASS: finite native structures, actual SDK properties/slots/callback updates, absent AUTO calls, original measured bounds and action admission; native layout remains separate');
