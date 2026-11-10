import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ReaderDocumentPickerActivity as Activity } from '../entry/src/main/ets/platform/ReaderDocumentPickerActivity.ts';
import { ReaderWriteEvidence } from '../entry/src/main/ets/app/ReaderWriteEvidence.ts';
import { READER_LOCAL_BOOK_PICKER_FILTER, isReaderLocalBookFileName } from '../entry/src/main/ets/app/ReaderLocalBookFormatAdmission.ts';
import { localImportFailure } from '../entry/src/main/ets/app/LocalImportFailure.ts';
import { bookshelfOperationClass as actual } from './lib/bookshelf-operation-owner-probe.mjs';
import { selectedProductionMethods } from './lib/selected-production-methods.mjs';
import { installedEtsCompiler } from './lib/ets-compiler-runtime.mjs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const definitions = {
  'retired-opening-before-launch': 'Actual original OperationOwner and four forwards reject closed/reopened/departed same-window opening after Host StageRecovery',
  'new-root-same-opening': 'Actual original opening survives a new Root adapter while its retired caller lease is rejected',
  'covered-input-before-launch': 'Actual current presentation denies same-window covered input before Native launch and a new valid Root adapter can restore admission',
  'accepted-picker-and-release': 'Accepted picker survives background, while a closed opening releases unused staged selections without Core dispatch',
  'accepted-write-completes': 'Actual original import gateway pipeline continues after accepted write and late UI close; controlled protocol receipts only',
  'mandatory-forwarding-and-retirement': 'Actual mandatory launch predicate is forwarded unchanged, faults preserve identity, and two unconsumed bypass methods are retired',
};
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
async function until(predicate) { for (let i = 0; i < 40; i++) { if (predicate()) return; await tick(); } assert.fail('finite controlled boundary did not arrive'); }
const file = path => new URL('../entry/src/main/ets/' + path, import.meta.url);
const filter = { readingState: 'all', sourceKind: 'all' };
let windowId = 10100;

