import assert from 'node:assert/strict';
import test from 'node:test';
import { bookshelfGroupSelection } from '../../entry/src/main/ets/features/bookshelf/application/BookshelfGroupSelection.ts';

const groups = [{ groupName: '小说', show: true }, { groupName: '漫画', show: true }];

test('the active shelf group closes the dialog without a write', () => {
  assert.equal(bookshelfGroupSelection('', '', groups, false), 'dismiss');
  assert.equal(bookshelfGroupSelection('小说', '小说', groups, false), 'dismiss');
});

test('a known group or default group produces a write, a removed group does not', () => {
  assert.equal(bookshelfGroupSelection('漫画', '小说', groups, false), 'assign');
  assert.equal(bookshelfGroupSelection('', '小说', groups, false), 'assign');
  assert.equal(bookshelfGroupSelection('已移除', '小说', groups, false), 'ignore');
});

test('an in-flight or recovery-blocked write keeps the dialog active', () => {
  assert.equal(bookshelfGroupSelection('小说', '小说', groups, true), 'ignore');
  assert.equal(bookshelfGroupSelection('漫画', '小说', groups, true), 'ignore');
});
