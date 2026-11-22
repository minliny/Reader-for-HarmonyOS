import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { searchTypes } from '../../lib/book-search-page-probe.mjs';
import { pureModuleProbe } from '../../lib/ets-pure-module-probe.mjs';
import { selectedProductionMethods } from '../../lib/selected-production-methods.mjs';
import * as authors from '../../../entry/src/main/ets/app/library/BookAuthorMetadata.ts';
import { assertCurrentActionState } from '../collectors/harmonyos/records.mjs';
import { loadCase, planCase } from '../lib/cases.mjs';
import { resolveStructureBindings } from '../lib/structure-contract.mjs';
import { normalizeHarmonyLayout } from '../lib/layout.mjs';
import { evaluateSearch } from '../lib/search.mjs';

const name = 'bookshelf.search-detail-return';
const rowAlias = 'reader-search-public-local-result';
const title = 'Reader Phase 1 公共长目录';
const privateKey = 'local:public-fixture-book-opaque-key';
const caseAssertion = loadCase(name).assertions.find(assertion => assertion.kind === 'phase-detail');
const evaluate = context => evaluateSearch({...caseAssertion,acceptedSources:caseAssertion.sources},context);
const bounds = (l,t,r,b) => `[${l},${t}][${r},${b}]`;
function node(id,type,box,children = [],extra = {}) {
  const geometry = bounds(...box);
  return {children,attributes:{id,type,hostWindowId:'11',bounds:geometry,origBounds:geometry,
    visible:'true',enabled:'true',clickable:'true',opacity:'1',clip:'false',...extra}};
}
function nativeSample(nodes,beforeSeq,afterSeq) {
  const region = {left:0,top:0,width:360,height:600};
  const tree = {attributes:{bounds:bounds(0,0,360,600)},children:[
    node('','root',[0,0,360,600],nodes,{bundleName:'io.reader.minliny',abilityName:'EntryAbility',pagePath:'pages/Index'}),
  ]};
  const report = {windowId:'11',vpPixels:1,metrics:{ready:true,revision:1,densityPixels:1,windowRect:region,globalRect:region,
    keyboardArea:{available:true,visible:false,rects:[],revision:1},keyboardInsets:{left:0,top:0,right:0,bottom:0}}};
  return {...normalizeHarmonyLayout({tree,report,instanceId:'reader',publicBookTitle:title}),captureComplete:true,
    beforeSeq,afterSeq,hostBeginMs:beforeSeq,hostEndMs:afterSeq};
}
function results(page,afterSeq, {rowY = 160, viewportY = 100, viewportPage = page,
  rowPage = page, rowKey = privateKey, outsideViewport = false, rowAncestorOpacity = '1'} = {}) {
  const row = node(`reader-search-result:${JSON.stringify([rowPage,2,rowKey])}`,'Button',[20,rowY,340,rowY+80],[
    node('','Text',[40,rowY+10,300,rowY+50],[],{originalText:title}),
  ]);
  const rowBranch = rowAncestorOpacity === '1' ? row :
    node('','Column',[20,rowY,340,rowY+80],[row],{opacity:rowAncestorOpacity});
  const viewport = node(`reader-search-result-list:${viewportPage}:2`,'List',[0,viewportY,360,590],outsideViewport ? [] : [rowBranch]);
  return nativeSample(outsideViewport ? [viewport,row] : [viewport],afterSeq-2,afterSeq);
}
const detailSample = (bookTitle=title, titleAncestorOpacity='1') => nativeSample([
  node('reader-book-detail-verification','Column',[0,100,360,590],[
    node('','Column',[20,140,340,240],[
      node('','Text',[40,160,300,220],[],{originalText:bookTitle}),
    ],{opacity:titleAncestorOpacity}),
  ]),
],23,25);
function action(op,targetId,from,beforeSeq,afterSeq) {
  return {op,targetId,from,beforeSeq,afterSeq,hostBeginMs:beforeSeq,hostEndMs:afterSeq,instanceId:'reader',
    ...(op === 'keyEvent' ? {key:'Back'} : {})};
}
function event(eventSeq,kind,payload,channel = 'business') {
  return {kind,eventSeq,payload,channel,instanceId:'reader',evidenceRefs:[kind]};
}
function projection(page,owner) {
  return {page,owner,queryRevision:2,viewportId:`reader-search-result-list:${page}:2`,
    operation:'cancelled',operationGeneration:1,projection:'results',searchActive:false,stopped:true};
}
const scope = {identity:1,mounting:4,queryRevision:2};
function context({native = {},anchorAtStart = true} = {}) {
  const anchor = (owner,page,action) => ({owner,page,action,queryRevision:2,anchorOffset:anchorAtStart ? -69 : 140,
    anchorIndex:anchorAtStart ? 0 : 6,anchorItemY:anchorAtStart ? 0 : -20,anchorAtStart,anchorMatchesRestore:!anchorAtStart});
  return {
    actions: {
      'submit-a':action('click','reader-bookshelf-search-submit','submit-a-ready',2,7),
      'open-detail':action('click',rowAlias,'results-a',15,21),
      'detail-back':action('keyEvent',undefined,'detail',25,30),
    },
    samples:{'results-a':results(2,14),detail:detailSample(),'result-returned':results(3,40,native)},
    events:[
      event(4,'search-button-intent',{},'input'),
      event(5,'search-submit-accepted',{...scope,navigation:2,writeLease:{generation:1,session:1,active:true}}),
      event(10,'search-page-projection',projection(2,2)),
      event(16,'search-page-anchor',anchor(2,2,'detail-selection')),
      event(17,'search-detail-accepted',{...scope,navigation:3,previousOwner:2,previousNavigation:2,route:'detail'}),
      event(19,'search-page-owner-released',{owner:2,page:2,queryRevision:2,released:true}),
      event(27,'search-detail-returned',{...scope,navigation:4,route:'search'}),
      event(31,'search-page-projection',projection(3,3)),
      event(32,'search-page-anchor',anchor(3,3,'anchor-restored')),
    ],
  };
}

