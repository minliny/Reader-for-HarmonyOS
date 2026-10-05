import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (relative) => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const detail = read('entry/src/main/ets/features/bookshelf/LocalBookDetail.ets');
const index = read('entry/src/main/ets/pages/Index.ets');
const flow = read('entry/src/main/ets/features/bookshelf/BookshelfFlowGateway.ts');
const operation = read('entry/src/main/ets/features/bookshelf/BookshelfOperationOwner.ts');
const core = read('entry/src/main/ets/app/ReaderCoreGateway.ts');
const removal = read('entry/src/main/ets/features/bookshelf/BookshelfRemovalGateway.ts');
const intent = read('entry/src/main/ets/features/bookshelf/BookshelfManagementIntentStore.ts');
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
assert.match(flow, /new BookshelfRemovalGateway\(this\.owner\)\.remove\(\[\{ sourceId, bookId \}\], false, evidence/);
assert.match(intent, /const value = qualify\(method, intent\.mutation\.params, receipt\.data\);[\s\S]*evidence\?\.confirmed\(\)/,
  'the qualified exact Core ACK establishes confirmation before independent cleanup');
assert.match(removal, /confirmed\(result\);[\s\S]*await this\.cleanup\(id\)/, 'original ACK publishes before finite asset cleanup');
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


assert.match(flow, /async remove\(sourceId: string, bookId: string\)[\s\S]*new BookshelfRemovalGateway\(this\.owner\)\.remove\(\[\{ sourceId, bookId \}\]/);
assert.match(removal, /this\.store\.execute\(method, params/);
assert.match(intent, /request\('bookshelf\.management\.mutation\.apply'/);
assert.match(core, /qualifyBookRemoval\(data: JsonObject\)/);
assert.match(core, /qualifyBookBatchRemoval\(targets: BookshelfRemoveTarget\[\], data: JsonObject\)/);
assert.match(core, /request\('bookshelf\.remove', \{ sourceId, bookId \}\)/);
assert.match(core, /if \(sourceId === 'local'\)[\s\S]*releaseLocalBookAsset\(bookId\)/,
  'only local books own a retained Host archive');
assert.match(host, /async releaseLocalBookAsset\(bookId: string\)[\s\S]*unlinkIfPresent/,
  'Host archive release must remain deterministic and idempotent');

console.log('bookshelf detail removal: PASS');
