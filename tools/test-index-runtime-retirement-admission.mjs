import { resolveEtsLoaderRoot, virtualFilePath } from './lib/tool-environment.mjs';
import { bookshelfOperationClass } from './lib/bookshelf-operation-owner-probe.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { selectedProductionMethods } from './lib/selected-production-methods.mjs';
import { runtimeOwnerIdentityProbe } from './lib/reader-runtime-admission-probe.mjs';
import { JsonImportPresentation } from './lib/json-import-presentation-probe.mjs';
import { ReaderLibraryAcquisitionBinding } from '../entry/src/main/ets/app/composition/ReaderLibraryAcquisitionBinding.ts';
import { readerRecoveryView } from '../entry/src/main/ets/app/ReaderRecoveryProjection.ts';

const path = new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url);
const source = readFileSync(path, 'utf8');
const sdk = resolveEtsLoaderRoot();
const require = createRequire(import.meta.url);
const ts = require(sdk + '/node_modules/typescript');
const options = require(sdk + '/lib/ets_checker.js').compilerOptions;
const tree = ts.createSourceFile(virtualFilePath('Index.ets'), source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
assert.deepEqual(tree.parseDiagnostics, []);
const current = node => ts.isCallExpression(node) &&
  node.expression.getText(tree) === 'ReaderRuntimeOwner.current' && node.arguments.length === 0;
function visit(node) {
  if (ts.isBinaryExpression(node) &&
      [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(node.operatorToken.kind)) {
    assert.equal(current(node.left) || current(node.right), false,
      'late identity checks use authoritative static admission without invoking the throwing getter');
  }
  ts.forEachChild(node, visit);
}
visit(tree);

let installed;
const Runtime = runtimeOwnerIdentityProbe(() => installed);
const BookshelfMutationPresentation = bookshelfOperationClass(
  'features/bookshelf/presentation/BookshelfMutationPresentation.ets', 'BookshelfMutationPresentation',
  { Observed: value => value, EMPTY_BOOKSHELF_OPERATION_SNAPSHOT: {}, readerRecoveryView });
const ActualBookshelfHost = bookshelfOperationClass('features/bookshelf/application/BookshelfHost.ets', 'BookshelfHost');
const Index = selectedProductionMethods(path, 'Index',
  ['isCurrentRuntime', 'aboutToDisappear', 'dismissJsonImport', 'retireSourceSwitchPresentation', 'libraryAcquisition', 'shelfMutations'],
  { State() {}, ReaderRuntimeOwner: Runtime, BookshelfMutationPresentation, ReaderLibraryAcquisitionBinding });
function fixture() {
  const calls = [];
  const retire = { retire() {} };
  const dispose = { dispose() {} };
  function runtime(label) {
    return {
      bookAcquisitions: () => ({
        subscribe: () => () => calls.push(label + '-unsubscribe'),
        endSearch: () => calls.push(label + '-search'),
      }),
      readingEntryPreparations: () => ({
        setPaused(paused) { assert.equal(paused, true); calls.push(label + '-pause'); },
      }),
    };
  }
  const old = runtime('old');
  installed = old;
  const index = Object.assign(new Index(), {
    bookshelfHost: new ActualBookshelfHost(() => {}, () => false), mountedRuntimeOwner: old,
    sourceSwitchPresentation: { retireMangaRecovery() {} }, sourceSwitchJourney: retire,
    entryStartupTrace: retire, mangaPositions: retire,
    readingExitActions: dispose, transientFeedback: { reset() {} }, downloadPresentation: dispose,
    readingCommits: retire, navigationOwner: retire, settingsPresentation: dispose, sourceJourney: retire,
    nativeAlertOwner: retire, shelfCatalog: retire, shelfManagement: retire, shelfGroupPresentation: retire,
    discoverPresentation: retire, rulesPresentation: retire, syncPresentation: retire,
    bookRemovalConfirmation: { dismiss() {} }, jsonImportPresentation: new JsonImportPresentation(),
    shelfRead: retire, detailShelf: { detach() {} }, rssJourney: retire,
    readingEntry: { clearExitRequest() {}, retire(pause) { assert.equal(pause, false); } },
    librarySearch: { ...dispose, model: { verification: {} } },
  });
  index.shelfMutations.owner = old;
  index.shelfMutations.snapshot = { receipt: { receipt: { confirmation: 'unknown' } } };
  index.libraryAcquisition.mount(old, {
    ownsRuntime: owner => index.isCurrentRuntime(owner),
    detailBook: () => undefined, refreshShelf: assert.fail, refreshMembership: assert.fail, refreshDetail: assert.fail,
  });
  return { index, old, calls, runtime };
}
{
  const { index, old, calls } = fixture();
  assert.equal(index.isCurrentRuntime(undefined), false);
  assert.equal(index.isCurrentRuntime(old), true);
  assert.equal(index.shelfMutations.hasUnknownWrite(), true);
  installed = undefined;
  assert.throws(() => Runtime.current(), /installed by EntryAbility/);
  assert.equal(index.isCurrentRuntime(old), false);
  assert.equal(index.shelfMutations.hasUnknownWrite(), false);
  assert.equal(index.shelfMutations.recovery().visible, false);
  assert.doesNotThrow(() => index.aboutToDisappear());
  assert.equal(index.mountedRuntimeOwner, undefined);
  assert.deepEqual(calls, ['old-unsubscribe']);
  assert.equal(index.shelfReceiptRetired, true);
}
{
  const { index, calls, runtime } = fixture();
  installed = runtime('new');
  assert.doesNotThrow(() => index.aboutToDisappear());
  assert.deepEqual(calls, ['old-unsubscribe'], 'old Index disconnects its subscription without disturbing either runtime');
}
{
  const { index, calls } = fixture();
  index.aboutToDisappear();
  assert.deepEqual(calls, ['old-unsubscribe', 'old-pause', 'old-search'], 'the current captured owner receives cleanup');
  index.aboutToDisappear();
  assert.deepEqual(calls, ['old-unsubscribe', 'old-pause', 'old-search'], 'repeat retirement never reacquires a live owner');
}
assert.match(source, /aboutToAppear\(\): void \{\s*this\.mountedRuntimeOwner = ReaderRuntimeOwner\.current\(\)/,
  'mount captures the authoritative owner');
console.log('Index runtime retirement: PASS (mounted owner, retired recovery, replaced runtime, repeated cleanup)');
