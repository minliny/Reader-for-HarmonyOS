import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const cases = {
  'cover-continuity': {
    description: 'Actual search Group/DataSource and full SDK Card retain cover/row identity across 60 enrichments, honor displayed and pressed snapshots, and reject stale-query callbacks',
    resources: [],
  },
};

for (const id of selectContractCases(cases)) {
  const { default: assert } = await import('node:assert/strict');
  const { createSearchResultContinuityProbe, readSearchResultContinuitySource, searchContinuityBook: book } =
    await import('./lib/search-result-continuity-probe.mjs');
  const source = readSearchResultContinuitySource();
  const a = book('a', '来源甲简介'), b = book('b', '来源乙简介');
  const textExists = (fixture, value) => [...fixture.owner.nodes.values()].some(node => node.type === 'Text' && node.create === value);
  const update = (fixture, variants, representative = variants[0], onShelf = true) => {
    fixture.data.replace([fixture.makeGroup(variants, onShelf, representative)], new Set([fixture.rowKey]));
    fixture.runtime.flush();
  };
  const sameRow = fixture => {
    assert.equal(fixture.data.getData(0), fixture.observed, 'same-key updates retain the actual Observed group');
    assert.equal(fixture.keys.resultGroupKey(fixture.observed.book), fixture.rowKey, 'actual row key remains stable');
    assert.equal(fixture.owner.nodes.get(fixture.buttonElement), fixture.button, 'native Button actor remains mounted');
    assert.equal(fixture.owner.nodes.get(fixture.imageElement), fixture.image, 'admitted image actor remains mounted');
    assert.deepEqual(fixture.nativeChanges, [], 'metadata-only enrichment emits no structural CHANGE');
  };

  async function continuity(input) {
    const fixture = await createSearchResultContinuityProbe({ source: input, books: [a] });
    update(fixture, [a, b]);
    sameRow(fixture);
    assert.equal(fixture.owner.displaySourceCount(), 2, 'source enrichment reaches ObjectLink');
    assert.equal(fixture.owner.displayInBookshelf(), true, 'bookshelf enrichment reaches displayed facts');
    assert.ok(textExists(fixture, '发现 2 个来源'));
    assert.ok(textExists(fixture, '已在书架'));
    const count = fixture.owner.nodes.size;
    for (let index = 0; index < 60; index++) {
      const representative = { ...(index % 2 === 0 ? b : a), intro: '补充' + index };
      const variants = representative.sourceId === 'a' ? [representative, b] : [a, representative];
      update(fixture, variants, representative);
      sameRow(fixture);
      assert.equal(fixture.owner.nodes.size, count, 'metadata updates do not remount row children');
      assert.equal(fixture.image.create, a.coverUrl, 'better representative must not replace admitted cover URI');
      assert.ok(textExists(fixture, representative.intro), 'idle/offscreen metadata updates actual Text observers');
      fixture.button.onClick({ source: fixture.SourceType.Keyboard });
      const selected = fixture.selected.at(-1);
      assert.deepEqual(selected[0], representative, 'keyboard selection uses the current displayed snapshot');
      assert.deepEqual(selected[1], variants, 'selection snapshots the exact current candidates');
      assert.notEqual(selected[0], representative, 'display selection is a snapshot, not an exposed mutable DTO');
    }

    // Visible text and a physical press belong to their presented snapshots.
    fixture.owner.displayVisibilityHandler()(true, 1);
    const displayed = fixture.owner.displayBook();
    fixture.owner.onCardTouch(fixture.TouchType.Down);
    const pressed = fixture.owner.pressedSelection;
    fixture.owner.onCardTouch(fixture.TouchType.Up);
    assert.equal(fixture.owner.pressedSelection, pressed, 'Up preserves the press until Click is dispatched');
    update(fixture, [{ ...a, intro: '可见期间富化' }, b, book('c', '第三来源')]);
    assert.equal(fixture.owner.displayBook(), displayed, 'visible metadata remains on its presented snapshot');
    assert.equal(fixture.owner.displaySourceCount(), 3, 'source-count fact can enrich without replacing visible text');
    fixture.button.onClick({ source: fixture.SourceType.TouchScreen });
    const selected = fixture.selected.at(-1);
    assert.deepEqual(selected, [pressed.book, pressed.variants, pressed.coverUrl], 'Click consumes the Down snapshot');
    fixture.flushFrames();
    fixture.owner.displayVisibilityHandler()(false, 0);
    fixture.runtime.flush();
    assert.ok(textExists(fixture, '可见期间富化'), 'leaving visibility admits the deferred current metadata');
    sameRow(fixture);
  }

  async function failures(input) {
    const fixture = await createSearchResultContinuityProbe({ source: input, books: [a, b] });
    const oldError = fixture.image.onError;
    fixture.image.onError({});
    fixture.runtime.flush();
    assert.equal(fixture.image.create, b.coverUrl, 'failed cover tries the exact same-group candidate');
    oldError({});
    fixture.runtime.flush();
    assert.equal(fixture.image.create, b.coverUrl, 'late failed-URL callback cannot reject the next URL');
    update(fixture, [a, b], a, false);
    assert.equal(fixture.image.create, b.coverUrl, 'ordinary enrichment does not retry an already rejected URL');

    fixture.image.onError({});
    assert.equal(fixture.observed.coverUrl, '', 'all candidate failures publish the existing empty-cover state');
    // No fake renderer teardown is claimed for the intermediate empty branch.
    // A synchronous subsequent enrichment is flushed once at its final state.
    const c = book('c', '后续候选');
    fixture.data.replace([fixture.makeGroup([a, b, c], false, c)], new Set([fixture.rowKey]));
    fixture.runtime.flush();
    assert.equal(fixture.observed.coverUrl, c.coverUrl, 'later same-group candidate recovers after exhaustion');
    assert.equal(fixture.image.create, c.coverUrl);
    sameRow(fixture);
    const other = fixture.makeGroup([book('other', '另一书', 'query-1', { groupKey: 'other-book' })]);
    assert.equal(other.coverUrl, 'https://example.test/other.jpg', 'other books do not inherit failures or cover choices');
    const empty = book('empty', '无封面', 'query-1', { coverUrl: '  ' });
    assert.equal(fixture.makeGroup([empty, b]).coverUrl, b.coverUrl, 'blank first URL can admit a later candidate');
    assert.equal(fixture.makeGroup([a]).coverUrl, a.coverUrl, 'a fresh group can retry independently');
    const missing = await createSearchResultContinuityProbe({ source: input, books: [empty] });
    assert.equal(missing.image, undefined, 'initial missing cover renders the actual placeholder branch');
    assert.ok([...missing.owner.nodes.values()].some(node => node.type === 'Text' &&
      node.create === empty.title && node.maxLines === 1), 'actual no-cover title remains bounded');
  }

  async function queryAuthority(input) {
    const fixture = await createSearchResultContinuityProbe({ source: input, books: [a, b] });
    const oldError = fixture.image.onError;
    const oldVisibility = fixture.button.onVisibleAreaChange[1];
    fixture.owner.onCardTouch(fixture.TouchType.Down);
    fixture.owner.onCardTouch(fixture.TouchType.Up);
    fixture.viewState.reset('第二轮');
    fixture.data.replace([fixture.makeGroup([{ ...a, searchRequestId: 'query-2' },
      { ...b, searchRequestId: 'query-2' }])], new Set([fixture.rowKey]));
    fixture.publishProps(); // Actual parent payload includes the mandatory ObjectLink.
    fixture.runtime.flush();
    sameRow(fixture);
    const facts = fixture.owner.displayedFacts, url = fixture.observed.coverUrl;
    oldError({});
    oldVisibility(true, 1);
    fixture.button.onClick({ source: fixture.SourceType.TouchScreen });
    fixture.runtime.flush();
    assert.equal(fixture.observed.coverUrl, url, 'old-query image callback cannot reject reused URL');
    assert.equal(fixture.owner.displayedFacts, facts, 'old-query visibility cannot replace current facts');
    assert.equal(fixture.owner.displayVisible, false, 'old-query visibility cannot claim the row');
    assert.deepEqual(fixture.selected, [], 'retired touch must not select the new query occupant');

    fixture.button.onClick({ source: fixture.SourceType.Keyboard });
    assert.equal(fixture.selected.at(-1)[0].searchRequestId, 'query-2', 'current keyboard action remains usable');
    fixture.owner.onCardTouch(fixture.TouchType.Down);
    const freshPress = fixture.owner.pressedSelection;
    fixture.flushFrames();
    assert.equal(fixture.owner.pressedSelection, freshPress, 'old queued Up cleanup cannot retire a new press');
    fixture.owner.onCardTouch(fixture.TouchType.Up);
    fixture.button.onClick({ source: fixture.SourceType.TouchScreen });
    fixture.flushFrames();
    assert.equal(fixture.selected.at(-1)[0].searchRequestId, 'query-2', 'current touchscreen action remains usable');
    fixture.owner.displayVisibilityHandler()(true, 1);
    assert.equal(fixture.owner.displayVisible, true, 'current visibility callback keeps authority');
    fixture.image.onError({});
    fixture.runtime.flush();
    assert.equal(fixture.observed.coverUrl, b.coverUrl, 'current-query failure advances to a current candidate');
  }

  await continuity(source);
  await failures(source);
  await queryAuthority(source);

  const replaceOnce = (needle, replacement) => {
    assert.equal(source.split(needle).length - 1, 1, 'negative-control target is unique in actual source');
    return source.replace(needle, replacement);
  };
  const rejected = async (name, mutated, check, message) => {
    await assert.rejects(() => check(mutated), error => error?.code === 'ERR_ASSERTION' && message.test(error.message),
      name + ': the exact behavior assertion must reject this private source mutant');
    console.log(JSON.stringify({ kind: 'reader-negative-control', name, status: 'REJECTED' }));
  };
  await rejected('replace-retained-group',
    replaceOnce('        nextItems.push(retained);', '        nextItems.push(next);'),
    continuity, /same-key updates retain/);
  await rejected('replace-admitted-cover',
    replaceOnce('    if (newRequest) retained.resetCoverFailures();\n    retained.refreshCover();',
      '    if (newRequest) retained.resetCoverFailures();\n    retained.coverUrl = next.book.coverUrl?.trim() ?? \'\';\n    retained.refreshCover();'),
    continuity, /better representative must not replace/);
  await rejected('old-query-image-authority',
    replaceOnce('if (this.group === group && group.book.searchRequestId === requestId) group.rejectCover(url);',
      'if (this.group === group) group.rejectCover(url);'),
    queryAuthority, /old-query image callback cannot reject/);
  await rejected('retired-touch-falls-through',
    replaceOnce('    if (source === SourceType.TouchScreen && pressed === undefined) return;', ''),
    queryAuthority, /retired touch must not select/);

  recordContractCasePass(id);
}
