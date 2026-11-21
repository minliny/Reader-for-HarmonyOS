import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

export const CONTRACT_CASES = {
  "sdk-public-slots": {
    "description": "Current public Builder slots and actual native overlay collision negative; installed SDK",
    "resources": []
  },
  "header-paint-owner": {
    "description": "Actual retained HeaderHost policy/paint/clip/measurement with bad policy and omitted-paint counterexamples",
    "resources": []
  },
  "scaffold-slots": {
    "description": "Actual Scaffold slots, common layer order and measurement callbacks; no route-wide scan",
    "resources": []
  },
  "footer-safe-lane": {
    "description": "Actual retained bounded footer viewport/safe lane and omitted clip/paint negatives",
    "resources": []
  },
  "standard-page-layout": {
    "description": "Actual shared frame text/manga safe-area facts and measured standard page delegation",
    "resources": []
  },
  "framework-route-coverage": {
    "description": "Explicit full current route/branch architecture inventory with missing host/route/quiet-notice negatives; no product full test",
    "resources": []
  },
  "directory-layout-succession": {
    "description": "Explicit controlled full-directory baseline succession and bad callback/layout mutations",
    "resources": []
  },
  "sync-cold-layout": {
    "description": "Actual SDK cold/ready sync branch and explicit controlled baseline mutation",
    "resources": []
  }
};

async function case_sdk_public_slots() {
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { readerPageBuilderSlots } = await import('./lib/reader-page-builder-slots.mjs');
for (const [name, file, slots] of [
  ['ReaderPageScaffold', 'common/ReaderPageScaffold.ets', ['content', 'header', 'footer', 'overlayContent']],
  ['ReaderStandardPage', 'common/ReaderStandardPage.ets', ['content', 'header', 'footer', 'overlayContent']],
  ['MainTabShell', 'shell/MainTabShell.ets', ['content', 'header', 'overlayContent']],
]) {
  const source = readFileSync(`entry/src/main/ets/features/${file}`, 'utf8');
  const actualSlots = [...readerPageBuilderSlots(source, name)];
  assert.equal(new Set(actualSlots).size, actualSlots.length, `${name}: public slots remain unique`);
  for (const slot of slots) assert.ok(actualSlots.includes(slot), `${name}: original public slot ${slot} remains; valid additive slots are allowed`);
  const collision = source.replaceAll('overlayContent', 'overlay');
  assert.notEqual(collision, source);
  assert.throws(() => readerPageBuilderSlots(collision, name), /collides.*native CustomComponent/,
    `${name}: the focused SDK gate must reject the compiler-only native overlay collision`);
}

}

async function case_header_paint_owner() {

const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { pageFrameSdkFixture, mutatePageFrameCall } = await import('./lib/reader-page-frame-sdk-fixture.mjs');
const { actualReaderPageShell, readerPageShellSourceUrl } = await import('./lib/reader-page-shell-runtime-probe.mjs');
const policy = actualReaderPageShell();
const style = options => policy.readerFrameStyle({backgroundColor:'#FF102030',headerBackground:'#FF405060',footerBackground:'#FF708090',...options});
const geometry = options => { const input = new policy.ReaderPageGeometryInput(); Object.assign(input, options); return policy.resolveReaderPageGeometry(input); };

function proof(policyOverrides={}) {
 const fixture=pageFrameSdkFixture({dependencies:policyOverrides}),owner=fixture.create('ReaderFixedHeaderHost');
 const receipts=[];let mounts=0;
 Object.assign(owner,{style:style().header,measurementKey:7,content:()=>mounts++,onHeightChange:(height,key)=>receipts.push([height,key])});owner.initialRender();
 const header=fixture.nodes(owner).find(node=>node.type==='Column');
 assert.equal(mounts,1);assert.equal(header.width,'100%');assert.equal(header.zIndex,10);
 assert.equal(header.clip,true,'opaque header clips its own paint');assert.equal(header.backgroundColor,'#FF405060','opaque header paints the supplied original surface');
 const oldMeasurement=header.onAreaChange;
 for(const height of [88,'95vp',-1,'invalid'])oldMeasurement({}, {height});
 assert.deepEqual(receipts,[[88,7],[95,7]],'numeric/vp receipts preserve their captured measurement key');
 owner.style=style({headerTransparent:true}).header;owner.measurementKey=8;fixture.properties.flush();
 assert.equal(header.backgroundColor,'#00000000');assert.equal(header.clip,false,'floating reuse clears its old mask');
 oldMeasurement({}, {height:999});assert.deepEqual(receipts,[[88,7],[95,7]],'old native measurement cannot acquire the new generation');
 header.onAreaChange({}, {height:96});assert.deepEqual(receipts.at(-1),[96,8]);assert.equal(mounts,1);
 owner.style=style({headerBackground:'#FF778899'}).header;fixture.properties.flush();assert.equal(header.backgroundColor,'#FF778899');assert.equal(header.clip,true);
 return fixture;
}
proof();
const original=readFileSync(readerPageShellSourceUrl,'utf8');
// Mutate only this real modifier; the visual header must detect missing paint
// independently of the supplied style object and compiler lowering.
const noPaint=mutatePageFrameCall(original,'ReaderHeaderFrameModifier','backgroundColor',(node,tree)=>node.expression.expression.getText(tree));
assert.notEqual(noPaint,original);assert.throws(()=>proof(actualReaderPageShell(noPaint)),/opaque header paints/);
const noClip=mutatePageFrameCall(original,'ReaderHeaderFrameModifier','clip',(node,tree)=>node.expression.getText(tree)+'(false)');
assert.notEqual(noClip,original);assert.throws(()=>proof(actualReaderPageShell(noClip)),/opaque header clips/);

}

