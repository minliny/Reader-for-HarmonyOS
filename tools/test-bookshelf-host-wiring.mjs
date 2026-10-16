import { localFilePath } from './lib/tool-environment.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repo = resolve(localFilePath(new URL('..', import.meta.url)));
const index = readFileSync(resolve(repo, 'entry/src/main/ets/pages/Index.ets'), 'utf8');
const host = readFileSync(resolve(repo, 'entry/src/main/ets/features/bookshelf/BookshelfHost.ets'), 'utf8');

assert.match(index, /import \{[\s\S]*BookshelfHost[\s\S]*\} from ['"]\.\.\/features\/bookshelf\/BookshelfHost['"]/,
  'Index must depend on the Bookshelf host boundary');
assert.doesNotMatch(index, /import[^\n]*BookshelfManagementGateway/,
  'Index must not construct the bookshelf management gateway');
assert.doesNotMatch(index, /import[\s\S]*BookshelfManagementOrchestrator/,
  'Index must not import the bookshelf management orchestrator');
assert.doesNotMatch(index, /private getBookshelfManagementOrchestrator\(/,
  'Index must not own bookshelf management orchestrator construction');
for (const method of [
  'openManagement', 'updateGroupName', 'updateGroupOrder', 'selectGroup',
  'clearGroupEditor', 'saveGroup', 'toggleGroupShown', 'deleteGroup',
  'selectBook', 'updateAssignmentGroup', 'assignSelectedBook', 'assignDefaultGroup', 'loadShelfBook', 'upsertBook',
]) {
  assert.match(host, new RegExp(`\\b${method}\\(`), `BookshelfHost must expose ${method}`);
}
assert.match(host, /new BookshelfManagementOrchestrator\(/,
  'BookshelfHost must be the single management orchestrator construction site');
assert.doesNotMatch(host, /new BookshelfManagementGateway\(/,
  'quick assignment must share the original Management owner rather than bypass its tail');
assert.match(host, /getManagementOrchestrator\(\)\?\.assignBookGroup\(book, '', identity\)/);
assert.match(host, /managementOwners: WeakMap<ReaderRuntimeOwner, BookshelfManagementOrchestrator>/);
assert.match(host, /host\.attachPresentation\(identity, this\.emitManagementSnapshot, current\)/);
assert.match(host, /new ReaderCoreGateway\(this\.owner\(\)\)\.loadShelfBook\(/,
  'BookshelfHost must own the bookshelf detail gateway construction');
assert.match(host, /new ReaderCoreGateway\(this\.owner\(\)\)\.upsertBook\(/,
  'BookshelfHost must own the bookshelf upsert gateway construction');
assert.doesNotMatch(index, /new ReaderCoreGateway\(/,
  'Index must not construct a direct Core gateway');
assert.match(host, /private readonly owner: \(\) => ReaderRuntimeOwner/,
  'BookshelfHost must resolve the runtime owner lazily');
for (const method of ['openManagement','updateGroupName','updateGroupOrder','selectGroup','clearGroupEditor','saveGroup','toggleGroupShown','deleteGroup','selectBook','updateAssignmentGroup','assignSelectedBook','reconcileManagement']) {
  assert.match(index, new RegExp(`(?:host|this\\.bookshelfHost)\\.${method}\\(`), `Index retains the captured Host ${method} intent`);
}
assert.match(index, /this\.bookshelfHost\.assignDefaultGroup\(book,/);
assert.match(index, /this\.bookshelfHost\.loadShelfBook\(/);
const readable = readFileSync(resolve(repo, 'entry/src/main/ets/features/bookshelf/BookshelfReadableAdmissionOwner.ts'), 'utf8');
assert.match(index, /this\.bookshelfHost\.readable\(owner\)\.add\(/,
  'Index publishes an exact captured readable intent to its existing Host');
assert.match(host, /new BookshelfReadableAdmissionOwner\(owner\)/,
  'the existing BookshelfHost owns the runtime-bound readable admission owner');
assert.match(readable, /await new ReaderCoreGateway\(this\.owner\)\.upsertBook\(book\)/,
  'the admission owner performs the actual typed Core write');
assert.match(readable, /private readonly owner: ReaderRuntimeOwner/,
  'the accepted write uses the captured owner, never a late current-runtime lookup');
assert.match(index, /bookshelfManagementSnapshot = snapshot/,
  'Index must retain the existing management snapshot projection');
const detailSelectionStart = index.indexOf('private onSearchResultSelected(');
const detailSelectionEnd = index.indexOf('// The search badge describes a saved work', detailSelectionStart);
assert.ok(detailSelectionStart >= 0 && detailSelectionEnd > detailSelectionStart,
  'local search detail selection remains a bounded host boundary');
const localDetailSelection = index.slice(detailSelectionStart, detailSelectionEnd);
assert.match(localDetailSelection, /this\.bookshelfHost\.loadShelfBook\(/,
  'local search detail lookup is routed through BookshelfHost');
assert.doesNotMatch(localDetailSelection, /new ReaderCoreGateway\(owner\)\.loadShelfBook\(/,
  'Index no longer constructs a direct Core gateway for the local detail lookup');
console.log('Bookshelf host wiring: PASS (management intents and snapshot projection retained)');
