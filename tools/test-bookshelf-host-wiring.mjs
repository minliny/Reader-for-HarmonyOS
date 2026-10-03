import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repo = resolve(new URL('..', import.meta.url).pathname);
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
  'selectBook', 'updateAssignmentGroup', 'assignSelectedBook', 'assignDefaultGroup',
]) {
  assert.match(host, new RegExp(`\\b${method}\\(`), `BookshelfHost must expose ${method}`);
}
assert.match(host, /new BookshelfManagementOrchestrator\(/,
  'BookshelfHost must be the single management orchestrator construction site');
assert.match(host, /new BookshelfManagementGateway\(/,
  'BookshelfHost must own the direct management gateway construction');
assert.match(host, /private readonly owner: \(\) => ReaderRuntimeOwner/,
  'BookshelfHost must resolve the runtime owner lazily');
for (const call of [
  'bookshelfHost.openManagement()', 'bookshelfHost.updateGroupName(',
  'bookshelfHost.updateGroupOrder(', 'bookshelfHost.selectGroup(',
  'bookshelfHost.clearGroupEditor()', 'bookshelfHost.saveGroup()',
  'bookshelfHost.toggleGroupShown(', 'bookshelfHost.deleteGroup(',
  'bookshelfHost.selectBook(', 'bookshelfHost.updateAssignmentGroup(',
  'bookshelfHost.assignSelectedBook()', 'bookshelfHost.assignDefaultGroup(',
]) {
  assert.ok(index.includes(`this.${call}`), `Index must forward ${call}`);
}
assert.match(index, /bookshelfManagementSnapshot = snapshot/,
  'Index must retain the existing management snapshot projection');
console.log('Bookshelf host wiring: PASS (management intents and snapshot projection retained)');