async function case_scaffold_slots() {

const { default: assert } = await import('node:assert/strict');
const { pageFrameSdkFixture } = await import('./lib/reader-page-frame-sdk-fixture.mjs');
const { actualReaderPageShell } = await import('./lib/reader-page-shell-runtime-probe.mjs');
const policy = actualReaderPageShell();
const style = options => policy.readerFrameStyle({backgroundColor:'#FF102030',headerBackground:'#FF405060',footerBackground:'#FF708090',...options});
const geometry = options => { const input = new policy.ReaderPageGeometryInput(); Object.assign(input, options); return policy.resolveReaderPageGeometry(input); };

const fixture=pageFrameSdkFixture(),owner=fixture.create('ReaderPageScaffold');const slots=[],headerReceipts=[],footerReceipts=[];
Object.assign(owner,{frameStyle:style(),geometry:geometry({frameInsetLeft:13,frameInsetRight:17,headerTop:6,footerBottom:28}),
 headerMeasurementKey:7,footerMeasurementKey:9,content:()=>slots.push('body'),header:()=>slots.push('header'),footer:()=>slots.push('footer'),overlayContent:()=>slots.push('overlay'),
 onHeaderHeightChange:(height,key)=>headerReceipts.push([height,key]),onFooterHeightChange:height=>footerReceipts.push(height)});owner.initialRender();
assert.deepEqual(slots,['body','header','footer','overlay'],'actual hosts delegate each original slot once');
const root=[...owner.nodes.values()].find(node=>node.type==='Stack'&&node.padding);
assert.deepEqual(root.padding,{left:13,right:17});assert.equal(root.clip,true);
const layers=[...owner.nodes.values()].filter(node=>[10,20,30].includes(node.zIndex));assert.deepEqual(layers.map(node=>node.zIndex),[10,20,30]);
assert.ok(layers.every(node=>node.hitTestBehavior==='HitTestMode.Transparent'));
const header=fixture.walk(owner).find(actor=>actor!==owner&&actor.measurementKey===7),headerNode=[...header.nodes.values()].find(node=>node.onAreaChange);
const footer=[...owner.nodes.values()].find(node=>node.type==='Column'&&node.onAreaChange);
const oldHeader=headerNode.onAreaChange,oldFooter=footer.onAreaChange;
oldHeader({}, {height:'97vp'});oldFooter({}, {height:'54vp'});assert.deepEqual(headerReceipts,[[97,7]]);assert.deepEqual(footerReceipts,[54]);
owner.headerMeasurementKey=8;owner.footerMeasurementKey=10;fixture.properties.flush();
oldHeader({}, {height:999});oldFooter({}, {height:999});assert.deepEqual(headerReceipts,[[97,7]]);assert.deepEqual(footerReceipts,[54],'old footer measurement cannot publish into the new layout');
headerNode.onAreaChange({}, {height:-1});footer.onAreaChange({}, {height:'invalid'});assert.deepEqual(footerReceipts,[54]);
headerNode.onAreaChange({}, {height:98});footer.onAreaChange({}, {height:55});assert.deepEqual(headerReceipts.at(-1),[98,8]);assert.deepEqual(footerReceipts,[54,55]);
owner.frameStyle=style({clip:false});fixture.properties.flush();assert.equal(root.clip,false);assert.deepEqual(slots,['body','header','footer','overlay'],'style and receipt updates retain each business actor');

}

