import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { cardSdk } from './lib/reader-card-probe.mjs';
import { boundedMembers } from './lib/bounded-surface-sdk-probe.mjs';
import { syncIndexFixture } from './lib/sync-index-real-fixture.mjs';
import { readerAppColor } from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import { readerFoundationTokens } from './lib/reader-foundation-control-probe.mjs';

const read=file=>readFileSync(file,'utf8'),golden=JSON.parse(read('tools/fixtures/reader-card-ui-baseline.json'));
for(const entry of Object.values(golden.sources))assert.equal(createHash('sha256').update(entry.source).digest('hex'),entry.sha256,'frozen actual original source bytes');
const common='entry/src/main/ets/features/common/',category='entry/src/main/ets/features/settings/CategorySection.ets',sync='entry/src/main/ets/features/sync/SyncPage.ets';
const before=golden.sources[common+'ReaderCard.ets'].source;
const sdk=process.env.READER_ETS_LOADER_ROOT??'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const require=createRequire(import.meta.url),ts=require(sdk+'/node_modules/typescript'),options=require(sdk+'/lib/ets_checker.js').compilerOptions;
function bodiesWithoutCardInputs(source){
 const parse=text=>ts.createSourceFile('/tmp/CardConsumer.ets',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options),tree=parse(source),inputs=[];
 assert.equal(tree.parseDiagnostics.length,0);
 const visit=node=>{if(ts.isEtsComponentExpression(node)&&node.expression.getText(tree)==='ReaderCard')inputs.push(node.arguments[0]);ts.forEachChild(node,visit);};visit(tree);
 for(const input of inputs.reverse())source=source.slice(0,input.getStart(tree))+'{}'+source.slice(input.end);
 const normalized=parse(source),owner=normalized.statements.find(ts.isStructDeclaration),printer=ts.createPrinter({removeComments:true});
 return Object.fromEntries(owner.members.filter(ts.isMethodDeclaration).map(member=>[member.name.getText(normalized),printer.printNode(ts.EmitHint.Unspecified,member,normalized)]));
}
for(const file of [category,sync])assert.deepEqual(bodiesWithoutCardInputs(read(file)),bodiesWithoutCardInputs(golden.sources[file].source),'all actual body/layout/state/callback methods unchanged except finite Card inputs: '+file);

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
console.log(`PASS F08 actual installed-SDK Card: ${comparisons} original/current six-site day/night/width comparisons; real body slots/callbacks, retained Props, common propagation/variant isolation and removed free appearance setters. Native layout/device pixels remain separate.`);
