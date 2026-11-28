import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SearchResultProjection } from '../../entry/src/main/ets/features/search/presentation/SearchResultProjection.ts';
import { SearchViewState } from '../../entry/src/main/ets/features/search/presentation/SearchViewState.ts';
import {
  cleanDisplaySourceName,
  formatSearchInitialEmptyHint,
  formatSearchSourceSummary,
} from '../../entry/src/main/ets/features/search/presentation/SearchSourceDisplay.ts';
import type { SearchBook } from '../../entry/src/main/ets/features/search/application/SearchGateway.ts';
import type { ShelfBook } from '../../entry/src/main/ets/app/ReaderCoreGateway.ts';

test('shelf readback updates a retained group badge without replacing the visible result', () => {
  const candidates: SearchBook[] = ['one', 'two'].map((sourceId, admittedOrder) => ({
    sourceId, admittedOrder, sourceName: sourceId, bookSourceUrl: sourceId,
    bookId: 'same-url', title: '归途', author: '作者', category: 'novel', detailUrl: 'same-url',
    searchRequestId: 'query', sourceRuleVersion: 'version', variables: [],
  }));
  const projection = new SearchResultProjection();
  const { rows, orderedKeys } = projection.update(candidates, [], '归途', new SearchViewState());
  assert.equal(orderedKeys.length, 1);
  const key = orderedKeys[0];
  const row = rows.get(key)!;
  assert.equal(row.book.sourceId, 'one');
  assert.deepEqual(row.variants.map(book => book.sourceId), ['one', 'two']);
  const shelf: ShelfBook[] = [{ sourceId: 'two', bookId: 'same-url', title: '归途', author: '作者',
    contentKind: 'text', addedAt: 1 }];
  assert.deepEqual(projection.updateRetainedMembership(shelf), new Map([[key, true]]));
  assert.equal(row.inBookshelf, true);
  assert.equal(row.book.sourceId, 'one');
  assert.deepEqual(projection.updateRetainedMembership([]), new Map([[key, false]]));
});

test('cleanDisplaySourceName strips leading decorative emoji and preserves pure emoji fallback', () => {
  assert.equal(cleanDisplaySourceName('🌟免费小说'), '免费小说');
  assert.equal(cleanDisplaySourceName('📚✨ · 起点书源'), '起点书源');
  assert.equal(cleanDisplaySourceName('⭐️ 墨纸文库'), '墨纸文库');
  assert.equal(cleanDisplaySourceName('🌟✨'), '🌟✨');
  assert.equal(cleanDisplaySourceName('青松小说'), '青松小说');
  assert.equal(cleanDisplaySourceName('  '), '');
});

test('formatSearchSourceSummary hides redundant single-source badge and compacts multi-source count', () => {
  assert.deepEqual(formatSearchSourceSummary('🌟免费小说', 1), {
    primarySource: '免费小说',
    multiSourceLabel: '',
  });
  assert.deepEqual(formatSearchSourceSummary('🌟免费小说', 3), {
    primarySource: '免费小说',
    multiSourceLabel: '等 3 个书源',
  });
  assert.deepEqual(formatSearchSourceSummary('', 1), {
    primarySource: '',
    multiSourceLabel: '1 个书源',
  });
  assert.deepEqual(formatSearchSourceSummary('', 2), {
    primarySource: '',
    multiSourceLabel: '发现 2 个书源',
  });
});

test('formatSearchInitialEmptyHint adapts to enabled source count without recommending keywords', () => {
  assert.equal(
    formatSearchInitialEmptyHint(5),
    '暂无搜索历史 · 可搜索本地书架与 5 个已启用书源',
  );
  assert.equal(
    formatSearchInitialEmptyHint(0),
    '暂无搜索历史 · 可输入书名或作者搜索本地与在线书籍',
  );
  assert.equal(
    formatSearchInitialEmptyHint(undefined),
    '暂无搜索历史 · 可输入书名或作者搜索本地与在线书籍',
  );
});