async function case_footer_safe_lane() {

const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { pageFrameSdkFixture, pageFrameSource, mutatePageFrameCall } = await import('./lib/reader-page-frame-sdk-fixture.mjs');
const { actualReaderPageShell, readerPageShellSourceUrl } = await import('./lib/reader-page-shell-runtime-probe.mjs');
const policy = actualReaderPageShell();
const style = options => policy.readerFrameStyle({backgroundColor:'#FF102030',headerBackground:'#FF405060',footerBackground:'#FF708090',...options});
const geometry = options => { const input = new policy.ReaderPageGeometryInput(); Object.assign(input, options); return policy.resolveReaderPageGeometry(input); };

function proof(sources={},dependencies={}) {
 const fixture=pageFrameSdkFixture({sources,dependencies}),owner=fixture.create('ReaderPageScaffold');let mounts=0;const heights=[];
 Object.assign(owner,{frameStyle:style({footerSolid:true}),geometry:geometry({footerHeight:54,footerBottom:42,footerInsetLeft:20,footerInsetRight:20,footerSurface:'solid'}),
 content:()=>mounts++,footer:()=>{},onFooterHeightChange:height=>heights.push(height)});owner.initialRender();
 const nodes=[...owner.nodes.values()],viewport=nodes.find(node=>node.type==='Stack'&&node.height==='calc(100% - 96vp)');
 assert.ok(viewport,'resolved footer and safe area bound the real content viewport');assert.equal(viewport.clip,true,'rows cannot paint or receive input in the fixed footer lane');
 const backing=nodes.find(node=>node.type==='Column'&&node.padding?.bottom===42);
 assert.ok(backing,'paper covers the complete bottom safe area');assert.equal(backing.width,'100%');assert.equal(backing.clip,true);assert.equal(backing.backgroundColor,'#FF708090','footer lane paints the feature-owned surface');
 const measurement=nodes.find(node=>node.type==='Column'&&node.onAreaChange);measurement.onAreaChange({}, {height:'54vp'});assert.deepEqual(heights,[54]);
 owner.frameStyle=style();owner.geometry=geometry({footerBottom:42,footerSurface:'transparent'});fixture.properties.flush();
 assert.equal(backing.backgroundColor,'#00000000');assert.equal(backing.clip,false);assert.deepEqual(backing.padding,{bottom:0});assert.deepEqual(backing.margin,{bottom:42});
 assert.equal(viewport.height,'100%');assert.equal(viewport.clip,false);assert.equal(mounts,1);
}
proof();
const source=pageFrameSource('ReaderPageScaffold');
const noClip=mutatePageFrameCall(source,'ReaderPageScaffold','clip',(node,tree)=>node.expression.getText(tree)+'(false)');assert.notEqual(noClip,source);assert.throws(()=>proof({ReaderPageScaffold:noClip}),/rows cannot paint/);
const noLane=mutatePageFrameCall(source,'ReaderPageScaffold','padding',(node,tree)=>node.expression.getText(tree)+'({bottom:0})',(node,tree)=>node.arguments[0]?.getText(tree).includes('bottom:'));assert.notEqual(noLane,source);assert.throws(()=>proof({ReaderPageScaffold:noLane}),/complete bottom safe area/);
const original=readFileSync(readerPageShellSourceUrl,'utf8');
const noPaint=mutatePageFrameCall(original,'ReaderFooterFrameModifier','backgroundColor',(node,tree)=>node.expression.expression.getText(tree));assert.notEqual(noPaint,original);assert.throws(()=>proof({},actualReaderPageShell(noPaint)),/footer lane paints/);
{
 const fixture=pageFrameSdkFixture(),owner=fixture.create('ReaderPageScaffold');let mounts=0;
 Object.assign(owner,{frameStyle:style(),geometry:geometry({}),content:()=>mounts++});owner.initialRender();const root=[...owner.nodes.values()].find(node=>node.type==='Stack'&&node.padding);
 owner.frameStyle=style({backgroundColor:'#FF314159'});fixture.properties.flush();assert.equal(root.backgroundColor,'#FF314159');
 owner.pageVisible=false;fixture.properties.flush();assert.equal(root.opacity,0);assert.equal(root.hitTestBehavior,'HitTestMode.Transparent');
 owner.pageVisible=true;fixture.properties.flush();assert.equal(root.opacity,1);assert.equal(root.hitTestBehavior,'HitTestMode.Default');assert.equal(mounts,1,'hidden retained reader preserves its business actor');
}

}

async function case_standard_page_layout() {

const { default: assert } = await import('node:assert/strict');
const { pageFrameSdkFixture } = await import('./lib/reader-page-frame-sdk-fixture.mjs');
const { actualReaderPageShell } = await import('./lib/reader-page-shell-runtime-probe.mjs');
const { createDefaultReaderWindowMetrics } = await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');
const policy = actualReaderPageShell();
const style = options => policy.readerFrameStyle({backgroundColor:'#FF102030',headerBackground:'#FF405060',footerBackground:'#FF708090',...options});
const geometry = options => { const input = new policy.ReaderPageGeometryInput(); Object.assign(input, options); return policy.resolveReaderPageGeometry(input); };

{
 const fixture=pageFrameSdkFixture(),owner=fixture.create('ReaderPageScaffold');let mounts=0;Object.assign(owner,{frameStyle:style({safeArea:'systemVertical'}),geometry:geometry({}),content:()=>mounts++});owner.initialRender();
 const root=[...owner.nodes.values()].find(node=>node.type==='Stack'&&node.padding);
 assert.deepEqual(root.expandSafeArea,[['SafeAreaType.SYSTEM'],['SafeAreaEdge.TOP','SafeAreaEdge.BOTTOM']]);assert.deepEqual(root.ignoreLayoutSafeArea,[[],[]]);
 owner.frameStyle=style({safeArea:'systemCutoutAll'});fixture.properties.flush();
 assert.deepEqual(root.expandSafeArea,[['SafeAreaType.SYSTEM','SafeAreaType.CUTOUT'],['SafeAreaEdge.TOP','SafeAreaEdge.BOTTOM','SafeAreaEdge.START','SafeAreaEdge.END']]);assert.deepEqual(root.ignoreLayoutSafeArea,[['LayoutSafeAreaType.SYSTEM'],['LayoutSafeAreaEdge.ALL']]);
 owner.frameStyle=style();fixture.properties.flush();assert.deepEqual(root.expandSafeArea,[[],[]]);assert.deepEqual(root.ignoreLayoutSafeArea,[[],[]]);assert.equal(mounts,1);
}
for(const variant of ['management','settings','rssManagement','rssEditor','rssFeed','rssDetail','tools','sync','sourceManagement','settingsHome','settingsGeneral']) {
 const metrics=createDefaultReaderWindowMetrics();Object.assign(metrics.windowRect,{width:393,height:852});metrics.systemInsets.top=32;metrics.cutoutInsets.top=40;metrics.systemInsets.left=24;metrics.cutoutInsets.right=30;
 const fixture=pageFrameSdkFixture({dependencies:{ReaderWindowCoordinator:{metrics:()=>metrics}}}),owner=fixture.create('ReaderStandardPage');let mounts=0;
 Object.assign(owner,{variant,content:()=>mounts++});owner.initialRender();
 const body=()=>fixture.nodes(owner).find(node=>node.type==='Column'&&node.padding?.left!==undefined),scroll=()=>fixture.nodes(owner).find(node=>node.type==='Column'&&node.padding?.top!==undefined);
 assert.deepEqual([body().padding.left,body().padding.right],[24,30],'actual standard page uses the maximum of visual-safe sides and shared horizontal gap once');
 assert.equal(scroll().padding.top,66,'system top is already consumed by the route parent');assert.equal(mounts,1);
 const measured=fixture.nodes(owner).find(node=>node.type==='Column'&&node.zIndex===10&&node.onAreaChange);assert.ok(measured,'actual StandardPage -> Scaffold -> HeaderHost delegation');
 measured.onAreaChange({}, {height:'93vp'});fixture.properties.flush();assert.equal(scroll().padding.top,101);assert.equal(mounts,1,'measured chrome does not remount the business body');
 const outer=[...owner.nodes.values()].find(node=>node.type==='__Common__'&&node.onAreaChange);assert.ok(outer);
 outer.onAreaChange({}, {width:'365vp',height:852});fixture.properties.flush();assert.equal(owner.viewportWidth,365);
 assert.equal(365-body().padding.left-body().padding.right,311,'measured host width flows through the actual horizontal geometry');assert.equal(mounts,1);
 measured.onAreaChange({}, {height:-1});fixture.properties.flush();assert.equal(scroll().padding.top,101);
}
assert.throws(()=>policy.readerStandardPageSpec('private99'),/Unknown|unknown/);

}

