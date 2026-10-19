import { resolveEtsLoaderRoot, virtualFilePath } from './tool-environment.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { isSharedTypographyExpression, typographyExpressionContext } from './reader-typography-consumer-audit.mjs';
import { novelSourceSwitchSuccessorPath, sharedSourceSwitchTypographySuccessorPath,
 validateSharedSourceSwitchTypographySuccessor, unifiedActionSheetTypographySuccessorPath,
 validateUnifiedActionSheetTypographySuccessor, mangaDirectoryWorktreeSuccessorPath,
 validateMangaDirectoryWorktreeSuccessor, approvedTypographyContract, sourceSwitchFrameSuccessorPath,
 validateSourceSwitchFrameSuccessor } from './approved-manga-typography-carriers.mjs';

import {fullDirectoryLayoutSuccessorPath,verifyFullDirectoryLayoutSuccession} from './reader-full-directory-layout-successor.mjs';
import {indexSyncColdLayoutSuccessorPath,verifyIndexSyncColdLayoutSuccession} from './index-sync-cold-layout-successor.mjs';
const sdk=resolveEtsLoaderRoot();
const ts=createRequire(import.meta.url)(sdk+'/node_modules/typescript'),options=createRequire(import.meta.url)(sdk+'/lib/ets_checker.js').compilerOptions;
const physical=new Set(['fontFamily','fontWeight','fontSize','lineHeight','letterSpacing','fontColor','colorFilter','backgroundColor','borderRadius','border','shadow','linearGradient','padding','margin','width','height','constraintSize','opacity','clip','responseRegion']);
const callerPhysical=new Set([...physical,'minFontScale','maxFontScale']);
const appearance=new Set(['fontFamily','fontWeight','fontSize','lineHeight','letterSpacing','fontColor','backgroundColor','borderRadius','border','shadow','linearGradient','padding','margin','minFontScale','maxFontScale']);
const print=(node,file)=>ts.createPrinter().printNode(ts.EmitHint.Unspecified,node,file);
const artifactCaches=Object.fromEntries(['shape','argument','edge'].map(kind=>[kind,{values:new Map(),hits:0,misses:0}]));
const registrationParses={parses:0,hits:0};
export const architectureRegistrationParseStats=()=>({...registrationParses});
export const architectureProducerCacheStats=()=>Object.fromEntries(Object.entries(artifactCaches)
 .map(([kind,cache])=>[kind,{hits:cache.hits,misses:cache.misses,entries:cache.values.size}]));
function freezeArtifact(value){
 if(value!==null&&typeof value==='object'){for(const child of Object.values(value))freezeArtifact(child);Object.freeze(value);}
 return value;
}
/** Only successful official-parser products are shared. Every registration
 * assertion still runs against the current inventory, baseline and source.
 * Include complete bytes/options so same-count mutants cannot borrow a hit;
 * return fresh data so a caller cannot contaminate another negative control. */
