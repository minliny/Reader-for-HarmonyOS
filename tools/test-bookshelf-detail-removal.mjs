import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (relative) => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const detail = read('entry/src/main/ets/features/bookshelf/LocalBookDetail.ets');
const index = read('entry/src/main/ets/pages/Index.ets');
const flow = read('entry/src/main/ets/features/bookshelf/BookshelfFlowGateway.ts');
const operation = read('entry/src/main/ets/features/bookshelf/BookshelfOperationOwner.ts');
const core = read('entry/src/main/ets/app/ReaderCoreGateway.ts');
const host = read('entry/src/main/ets/app/ReaderHostRegistry.ts');

assert.match(detail, /@Prop removalEnabled: boolean = true;/);
assert.match(detail, /@Prop inBookshelf: boolean = true;/);
assert.match(detail, /@Prop removing: boolean = false;/);
assert.match(detail, /onRemove: \(identity\?: string\) => void/);
assert.match(detail, /Text\(this\.shelfActionLabel\(\)\)/);
assert.match(detail, /return this\.inBookshelf \? '移除书架' : '加入书架';/,
  'the same admitted detail action must support explicit shelf join and removal');
assert.match(detail, /\.enabled\(this\.removalEnabled && !this\.removing && !this\.cancellingAdd\)/);
assert.match(detail, /if \(this\.removalEnabled && !this\.removing && !this\.cancellingAdd\) \{\s*if \(this\.adding\) this\.onCancelAdd\(identity\);\s*else this\.onRemove\(identity\);/,
  'the destructive visual must dispatch only through the admitted removal callback');

assert.match(index, /onRemove: \(identity\?: string\): void => \{ if \(this\.isCurrentDetailShelfAdmission\(identity\)\) this\.requestDetailShelfMutation\(\)/);
assert.match(index, /if \(this\.detailInBookshelf\) \{\s*this\.requestRemoveDetailBook\(\);/,
  'the detail action must choose add/remove from the current Core-derived shelf state');
assert.match(index, /pendingSourceSwitch === undefined && this\.sourceSwitchHost\?\.blocksExit\(this\.detailBook!\) !== true && !this\.offlineOperationActive/,
  'removal must stay unavailable while source-switch or offline work owns the book');
assert.match(index, /this\.route === 'detail' && this\.isSameDetailBook\(book\) && !this\.readingSessionActive/,
  'the confirmation action must recheck the exact visible book and inactive reader');
assert.match(index, /应用内解析内容、阅读进度和离线任务将一并删除；系统中的原始文件不受影响/,
  'local deletion copy must disclose the Core purge without claiming to delete the system file');
assert.match(index, /书源、阅读进度和已缓存正文不会删除，可再次通过搜索加入书架/,
  'remote deletion copy must disclose that removal is shelf-only');
assert.match(index, /this\.bookshelfHost\.operations\(owner\)\.remove\(/,
  'the page publishes intent to the existing Host-owned finite mutation lane');
assert.match(operation, /new BookshelfFlowGateway\(this\.owner, filter\)/,
  'the domain owner reuses the actual gateway without a second Core contract');
assert.doesNotMatch(index, /request\('bookshelf\.remove'/,
  'Index must not bypass ReaderCoreGateway with a duplicate removal protocol');
assert.match(flow, /confirmed: \(value: boolean\): void => \{ evidence\.confirmed\(\); removed = value; \}/,
  'the actual gateway ACK establishes confirmation before independent cleanup');
assert.match(index, /outcome\.receipt\.receipt\.confirmation === 'confirmed'/,
  'a validated mutation ACK admits the deleted-detail transition');
assert.match(operation, /reconcile[\s\S]*confirmation: receipt\.receipt\.confirmation/,
  'read-only recovery preserves the original confirmation rather than deriving it from absence');
assert.doesNotMatch(index, /reconcileDetailBookRemovalFailure|reconcileShelfBookRemovalFailure/,
  'obsolete exact-key absence inference and compensation paths must be removed');
assert.match(index, /this\.invalidateBookshelfProjection\(\);\s*if \(this\.route === 'detail' && this\.isSameDetailBook\(book\)\) \{\s*this\.returnFromDetail\(\);[\s\S]*?this\.invalidateBookshelfProjection\(\);\s*this\.applyBookshelfState\(shelf\);/,
  'the exact mutation result must replace stale shelf reads when returning from detail (origin-aware dispatch)');
const projection=read('entry/src/main/ets/features/bookshelf/BookshelfProjectionOwner.ts');
assert.match(index,/this\.shelfBooks = snapshot\.books;[\s\S]*this\.isBookshelfVisualAdmitted = snapshot\.visualAdmitted/,'page consumes owner rows and visual admission together');
assert.match(projection,/books, facts, revision:[\s\S]*coreEmpty: state\.kind === 'empty', visualAdmitted: state\.kind === 'populated'/,'an empty removal result clears stale cards and admission in the single owner');


assert.match(flow, /async remove\(sourceId: string, bookId: string\)[\s\S]*this\.bookshelf\.removeBook\(sourceId, bookId,/);
assert.match(core, /request\('bookshelf\.remove', \{ sourceId, bookId \}\)/);
assert.match(core, /if \(sourceId === 'local'\)[\s\S]*releaseLocalBookAsset\(bookId\)/,
  'only local books own a retained Host archive');
assert.match(host, /async releaseLocalBookAsset\(bookId: string\)[\s\S]*unlinkIfPresent/,
  'Host archive release must remain deterministic and idempotent');

console.log('bookshelf detail removal: PASS');
