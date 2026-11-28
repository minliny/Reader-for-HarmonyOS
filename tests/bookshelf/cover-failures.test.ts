import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  BOOK_COVER_FAILURE_TTL_MS,
  parseBookCoverFailureCache,
  pruneBookCoverFailureEntries,
  recordBookCoverFailureEntry,
  rememberBookCoverFailure,
  serializeBookCoverFailureCache,
} from '../../entry/src/main/ets/app/library/BookCoverDisplay.ts';

test('shelf cover failures deduplicate and evict their oldest URL at 256 entries', () => {
  let failures: string[] = [];
  for (let index = 0; index <= 256; index++)
    failures = rememberBookCoverFailure(failures, `https://covers.invalid/${index}.jpg`);

  assert.equal(failures.length, 256);
  assert.equal(failures[0], 'https://covers.invalid/1.jpg');
  assert.equal(failures.at(-1), 'https://covers.invalid/256.jpg');
  assert.equal(rememberBookCoverFailure(failures, failures[12]), failures);
});

test('BookshelfPage disables renderGroup, mounts a single cover layer, avoids green cover gradient, and retains failedCoverUrls on non-empty updates', () => {
  const source = readFileSync(
    new URL('../../entry/src/main/ets/features/bookshelf/ui/BookshelfPage.ets', import.meta.url),
    'utf8',
  );

  assert.equal(/\.renderGroup\s*\(/.test(source), false,
    'BookshelfPage must not enable .renderGroup() on cover actors');

  const coverMatch = /private\s+projectionBookCover\([^\n]*\)\s*\{([\s\S]*?)\n  \}/.exec(source);
  assert.ok(coverMatch, 'projectionBookCover must exist');
  const layerCalls = coverMatch[1].match(/this\.projectionBookCoverLayer\s*\(/g) ?? [];
  assert.equal(layerCalls.length, 1, 'projectionBookCover must mount a single cover layer');

  const layerMatch = /private\s+projectionBookCoverLayer\([^\n]*\)\s*\{([\s\S]*?)\n  \}/.exec(source);
  assert.ok(layerMatch, 'projectionBookCoverLayer must exist');
  assert.equal(/TOK_PRIMARY_GRADIENT_START|TOK_PRIMARY_DARK/.test(layerMatch[1]), false,
    'projectionBookCoverLayer must not paint green primary gradient behind covers');
  assert.match(layerMatch[1], /app\.cover\.placeholder/);
  assert.match(layerMatch[1], /cornerRadius:\s*this\.projectionCoverRadius\(expandedLayout\)/);

  const changedMatch = /private\s+onBooksChanged\s*\(\s*\)\s*:\s*void\s*\{([\s\S]*?)\n\s*\}/.exec(source);
  assert.ok(changedMatch, 'onBooksChanged must exist');
  assert.match(changedMatch[1], /this\.books\.length\s*===\s*0\s*&&\s*this\.continueReading\s*===\s*undefined/);
});

test('BookshelfMultiSelectPage and DiscoverPage bound cover failures and isolate reusable cover images', () => {
  const multiSelectSource = readFileSync(
    new URL('../../entry/src/main/ets/features/bookshelf/ui/BookshelfMultiSelectPage.ets', import.meta.url),
    'utf8',
  );
  assert.match(multiSelectSource, /rememberBookCoverFailure\s*\(/);
  assert.match(multiSelectSource, /ForEach\s*\(\s*\[this\.coverUrl\(this\.currentBook\(book\)\)\s*\?\?\s*''\]/);

  const discoverSource = readFileSync(
    new URL('../../entry/src/main/ets/features/discover/ui/DiscoverPage.ets', import.meta.url),
    'utf8',
  );
  assert.match(discoverSource, /rememberBookCoverFailure\s*\(/);
});

test('persistent cover failure entries expire after TTL, deduplicate, cap at 256, and tolerate corrupt cache JSON', () => {
  const now = 10_000_000_000;
  let entries = recordBookCoverFailureEntry([], 'https://covers.invalid/a.jpg', now - BOOK_COVER_FAILURE_TTL_MS - 1);
  assert.equal(entries.length, 1);
  assert.equal(pruneBookCoverFailureEntries(entries, now).length, 0,
    'expired sample must be dropped once nowMs reaches failedAtMs + TTL');

  entries = recordBookCoverFailureEntry(
    [{ url: 'https://covers.invalid/stale.jpg', failedAtMs: now - BOOK_COVER_FAILURE_TTL_MS }],
    'https://covers.invalid/fresh.jpg',
    now,
  );
  assert.deepEqual(entries.map((entry) => entry.url), ['https://covers.invalid/fresh.jpg']);

  for (let i = 0; i < 260; i += 1) {
    entries = recordBookCoverFailureEntry(entries, `https://covers.invalid/${i}.jpg`, now + i);
  }
  assert.equal(entries.length, 256);
  assert.equal(entries[0].url, 'https://covers.invalid/4.jpg');
  assert.equal(entries.at(-1)?.url, 'https://covers.invalid/259.jpg');

  const roundTripped = parseBookCoverFailureCache(serializeBookCoverFailureCache(entries), now + 260);
  assert.equal(roundTripped.length, 256);
  assert.deepEqual(parseBookCoverFailureCache('{broken-json', now), []);
  assert.deepEqual(pruneBookCoverFailureEntries(entries, now + 260 + BOOK_COVER_FAILURE_TTL_MS), []);
});

test('ReaderFonts preloads NoCover serif font for shelf startup and BookshelfRowDataSource avoids DataOperationType.RELOAD', () => {
  const fontsSource = readFileSync(
    new URL('../../entry/src/main/ets/ui/foundation/ReaderFonts.ets', import.meta.url),
    'utf8',
  );
  assert.match(fontsSource, /READER_SHELF_FONT_FAMILIES[\s\S]*READER_FONT_NOTO_SERIF_SC_BOLD/);

  const dataSource = readFileSync(
    new URL('../../entry/src/main/ets/features/bookshelf/ui/BookshelfPageDataSource.ets', import.meta.url),
    'utf8',
  );
  assert.equal(dataSource.includes('DataOperationType.RELOAD'), false);
});
