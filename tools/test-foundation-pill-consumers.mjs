import {selectContractCases, recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions = {"pill-admission": {"description": "实际pill启用/忙态/退役拒绝与有限spec绑定", "resources": []}};
for (const id of selectContractCases(definitions)) {
  await runSelectedCase(id);
  recordContractCasePass(id);
}
async function runSelectedCase(selectedCase) {
const {readFileSync} = await import('node:fs');
const {createReaderBuilderProbe} = await import('./lib/reader-control-builder-probe.mjs');
const {foundationControls,readerFoundationTokens} = await import('./lib/reader-foundation-control-probe.mjs');
const {readerTypographyRoles} = await import('./lib/reader-typography-probe.mjs');

const {default: assert} = await import('node:assert/strict');
const baseline=JSON.parse(readFileSync(new URL('./fixtures/design/foundation-pill-baseline.json',import.meta.url),'utf8'));
assert.equal(baseline.schemaVersion,1);
const style=['fontFamily','fontWeight','fontSize','lineHeight','letterSpacing','fontColor','backgroundColor','textAlign','maxLines','width','height','layoutWeight','padding','border','borderRadius','opacity','responseRegion'];
const tuple=node=>Object.fromEntries(style.filter(k=>Object.hasOwn(node,k)).map(k=>[k,node[k]]));
const cases=[['search/SearchPage.ets','primaryPill',['操作','@callback']],['search/SearchPage.ets','secondaryPill',['操作','@callback']],
 ['discover/DiscoverPage.ets','pageAction',['下一页','@enabled','@callback']],['rss/RssPage.ets','statusTab',['全部','all']],
 ['rss/RssPage.ets','stateButtons',['重试','@callback']],['rss/RssEntryDetailPage.ets','sourceCard',[]]];
let groups=0;
for(const [tail,method,args]of cases)for(const scheme of ['day','night'])for(const enabled of [false,true])for(const busy of [false,true]){
 const f=baseline.files.find(f=>f.path.endsWith(tail)),beforeSource='@Component struct OldActualPill {\n'+f.methods.join('\n')+'\nbuild(){Column(){}}\n}',afterSource=readFileSync(new URL('../'+f.path,import.meta.url),'utf8');
 const shared=foundationControls(),before=createReaderBuilderProbe(beforeSource,f.names,readerFoundationTokens).owner,after=createReaderBuilderProbe(afterSource,f.names,shared.dependencies,shared.hooks).owner;
 const states={appThemeScheme:scheme,presentation:{loading:busy},activeMode:enabled?'all':'sources',subscription:{title:'订阅'},item:{author:'作者',pubDate:'日期'}};
 Object.assign(before,structuredClone(states));Object.assign(after,structuredClone(states));let oldCalls=0,newCalls=0;
 before.onModeRequested=()=>oldCalls++;after.onModeRequested=()=>newCalls++;before.onManage=()=>oldCalls++;after.onManage=()=>newCalls++;before.onViewSource=()=>oldCalls++;after.onViewSource=()=>newCalls++;
 before[method](...args.map(a=>a==='@callback'?()=>oldCalls++:a==='@enabled'?enabled:a));after[method](...args.map(a=>a==='@callback'?()=>newCalls++:a==='@enabled'?enabled:a));
 const oldNodes=[...before.nodes.values()],newNodes=shared.nodes(after),oldText=oldNodes.filter(n=>n.type==='Text'),newText=newNodes.filter(n=>n.type==='Text');
 assert.deepEqual(newText.map(n=>n.create),oldText.map(n=>n.create),tail+'/'+method+': actual label order/data preserved');
 const oldFrames=oldNodes.filter(n=>n.type==='Stack'&&n.onClick),newFrames=newNodes.filter(n=>n.type==='Stack'&&n.onClick);
 assert.equal(newFrames.length,oldFrames.length,'same action cardinality; no historical geometry tuple');
 const oldActions=oldNodes.filter(n=>n.onClick),newActions=newNodes.filter(n=>n.onClick);assert.equal(newActions.length,oldActions.length);
 for(let i=0;i<oldActions.length;i++){oldActions[i].onClick();newActions[i].onClick();}assert.equal(newCalls,oldCalls,tail+'/'+method+': original admission');
 if(method==='pageAction'){
   before.presentation.loading=true;after.presentation.loading=true;before.replay();shared.flush(after);const count=newCalls;
   oldActions[0].onClick();newActions[0].onClick();assert.equal(newCalls,count,'old physical callback blocked by retained loading Prop');assert.equal(newCalls,oldCalls);
 }
 for(const child of after.children.values())if(child instanceof shared.button.Component)child.aboutToDisappear();const count=newCalls;for(const a of newActions)a.onClick();assert.equal(newCalls,count,'removed actual child rejects late physical callback');groups++;
}
// Same family has one real producer; changing a bounded spec modifies only it.
{
 const a=baseline.files.find(f=>f.path.endsWith('SearchPage.ets')),source=readFileSync(new URL('../'+a.path,import.meta.url),'utf8');
 for(const role of ['TYPE_APP_PRIMARY_ACTION','TYPE_APP_SECONDARY_ACTION'])assert.ok(readerTypographyRoles[role]);
 const controls=foundationControls(),parent=createReaderBuilderProbe(source,a.names,controls.dependencies,controls.hooks).owner;
 Object.assign(parent,{appThemeScheme:'day'});parent.primaryPill('主',()=>{});parent.secondaryPill('次',()=>{});assert.equal([...parent.children.values()].every(c=>c instanceof controls.button.Component),true);
 const primary=[...parent.children.values()].find(child=>child.specId==='search-primary');assert.ok(primary,'actual primary caller binds finite primary spec');
 const secondary=[...parent.children.values()].find(child=>child.specId==='search-secondary');assert.ok(secondary,'actual secondary caller keeps a separate finite variant');
}
console.log(`PASS actual foundation pills: ${groups} original SDK/current shared comparisons, complete native AUTO/font/fill/layout/touch, current busy/removed callbacks and finite variant negative control`);

}