test('search detail return binds the stopped query to a new native viewport and retains its public row privately', () => {
  assert.equal(loadCase(name).version,5);
  for (const anchorAtStart of [true,false]) {
    const current = context({native:{rowY:210,viewportY:150},anchorAtStart});
    const result = evaluate(current);
    assert.equal(result.verdict,'PASS',result.reason);
    assert.deepEqual(result.actual.owner,[2,3]);
    assert.deepEqual(result.actual.viewportIds,[['reader-search-result-list:2:2'],['reader-search-result-list:3:2']]);
    assert.deepEqual(result.actual.nativeItemY,[60,60]);
    assert.equal(result.actual.nativeDeltaY,0);
    assert.equal(result.actual.row.sameBook,true);
    assert.ok(!JSON.stringify(result).includes(privateKey));
    assert.ok(!JSON.stringify(current.samples).includes(privateKey));
  }
});

test('search detail return rejects same-title replacement, wrong mounted list, wrong row mount and native displacement', () => {
  for (const native of [{rowKey:'local:unrelated'},{viewportPage:2},{rowPage:2},{rowY:161},{outsideViewport:true}]) {
    const result = evaluate(context({native}));
    assert.equal(result.verdict,'FAIL',JSON.stringify({native,result}));
  }
  const wrongDetail = context();
  wrongDetail.samples.detail = detailSample('Different public title');
  assert.equal(evaluate(wrongDetail).verdict,'FAIL');
  const position = context({anchorAtStart:false});
  position.events.at(-1).payload.anchorItemY = -19;
  assert.equal(evaluate(position).verdict,'FAIL','logical non-first-page anchor must still be within budget');
});

test('search detail return separates route and result-owner contradictions from missing evidence', () => {
  const mutations = [
    [current => current.events[4].payload.previousNavigation = 1,'FAIL'],
    [current => current.events.splice(5,0,event(18,'search-detail-accepted',{...current.events[4].payload})),'FAIL'],
    [current => current.events[5].payload.released = false,'FAIL'],
    [current => current.events[7].payload.operationGeneration = 2,'FAIL'],
    [current => current.events[7].payload.owner = 2,'FAIL'],
    [current => current.events.splice(5,1),'NOT_RUN'],
    [current => current.samples['result-returned'].captureComplete = false,'NOT_RUN'],
    [current => current.samples['result-returned'].window.density = 2,'NOT_RUN'],
  ];
  for (const [mutate,wanted] of mutations) {
    const current = context();
    mutate(current);
    const result = evaluate(current);
    assert.equal(result.verdict,wanted,result.reason);
  }
});