async function case_framework_route_coverage() {
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
const { createReaderComponentProbe } = await import('./lib/reader-component-probe.mjs');
const { verifyReaderPageFrameworkCoverage } = await import('./lib/reader-page-framework-coverage.mjs');
const { ts, options } = installedEtsCompiler();
const contract=JSON.parse(readFileSync('tools/fixtures/reader-page-framework-coverage.json','utf8'));
const source=file=>readFileSync(`entry/src/main/ets/${file}`,'utf8'),indexSource=source('pages/Index.ets');
const parse=(text,file='pages/Index.ets')=>{const tree=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);assert.deepEqual(tree.parseDiagnostics,[],'mutation/equivalent source is valid SDK syntax');return tree;};
const all=(tree,predicate)=>{const found=[];const visit=node=>{if(predicate(node))found.push(node);ts.forEachChild(node,visit);};visit(tree);return found;};
const call=(tree,name,predicate=()=>true)=>{const found=all(tree,node=>(ts.isCallExpression(node)||ts.isEtsComponentExpression(node))&&ts.isIdentifier(node.expression)&&node.expression.text===name&&predicate(node));assert.equal(found.length,1,'one actual mutation target '+name);return found[0];};
const statement=node=>{while(node&&!ts.isExpressionStatement(node))node=node.parent;assert.ok(node);return node;};
const member=node=>{while(node&&!ts.isMethodDeclaration(node))node=node.parent;assert.ok(node);return node;};
const rootNotice=(node,ast)=>node.arguments[0]?.properties.some(prop=>prop.name?.getText(ast)==='view'&&prop.initializer?.getText(ast)==='this.indexRecoveryNotice');
const edit=(text,node,replacement,tree)=>text.slice(0,node.getStart(tree))+replacement+text.slice(node.end);
const insert=(text,node,value,tree)=>text.slice(0,node.getStart(tree))+value+text.slice(node.getStart(tree));
const verify=(changed=indexSource,file='pages/Index.ets')=>{parse(changed,file);return verifyReaderPageFrameworkCoverage(process.cwd(),contract,path=>path===file?changed:source(path));};
const coverage=verify();assert.equal(coverage.routes,contract.routes.length);
// Private Builder delegation/names, condition ordering and parenthesization
// have no role in the page registration. The real original owner edges remain.
const renamed=indexSource.replaceAll('indexContent','equivalentPageCanvas').replaceAll('syncPreparingContent','equivalentColdContent')
 .replace("this.route === 'bookshelf' || this.route === 'search' || this.retainsShelfOpeningBackground()", "this.retainsShelfOpeningBackground() || ('search' === this.route) || ('bookshelf' === this.route)")
 .replace('this.readingSessionActive && this.detailBook !== undefined','this.detailBook !== undefined && (this.readingSessionActive)');
assert.notEqual(renamed,indexSource);verify(renamed);
const delegated=indexSource.replace('contentKind: this.readingContentKind,','contentKind: this.equivalentReadingKind(this.readingContentKind),')
 .replace('  private syncPreparingFrameStyle()', '  private equivalentReadingKind(value: \'text\' | \'manga\'): \'text\' | \'manga\' { return value; }\n\n  private syncPreparingFrameStyle()');
