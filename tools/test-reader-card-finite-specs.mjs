import { resolveEtsLoaderRoot, virtualFilePath } from './lib/tool-environment.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { cardSdk } from './lib/reader-card-probe.mjs';
import { boundedMembers } from './lib/bounded-surface-sdk-probe.mjs';
import { syncIndexFixture } from './lib/sync-index-real-fixture.mjs';
import { readerAppColor } from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import { readerFoundationTokens } from './lib/reader-foundation-control-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import * as metricsApi from '../entry/src/main/ets/features/common/ReaderWindowMetrics.ts';
import * as fontFamilies from '../entry/src/main/ets/features/common/ReaderFontFamilies.ts';

const read=file=>readFileSync(file,'utf8'),golden=JSON.parse(read('tools/fixtures/reader-card-ui-baseline.json'));
for(const entry of Object.values(golden.sources))assert.equal(createHash('sha256').update(entry.source).digest('hex'),entry.sha256,'frozen actual original source bytes');
const common='entry/src/main/ets/features/common/',category='entry/src/main/ets/features/settings/CategorySection.ets',sync='entry/src/main/ets/features/sync/SyncPage.ets';
const before=golden.sources[common+'ReaderCard.ets'].source;
const sdk=resolveEtsLoaderRoot();
const require=createRequire(import.meta.url),ts=require(sdk+'/node_modules/typescript'),options=require(sdk+'/lib/ets_checker.js').compilerOptions;
const digest=value=>createHash('sha256').update(value).digest('hex');
const layout=JSON.parse(read('tools/fixtures/reader-card-page-layout-successor-20261014.json'));
assert.equal(layout.schema,1);assert.equal(layout.page,sync);
assert.equal(layout.previousFixture,'tools/fixtures/reader-card-ui-baseline.json');
assert.equal(digest(read(layout.previousFixture)),layout.previousFixtureSha256,'layout successor cannot rewrite the frozen Card/body witness');
assert.equal(golden.sources[sync].sha256,layout.previousPageSha256);
assert.deepEqual(layout.previousLayoutMethods,['build','contentFrame','bottomContentInset']);
assert.deepEqual(Object.keys(layout.currentLayoutMethods),['build','pageContent','contentFrame']);
assert.deepEqual([layout.host,layout.variant,layout.slots],['ReaderStandardPage','sync',{header:'backBar',content:'pageContent'}]);
assert.deepEqual(layout.sections,['webdavSection','manualActionsSection','autoBackupSection','historySection']);
const parse=text=>ts.createSourceFile(virtualFilePath('CardConsumer.ets'),text,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
function sdkOwner(source){const tree=parse(source);assert.deepEqual(tree.parseDiagnostics,[]);return{tree,owner:tree.statements.find(ts.isStructDeclaration)};}
function calls(node,tree,name){const found=[];const visit=current=>{if((ts.isCallExpression(current)||ts.isEtsComponentExpression(current))&&current.expression.getText(tree)===name)found.push(current);ts.forEachChild(current,visit);};visit(node);return found;}
function proveSyncLayout(source){
 const current=sdkOwner(source),previous=sdkOwner(golden.sources[sync].source);
 const method=(value,name)=>{const node=value.owner.members.find(member=>ts.isMethodDeclaration(member)&&member.name.getText(value.tree)===name);assert.ok(node,'actual registered layout method: '+name);return node;};
 const printer=ts.createPrinter({removeComments:true});
 for(const[name,sha]of Object.entries(layout.currentLayoutMethods))assert.equal(digest(printer.printNode(ts.EmitHint.Unspecified,method(current,name),current.tree)),sha,'one exact finite Card layout successor: '+name);
 assert.equal(current.owner.members.some(member=>member.name?.getText(current.tree)==='bottomContentInset'),false,'shared Scroll owns the obsolete local bottom helper');
 const build=method(current,'build'),hosts=calls(build,current.tree,layout.host);assert.equal(hosts.length,1);
 const props=hosts[0].arguments[0];assert.ok(ts.isObjectLiteralExpression(props));
 const field=name=>props.properties.find(property=>property.name?.getText(current.tree)===name)?.initializer;
 assert.equal(field('variant')?.getText(current.tree),"'sync'");
 for(const[slot,builder]of Object.entries(layout.slots)){
  assert.ok(ts.isArrowFunction(field(slot)),'real finite Card layout BuilderParam '+slot);
  assert.equal(calls(field(slot),current.tree,'this.'+builder).length,1,'real shared Card slot calls '+builder);
 }
 const sections=(node,tree)=>{
  const list=[];const visit=current=>{if(ts.isCallExpression(current)&&layout.sections.some(name=>current.expression.getText(tree)==='this.'+name))list.push(current.expression.name.text);ts.forEachChild(current,visit);};visit(node);return list;
 };
 assert.deepEqual(sections(method(previous,'build'),previous.tree),layout.sections,'original body section identity and ordering');
 assert.deepEqual(sections(method(current,'pageContent'),current.tree),layout.sections,'same body sections move once into the actual shared content slot');
 const measured=source.match(/\.onAreaChange\([\s\S]*?\n      \}\);/);assert.ok(measured,'the original page width publication is retained');
 const oldMeasured=golden.sources[sync].source.match(/\.onAreaChange\([\s\S]*?\n    \}\);/);assert.ok(oldMeasured);
 assert.equal(measured[0].replace(/\s/g,''),oldMeasured[0].replace(/\s/g,''),'same width publication callback and state admission');
}
function bodiesWithoutCardInputs(source){
 const parse=text=>ts.createSourceFile(virtualFilePath('CardConsumer.ets'),text,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options),tree=parse(source),inputs=[];
 assert.equal(tree.parseDiagnostics.length,0);
 const visit=node=>{if(ts.isEtsComponentExpression(node)&&node.expression.getText(tree)==='ReaderCard')inputs.push(node.arguments[0]);ts.forEachChild(node,visit);};visit(tree);
 for(const input of inputs.reverse())source=source.slice(0,input.getStart(tree))+'{}'+source.slice(input.end);
 const normalized=parse(source),owner=normalized.statements.find(ts.isStructDeclaration),printer=ts.createPrinter({removeComments:true});
 return Object.fromEntries(owner.members.filter(ts.isMethodDeclaration).map(member=>[member.name.getText(normalized),printer.printNode(ts.EmitHint.Unspecified,member,normalized)]));
}
function compareBodies(file,source=read(file)){
 const actual=bodiesWithoutCardInputs(source),expected=bodiesWithoutCardInputs(golden.sources[file].source);
 if(file===sync){proveSyncLayout(source);for(const name of Object.keys(layout.currentLayoutMethods))delete actual[name];for(const name of layout.previousLayoutMethods)delete expected[name];}
 assert.deepEqual(actual,expected,'all actual body/state/callback methods unchanged except finite Card inputs and one proved layout successor: '+file);
}
for(const file of[category,sync])compareBodies(file);
// Layout registration cannot admit a lost section, a detached public slot,
// changed frame policy or an unrelated callback/body mutation.
for(const[from,to]of[["variant: 'sync'","variant: 'settings'"],['this.pageContent();','this.webdavSection();'],['this.autoBackupSection();','']]){
 const changed=read(sync).replace(from,to);assert.notEqual(changed,read(sync));assert.throws(()=>compareBodies(sync,changed));
}
assert.throws(()=>compareBodies(sync,read(sync).replace("return this.snapshot.facts?.canMutate ?? true;","return true;")),'unchanged body and callback contract is still strict');