test('search detail return requires the actually visible book and title', () => {
  assert.equal(caseAssertion.expected.requireVisibleContent,true);
  const strict = {...caseAssertion,acceptedSources:caseAssertion.sources};
  const old = {...strict,expected:{...strict.expected}};
  delete old.expected.requireVisibleContent;
  const hiddenRow = context({native:{rowAncestorOpacity:'0'}});
  assert.equal(evaluateSearch(old,hiddenRow).verdict,'PASS','the older contract only tested the row own visibility');
  assert.equal(evaluateSearch(strict,hiddenRow).verdict,'FAIL','a hidden ancestor keeps the result card off screen');
  const unknownRow = context({native:{rowAncestorOpacity:''}});
  assert.equal(evaluateSearch(strict,unknownRow).verdict,'NOT_RUN');
  const hiddenTitle = context();
  hiddenTitle.samples.detail = detailSample(title,'0');
  assert.equal(evaluateSearch(strict,hiddenTitle).verdict,'FAIL');
  const unknownTitle = context();
  unknownTitle.samples.detail = detailSample(title,'');
  assert.equal(evaluateSearch(strict,unknownTitle).verdict,'NOT_RUN');
  assert.equal(evaluateSearch(strict,context()).verdict,'PASS');
});

test('search detail return preserves the scope of the original v2 anchor verdict', () => {
  const old = {...caseAssertion,expected:{sameQuery:true,anchorToleranceVp:.5}};
  const current = context({native:{rowY:190}});
  assert.equal(evaluateSearch(old,current).verdict,'PASS','v2 did not measure the native row');
  assert.equal(evaluate(current).verdict,'FAIL');
});

const scrolledCaseId = 'bookshelf.search-detail-scrolled-return';

test('search scrolled detail binds hidden recovery before explicit native editor tap', () => {
  const contract = loadCase(scrolledCaseId);
  assert.equal(contract.version,3);
  const plan = planCase(contract,'harmonyos');
  assert.equal(plan.caseVersion,3);
  const step = id => contract.steps.find(item => item.id === id);
  const recovery = step('search-entry');
  assert.equal(recovery.keyboard,false);
  assert.equal(recovery.focus,'reader-book-search-input');
  assert.ok(recovery.anchors.includes('reader-search-source-recovery-primary'));
  assert.deepEqual(step('focus-editor'),{id:'focus-editor',kind:'action',op:'click',from:'search-entry',
    target:'reader-book-search-input'});
  assert.equal(step('ime-ready').keyboard,true);
  assert.equal(step('ime-ready').afterAction,'focus-editor');
  assert.equal(step('type-a').from,'ime-ready');
  assert.equal(step('ime-ready').anchors.includes('reader-search-source-recovery-primary'),false);
  const bindings = resolveStructureBindings(contract);
  const binding = role => bindings.find(item => item.role === role);
  assert.equal(binding('search-entry').actionId,'open-search');
  assert.equal(binding('ime-ready').actionId,'focus-editor');
  assert.equal(binding('search-entry').rule.id,'search.no-source-recovery');
  for (const role of ['ime-ready','submit-a-ready']) {
    assert.equal(binding(role).rule.id,'search.input-over-books');
  }
});

