import assert from 'node:assert/strict';
import { test } from 'node:test';
import { selectedProductionMethods } from './lib/selected-production-methods.mjs';
import { ShelfBookPresentation } from '../entry/src/main/ets/features/bookshelf/presentation/ShelfBookPresentation.ts';

const source = file => new URL(`../entry/src/main/ets/features/${file}.ets`, import.meta.url);

test('body punctuation uses the effective Simplified Chinese script only on API 26', () => {
  let api26 = false;
  let preferred = 'zh-Hans';
  let system = 'zh-Hant-HK';
  let reads = 0;
  const Reader = selectedProductionMethods(source('reading/ui/LocalReadingExperience'), 'ReadingExperience',
    ['resolveNativeBodyPunctuationOverflow', 'paginationLayoutSignature'], {
      readerHarmonyCapabilities: () => ({ api26 }),
      i18n: { System: {
        getAppPreferredLanguage() { reads += 1; return preferred; },
        getSystemLanguage: () => system,
      } },
      createReadingPaginationLayoutSignature: () => 'same-viewport',
      readerAppearanceSnapshotFontFamily: () => 'same-font',
      readerAppearanceFontScale: () => 1,
      readerAppearanceLineHeight: () => 20,
      readerAppearanceParagraphIndent: () => 0,
      FIGMA_BODY_FONT_WEIGHT: 400,
      READING_WRITING_MODE: 'horizontal',
    });
  const reader = new Reader();
  assert.equal(reader.resolveNativeBodyPunctuationOverflow(), false);
  assert.equal(reads, 0, 'lower platforms do not resolve the optional body style');
  api26 = true;
  for (const locale of ['zh-Hans', 'zh-Hans-SG', 'zh-CN']) {
    preferred = locale;
    assert.equal(reader.resolveNativeBodyPunctuationOverflow(), true, locale);
  }
  for (const locale of ['zh-Hant', 'zh-TW', 'ja-JP', 'en-US', '%invalid']) {
    preferred = locale;
    assert.equal(reader.resolveNativeBodyPunctuationOverflow(), false, locale);
  }
  preferred = 'default';
  assert.equal(reader.resolveNativeBodyPunctuationOverflow(), false);
  system = 'zh-Hans-CN';
  assert.equal(reader.resolveNativeBodyPunctuationOverflow(), true);

  Object.assign(reader, { appearanceSnapshot: {}, readingLayout: () => ({ systemFontScale: 1 }) });
  assert.equal(reader.paginationLayoutSignature(), 'native-paragraph-v3|same-viewport');
  reader.nativeBodyPunctuationOverflow = true;
  assert.equal(reader.paginationLayoutSignature(), 'native-paragraph-v3|punctuation-overflow|same-viewport');
});

test('the paged directory preserves the API 23 row and expands only text titles on API 24+', () => {
  let api24 = false;
  const Directory = selectedProductionMethods(source('reading/ui/ReaderDirectoryNavigationSurface'),
    'ReaderDirectoryNavigationSurface', ['titleMaxLines', 'resolvedRowHeight'], {
      readerHarmonyApi24: () => api24,
    });
  const directory = Object.assign(new Directory(), { rowHeight: 44, mangaDisplay: false });
  assert.deepEqual([directory.titleMaxLines(), directory.resolvedRowHeight()], [1, 40]);
  directory.rowHeight = 64;
  assert.deepEqual([directory.titleMaxLines(), directory.resolvedRowHeight()], [1, 64]);
  api24 = true;
  directory.rowHeight = 44;
  assert.deepEqual([directory.titleMaxLines(), directory.resolvedRowHeight()], [2, 56]);
  directory.rowHeight = 64;
  assert.ok(directory.resolvedRowHeight() >= 76, 'two-line large type still reserves an expanded row');
  directory.mangaDisplay = true;
  assert.deepEqual([directory.titleMaxLines(), directory.resolvedRowHeight()], [1, 64]);
});

test('shelf API 24 centers ellipsis only for public source metadata and preserves full source text', () => {
  let distributionVersion = 60100;
  const ellipsis = { END: 'end', get MULTILINE_CENTER() {
    assert.ok(distributionVersion >= 60101, 'lower systems must not reference the new enum member');
    return 'center';
  } };
  const Details = selectedProductionMethods(source('bookshelf/ui/ShelfBookListDetails'), 'ShelfBookListDetails',
    ['secondarySourceName', 'secondaryLabel', 'secondaryEllipsis'], {
      ShelfBookPresentation, readerHarmonyApi24: () => distributionVersion >= 60101,
      EllipsisMode: ellipsis, deviceInfo: {
        get distributionOSApiVersion() { return distributionVersion; },
        get sdkApiVersion() { return distributionVersion >= 60101 ? 24 : 23; },
      },
    });
  const sourceName = '资料整理和长期维护的完整公开书源名称';
  const details = Object.assign(new Details(), { book: {
    sourceId: 'https://catalog.example', sourceName, lastChapter: '新的章节',
  } });
  assert.equal(details.secondaryLabel(), '最新 新的章节');
  assert.equal(details.secondaryEllipsis(), 'end');
  distributionVersion = 60101;
  assert.equal(details.secondaryLabel(), `最新 新的章节 · ${sourceName}`);
  assert.equal(details.secondaryEllipsis(), 'center');
  assert.equal(ShelfBookPresentation.source(details.book), sourceName);
  for (const privateName of ['/data/storage/el2/private/book.txt', '../secret.txt', 'file://internal/secret', details.book.sourceId]) {
    details.book.sourceName = privateName;
    assert.equal(details.secondaryLabel(), '最新 新的章节');
    assert.equal(details.secondaryEllipsis(), 'end');
  }
  details.book = { sourceId: 'local', kind: 'EPUB', chapterCount: 24, sourceName: '/data/storage/private.epub' };
  assert.equal(details.secondaryLabel(), '本地 EPUB · 共 24 章');
  assert.equal(details.secondaryEllipsis(), 'end');
});
