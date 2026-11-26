import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SearchViewState } from '../../entry/src/main/ets/features/search/presentation/SearchViewState.ts';

test('returning from detail yields focus exactly once while keeping the shown order', () => {
  const view = new SearchViewState();
  view.reset('归途');
  view.rememberDisplayedOrder('归途', ['shown-first', 'shown-second']);
  view.rememberDetailResult('shown-second');
  view.returnFromDetail();
  assert.equal(view.takeReturningResult(), 'shown-second');
  assert.equal(view.takeReturningResult(), '');
  assert.deepEqual(view.displayedOrderFor('归途'), ['shown-first', 'shown-second']);
  view.reset('另一书名');
  assert.deepEqual(view.displayedOrderFor('归途'), []);
});
