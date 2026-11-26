import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  admitObservedReadingCatalog, hydrateReadingEntryCatalog,
  type ReadingCatalogHydrationHost, type ReadingObservedCatalogHost,
} from '../../entry/src/main/ets/features/reading/application/ReadingChapterCatalogAdmission.ts';
import { ReadingChapterWindow, type ReadingSessionChapter } from '../../entry/src/main/ets/features/reading/application/ReadingChapterWindow.ts';
import type { LocalReadingToc, LocalReadingTocEntry } from '../../entry/src/main/ets/features/reading/application/LocalReadingFlowGateway.ts';
import type { RemoteReadingSession } from '../../entry/src/main/ets/features/reading/application/RemoteReadingFlowGateway.ts';

const sourceId = 'source';
const bookId = 'book';
const rows = (indexes: number[]): LocalReadingTocEntry[] => indexes.map(index =>
  ({ index, title: `Chapter ${index}`, downloadState: 'unknown' }));

function chapter(chapterIndex: number): ReadingSessionChapter {
  return { sourceId, bookId, chapterIndex, chapterTitle: `Chapter ${chapterIndex}`,
    chapterUrl: `https://example.test/${chapterIndex}`, content: 'Full chapter', images: [],
    contentVersion: `content-${chapterIndex}`, extractionVia: 'rule' };
}

function windowAt(indexes: number[], current: number, neighbours: number[] = []): ReadingChapterWindow {
  const window = new ReadingChapterWindow();
  window.configure(sourceId, bookId, indexes);
  window.setCurrent(chapter(current));
  for (const index of neighbours) assert.equal(window.admitNeighbour(chapter(index)), true);
  return window;
}

function catalog(indexes: number[]): RemoteReadingSession {
  return { identity: { sourceId, bookId }, acquisitionMode: 'online', sourceVersion: 'source-v1',
    catalogVersion: 'catalog', contextVersion: 'context', detailUrl: 'https://example.test/book',
    tocUrl: 'https://example.test/book/chapters', book: { title: 'Book', author: 'Author' },
    continuationVariables: [], hostRequirements: [],
    entries: rows(indexes).map(row => ({ index: row.index, title: row.title,
      url: `https://example.test/${row.index}`, variables: [] })),
  };
}

test('simultaneous catalog hydration uses one read and reattaches bodies before paging resumes', async () => {
  const window = windowAt([1, 2], 1, [2]);
  const pending = Promise.withResolvers<LocalReadingToc>();
  const events: string[] = [];
  let tracked: Promise<void> | undefined;
  const host: ReadingCatalogHydrationHost = {
    pending: () => true, task: () => tracked,
    startRequest: () => {
      events.push('start');
      return { isCurrent: () => true, load: () => { events.push('read'); return pending.promise; } };
    },
    currentChapter: () => chapter(1), resumeOnlyChapterIndex: () => undefined,
    installCatalog: (entries, current) => {
      events.push('install');
      window.configure(sourceId, bookId, entries.map(entry => entry.index));
      window.setCurrent(current);
      assert.equal(window.get(2), undefined);
    },
    afterAdmitted: () => {
      assert.equal(window.get(2)?.contentVersion, 'content-2');
      events.push('directory published');
    },
    track: operation => { tracked = operation; events.push('track'); },
    fail: () => assert.fail('current full catalog failed'),
    finish: operation => { assert.equal(operation, tracked); tracked = undefined; events.push('finish'); },
    resumePaging: () => { assert.equal(tracked, undefined); events.push('paging'); },
  };
  const first = hydrateReadingEntryCatalog(window, host);
  const second = hydrateReadingEntryCatalog(window, host);
  assert.deepEqual(events, ['start', 'read', 'track']);
  pending.resolve({ bookId, entries: rows([1, 2, 3]) });
  await Promise.all([first, second]);
  assert.deepEqual(events, ['start', 'read', 'track', 'install', 'directory published', 'finish', 'paging']);
});