assert.notEqual(delegated,indexSource);verify(delegated);
const tree=parse(indexSource),full=call(tree,'ReaderFullDirectory'),reader=call(tree,'ReaderShell'),cold=call(tree,'ReaderPageScaffold');
const preview=call(tree,'BookDirectoryPage',node=>node.arguments[0].properties.some(prop=>prop.name?.getText(tree)==='currentChapterIndex'&&prop.initializer?.getText(tree)==='-1'));
let retainedIf=reader;while(retainedIf&&!ts.isIfStatement(retainedIf))retainedIf=retainedIf.parent;assert.ok(retainedIf);
const coldSlot=cold.arguments[0].properties.find(prop=>prop.name?.getText(tree)==='content').initializer.body;
const negatives=[
 ['bare catalog sibling',insert(indexSource,statement(full),"Column() { Text('unregistered catalog'); }\n",tree)],
 ['unknown catalog actor',insert(indexSource,statement(full),'UnregisteredCatalogPage({});\n',tree)],
 ['retained reader sibling',insert(indexSource,statement(reader),"Text('unregistered retained reader');\n",tree)],
 ['unregistered side page',insert(indexSource,retainedIf,"if (this.privateCatalogVisible) { Text('unregistered side page'); }\n",tree)],
 ['manga preview sibling',insert(indexSource,statement(preview),"Text('unregistered manga preview');\n",tree)],
 ['cold sync missing frame',edit(indexSource,cold,coldSlot.statements[0].expression.getText(tree),tree)],
 ['modal cannot hide bare page',insert(indexSource,statement(full),"ReaderDialogSurface({}); Text('unregistered modal sibling');\n",tree)],
];
for(const [name,changed]of negatives)assert.throws(()=>verify(changed),/category\/common-host|actual page route|registered page/,name);
const kind=reader.arguments[0].properties.find(prop=>prop.name?.getText(tree)==='contentKind').initializer;
assert.throws(()=>verify(edit(indexSource,kind,"'text'",tree)),/page\/runtime input/,'manga/text owner fact cannot be replaced with a constant');
const file='features/bookshelf/BookshelfManagementPage.ets',original=source(file),pageTree=parse(original,file),host=call(pageTree,'ReaderStandardPage');
assert.throws(()=>verify(edit(original,host.expression,'PrivatePageHost',pageTree),file),/category\/common-host/,'local page cannot revert to a private frame');
const header=host.arguments[0].properties.find(prop=>prop.name?.getText(pageTree)==='header').initializer.body;
assert.throws(()=>verify(edit(original,header,"{ PageBackBar({ title: '管理' }); }",pageTree),file),/bare UI component inside shared BuilderParam/);
const type=tree.statements.find(node=>ts.isTypeAliasDeclaration(node)&&node.name.text==='ReaderRoute');
assert.throws(()=>verify(edit(indexSource,type.type,"'privateUnregisteredPage' | "+type.type.getText(tree),tree)),/every actual route requires exactly one/);

// Actual SDK execution owns visibility/captured-generation evidence. It does
// not freeze a condition's spelling or treat static graph reachability as UI.
function quietProof(text=indexSource){
 const ast=parse(text),notice=call(ast,'ReaderRecoveryNotice',node=>rootNotice(node,ast)),builder=member(notice).name.getText(ast);
 class Notice{constructor(owner,params,_storage,id){Object.assign(this,{owner,params,id});}updateStateVars(params){Object.assign(this.params,params);}}
 for(const visible of[false,true])for(const current of[false,true])for(const pending of[false,true]){
  const {owner}=createReaderComponentProbe(text,[builder],{ReaderRecoveryNotice:Notice},
    {childSources:{ReaderRecoveryNotice:source('features/common/ReaderRecoveryNotice.ets')}});
  const tickets=[];let detailDelegations=0;Object.assign(owner,{indexRecoveryNotice:{message:'original fact',visible,generation:7},
   indexRecoveryActionLabel:'继续',indexRecoveryCurrent:()=>current,detailPendingNoticeVisible:()=>pending,
   indexRecoveryRevision:19,messageSafeTop:()=>0,detailOperationNoticeContent:()=>detailDelegations++,runIndexRecoveryAction:ticket=>tickets.push(ticket)});
  owner[builder]();const children=[...owner.children.values()].filter(child=>child instanceof Notice);
  assert.equal(children.length,visible&&current?1:0,'quiet feedback actual visibility/owner admission');
  assert.equal(detailDelegations,pending?1:0,'separate pending shelf facts keep their original delegated Builder');
  const column=[...owner.nodes.values()].find(node=>node.type==='Column');
  assert.equal(Boolean(column),Boolean(visible&&current||pending),'quiet feedback actual root visibility/owner admission');
  if(column){
   assert.equal(column.height,undefined,'quiet feedback intrinsic height');assert.equal(column.hitTestBehavior,'HitTestMode.Transparent','quiet feedback preserves page input');
  }
  if(children.length){
   children[0].params.onReconcile(999);assert.deepEqual(tickets,[7],'quiet feedback closure captures its original generation, not current ticket or child input');
  }
 }
}
quietProof();quietProof(indexSource.replace('(this.indexRecoveryNotice.visible && this.indexRecoveryCurrent?.() === true)', '(this.indexRecoveryCurrent?.() === true && this.indexRecoveryNotice.visible)'));
const notice=call(tree,'ReaderRecoveryNotice',node=>rootNotice(node,tree));
const quietIf=member(notice).body.statements.find(ts.isIfStatement);assert.ok(quietIf);
const quietStatement=quietIf.thenStatement.statements[0];
const height=indexSource.slice(0,quietStatement.expression.end)+".height('100%')"+indexSource.slice(quietStatement.expression.end);
assert.throws(()=>verify(height),/quiet feedback/);assert.throws(()=>quietProof(height),/intrinsic height/);
const hit=all(quietStatement,node=>ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text==='hitTestBehavior');assert.equal(hit.length,1);
const mask=edit(indexSource,hit[0].arguments[0],'HitTestMode.Block',tree);assert.throws(()=>verify(mask),/quiet feedback/);assert.throws(()=>quietProof(mask),/preserves page input/);
const missingAdmission=edit(indexSource,quietIf.expression,quietIf.expression.getText(tree).replace('this.indexRecoveryNotice.visible && this.indexRecoveryCurrent?.() === true','this.indexRecoveryNotice.visible'),tree);assert.notEqual(missingAdmission,indexSource);assert.throws(()=>quietProof(missingAdmission),/visibility\/owner admission/);
const borrowed=indexSource.replace('this.runIndexRecoveryAction(generation)','this.runIndexRecoveryAction(this.indexRecoveryRevision)');assert.notEqual(borrowed,indexSource);assert.throws(()=>quietProof(borrowed),/original generation/);
}

