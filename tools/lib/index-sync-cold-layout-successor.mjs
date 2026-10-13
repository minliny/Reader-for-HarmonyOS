import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {auditNativeTextElements} from './reader-typography-consumer-audit.mjs';

export const indexSyncColdLayoutSuccessorPath='tools/fixtures/index-sync-cold-page-layout-successor-20261014.json';
const sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const require=createRequire(import.meta.url),ts=require(sdk+'/node_modules/typescript'),options=require(sdk+'/lib/ets_checker.js').compilerOptions;
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** One original AUTO text state moves to a named Builder and a real shared
 * frame. The old policy remains unchanged; only its private paper paint is
 * replaced by the common window-paper variant (including its night color). */
export function verifyIndexSyncColdLayoutSuccession(baseline,readSource){
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
 const source=readSource(w.page),tree=ts.createSourceFile(w.page,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);assert.deepEqual(tree.parseDiagnostics,[]);
 const owner=tree.statements.find(n=>ts.isStructDeclaration(n)&&n.name.text==='Index');assert.ok(owner);
 const member=name=>owner.members.find(m=>m.name?.getText(tree)===name),build=member('build'),body=member(w.currentMethod);assert.ok(build&&body);
 const collect=(node,predicate)=>{const found=[];const walk=n=>{if(predicate(n))found.push(n);ts.forEachChild(n,walk);};walk(node);return found;};
 const calls=(node,name)=>collect(node,n=>(ts.isCallExpression(n)||ts.isEtsComponentExpression(n))&&n.expression.getText(tree)===name);
 const snapshots=collect(build,n=>ts.isIfStatement(n)&&n.expression.getText(tree)==='this.syncSnapshotReady');assert.equal(snapshots.length,1);
 const hosts=calls(snapshots[0].elseStatement,w.host);assert.equal(hosts.length,1,'actual unready-sync branch delegates the one shared frame');
 const props=new Map(hosts[0].arguments[0].properties.map(p=>[p.name.getText(tree),p.initializer]));
 assert.equal(props.get('variant')?.getText(tree),"'standard'");assert.equal(calls(props.get('content'),'this.'+w.currentMethod).length,1,'actual cold content slot invokes the original AUTO actor successor');
 assert.equal(calls(snapshots[0].elseStatement,'Column').length,0,'the cold route has no parallel private frame');
 const native=auditNativeTextElements(source,w.page).filter(n=>n.kind==='Text'&&n.text===w.previousNative.text);assert.equal(native.length,1,'one retained cold-state native text');
 assert.equal(native[0].method,w.currentMethod);assert.deepEqual({kind:native[0].kind,text:native[0].text,modifiers:native[0].modifiers,attributes:native[0].attributes},w.previousNative,'all original native typography/AUTO effects remain');
 assert.equal(calls(body,'Column').length,1);
 const attributes=Object.fromEntries(collect(body,n=>ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&['width','height','justifyContent','backgroundColor'].includes(n.expression.name.text)).map(n=>[n.expression.name.text,n.arguments[0].getText(tree)]));
 assert.deepEqual(attributes,w.previousColumnAttributes,'cold state retains centered native geometry and relinquishes private paper paint');
 assert.equal(w.currentBackgroundOwner,'ReaderPageFrameModifier');assert.equal(w.sdkProof,'tools/test-reader-page-header-contract.mjs');assert.ok(readSource(w.sdkProof).length>0);
 return{nativeActors:1,privateBackgroundRemoved:1};
}
