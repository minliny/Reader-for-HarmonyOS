import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { ReaderSystemFileOpenQueue } from '../entry/src/main/ets/app/ReaderSystemFileOpenQueue.ts';
import { isReaderLocalBookFileName } from '../entry/src/main/ets/app/ReaderLocalBookFormatAdmission.ts';
import { localImportFailure } from '../entry/src/main/ets/app/LocalImportFailure.ts';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
async function until(fn) { for (let n=0; n<30; n++) { if (fn()) return; await tick(); } assert.fail('file-open operation did not settle'); }
const book = { sourceId: 'local', bookId: 'local:hash', title: '本地书', author: '作者', addedAt: 1,
  currentChapterIndex: 4, readingPosition: {chapterIndex: 4, chapterOffset: 217, updatedAt: 5} };

// Actual queue: cold delivery survives a late/rebuilt page, a warm delivery is
// serialized, repeated active/completed Wants coalesce, new retries are allowed.
{
  const gate = deferred(), calls = [];
  const queue = new ReaderSystemFileOpenQueue(async (uri, current) => { calls.push(uri); await gate.promise; return current() ? { book } : {}; });
  assert.equal(queue.enqueue('file://provider/一.txt'), 'accepted');
  assert.equal(queue.enqueue('file://provider/一.txt'), 'duplicate');
  for (const suffix of ['b','c','d']) assert.equal(queue.enqueue('file://provider/' + suffix + '.txt'), 'accepted');
  assert.equal(queue.enqueue('file://provider/e.txt'), 'full');
  gate.resolve(); await until(() => queue.peek());
  assert.deepEqual(calls, ['file://provider/一.txt']);
  assert.equal(queue.enqueue('file://provider/一.txt'), 'duplicate');
  let delivered;
  const unsubscribe = queue.subscribe(() => { delivered = queue.peek(); });
  assert.deepEqual(delivered.book.readingPosition, book.readingPosition);
  unsubscribe(); queue.acknowledge(9999); assert.ok(queue.peek());
  queue.acknowledge(delivered.id); await until(() => calls.length === 2 && queue.peek());
  let reconstructed = 0; queue.subscribe(() => reconstructed++); assert.equal(reconstructed, 1);
  queue.dispose(); assert.equal(queue.peek(), undefined); assert.equal(queue.enqueue('file://p/f.txt'), 'closed');
}
{
  const gate = deferred(); let currentAfterDestroy;
  const queue = new ReaderSystemFileOpenQueue(async (_uri, current) => { await gate.promise; currentAfterDestroy=current(); return {book}; });
  let callbacks=0; queue.subscribe(() => callbacks++); queue.enqueue('file://provider/a.txt'); queue.dispose(); gate.resolve();
  await until(() => currentAfterDestroy !== undefined); assert.equal(currentAfterDestroy,false); assert.equal(callbacks,1);
}
{
  let attempts=0;
  const queue=new ReaderSystemFileOpenQueue(async()=>{ attempts++; throw Error('private://do-not-leak'); });
  queue.enqueue('file://provider/a.txt'); await until(()=>queue.peek());
  assert.equal(queue.peek().failure.code,'readFailed'); assert.ok(!JSON.stringify(queue.peek()).includes('private://'));
  queue.acknowledge(queue.peek().id); queue.enqueue('file://provider/a.txt'); await until(()=>attempts===2); queue.dispose();
}

// Run production Host boundary with OS filesystem operations substituted. The
// actual filesystem read/copy/hash, limits, and Core parser are shared with picker.
{
  const Host=productionMotionMethods(new URL('../entry/src/main/ets/app/ReaderHostRegistry.ts',import.meta.url),
    ['prepareSystemLocalBookInput'], {isReaderLocalBookFileName,localImportFailure,errorMessageOf:e=>e.message});
  const stages=[];
  const host=Object.assign(new Host(), {ensureStageRecovery:async()=>{},
    requireSelectedFileName:uri=>decodeURIComponent(uri.substring(uri.lastIndexOf('/')+1)),
    stageLocalBook:async(uri,fileName)=>{stages.push(uri);return {bookId:'local:hash',fileName,stagedPath:'/private/source',assetKind:'source'};}});
  for (const suffix of ['txt','epub','mobi','azw','azw3','kf8']) {
    const result=await host.prepareSystemLocalBookInput('file://provider/%E4%B8%AD%E6%96%87.'+suffix.toUpperCase());
    assert.equal(result.state,'ready'); assert.ok(result.input.fileName.startsWith('中文'));
  }
  for (const uri of ['https://x/book.txt','/raw/book.txt','file://p/book.pdf','file://p/book.umd','file://p/book.zip','file://p/book.txt\n','file://p/'+ 'a'.repeat(8192)+'.txt']) {
    assert.equal((await host.prepareSystemLocalBookInput(uri)).state,'failed');
  }
  assert.equal(stages.length,6,'unsupported files never enter staging');
  host.stageLocalBook=async()=>{throw Error('open URI permission denied');};
  assert.equal((await host.prepareSystemLocalBookInput('file://provider/book.epub')).failure.code,'readFailed');
}