async function case_directory_layout_succession() {
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
const { verifyFullDirectoryLayoutSuccession } = await import('./lib/reader-full-directory-layout-successor.mjs');
const { fullDirectorySdkFixture } = await import('./lib/reader-full-directory-sdk-fixture.mjs');
const { ts, options }=installedEtsCompiler();
const read=file=>readFileSync(file,'utf8'),baseline=JSON.parse(read('tools/architecture-consumer-baseline.json'));
const file='entry/src/main/ets/features/reading/ReaderFullDirectory.ets',original=read(file);
const verify=(source=original,fullMatrix=false)=>verifyFullDirectoryLayoutSuccession(baseline,path=>path===file?source:read(path),undefined,undefined,{executeConsumer:true,fullMatrix,fixtureFactory:fullDirectorySdkFixture});
const parse=text=>{const tree=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);assert.deepEqual(tree.parseDiagnostics,[]);return tree;};
const all=(node,predicate)=>{const rows=[];const walk=n=>{if(predicate(n))rows.push(n);ts.forEachChild(n,walk);};walk(node);return rows;};
const one=(node,predicate,label)=>{const rows=all(node,predicate);assert.equal(rows.length,1,'one actual mutation target '+label);return rows[0];};
const componentCall=(node,name)=>(ts.isCallExpression(node)||ts.isEtsComponentExpression(node))&&ts.isIdentifier(node.expression)&&node.expression.text===name;
const edit=(text,node,value,tree)=>text.slice(0,node.getStart(tree))+value+text.slice(node.end);
const statement=node=>{while(node&&!ts.isExpressionStatement(node))node=node.parent;assert.ok(node);return node;};
const member=node=>{while(node&&!ts.isMethodDeclaration(node))node=node.parent;assert.ok(node);return node;};
verify(original,true);
// Current behavior does not depend on the old private Builder names, order of
// the two recovery conditions, literal-vs-role font spelling, or callback names.
let equivalent=original;
for(const [from,to]of [['topBar','equivalentHeader'],['directoryContent','equivalentBody'],['directoryOverlay','equivalentOverlay'],['recoveryContent','equivalentRecovery'],['topBarTop','equivalentHeaderTop']])equivalent=equivalent.replace(new RegExp('\\b'+from+'\\b','g'),to);
equivalent=equivalent.replace('this.directoryRecovery.bookmarks.visible || this.directoryRecovery.offline.visible','this.directoryRecovery.offline.visible || (this.directoryRecovery.bookmarks.visible)')
 .replace('TYPE_READER_DIRECTORY_BOOK_TITLE.fontSizeFp','16');
