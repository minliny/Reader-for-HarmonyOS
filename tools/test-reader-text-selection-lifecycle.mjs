import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes,registerHooks} from 'node:module';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
registerHooks({resolve(s,c,next){try{return next(s,c);}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return next(s+'.ts',c);throw e;}}});
const stable={configured:true,mounted:true,exitRequested:false,pageReady:true,controlVisible:false,controlObscured:false,interactionBlocked:false,pageTurnActive:false,autoPageActive:false,ttsActive:false};
async function policy() {
 const {readerTextSelectionEnabled}=await import('../entry/src/main/ets/features/reading/ReaderTextSelectionPolicy.ts');
 assert.equal(readerTextSelectionEnabled(stable),true);
 for(const key of ['exitRequested','controlVisible','controlObscured','interactionBlocked','pageTurnActive','autoPageActive','ttsActive'])assert.equal(readerTextSelectionEnabled({...stable,[key]:true}),false,key);
 for(const key of ['configured','mounted','pageReady'])assert.equal(readerTextSelectionEnabled({...stable,[key]:false}),false,key);
}
const read=name=>readFileSync(new URL('../entry/src/main/ets/features/reading/'+name,import.meta.url),'utf8');
function actualMethod(source,name,dependencies={}) {
 const start=source.indexOf('  private '+name+'('),end=source.indexOf('\n  }',start);assert.ok(start>=0&&end>start,name+' actual method');
 return new Function(...Object.keys(dependencies),stripTypeScriptTypes('class Actual {\n'+source.slice(start,end+4).replace('  private ','  ')+'\n}')+';return Actual;')(...Object.values(dependencies));
}
async function ownerAndDismissal() {
 const {readerTextSelectionEnabled}=await import('../entry/src/main/ets/features/reading/ReaderTextSelectionPolicy.ts');
 const {createReaderRapidPageTurnState,readerRapidPageTurnHasWork}=await import('../entry/src/main/ets/features/reading/ReaderRapidPageTurnState.ts');
 const {readerTtsSessionBlocksAutoPageStart}=await import('../entry/src/main/ets/features/reading/ReaderSessionCapsuleModel.ts');
 const Owner=actualMethod(read('LocalReadingExperience.ets'),'readerTextSelectionEnabled',{readerTextSelectionEnabled,readerRapidPageTurnHasWork,readerTtsSessionBlocksAutoPageStart});
 const make=()=>Object.assign(new Owner(),{readerSettingsSnapshot:{longPressSelectText:true},mounted:true,exitRequested:false,phase:'ready',controlVisible:()=>false,controlObscured:false,interactionBlocked:false,pageTurnOwnsReaderInput:()=>false,rapidPageTurnState:createReaderRapidPageTurnState(),automaticReadingState:()=>({status:'stopped'}),ttsState:{status:'stopped'}});
 assert.equal(make().readerTextSelectionEnabled(),true);
 for(const patch of [{controlVisible:()=>true},{controlObscured:true},{interactionBlocked:true},{pageTurnOwnsReaderInput:()=>true},{rapidPageTurnState:{...createReaderRapidPageTurnState(),pendingDelta:1}},{automaticReadingState:()=>({status:'playing'})},{ttsState:{status:'preparing'}},{phase:'loading'}])assert.equal(Object.assign(make(),patch).readerTextSelectionEnabled(),false,JSON.stringify(patch));
 const Fragment=actualMethod(read('ReadingSurface.ets'),'onTextSelectionEnabledChanged');let closed=0;const fragment=Object.assign(new Fragment(),{longPressSelectText:true,textController:{closeSelectionMenu(){closed++;}}});
 fragment.onTextSelectionEnabledChanged();assert.equal(closed,0);fragment.longPressSelectText=false;fragment.onTextSelectionEnabledChanged();assert.equal(closed,1,'production watcher dismisses actual controller when permission is lost');
}
async function fragmentCopy() {
 const {createReaderBuilderProbe}=await import('./lib/reader-control-builder-probe.mjs');
 const p=createReaderBuilderProbe(read('ReadingSurface.ets'),['build'],{FontWeight:{Regular:400},CopyOptions:{InApp:'in-app',None:'none'},TextAlign:{Start:'start',JUSTIFY:'justify'},TextDecorationType:{Underline:'underline'},readerRegisteredFontFamily:()=>'',readerAppearanceSnapshotFontFamily:()=>'',readerAppearanceLineHeight:()=>20,readerAppearanceUsesJustify:()=>false,readerThemeDefinition:()=>({selection:'#000000'})},{componentName:'ReaderReadingTextFragment'});
 const owner=p.owner;Object.assign(owner,{longPressSelectText:true,textController:{},appearance:{fontSize:18,letterSpacing:0},separateHighlight:false,indentPrefix:()=>'',highlightPrefix:()=>'',highlightBody:()=>'body',highlightSuffix:()=>'',usesTtsHighlight:()=>false,themeStyle:()=>({ink:'#000000'})});owner.initialRender();
 const text=[...owner.nodes.values()].find(n=>n.type==='Text');assert.ok(text);assert.equal(text.copyOption,'in-app');assert.equal(text.create?.[1]?.controller??text.create?.controller??text.controller,owner.textController,'the real Text uses the controller being dismissed');
 owner.longPressSelectText=false;owner.replay();assert.equal(text.copyOption,'none','actual SDK Text removes copy capability on the retained actor');
}
async function stageParameters() {
 const {createRequire}=await import('node:module');const {resolveEtsLoaderRoot}=await import('./lib/tool-environment.mjs');
 const req=createRequire(import.meta.url),sdk=resolveEtsLoaderRoot(),ts=req(sdk+'/node_modules/typescript'),options=req(sdk+'/lib/ets_checker.js').compilerOptions;
 function tree(source,name){const t=ts.createSourceFile(name,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);assert.equal(t.parseDiagnostics.length,0);return t;}
 function parameter(source,component,property){const t=tree(source,'SelectionActor.ets'),matches=[];const visit=n=>{if((ts.isEtsComponentExpression(n)||ts.isCallExpression(n))&&n.expression.getText(t)===component){const props=n.arguments[0];assert.ok(ts.isObjectLiteralExpression(props));const p=props.properties.find(p=>p.name?.getText(t)===property);matches.push(p?.initializer.getText(t));}ts.forEachChild(n,visit);};visit(t);assert.equal(matches.length,1,component+' actual call');return matches[0];}
 const experience=read('LocalReadingExperience.ets');
 for(const [component,property]of [['ReaderPageTurnStage','longPressSelectText'],['ReaderContinuousReadingStage','longPressSelectText'],['ReaderPageInteractionLayer','allowTextSelection']]){
  const expression=parameter(experience,component,property);assert.ok(expression,component+' selection input');const value=new Function('return ('+expression+');');
  for(const expected of [false,true])assert.equal(value.call({readerTextSelectionEnabled:()=>expected}),expected,component+' uses current policy result');
 }
 const texture=read('BookTurnTextureBuilder.ets'),override=parameter(texture,'ReadingSurface','longPressSelectText');
 const surface=tree(read('ReadingSurface.ets'),'ReadingSurface.ets').statements.find(n=>n.name?.text==='ReadingSurface');
 const defaultValue=surface.members.find(n=>n.name?.getText()==='longPressSelectText')?.initializer?.getText();assert.equal(defaultValue,'false');
 assert.equal(new Function('return ('+(override??defaultValue)+');')(),false,'actual offscreen Builder + actual surface default must reject selection');
}
const cases={'stage-parameters':stageParameters,policy,'owner-dismissal':ownerAndDismissal,'fragment-copy':fragmentCopy};
for(const id of selectContractCases({'stage-parameters':'Actual SDK AST-selected stage argument evaluation and offscreen default',policy:'Pure selection admission matrix','owner-dismissal':'Actual LRE owner input and actual fragment controller dismissal','fragment-copy':'Actual SDK Text copy capability changes on a retained actor'})){await cases[id]();recordContractCasePass(id);}
