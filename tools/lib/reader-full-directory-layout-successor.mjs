import { installedEtsCompiler, emitSdkProbe } from './ets-compiler-runtime.mjs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createDefaultReaderWindowMetrics,readerContentSafeTop} from '../../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';

export const fullDirectoryLayoutSuccessorPath='tools/fixtures/reader-full-directory-page-layout-successor-20261014.json';
export const fullDirectoryMessageOverlaySuccessorPath='tools/fixtures/reader-full-directory-message-overlay-successor-20261019.json';
const { ts, options } = installedEtsCompiler();
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** Immutable approval provenance plus the current semantic consumer. Historical
 * private method/style expressions are evidence of the old version, not the
 * required spelling of the current public frame/geometry implementation. */
export function verifyFullDirectoryLayoutSuccession(baseline,readSource,_shape,parseCurrent,{executeConsumer=false,fullMatrix=true,fixtureFactory}={}){
 const parse=(source,file)=>parseCurrent?parseCurrent(source,file):ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
 const witness=JSON.parse(readSource(fullDirectoryLayoutSuccessorPath));
 const overlayWitness=JSON.parse(readSource(fullDirectoryMessageOverlaySuccessorPath));
 assert.deepEqual([overlayWitness.schema,overlayWitness.authority,overlayWitness.previousLayoutWitness,overlayWitness.page,overlayWitness.scope],
  [1,'docs/message-ui/approved-scope-20261019.json',fullDirectoryLayoutSuccessorPath,'entry/src/main/ets/features/reading/ReaderFullDirectory.ets','A13 pending-operation'],
  'only the approved A13 overlay supersedes the immutable directory layout witness');
 assert.deepEqual(overlayWitness.slots,{header:'topBar',content:'directoryContent',overlayContent:'directoryOverlay'});
 assert.equal(overlayWitness.visibility,'this.directoryRecovery.bookmarks.visible || this.directoryRecovery.offline.visible');
 assert.deepEqual(overlayWitness.overlayModifiers,[['hitTestBehavior',['HitTestMode.Transparent']],['zIndex',['8']],
  ['position',['{ x: this.panelLeft(), y: this.panelTop() }']],['width',['this.panelWidth()']]]);
 assert.deepEqual(overlayWitness.recoveryInputs,{recovery:'this.directoryRecovery',onReconcileBookmarks:'this.onReconcileBookmarks',
  onContinueBookmarks:'this.onContinueBookmarks',onReconcileOffline:'this.onReconcileOffline',onContinueOffline:'this.onContinueOffline'});
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
 assert.deepEqual(tree.parseDiagnostics,[]);
 const owner=tree.statements.find(node=>ts.isStructDeclaration(node)&&node.name.text==='ReaderFullDirectory');assert.ok(owner);
 const context=owner.members.find(node=>node.name?.getText(tree)==='catalogContext');
 assert.ok(context&&ts.getAllDecorators(context).some(d=>d.getText(tree)==='@Prop'),'catalog context is a reactive public parent fact');
 assert.deepEqual(context.type.types.map(node=>node.literal.text).sort(),['detail','reader']);
 const build=owner.members.find(node=>node.name?.getText(tree)==='build');assert.ok(build);
 const nativeCalls=[];const visit=node=>{if((ts.isCallExpression(node)||ts.isEtsComponentExpression(node))&&ts.isIdentifier(node.expression)&&/^[A-Z]/.test(node.expression.text))nativeCalls.push(node);ts.forEachChild(node,visit);};visit(build);
 assert.deepEqual(nativeCalls.map(node=>node.expression.text),['ReaderPageScaffold'],'one actual shared frame, without a parallel private native root');
 const properties=new Set(nativeCalls[0].arguments[0].properties.map(p=>p.name.getText(tree)));
 for(const name of ['frameStyle','geometry','headerMeasurementKey','header','content','overlayContent','onHeaderHeightChange'])assert.ok(properties.has(name),'current public directory frame input '+name);
 const members=new Map(owner.members.filter(node=>node.name).map(node=>[node.name.getText(tree),node]));
 const props=new Map(nativeCalls[0].arguments[0].properties.map(node=>[node.name.getText(tree),node.initializer]));
 const builderGraph=entry=>{
  const seen=new Set(),nodes=[];
  const walk=node=>{
   nodes.push(node);
   if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.expression.kind===ts.SyntaxKind.ThisKeyword){
    const method=members.get(node.expression.name.text);
    if(method&&!seen.has(method)&&ts.getAllDecorators(method).some(d=>d.getText(tree)==='@Builder')){seen.add(method);walk(method.body);}
   }
   ts.forEachChild(node,walk);
  };walk(entry);return nodes;
 };
 const headerGraph=builderGraph(props.get('header')),bodyGraph=builderGraph(props.get('content')),overlayGraph=builderGraph(props.get('overlayContent'));
 const actor=(node,name)=>(ts.isCallExpression(node)||ts.isEtsComponentExpression(node))&&node.expression.getText(tree)===name;
 for(const field of ['bookTitle','chapterTitle'])assert.ok(headerGraph.some(node=>actor(node,'Text')&&node.arguments[0]?.getText(tree)==='this.'+field),'header delegates original public '+field+' role');
 assert.ok(bodyGraph.some(node=>actor(node,'FullDirectoryPanel')),'body delegates original public directory actor');
 assert.ok(overlayGraph.some(node=>actor(node,'ReaderDirectoryRecoverySurface')),'overlay delegates original recovery actor');
 // Architecture registration gets provenance and source ownership only. The
 // full behavioral consumer is selected explicitly by its focused case; it
 // must never become a hidden SDK runtime suite in a parent source audit.
 if(!executeConsumer)return {privateBudget:{fontSize:5,backgroundColor:2},historicalPhysicalInputs:witness.previousStyles.length,
  scope:'Immutable approval provenance and current public frame/Builder role graph only; behavioral SDK proof is a separate exact case.',
  runtimeCase:'H-reader-page-header-contract#directory-layout-succession'};
 assert.equal(typeof fixtureFactory,'function','directory runtime proof requires the explicit feature fixture factory');
 const fullDirectorySdkFixture=fixtureFactory;
 const indexFile='entry/src/main/ets/pages/Index.ets',indexSource=readSource(indexFile),indexTree=parse(indexSource,indexFile);
 assert.equal(indexTree.text,indexSource);assert.deepEqual(indexTree.parseDiagnostics,[]);
 const indexOwner=indexTree.statements.find(node=>ts.isStructDeclaration(node)&&node.name.text==='Index');assert.ok(indexOwner);
 const indexMethods=['readerOwnsWindowEdges','appContentTopInset'].map(name=>{const method=indexOwner.members.find(node=>node.name?.getText(indexTree)===name);assert.ok(method,name);return method.getText(indexTree);});
 const metrics=createDefaultReaderWindowMetrics();Object.assign(metrics.windowRect,{width:393,height:852});
 const output=emitSdkProbe('class DirectoryParentInset {'+indexMethods.join('\n')+'}',{fileName:'DirectoryParentInset.ts',parseSource:indexSource,scriptKind:'ETS',compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}});
 const parent=new (new Function('ReaderWindowCoordinator','readerContentSafeTop',output+';return DirectoryParentInset;')({metrics:()=>metrics},readerContentSafeTop))();
 Object.assign(parent,{route:'directory',detailBook:{contentKind:'text'},readingSessionActive:true,mangaSourceSwitchSelectionVisible:false,readerWindowMetricsRevision:7});
 const fixtures=[],make=(width,top,context,bookmarks,offline,scheme='day',scale=1)=>{
  Object.assign(metrics.windowRect,{width,height:852});metrics.systemInsets.top=top;metrics.systemFontScale=scale;
  const fixture=fullDirectorySdkFixture(source,metrics),page=fixture.owner;
  assert.equal(page.catalogContext,'reader','retained embedded reader remains the actual default');
  const events=[];const recovery={presentationId:'original-directory',bookmarks:{message:'original bookmarks',visible:bookmarks,canRetry:true,generation:17},offline:{message:'original offline',visible:offline,canRetry:true,generation:23},canContinueBookmarks:true,canContinueOffline:true};
  Object.assign(page,{mounted:true,bookTitle:'Original approved title',chapterTitle:'Original approved chapter',sourceId:'remote',
   currentChapterIndex:-1,catalogContext:context,readerWindowMetricsRevision:7,appThemeScheme:scheme,directoryRecovery:recovery,offlineMenuVisible:true,
   onReconcileBookmarks:(...args)=>events.push(['bookmarks.reconcile',...args]),onContinueBookmarks:(...args)=>events.push(['bookmarks.continue',...args]),
   onReconcileOffline:(...args)=>events.push(['offline.reconcile',...args]),onContinueOffline:(...args)=>events.push(['offline.continue',...args])});
  page.initialRender();const actors=fixture.walk(page),frames=actors.filter(actor=>typeof actor.frameStyle==='object'&&actor.geometry);
  assert.equal(frames.length,1,'one actual shared directory frame');const frame=frames[0],nodes=fixture.nodes(page);
  const panels=actors.filter(actor=>actor instanceof fixture.DirectoryPanel);assert.equal(panels.length,1,'original directory body actor mounts once');
  const panel=panels[0];assert.equal(panel.params.allowUnanchoredBrowse,context==='detail','unknown anchor browsing belongs only to detail');
  assert.equal(frame.headerMeasurementKey,7,'native header receives the current metrics generation');
  assert.equal(frame.frameStyle.header.transparent,true,'bounded card retains transparent shared header host');assert.equal(frame.frameStyle.header.clip,false);
  const expectedTop=context==='detail'?18:Math.max(18,top);assert.equal(frame.geometry.header.top,expectedTop,'context-specific safe-top owner');
  parent.directoryReturnTarget=context==='detail'?'detail':'readerControl';
  const parentTop=parent.readerOwnsWindowEdges()?0:parent.appContentTopInset();assert.equal(parentTop,context==='detail'?top:0,'actual Index owns exactly its context-specific safe top');
  assert.equal(parentTop+frame.geometry.header.top,(context==='detail'?top:0)+expectedTop,'one parent/reader system inset and retained design gap');
  const expectedHeader=54+Math.ceil(39*(scale-1));assert.equal(frame.geometry.header.height,expectedHeader,'native fallback follows actual header scale without changing approved text size');
  assert.equal(frame.geometry.content.startInset,expectedTop+expectedHeader+16,'measured header and retained panel gap own body clearance');
  const expectedWidth=width===393?364:720,expectedLeft=width===393?14.5:67;
  assert.equal(panel.params.panelWidthOverride,expectedWidth,'original phone/tablet panel bound');
  const viewport=[...page.nodes.values()].filter(node=>node.type==='Stack'&&typeof node.width==='number'&&node.position);
  assert.equal(viewport.length,1);assert.equal(viewport[0].clip,true,'directory rows remain inside the bounded native viewport');
  assert.equal(viewport[0].height,panel.params.panelHeightOverride,'native viewport keeps the complete current panel height');
  assert.deepEqual(viewport[0].position,{x:expectedLeft,y:expectedTop+expectedHeader+16});
  const recoveries=actors.filter(actor=>actor instanceof fixture.RecoverySurface);
  assert.equal(recoveries.length,bookmarks||offline?1:0,'actual pending bookmark/offline visibility truth table');
  const overlays=[...page.nodes.values()].filter(node=>node.type==='Column'&&node.hitTestBehavior==='HitTestMode.Transparent'&&node.zIndex===8);
  assert.equal(overlays.length,recoveries.length,'one intrinsic pending carrier, no additional native message actor');
  if(recoveries.length){
   const overlay=overlays[0];assert.equal(overlay.height,undefined,'pending directory feedback keeps intrinsic height');assert.equal(overlay.width,expectedWidth);assert.deepEqual(overlay.position,viewport[0].position,'feedback owns the same original panel bounds');
   const inputs=recoveries[0].params;assert.deepEqual(inputs.recovery,recovery,'original recovery snapshot reaches its public leaf port');
   for(const [key,event]of [['onReconcileBookmarks','bookmarks.reconcile'],['onContinueBookmarks','bookmarks.continue'],['onReconcileOffline','offline.reconcile'],['onContinueOffline','offline.continue']])inputs[key](31,'original-identity');
   assert.deepEqual(events,[['bookmarks.reconcile',31,'original-identity'],['bookmarks.continue',31,'original-identity'],['offline.reconcile',31,'original-identity'],['offline.continue',31,'original-identity']],'four generation-bearing recovery callbacks retain distinct original ports');
  }
  const text=nodes.filter(node=>node.type==='Text');
  const values=new Map([['this.bookTitle',page.bookTitle],['this.chapterTitle',page.chapterTitle]]);
  assert.equal(text.length,typography.carriers.length,'no unregistered native sibling text in directory slots');
  for(const carrier of typography.carriers){
   const label=values.get(carrier.text)??carrier.text.slice(1,-1),matches=text.filter(node=>node.create===label);assert.equal(matches.length,1,'one approved text carrier '+label);
   const actual=matches[0];
   for(const [property,entry]of Object.entries(carrier.modifiers)){
    const [role,field]=entry.expression.split('.');assert.equal(actual[property],typography.roles[role][field],'approved physical text tuple '+label+'.'+property);
   }
  }
  // Accessibility and scaled line boxes are current independent policies; the
  // historical 42vp controls are never silently rewritten into that approval.
  for(const node of nodes.filter(node=>node.responseRegion)){const region=node.responseRegion;if(typeof region.width==='number')assert.ok(region.width>=44);if(typeof region.height==='number')assert.ok(region.height>=44);}
  for(const label of [page.bookTitle,page.chapterTitle])assert.equal(text.find(node=>node.create===label).maxFontScale,scale);
  const divider=nodes.find(node=>node.type==='Divider');assert.ok(divider&&divider.strokeWidth===1,'real native Divider remains in the retained menu');
  fixtures.push({fixture,page,frame,panel});return fixtures.at(-1);
 };
 const widths=fullMatrix?[393,800]:[393],tops=fullMatrix?[0,39,61]:[39];
 for(const width of widths)for(const top of tops)for(const context of ['detail','reader'])for(const bookmarks of [false,true])for(const offline of [false,true])make(width,top,context,bookmarks,offline,width===393?'day':'night');
 if(fullMatrix)for(const width of [393,800])make(width,39,'reader',true,true,'night',2);
 const pose=make(393,39,'reader',true,true),poseViewport=[...pose.page.nodes.values()].find(node=>node.type==='Stack'&&typeof node.width==='number'&&node.position);
 pose.page.animateFromControl=true;
 for(const progress of [0,.5,1]){
  pose.page.panelProgress=progress;pose.fixture.properties.flush();
  const full=pose.panel.params.panelHeightOverride;
  assert.equal(poseViewport.height,330+(full-330)*progress,'actual native panel preserves collapsed-to-full height');
  assert.equal(poseViewport.position.y,109+(full-330)*(1-progress),'actual native panel remains bottom anchored');
  assert.equal(poseViewport.opacity,progress,'actual native panel retains original reveal pose');
  assert.equal(poseViewport.position.y+poseViewport.height,832,'all authored poses retain the same safe bottom edge');
  assert.equal(pose.fixture.walk(pose.page).find(actor=>actor instanceof pose.fixture.DirectoryPanel),pose.panel,'native pose updates retain the same business actor');
 }
 // Exercise actual native callbacks and the parent's store, including an old
 // child receipt passed directly to the current public callback.
 const sample=make(393,39,'reader',true,true),{fixture,page,frame,panel}=sample;
 const header=fixture.walk(page).find(actor=>actor!==page&&typeof actor.style==='object'&&actor.measurementKey===7);
 assert.ok(header,'actual HeaderHost receives current measurement identity');
 const node=[...header.nodes.values()].find(node=>node.onAreaChange),oldNative=node.onAreaChange;
 oldNative({}, {height:'97vp'});fixture.properties.flush();assert.equal(frame.geometry.header.height,97,'real native measured header updates body clearance');
 assert.equal(fixture.walk(page).filter(actor=>actor instanceof fixture.DirectoryPanel)[0],panel,'native header updates retain the business panel');
 page.readerWindowMetricsRevision=8;fixture.properties.flush();assert.equal(frame.geometry.header.height,54,'old measured generation cannot define new geometry');
 oldNative({}, {height:999});fixture.properties.flush();assert.equal(frame.geometry.header.height,54,'retired native handler cannot publish into the new layout');
 frame.onHeaderHeightChange(123,7);fixture.properties.flush();assert.equal(frame.geometry.header.height,54,'parent independently rejects old presented generation');
 page.mounted=false;frame.onHeaderHeightChange(123,8);fixture.properties.flush();assert.equal(frame.geometry.header.height,54,'unmounted directory rejects native receipt');
 page.mounted=true;frame.onHeaderHeightChange(0,8);fixture.properties.flush();assert.equal(frame.geometry.header.height,54,'empty native receipt cannot erase fallback header');
 frame.onHeaderHeightChange(105,8);fixture.properties.flush();assert.equal(frame.geometry.header.height,105,'current mounted receipt remains accepted');
 const unbound=fullDirectorySdkFixture(source,metrics);Object.assign(unbound.owner,{catalogContext:'reader',readerWindowMetricsRevision:-1});unbound.owner.initialRender();
 const unboundFrame=unbound.walk(unbound.owner).find(actor=>typeof actor.frameStyle==='object'&&actor.geometry);assert.equal(unboundFrame.geometry.header.top,18,'unbound metrics retain original minimum top gap');
 assert.equal(witness.sdkProof,'tools/test-reader-page-header-contract.mjs');assert.ok(readSource(witness.sdkProof).length>0);
 return {privateBudget:{fontSize:5,backgroundColor:2},historicalPhysicalInputs:witness.previousStyles.length,approvedTextTuples:typography.carriers.length,sdkSamples:fixtures.length,scope:'Current frame/recovery/measurement consumer; historical approval unchanged. No native/device visual acceptance.'};
}
