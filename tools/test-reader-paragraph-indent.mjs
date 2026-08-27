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
assert.equal(readingParagraphBoundaryMode('local', 'EPUB'), 'blankLineSeparated');
assert.equal(readingParagraphBoundaryMode('remote-source', 'TXT'), 'lineSeparated');
assert.equal(readingParagraphBoundaryMode('remote-source', undefined), 'lineSeparated');

const txtContent = '第一段\n第二段\r\n\r\n第三段';
const txtRanges = collectReadingParagraphUtf16Ranges(txtContent, 'lineSeparated');
assert.deepEqual(txtRanges.map((range) => txtContent.substring(range.startUtf16, range.endUtf16)), [
  '第一段',
  '第二段',
  '第三段',
]);

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
assert.match(experience,
  /readerAppearanceParagraphDisplayText\([\s\S]*?paragraph\.isParagraphStart[\s\S]*?this\.appearanceSnapshot\.indent/,
  'the hidden measurement text must include the same explicit paragraph-start prefix');
assert.match(experience, /readerAppearanceParagraphContentScalarOffset\(/,
  'display-only indentation must be projected out of canonical Core scalar offsets');
assert.doesNotMatch(readingSurface, /\.textIndent\(/,
  'the line-fragment surface must not rely on paragraph-only textIndent');
assert.doesNotMatch(experience, /\.textIndent\(/,
  'the hidden measurement path must use the same explicit prefix as the visible surface');
assert.doesNotMatch(experience, /const paragraphDivider =/,
  'the reading owner must not reintroduce an untyped blank-line-only paragraph guess');

console.log('reader paragraph indentation projection: PASS');
