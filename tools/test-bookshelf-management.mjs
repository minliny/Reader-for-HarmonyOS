import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(repo, path), 'utf8');

const gateway = read('entry/src/main/ets/features/bookshelf/BookshelfManagementGateway.ts');
const orchestrator = read('entry/src/main/ets/features/bookshelf/BookshelfManagementOrchestrator.ets');
const page = read('entry/src/main/ets/features/bookshelf/BookshelfManagementPage.ets');
const shelfGateway = read('entry/src/main/ets/app/ReaderCoreGateway.ts');
const shelfPage = read('entry/src/main/ets/features/bookshelf/BookshelfPage.ets');
const index = read('entry/src/main/ets/pages/Index.ets');

for (const method of [
  'book-group.list',
  'book-group.create',
  'book-group.update',
  'book-group.delete',
  'bookshelf.group.assign',
  'read-record.list',
]) {
  assert.match(gateway, new RegExp(`request\\('${method.replaceAll('.', '\\.')}'`));
}

assert.match(shelfGateway, /group\?: string/);
assert.match(shelfGateway, /sortIndex\?: number/);
assert.match(shelfGateway, /this\.optionalString\(book, 'group'\)/);
assert.match(orchestrator, /private operationTail: Promise<void> = Promise\.resolve\(\)/);
assert.match(orchestrator, /await this\.gateway\.assignGroup\(book, group\)/);
assert.match(orchestrator, /groups: source\.data\.groups\.slice\(\)/);
assert.doesNotMatch(gateway, /preferences|relationalStore|fileIo/);
assert.match(page, /export struct BookshelfManagementPage/);
// SHF-02 made this page user-reachable from the shelf more-menu, so the
// Legado-parity debug banner became user-facing copy describing the workflow.
assert.match(page, /在此新建分组、为书籍设置归属；分组会出现在书架的筛选行中/);
assert.match(shelfPage, /onManageRequested: \(\) => void/);
// SHF-02 turned the Core group manager into a user-facing shelf-management
// page, and the product decision points the remaining Settings gear at it.
assert.match(shelfPage,
  /this\.sectionAction\('bookshelf_settings', \(\): void => this\.onManageRequested\(\)\)/,
  'the shelf gear must open the shelf management page');
assert.doesNotMatch(shelfPage, /this\.sectionAction\('bookshelf_search'/,
  'the shelf section must not duplicate the AppTopBar search entry');
assert.match(index,
  /onBookshelfSettingsRequested: \(\): void => this\.openSettings\(\)/,
  'the more-menu shelf settings entry still enters the settings flow');
assert.match(index, /'bookshelfManagement'/);
assert.match(index, /route = 'bookshelfManagement'/);
assert.match(index, /BookshelfManagementPage\(\{/);
assert.match(index, /getBookshelfManagementOrchestrator\(\)\.open\(\)/);

console.log('bookshelf management Core ownership contract: PASS');
