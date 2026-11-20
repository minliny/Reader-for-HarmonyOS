import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={
 'semantics':{description:'Production action modifier composes press feedback and preserves live selected/disabled facts.'},
 'builder-actions':{description:'SDK lowered selectors, menu and TTS toggle builders expose actions and reject disabled or retired callbacks.'},
 'target-geometry':{description:'Production playback and appearance geometry gives adjacent actions non-overlapping targets and contained sections at quick/full endpoints.'},
 'scope-coverage':{description:'Parse the frozen reachable component scope and require every clickable custom action to have semantics or an explicit non-action exception; no device claim.'},
};
const selected=selectContractCases(definitions);
if(selected.length){
const {installedEtsCompiler,emitSdkProbe}=await import('./lib/ets-compiler-runtime.mjs');
const {selectedProductionValues}=await import('./lib/selected-production-methods.mjs');
const {ts,options}=installedEtsCompiler();
const base=path.resolve(import.meta.dirname,'../entry/src/main/ets/features');
const read=rel=>readFileSync(path.join(base,rel),'utf8');
const cache=new Map();
function load(rel){let f=path.resolve(base,rel);if(!existsSync(f))f+=existsSync(f+'.ts')?'.ts':'.ets';if(cache.has(f))return cache.get(f);
 const output=emitSdkProbe(readFileSync(f,'utf8'),{fileName:f,scriptKind:f.endsWith('.ets')?'ETS':'TS',compilerOptions:{target:ts.ScriptTarget.ES2021,module:ts.ModuleKind.CommonJS}});
 const m={exports:{}};cache.set(f,m.exports);new Function('require','module','exports','AccessibilityRoleType',output)(id=>load(path.relative(base,path.resolve(path.dirname(f),id))),m,m.exports,{BUTTON:'button'});return m.exports;
}
for(const id of selected){
 if(id==='semantics'){
  const {ReaderActionAccessibility,readerActionTouchRegion}=load('common/ReaderActionAccessibility.ets');
  for(const enabled of [false,true])for(const selected of [false,true]){
   const facts={},node=new Proxy({},{get:(_,k)=>v=>{facts[k]=v;return node;}});
   const m=new ReaderActionAccessibility('选择',enabled,selected,true,{applyNormalAttribute:n=>n.opacity(.8),applyPressedAttribute:n=>n.opacity(.5)});
   m.applyNormalAttribute(node);assert.deepEqual(facts,{opacity:.8,accessibilityRole:'button',accessibilityText:'选择',accessibilitySelected:selected,focusable:enabled,enabled});
   m.applyPressedAttribute(node);assert.equal(facts.opacity,.5);
  }
  assert.deepEqual(readerActionTouchRegion(24,30),{x:-10,y:-7,width:44,height:44});
  assert.deepEqual(readerActionTouchRegion(50,48),{x:0,y:0,width:50,height:48});
 }
 if(id==='builder-actions'){
  const {createReaderComponentProbe}=await import('./lib/reader-component-probe.mjs');
  const {readerFoundationTokens,foundationSpecs}=await import('./lib/reader-foundation-control-probe.mjs');
  const {readerTypographyRoles}=await import('./lib/reader-typography-probe.mjs');
  const {readerAppColor}=await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
  const policies={...readerFoundationTokens,...foundationSpecs(),...readerTypographyRoles,readerAppColor};
  const access=load('common/ReaderActionAccessibility.ets');
  const selectSource=read('common/ReaderSelect.ets');
  for(const [variant,method] of [['appearanceLibrary','appearanceLibraryTrigger'],['appearanceCompact','appearanceTrigger'],['settingsPhone','settingsTrigger'],['settingsTablet','settingsTrigger'],['sourceGroup','sourceGroupTrigger'],['default','defaultTrigger']]) {
   const constants=selectedProductionValues(new URL('../entry/src/main/ets/features/common/ReaderSelect.ets',import.meta.url),['TRIGGER_H','SELECT_PAD','CHEVRON_GAP','CHEVRON_W','CHEVRON_H','SELECT_CHROME'],policies);
   const {owner}=createReaderComponentProbe(selectSource,[method,'triggerHeight','isSettingsVariant'],{...policies,...access,...constants});
   let toggles=0;Object.assign(owner,{variant,value:'当前选项',isOpen:true,appThemeScheme:'day',dropdownAnimation:()=>undefined,resolvedWidth:()=>120,
    measuredValueHeight:()=>20,onToggle:()=>toggles++});
   owner[method]();const action=[...owner.nodes.values()].find(n=>n.onClick);
   assert.ok(action.height>=44,variant);assert.equal(action.accessibilityRole,'button');assert.equal(action.accessibilitySelected,true);assert.equal(action.focusable,true);action.onClick();assert.equal(toggles,1);
  }
  for(const enabled of [true,false]){
   class SwitchPort {constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}}
   const {owner}=createReaderComponentProbe(read('reading/ReaderControlTtsContent.ets'),['toggleRow','toggleLabel'],
     {...policies,...access,ReaderControlSwitchTrack:SwitchPort},{childSources:{ReaderControlSwitchTrack:read('reading/ReaderControlSwitchTrack.ets')}});
   let calls=0;Object.assign(owner,{appScheme:'day',fullInput:()=>enabled,toggleValue:()=>true,changeToggle:()=>calls++});
   owner.toggleRow('keepScreenOn');const actions=[...owner.nodes.values()].filter(n=>n.onClick);
   assert.equal(actions.length,1);const n=actions[0];assert.equal(n.height,48);assert.equal(n.accessibilityText,'朗读时屏幕常亮');assert.equal(n.accessibilitySelected,true);assert.equal(n.focusable,enabled);assert.equal(n.accessibilityRole,'button');n.onClick();assert.equal(calls,enabled?1:0);
  }
  const {owner:menu}=createReaderComponentProbe(read('common/ReaderActionMenuSurface.ets'),['actionRow','commitAction','effectiveScheme'],{...policies,...access});
  let allowed=true, mounted=true,calls=0;
  const action=()=>({id:'remove',label:'移除',accessibilityLabel:'移除本书',enabled:allowed,icon:undefined});
  Object.assign(menu,{appThemeScheme:'day',scheme:'day',foreground:true,mounted,action,menuActionHeight:()=>44,dividerWidth:()=>100,spec:()=>({actionIconSize:18,actionPadding:12,actionFontSize:14,actionLineHeight:20,actionFontWeight:400,actionFontFamily:'sans',actionTextRole:'TOK_READ_INK'}),onAction:()=>calls++});
  menu.actionRow('remove',false);const row=[...menu.nodes.values()].find(n=>n.accessibilityRole==='button');assert.ok(row);assert.equal(row.height,44);row.onClick();assert.equal(calls,1);
  allowed=false;row.onClick();assert.equal(calls,1);allowed=true;menu.mounted=false;row.onClick();assert.equal(calls,1);
 }
 if(id==='target-geometry'){
  const g=load('reading/ReaderControlPlaybackGeometry.ts');
  function disjoint(a,b){return a.x+a.width<=b.x+.01||b.x+b.width<=a.x+.01||a.y+a.height<=b.y+.01||b.y+b.height<=a.y+.01;}
  for(const width of [286,320,338,600])for(const p of [0,1]){
   const f=g.sampleReaderControlTts(p,width);const actions=[f.previous,f.toggle,f.stop,f.next];
   for(const a of actions){assert.ok(a.width>=44&&a.height>=44);assert.ok(a.x>=0&&a.x+a.width<=f.playback.width+.01);}
   for(let i=0;i<actions.length;i++)for(let j=i+1;j<actions.length;j++)assert.ok(disjoint(actions[i],actions[j]),`tts overlap ${p}/${width}`);
   assert.ok(f.quickTimerSelect.height>=44);assert.ok(f.timer.y+f.timer.height<= (p?f.config.y:f.speed.y));
   const auto=g.sampleReaderControlAutoPage(p,width);const aa=[auto.previous,auto.toggle,auto.stop,auto.next];for(const a of aa)assert.ok(a.width>=44&&a.height>=44);for(let i=0;i<aa.length;i++)for(let j=i+1;j<aa.length;j++)assert.ok(disjoint(aa[i],aa[j]),`auto overlap ${p}/${width}`);
  }
  const a=load('reading/ReaderControlAppearanceGeometry.ts');
  for(const p of [0,1]){
   const f=a.sampleReaderControlAppearance(p,338,666,8,9);
   for(const s of f.themeSwatches)assert.ok(s.width>=44&&s.height>=44);
   for(let i=0;i<f.themeSwatches.length;i++)for(let j=i+1;j<f.themeSwatches.length;j++)assert.ok(disjoint(f.themeSwatches[i],f.themeSwatches[j]));
   const fonts=Array.from({length:8},(_,i)=>a.readerControlAppearanceFontActor(f,i,i));
   for(const s of fonts)assert.ok(s.width>=44&&s.height>=44);for(let i=0;i<fonts.length;i++)for(let j=i+1;j<fonts.length;j++)assert.ok(disjoint(fonts[i],fonts[j]));
  }
 }
 if(id==='scope-coverage'){
  const audit=JSON.parse(readFileSync(new URL('./custom-action-scope.json',import.meta.url),'utf8'));
  assert.equal(audit.schemaVersion,1);assert.equal(new Set(audit.files).size,audit.files.length);
  for(const root of audit.roots)assert.ok(audit.files.includes(root));
  function checkSource(file,source){
   const tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
   assert.equal(tree.parseDiagnostics.length,0,file);
   const aliases=new Set(tree.statements.filter(ts.isImportDeclaration).flatMap(node=>
    [...(node.importClause?.namedBindings?.elements??[])].filter(entry=>(entry.propertyName?.text??entry.name.text)==='ReaderActionAccessibility').map(entry=>entry.name.text)));
   const unwrap=node=>node&&(ts.isParenthesizedExpression(node)||ts.isAsExpression(node))?unwrap(node.expression):node;
   let count=0,firstModifier;const sharedModifiers=[];
   function visit(node,method=''){
    if(ts.isMethodDeclaration(node))method=node.name.getText(tree);
    if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text==='onClick'){
     count++;let cur=node;const attrs=new Map();let clickHandlers=0;
     while(ts.isCallExpression(cur)&&ts.isPropertyAccessExpression(cur.expression)){
      const name=cur.expression.name.text;if(name==='onClick')clickHandlers++;
      attrs.set(name,cur);cur=cur.expression.expression;
     }
     assert.equal(clickHandlers,1,file+':'+method+' one callback per native action chain');
     const actor=cur.expression?.getText(tree)??'',level=unwrap(attrs.get('accessibilityLevel')?.arguments[0]);
     const modifier=unwrap(attrs.get('attributeModifier')?.arguments[0]);
     const shared=modifier&&ts.isNewExpression(modifier)&&ts.isIdentifier(modifier.expression)&&aliases.has(modifier.expression.text);
     const except=actor==='Button'||(level&&ts.isStringLiteral(level)&&level.text==='no')||
      audit.exceptions.some(entry=>{
       if(entry.file!==file||entry.method!==method||!entry.reason)return false;
       if(!entry.selector)return true;
       if(entry.selector.actor!==actor)return false;
       const calls=[],children=[];
       const descendants=(node,action)=>{action(node);ts.forEachChild(node,child=>descendants(child,action));};
       descendants(node.arguments[0],candidate=>{if(ts.isCallExpression(candidate))calls.push(candidate);});
       descendants(cur,candidate=>{if(candidate.expression?.getText(tree)===entry.selector.nativeChild)children.push(candidate);});
       return children.length>0&&calls.length===1&&ts.isPropertyAccessExpression(calls[0].expression)&&
        calls[0].expression.expression.kind===ts.SyntaxKind.ThisKeyword&&calls[0].expression.name.text===entry.selector.delegate;
      });
     assert.ok(except||attrs.has('accessibilityRole')||shared,file+':'+method+' lacks custom action semantics');
     if(shared){sharedModifiers.push({method,call:attrs.get('attributeModifier')});if(!except&&!attrs.has('accessibilityRole')&&!firstModifier)firstModifier=attrs.get('attributeModifier');}
    }
    ts.forEachChild(node,child=>visit(child,method));
   }
   visit(tree);return{count,tree,firstModifier,sharedModifiers};
  }
  let count=0;for(const file of audit.files){assert.ok(!path.isAbsolute(file)&&!file.split('/').includes('..'));count+=checkSource(file,read(file)).count;}
  assert.ok(count>0,'explicit scope contains actionable declarations');
  // Equivalent syntax around the actual modifier stays valid. Removing its
  // semantics fails on the same current native action, without a total census.
  const controlFile='common/ReaderSelect.ets',source=read(controlFile),sample=checkSource(controlFile,source),call=sample.firstModifier;
  assert.ok(call);const arg=call.arguments[0];
  const equivalent=source.slice(0,arg.getStart(sample.tree))+'('+arg.getText(sample.tree)+')'+source.slice(arg.end);
  assert.equal(checkSource(controlFile,equivalent).count,sample.count);
  const lost=source.slice(0,call.expression.expression.end)+source.slice(call.end);
  assert.throws(()=>checkSource(controlFile,lost),/lacks custom action semantics/);
  const fieldFile='common/ReaderSearchField.ets',fieldSource=read(fieldFile),field=checkSource(fieldFile,fieldSource);
  const clearModifiers=field.sharedModifiers.filter(entry=>entry.method==='fixedLineHeightField');
  assert.equal(clearModifiers.length,1,'one bookPage clear action uses shared semantics');
  const clearCall=clearModifiers[0].call;
  const clearLost=fieldSource.slice(0,clearCall.expression.expression.end)+fieldSource.slice(clearCall.end);
  assert.throws(()=>checkSource(fieldFile,clearLost),/lacks custom action semantics/,'native focus proxy exemption cannot mask missing clear semantics');
  console.log(JSON.stringify({scopeFiles:audit.files.length,currentClickableDeclarations:count,semanticParenthesis:'PASS',lostSemantics:'REJECTED',lostClearSemantics:'REJECTED',scope:'Explicit source manifest only; no current App reachability/native accessibility acceptance'}));
 }

 recordContractCasePass(id);
}
}