test('search scrolled detail seed imports only its exact ordered public corpus and resumes a bounded prefix', async () => {
  const ownerFile = new URL('../../../entry/src/main/ets/app/diagnostics/ReaderPublicLongBook.ts',import.meta.url);
  const scope = {kind:'fixture',id:'search-detail-scroll-corpus'};
  const filesDir = '/data/storage/el4/base/haps/entry/files';
  const parent = filesDir + '/reader-public-ui-fixtures';
  const root = parent + '/' + scope.id;
  const digest = bytes => createHash('sha256').update(bytes).digest('hex');
  const archive = id => root + '/reader-import/books/' + id.slice('local:'.length) + '.source';
  const corpus = ['移窗样本 01','移窗样本 02','移窗样本 03','移窗样本 04','移窗样本 05','移窗样本 06','移窗样本 07','终点移窗样本']
    .map((title,index) => {
      const number = String(index+1).padStart(2,'0');
      const name = 'reader-public-fixture-scroll-book-' + number + '-v1.txt';
      const bytes = readFileSync(new URL('../fixtures/search-detail-scroll/' + encodeURIComponent(title + '.txt'),import.meta.url));
      const packaged = readFileSync(new URL('../../../entry/src/main/resources/rawfile/' + name,import.meta.url));
      assert.equal(bytes.length,312);
      assert.deepEqual(packaged,bytes);
      return {title,name,bytes,bookId:'local:' + digest(bytes)};
    });
  const shelves = [];
  const contents = new Map();
  const directories = new Set([parent,root]);
  const written = [];
  let sourceCount = 0, corrupt = false, failAt = 3, sequence = 0;
  const fileIo = {
    OpenMode: {CREATE:1,WRITE_ONLY:2,READ_ONLY:4},
    async lstat(path) { return {isDirectory:() => directories.has(path), isFile:() => contents.has(path),
      size:contents.get(path)?.length}; },
    async mkdir(path) { assert.equal(directories.has(path),false); directories.add(path); },
    async open(path) { return {fd:path}; },
    async close() {},
    async write(path,data) { const bytes = Buffer.from(data); contents.set(path,bytes); return bytes.length; },
    async read(path,target) { const bytes = contents.get(path); new Uint8Array(target).set(bytes); return bytes.length; },
    async unlink(path) { assert.ok(contents.delete(path)); },
    async listFile(path) { return [...contents.keys()].filter(item => item.startsWith(path + '/')); },
    async rmdir(path) { assert.ok(directories.delete(path)); },
  };
  const owner = {
    isCurrentPublicFixture: candidate => candidate === scope,
    getUIAbilityContext: () => ({filesDir,resourceManager:{async getRawFileContent(name) {
      const bytes = new Uint8Array(corpus.find(book => book.name === name).bytes);
      if (corrupt && name === corpus.at(-1).name) bytes[0] ^= 1;
      return bytes;
    }}}),
    async retainedLocalBookSourcePath(id,current) { assert.ok(current()); const path = archive(id); return contents.has(path) ? path : undefined; },
    async request(method,{bookId},{canDispatch,canContinue}) {
      assert.equal(method,'local_book.presentation.kind.v1');
      assert.ok(canDispatch() && canContinue() && shelves.some(book => book.bookId === bookId));
      return {data:{sourceId:'local',bookId,kind:'text',format:'txt',reimportRequired:false}};
    },
    async prepareSystemLocalBookInput(path) {
      assert.ok(path.startsWith(root + '/long-book-input-'));
      const bytes = contents.get(path);
      return {state:'ready',input:{bookId:'local:' + digest(bytes),fileName:path.split('/').at(-1),
        stagedPath:root + '/reader-import/staging/' + sequence,bytes}};
    },
  };
  const cryptoFramework = {createMd() {
    let bytes;
    return {async update(input) { bytes = input.data; },async digest() { return {data:Buffer.from(digest(bytes),'hex')}; }};
  }};
  const {prepareReaderPublicScrolledBooks} = pureModuleProbe(readFileSync(ownerFile,'utf8'),'ReaderPublicLongBook.ts',{
    cryptoFramework,fileIo,fileUri:{getUriFromPath:path => path},util:{generateRandomUUID:() => String(++sequence)},
    buildReaderPublicFixtureDirectory:(received,id) => received === filesDir && id === scope.id ? root : undefined,
    SourceGateway:class { async loadSources(id,reports,current) { assert.equal(id,undefined); assert.equal(reports,false);
      assert.ok(current()); return Array.from({length:sourceCount},() => ({})); } },
    ReaderCoreGateway:class { async loadBookshelf({limit},current) { assert.equal(limit,9); assert.ok(current());
      return {total:shelves.length,books:shelves.slice().reverse()}; } },
    LocalBookImportGateway:class { async importPreparedSelections([selection]) {
      if (written.length === failAt) return {state:'completed',imported:0,failed:1,items:[]};
      const {bookId,fileName,bytes} = selection.input;
      written.push(bookId);
      shelves.push({sourceId:'local',bookId,title:fileName.slice(0,-4)});
      contents.set(archive(bookId),bytes);
      return {state:'completed',imported:1,failed:0,items:[{disposition:'created'}]};
    } },
  },['prepareReaderPublicScrolledBooks']);
  await assert.rejects(() => prepareReaderPublicScrolledBooks(owner,{...scope}),/SCOPE_NOT_CURRENT/u);
  corrupt = true;
  await assert.rejects(() => prepareReaderPublicScrolledBooks(owner,scope),/DIGEST_MISMATCH/u);
  corrupt = false;
  sourceCount = 1;
  await assert.rejects(() => prepareReaderPublicScrolledBooks(owner,scope),/EXPECTED_EMPTY_SOURCES/u);
  sourceCount = 0;
  assert.deepEqual(written,[]);
  await assert.rejects(() => prepareReaderPublicScrolledBooks(owner,scope),/IMPORT_NOT_CONFIRMED/u);
  assert.deepEqual(written,corpus.slice(0,3).map(book => book.bookId));
  assert.deepEqual([...directories],[parent,root],'only this call’s staging directory is removed');
  failAt = -1;
  await prepareReaderPublicScrolledBooks(owner,scope);
  await prepareReaderPublicScrolledBooks(owner,scope);
  assert.deepEqual(written,corpus.map(book => book.bookId),'restart imports just the missing suffix and complete reopen is read-only');
  shelves[0].title = 'different';
  await assert.rejects(() => prepareReaderPublicScrolledBooks(owner,scope),/UNEXPECTED_BOOKSHELF/u);
  assert.equal(written.length,8);
});

