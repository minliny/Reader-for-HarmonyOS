import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={"settings-feedback": {"description": "实际Settings in-flight反馈/完成后无永久Text", "resources": []}, "shelf-notice": {"description": "实际Shelf两consumer→RecoveryNotice→action captured generation", "resources": []}};
for(const id of selectContractCases(definitions)){await runSelectedCase(id);recordContractCasePass(id);}
async function runSelectedCase(selectedCase){
const {default: assert} = await import('node:assert/strict');
const {readFileSync} = await import('node:fs');
const {boundedSurfaceSdk} = await import('./lib/bounded-surface-sdk-probe.mjs');

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
if(selectedCase==='settings-feedback'){const settingsPage=read('entry/src/main/ets/features/settings/ui/SettingsPage.ets');
for(const busy of [true,false]){
  const sdk=boundedSurfaceSdk(),o=sdk.consumer(settingsPage,['operationFeedback']);
  Object.assign(o,{appThemeScheme:'day',resetInFlight:busy,cacheCleanup:undefined,resetMessage:'已恢复界面与阅读设置',
    hasPendingSettings:()=>false,recovery:()=>({canRetry:false})});o.operationFeedback();
  const texts=sdk.nodes(o).filter(n=>n.type==='Text');
  assert.equal(texts.length,busy?1:0,'only the real in-flight task owns an inline message');
  if(busy){assert.equal(texts[0].create,'正在恢复界面与阅读设置');
    assert.ok(sdk.nodes(o).some(n=>n.type==='LoadingProgress'));}
}
}
if(selectedCase==='shelf-notice'){
await runSourceAnalysisCacheFixtures();
for(const [tail,text] of [['/BookshelfPage.ets','this.viewModeError'],['/BookshelfSettingsPage.ets','this.error']]){
  const pageFile={path:'entry/src/main/ets/features/'+(tail==='/BookshelfPage.ets'?'bookshelf/BookshelfPage.ets':'bookshelf/BookshelfSettingsPage.ets')},source=read(pageFile.path),method=tail==='/BookshelfPage.ets'?'bookshelfTabContent':'pendingOverlay';
  const mount=(input=source)=>{
    assert.match(input,/import \{ ReaderRecoveryNotice \} from '\.\.\/\.\.\/ui\/feedback\/ReaderRecoveryNotice';/,
      'actual shared implementation import remains required');
    const sdk=boundedSurfaceSdk(),o=sdk.consumer(input,[method]);
    const calls=[],view={visible:true,canRetry:true,message:'原显示方式保存待核对',generation:11};
    Object.assign(o,{appThemeScheme:'day',viewModeSnapshot:{},modeReconcileBusy:false,viewModeReconcileBusy:false,
      viewModePending:()=>true,modePending:()=>true,viewModeRecovery:()=>view,
      isWideViewport:()=>false,tabletContent(){},phoneContent(){},settingsRecovery(){},
      actionBook:undefined,bookActionSheetContent(){},bookActionSheetOptions:()=>({}),headerClearance:64,noticeTopInset:0,
      retryViewMode:g=>calls.push(g),retryMode:g=>calls.push(g)});o[method]();
    const children=sdk.walk(o).filter(c=>c instanceof sdk.deps.ReaderRecoveryNotice);
    assert.equal(children.length,1,'the actual current owner mounts one finite shared notice');
    assert.deepEqual(sdk.properties.sdk.ObservedObject.GetRawObject(children[0].view),view,
      'the complete current recovery view reaches the mounted shared child through its genuine copied Prop');
    assert.ok(sdk.nodes(children[0]).some(n=>n.type==='Span'&&n.create==='  '+view.message),
      'the real shared native Span renders the current recovery message');
    const action=sdk.walk(children[0]).find(c=>c instanceof sdk.deps.ReaderRecoveryAction&&c.label==='核对显示方式');
    assert.ok(action);[...action.nodes.values()].find(n=>n.onClick).onClick();assert.deepEqual(calls,[11]);
  };
  mount();
  assert.throws(()=>mount(source.replaceAll('ReaderRecoveryNotice({','ReaderOtherNotice({')),/actual current owner mounts|not defined|UI component syntax|no diagnostics/);
  assert.throws(()=>mount(source.replace("import { ReaderRecoveryNotice } from '../../ui/feedback/ReaderRecoveryNotice';",'')),/actual shared implementation import/);
}
}

}


// Retain the existing local cache regressions within the selected shared
// carrier case; listing cases still does not load or exercise the SDK.
export async function runSourceAnalysisCacheFixtures() {
 const { default: assert } = await import('node:assert/strict');
 const { sourceAnalysisCache } = await import('./lib/source-analysis-cache.mjs');
 const { approvedNativeAllCarrierFacts } = await import('./lib/approved-manga-typography-carriers.mjs');
// Performance reuse must never hide same-length mutations, changed SDK
// options, caller mutation, or a previously failed parse/assertion.
{
 const options={target:1},cached=sourceAnalysisCache(options);let parses=0;
 const analyze=source=>cached(source,'same.ets',()=>{parses++;return{source,nested:{target:options.target}};});
 const first=analyze('alpha');first.nested.target=99;
 assert.deepEqual(analyze('alpha'),{source:'alpha',nested:{target:1}});assert.equal(parses,1);
 assert.equal(analyze('gamma').source,'gamma');assert.equal(parses,2,'equal byte lengths do not identify source');
 options.target=2;assert.equal(analyze('gamma').nested.target,2);assert.equal(parses,3,'SDK options invalidate derived facts');
 let failures=0;
 for(let i=0;i<2;i++)assert.throws(()=>cached('invalid','same.ets',()=>{failures++;throw Error('actual parse failure');}),/actual parse failure/);
 assert.equal(failures,2,'failures are never reused as successful analyses');
 const source=`@Component
struct Alpha {
 build() { Column() { Text('one') } }
}
@Component
struct Beta {
 build() { Column() { Text('two') } }
}`;
 const path='entry/src/main/ets/features/common/PerformanceOwnerProbe.ets';
 const facts=approvedNativeAllCarrierFacts(source,path);
 assert.deepEqual(facts.map(node=>node.owner),['Alpha','Beta'],'one parse retains every exact owner range');
 facts[0].owner='caller mutation';facts[0].attributes.width='99';
 assert.deepEqual(approvedNativeAllCarrierFacts(source,path).map(node=>node.owner),['Alpha','Beta']);
 assert.deepEqual(approvedNativeAllCarrierFacts(source.replace('Alpha','Gamma'),path).map(node=>node.owner),['Gamma','Beta']);
 assert.throws(()=>approvedNativeAllCarrierFacts('struct {',path),/AST parsing/,'cached valid source cannot admit invalid current source');
}
}
