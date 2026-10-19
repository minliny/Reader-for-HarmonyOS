import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const definitions={"settings-feedback": {"description": "实际Settings in-flight反馈/完成后无永久Text", "resources": []}, "shelf-notice": {"description": "实际Shelf两consumer→RecoveryNotice→action captured generation", "resources": []}};
for(const id of selectContractCases(definitions)){await runSelectedCase(id);recordContractCasePass(id);}
async function runSelectedCase(selectedCase){
const {default: assert} = await import('node:assert/strict');
const {readFileSync} = await import('node:fs');
const {boundedSurfaceSdk} = await import('./lib/bounded-surface-sdk-probe.mjs');

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
if(selectedCase==='settings-feedback'){const settingsPage=read('entry/src/main/ets/features/settings/SettingsPage.ets');
for(const busy of [true,false]){
  const sdk=boundedSurfaceSdk(),o=sdk.consumer(settingsPage,['operationFeedback']);
  Object.assign(o,{appThemeScheme:'day',resetInFlight:busy,cacheCleanupInFlight:false,resetMessage:'已恢复界面与阅读设置',
    hasPendingSettings:()=>false,recovery:()=>({canRetry:false})});o.operationFeedback();
  const texts=sdk.nodes(o).filter(n=>n.type==='Text');
  assert.equal(texts.length,busy?1:0,'only the real in-flight task owns an inline message');
  if(busy){assert.equal(texts[0].create,'正在恢复界面与阅读设置');
    assert.ok(sdk.nodes(o).some(n=>n.type==='LoadingProgress'));}
}
}
if(selectedCase==='shelf-notice'){
for(const [tail,text] of [['/BookshelfPage.ets','this.viewModeError'],['/BookshelfSettingsPage.ets','this.error']]){
  const pageFile={path:'entry/src/main/ets/features/'+(tail==='/BookshelfPage.ets'?'bookshelf/BookshelfPage.ets':'bookshelf/BookshelfSettingsPage.ets')},source=read(pageFile.path),method=tail==='/BookshelfPage.ets'?'bookshelfTabContent':'pendingOverlay';
  const mount=(input=source)=>{
    assert.match(input,/import \{ ReaderRecoveryNotice \} from '\.\.\/common\/ReaderRecoveryNotice';/,
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
  assert.throws(()=>mount(source.replace("import { ReaderRecoveryNotice } from '../common/ReaderRecoveryNotice';",'')),/actual shared implementation import/);
}
}

}