function scrolledContext() {
  const current = context({anchorAtStart:false});
  for (const record of current.events.filter(item => item.kind === 'search-page-projection')) {
    Object.assign(record.payload,{operation:'current',stopped:false,resultCount:8});
  }
  const prior = results(2,10);
  prior.nodes = prior.nodes.filter(item => item.alias !== rowAlias);
  current.samples['initial-results'] = prior;
  current.samples['results-scrolled'] = current.samples['results-a'];
  current.samples['results-scrolled'].semanticSeq = 99;
  current.actions['open-detail'].from = 'results-scrolled';
  current.actions['scroll-results'] = action('swipe','reader-search-result-viewport','initial-results',10,11);
  current.events.splice(3,0,event(11,'search-page-anchor',{...current.events[3].payload,action:'user-scroll-settled'}));
  return current;
}

test('search scrolled detail joins the real swipe to the non-first-screen anchor and rejects top-only evidence', () => {
  const contract = loadCase(scrolledCaseId);
  const assertion = contract.assertions.find(a => a.kind === 'phase-detail');
  const result = current => evaluateSearch({...assertion,acceptedSources:assertion.sources},current);
  assert.equal(assertion.expected.requireVisibleContent,true);
  const current = scrolledContext();
  const settled = result(current);
  assert.equal(settled.verdict,'PASS',settled.reason);
  assert.equal(settled.actual.offStart.index,6);
  assert.equal(settled.actual.offStart.offsetVp,140);
  assert.equal(settled.actual.offStart.tailVisibleInitially,false);
  for (const [field,value] of [['anchorIndex',0],['anchorOffset',0],['anchorAtStart',true],['owner',8]]) {
    const changed = scrolledContext();
    changed.events[3].payload[field] = value;
    assert.equal(result(changed).verdict,'FAIL',field);
  }
  const uncovered = scrolledContext();
  uncovered.events.splice(3,1);
  assert.equal(result(uncovered).verdict,'NOT_RUN');
  const early = scrolledContext();
  early.samples['initial-results'] = results(2,10);
  assert.equal(result(early).verdict,'FAIL','tail row already visible before swipe');
});

