import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const source = readFileSync(new URL(
  '../entry/src/main/ets/features/reading/ReaderDirectoryList.ets', import.meta.url), 'utf8');

// Run the real lifecycle/watch methods with only the platform size container
// mocked. This checks propagation, not native virtual List measurement/reflow.
function loadList(text = source) {
  assert.equal(text.split('\n  build() {').length, 2);
  const methods = `${text.split('\n  build() {')[0]}\n}`
    .replace(/^import[\s\S]*?;\s*/gm, '')
    .replace(/@(?:Component|Prop|State|BuilderParam)\b\s*/g, '')
    .replace(/@Watch\('[^']+'\)\s*/g, '')
    .replace('export struct ReaderDirectoryList', 'class ReaderDirectoryList');
  class ChildrenMainSize {
    constructor(size) { this.childDefaultSize = size; }
  }
  const pending = [];
  const List = new Function('ChildrenMainSize', 'EdgeEffect', 'setTimeout',
    `${stripTypeScriptTypes(methods)}\nreturn ReaderDirectoryList;`)(ChildrenMainSize, { None: 0 },
    callback => pending.push(callback));
  List.pending = pending;
  return List;
}

function flush(list) {
  while (list.constructor.pending.length > 0) list.constructor.pending.shift()();
}

function checkLifecycle(List) {
  const list = new List();
  const stableSizes = list.itemSizes;
  list.rowHeight = 32;
  list.aboutToAppear();
  assert.equal(list.itemSizes.childDefaultSize, 32, 'first Quick layout cannot keep the Full 40vp extent');
  flush(list);
  for (const height of [32.5, 34.072, 36, 39.999, 40, 37, 32]) {
    list.rowHeight = height;
    list.onRowHeightChanged();
    assert.equal(list.itemSizes, stableSizes, 'a morph updates the existing size container');
    assert.notEqual(list.itemSizes.childDefaultSize, height,
      'the @Watch callback must not mutate ChildrenMainSize during reconciliation');
    flush(list);
    assert.equal(list.itemSizes.childDefaultSize, height,
      'the deferred flush gives every virtual row the same fractional height as the materialized row');
  }
}

function checkRenderWiring(text) {
  assert.match(text, /@Prop @Watch\('onRowHeightChanged'\) rowHeight: number = 40;/,
    'row-height changes must reach the production watcher');
  assert.match(text, /@State private itemSizes: ChildrenMainSize = new ChildrenMainSize\(40\);/,
    'the size container must be observable');
  assert.match(text, /private rowHeightGeneration: number = 0;/,
    'row-height updates must carry a mutation generation');
  assert.match(text, /private rowHeightLifecycleGeneration: number = 0;/,
    'row-height updates must carry a lifecycle generation');
  assert.match(text, /private scheduleRowHeightFlush\(\): void \{[\s\S]*?setTimeout\(\(\): void => \{/,
    'row-height extent writes must be deferred to the next turn');
  assert.equal((text.match(/\.childrenMainSize\(this\.itemSizes\)/g) ?? []).length, 1,
    'the actual List receives exactly one shared extent container');
  assert.equal((text.match(/\.height\(this\.rowHeight\)/g) ?? []).length, 1,
    'materialized ListItem height uses the same source as virtual extent');
  assert.match(text, /LazyForEach\(this\.dataSource/,
    'extent correction must preserve lazy rows and a notified data source');
}

checkLifecycle(loadList());
{
  const list = new (loadList())();
  list.aboutToAppear();
  let reloads = 0;
  list.dataSource.registerDataChangeListener({ onDataReloaded() { reloads++; } });
  list.entries = [{ index: 0, title: '第一章', downloadState: 'unknown' }];
  list.onEntriesChanged();
  assert.equal(list.dataSource.totalCount(), 1, 'hidden empty mount admits later TOC');
  assert.equal(list.dataSource.getData(0).title, '第一章');
  assert.equal(reloads, 1);
  list.onEntriesChanged();
  assert.equal(reloads, 1, 'identical motion prop delivery cannot reload native rows');
  list.entries[0].title = '新章节标题';
  list.onEntriesChanged();
  assert.equal(reloads, 2, 'same-reference business edits notify native data source');
  list.entries = [];
  list.onEntriesChanged();
  assert.equal(list.dataSource.totalCount(), 0, 'intentional empty filter is retained');
}
checkRenderWiring(source);
assert.throws(() => checkLifecycle(loadList(source.replace(
  'if (nextSize !== undefined && this.itemSizes.childDefaultSize !== nextSize) {\n        this.itemSizes.childDefaultSize = nextSize;\n      }',
  'this.itemSizes.childDefaultSize = 40;'))),
  'fixed Full extent regression is detected');
assert.throws(() => checkLifecycle(loadList(source.replace(
  'this.itemSizes.childDefaultSize = initialSize;', 'this.itemSizes.childDefaultSize = 40;'))),
  'missing initial Quick extent synchronization is detected');
assert.throws(() => checkRenderWiring(source.replace('.childrenMainSize(this.itemSizes)', '')),
  'disconnected native List extent is detected');

console.log('reader directory extent: production lifecycle + wiring passed (not native virtualization/anchor acceptance)');