function cachedArtifact(kind,source,file,context,produce){
 const cache=artifactCaches[kind],key=JSON.stringify([sdk,ts.version,options,file,source,context]);
 if(cache.values.has(key)){cache.hits++;return structuredClone(cache.values.get(key));}
 cache.misses++;
 const value=produce();
 if(cache.values.size>=256)cache.values.delete(cache.values.keys().next().value);
 cache.values.set(key,freezeArtifact(value));
 return structuredClone(value);
}
export function sharedProducerShape(source,file){
 return cachedArtifact('shape',source,file,[ts.ScriptTarget.Latest,ts.ScriptKind.ETS],()=>{
 const tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);assert.equal(tree.parseDiagnostics.length,0,file+' SDK AST');
 const types=[],declarations=[],styles=[];
 for(const node of tree.statements){
  if(ts.isTypeAliasDeclaration(node))types.push({name:node.name.text,type:print(node.type,tree)});
  if(ts.isStructDeclaration(node)||ts.isClassDeclaration(node))declarations.push({name:node.name.text,
    publicFields:node.members.filter(n=>ts.isPropertyDeclaration(n)&&!n.modifiers?.some(m=>m.kind===ts.SyntaxKind.PrivateKeyword)).map(n=>({name:n.name.getText(tree),type:n.type?print(n.type,tree):'',decorators:ts.getAllDecorators(n).map(d=>print(d,tree))}))});
 }
 const boundedHeaderScale=file==='entry/src/main/ets/features/common/ReaderBoundedSurfaceHeader.ets';
 const walk=node=>{if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&(physical.has(node.expression.name.text)||
    boundedHeaderScale&&['minFontScale','maxFontScale'].includes(node.expression.name.text))){
  let method=node.parent;while(method&&!ts.isMethodDeclaration(method))method=method.parent;
  let owner=node.parent;while(owner&&!ts.isStructDeclaration(owner)&&!ts.isClassDeclaration(owner))owner=owner.parent;
  styles.push({owner:owner?.name.text??'@module',method:method?.name.getText(tree)??'@module',property:node.expression.name.text,args:node.arguments.map(n=>print(n,tree))});
 }ts.forEachChild(node,walk);};walk(tree);
 // Keep alias resolution and AUTO branch ownership verifiable too. Counting
 // type.fontSizeFp alone cannot prove that `type` still selects public roles.
 const implementation=ts.createPrinter({removeComments:true}).printFile(tree);
 return{types,declarations,styles,implementation};
 });
}
const fontProperties=new Set(['fontFamily','fontWeight','fontSize','lineHeight','letterSpacing']);
const argumentKey=(method,property,expression)=>JSON.stringify([method,property,expression]);
function canonicalArgument(expression,file){
 const source='const value = '+expression+';',parsePath=virtualFilePath('SharedTypographyArgument.ts');
 return cachedArtifact('argument',source,file,[parsePath,ts.ScriptTarget.Latest,ts.ScriptKind.TS],()=>{
 const tree=ts.createSourceFile(parsePath,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 assert.equal(tree.parseDiagnostics.length,0,'actual producer Typography argument');
 return print(tree.statements[0].declarationList.declarations[0].initializer,tree);
 });
}
/** Aliases are accepted only inside a registered, exact finite producer.
 * Neither a local name `type` nor a common-directory location is a contract. */
export function registeredProducerTypographySlots(source,file,contract){
 const producer=contract.producers.find(p=>p.file===file);
 if(!producer)return{has:()=>false,size:0};
 const shape=sharedProducerShape(source,file);
 const expected=reviewedBookshelfActionShape(file,producer.shape);
 const finite=({implementation,...contract})=>contract;
 assert.deepEqual(finite(shape),finite(expected),'finite shared physical inputs/role bindings changed: '+file);
 const context=typographyExpressionContext(source,file);
 const tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
 // The Choice modifier's local text alias must come from its actual imported
 // finite resolver. A matching `text.fontSizeFp` spelling alone is not proof.
 let choiceAlias=false;
 if(file.endsWith('/ReaderChoiceRow.ets')){
  const imports=tree.statements.filter(ts.isImportDeclaration);
  const imported=imports.some(node=>node.moduleSpecifier.text==='./ReaderChoiceSpecs'&&
   node.importClause?.namedBindings?.elements?.some(element=>element.name.text==='resolveReaderChoiceSpec'&&(element.propertyName?.text??element.name.text)==='resolveReaderChoiceSpec'));
  const modifier=tree.statements.find(node=>node.name?.text==='ReaderChoiceLabelModifier');
  const method=modifier?.members.find(node=>node.name?.text==='applyNormalAttribute');
  const values=new Map(method?.body?.statements.filter(ts.isVariableStatement).flatMap(statement=>[...statement.declarationList.declarations]).map(node=>[node.name.getText(tree),node.initializer])??[]);
  const spec=values.get('spec'),text=values.get('text');
  choiceAlias=imported&&context.bindings.has('ReaderChoiceRow#spec')&&
   ts.isCallExpression(spec)&&spec.expression.getText(tree)==='resolveReaderChoiceSpec'&&spec.arguments.length===1&&spec.arguments[0].getText(tree)==='this.id'&&
   ts.isConditionalExpression(text)&&text.condition.getText(tree)==='this.selected'&&text.whenTrue.getText(tree)==='spec.selectedText'&&text.whenFalse.getText(tree)==='spec.text';
 }
 const slots=new Set(shape.styles.filter(s=>fontProperties.has(s.property)&&s.args.length)
   .filter(s=>s.args[0].startsWith('this.')?isSharedTypographyExpression(s.args[0],context,s.owner):
    s.owner==='ReaderChoiceLabelModifier'?choiceAlias:true)
   .map(s=>argumentKey(s.method,s.property,s.args[0])));
 return{size:slots.size,has:(method,property,expression)=>slots.has(argumentKey(method,property,canonicalArgument(expression,file)))};
}
const relative=file=>file.replace(/^entry\/src\/main\/ets\//,'');
export const architectureMessageSuccessorPath='tools/fixtures/architecture-message-producers-successor-20261019.json';
export const architectureBookshelfActionSuccessorPath='tools/fixtures/architecture-bookshelf-action-successor-20261019.json';
const bookshelfFiles=['ReaderSurfaceSpecs','ReaderBoundedSurface','ReaderBoundedSurfaceHeader','ReaderSheetActionList','ReaderActionMenuSurface']
 .map(name=>'entry/src/main/ets/features/common/'+name+'.ets');
const architectureDigest=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const readArchitectureSource=file=>readFileSync(new URL('../../'+file,import.meta.url),'utf8');
function bookshelfActionSuccessor(readSource){
 const bytes=readSource(architectureBookshelfActionSuccessorPath),successor=JSON.parse(bytes);
 assert.equal(architectureDigest(bytes),'df6480f457ead8d7c46248ffb021757227d5b2be761f173e2575223f432ffbe7','exact reviewed bookshelf action architecture successor');
 assert.deepEqual([successor.schema,successor.authority],[1,'docs/message-ui/bookshelf-action-style-scope-20261019.json']);
 assert.equal(architectureDigest(readSource(successor.authority)),successor.authoritySha256,'exact current user-requested bookshelf action scope');
 assert.deepEqual(successor.previousSuccessor,{file:architectureMessageSuccessorPath,sha256:'6847a4a3e94cd95bde59da3fffe745f06a79c689f27eb6d2f5ad3b0a39f0cc61'});
 assert.equal(architectureDigest(readSource(successor.previousSuccessor.file)),successor.previousSuccessor.sha256,'previous message successor remains immutable');
 assert.deepEqual(successor.shapes.map(row=>row.file),bookshelfFiles,'only five finite bookshelf shared actors change');
 assert.deepEqual(successor.consumerUpdates.map(row=>row.component),['ReaderActionSheetContent']);
 assert.deepEqual(successor.budgetUpdates,[{file:'entry/src/main/ets/features/common/ReaderActionMenuSurface.ets',kind:'backgroundColor',previous:6,current:7}]);
 return successor;
}
/** A current request may replace only its recorded finite predecessor. This
 * resolver is also used by typography/native-default audits of the raw fixture. */
export function reviewedBookshelfActionShape(file,previousShape,readSource=readArchitectureSource){
 if(!bookshelfFiles.includes(file))return previousShape;
 const update=bookshelfActionSuccessor(readSource).shapes.find(row=>row.file===file);
 const hash=architectureDigest(previousShape);
 assert.ok(hash===update.previousShapeSha256||hash===architectureDigest(update.shape),'exact bookshelf shared shape predecessor: '+file);
 return update.shape;
}
function bookshelfActionArchitectureSuccession(contract,readSource){
 const successor=bookshelfActionSuccessor(readSource),effective=structuredClone(contract);
 for(const producer of effective.producers){
  producer.shape=reviewedBookshelfActionShape(producer.file,producer.shape,readSource);
  for(const child of [...(producer.specSources??[]),...(producer.delegates??[])])child.shape=reviewedBookshelfActionShape(child.file,child.shape,readSource);
 }
 for(const slot of effective.retainedConsumerSlots??[])for(const child of slot.components)child.shape=reviewedBookshelfActionShape(child.file,child.shape,readSource);
 for(const update of successor.consumerUpdates){
  const producer=effective.producers.find(row=>row.component===update.component);assert.ok(producer);
  assert.deepEqual(producer.consumers,update.previousConsumers,'exact bookshelf action consumer predecessor');
  const expected=structuredClone(update.previousConsumers);
  assert.equal(expected[0].file,'features/common/ReaderSheetActionList.ets');assert.equal(expected[0].specId,"'quick'");
  expected[0].specId="'bookshelf'";
  assert.deepEqual(update.consumers,expected,'only the existing bookshelf action consumer changes variant');
  producer.consumers=update.consumers;
  for(const owner of effective.producers)for(const delegate of owner.delegates??[]){
   if(delegate.component!==update.component)continue;
   const previous=update.previousConsumers.filter(row=>row.file===relative(owner.file));
   if(!previous.length)continue;
   assert.deepEqual(delegate.consumers,previous,'exact bookshelf action delegate predecessor');
   delegate.consumers=update.consumers.filter(row=>row.file===relative(owner.file));
  }
 }
 return{contract:effective,budgetUpdates:successor.budgetUpdates};
}
/** Explicit approved message succession. Original producer, legacy-budget and
 * historical visual fixtures remain unchanged; only these finite current
 * edges/spec/renderer witnesses are layered on top for verification. */
function messageArchitectureSuccession(contract,readSource){
 const bytes=readSource(architectureMessageSuccessorPath),successor=JSON.parse(bytes);
 const digest=value=>createHash('sha256').update(value).digest('hex');
 assert.equal(digest(bytes),'6847a4a3e94cd95bde59da3fffe745f06a79c689f27eb6d2f5ad3b0a39f0cc61','exact reviewed message architecture successor');
 assert.deepEqual([successor.schema,successor.authority,successor.previousContract.file],
  [1,'docs/message-ui/approved-scope-20261019.json','tools/fixtures/architecture-shared-producers.json']);
 assert.equal(digest(readSource(successor.authority)),successor.authoritySha256,'message architecture binds the exact user-approved scope');
 assert.equal(digest(readSource(successor.previousContract.file)),successor.previousContract.sha256,'immutable original producer fixture retained');
 assert.deepEqual(successor.producerConsumerUpdates.map(row=>row.component),
  ['ReaderBoundedSurface','ReaderBoundedSurfaceHeader','ReaderBoundedSurfaceActions','ReaderFixedHeaderHost','ReaderStandardPage']);
 assert.deepEqual(successor.specSources.map(row=>row.file),['entry/src/main/ets/features/common/ReaderSurfaceSpecs.ets']);
 assert.deepEqual(successor.sharedRenderers.map(row=>row.component),['ReaderRecoveryAction','ReaderRecoveryNotice']);
 assert.deepEqual(successor.newProducers.map(row=>row.component),['ReaderPageState'],'only one approved new content-state producer');
 const effective=structuredClone(contract);
 for(const update of successor.producerConsumerUpdates){
  const producer=effective.producers.find(row=>row.component===update.component);assert.ok(producer);
  assert.deepEqual(producer.consumers,update.previousConsumers,'message predecessor producer/consumer/spec edges changed');
  producer.consumers=update.consumers;
 }
 const renderer=file=>successor.sharedRenderers.find(row=>row.file===file);
 for(const producer of effective.producers){
  for(const spec of producer.specSources??[]){const current=successor.specSources.find(row=>row.file===spec.file);if(current)spec.shape=current.shape;}
  for(const delegate of producer.delegates??[]){const current=renderer(delegate.file);if(current)delegate.shape=current.shape;}
 }
 for(const slot of effective.retainedConsumerSlots??[])for(const child of slot.components){const current=renderer(child.file);if(current)child.shape=current.shape;}
 effective.producers.push(...successor.newProducers);
 assert.deepEqual(successor.budgetUpdates,[
  {file:'entry/src/main/ets/features/common/ReaderRecoveryNotice.ets',kind:'backgroundColor',previous:0,current:1},
  {file:'entry/src/main/ets/features/settings/SettingsPage.ets',kind:'showAlertDialog',previous:1,current:2},
 ],'only the approved notice background and cache native confirmation have finite count successions');
 return{contract:effective,owners:successor.newSharedOwners,completion:successor.completion,budgetUpdates:successor.budgetUpdates};
}
function edge(element,row){
 const source='const props = '+(element.args[0]??'{}')+';',parsePath=virtualFilePath('SharedConsumer.ts');
 return cachedArtifact('edge',source,row.file,[parsePath,ts.ScriptTarget.Latest,ts.ScriptKind.TS,element.method,element.kind,element.line],()=>{
 const tree=ts.createSourceFile(parsePath,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 const obj=tree.statements[0]?.declarationList?.declarations[0]?.initializer;
 assert.ok(ts.isObjectLiteralExpression(obj),'actual shared props object: '+row.file+':'+element.line);
 const keys=obj.properties.map(p=>p.name?.getText(tree)??'spread');
 // The action-content producer uses an explicit finite variant, while every
 // retained surface keeps its existing specId edge. This is not a generic
 // style-bag or helper-name admission.
 const selector=element.kind==='ReaderActionSheetContent'?'variant':'specId';
 const spec=obj.properties.find(p=>p.name?.getText(tree)===selector);
 const base={file:row.file,method:element.method,component:element.kind,specId:spec?.initializer?print(spec.initializer,tree):null,keys};
 if(element.kind==='ReaderActionMenuSurface'){
  const variant=obj.properties.find(p=>p.name?.getText(tree)==='variant');
  return{...base,variant:variant?.initializer?print(variant.initializer,tree):null};
 }
 return base;
 });
}
export function producerConsumerEdges(inventory,name){return inventory.rows.flatMap(row=>row.elements.filter(e=>e.kind===name&&e.customTarget?.endsWith('#'+name+'#build')).map(e=>edge(e,row)));}
/** Exact inputs to existing shared controls from one approved recovery slot.
 * The business owner implementation is not a shared producer/style exemption. */
export function retainedSharedConsumerInputs(inventory,name,file){
 return inventory.rows.filter(row=>row.file===relative(file)).flatMap(row=>row.elements
  .filter(e=>e.kind===name&&e.customTarget?.endsWith('#'+name+'#build'))
  .map(e=>({...edge(e,row),input:canonicalArgument(e.args[0]??'{}',row.file)})));
}
function legacyBudgetOriginFacts(baseline,contract,readSource){
 const origin=contract.legacyBusinessBudgetOrigins;
 assert.equal(origin?.file,'tools/fixtures/architecture-legacy-business-budgets-20261005.json','exact historical budget origin witness');
 const historical=JSON.parse(readSource(origin.file)).rows;
 assert.equal(historical.length,100,'all original private budgets remain witnessed');
 assert.equal(createHash('sha256').update(JSON.stringify(historical)).digest('hex'),origin.rowsSha256,'immutable original private budget witness');
 const approvedKinds={
  'entry/src/main/ets/features/bookshelf/BookDirectoryPage.ets':'approved-existing-manga-variant',
  'entry/src/main/ets/features/bookshelf/LocalBookDetail.ets':'approved-existing-manga-variant',
  'entry/src/main/ets/features/common/PageBackBar.ets':'approved-finite-header-variants',
  'entry/src/main/ets/features/reading/ReaderDirectoryNavigationList.ets':'approved-existing-manga-variant',
  'entry/src/main/ets/features/reading/ReaderDirectoryNavigationSurface.ets':'approved-existing-manga-variant',
  'entry/src/main/ets/features/search/SearchPage.ets':'approved-existing-manga-variant',
  'entry/src/main/ets/features/source/SourceSwitchWindow.ets':'approved-fullviewport-live-picker',
 };
 assert.deepEqual([...origin.transferredPaths].sort(),Object.keys(approvedKinds).sort(),'only seven explicitly approved full-path policy migrations');
 const current=new Map(baseline.rows.map(row=>[row.file,row]));
 const migrated=new Map((baseline.uiPolicies??[]).filter(row=>origin.transferredPaths.includes(row.file)).map(row=>[row.file,row]));
 assert.equal(migrated.size,7,'one exact reversible policy for every transfer');
 for(const row of historical){
  if(current.has(row.file)){assert.deepEqual(current.get(row.file),row,'original business budget changed: '+row.file);continue;}
  const policy=migrated.get(row.file);assert.ok(policy,'historical budget lost: '+row.file);
  assert.equal(policy.kind,approvedKinds[row.file],'no arbitrary reclassification of private budgets: '+row.file);
  assert.deepEqual(policy.supersededLegacyCounts,row.counts,'exact original counts survive the approved transfer');
  assert.ok(policy.approvalEvidence&&policy.designSource,'explicit approved design source for transfer');
 }
 assert.equal(current.size+migrated.size,historical.length,'93 preserved plus 7 explicit transfers reversibly cover the original100');
 return{historicalBudgetRows:historical.length,transferredBudgetRows:migrated.size};
}
export function verifyArchitectureRegistration(inventory,baseline,contract,root,readSource=file=>readFileSync(path.join(root,file),'utf8')){
 const messages=messageArchitectureSuccession(contract,readSource);
 const bookshelf=bookshelfActionArchitectureSuccession(messages.contract,readSource);contract=bookshelf.contract;
 const settingsNative=inventory.rows.find(row=>row.file==='features/settings/SettingsPage.ets')?.overlays
  .filter(row=>row.kind==='showAlertDialog').map(({kind,method,args})=>({kind,method,args}));
 assert.deepEqual(settingsNative,[
  {kind:'showAlertDialog',method:'features/settings/SettingsPage.ets#SettingsPage#requestClearTextCache',args:['native']},
  {kind:'showAlertDialog',method:'features/settings/SettingsPage.ets#SettingsPage#requestRestoreDefaults',args:['native']},
 ],'approved cache confirmation preserves exactly two owned native confirmation entries');
 // One verification inspects the same current Index through both layout
 // witnesses and the native/font audit. Share only that call's parsed AST;
 // every later negative control starts a new map and really parses its bytes.
 const trees=new Map();
 const parseCurrent=(source,file)=>{
  const previous=trees.get(file);
  if(previous?.source===source){registrationParses.hits++;return previous.tree;}
  registrationParses.parses++;
  const tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
  assert.deepEqual(tree.parseDiagnostics,[],file+' current registration AST');
  trees.set(file,{source,tree});return tree;
 };
 const origins=legacyBudgetOriginFacts(baseline,contract,readSource);
 assert.deepEqual(contract.pageLayoutSuccessors,[fullDirectoryLayoutSuccessorPath,indexSyncColdLayoutSuccessorPath],'only the exact full-directory and unready-sync frame successions are admitted');
 verifyFullDirectoryLayoutSuccession(baseline,readSource,sharedProducerShape,parseCurrent);
 verifyIndexSyncColdLayoutSuccession(baseline,readSource,parseCurrent);
 assert.equal(createHash('sha256').update(JSON.stringify(baseline.rows)).digest('hex'),contract.legacyBusinessRowsSha256,'legacy100 private budgets cannot be silently raised');
 const producerFiles=new Set(contract.producers.map(p=>p.file));
 const boundedSpecs=contract.boundedSpecs??[];
 assert.deepEqual(boundedSpecs.map(spec=>[spec.id,spec.file]),[
  ['shared-ReaderPageShellPolicy','entry/src/main/ets/features/common/ReaderPageShell.ts'],
 ],'only the exact finite page-shell TypeScript policy gains spec ownership');
 const specFiles=new Set(boundedSpecs.map(spec=>spec.file));
 const legacyOwners=baseline.sharedOwners.filter(r=>!producerFiles.has(r.file)&&!specFiles.has(r.file));
 // Promote exactly the existing action-menu implementation to a finite
 // contract while reconstructing its immutable original shared-owner row.
 // No common-directory owner may gain the same transfer by naming a helper.
 assert.equal(contract.legacyActionMenuOrigin,'tools/fixtures/architecture-action-menu-owner-origin-20261014.json','one exact existing action-menu owner origin');
 const menuOrigin=JSON.parse(readSource(contract.legacyActionMenuOrigin));
 assert.deepEqual(menuOrigin,{schema:1,previousLegacySharedOwnersSha256:'82c4c61426bf926ad9708e8953b6a7b6e45478f9cf84e1ffcfe524c87cec0521',row:{file:'entry/src/main/ets/features/common/ReaderActionMenuSurface.ets',counts:{fontSize:1,backgroundColor:2},kind:'spec-driven-shared-menu-implementation',proof:'tools/test-action-menu-surface.mjs'}},'exact unchanged existing action-menu origin');
 assert.ok(producerFiles.has(menuOrigin.row.file),'existing action-menu renderer must have a finite producer contract');
 legacyOwners.unshift(menuOrigin.row);
 assert.equal(createHash('sha256').update(JSON.stringify(legacyOwners)).digest('hex'),contract.legacySharedOwnersSha256,'shared owner must be an exact legacy owner or a finite producer contract');
 const registry=[...baseline.rows,...(baseline.sharedOwners??[]),...messages.owners,...(baseline.uiPolicies??[])];
 assert.equal(new Set(registry.map(r=>r.file)).size,registry.length,'one bounded policy per file');
 for(const row of registry)assert.ok(!row.file.includes('*')&&row.file.startsWith('entry/src/main/ets/'),'no wildcard/source-external exemption');
 const registered=new Set(registry.map(r=>relative(r.file)));
 for(const row of inventory.rows.filter(r=>r.elements.length))assert.ok(registered.has(row.file),'unregistered actual UI file: '+row.file);
 for(const row of baseline.uiPolicies??[]){assert.ok(row.reason?.length>20&&row.owner?.length>0&&row.kind?.length>0,'outside100 needs actual owner/reason');assert.ok(inventory.rows.some(r=>r.file===relative(row.file)&&r.elements.length),'orphan UI policy '+row.file);}
 for(const spec of boundedSpecs){
  const registration=baseline.sharedOwners.find(row=>row.file===spec.file);
  assert.equal(registration?.contractId,spec.id,'finite page policy binds exact contract');
  assert.deepEqual(registration.counts,spec.counts,'finite page policy cannot gain an arbitrary style budget');
  assert.ok(spec.specPolicy?.length>20&&spec.sdkProofs?.length>0,'finite page policy requires its production SDK proof');
  for(const proof of spec.sdkProofs)assert.ok(readSource(proof).length>0,'actual finite page-policy proof');
  assert.deepEqual(sharedProducerShape(readSource(spec.file),spec.file),spec.shape,'finite page policy implementation/surface/inset contract changed');
 }
 // Both content kinds share the selected novel drawer. The finite successor
 // removes only retired manga backgrounds and preserves preparation cancel.
 // Historical approvals stay immutable; every actual background is witnessed.
 const novel=JSON.parse(readSource(novelSourceSwitchSuccessorPath));
 assert.deepEqual(novel.files.map(entry=>entry.path),[
  'entry/src/main/ets/features/source/SourceSwitchWindow.ets',
  'entry/src/main/ets/features/source/SourceSwitchProgress.ets'], 'only exact selected novel source background actors');
 assert.equal(novel.completion?.path,'entry/src/main/ets/features/source/SourceSwitchCompletionOverlay.ets','only the exact additional completion view');
 const shared=validateSharedSourceSwitchTypographySuccessor(JSON.parse(readSource(sharedSourceSwitchTypographySuccessorPath)),readSource);
 const sourceFrame=validateSourceSwitchFrameSuccessor(JSON.parse(readSource(sourceSwitchFrameSuccessorPath)),readSource);
 const sourceActors=shared.files.map((entry,index)=>({entry:index===0?sourceFrame.files[0]:entry,origin:novel.files[index],successorPath:index===0?sourceSwitchFrameSuccessorPath:sharedSourceSwitchTypographySuccessorPath}));
 const completion={...novel.completion,shape:messages.completion.shape,backgrounds:messages.completion.backgrounds};
 assert.equal(messages.completion.file,novel.completion.path,'only the existing C01 completion actor has a message-color successor');
 sourceActors.push({entry:completion,origin:novel.completion,successorPath:novelSourceSwitchSuccessorPath});
 for(const {entry,origin,successorPath} of sourceActors){
  const policy=baseline.uiPolicies.find(row=>row.file===entry.path);assert.ok(policy,'actual selected novel source UI policy');
  assert.equal(policy.visualSuccessorContract,successorPath,'selected shared source policy binds exact witness');
  assert.deepEqual(policy.counts,entry.architectureCounts,'exact selected novel source background budget');
  if(origin.historicalArchitecturePolicy){
   const old=origin.historicalArchitecturePolicy;
   assert.equal(policy.kind,old.kind,'selected novel successor retains exact historical policy kind');
   assert.deepEqual(policy.supersededLegacyCounts,old.supersededLegacyCounts,'selected novel successor retains original business budget witness');
   assert.ok(policy.counts.fontSize<=old.counts.fontSize,'shared source UI can only remove historical private typography');
  }
  const backgrounds=sharedProducerShape(readSource(entry.path),entry.path).styles.filter(style=>style.property==='backgroundColor');
  assert.deepEqual(backgrounds,entry.backgrounds,'exact selected novel source background carriers changed: '+entry.path);
  assert.equal(entry.architectureCounts.backgroundColor,backgrounds.length,'selected novel source count is fully witnessed');
  if(entry===completion){
   assert.equal(policy.visualSuccessorActor,'completion','completion policy cannot claim a historical actor');
   assert.deepEqual(policy.counts,{fontSize:0,backgroundColor:1},'completion cannot raise the historical reading-page budget');
   assert.deepEqual(sharedProducerShape(readSource(entry.path),entry.path),entry.shape,'exact completion view class/props/native styles changed');
  }
 }
 const actionSheetSuccessor=validateUnifiedActionSheetTypographySuccessor(JSON.parse(readSource(unifiedActionSheetTypographySuccessorPath)),readSource);
 for(const entry of actionSheetSuccessor.files){
  const policy=baseline.uiPolicies.find(row=>row.file===entry.path);assert.ok(policy,'actual action-sheet consumer retains a bounded owner policy');
  assert.equal(policy.actionSheetSuccessorContract,unifiedActionSheetTypographySuccessorPath,'shared action-content policy binds exact successor witness');
 }
 const directoryWorktree = validateMangaDirectoryWorktreeSuccessor(JSON.parse(readSource(mangaDirectoryWorktreeSuccessorPath)), readSource);
 for (const entry of directoryWorktree.files) {
  const policy = baseline.uiPolicies.find(row => row.file === entry.path);
  assert.equal(policy?.directoryWorktreeSuccessorContract, mangaDirectoryWorktreeSuccessorPath, 'finite directory integration policy binds exact witness');
  assert.deepEqual(policy.counts, entry.architectureCounts, 'finite outside100 directory state counts cannot grow');
  approvedTypographyContract(readSource(entry.path), entry.path);
 }
 for(const producer of contract.producers){
  if(producer.registrationKind==='legacy-business-budget'){
    // These three named existing controls retain their immutable historical
    // business rows. This finite map is not a common-directory exemption.
    const exactLegacy = {
      ReaderCard: { backgroundColor: 1 },
      ReaderToggle: { backgroundColor: 1 },
      ReaderSegmentedControl: { fontSize: 1, backgroundColor: 2 },
    };
    assert.ok(Object.hasOwn(exactLegacy, producer.component), 'only the exact existing Card budget or two F04 budgets can bind a producer');
    assert.equal(producer.file, 'entry/src/main/ets/features/common/' + producer.component + '.ets', 'exact existing finite legacy control path');
    assert.equal(producer.id, 'shared-' + producer.component);
    assert.deepEqual(baseline.rows.filter(r=>r.file===producer.file), [{file:producer.file, counts:exactLegacy[producer.component]}], 'exact unchanged finite legacy budget row required');
    assert.equal(baseline.sharedOwners.some(r=>r.file===producer.file), false, 'finite control keeps one policy; no duplicate shared exemption');
  }else{
    assert.equal(producer.registrationKind??'shared-owner','shared-owner','unknown producer registration mode');
    const registration=[...baseline.sharedOwners,...messages.owners].find(r=>r.file===producer.file);assert.equal(registration?.contractId,producer.id,'shared owner must bind exact approved contract');
    if(producer.architectureCounts)assert.deepEqual(registration.counts,producer.architectureCounts,'finite shared producer keeps its exact architecture counts');
  }
  assert.ok(producer.specPolicy&&producer.removalProofs.length&&producer.sdkProofs.length,'spec→delete→SDK chain required');
  for(const proof of [...producer.removalProofs,...producer.sdkProofs])assert.ok(readSource(proof).length>0,'actual existing proof: '+proof);
  const shape=sharedProducerShape(readSource(producer.file),producer.file);assert.deepEqual(shape,producer.shape,'finite shared physical inputs/interface changed: '+producer.file);
  for(const spec of producer.specSources??[])assert.deepEqual(sharedProducerShape(readSource(spec.file),spec.file),spec.shape,'finite shared spec source/role bindings changed: '+spec.file);
  const declaration=shape.declarations.find(d=>d.name===producer.component);assert.ok(declaration,'actual shared struct');
  const publicFields=new Set(declaration.publicFields.map(f=>f.name));
  const edges=producerConsumerEdges(inventory,producer.component);assert.ok(edges.length>0,'shared producer must be consumed');
  assert.deepEqual(edges.map(({keys,...e})=>e),producer.consumers.map(({keys,...e})=>e),'actual producer/consumer/spec edges changed: '+producer.id);
  for(const e of edges)for(const key of e.keys)assert.ok(publicFields.has(key),'illegal shared input '+producer.id+':'+key);
  if(producer.component==='ReaderPageState'){
    const bindings=[];
    for(const row of inventory.rows){const calls=row.elements.filter(e=>e.kind===producer.component),inputs=retainedSharedConsumerInputs(inventory,producer.component,'entry/src/main/ets/'+row.file);
      for(const[index,e]of calls.entries())bindings.push({file:row.file,method:e.method,input:inputs[index].input,modifiers:e.modifiers});}
    assert.deepEqual(bindings,producer.consumerBindings,'actual page-state input/callback/placement bindings changed');
  }else{
    for(const row of inventory.rows)for(const e of row.elements.filter(e=>e.kind===producer.component))assert.equal(e.modifiers.some(m=>(['ReaderCard','ReaderToggle','ReaderSegmentedControl','ReaderIconButton','ReaderMangaDownloadPopup','ReaderPageScaffold','ReaderFixedHeaderHost','ReaderStandardPage','ReaderActionSheetContent','ReaderActionMenuSurface'].includes(producer.component)?callerPhysical:appearance).has(m.property)),false,'caller privately overrides shared appearance '+row.file+':'+e.line);
  }
  // A finite domain wrapper must also prove its actual child delegation;
  // registering five incoming callers alone cannot prove shared rendering.
  for(const delegate of producer.delegates??[]){
    const domainDelegate=producer.component==='ReaderMangaDownloadPopup'&&delegate.component==='MangaDownloadOperationsPanel';
    assert.equal(delegate.file,domainDelegate?'entry/src/main/ets/features/manga/MangaDownloadOperationsPanel.ets':'entry/src/main/ets/features/common/'+delegate.component+'.ets','exact shared primitive or approved existing manga content target');
    const childShape=sharedProducerShape(readSource(delegate.file),delegate.file);
    assert.deepEqual(childShape,delegate.shape,'actual shared delegate implementation changed: '+delegate.component);
    const child=childShape.declarations.find(d=>d.name===delegate.component);assert.ok(child,'actual delegate struct');
    const fields=new Set(child.publicFields.map(field=>field.name));
    const outgoing=producerConsumerEdges(inventory,delegate.component).filter(edge=>edge.file===relative(producer.file));
    assert.deepEqual(outgoing,delegate.consumers,'actual shared delegate edges changed: '+producer.component+'→'+delegate.component);
    assert.ok(outgoing.length>0,'real child consumer required');
    for(const edge of outgoing)for(const key of edge.keys)assert.ok(fields.has(key),'illegal shared delegate input '+key);
  }

 }
 assert.ok((contract.retainedConsumerSlots??[]).length<=1,'one exact existing directory recovery slot, no broad alias exemption');
 for(const slot of contract.retainedConsumerSlots??[]){
  assert.equal(slot.id,'directory-rules-recovery','only the exact approved recovery slot is qualified');
  assert.equal(slot.file,'entry/src/main/ets/features/reading/ReaderDirectoryRules.ets','no UI-path wildcard or new producer exemption');
  assert.ok(baseline.rows.some(row=>row.file===slot.file),'recovery consumer retains its original business budget');
  assert.ok(slot.sdkProofs.length>0,'actual recovery consumer SDK proof required');
  for(const proof of slot.sdkProofs)assert.ok(readSource(proof).length>0,'actual recovery SDK proof');
  assert.deepEqual(slot.components.map(c=>c.component).sort(),['ReaderRecoveryAction','ReaderRecoveryNotice'],'exact existing common controls only');
  for(const child of slot.components){
    assert.equal(child.file,'entry/src/main/ets/features/common/'+child.component+'.ets','exact shared recovery implementation');
    assert.ok(baseline.sharedOwners.some(row=>row.file===child.file),'existing bounded shared owner, no new exemption');
    const shape=sharedProducerShape(readSource(child.file),child.file);assert.deepEqual(shape,child.shape,'retained shared child interface/implementation changed');
    const declaration=shape.declarations.find(d=>d.name===child.component);assert.ok(declaration,'actual shared recovery struct');
    const fields=new Set(declaration.publicFields.map(field=>field.name));
    const inputs=retainedSharedConsumerInputs(inventory,child.component,slot.file);
    for(const input of inputs)for(const key of input.keys)assert.ok(fields.has(key),'illegal retained shared input '+child.component+':'+key);
    assert.deepEqual(inputs,child.consumers,'actual retained recovery input/identity/callback bindings changed');
    assert.equal(inputs.length,child.component==='ReaderRecoveryNotice'?1:4,'all five actual recovery sites required');
    const row=inventory.rows.find(row=>row.file===relative(slot.file));
    for(const element of row.elements.filter(e=>e.kind===child.component))assert.equal(element.modifiers.some(m=>appearance.has(m.property)),false,'recovery caller cannot override common appearance');
  }
 }
 return{...origins,budgetRows:baseline.rows.length,sharedOwners:baseline.sharedOwners.length,outsideBudgetPolicies:baseline.uiPolicies.length,uiFiles:inventory.rows.filter(r=>r.elements.length).length,producers:contract.producers.length,messageBudgetUpdates:[...messages.budgetUpdates,...bookshelf.budgetUpdates]};
}
