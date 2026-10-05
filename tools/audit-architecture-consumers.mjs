/** Read-only actual ETS/TS source inventory. No production or build file writes.
 * Static reachability is conservative: conditional/callback paths are possible,
 * not proof of native scheduling or a user journey. Product-disabled branches
 * are evaluated independently from diagnostic and interface-preservation roots. */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { execFileSync } from 'node:child_process';
import { isSharedTypographyExpression, typographyExpressionContext } from './lib/reader-typography-consumer-audit.mjs';
const args=Object.fromEntries(process.argv.slice(2).map(arg=>{const [key,...rest]=arg.split('=');return [key,rest.join('=')];}));
const root=path.resolve(args['--root']||process.cwd()),sourceRoot=path.join(root,'entry/src/main/ets');
const require=createRequire(import.meta.url),sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts=require(`${sdk}/node_modules/typescript`),options=require(`${sdk}/lib/ets_checker.js`).compilerOptions;
const productSource=readFileSync(path.join(sourceRoot,'app/ReaderProductScope.ts'),'utf8');
const productPolicy=new Function(`${stripTypeScriptTypes(productSource.replace(/^export /gm,''))}; return { profile: READER_PRODUCT_PROFILE, enabled: isReaderProductSurfaceEnabled };`)();
const head=()=>execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),anchor=head();
const files=readdirSync(sourceRoot,{recursive:true}).filter(file=>/\.(ets|ts)$/.test(file)).sort(),data=new Map(),definitions=new Map(),symbols=new Map(),owners=new Map(),modifierMaps=new Map();
const fontProps=new Set(['fontFamily','fontWeight','fontSize','lineHeight','letterSpacing']),styleProps=new Set([...fontProps,'fontColor','backgroundColor','borderRadius','padding','margin','attributeModifier','width','height','opacity','visibility','accessibilityLevel','accessibilityText','enabled','onClick','onChange']);
const nativeNames=new Set(['Text','Span','Button','TextInput','TextArea','Toggle','Checkbox','CheckboxGroup','Radio','Select','Search','Slider','LoadingProgress','Progress','List','Grid','Column','Row','Stack','Scroll','Image','Web','Blank','ListItem','Polygon','Polyline','Flex','Divider','XComponent','NodeContainer','Canvas','Marquee','Refresh']);
const overlayNames=new Set(['bindSheet','bindPopup','bindContentCover','bindMenu','showAlertDialog','CustomDialogController','showDialog','openCustomDialog']);
function productBlocked(node) { for(let parent=node.parent;parent;parent=parent.parent) if(ts.isIfStatement(parent)) { const value=truth(parent.expression,true); const within=branch=>branch&&node.pos>=branch.pos&&node.end<=branch.end; if(value===false&&within(parent.thenStatement)||value===true&&within(parent.elseStatement))return true; } return false; }
const symbolKey=(file,name)=>`${file}#${name}`;
function nearest(node,predicate){for(let p=node.parent;p;p=p.parent)if(predicate(p))return p;}
function memberKey(file,node){const owner=nearest(node,n=>ts.isStructDeclaration(n)||ts.isClassDeclaration(n));const member=nearest(node,n=>ts.isMethodDeclaration(n)||ts.isPropertyDeclaration(n)||ts.isFunctionDeclaration(n));
 if(member){if(ts.isFunctionDeclaration(member))return `${file}#@function#${member.name?.text??'anonymous'}`;return `${file}#${owner?.name?.text??'@module'}#${ts.isPropertyDeclaration(member)?'@init:':''}${member.name?.getText()??'anonymous'}`;}return `${file}#@module`;}