function fixture() {
  Activity.destroy(); Activity.bind(++windowId); Activity.setForeground(true);
  const f = { calls: [], native: [], nativeJobs: [], released: [], commits: [], stageInputs: [],
    recovery: deferred(), recoveryEntered: false, caller: true, persistPause: undefined };
  const Runtime = selectedProductionMethods(file('app/ReaderRuntimeOwner.ts'), 'ReaderRuntimeOwner', ['instance', 'current', 'isCurrent', 'selectLocalBookInputs']);
  const picker = { DocumentSelectOptions: class {}, DocumentViewPicker: class {
    constructor(context) { this.context = context; }
    select(options) { f.native.push({ context: this.context, options, pending: Activity.isPending() }); const job = deferred(); f.nativeJobs.push(job); return job.promise; }
  } };
  const Host = selectedProductionMethods(file('app/ReaderHostRegistry.ts'), 'ReaderHostRegistry',
    ['LocalBookSelectionLimit', 'LocalBookStagingConcurrency', 'selectLocalBookInputs'], {
      ReaderDocumentPickerActivity: Activity, picker, READER_LOCAL_BOOK_PICKER_FILTER, isReaderLocalBookFileName, localImportFailure,
      errorMessageOf: error => error instanceof Error ? error.message : String(error), LOG_DOMAIN: 0, hilog: { warn() {}, error() {} },
    });
  const input = { fileName: 'original.txt', bookId: 'local-input', stagedPath: '/controlled-stage/original.txt', assetKind: 'source' };
  const host = Object.assign(new Host(), { context: { controlled: 'UIAbilityContext' },
    ensureStageRecovery: () => { f.recoveryEntered = true; return f.recovery.promise; },
    requireSelectedFileName: uri => uri.split('/').at(-1),
    stageLocalBook: async uri => { f.stageInputs.push(uri); return input; },
  });
  const runtime = Object.assign(new Runtime(), { state: 'ready', host, supportsCoreCapability: () => false,
    request: async (method, params) => {
      f.calls.push({ method, params });
      if (method === 'import.parse') return { data: { preview: { summary: { integrity: { schemaVersion: 1, readability: 'complete' } } } } };
      if (method === 'import.persist') {
        if (f.persistPause) await f.persistPause.promise;
        return { data: { rollbackToken: { kind: 'localBook', token: { transactionId: 'controlled-original' } },
          persisted: { kind: 'localBook', data: { book: { bookId: input.bookId, title: 'Original', author: 'Author', kind: 'TXT' } } } } };
      }
      if (method === 'bookshelf.add') return { data: { sourceId: params.sourceId, bookId: params.bookId, created: true, addedAt: 1 } };
      if (method === 'import.finalize') return { data: { kind: 'localBook', data: { finalized: true } } };
      if (method === 'bookshelf.list') return { data: { books: [], total: 0, unfilteredTotal: 0, unfilteredOnlineTotal: 0 } };
      assert.fail('no unrelated controlled protocol call: ' + method);
    },
    discardLocalBookInput: async value => { f.released.push(value); },
    commitLocalBookInput: async value => { f.commits.push(value); return { bookId: value.bookId, assetKind: 'source', path: '/controlled-asset', created: true }; },
    rollbackLocalBookAsset: async () => assert.fail('acknowledged successful fixture cannot roll back'),
  });
  Runtime.instance = runtime;
  const facts = actual('app/ReaderOperationFacts.ts', '({projectOperationFacts,projectCommitReadback})');
  const projectPersistedReceipt = actual('app/ReaderPersistedReceiptProjection.ts', 'projectPersistedReceipt', facts);
  const errors = { errorMessageOf: error => error instanceof Error ? error.message : String(error), localImportFailure,
    hilog: { warn() {}, error() {} }, ReaderRuntimeOwner: Runtime };
  const Core = actual('app/ReaderCoreGateway.ts', 'ReaderCoreGateway', errors);
  const Local = actual('features/bookshelf/application/LocalBookImportGateway.ts', 'LocalBookImportGateway', { ...errors, ReaderCoreGateway: Core });
  const noRemoval = { blocked: false };
  class RemovalReadPort { async recover() { return noRemoval; } }
  const Flow = actual('features/bookshelf/application/BookshelfFlowGateway.ts', 'BookshelfFlowGateway', {
    ...errors, ReaderCoreGateway: Core, LocalBookImportGateway: Local, BookshelfRemovalGateway: RemovalReadPort, projectPersistedReceipt, ReaderWriteEvidence,
  });
  const presentation = actual('features/bookshelf/presentation/LocalImportPresentationOwner.ts', '({LocalImportPresentation,LocalImportPresentationOwner,LOCAL_IMPORT_PRESENTATION_KEY})');
  const removalTypes = actual('features/bookshelf/application/BookshelfManagementIntentStore.ts', '({isBookshelfRemovalMethod})');
  const operation = actual('features/bookshelf/application/BookshelfOperationOwner.ts', '({BookshelfOperationOwner,EMPTY_BOOKSHELF_OPERATION_SNAPSHOT})', {
    ...presentation, ...removalTypes, ReaderRuntimeOwner: Runtime, BookshelfFlowGateway: Flow, ReaderWriteEvidence, projectPersistedReceipt,
    BookshelfRemovalGateway: RemovalReadPort, BookshelfManagementIntentStore: { forRuntime: () => ({ snapshot: () => noRemoval }) },
  });
  const owner = new operation.BookshelfOperationOwner(runtime), stored = new Map();
  const AppStorage = { get: key => stored.get(key), setOrCreate: (key, value) => stored.set(key, value) };
  const Mutation = actual('features/bookshelf/presentation/BookshelfMutationPresentation.ets', 'BookshelfMutationPresentation', {
    ...operation, ...presentation, AppStorage, Observed: type => type,
    readerRecoveryView: actual('app/ReaderRecoveryProjection.ts', 'readerRecoveryView'),
  });
  let unsubscribe;
  function attach(instance, restore) {
    const root = { instance, retired: false, route: 'bookshelf', navigation: 1, mounting: instance, inputAllowed: true };
    const scope = { host: () => ({ operations: () => owner }), owner: () => runtime, isCurrentOwner: candidate => Runtime.isCurrent(candidate),
      route: () => root.route, generation: () => root.navigation, mounting: () => root.mounting, instance: () => instance,
      retired: () => root.retired, pickerInputAllowed: () => root.inputAllowed, filter: () => filter,
      invalidate() {}, refreshShelf() {}, apply() {}, feedback() {} };
    const mutation = new Mutation(scope); unsubscribe = owner.subscribe(snapshot => mutation.accept(snapshot, runtime));
    f.root = root; f.mutation = mutation;
    if (restore) mutation.restore(); else mutation.openImport();
  }
  attach(1, false);
  return Object.assign(f, { owner, runtime, input, host, Flow, Local,
    start: () => f.mutation.selectImport(owner.current().importIdentity, f.root.navigation, () => f.caller),
    close: () => f.mutation.closeImport(), reopen: () => f.mutation.openImport(),
    remount: () => { f.root.retired = true; f.caller = false; unsubscribe(); attach(2, true); },
  });
}

