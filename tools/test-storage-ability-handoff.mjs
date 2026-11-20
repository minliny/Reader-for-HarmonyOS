import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';
const cases = {
  'ability-adoption': 'Actual Ability waits for previous release, configuration recovery and ready root; a retired window cannot install a successor.',
  'startup-feedback': 'Actual Index keeps missing original operations pending and rejects retired actions; completed feedback is acknowledged only when displayed.',
};
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => {resolve=a;reject=b;}); return {promise,resolve,reject}; };
const turn = () => new Promise(resolve => setImmediate(resolve));
for (const id of selectContractCases(cases)) {
const {default:assert}=await import('node:assert/strict');
const { selectedProductionMethods }=await import('./lib/selected-production-methods.mjs');
  if (id === 'ability-adoption') {
    function fixture() {
      const close=deferred(), recovery=deferred(), events=[];
      let current;
      const next={async start(){events.push('native-start');},registerLibraryRestoreHandoff(){events.push('handoff-bound');return()=>{};}};
      const previous={async release(){events.push('release-start');await close.promise;current=undefined;events.push('release-end');}};
      current=previous;
      const Runtime={isCurrent:owner=>owner===current,current:()=>current,install(){assert.equal(current,undefined);current=next;events.push('install');return next;}};
      class Sync { async recoverInterruptedRestore(){events.push('config-sync');await recovery.promise;} }
      class Settings { async loadAfterConfigurationRecovery(admitted){assert.equal(admitted(),true);events.push('settings-ready');} }
      const Ability=selectedProductionMethods('entry/src/main/ets/entryability/EntryAbility.ets','EntryAbility',
        ['bindLibraryRestoreHandoff','adoptLibraryRestore','adoptLibraryRestoreInWindow','publishConfirmedBookshelfMode','waitForRestoredContent'],
        {ReaderRuntimeOwner:Runtime,ReaderThemeHost:{detach(){},async install(){events.push('theme-install');},setRecoveryBarrier(){}},
          ReaderSystemFileOpenHost:{detach(){},install(){events.push('file-owner-installed');}},SyncGateway:Sync,ReaderSettingsGateway:Settings,
          LocalConfigurationReset:{async recover(){events.push('config-reset');}},WebDavCredentialStore:{instance:{async loadBookshelfViewMode(){},currentBookshelfViewMode:()=> 'cover'}},
          ConfigurationConstant:{ColorMode:{COLOR_MODE_DARK:1}},AppStorage:{setOrCreate(){}},hilog:{error(){}},DOMAIN:0});
      const ability=new Ability(),stage={};
      Object.assign(ability,{runtimeOwner:previous,activeWindowStage:stage,windowStageGeneration:1,context:{config:{colorMode:0}},
        async prepareSelectedReadingFont(){events.push('font');},onWindowStageCreate(value){assert.equal(value,stage);events.push('root-create');
          let listener;this.startupContent={subscribe(callback){listener=callback;callback({phase:'admitting'});return()=>{listener=undefined;};}};
          void this.recoveryReady.then(()=>{events.push('root-ready');listener?.({phase:'ready'});});}});
      return {ability,previous,next,stage,close,recovery,events};
    }
    const f=fixture(),operation=f.ability.adoptLibraryRestore(f.previous);await turn();assert.deepEqual(f.events,['release-start']);
    f.close.resolve();await turn();assert.ok(f.events.includes('install'));assert.equal(f.events.includes('root-ready'),false);
    assert.equal(f.events.includes('handoff-bound'),false);f.recovery.resolve();await operation;
    assert.ok(f.events.indexOf('release-end')<f.events.indexOf('install'));
    assert.ok(f.events.indexOf('config-reset')<f.events.indexOf('root-ready'));
    assert.equal(f.ability.runtimeOwner,f.next);
    const retired=fixture(),stale=retired.ability.adoptLibraryRestore(retired.previous),rejected=assert.rejects(stale,/RETIRED/);
    await turn();retired.ability.windowStageGeneration++;retired.close.resolve();await rejected;
    assert.equal(retired.events.includes('install'),false);
  }
  if (id === 'startup-feedback') {
    const Index=selectedProductionMethods('entry/src/main/ets/pages/Index.ets','Index',['showLibraryRestoreStartupFeedback'],{READER_FEEDBACK_EXTENDED_MS:2200});
    let fact={operationId:`library-sync-${'a'.repeat(32)}`,status:'missing'},acks=0,opened=0,live=true,shown=true,notice;
    const owner={pendingLibraryRestoreStartupFact:()=>fact,acknowledgeLibraryRestoreStartupFact(value){assert.equal(value,fact);acks++;}};
    const index=new Index();Object.assign(index,{mountedRuntimeOwner:owner,searchAppForeground:true,shelfReceiptRetired:false,route:'bookshelf',
      indexRecoveryNotice:{visible:false},indexRecoveryTag:'',isCurrentRuntime:()=>live,getUIContext:()=>({}),
      transientFeedback:{show(_context,_message,current){assert.equal(current(),true);return shown;}},
      showIndexRecoveryNotice(message,label,action,current,tag){notice={message,label,action,current,tag};},clearIndexRecoveryNotice(){},openSettings(){opened++;}});
    index.showLibraryRestoreStartupFeedback();assert.equal(acks,0);assert.equal(notice.tag,'library-restore');
    notice.action();assert.equal(opened,1);live=false;notice.action();assert.equal(opened,1);
    live=true;fact={...fact,status:'committedCurrent'};shown=false;index.showLibraryRestoreStartupFeedback();assert.equal(acks,0);
    shown=true;index.showLibraryRestoreStartupFeedback();assert.equal(acks,1);
    index.route='reading';index.showLibraryRestoreStartupFeedback();assert.equal(acks,1);
  }
  recordContractCasePass(id);
}