function resolveImport(file,module){if(!module.startsWith('.'))return undefined;const base=path.posix.normalize(path.posix.join(path.posix.dirname(file),module));return files.find(name=>name===base||name===base+'.ets'||name===base+'.ts'||name===base+'/index.ets'||name===base+'/index.ts');}
for(const file of files){const source=readFileSync(path.join(sourceRoot,file),'utf8'),parsed=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,file.endsWith('.ets')?ts.ScriptKind.ETS:ts.ScriptKind.TS,options);
 assert.equal(parsed.parseDiagnostics.length,0,`${file}: actual SDK AST parse`);const expressionContext=typographyExpressionContext(source,file);const row={file,sha256:createHash('sha256').update(source).digest('hex'),imports:[],components:[],elements:[],overlays:[],productGuards:[],typography:{shared:0,private:0},source};data.set(file,row);
 for(const node of parsed.statements){if(ts.isImportDeclaration(node)){const target=resolveImport(file,node.moduleSpecifier.text),bindings=node.importClause?.namedBindings;
 if(target&&bindings&&ts.isNamedImports(bindings))for(const element of bindings.elements)row.imports.push({local:element.name.text,exported:element.propertyName?.text??element.name.text,target});}
 if(ts.isStructDeclaration(node)||ts.isClassDeclaration(node)){const name=node.name?.text;if(!name)continue;owners.set(symbolKey(file,name),node);if(ts.isStructDeclaration(node)){const component={name,decorators:ts.getAllDecorators(node).map(d=>d.getText(parsed)),line:parsed.getLineAndCharacterOfPosition(node.getStart(parsed)).line+1,methods:[],fields:[]};row.components.push(component);symbols.set(symbolKey(file,name),`${file}#${name}#build`);}
 for(const member of node.members??[])if(ts.isMethodDeclaration(member)||ts.isPropertyDeclaration(member)){const key=`${file}#${name}#${ts.isPropertyDeclaration(member)?'@init:':''}${member.name.getText(parsed)}`;definitions.set(key,{file,node:member,parsed,owner:name});const component=row.components.find(c=>c.name===name);if(component&&ts.isPropertyDeclaration(member))component.fields.push({name:member.name.getText(parsed),type:member.type?.getText(parsed),decorators:ts.getAllDecorators(member).map(d=>d.getText(parsed)),initializer:member.initializer?.getText(parsed)});if(component&&ts.isMethodDeclaration(member))component.methods.push({name:member.name.getText(parsed),decorators:ts.getAllDecorators(member).map(d=>d.getText(parsed))});}}
 if(ts.isFunctionDeclaration(node)&&node.name){const key=`${file}#@function#${node.name.text}`;definitions.set(key,{file,node,parsed,owner:'@function'});symbols.set(symbolKey(file,node.name.text),key);}}
 const modifiers=new Map();const rootOf=node=>{while(ts.isCallExpression(node)&&node.expression?.expression)node=node.expression.expression;return node;};
 const walk=node=>{if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)){const property=node.expression.name.text;if(styleProps.has(property)){const base=rootOf(node);if(!modifiers.has(base.pos))modifiers.set(base.pos,[]);modifiers.get(base.pos).push({property,expression:node.arguments[0]?.getText(parsed),extra:node.arguments.slice(1).map(n=>n.getText(parsed))});}}
 ts.forEachChild(node,walk);};walk(parsed);modifierMaps.set(file,modifiers);
 const collect=node=>{const callee=node.expression;const name=callee&&ts.isIdentifier(callee)?callee.text:callee&&ts.isPropertyAccessExpression(callee)?callee.name.text:undefined;
 if(ts.isEtsComponentExpression(node)){const line=parsed.getLineAndCharacterOfPosition(node.getStart(parsed)).line+1,chain=modifiers.get(node.pos)??[],fonts=chain.filter(m=>fontProps.has(m.property));const ancestor=nearest(node,n=>ts.isEtsComponentExpression(n)&&ts.isIdentifier(n.expression)&&n.expression.text==='Text');const fontOwner=nearest(node,n=>ts.isStructDeclaration(n)||ts.isClassDeclaration(n))?.name?.text;
 row.elements.push({kind:name,native:nativeNames.has(name),method:memberKey(file,node),line,productBlocked:productBlocked(node),hasChildContent:!!node.body,args:node.arguments?.map(n=>n.getText(parsed))??[],modifiers:chain,
  typography:fonts.length?fonts.every(m=>isSharedTypographyExpression(m.expression,expressionContext,fontOwner))?'shared':'runtime_or_private':name==='Span'&&ancestor?'inherits_text_parent':'native_default_or_delegated',
  defaultContract:fonts.length?undefined:name==='Text'&&['""',"''"].includes(node.arguments?.[0]?.getText(parsed))?'empty_paint_actor_no_glyph':chain.some(m=>m.property==='attributeModifier')?'modifier_delegated':name==='Button'&&node.body?'child_content_wrapper':name==='Button'&&!node.arguments?.length?'empty_native_event_host_no_label':chain.filter(m=>['width','height'].includes(m.property)&&m.expression==='1').length===2||chain.some(m=>m.property==='opacity'&&Number(m.expression)===0)||chain.some(m=>m.property==='visibility'&&m.expression==='Visibility.Hidden')?'nonvisual_accessibility_actor':'platform_default_needs_explicit_contract',inheritedTextLine:ancestor?parsed.getLineAndCharacterOfPosition(ancestor.getStart(parsed)).line+1:undefined});
 for(const font of fonts)row.typography[isSharedTypographyExpression(font.expression,expressionContext,fontOwner)?'shared':'private']++;}
 if((ts.isCallExpression(node)||ts.isNewExpression(node))&&overlayNames.has(name))row.overlays.push({kind:name,method:memberKey(file,node),line:parsed.getLineAndCharacterOfPosition(node.getStart(parsed)).line+1,args:node.arguments?.map(n=>n.getText(parsed))??[]});
 if(ts.isCallExpression(node)&&name==='isReaderProductSurfaceEnabled')row.productGuards.push({method:memberKey(file,node),line:parsed.getLineAndCharacterOfPosition(node.getStart(parsed)).line+1,surface:node.arguments[0]?.getText(parsed)});
 ts.forEachChild(node,collect);};collect(parsed);row.parsed=parsed;
}
// Custom component calls without trailing attributes are ordinary CallExpression
// nodes in the ETS parse tree. Resolve real imported struct declarations after
// all files have been parsed, rather than losing these actual shared consumers.
for (const [file,row] of data) {
 const collect=n=>{if(ts.isCallExpression(n)&&ts.isIdentifier(n.expression)){const name=n.expression.text,imported=row.imports.find(i=>i.local===name),target=imported?symbols.get(symbolKey(imported.target,imported.exported)):symbols.get(symbolKey(file,name));
 if(target?.endsWith('#build')) {const chain=modifierMaps.get(file).get(n.pos)??[];row.elements.push({kind:name,native:false,customTarget:target,method:memberKey(file,n),line:row.parsed.getLineAndCharacterOfPosition(n.getStart(row.parsed)).line+1,productBlocked:productBlocked(n),args:n.arguments.map(a=>a.getText(row.parsed)),modifiers:chain,typography:'shared_component_delegated'});}}ts.forEachChild(n,collect);};collect(row.parsed);
}
for(const [file,row] of data) for(const element of row.elements) if(!element.native&&!element.customTarget) { const imported=row.imports.find(i=>i.local===element.kind); element.customTarget=imported?symbols.get(symbolKey(imported.target,imported.exported)):symbols.get(symbolKey(file,element.kind)); }
function truth(node,profile){if(!profile)return undefined;if(ts.isParenthesizedExpression(node))return truth(node.expression,profile);if(node.kind===ts.SyntaxKind.TrueKeyword)return true;if(node.kind===ts.SyntaxKind.FalseKeyword)return false;
 if(ts.isCallExpression(node)&&node.expression.getText()==='isReaderProductSurfaceEnabled'&&ts.isStringLiteral(node.arguments[0]))return productPolicy.enabled(node.arguments[0].text);
 if(ts.isPrefixUnaryExpression(node)&&node.operator===ts.SyntaxKind.ExclamationToken){const value=truth(node.operand,profile);return value===undefined?undefined:!value;}
 if(ts.isBinaryExpression(node)){const a=truth(node.left,profile),b=truth(node.right,profile);if(node.operatorToken.kind===ts.SyntaxKind.AmpersandAmpersandToken)return a===false||b===false?false:a===true&&b===true?true:undefined;if(node.operatorToken.kind===ts.SyntaxKind.BarBarToken)return a===true||b===true?true:a===false&&b===false?false:undefined;}return undefined;}
