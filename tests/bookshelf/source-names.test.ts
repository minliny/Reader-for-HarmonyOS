import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bookshelfSourceDisplayName } from '../../entry/src/main/ets/features/bookshelf/application/BookshelfSourceNameProjection.ts';

test('a durable source name and an explicit removal survive a failed source-list read', () => {
  assert.equal(bookshelfSourceDisplayName('shelf-source', ' 已存书源 ', []), '已存书源');
  assert.equal(bookshelfSourceDisplayName('shelf-source', '书源已移除', [],
    { sourceId: 'shelf-source', sourceName: '旧搜索结果' }), '书源已移除');
});

test('a stale candidate from another source cannot name a bookshelf row', () => {
  assert.equal(bookshelfSourceDisplayName('exact', 'https://source.example.test', [],
    { sourceId: 'other', sourceName: '其他书源' }), '书源名称暂不可用');
  assert.equal(bookshelfSourceDisplayName('local', '', []), '本地书籍');
});
