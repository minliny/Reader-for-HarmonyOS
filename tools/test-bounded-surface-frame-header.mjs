import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"header-callback-intrinsic-frame": {"description": "真实继承API碰撞/header gesture/Props/AUTO与sheet单exterior", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {
const { resolveEtsLoaderRoot, virtualFilePath } = await import('./lib/tool-environment.mjs');
const {default: assert} = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { createRequire } = await import('node:module');
const { resolve } = await import('node:path');
const { boundedSurfaceSdk } = await import('./lib/bounded-surface-sdk-probe.mjs');
const {SOURCE_SWITCH_VISUAL} = await import('../entry/src/main/ets/features/source/SourceSwitchVisual.ts');
const {readerAppColor} = await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');

const read=path=>readFileSync(new URL(`../entry/src/main/ets/${path}`,import.meta.url),'utf8');
const source=read('features/source/SourceSwitchWindow.ets'),tts=read('features/reading/ReaderTtsConfigOverlay.ets');
// SDK lowering alone does not diagnose incompatible inherited properties.
// Compare real business callbacks with the installed CustomComponent API.
const sdk=resolveEtsLoaderRoot();
const require=createRequire(import.meta.url),ts=require(sdk+'/node_modules/typescript');
const api=ts.createSourceFile(virtualFilePath('common.d.ts'),readFileSync(resolve(sdk,'../../component/common.d.ts'),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
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
  const parsed=ts.createSourceFile(virtualFilePath('ReaderBoundedSurfaceHeader.ets'),candidate,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,require(sdk+'/lib/ets_checker.js').compilerOptions);
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
    
    for(const property of ['height','lineHeight','constraintSize','margin'])assert.ok(!h.attributeCalls.some(c=>c.id===title.id&&c.property===property),`TTS AUTO ${property} is never authored`);
  }
}
// Approved bookshelf-only successor: native bindSheet paints its one frame;
// these inner slots and header flow into FIT_CONTENT without the old 270/24
// box or absolute title offsets. Other bounded families keep their witnesses.
for(const scheme of ['day','night']){
  const probe=boundedSurfaceSdk(),calls=[];
  const f=new probe.deps.ReaderBoundedSurface(undefined,{specId:'bookshelf-book-action',surfaceWidth:99,surfaceHeight:99,scheme});
  Object.assign(f,{header:()=>calls.push('header'),body:()=>calls.push('body'),actions:()=>calls.push('actions')});f.initialRender();
  assert.deepEqual(calls,['header','body','actions'],'book content keeps normal-flow slot order');
  const shell=[...f.nodes.values()].find(n=>n.type==='Column'),id=shell.id;
  assert.equal([...f.nodes.values()].filter(n=>n.type!=='If').length,1);assert.equal(shell.width,'100%');assert.equal(shell.alignItems,'HorizontalAlign.Start');assert.deepEqual(shell.padding,{bottom:20});
  for(const property of ['height','backgroundColor','border','borderRadius','shadow','clip','position','constraintSize'])
    assert.ok(!f.attributeCalls.some(c=>c.id===id&&c.property===property),`book inner ${property} is never authored; native Sheet owns its frame`);
  f.updateStateVars({specId:'bookshelf-book-action',surfaceWidth:400,surfaceHeight:999,scheme});probe.properties.flush();
  assert.equal(shell.id,id);assert.equal(shell.width,'100%');assert.deepEqual(shell.padding,{bottom:20});
  for(const property of ['height','backgroundColor','border','borderRadius','shadow','clip','position','constraintSize'])
    assert.ok(!f.attributeCalls.some(c=>c.id===id&&c.property===property),`book dimension updates cannot restore legacy ${property}`);
  const h=new probe.deps.ReaderBoundedSurfaceHeader(undefined,{specId:'bookshelf-book-action',title:'书籍操作',surfaceWidth:99,actionEnabled:true,scheme});h.appThemeScheme=scheme;h.initialRender();
  const nodes=[...h.nodes.values()].filter(n=>n.type!=='If'),header=nodes.find(n=>n.type==='Column'),grip=nodes.find(n=>n.type==='Blank'),rows=nodes.filter(n=>n.type==='Row'),title=nodes.find(n=>n.type==='Text');
  assert.equal(nodes.length,5);assert.equal(rows.length,2);assert.equal(header.width,'100%');assert.deepEqual(header.margin,{bottom:12});
  assert.equal(grip.width,40);assert.equal(grip.height,5);assert.equal(grip.backgroundColor,readerAppColor('TOK_SS_DRAWER_HANDLE',scheme));
  assert.equal(rows[0].width,'100%');assert.equal(rows[0].justifyContent,'FlexAlign.Center');assert.deepEqual(rows[0].margin,{top:12,bottom:8});
  assert.equal(rows[1].width,'100%');assert.deepEqual(rows[1].constraintSize,{minHeight:44});assert.deepEqual(rows[1].padding,{left:20,right:20});
  assert.equal(title.width,'100%');assert.equal(title.fontFamily,'ReaderNotoSerifSCBold');assert.equal(title.fontWeight,SOURCE_SWITCH_VISUAL.titleFontWeight);
assert.equal(title.halfLeading,true);assert.equal(title.maxLines,2);assert.equal(title.fontColor,readerAppColor('TOK_INK',scheme));
  assert.ok(!h.attributeCalls.some(c=>c.property==='position'),'book header and title never use absolute offsets');
  for(const node of [header,...rows,title])assert.ok(!h.attributeCalls.some(c=>c.id===node.id&&c.property==='height'),'normal-flow book header has no fixed text or row height');
  assert.equal(nodes.some(n=>n.onClick),false,'sheet header owns no close');
  const titleId=title.id;h.updateStateVars({specId:'bookshelf-book-action',title:'更新后的书籍操作',surfaceWidth:400,actionEnabled:false,scheme});probe.properties.flush();
  assert.equal(title.id,titleId);assert.equal(title.create,'更新后的书籍操作','normal-flow title remains a live SDK property');
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

}