for (const id of selectContractCases(definitions)) {
  if (id === 'retired-opening-before-launch') for (const mode of ['closed', 'reopened', 'route-departed']) {
    const f = fixture(), oldIdentity = f.owner.current().importIdentity, work = f.start(); await until(() => f.recoveryEntered);
    assert.equal(f.owner.current().importPresentation.state, 'pickerOpening'); assert.equal(f.native.length, 0);
    if (mode === 'route-departed') f.root.route = 'reading';
    else { f.close(); if (mode === 'reopened') f.reopen(); }
    f.recovery.resolve(); await tick();
    assert.equal(f.native.length, 0, mode + ': retired opening cannot launch a same-window Native picker after StageRecovery');
    await work; assert.equal(f.owner.current().busy, false); assert.deepEqual(f.calls, []); assert.deepEqual(f.stageInputs, []);
    if (mode === 'reopened') {
      assert.notEqual(f.owner.current().importIdentity, oldIdentity); assert.equal(f.owner.current().importPresentation.state, 'fileSelection');
      const fresh = f.start(); await until(() => f.native.length === 1); f.nativeJobs[0].resolve([]); await fresh;
      assert.equal(f.owner.current().importPresentation.state, 'fileSelection', 'new opening still admits its own cancellation normally');
    }
  }
  if (id === 'new-root-same-opening') {
    const f = fixture(), identity = f.owner.current().importIdentity, work = f.start(); await until(() => f.recoveryEntered);
    f.remount(); assert.equal(f.owner.current().importIdentity, identity); assert.equal(f.caller, false);
    f.recovery.resolve(); await tick();
    assert.equal(f.native.length, 1, 'new Root adapter retains the original opening without the retired caller lease');
    assert.equal(f.native[0].pending, true);
    f.nativeJobs[0].resolve([]); await work; assert.equal(f.owner.current().importIdentity, identity);
    assert.equal(f.owner.current().importPresentation.state, 'fileSelection'); assert.equal(f.owner.current().busy, false);
  }
  if (id === 'covered-input-before-launch') {
    for (const mode of ['still-covered', 'replacement-input-restored', 'foreground-restored']) {
      const f = fixture(), work = f.start(); await until(() => f.recoveryEntered);
      f.root.inputAllowed = false;
      if (mode === 'replacement-input-restored') f.remount();
      if (mode === 'foreground-restored') {
        Activity.setForeground(false); f.caller = false;
        f.root.inputAllowed = true; Activity.setForeground(true);
      }
      f.recovery.resolve(); await tick();
      if (mode === 'still-covered') { assert.equal(f.native.length, 0, 'same-window covered input cannot launch a Native picker'); await work; assert.deepEqual(f.calls, []); }
      else { assert.equal(f.native.length, 1, 'latest replacement input adapter restores Native launch'); f.nativeJobs[0].resolve([]); await work; assert.equal(f.owner.current().busy, false); }
    }
  }
  if (id === 'accepted-picker-and-release') for (const mode of ['background', 'covered', 'closed']) {
    const f = fixture(), work = f.start(); f.recovery.resolve(); await until(() => f.native.length === 1);
    if (mode !== 'closed') {
      if (mode === 'background') Activity.setForeground(false);
      f.root.inputAllowed = false; f.caller = false;
    } else f.close();
    assert.equal(Activity.isPending(), true, 'accepted Native invocation is not cancelled by later caller invalidation');
    f.nativeJobs[0].resolve(['file://provider/original.txt']); await work;
    assert.equal(f.stageInputs.length, 1, 'already accepted selection keeps original authorized staging'); assert.equal(Activity.isPending(), false);
    if (mode === 'closed') { assert.deepEqual(f.released, [f.input]); assert.deepEqual(f.calls, []); }
    else { assert.equal(f.released.length, 0); assert.equal(f.calls.filter(c => c.method === 'import.persist').length, 1);
      assert.equal(f.owner.current().importPresentation.state, 'result'); assert.equal(f.owner.current().receipt.receipt.confirmation, 'confirmed'); }
  }
  if (id === 'accepted-write-completes') {
    const f = fixture(); f.persistPause = deferred(); const work = f.start(); f.recovery.resolve(); await until(() => f.native.length === 1);
    f.nativeJobs[0].resolve(['file://provider/original.txt']); await until(() => f.calls.some(c => c.method === 'import.persist'));
    f.close(); f.reopen(); const replacement = f.owner.current().importIdentity;
    Activity.setForeground(false); f.caller = false; f.persistPause.resolve(); await work;
    assert.equal(f.calls.filter(c => c.method === 'import.persist').length, 1); assert.equal(f.calls.filter(c => c.method === 'bookshelf.add').length, 1);
    assert.equal(f.calls.filter(c => c.method === 'import.finalize').length, 1); assert.deepEqual(f.commits, [f.input]); assert.deepEqual(f.released, []);
    assert.equal(f.owner.current().receipt.receipt.confirmation, 'confirmed'); assert.equal(f.owner.current().busy, false);
    assert.equal(f.owner.current().importIdentity, replacement); assert.equal(f.owner.current().importPresentation.state, 'fileSelection', 'old write cannot publish a result into reopened UI');
  }
  if (id === 'mandatory-forwarding-and-retirement') {
    const { ts } = installedEtsCompiler();
    for (const [path, name] of [['app/ReaderHostRegistry.ts', 'ReaderHostRegistry'], ['app/ReaderRuntimeOwner.ts', 'ReaderRuntimeOwner'],
      ['features/bookshelf/application/BookshelfFlowGateway.ts', 'BookshelfFlowGateway'], ['features/bookshelf/application/LocalBookImportGateway.ts', 'LocalBookImportGateway']]) {
      const source = readFileSync(file(path), 'utf8'), tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
      const klass = tree.statements.find(s => s.name?.text === name), method = klass.members.find(m => m.name?.getText(tree) === 'selectLocalBookInputs');
      assert.equal(method.parameters.length, 1, name + ': original caller predicate mandatory');
      assert.equal(method.parameters[0].questionToken, undefined); assert.equal(method.parameters[0].initializer, undefined);
      assert.equal(method.parameters[0].type.getText(tree), '() => boolean');
      assert.equal(klass.members.some(m => m.name?.getText(tree) === 'importFromSystemPicker'), false, 'unconsumed picker bypass is retired');
    }
    const ownerSource = readFileSync(file('features/bookshelf/application/BookshelfOperationOwner.ts'), 'utf8');
    const ownerTree = ts.createSourceFile('BookshelfOperationOwner.ts', ownerSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const ownerClass = ownerTree.statements.find(s => s.name?.text === 'BookshelfOperationOwner');
    for (const [name, inputIndex] of [['openImport', 1], ['restoreImport', 2]]) {
      const parameter = ownerClass.members.find(m => m.name?.getText(ownerTree) === name).parameters[inputIndex];
      assert.equal(parameter.type.getText(ownerTree), '() => boolean');
      assert.equal(parameter.questionToken, undefined); assert.equal(parameter.initializer, undefined, name + ': input predicate is explicit');
    }
    const scopeSource = readFileSync(file('features/bookshelf/presentation/BookshelfMutationPresentation.ets'), 'utf8');
    const scopeTree = ts.createSourceFile('BookshelfMutationPresentation.ets', scopeSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS);
    const scope = scopeTree.statements.find(s => s.name?.text === 'BookshelfMutationScope');
    const inputSlot = scope.members.find(m => m.name?.getText(scopeTree) === 'pickerInputAllowed');
    assert.equal(inputSlot.type.getText(scopeTree), '() => boolean'); assert.equal(inputSlot.questionToken, undefined);
    const f = fixture(), chain = new f.Flow(f.runtime, filter); f.recovery.resolve();
    await assert.rejects(chain.selectLocalBookInputs(() => false), /opening.*current/); assert.equal(f.native.length, 0);
    const foreign = { original: 'throwing launch predicate' };
    await assert.rejects(chain.selectLocalBookInputs(() => { throw foreign; }), e => e === foreign); assert.equal(f.native.length, 0);
    assert.equal(Activity.isPending(), false);
  }
  Activity.destroy(); await tick(); recordContractCasePass(id);
}