function graph(profile){const edges=new Map();const add=(from,to)=>{if(!edges.has(from))edges.set(from,new Set());edges.get(from).add(to);};
 for(const[key,def]of definitions){const{file,node,parsed,owner}=def,row=data.get(file);const walk=n=>{if(ts.isIfStatement(n)){const value=truth(n.expression,profile);if(value!==false)walk(n.thenStatement);if(value!==true&&n.elseStatement)walk(n.elseStatement);return value===true&&ts.isReturnStatement(n.thenStatement);}
 if(ts.isBlock(n)){for(const statement of n.statements){if(walk(statement)||ts.isReturnStatement(statement))break;}return false;}
 if(ts.isConditionalExpression(n)){const value=truth(n.condition,profile);if(value!==false)walk(n.whenTrue);if(value!==true)walk(n.whenFalse);return false;}
 if((ts.isCallExpression(n)||ts.isEtsComponentExpression(n))&&ts.isIdentifier(n.expression)){const name=n.expression.text,imported=row.imports.find(i=>i.local===name),target=imported?symbols.get(symbolKey(imported.target,imported.exported)):symbols.get(symbolKey(file,name));if(target)add(key,target);}
 if(ts.isPropertyAccessExpression(n)&&n.expression.kind===ts.SyntaxKind.ThisKeyword){const target=`${file}#${owner}#${n.name.text}`;if(definitions.has(target))add(key,target);}
 ts.forEachChild(n,walk);return false;};walk(node.body??node.initializer??node);
 // A mounted component constructs its captured dialogs/slots and receives its
 // lifecycle callbacks. This is possible source reachability, not native proof.
 if(key.endsWith('#build')) {
   const declared=owners.get(symbolKey(file,owner));
   for(const property of declared?.members??[])for(const decorator of ts.getAllDecorators(property))
    if(ts.isCallExpression(decorator.expression)&&decorator.expression.expression.getText(parsed)==='Watch'&&ts.isStringLiteral(decorator.expression.arguments[0])){
     const target=`${file}#${owner}#${decorator.expression.arguments[0].text}`;if(definitions.has(target))add(key,target);
    }
   }
 if(key.endsWith('#build'))for(const other of definitions.keys())if(other.startsWith(`${file}#${owner}#`)&&(/#@init:/.test(other)||/#(?:aboutToAppear|onPageShow|onBackPress)$/.test(other)))add(key,other);
 }
 return edges;}
function visit(edges,roots){const seen=new Set(),queue=[...roots];while(queue.length){const key=queue.shift();if(seen.has(key))continue;seen.add(key);for(const to of edges.get(key)??[])queue.push(to);}return seen;}
const allGraph=graph(false),l0Graph=graph(true),primaryRoots=['pages/Index.ets#Index#build'],recoveryRoots=['pages/ReaderStartupRecovery.ets#ReaderStartupRecovery#build'];
const diagnosticRoots=data.get('pages/ReaderControlMotionVerification.ets')?.components.map(c=>`pages/ReaderControlMotionVerification.ets#${c.name}#build`).concat(data.get('pages/ReaderRendererPilot.ets')?.components.map(c=>`pages/ReaderRendererPilot.ets#${c.name}#build`)??[])??[];
const primary=visit(l0Graph,primaryRoots),possible=visit(allGraph,primaryRoots),recovery=visit(l0Graph,recoveryRoots),diagnostic=visit(l0Graph,diagnosticRoots);
const classify=method=>primary.has(method)?'main_l0_conditional_source_reachable':recovery.has(method)?'native_startup_recovery':diagnostic.has(method)?'debug_probe_only':possible.has(method)?'product_disabled_interface_preserved':'not_reached_by_registered_static_roots';
const registry=JSON.parse(readFileSync(path.join(root,'tools/architecture-consumer-baseline.json'),'utf8')),baseline=new Set([...registry.rows,...(registry.sharedOwners??[]),...(registry.uiPolicies??[])].map(r=>r.file.replace(/^entry\/src\/main\/ets\//,'')));
const oldFile=args['--prior-registry']?JSON.parse(readFileSync(args['--prior-registry'],'utf8')):undefined;
const oldSet=new Set((oldFile?.rows??[]).map(row=>row.file.replace(/^entry\/src\/main\/ets\//,'')));
const rows=[...data.values()].map(({source,parsed,...row})=>({...row,components:row.components.map(c=>({...c,reachability:classify(`${row.file}#${c.name}#build`)})),elements:row.elements.map(e=>({...e,reachability:e.productBlocked?'product_disabled_interface_preserved':classify(e.method)})),overlays:row.overlays.map(e=>({...e,reachability:classify(e.method)})),inBudgetRegistry:baseline.has(row.file),inOriginalEvidenceRegistry:oldSet.has(row.file)}));
const elementCounts={},reachabilityCounts={},defaultContractCounts={},untypedText=[],controls=[],overlays=[];for(const row of rows){for(const e of row.elements){elementCounts[e.kind]=(elementCounts[e.kind]??0)+1;reachabilityCounts[e.reachability]=(reachabilityCounts[e.reachability]??0)+1;if(['Text','Span','TextInput','TextArea','Marquee','Button'].includes(e.kind)&&e.typography==='native_default_or_delegated'){untypedText.push({file:row.file,...e});defaultContractCounts[e.defaultContract]=(defaultContractCounts[e.defaultContract]??0)+1;}if(['Button','TextInput','TextArea','Toggle','Checkbox','Radio','Select','Search','Slider'].includes(e.kind))controls.push({file:row.file,...e});}overlays.push(...row.overlays.map(e=>({file:row.file,...e})));}
const report={schema:2,generatedAt:new Date().toISOString(),sourceRoot,head:anchor,productProfile:productPolicy.profile,scope:'all entry ETS/TS actual SDK AST; conservative method/component source graph; current l0/disabled/debug/recovery separated; not device/user acceptance',
 provenance:{files:rows.length,workingSourceStable:rows.every(row=>createHash('sha256').update(readFileSync(path.join(sourceRoot,row.file))).digest('hex')===row.sha256),fileHashManifest:createHash('sha256').update(rows.map(r=>r.file+':'+r.sha256).join('\n')).digest('hex'),unchangedHead:head()===anchor},summary:{files:rows.length,structComponents:rows.reduce((n,r)=>n+r.components.length,0),actualUiElements:rows.reduce((n,r)=>n+r.elements.length,0),elementCounts,reachabilityCounts,nativeTextWithoutOwnTypography:untypedText.length,defaultContractCounts,nativeControls:controls.length,overlayCalls:overlays.length,registeredBudgetFiles:registry.rows.length,sharedOwners:registry.sharedOwners?.length??0,uiPolicies:registry.uiPolicies?.length??0,actualUiFilesOutsideLegacy100:rows.filter(r=>r.elements.length&&!registry.rows.some(b=>b.file.replace(/^entry\/src\/main\/ets\//,'')===r.file)).map(r=>r.file),actualUiFilesMissingBudget:rows.filter(r=>r.elements.length&&!r.inBudgetRegistry).map(r=>r.file),missingPriorEvidence:rows.filter(r=>r.elements.length&&!r.inOriginalEvidenceRegistry).map(r=>r.file)},
 untypedText,controls,overlays,rows};
assert.equal(report.provenance.workingSourceStable,true,'source bytes remained stable during parse');
assert.equal(report.provenance.unchangedHead,true,'audit head remained stable during parse');
if(args['--output']){const dest=path.resolve(args['--output']);mkdirSync(path.dirname(dest),{recursive:true});writeFileSync(dest,JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(args['--stdout']==='json'?report:report.summary,null,2));