test('catalog hydration preserves an allowed historical body and reports a missing current body', async () => {
  const window = windowAt([1], 1);
  const history: LocalReadingTocEntry = { ...rows([1])[0], navigable: false };
  for (const resumeIndex of [1, undefined]) {
    const events: string[] = [];
    const result = hydrateReadingEntryCatalog(window, {
      pending: () => true, task: () => undefined,
      startRequest: () => ({ isCurrent: () => true, load: async () => ({ bookId, entries: [history] }) }),
      currentChapter: () => chapter(1), resumeOnlyChapterIndex: () => resumeIndex,
      installCatalog: entries => { assert.equal(entries[0], history); events.push('install'); },
      afterAdmitted: () => { events.push('published'); }, track: () => { events.push('track'); },
      fail: isCurrent => { assert.equal(isCurrent(), true); events.push('fail'); },
      finish: () => { events.push('finish'); }, resumePaging: () => { events.push('paging'); },
    });
    if (resumeIndex === undefined) {
      await assert.rejects(result, { message: 'READING_CATALOG_CURRENT_CHAPTER_MISSING' });
      assert.deepEqual(events, ['track', 'fail', 'finish']);
    } else {
      await result;
      assert.deepEqual(events, ['track', 'install', 'published', 'finish', 'paging']);
    }
  }
});

test('a late full catalog only releases its tracked receipt', async () => {
  let current = true;
  const pending = Promise.withResolvers<LocalReadingToc>();
  let tracked: Promise<void> | undefined;
  const operation = hydrateReadingEntryCatalog(windowAt([1], 1), {
    pending: () => true, task: () => tracked,
    startRequest: () => ({ isCurrent: () => current, load: () => pending.promise }),
    currentChapter: () => assert.fail('retired response reached admission'),
    resumeOnlyChapterIndex: () => undefined,
    installCatalog: () => assert.fail('retired response installed a catalog'),
    afterAdmitted: () => assert.fail('retired response published a catalog'),
    track: task => { tracked = task; },
    fail: () => assert.fail('success receipt reported as a failure'),
    finish: old => { assert.equal(old, tracked); tracked = undefined; },
    resumePaging: () => assert.fail('retired response resumed paging'),
  });
  current = false;
  pending.resolve({ bookId, entries: rows([1]) });
  await operation;
  assert.equal(tracked, undefined);
});

function observedHost(overrides: Partial<ReadingObservedCatalogHost> = {}): ReadingObservedCatalogHost {
  return { catalogPending: () => true, currentToc: () => rows([1, 2]),
    protectedWindow: () => ({ bodies: [chapter(1)], discardUnprotectedPreparations: () => {} }),
    admitSession: () => true, beginCatalogUpdate: () => {}, installCatalog: () => {}, afterAdmitted: () => {},
    ...overrides,
  };
}

test('an already installed extension restores only protected measured bodies and projects navigability', () => {
  const window = windowAt([1, 2, 3], 1, [2, 3]);
  const source = catalog([1, 2, 3, 4, 5]);
  source.entries[3].navigable = false;
  const events: string[] = [];
  admitObservedReadingCatalog(source, source, chapter(1), sourceId, bookId, window, observedHost({
    protectedWindow: () => ({ bodies: [chapter(1), chapter(2)],
      discardUnprotectedPreparations: () => { events.push('discard unprotected preparations'); } }),
    admitSession: () => { events.push('admit gateway'); return true; },
    beginCatalogUpdate: () => { events.push('clear pending catalog'); },
    installCatalog: (entries, current) => {
      events.push('install');
      assert.equal(entries[3].navigable, false);
      assert.equal(entries[3].downloadState, 'unknown');
      window.configure(sourceId, bookId, entries.filter(entry => entry.navigable !== false).map(entry => entry.index));
      window.setCurrent(current);
    },
    afterAdmitted: () => {
      events.push('release and resume');
      assert.equal(window.get(2)?.contentVersion, 'content-2');
      assert.equal(window.get(3), undefined);
    },
  }));
  assert.deepEqual(events, ['admit gateway', 'discard unprotected preparations', 'clear pending catalog',
    'install', 'release and resume']);
});

test('an observed catalog cannot change the address of a captured gesture body', () => {
  const window = windowAt([1, 2], 1, [2]);
  const source = catalog([1, 2, 3]);
  source.entries[1].url = 'https://example.test/replaced-2';
  admitObservedReadingCatalog(source, source, chapter(1), sourceId, bookId, window, observedHost({
    protectedWindow: () => ({ bodies: [chapter(1), chapter(2)],
      discardUnprotectedPreparations: () => assert.fail('the old speculative state was disturbed') }),
    admitSession: () => assert.fail('the active gesture uses a different body'),
  }));
  assert.equal(window.get(2)?.chapterUrl, 'https://example.test/2');
});
