import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { boundedSurfaceSdk } from './lib/bounded-surface-sdk-probe.mjs';
import {SOURCE_SWITCH_VISUAL} from '../entry/src/main/ets/features/source/SourceSwitchVisual.ts';
import {readerAppColor} from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
const read=path=>readFileSync(new URL(`../entry/src/main/ets/${path}`,import.meta.url),'utf8');
const source=read('features/source/SourceSwitchWindow.ets'),tts=read('features/reading/ReaderTtsConfigOverlay.ets');
// SDK lowering alone does not diagnose incompatible inherited properties.
// Compare real business callbacks with the installed CustomComponent API.
const sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const require=createRequire(import.meta.url),ts=require(sdk+'/node_modules/typescript');
const api=ts.createSourceFile('/tmp/common.d.ts',readFileSync(resolve(sdk,'../../component/common.d.ts'),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const declarations=new Map(api.statements.filter(ts.isClassDeclaration).map(node=>[node.name.text,node]));
const inherited=new Set(),visited=new Set();
function collectInherited(name){
  if(visited.has(name))return;visited.add(name);const declaration=declarations.get(name);assert.ok(declaration,'actual SDK base declaration '+name);
  for(const member of declaration.members)if(member.name)inherited.add(member.name.getText(api));
  for(const clause of declaration.heritageClauses??[])if(clause.token===ts.SyntaxKind.ExtendsKeyword)for(const base of clause.types)collectInherited(base.expression.getText(api));
}
collectInherited('CustomComponent');assert.ok(inherited.has('onDragStart')&&inherited.has('onDragEnd'),'installed SDK reserves both native drag APIs');
const headerSource=read('features/common/ReaderBoundedSurfaceHeader.ets');
function verifyBusinessCallbacks(candidate){
  const parsed=ts.createSourceFile('/tmp/ReaderBoundedSurfaceHeader.ets',candidate,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,require(sdk+'/lib/ets_checker.js').compilerOptions);
  const header=parsed.statements.find(node=>node.name?.text==='ReaderBoundedSurfaceHeader');assert.ok(header);
  for(const member of header.members.filter(node=>ts.isPropertyDeclaration(node)&&node.type&&ts.isFunctionTypeNode(node.type)))
    assert.equal(inherited.has(member.name.getText(parsed)),false,'business callback shadows ArkUI CustomComponent API: '+member.name.getText(parsed));
}
verifyBusinessCallbacks(headerSource);
for(const reserved of ['onDragStart','onDragEnd'])assert.throws(()=>verifyBusinessCallbacks(headerSource.replaceAll(reserved==='onDragStart'?'onHandlePanStart':'onHandlePanEnd',reserved)),/shadows ArkUI CustomComponent API/,'the original inherited-method collision is rejected before packaging');
{
  const gestures=[],calls=[];
  const panGesture=new Proxy({}, {get:(_target,name)=>(...args)=>{
    if(name==='create')gestures.push({options:args[0]});else if(String(name).startsWith('onAction'))gestures.at(-1)[name]=args[0];
  }});
  const probe=boundedSurfaceSdk({panGesture});
  const header=new probe.deps.ReaderBoundedSurfaceHeader(undefined,{specId:'reader-action-sheet',placement:'bottom',title:'更多',
    onHandlePanStart:()=>calls.push(['start']),onHandlePanUpdate:offset=>calls.push(['update',offset]),onHandlePanEnd:(offset,velocity)=>calls.push(['end',offset,velocity])});
  header.initialRender();assert.equal(gestures.length,1);const gesture=gestures[0];
  assert.deepEqual(gesture.options,{fingers:1,direction:'vertical',distance:1});
  gesture.onActionStart();gesture.onActionUpdate({offsetY:24});gesture.onActionEnd({offsetY:24,velocityY:80});gesture.onActionCancel();
  assert.deepEqual(calls,[['start'],['update',24],['end',24,80],['end',0,0]],'actual SDK gesture forwards unchanged offset/velocity and cancel semantics through the business callbacks');
}
for(const [specId,width,height,radius,type] of [['source-switch-window',300,385,20,'Column'],['tts-config-manager','100%',574,22,'Column'],['tts-config-picker',260,172,14,'Column'],['local-import-selection',350,399.75,20,'Column'],['local-import-progress',350,228,20,'Stack'],['local-import-result-content',350,500,undefined,'Column'],['reader-replace-editor',338,666,12,'Column']]){
  const probe=boundedSurfaceSdk(),calls=[];
  const f=new probe.deps.ReaderBoundedSurface(undefined,{specId,surfaceWidth: width,surfaceHeight: height});
  Object.assign(f,{header:()=>calls.push('header'),body:()=>calls.push('body'),actions:()=>calls.push('actions')});f.initialRender();
  assert.deepEqual(calls,['header','body','actions']);const shell=[...f.nodes.values()].find(n=>n.type===type);assert.equal(shell.width,width);assert.equal(shell.height,height);assert.equal(shell.borderRadius,radius);
  f.updateStateVars({specId,surfaceWidth: width,surfaceHeight:height-40});probe.properties.flush();assert.equal(shell.height,height-40,'actual SDK property update keeps the same frame node');
  if(specId==='source-switch-window')for(const property of ['constraintSize','shadow','clip'])assert.ok(!f.attributeCalls.some(c=>c.property===property),`${property} stays absent rather than explicit undefined`);
  if(specId==='local-import-result-content'){assert.equal(shell.backgroundColor,undefined);assert.equal(shell.alignItems,'HorizontalAlign.Start');}
}
// The live source drawer is a distinct registered frame. Its measured height
// is supplied by the source owner; the retired popup above retains its own
// legacy geometry and cannot substitute for this drawer.
for(const scheme of ['day','night']){
  const probe=boundedSurfaceSdk();
  const f=new probe.deps.ReaderBoundedSurface(undefined,{specId:'source-switch-drawer',surfaceWidth:'100%',surfaceHeight:699,scheme});f.initialRender();
  const shell=[...f.nodes.values()].find(n=>n.type==='Column'),id=shell.id;
  assert.equal(shell.width,'100%');assert.equal(shell.height,699);
  assert.deepEqual(shell.constraintSize,{maxWidth:SOURCE_SWITCH_VISUAL.drawerMaxWidth});
  assert.deepEqual(shell.borderRadius,{topLeft:SOURCE_SWITCH_VISUAL.drawerCornerRadius,topRight:SOURCE_SWITCH_VISUAL.drawerCornerRadius});
  assert.equal(shell.backgroundColor,readerAppColor('TOK_SS_WINDOW_BG',scheme));assert.equal(shell.clip,true);
  assert.equal(shell.padding,undefined);assert.equal(shell.transition,undefined);
  f.updateStateVars({specId:'source-switch-drawer',surfaceWidth:'100%',surfaceHeight:320,scheme});probe.properties.flush();
  assert.equal(shell.height,320);assert.equal(shell.id,id,'actual measured drawer update retains its frame actor');
}
for(const specId of ['source-switch-window','tts-config-manager','tts-config-picker']){
  const probe=boundedSurfaceSdk();let close=0;
  const h=new probe.deps.ReaderBoundedSurfaceHeader(undefined,{specId,title:'original',surfaceWidth:300,actionEnabled:true,onClose:()=>close++});h.initialRender();
  const title=[...h.nodes.values()].find(n=>n.type==='Text'&&n.create==='original');const target=[...h.nodes.values()].find(n=>n.onClick);target.onClick();assert.equal(close,1);
  h.updateStateVars({specId,title:'replacement',surfaceWidth:280,actionEnabled:false});probe.properties.flush();assert.equal(title.create,'replacement');target.onClick();assert.equal(close,1,'retained shared close callback uses live admission');
  assert.equal(target.enabled,false);if(specId==='source-switch-window'){assert.equal(target.width,44);assert.equal(target.height,44);}else{
    assert.deepEqual(target.responseRegion,{x:-6,y:-6,width:28,height:28});
    for(const property of ['height','lineHeight','constraintSize','margin'])assert.ok(!h.attributeCalls.some(c=>c.id===title.id&&c.property===property),`TTS AUTO ${property} is never authored`);
  }
}
{
  const probe=boundedSurfaceSdk();
  const f=new probe.deps.ReaderBoundedSurface(undefined,{specId:'bookshelf-book-action',surfaceWidth:99,surfaceHeight:99});f.initialRender();
  const shell=[...f.nodes.values()].find(n=>n.type==='Stack');assert.equal(shell.width,'100%');assert.equal(shell.height,270);assert.deepEqual(shell.borderRadius,{topLeft:24,topRight:24,bottomLeft:0,bottomRight:0});
  const h=new probe.deps.ReaderBoundedSurfaceHeader(undefined,{specId:'bookshelf-book-action',title:'书籍操作',surfaceWidth:99,actionEnabled:true});h.initialRender();
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
assert.match(source,/ReaderBoundedSurface\(\{\s*specId: 'source-switch-drawer', surfaceWidth: '100%', surfaceHeight: this\.drawerHeight\(\)/,'approved source picker consumes the explicitly registered measured drawer frame');
assert.doesNotMatch(source,/ReaderBoundedSurface\(\{\s*specId: 'source-switch-window'|resolvePopupSpec\('source-switch-window'\)/,'approved source picker cannot consume the retained legacy popup spec');
assert.match(source,/export struct SourceSwitchWindow/);assert.match(source,/\.width\('100%'\)\.height\('100%'\)/);
assert.match(tts,/ReaderBoundedSurface\(\{[^]*header: \(\): void => \{ this\.boundedHeader\(\); \}, body: \(\): void => \{ this\.boundedContent\(\); \}, actions: \(\): void => \{ this\.boundedActions\(\); \}/);
assert.doesNotMatch(source,/\.backgroundColor\(readerAppColor\(this\.surfaceSpec\(\)\.surfaceBackgroundRole/);
assert.doesNotMatch(tts,/\.borderRadius\(this\.manager \? this\.managerSurfaceSpec/);
console.log('bounded Frame/Header/Actions PASS: finite native structures, actual SDK properties/slots/callback updates, absent AUTO calls, original measured bounds and action admission; native layout remains separate');