const equivalentTree=parse(equivalent),equivalentHost=one(equivalentTree,node=>componentCall(node,'ReaderPageScaffold'),'equivalent frame');
const equivalentReceipt=equivalentHost.arguments[0].properties.find(prop=>prop.name.getText(equivalentTree)==='onHeaderHeightChange').initializer;
let equivalentReceiptText=equivalentReceipt.getText(equivalentTree);
for(const [index,name]of ['measuredHeight','layoutTicket'].entries())equivalentReceiptText=equivalentReceiptText.replace(new RegExp('\\b'+equivalentReceipt.parameters[index].name.getText(equivalentTree)+'\\b','g'),name);
equivalent=edit(equivalent,equivalentReceipt,equivalentReceiptText,equivalentTree);
assert.notEqual(equivalent,original);verify(equivalent,true);
const tree=parse(original),host=one(tree,n=>componentCall(n,'ReaderPageScaffold'),'public frame'),props=new Map(host.arguments[0].properties.map(p=>[p.name.getText(tree),p.initializer]));
const panel=one(tree,n=>componentCall(n,'FullDirectoryPanel'),'directory panel'),panelProps=new Map(panel.arguments[0].properties.map(p=>[p.name.getText(tree),p.initializer]));
const recovery=one(tree,n=>componentCall(n,'ReaderDirectoryRecoverySurface'),'recovery leaf'),recoveryProps=new Map(recovery.arguments[0].properties.map(p=>[p.name.getText(tree),p.initializer]));
const recoveryMethod=member(recovery),headerTopIf=one(tree,n=>ts.isIfStatement(n)&&ts.isBinaryExpression(n.expression)&&n.expression.left.getText(tree)==='this.catalogContext','context-specific top'),headerTop=member(headerTopIf);
const pendingCall=one(tree,n=>ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&n.expression.name.text==='hitTestBehavior','pending native input port');
const pendingStatement=statement(pendingCall),pendingHeight=original.slice(0,pendingStatement.expression.end)+'.height(999)'+original.slice(pendingStatement.expression.end);
const clip=one(tree,n=>ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&n.expression.name.text==='clip','bounded viewport clip');
const viewport=all(tree,n=>ts.isEtsComponentExpression(n)&&n.expression.getText(tree)==='Stack'&&all(n,m=>componentCall(m,'FullDirectoryPanel')).length).sort((a,b)=>(a.end-a.pos)-(b.end-b.pos))[0];assert.ok(viewport);
const viewportStatement=statement(viewport),viewportHeight=one(viewportStatement,n=>ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&n.expression.name.text==='height','viewport height');
const opacity=one(viewportStatement,n=>ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&n.expression.name.text==='opacity','native panel opacity');
const headerCallback=props.get('onHeaderHeightChange'),heightName=headerCallback.parameters[0].name.getText(tree),guard=headerCallback.body.statements.find(ts.isIfStatement);assert.ok(guard);
const generationRead=one(tree,n=>ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&n.expression.name.text==='readForGeneration','native measurement store');
const fontStatement=statement(one(tree,n=>componentCall(n,'Text')&&n.arguments[0]?.getText(tree)==='this.bookTitle','approved title'));
const font=one(fontStatement,n=>ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)&&n.expression.name.text==='fontSize','approved title size');
const unbound=one(headerTop,n=>ts.isIfStatement(n)&&n.expression.getText(tree).includes('readerWindowMetricsRevision'),'unbound metric fallback');
const lastReturn=headerTop.body.statements.at(-1);assert.ok(ts.isReturnStatement(lastReturn));
const negatives=[
 ['missing header',edit(original,props.get('header'),'(): void => {}',tree)],
 ['missing body',edit(original,props.get('content'),'(): void => {}',tree)],
 ['missing recovery overlay',edit(original,props.get('overlayContent'),'(): void => {}',tree)],
 ['extra pending text',original.slice(0,recoveryMethod.body.end-1)+"Text('unregistered pending actor');"+original.slice(recoveryMethod.body.end-1)],
 ['recovery callback alias',edit(original,recoveryProps.get('onReconcileBookmarks'),'this.onContinueBookmarks',tree)],
 ['full height pending mask',pendingHeight],
 ['pending input blocker',edit(original,pendingCall.arguments[0],'HitTestMode.Block',tree)],
 ['unclipped native rows',edit(original,clip.arguments[0],'false',tree)],
 ['truncated native viewport',edit(original,viewportHeight.arguments[0],viewportHeight.arguments[0].getText(tree)+' - 100',tree)],
 ['lost animation pose',edit(original,opacity.arguments[0],'1',tree)],
 ['lost detail unknown-anchor admission',edit(original,panelProps.get('allowUnanchoredBrowse'),'false',tree)],
 ['detail double-charged safe top',edit(original,headerTopIf.expression,'false',tree)],
 ['reader omitted safe top',edit(original,lastReturn.expression,'18',tree)],
 ['missing unbound minimum',edit(original,unbound.expression,'false',tree)],
 ['missing parent generation fence',edit(original,guard.expression,'!this.mounted || '+heightName+' <= 0',tree)],
 ['missing measured-generation lookup',edit(original,generationRead.expression.name,'read',tree)],
 ['constant native generation',edit(original,props.get('headerMeasurementKey'),'0',tree)],
 ['changed approved title size',edit(original,font.arguments[0],'99',tree)],
];
for(const [name,changed]of negatives){assert.notEqual(changed,original,name);assert.throws(()=>verify(changed),undefined,name);}
}

