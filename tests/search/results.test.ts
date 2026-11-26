import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SearchResultProjection } from '../../entry/src/main/ets/features/search/presentation/SearchResultProjection.ts';
import { SearchViewState } from '../../entry/src/main/ets/features/search/presentation/SearchViewState.ts';
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
