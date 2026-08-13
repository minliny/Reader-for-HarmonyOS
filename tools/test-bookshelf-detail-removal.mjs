import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (relative) => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const detail = read('entry/src/main/ets/features/bookshelf/LocalBookDetail.ets');
const index = read('entry/src/main/ets/pages/Index.ets');
const flow = read('entry/src/main/ets/features/bookshelf/BookshelfFlowGateway.ts');
const core = read('entry/src/main/ets/app/ReaderCoreGateway.ts');
const host = read('entry/src/main/ets/app/ReaderHostRegistry.ts');

assert.match(detail, /@Prop removalEnabled: boolean = true;/);
assert.match(detail, /@Prop removing: boolean = false;/);
assert.match(detail, /onRemove: \(\) => void/);
assert.match(detail, /Text\(this\.removing \? '正在移除…' : '移除书架'\)/);
assert.match(detail, /\.enabled\(this\.removalEnabled && !this\.removing\)/);
assert.match(detail, /if \(this\.removalEnabled && !this\.removing\) \{\s*this\.onRemove\(\);/,
  'the destructive visual must dispatch only through the admitted removal callback');

assert.match(index, /onRemove: \(\): void => this\.requestRemoveDetailBook\(\)/);
assert.match(index, /pendingSourceSwitch === undefined && this\.offlineMutationActiveKey\.length === 0/,
  'removal must stay unavailable while source-switch or offline work owns the book');
assert.match(index, /this\.route === 'detail' && this\.isSameDetailBook\(book\) && !this\.readingSessionActive/,
  'the confirmation action must recheck the exact visible book and inactive reader');
assert.match(index, /应用内解析内容、阅读进度和离线任务将一并删除；系统中的原始文件不受影响/,
  'local deletion copy must disclose the Core purge without claiming to delete the system file');
assert.match(index, /书源、阅读进度和已缓存正文不会删除，可再次通过搜索加入书架/,
  'remote deletion copy must disclose that removal is shelf-only');
assert.match(index, /new BookshelfFlowGateway\(owner\)[\s\S]*gateway\.remove\(book\.sourceId, book\.bookId\)/,
  'the page must reuse the feature gateway instead of issuing a second Core contract');
assert.doesNotMatch(index, /request\('bookshelf\.remove'/,
  'Index must not bypass ReaderCoreGateway with a duplicate removal protocol');
assert.match(index, /loadShelfBook\(book\.sourceId, book\.bookId\)/,
  'a post-commit Host failure must be reconciled by the exact composite shelf key');
assert.match(index, /await owner\.releaseLocalBookAsset\(book\.bookId\)/,
  'local Host cleanup must get one idempotent retry after Core proves the book absent');
assert.match(index, /The exact key already proved the destructive Core commit[\s\S]*this\.returnToBookshelf\(\)/,
  'a failed post-commit shelf refresh must not leave the deleted detail route visible');
assert.match(index, /this\.bookshelfLoadGeneration \+= 1;[\s\S]*this\.returnToBookshelf\(\);[\s\S]*this\.applyBookshelfState\(shelf\)/,
  'the exact mutation result must replace stale shelf reads when returning from detail');
assert.match(index, /this\.shelfBooks = state\.shelf\.books;[\s\S]*this\.continueReading = state\.continueReading;[\s\S]*state\.kind !== 'populated'/,
  'an empty removal result must clear stale cards as well as the visual admission flag');

assert.match(flow, /async remove\(sourceId: string, bookId: string\)[\s\S]*this\.bookshelf\.removeBook\(sourceId, bookId\)/);
assert.match(core, /request\('bookshelf\.remove', \{ sourceId, bookId \}\)/);
assert.match(core, /if \(sourceId === 'local'\)[\s\S]*releaseLocalBookAsset\(bookId\)/,
  'only local books own a retained Host archive');
assert.match(host, /async releaseLocalBookAsset\(bookId: string\)[\s\S]*unlinkIfPresent/,
  'Host archive release must remain deterministic and idempotent');

console.log('bookshelf detail removal: PASS');
