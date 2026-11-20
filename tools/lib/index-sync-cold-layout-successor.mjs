import { installedEtsCompiler } from './ets-compiler-runtime.mjs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {auditNativeTextElements} from './reader-typography-consumer-audit.mjs';

export const indexSyncColdLayoutSuccessorPath='tools/fixtures/index-sync-cold-page-layout-successor-20261014.json';
const {ts,options}=installedEtsCompiler();
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** One original AUTO text state moves to a named Builder and a real shared
 * frame. The old policy remains unchanged; only its private paper paint is
 * replaced by the common window-paper variant (including its night color). */
export function verifyIndexSyncColdLayoutSuccession(baseline,readSource,parseCurrent){
 const w=JSON.parse(readSource(indexSyncColdLayoutSuccessorPath));assert.equal(w.schema,1);
 assert.deepEqual([w.page,w.previousMethod,w.currentMethod,w.host,w.variant,w.slot],
  ['entry/src/main/ets/pages/Index.ets','build','syncPreparingContent','ReaderPageScaffold','standard','content']);
 assert.equal(w.previousSourceHead,'838078322bb267c95e11757ccce8a242678be44a');
 assert.equal(w.previousSourceSha256,'1188b0d70577c69db47034a89b149fff12ac0e8398e8206834de306702651191');
 assert.equal(w.previousNativeSha256,'0f01c49163e90235533e52da318276e9925eb0f10e09f6525ffce140080cc092');
 assert.equal(digest(w.previousNative),w.previousNativeSha256,'original Index cold AUTO text witness');
 assert.equal(w.previousNativeCount,1);assert.deepEqual(w.previousColumnAttributes,{width:"'100%'",height:"'100%'",justifyContent:'FlexAlign.Center'});
 assert.equal(digest(w.previousArchitecturePolicy),w.previousArchitecturePolicySha256);
 assert.deepEqual(w.previousArchitecturePolicy.counts,{backgroundColor:4,CustomDialogController:2,showAlertDialog:4});
 assert.deepEqual(baseline.uiPolicies.find(p=>p.file===w.page),w.previousArchitecturePolicy,'cold-page transfer grants no new Index private budget');
 const source=readSource(w.page),tree=parseCurrent?parseCurrent(source,w.page):ts.createSourceFile(w.page,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);assert.deepEqual(tree.parseDiagnostics,[]);
 assert.equal(tree.fileName,w.page,'shared cold Index AST path matches current source');
 assert.equal(tree.text,source,'shared cold Index AST bytes match current source');
 const owner=tree.statements.find(n=>ts.isStructDeclaration(n)&&n.name.text==='Index');assert.ok(owner);
 const member=name=>owner.members.find(m=>m.name?.getText(tree)===name);
 const collect=(node,predicate)=>{const found=[];const walk=n=>{if(predicate(n))found.push(n);ts.forEachChild(n,walk);};walk(node);return found;};
 const calls=(node,name)=>collect(node,n=>(ts.isCallExpression(n)||ts.isEtsComponentExpression(n))&&n.expression.getText(tree)===name);
 const native=auditNativeTextElements(source,w.page,tree).filter(n=>n.kind==='Text'&&n.text===w.previousNative.text);assert.equal(native.length,1,'one retained cold-state native text');
 const coldMethod=native[0].method,body=member(coldMethod);assert.ok(body,'cold native actor has one actual owner');
 assert.deepEqual({kind:native[0].kind,text:native[0].text,modifiers:native[0].modifiers,attributes:native[0].attributes},w.previousNative,'all original native typography/AUTO effects remain');
 // Discover the actual delegated content. Private Builder names, containing
 // route method and equivalent readiness expressions are not the contract.
 const frames=collect(owner,n=>(ts.isCallExpression(n)||ts.isEtsComponentExpression(n))&&n.expression.getText(tree)===w.host)
  .filter(n=>n.arguments[0]&&calls(n.arguments[0],'this.'+coldMethod).length===1);
 assert.equal(frames.length,1,'the one cold actor has one shared frame owner');
 const frame=frames[0],props=new Map(frame.arguments[0].properties.map(p=>[p.name.getText(tree),p.initializer]));
 assert.ok(props.has('frameStyle')&&props.has('geometry'),'shared frame receives explicit feature visual and geometry facts');
 const branches=collect(owner,n=>ts.isIfStatement(n)&&n.elseStatement&&collect(n.elseStatement,c=>c===frame).length===1);
 const branch=branches.at(-1);assert.ok(branch,'cold content is the unready alternative; SDK execution checks the actual readiness facts');
 assert.equal(calls(branch.elseStatement,'Column').length,0,'the cold route has no parallel private frame');
 assert.equal(calls(body,'Column').length,1);
 const attributes=Object.fromEntries(collect(body,n=>ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&['width','height','justifyContent','backgroundColor'].includes(n.expression.name.text)).map(n=>[n.expression.name.text,n.arguments[0].getText(tree)]));
 assert.deepEqual(attributes,w.previousColumnAttributes,'cold state retains centered native geometry and relinquishes private paper paint');
 assert.equal(w.currentBackgroundOwner,'ReaderPageFrameModifier');assert.equal(w.sdkProof,'tools/test-reader-page-header-contract.mjs');assert.ok(readSource(w.sdkProof).length>0);
 let route=branch.parent;while(route&&!ts.isMethodDeclaration(route))route=route.parent;assert.ok(route);
 return{nativeActors:1,privateBackgroundRemoved:1,coldContentMethod:coldMethod,routeMethod:route.name.getText(tree)};
}
