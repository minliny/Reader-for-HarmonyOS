import { installedEtsCompiler } from './ets-compiler-runtime.mjs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createDefaultReaderWindowMetrics,readerVisualSafeTop,readerContentSafeTop} from '../../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';

export const fullDirectoryLayoutSuccessorPath='tools/fixtures/reader-full-directory-page-layout-successor-20261014.json';
const { ts, options } = installedEtsCompiler();
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** A single actual page moves its frame/slots to the shared owner. The old
 * 100-row budget and approved physical typography remain immutable; this
 * transfer removes only the old outer clip, now owned by the common frame. */
export function verifyFullDirectoryLayoutSuccession(baseline,readSource,shape,parseCurrent){
 const parse=(source,file)=>parseCurrent?parseCurrent(source,file):ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
 const witness=JSON.parse(readSource(fullDirectoryLayoutSuccessorPath));
 assert.equal(witness.schema,1);
 assert.equal(witness.previousSourceHead,'838078322bb267c95e11757ccce8a242678be44a');
 assert.equal(witness.previousSourceSha256,'a8c8d44475062ff8ffbf334604aaca6656912f53d20ff9d19fbd0b792c404adc');
 assert.deepEqual([witness.page,witness.previousBodyMethod,witness.currentBodyMethod,witness.host],
  ['entry/src/main/ets/features/reading/ReaderFullDirectory.ets','build','directoryContent','ReaderPageScaffold']);
 assert.equal(witness.variantExpression,"this.catalogContext === 'detail' ? 'directory' : 'readerDirectory'");
 assert.deepEqual(witness.slots,{header:'topBar',content:'directoryContent',overlayContent:'offlineBookMenu'});
 assert.deepEqual(witness.safeTopOwnership,{method:'topBarTop',detail:{owner:'Index parent',ownGap:18},reader:{owner:'ReaderFullDirectory window',minimumTop:18}});
 assert.equal(witness.legacyBudgetWitness.file,'tools/fixtures/architecture-legacy-business-budgets-20261005.json');
 const original=JSON.parse(readSource(witness.legacyBudgetWitness.file)).rows.find(row=>row.file===witness.page);
 assert.equal(digest(original),witness.legacyBudgetWitness.rowSha256,'original full-directory private budget witness unchanged');
 assert.deepEqual(witness.legacyBudgetWitness.counts,{fontSize:5,backgroundColor:2});
 assert.deepEqual(baseline.rows.find(row=>row.file===witness.page),original,'full-directory layout transfer grants no private budget exemption');
 assert.equal(witness.previousTypographyWitness.file,'tools/fixtures/design/approved-manga-typography-carriers-20261005.json');
 const typography=JSON.parse(readSource(witness.previousTypographyWitness.file)).files.find(row=>row.path===witness.page);
 assert.equal(digest(typography),witness.previousTypographyWitness.rowSha256,'all previous full-directory font tuples/AUTO omissions remain witnessed');
 assert.deepEqual([typography.carriers.length,typography.nativeDefaults.length],[witness.previousTypographyWitness.carriers,witness.previousTypographyWitness.nativeDefaults]);
 assert.equal(witness.previousStylesSha256,'a48dfa0b9557a3ddde2169c954960bfecc412aef3cda628be949990162abaaa4');
 assert.equal(digest(witness.previousStyles),witness.previousStylesSha256,'exact previous private frame/card/menu physical inputs');
 assert.equal(witness.removedRootStyleIndex,0,'only the former outer frame clip is transferred');
 assert.deepEqual(witness.previousStyles[witness.removedRootStyleIndex],{owner:'ReaderFullDirectory',method:'build',property:'clip',args:['true']});
 const source=readSource(witness.page),tree=parse(source,witness.page);
 assert.equal(tree.fileName,witness.page,'shared directory AST path matches current source');
 assert.equal(tree.text,source,'shared directory AST bytes match current source');
 assert.deepEqual(tree.parseDiagnostics,[]);const owner=tree.statements.find(n=>ts.isStructDeclaration(n)&&n.name.text==='ReaderFullDirectory');assert.ok(owner);
 const member=name=>{const value=owner.members.find(n=>n.name?.getText(tree)===name);assert.ok(value,name);return value;};
 const calls=(node,name)=>{const found=[];const walk=n=>{if((ts.isCallExpression(n)||ts.isEtsComponentExpression(n))&&n.expression.getText(tree)===name)found.push(n);ts.forEachChild(n,walk);};walk(node);return found;};
 const build=member('build'),hosts=calls(build,witness.host);assert.equal(hosts.length,1,'one actual full-directory shared frame');
 assert.equal(calls(build,'Stack').length,0,'the page no longer owns a parallel outer native frame');
 const props=new Map(hosts[0].arguments[0].properties.map(p=>[p.name.getText(tree),p.initializer]));
 assert.equal(props.get('variant')?.getText(tree),witness.variantExpression,'exact detail/reader surface context');
 assert.equal(props.get('headerKind')?.getText(tree),"'floating'",'the retained card remains the bounded floating header');
 assert.equal(props.get('headerMeasurementKey')?.getText(tree),'this.topBarTop()','the actual live geometry fact keys native header measurements');
 for(const[slot,builder]of Object.entries(witness.slots))assert.equal(calls(props.get(slot),'this.'+builder).length,1,'actual full-directory shared '+slot+' delegation');
 const context=member('catalogContext');assert.ok(ts.getAllDecorators(context).some(d=>d.getText(tree)==='@Prop'),'context is an actual reactive parent fact');
 assert.equal(context.type.getText(tree),"'detail' | 'reader'");assert.equal(context.initializer.getText(tree),"'reader'",'reader-context default retains existing embedded semantics');
 // Execute the actual small production methods through the installed SDK.
 // The 18vp design gap is independent of the window safe-top value. Index
 // already consumes that value for detail catalogs; reader controls own it.
 const indexFile='entry/src/main/ets/pages/Index.ets',indexSource=readSource(indexFile),indexTree=parse(indexSource,indexFile);
 assert.equal(indexTree.fileName,indexFile,'shared Index AST path matches current source');
 assert.equal(indexTree.text,indexSource,'shared Index AST bytes match current source');
 assert.deepEqual(indexTree.parseDiagnostics,[]);const indexOwner=indexTree.statements.find(n=>ts.isStructDeclaration(n)&&n.name.text==='Index');assert.ok(indexOwner);
 const indexMember=name=>{const method=indexOwner.members.find(n=>n.name?.getText(indexTree)===name);assert.ok(method,name);return method;};
 const metrics=createDefaultReaderWindowMetrics(),deps={ReaderWindowCoordinator:{metrics:()=>metrics},readerVisualSafeTop,readerContentSafeTop};
 const actual=(methods,file)=>{
  const emitted=ts.transpileModule('class DirectoryInsetProbe {'+methods.map(method=>method.getText(file).replace(/^private\s+/, '')).join('\n')+'}',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
  return new (new Function(...Object.keys(deps),emitted+';return DirectoryInsetProbe;')(...Object.values(deps)))();
 };
 const pageInset=actual([member('topBarTop')],tree),parentInset=actual([indexMember('readerOwnsWindowEdges'),indexMember('appContentTopInset')],indexTree);
 let revision=0,revisionReads=0;Object.defineProperty(pageInset,'readerWindowMetricsRevision',{get:()=>{revisionReads++;return revision;}});
 Object.assign(parentInset,{route:'directory',detailBook:{contentKind:'text'},readingSessionActive:true,mangaSourceSwitchSelectionVisible:false,readerWindowMetricsRevision:0});
 for(const top of[0,39,61]){
  metrics.systemInsets.top=top;
  for(const[context,target,expectedParent,expectedOwn]of[['detail','detail',top,18],['reader','readerControl',0,Math.max(18,top)]]){
   pageInset.catalogContext=context;parentInset.directoryReturnTarget=target;revisionReads=0;
   const own=pageInset.topBarTop(),parent=parentInset.readerOwnsWindowEdges()?0:parentInset.appContentTopInset();
   assert.ok(revisionReads>0,'actual window revision dependency is retained in both catalog contexts');
   assert.equal(parent,expectedParent,'actual Index parent safe-top ownership for '+context);
   assert.equal(own,expectedOwn,'context-specific catalog safe-top ownership for '+context);
   assert.equal(parent+own,expectedParent+expectedOwn,'the physical top includes one system inset and the bounded design gap');
  }
 }
 revision=-1;assert.equal(pageInset.topBarTop(),18,'existing unbound-metrics fallback remains the design gap');
 const body=member('directoryContent'),panels=calls(body,'FullDirectoryPanel');assert.equal(panels.length,1,'same original full directory panel actor');
 const panelProps=new Map(panels[0].arguments[0].properties.map(p=>[p.name.getText(tree),p.initializer.getText(tree)]));
 assert.equal(panelProps.get('allowUnanchoredBrowse'),"this.catalogContext === 'detail'",'only the standalone detail context admits unknown-anchor browsing');
 for(const builder of['topBar','offlineBookMenu'])assert.equal(calls(body,'this.'+builder).length,0,'one physical actor per shared slot');
 const expected=witness.previousStyles.filter((_,index)=>index!==witness.removedRootStyleIndex).map(style=>({...style,method:style.method==='build'?'directoryContent':style.method}));
 assert.deepEqual(shape(source,witness.page).styles,expected,'full-directory succession retains every original card, body, menu, font and motion physical input');
 assert.equal(witness.sdkProof,'tools/test-reader-page-header-contract.mjs');assert.ok(readSource(witness.sdkProof).length>0);
 return{privateBudget:{fontSize:5,backgroundColor:2},retainedPhysicalInputs:expected.length};
}
