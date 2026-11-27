import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MangaSessionController } from '../../entry/src/main/ets/features/manga/application/MangaSessionController.ts';
import type { MangaPreparedEntry } from '../../entry/src/main/ets/features/manga/application/MangaContract.ts';

test('a native-failed visible tile supports forced retry while a retired tile cannot acquire again', async () => {
  let acquired = 0;
  let failedPreparedAlias: string | undefined;
  let preparedReads = 0;
  const loadSessions: Array<number | undefined> = [];
  const released: string[] = [];
  const ref = 'manga:mp1:' + 'c'.repeat(64);
  // This fixture starts at the prepared Host DTO seam. No Core command is dispatched.
  const entry: MangaPreparedEntry = {
    chapter: {
      chapterIndex: 0, chapterTitle: 'chapter', cached: true, pageStart: 0, totalPages: 1,
      manifest: { chapter: { sourceId: 'source', bookId: 'book', chapterId: 'chapter' },
        sourceRuleVersion: 'source-v1', manifestVersion: 'manifest-v1', decodeRevision: 'identity-v1',
        pages: [{ pageId: 'page', ordinal: 0, resourceRef: ref }] },
      resources: [{ resourceRef: ref, request: { url: 'https://fixture.invalid/page.png' } }],
    },
    progress: { token: { epoch: 1, revision: 0 }, location: null }, targetOrdinal: 0, recoveryRequired: false,
  };
  const controller = new MangaSessionController({
    request: async () => assert.fail('prepared Host rendering does not use a Core RPC'),
    beginMangaDisplaySession: () => 7,
    tryAcquireMangaPreparedImage: () => {
      if (failedPreparedAlias === undefined) return undefined;
      preparedReads++;
      return { pixelMap: undefined, fileUri: failedPreparedAlias, width: 600, height: 600, revision: '1' };
    },
    loadReadingImage: async (_source, _book, _chapter, _version, _image, _base, _network, _current,
      _ref, _position, _rules, _preview, _decode, session) => {
      loadSessions.push(session);
      const revision = `${++acquired}`;
      return { pixelMap: undefined, fileUri: `file:///tile-${revision}.png`, width: 600, height: 600, revision };
    },
    releaseReadingImage: uri => { released.push(uri); },
  });
  const tile = { ordinal: 0, tileIndex: 0 };
  try {
    await controller.openPrepared(entry);
    controller.setNativeViewportTiles([tile]);
    await controller.setTileWindow([]);
    assert.equal(controller.tile(0, 0)?.image?.fileUri, 'file:///tile-1.png');
    await controller.retryTile(0, 0);
    assert.equal(acquired, 1);

    failedPreparedAlias = 'file:///tile-1.png';
    await controller.retryTile(0, 0, true);
    assert.equal(preparedReads, 0);
    assert.equal(acquired, 2);
    assert.deepEqual(loadSessions, [7, undefined]);
    assert.equal(controller.tile(0, 0)?.image?.fileUri, 'file:///tile-2.png');
    assert.deepEqual(released, ['file:///tile-1.png']);

    controller.setNativeViewportTiles([]);
    await controller.setTileWindow([]);
    await controller.retryTile(0, 0, true);
    assert.equal(acquired, 2);
  } finally { await controller.close(); }
});