// Execute the real full Host class. Import is stubbed only at the existing
// transaction boundary: dedup, recovery ordering, private stage cleanup, stale
// owner suppression and completion handoff are the production implementation.
const hostCode=stripTypeScriptTypes(read('entry/src/main/ets/app/ReaderSystemFileOpenHost.ts')
  .replace(/^import[\s\S]*?;\n/gm,'').replace(/^export /gm,''));
function hostType(core,gateway,barrier={prepareUserChange:async()=>{}}) {
  return new Function('ReaderRuntimeOwner','ReaderCoreGateway','LocalBookImportGateway','ReaderSystemFileOpenQueue','hilog','ReaderThemeHost',
    hostCode+';return ReaderSystemFileOpenHost;')({},core,gateway,ReaderSystemFileOpenQueue,{warn(){}},barrier);
}
for (const existing of [true,false]) {
  const calls=[], ready=deferred(); let imported=false;
  class Core {async loadShelfBook(){calls.push('get');return existing||imported ? book : undefined;}}
  class Import {async releaseUnusedSelections(){calls.push('discard');} async importPreparedSelections(){calls.push('import');imported=true;return {items:[{state:'success'}]};}}
  const Host=hostType(Core,Import);
  const owner={prepareSystemLocalBookInput:async()=>{calls.push('stage');return {state:'ready',input:{bookId:book.bookId}};},
    commitLocalBookInput:async()=>{calls.push('asset');}};
  Host.install(owner,ready.promise); Host.receive({action:'action.system.home',uri:'file://p/a.txt'}); assert.deepEqual(calls,[]);
  Host.receive({action:'ohos.want.action.viewData',uri:'file://p/a.txt'}); await tick();
  assert.deepEqual(calls,['stage'],'temporary grant copied promptly but no Core mutation before recovery');
  ready.resolve(); await until(()=>Host.peek()); assert.deepEqual(Host.peek().book,book);
  assert.deepEqual(calls,existing?['stage','get','asset','discard']:['stage','get','import','get']);
  Host.detach({}); assert.ok(Host.peek(),'another owner cannot detach active queue'); Host.detach(owner); assert.equal(Host.peek(),undefined);
}
{
  const ready=deferred(),calls=[];
  class Core {async loadShelfBook(){assert.fail('destroyed owner cannot enter Core');}}
  class Import {async releaseUnusedSelections(){calls.push('discard');}}
  const Host=hostType(Core,Import),owner={prepareSystemLocalBookInput:async()=>({state:'ready',input:{bookId:book.bookId}})};
  Host.install(owner,ready.promise); Host.receive({action:'ohos.want.action.viewData',uri:'file://p/a.txt'}); await tick();
  Host.detach(owner); ready.resolve(); await until(()=>calls.length); assert.deepEqual(calls,['discard']); assert.equal(Host.peek(),undefined);
}
{
  const calls=[];
  class Core {async loadShelfBook(){assert.fail('failed restore must block Core import');}}
  class Import {async releaseUnusedSelections(){calls.push('discard');}}
  const Host=hostType(Core,Import,{prepareUserChange:async()=>{throw Error('recovery remains pending');}});
  const owner={prepareSystemLocalBookInput:async()=>({state:'ready',input:{bookId:book.bookId}})};
  Host.install(owner,Promise.resolve());Host.receive({action:'ohos.want.action.viewData',uri:'file://p/a.txt'});
  await until(()=>Host.peek());assert.equal(Host.peek().failure.code,'readFailed');assert.deepEqual(calls,['discard']);Host.detach(owner);
}

