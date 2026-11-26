import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const definitions = {
  'author-metadata-retention': { description: 'Actual list retains its empty-or-present author actor and shows local metadata', resources: [] },
};

for (const id of selectContractCases(definitions)) {
  await authorMetadataRetention();
  recordContractCasePass(id);
}

async function authorMetadataRetention() {
  const { createReaderBuilderProbe } = await import('./lib/reader-control-builder-probe.mjs');
  const { createArkUIPropertyRuntimeProbe } = await import('./lib/arkui-property-runtime-probe.mjs');
  const { pureModuleProbe } = await import('./lib/ets-pure-module-probe.mjs');
  const { readerFoundationTokens } = await import('./lib/reader-tokens-probe.mjs');
  const { ShelfBookPresentation } = await import('../entry/src/main/ets/features/bookshelf/presentation/ShelfBookPresentation.ts');
  const fonts = await import('../entry/src/main/ets/ui/foundation/ReaderFontFamilies.ts');
  const read = name => readFileSync(new URL(`../entry/src/main/ets/features/bookshelf/ui/${name}.ets`, import.meta.url), 'utf8');
  const source = read('ShelfBookListDetails');
  const grid = pureModuleProbe(read('BookshelfGridSpec'), 'BookshelfGridSpec.ets', readerFoundationTokens,
    ['bookshelfListTextFrame', 'BOOKSHELF_LIST_COVER_HEIGHT', 'BOOKSHELF_LIST_PROGRESS_STROKE']);
  const constants = [...source.matchAll(/^const (\w+) = \d+;$/gm)];
  const detailConstants = pureModuleProbe(constants.map(match => match[0]).join('\n'), 'ShelfListConstants.ts', {},
    constants.map(match => match[1]));
  const properties = createArkUIPropertyRuntimeProbe();
  const book = { sourceId: 'local', bookId: 'empty-author', title: '书名', author: '',
    kind: 'epub', chapterCount: 12, lastChapter: '本地遗留章节', readProgress: 0 };
  const { owner } = createReaderBuilderProbe(source,
    ['appThemeScheme', 'mangaRevision', 'book', 'textFrame', 'targetHeight', 'moreFocusId',
      'metadataTag', 'updateBadgeLabel', 'positionLabel', 'progressLabel', 'build'],
    { ...properties.sdk, ...fonts, ...grid, ...detailConstants, ShelfBookPresentation, EllipsisMode: { END: 'EllipsisMode.END' } },
    { ...properties.hooks, initialParams: { book } });
  owner.initialRender();
  const texts = [...owner.nodes.values()].filter(node => node.type === 'Text');
  const author = texts.find(node => node.create === '');
  assert.ok(author, 'an empty author keeps its actual text actor');
  assert.deepEqual(texts.map(node => node.create), ['书名', '', '本地', '尚未阅读', '本地 EPUB · 共 12 章', '未读']);
  assert.equal(texts.find(node => node.create === '尚未阅读').fontColor,
    texts.find(node => node.create === '本地 EPUB · 共 12 章').fontColor);
  for (const currentAuthor of ['Reader test', '']) {
    owner.book = { ...book, author: currentAuthor };
    properties.flush();
    owner.replay();
    assert.equal(owner.nodes.get(author.id), author);
    assert.equal(author.create, currentAuthor);
    assert.equal(author.layoutWeight, 1);
  }
}