async function case_sync_cold_layout() {
const { createIndexProductBuilderProbe } = await import('./lib/reader-extended-product-surface-probe.mjs');
const { default: assert } = await import('node:assert/strict');
const { readFileSync } = await import('node:fs');
const { pageFrameSdkFixture } = await import('./lib/reader-page-frame-sdk-fixture.mjs');
const { verifyIndexSyncColdLayoutSuccession } = await import('./lib/index-sync-cold-layout-successor.mjs');
const { readerAppColor } = await import('../entry/src/main/ets/features/common/ReaderThemeRegistry.ts');
const { createDefaultReaderWindowMetrics, readerContentSafeTop } = await import('../entry/src/main/ets/features/common/ReaderWindowMetrics.ts');

const source=file=>readFileSync(`entry/src/main/ets/${file}`,'utf8');const indexSource=source('pages/Index.ets');const readWorkspace=file=>readFileSync(file,'utf8');const architectureBaseline=JSON.parse(readWorkspace('tools/architecture-consumer-baseline.json'));
const succession=verifyIndexSyncColdLayoutSuccession(architectureBaseline, readWorkspace);
const verifyChanged=changed=>verifyIndexSyncColdLayoutSuccession(architectureBaseline,
  file=>file==='entry/src/main/ets/pages/Index.ets'?changed:readWorkspace(file));
const renamed=indexSource.replaceAll(succession.coldContentMethod,'equivalentColdActor')
  .replace('if (this.syncUi().syncSnapshotReady)', 'if (this.syncUi().syncSnapshotReady === true)');
assert.notEqual(renamed,indexSource);verifyChanged(renamed);
for (const [before, after] of [
  ['content: (): void => { this.syncPreparingContent(); }', 'content: (): void => {}'],
  ["Text('正在读取安全配置…');", "Text('正在读取安全配置…').fontSize(99);"],
  ["}.width('100%').height('100%').justifyContent(FlexAlign.Center);", "}.width('100%').height('100%').justifyContent(FlexAlign.Center).backgroundColor('#FF010203');"],
]) {
  const changed = indexSource.replace(before, after); assert.notEqual(changed, indexSource);
  assert.throws(() => verifyChanged(changed));
}
// The actual route owner supplies the visual facts. Keep other branches finite
// and inert, while the shipping Scaffold and cold slot run through the SDK.
for (const [testedSource,proof] of [[indexSource,succession],[renamed,verifyChanged(renamed)]]) for (const ready of [false, true]) {
  const frameFixture = pageFrameSdkFixture();
  class OtherActor { constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); this.nodes = new Map(); this.children = new Map(); } }
  const components = { BookshelfMultiSelectPage: 'features/bookshelf/BookshelfMultiSelectPage.ets', ReaderShell: 'features/shell/ReaderShell.ets',
    SyncPage: 'features/sync/SyncPage.ets', ReaderLayoutDebugOverlay: 'features/common/ReaderLayoutDebugOverlay.ets',
    ReaderTransientToast: 'features/common/ReaderTransientToast.ets', ArkWebExecutionHost: 'app/ArkWebExecutionHost.ets' };
  const metrics = createDefaultReaderWindowMetrics();
  const { owner } = createIndexProductBuilderProbe(testedSource,
    ['syncUi','syncProduct','appThemeScheme','expandedLayout',proof.routeMethod,'syncContent','syncSurface',proof.coldContentMethod,
     'syncPreparingFrameStyle','readerOwnsWindowEdges','mangaOwnsWindowEdges','appContentTopInset'],
    { ...frameFixture.deps, ...Object.fromEntries(Object.keys(components).map(name => [name, OtherActor])),
      ReaderWindowCoordinator: { metrics: () => metrics }, readerContentSafeTop, isReaderProductSurfaceEnabled: () => true },
    { ...frameFixture.hooks, childSources: { ...frameFixture.hooks.childSources,
      ...Object.fromEntries(Object.entries(components).map(([name, file]) => [name, source(file)])) } });
  Object.assign(owner, {route: 'sync',navigationGeneration: 7,detailShelfAdmissionMount: 3,syncPresentationIdentity: 'sync-window',
    getSyncOrchestrator: () => ({}),readingSessionActive: false,jsonImportVisible: false,appThemeScheme: 'day',readerWindowMetricsRevision: -1,
    syncProduct:{syncSnapshotReady: ready,syncSnapshot: {}},retainsShelfOpeningBackground:()=>false,indexRecoveryNoticeContent:()=>{}});
  owner[proof.routeMethod]();
  const actors = frameFixture.walk(owner);
  const frames = actors.filter(actor => actor instanceof frameFixture.deps.ReaderPageScaffold);
  if (ready) {
    const sync = actors.find(actor => actor.params && Object.hasOwn(actor.params,'snapshot'));
    if(sync)assert.deepEqual(sync.params.snapshot,owner.syncProduct.syncSnapshot,'real Prop keeps presentation values across the composition copy');
    assert.ok(sync, 'actual ready branch still mounts the original SyncPage with its current snapshot');
    assert.equal(frames.length, 0, 'cold frame cannot cover the ready branch');
  } else {
    assert.equal(frames.length,1,'actual cold branch owns one common frame');const frame=frames[0];
    const label = frameFixture.nodes(owner).find(node => node.type === 'Text' && node.create === '正在读取安全配置…'); assert.ok(label);
    const column = [...owner.nodes.values()].find(node => node.type === 'Column' && node.justifyContent === 'FlexAlign.Center');
    assert.deepEqual([column.width, column.height], ['100%', '100%']);
    assert.equal(column.backgroundColor, undefined); assert.equal(label.fontSize, undefined, 'original native AUTO survives the real cold slot');
    const root = [...frame.nodes.values()].find(node => node.type === 'Stack' && node.padding);
    for (const scheme of ['day', 'night']) {
      owner.appThemeScheme = scheme; frameFixture.properties.flush();
      assert.equal(root.backgroundColor, readerAppColor('TOK_PAPER', scheme),'parent-owned style updates the same real scaffold');
    }
  }
}

}

const implementations = {'sdk-public-slots':case_sdk_public_slots,'header-paint-owner':case_header_paint_owner,'scaffold-slots':case_scaffold_slots,'footer-safe-lane':case_footer_safe_lane,'standard-page-layout':case_standard_page_layout,'framework-route-coverage':case_framework_route_coverage,'directory-layout-succession':case_directory_layout_succession,'sync-cold-layout':case_sync_cold_layout};
for (const id of selectContractCases(CONTRACT_CASES)) {
  await implementations[id]();
  recordContractCasePass(id);
}