const originalSpec=read(common+'ReaderCardSpecs.ets');
const methods=['webdavSection','manualActionsSection','autoBackupSection','emptyState','historyRow'];
const entry={destination:'WebDAV',timestamp:'2026-10-04 08:00',summary:'原始备份结果',status:'success',detail:'保持原始信息',bookCount:2,sourceCount:3};
const geometry=syncIndexFixture.execute('features/common/SurfaceHorizontalGeometry.ts','({SurfaceWidthSpec,SurfaceHorizontalFrame,resolveHorizontalFrame})');
function parent({legacy=false,method='build',scheme='day',width=352,specSource=originalSpec}={}){
 const shared=cardSdk({source:legacy?before:read(common+'ReaderCard.ets'),specSource,scheme});
 let owner,contentCalls=0,backupCalls=0;
 if(method==='build'){
  const source=legacy?golden.sources[category].source:read(category);
  owner=shared.consumer(source,boundedMembers(source));
  Object.assign(owner,{title:'真实分类标题',cardWidth:width,appThemeScheme:scheme,content:()=>{contentCalls++;}});
  owner.initialRender();
 }else{
  const source=legacy?golden.sources[sync].source:read(sync);
  owner=shared.consumer(source,boundedMembers(source).filter(name=>!['build','backBar'].includes(name)),{...geometry,DEFAULT_SYNC_SNAPSHOT:syncIndexFixture.DEFAULT_SYNC_SNAPSHOT,readerRecoveryView:syncIndexFixture.readerRecoveryView,
   registerReaderFonts(){},ReaderWindowCoordinator:{metrics:()=>({windowRect:{width:390}})},readerVisualSafeLeft:()=>0,readerVisualSafeRight:()=>0,readerFloatingBarBottomInset:()=>18,READER_FLOATING_TOP_BAR_HEIGHT:56});
  Object.assign(owner,{appThemeScheme:scheme,contentFrame:()=>({width}),onTriggerBackup:()=>{backupCalls++;}});
  // Exercise the original production bodies, not a synthetic Card-only caller.
  if(method==='historyRow')owner.historyRow(entry);else owner[method]();
 }
 const cards=shared.cards(owner);assert.equal(cards.length,1,'one real production Card in '+method);
 const card=cards[0];if(card.appThemeScheme!==scheme){card.appThemeScheme=scheme;shared.properties.flush();}
 return {shared,owner,card,outer:()=>shared.outer(card),contentCalls:()=>contentCalls,backupCalls:()=>backupCalls};
}
const physical=node=>Object.fromEntries(['width','constraintSize','backgroundColor','border','borderRadius'].map(key=>[key,node[key]]));
let comparisons=0;
for(const method of ['build',...methods])for(const scheme of ['day','night'])for(const width of [0,152,352,800]){
 const old=parent({legacy:true,method,scheme,width}),current=parent({method,scheme,width});
 assert.deepEqual(physical(current.outer()),physical(old.outer()),`${method}/${scheme}/${width} exact original native Card tuple`);
 assert.deepEqual(current.card.attributeCalls.filter(call=>call.id===current.outer().id).map(({property,args})=>({property,args})),old.card.attributeCalls.filter(call=>call.id===old.outer().id).map(({property,args})=>({property,args})),`${method}/${scheme}/${width} exact native attribute calls, including omission presence`);
 assert.equal(current.outer().width,width>0?width:'100%');
 assert.equal(current.outer().constraintSize.maxWidth,readerFoundationTokens.TOK_CONTENT_MAX_W_TABLET);
 assert.equal(current.outer().border.width,readerFoundationTokens.TOK_BORDER_W);
 if(method==='build'){
  assert.equal(current.contentCalls(),1);assert.equal(old.contentCalls(),1,'actual original Builder slot');
  const label=current.shared.nodes(current.owner).find(n=>n.type==='Text'&&n.create==='真实分类标题');assert.ok(label,'real section heading remains mounted');
 }
 comparisons++;
}
// The new owner is a real SDK page composition, not a normalization of the
// old Stack into another local layout. Current page slots mount the original
// four Card sections inside one shared Scroll. Native height/host-width
// publications update clearance and real Card Props without rebuilding bodies.
for(const[scheme,windowWidth,hostWidth,left,right,bottom]of[
 ['day',365,365,24,30,34],['night',960,960,0,0,0],['day',960,365,0,0,34],
]){
 const shared=cardSdk({scheme}),metrics=new metricsApi.ReaderWindowMetricsSnapshot(new metricsApi.ReaderRectVp(0,0,windowWidth,900),
  undefined,new metricsApi.ReaderInsetsVp(left,47,right,bottom));
 const frameDeps={...metricsApi,...fontFamilies,ReaderWindowCoordinator:{metrics:()=>metrics}};
 const backSource=read(common+'PageBackBar.ets');shared.hooks.childSources.PageBackBar=backSource;
 shared.deps.PageBackBar=createReaderBuilderProbe(backSource,boundedMembers(backSource),{...shared.deps,...frameDeps},shared.hooks).Component;
 const owner=shared.consumer(read(sync),boundedMembers(read(sync)),{...frameDeps,DEFAULT_SYNC_SNAPSHOT:syncIndexFixture.DEFAULT_SYNC_SNAPSHOT,
  readerRecoveryView:syncIndexFixture.readerRecoveryView,registerReaderFonts(){}});
 Object.assign(owner,{appThemeScheme:scheme});owner.initialRender();
 const standard=shared.walk(owner).find(actor=>actor.variant==='sync');assert.ok(standard,'actual finite standard page actor');
 const scroll=[...standard.nodes.values()].find(node=>node.type==='Scroll');assert.ok(scroll);assert.equal(scroll.height,'100%');assert.equal(scroll.width,'100%');
 const body=[...standard.nodes.values()].find(node=>node.type==='Column'&&node.padding);assert.ok(body);assert.equal(body.padding.top,66,'shared header fallback plus gap; system top is already consumed by Index');
 const sectionCards=shared.cards(owner);assert.equal(sectionCards.length,4,'all four original sections mount once via the public body slot');
 const nativeCounts=sectionCards.map(card=>card.observers.length);
 const pageArea=[...owner.nodes.values()].find(node=>node.type==='__Common__'&&node.onAreaChange);assert.ok(pageArea);
 const sharedArea=[...standard.nodes.values()].find(node=>node.type==='__Common__'&&node.onAreaChange);assert.ok(sharedArea);
 const area={width:hostWidth+'vp',height:'900vp',globalPosition:{x:0,y:47}};
 pageArea.onAreaChange({},area);sharedArea.onAreaChange({},area);shared.properties.flush();
 const frame=owner.contentFrame();assert.equal(frame.width,Math.min(720,hostWidth-Math.max(19,left)-Math.max(19,right)));
 assert.deepEqual([body.padding.left,body.padding.right],[frame.left,frame.right],'actual shared Scroll and Card content use the same measured host geometry');
 assert.equal(body.padding.bottom,Math.max(18,bottom),'actual shared trailing clearance preserves the sync minimum and current safe bottom');
 for(const card of sectionCards)assert.equal(shared.outer(card).width,frame.width,'measured parent width reaches the original real Card Prop');
 const header=shared.walk(owner).find(actor=>typeof actor.onHeightChange==='function');assert.ok(header);
 const mask=[...header.nodes.values()].find(node=>node.backgroundColor!==undefined);assert.ok(mask);assert.equal(mask.backgroundColor,readerAppColor('TOK_SURFACE_SOLID',scheme));
 assert.equal(typeof mask.onAreaChange,'function');mask.onAreaChange({},{height:'93vp'});shared.properties.flush();assert.equal(body.padding.top,101,'actual vp measurement of the shared header clears the unchanged body');
 assert.deepEqual(shared.cards(owner),sectionCards,'shared measurement retains every original Card actor');
 assert.deepEqual(sectionCards.map(card=>card.observers.length),nativeCounts,'shared measurement retains Card body/native observers');
}
// The two semantic names resolve to the same object, not copies of a standard
// tuple. Changing that one actual shared source reaches both real consumers.
{
 const base=cardSdk();assert.equal(base.resolveReaderCardSpec('settings-category'),base.resolveReaderCardSpec('sync-config'));
 const changed=originalSpec.replace('radius: TOK_RADIUS_MD','radius: TOK_RADIUS_MD + 2');assert.notEqual(changed,originalSpec);
 const category=parent({specSource:changed}),configuration=parent({method:'webdavSection',specSource:changed}),status=parent({method:'manualActionsSection',specSource:changed});
 assert.equal(category.outer().borderRadius,10);assert.equal(configuration.outer().borderRadius,10);assert.equal(status.outer().borderRadius,13,'status variant isolated');
 const other=originalSpec.replace('radius: 13','radius: 15');assert.notEqual(other,originalSpec);
 for(const method of methods.slice(1))assert.equal(parent({method,specSource:other}).outer().borderRadius,15,'all four real status consumers share changed spec');
 assert.equal(parent({specSource:other}).outer().borderRadius,8);assert.equal(parent({method:'webdavSection',specSource:other}).outer().borderRadius,8);
}
// Retained V1 Props update the actual native Card without remounting its body;
// obsolete physical props have no setters and cannot alter the outer geometry.
{
 const p=parent(),body=p.contentCalls(),count=p.card.observers.length;
 p.card.updateStateVars({specId:'sync-status',cardWidth:280});p.shared.properties.flush();
 assert.equal(p.outer().borderRadius,13);assert.equal(p.outer().width,280);assert.equal(p.card.observers.length,count);assert.equal(p.contentCalls(),body);
 p.card.updateStateVars({specId:'settings-category',cardWidth:0});p.shared.properties.flush();assert.equal(p.outer().borderRadius,8);assert.equal(p.outer().width,'100%');
 p.card.radius=99;p.card.bg='private';p.card.cardBorder='private';p.card.replay();
 assert.equal(p.outer().borderRadius,8);assert.equal(p.outer().backgroundColor,readerAppColor('TOK_CARD_BG','day'));
 p.card.appThemeScheme='night';p.shared.properties.flush();assert.equal(p.outer().backgroundColor,readerAppColor('TOK_CARD_BG','night'));assert.equal(p.outer().border.color,readerAppColor('TOK_BORDER','night'),'actual retained StorageLink follows current theme');
 p.owner.cardWidth=318;p.shared.flush(p.owner);assert.equal(p.outer().width,318,'parent measurement reaches real child Prop');
 assert.equal(p.card.observers.length,count,'parent update retains one Card');
}
// A real business action still travels through the nested content slot to the
// shipping common Button, with current disabled and unmount admission intact.
{
 const p=parent({method:'emptyState'}),button=p.shared.walk(p.owner).find(owner=>owner.specId==='sync-empty-backup');assert.ok(button);
 const click=p.shared.nodes(p.owner).find(n=>n.onClick&&n.create==='立即备份');assert.ok(click);click.onClick();assert.equal(p.backupCalls(),1);
 button.updateStateVars(Object.assign(Object.fromEntries(['scheme','specId','label','primary','actionEnabled','layout','isBusy','availableWidth','actionAccessibilityLabel'].map(key=>[key,button[key]])),{actionEnabled:false}));p.shared.properties.flush();click.onClick();assert.equal(p.backupCalls(),1,'retained native action respects busy/disabled update');
 button.aboutToDisappear();click.onClick();assert.equal(p.backupCalls(),1,'old physical content action does not publish after unmount');
}
console.log(`PASS F08 actual installed-SDK Card: ${comparisons} original/current six-site day/night/width comparisons; one finite layout successor, three real shared-page slot/scroll/safe-geometry replays and vp measurements; real body/callbacks, retained Props, common propagation/variant isolation and removed free appearance setters. Native layout/device pixels remain separate.`);
