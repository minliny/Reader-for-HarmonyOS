import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  readerAppearanceParagraphContentScalarOffset,
  readerAppearanceParagraphDisplayText,
  readerAppearanceParagraphIndentPrefix,
} from '../entry/src/main/ets/features/reading/ReaderAppearanceRenderStyle.ts';
import {
  collectReadingParagraphUtf16Ranges,
  readingParagraphBoundaryMode,
} from '../entry/src/main/ets/features/reading/ReadingParagraphProjection.ts';

assert.equal(readerAppearanceParagraphIndentPrefix('none'), '');
assert.equal(readerAppearanceParagraphIndentPrefix('single'), '\u3000');
assert.equal(readerAppearanceParagraphIndentPrefix('firstLine'), '\u3000\u3000');
assert.equal(readerAppearanceParagraphDisplayText('正文', true, 'firstLine'), '\u3000\u3000正文');
assert.equal(readerAppearanceParagraphDisplayText('续行', false, 'firstLine'), '续行');

// The two display-only U+3000 scalars must never enter Core progress,
// bookmark, highlight, or pagination anchors.
assert.equal(readerAppearanceParagraphContentScalarOffset(0, 12, true, 'firstLine'), 0);
assert.equal(readerAppearanceParagraphContentScalarOffset(2, 12, true, 'firstLine'), 0);
assert.equal(readerAppearanceParagraphContentScalarOffset(8, 12, true, 'firstLine'), 6);
assert.equal(readerAppearanceParagraphContentScalarOffset(8, 12, false, 'firstLine'), 8);
assert.equal(readerAppearanceParagraphContentScalarOffset(99, 12, true, 'firstLine'), 12);

assert.equal(readingParagraphBoundaryMode('local', 'TXT'), 'lineSeparated');
assert.equal(readingParagraphBoundaryMode('local', ' txt '), 'lineSeparated');
assert.equal(readingParagraphBoundaryMode('local', 'local'), 'lineSeparated');
assert.equal(readingParagraphBoundaryMode('local', ' LOCAL '), 'lineSeparated');
assert.equal(readingParagraphBoundaryMode('local', 'EPUB'), 'blankLineSeparated');
assert.equal(readingParagraphBoundaryMode('remote-source', 'TXT'), 'lineSeparated');
assert.equal(readingParagraphBoundaryMode('remote-source', undefined), 'lineSeparated');

// CRLF is one logical newline, including when replacement rules introduce it
// into structured book text. Preserve exact original UTF-16 offsets.
for (const newline of ['\n', '\r', '\r\n']) {
  for (const blank of ['', ' ', '\t', ' \t ']) {
    const body = `甲😀${newline}段内续行${newline}${blank}${newline}乙e\u0301`;
    const paragraphs = collectReadingParagraphUtf16Ranges(body, 'blankLineSeparated');
    assert.deepEqual(paragraphs.map(range => body.slice(range.startUtf16, range.endUtf16)),
      [`甲😀${newline}段内续行`, '乙e\u0301']);
    assert.equal(paragraphs[1].startUtf16, body.indexOf('乙'));
    assert.equal(paragraphs[1].endUtf16, body.length);
    assert.deepEqual(collectReadingParagraphUtf16Ranges(body, 'lineSeparated')
      .map(range => body.slice(range.startUtf16, range.endUtf16)), ['甲😀', '段内续行', '乙e\u0301']);
  }
}
for (const divider of ['\r\n\n', '\n\r\n', '\r\r', '\n\t\r\n', '\r\n\r\n\r\n']) {
  const body = `甲${divider}乙`;
  assert.deepEqual(collectReadingParagraphUtf16Ranges(body, 'blankLineSeparated')
    .map(range => body.slice(range.startUtf16, range.endUtf16)), ['甲', '乙']);
}
for (const mode of ['lineSeparated', 'blankLineSeparated']) {
  assert.deepEqual(collectReadingParagraphUtf16Ranges('\r\n \t\r\n', mode), []);
  assert.deepEqual(collectReadingParagraphUtf16Ranges('', mode), []);
}
const untrimmed = '甲\r\n\r\n  乙';
assert.deepEqual(collectReadingParagraphUtf16Ranges(untrimmed, 'blankLineSeparated')
  .map(range => untrimmed.slice(range.startUtf16, range.endUtf16)), ['甲', '  乙']);

const txtContent = '第一段\n第二段\r\n\r\n第三段';
const txtRanges = collectReadingParagraphUtf16Ranges(txtContent, 'lineSeparated');
assert.deepEqual(txtRanges.map((range) => txtContent.substring(range.startUtf16, range.endUtf16)), [
  '第一段',
  '第二段',
  '第三段',
]);

// Core's actual local_book.import path emits kind="local", not the "TXT"
// label used by the separate ParsedTxt helper. A later physical page can
// start midway through paragraph one and still contain new paragraphs.
const importedTxt = '上页开始的长段落。\n张浚感激不尽。\n而吕相公言至此处。';
const importedTxtRanges = collectReadingParagraphUtf16Ranges(
  importedTxt, readingParagraphBoundaryMode('local', 'local'));