// Actual Index navigation methods must wait for progress-preserving exit, defer
// pending source switch, and acknowledge only a consumed result (never raw URI).
{
  let result={id:1,book}; const actions=[];
  const Host={peek:()=>result, acknowledge:id=>{assert.equal(id,result.id);actions.push('ack');result=undefined;}};
  const Index=productionMotionMethods(new URL('../entry/src/main/ets/pages/Index.ets',import.meta.url),
    ['consumeSystemFileOpen','onReaderExited','cancelReaderExitDestination'],{ReaderSystemFileOpenHost:Host,LOCAL_SOURCE_ID:'local'});
  const index=Object.assign(new Index(),{systemFileOpenMounted:true,searchAppForeground:true,systemFileOpenApplying:false,systemFileOpenExitId:0,
    systemFileOpenNoticeId:0,sourceSwitchVisible:false,sourceSwitchState:{kind:'discovering'},sourceSwitchRollbackInFlight:false,
    readingSessionActive:true,getUIContext:()=>({getPromptAction:()=>({showToast:()=>actions.push('toast')})}),
    returnToBookshelf(){actions.push('shelf');this.readingSessionActive=false;},openShelfBook:b=>{assert.equal(b,book);actions.push('open');},
    closeImportDialog(){actions.push('close-import');}});
  index.consumeSystemFileOpen(); assert.deepEqual(actions,[],'wait for mounted reader exit callback');
  index.readingExitRequest=()=>actions.push('exit'); index.consumeSystemFileOpen(); index.consumeSystemFileOpen();
  assert.deepEqual(actions,['exit']); index.onReaderExited(); assert.deepEqual(actions,['exit','shelf','close-import','shelf','open','ack']);
  result={id:2,book}; index.sourceSwitchVisible=true;index.sourceSwitchState={kind:'switching'};actions.length=0;
  index.consumeSystemFileOpen();index.consumeSystemFileOpen();assert.deepEqual(actions,['toast']);assert.ok(result);
  index.sourceSwitchVisible=false;index.sourceSwitchState={kind:'discovering'};index.consumeSystemFileOpen();assert.ok(actions.includes('open'));assert.equal(result,undefined);
  result={id:3,failure:{code:'readFailed',message:'读取失败'}};actions.length=0;index.consumeSystemFileOpen();assert.deepEqual(actions,['toast','ack']);
  result={id:4,book};index.searchAppForeground=false;actions.length=0;index.consumeSystemFileOpen();assert.deepEqual(actions,[]);assert.ok(result);
  index.searchAppForeground=true;index.readingSessionActive=true;index.navigationGeneration=7;index.detailBook={sourceId:'remote',bookId:'remote-book'};
  const journal=deferred();index.resolveReaderSourceSwitchTransaction=async()=>{actions.push('resolve-journal');await journal.promise;index.pendingSourceSwitch={transactionId:'late',targetSourceId:'remote',targetBookId:'remote-book'};};
  index.readingExitRequest=()=>actions.push('exit');index.consumeSystemFileOpen();index.consumeSystemFileOpen();
  assert.deepEqual(actions,['resolve-journal'],'cold unresolved source-switch journal blocks navigation');
  journal.resolve();await tick();assert.deepEqual(actions,['resolve-journal','toast']);assert.ok(result);
  index.pendingSourceSwitch=undefined;index.consumeSystemFileOpen();assert.equal(actions.at(-1),'exit');
  index.cancelReaderExitDestination();assert.equal(result,undefined,'cancelled progress save retains current book; imported book stays on shelf');
  result={id:5,book};index.readingSessionActive=false;index.systemFileOpenMounted=false;actions.length=0;
  index.consumeSystemFileOpen();assert.deepEqual(actions,[],'unmounted Index cannot consume retained result');
  index.systemFileOpenMounted=true;index.pendingSourceSwitch={transactionId:'other-book',targetSourceId:'other',targetBookId:'other'};
  index.consumeSystemFileOpen();assert.ok(actions.includes('open'),'inactive other-book journal is preserved without stranding local file opens');
  assert.equal(index.pendingSourceSwitch.transactionId,'other-book');
}

const manifest=JSON.parse(read('entry/src/main/module.json5'));
const ability=manifest.module.abilities.find(x=>x.name==='EntryAbility');
assert.equal(ability.launchType,'singleton');assert.equal(ability.exported,true);
const uris=ability.skills.find(x=>x.actions.includes('ohos.want.action.viewData')).uris;
for(const type of ['general.plain-text','general.epub','com.amazon.mobi','com.amazon.azw','com.amazon.azw3','text/plain','application/epub+zip','application/x-mobipocket-ebook']) {
  assert.ok(uris.some(x=>x.scheme==='file'&&x.type===type&&x.linkFeature==='FileOpen'));
}
assert.ok(uris.every(x=>!['*/*','general.file','general.ebook','application/pdf'].includes(x.type)),'no unbounded or unsupported registration');
const utd=JSON.parse(read('entry/src/main/resources/rawfile/arkdata/utd/utd.json5'));
assert.deepEqual(utd.UniformDataTypeDeclarations[0].FilenameExtensions,['.kf8']);
assert.deepEqual(utd.UniformDataTypeDeclarations[0].BelongingToTypes,['com.amazon.azw3']);
assert.ok(uris.some(x=>x.type===utd.UniformDataTypeDeclarations[0].TypeId));
const sdk='/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony';
const require=createRequire(import.meta.url),Ajv=require(sdk+'/ets/build-tools/ets-loader/node_modules/ajv');
const ajv=new Ajv({strict:false,allErrors:true});
const moduleSchema=JSON.parse(readFileSync(sdk+'/toolchains/modulecheck/module.json','utf8'));
for(const skill of ability.skills)assert.ok(ajv.validate(moduleSchema.properties.module.properties.abilities.items.properties.skills.items,skill),JSON.stringify(ajv.errors));
assert.ok(ajv.validate(JSON.parse(readFileSync(sdk+'/toolchains/modulecheck/customUtds.json','utf8')),utd),JSON.stringify(ajv.errors));
console.log('PASS system file open: cold/warm queue, reuse/stage cleanup, recovery/teardown fencing, URI admission, existing progress, guarded reader exit, source-switch deferral and manifest');