test('search scrolled detail action requires an actual off-start row on the current native viewport', () => {
  const contract = loadCase(scrolledCaseId);
  const select = contract.steps.find(step => step.id === 'open-detail');
  const current = scrolledContext();
  const sample = current.samples['results-scrolled'];
  const checkpoint = {instanceId:sample.instanceId,eventSeq:15,windowRevision:sample.window.revision,
    semanticSeq:sample.semanticSeq,payload:{windowId:sample.window.id}};
  assert.doesNotThrow(() => assertCurrentActionState(select,sample,checkpoint,current.events));
  current.events[3].payload.anchorIndex = 0;
  assert.throws(() => assertCurrentActionState(select,sample,checkpoint,current.events),/off-start native result list/);
  current.events[3].payload.anchorIndex = 6;
  current.events[3].payload.page = 11;
  assert.throws(() => assertCurrentActionState(select,sample,checkpoint,current.events),/off-start native result list/);
});

test('search scrolled detail observes only the actual user scroll stop owned by the visible list', () => {
  const source = new URL('../../../entry/src/main/ets/features/search/ui/SearchPage.ets',import.meta.url);
  const Page = selectedProductionMethods(source,'SearchPage',['onListScrollStop']);
  const calls = [];
  const owner = Object.assign(new Page(),{userScrolling:true,userInteracting:false,ownsList:() => true,
    pageInputCurrent:() => true,viewState:{anchorAtStart:false},saveScrollAnchor:() => calls.push('save'),
    observePageAnchor:action => calls.push(action),scheduleDeferredResults:() => {},displayIdleRevision:0});
  owner.onListScrollStop();
  owner.onListScrollStop();
  owner.userScrolling = true;
  owner.pageInputCurrent = () => false;
  owner.onListScrollStop();
  assert.deepEqual(calls,['save','user-scroll-settled','save','save']);
});

test('search scrolled detail public corpus goes through the real local query and relevance owner with a deterministic tail', async () => {
  const contract = loadCase(scrolledCaseId);
  const folder = new URL('../fixtures/search-detail-scroll/',import.meta.url);
  const files = readdirSync(folder).filter(file => file.endsWith('.txt'));
  const books = files.map(file => ({sourceId:'local',title:file.slice(0,-4),author:'',
    bookId:'local:' + createHash('sha256').update(readFileSync(new URL(encodeURIComponent(file),folder))).digest('hex')}));
  assert.equal(files.length,8);
  assert.equal(new Set(books.map(book => book.bookId)).size,8,'native imports deduplicate exact content hashes');
  const visible = [];
  const rpc = [];
  const runtime = {async request(method) {
    rpc.push(method);
    if (method === 'source.list') return {data:{sources:[]}};
    if (method === 'bookshelf.list') return {data:{books}};
    if (method === 'search.history.list') return {data:{keywords:[],count:0}};
    if (method === 'search.history.add') return {data:{}};
    throw Error('Unexpected local-only operation ' + method);
  }};
  const owner = new searchTypes.SearchOrchestrator(value => visible.push(value),() => {},() => true,runtime);
  owner.open();
  await setImmediate();
  assert.equal(visible.at(-1).reason,'noSources');
  owner.search(contract.fixture.inputs.a);
  await setImmediate();
  const current = visible.at(-1);
  assert.equal(current.kind,'results');
  assert.equal(current.operation.fact,'current');
  assert.equal(current.results.length,8);
  assert.equal(rpc.includes('book.search'),false);
  const relevanceSource = new URL('../../../entry/src/main/ets/features/search/presentation/SearchResultRelevance.ts',import.meta.url);
  const { SearchResultRelevance } = pureModuleProbe(readFileSync(relevanceSource,'utf8'),'SearchResultRelevance.ts',
    authors,['SearchResultRelevance']);
  const relevance = new SearchResultRelevance(contract.fixture.inputs.a);
  const ranked = current.results.map(book => ({title:book.title,score:relevance.score(book.title,book.author)}))
    .sort((a,b) => a.score-b.score);
  assert.deepEqual(ranked.map(book => book.score),[2,2,2,2,2,2,2,3]);
  assert.equal(ranked.at(-1).title,contract.fixture.bookTitle);
  owner.close();
});