assert.deepEqual(importedTxtRanges.map(range => importedTxt.slice(range.startUtf16, range.endUtf16)), [
  '上页开始的长段落。', '张浚感激不尽。', '而吕相公言至此处。',
]);
const pageStart = 5;
for (const indent of ['none', 'single', 'firstLine']) {
  const fragments = importedTxtRanges.map(range => {
    const start = Math.max(pageStart, range.startUtf16);
    return readerAppearanceParagraphDisplayText(
      importedTxt.slice(start, range.endUtf16), start === range.startUtf16, indent);
  });
  const prefix = readerAppearanceParagraphIndentPrefix(indent);
  assert.deepEqual(fragments, ['长段落。', `${prefix}张浚感激不尽。`, `${prefix}而吕相公言至此处。`],
    'each actual paragraph gets its configured indent even when the page starts with a continuation');
}

const structuredContent = '第一段\n\n第二段\n同一段内换行\n\n第三段';
const structuredRanges = collectReadingParagraphUtf16Ranges(structuredContent, 'blankLineSeparated');
assert.deepEqual(structuredRanges.map((range) =>
  structuredContent.substring(range.startUtf16, range.endUtf16)), [
  '第一段',
  '第二段\n同一段内换行',
  '第三段',
]);
assert.deepEqual(collectReadingParagraphUtf16Ranges('\n\r\n \t\n', 'lineSeparated'), []);

const remoteContent = '远程第一段\n远程第二段\n远程第三段';
const remoteRanges = collectReadingParagraphUtf16Ranges(
  remoteContent,
  readingParagraphBoundaryMode('remote-source', undefined),
);
assert.deepEqual(remoteRanges.map((range) =>
  remoteContent.substring(range.startUtf16, range.endUtf16)), [
  '远程第一段',
  '远程第二段',
  '远程第三段',
]);

const readingDir = new URL('../entry/src/main/ets/features/reading/', import.meta.url);
const readingSurface = await readFile(new URL('ReadingSurface.ets', readingDir), 'utf8');
const experience = await readFile(new URL('LocalReadingExperience.ets', readingDir), 'utf8');
const detailModel = await readFile(new URL('ReadingBookDetail.ts', readingDir), 'utf8');
const coreGateway = await readFile(
  new URL('../entry/src/main/ets/app/ReaderCoreGateway.ts', import.meta.url),
  'utf8',
);
const readerShell = await readFile(
  new URL('../entry/src/main/ets/features/shell/ReaderShell.ets', import.meta.url),
  'utf8',
);
const indexPage = await readFile(
  new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url),
  'utf8',
);

assert.match(coreGateway, /const kind = this\.optionalString\(book, 'kind'\)/,
  'the Core-owned local format must survive the shelf gateway');
assert.match(coreGateway, /decoded\.kind = kind/,
  'the shelf projection must expose the decoded local format');
assert.match(detailModel, /kind\?: string/,
  'the source-neutral detail model must retain Core book kind');
assert.match(indexPage, /bookKind: this\.detailBook\.kind/,
  'Index must pass the retained kind into the stable reader shell');
assert.match(readerShell, /@Prop bookKind: string \| undefined = undefined/,
  'ReaderShell must retain the book kind while the reading surface remains mounted');
assert.match(readerShell,
  /ReadingExperience\(\{[\s\S]*?bookKind: this\.bookKind/,
  'ReaderShell must pass the retained kind into the reading owner');
assert.match(experience, /@Prop bookKind: string \| undefined = undefined/,
  'the reading owner must admit the Core-owned book kind');
assert.match(experience,
  /collectReadingParagraphUtf16Ranges\([\s\S]*?readingParagraphBoundaryMode\(this\.sourceId, this\.bookKind\)/,
  'pagination must choose TXT line semantics from the admitted Core book kind');

assert.match(readingSurface,
  /Span\(this\.indentPrefix\(\)\)/,
  'the visible paragraph start must render the configured explicit indent prefix');
assert.match(readingSurface,
  /return this\.isParagraphStart \? readerAppearanceParagraphIndentPrefix\(this\.appearance\.indent\) : ''/,
  'the shared paged/continuous text primitive must gate indentation on the canonical paragraph start');
assert.match(experience, /return paragraph\.text === '\\uFFFC' \? 'A' : paragraph\.text/,
  'native paragraph measurement uses exact original text');
assert.match(experience, /indentVp: paragraph\.isParagraphStart/,
  'native paragraph indentation belongs to the original paragraph start');
assert.doesNotMatch(experience, /readerAppearanceParagraphContentScalarOffset\(/,
  'native measurement must not subtract nonexistent placeholder indices');
assert.match(readingSurface, /ReaderNativeParagraphView\(/,
  'paged native paragraphs render through the native window component');
assert.doesNotMatch(experience, /const paragraphDivider =/,
  'the reading owner must not reintroduce an untyped blank-line-only paragraph guess');

console.log('reader paragraph indentation projection: PASS');
