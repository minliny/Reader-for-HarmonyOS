import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

export const searchResultContinuitySourceUrl = new URL(
  '../../entry/src/main/ets/features/search/ui/SearchPage.ets', import.meta.url);

export function readSearchResultContinuitySource() {
  return readFileSync(searchResultContinuitySourceUrl, 'utf8');
}

/** Synthetic DTO facts only; production grouping, keys, callbacks and displayed
 * snapshots below are extracted from the selected actual SearchPage source. */
export function searchContinuityBook(sourceId, intro, searchRequestId = 'query-1', extra = {}) {
  return { sourceId, bookId: sourceId, groupKey: 'retained-book', title: '同一本书', author: '作者',
    sourceName: sourceId, coverUrl: `https://example.test/${sourceId}.jpg`, intro, searchRequestId,
    category: 'novel', ...extra };
}

/** Actual installed SDK ObservedObject/ObjectLink and complete emitted Card.
 * The existing helper instruments subscriber delivery/native attributes, not
 * a renderer. Source overrides are private, explicit negative-control inputs;
 * the production tree and its import locations are never rewritten. */
export async function createSearchResultContinuityProbe({ source = readSearchResultContinuitySource(),
  books = [searchContinuityBook('a', '初始简介')], inBookshelf = false, representative = books[0] } = {}) {
  const { installedEtsCompiler } = await import('./ets-compiler-runtime.mjs');
  const { createArkUIPropertyRuntimeProbe } = await import('./arkui-property-runtime-probe.mjs');
  const { createReaderBuilderProbe } = await import('./reader-control-builder-probe.mjs');
  const { bookTitleAuthorKey, bookAuthorLabel } = await import('../../entry/src/main/ets/app/library/BookAuthorMetadata.ts');
  const { bookIntroText } = await import('../../entry/src/main/ets/app/library/BookIntroText.ts');
  const { readerMediaIdentity } = await import('../../entry/src/main/ets/features/source/application/ReaderSourceCategory.ts');
  const { SearchViewState } = await import('../../entry/src/main/ets/features/search/presentation/SearchViewState.ts');
  const { searchBookSnapshot } = await import('../../entry/src/main/ets/features/search/presentation/SearchBookSnapshot.ts');
  const { SEARCH_RESULT_GEOMETRY } = await import('../../entry/src/main/ets/features/search/ui/SearchResultGeometry.ts');
  const { ts, options, require, root } = installedEtsCompiler();
  const tree = ts.createSourceFile('SearchPage.ets', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  assert.deepEqual(tree.parseDiagnostics, [], 'selected actual search source parses');
  const groupNode = tree.statements.find(node => node.name?.text === 'SearchBookGroup');
  const dataNode = tree.statements.find(node => node.name?.text === 'SearchResultDataSource');
  const pageNode = tree.statements.find(node => node.name?.text === 'SearchPage');
  const cardNode = tree.statements.find(node => node.name?.text === 'SearchResultCard');
  const frameNode = tree.statements.find(node => node.name?.text === 'SearchLayoutFrame');
  assert.ok(groupNode && dataNode && pageNode && cardNode && frameNode, 'actual finite search owners exist');
  const keyMethods = ['resultGroupKey', 'normalizedBookKey'].map(name =>
    pageNode.members.find(node => node.name?.text === name).getText(tree)).join('\n');
  const emitted = ts.transpileModule(`${groupNode.getText(tree).replace(/^@Observed\s*/, '')}\n${dataNode.getText(tree)}\n${frameNode.getText(tree)}\nclass RowKeys { ${keyMethods} }`, {
    fileName: 'RetainedSearchGroups.ts', reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  });
  assert.deepEqual(emitted.diagnostics, [], 'actual group, datasource, frame and row key methods emit');
  const { SearchBookGroup, SearchResultDataSource, SearchLayoutFrame, RowKeys } = new Function('bookTitleAuthorKey', 'readerMediaIdentity',
    'DataOperationType', 'FrameCallback', `${emitted.outputText};return { SearchBookGroup, SearchResultDataSource, SearchLayoutFrame, RowKeys };`)(
      bookTitleAuthorKey, readerMediaIdentity, { ADD: 'add', DELETE: 'delete', CHANGE: 'change', RELOAD: 'reload', MOVE: 'move' }, class {});
  const makeGroup = (variants, onShelf = false, chosen = variants[0]) => {
    const next = new SearchBookGroup(variants[0], 1, onShelf);
    for (const candidate of variants.slice(1)) next.admit(candidate, onShelf);
    next.book = chosen;
    return next;
  };
  const runtime = createArkUIPropertyRuntimeProbe();
  const observed = runtime.sdk.ObservedObject.createNew(makeGroup(books, inBookshelf, representative), undefined);
  const data = new SearchResultDataSource();
  data.replace([observed]);
  const nativeChanges = [];
  data.registerDataChangeListener({ onDatasetChange: operations => nativeChanges.push(...operations) });
  const keys = new RowKeys(), rowKey = keys.resultGroupKey(observed.book);
  require(`${root}/lib/validate_ui_syntax.js`).observedClassCollection.add('SearchBookGroup');
  const viewState = new SearchViewState();
  viewState.reset('第一轮');
  const TouchType = { Down: 'down', Up: 'up', Cancel: 'cancel' };
  const SourceType = { TouchScreen: 'touchscreen', Keyboard: 'keyboard' };
  const pendingFrames = [];
  const members = cardNode.members.filter(node => node.name).map(node => node.name.getText(tree));
  const { owner } = createReaderBuilderProbe(cardNode.getText(tree), members, {
    ...runtime.sdk, SynchedPropertyNesedObjectPU: runtime.sdk.SynchedPropertyNestedObjectPU,
    SearchViewState, SearchLayoutFrame, searchBookSnapshot, SEARCH_RESULT_GEOMETRY, bookIntroText, bookAuthorLabel, TouchType, SourceType,
    uiContext: { postFrameCallback: frame => pendingFrames.push(frame) },
  }, { ...runtime.hooks, allowEmptyBranchAdmission: true });
  const publishProps = () => owner.updateStateVars({ group: observed, queryRevision: viewState.revision, cardWidth: 350 });
  publishProps();
  owner.viewState = viewState;
  const selected = [];
  owner.onSelectResult = (...selection) => selected.push(selection);
  owner.aboutToAppear();
  owner.initialRender();
  // Focus IDs are native attributes. Physical actor retention uses map keys.
  const [buttonElement, button] = [...owner.nodes].find(([, node]) => node.type === 'Button' && node.onClick);
  const imageEntry = [...owner.nodes].find(([, node]) => node.type === 'Image');
  return { source, owner, runtime, data, observed, keys, rowKey, nativeChanges, selected,
    makeGroup, book: searchContinuityBook, viewState, TouchType, SourceType, publishProps,
    buttonElement, button, imageElement: imageEntry?.[0], image: imageEntry?.[1], pendingFrames,
    flushFrames() { while (pendingFrames.length > 0) pendingFrames.shift().onIdle(0); },
  };
}
