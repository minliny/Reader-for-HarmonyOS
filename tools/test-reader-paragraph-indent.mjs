import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

export const CONTRACT_CASES = {
  "native-measurement-boundary": {
    "description": "Actual ReadingParagraph indent and LRE native text recipe preserve original Unicode text and start-only indent; no native shaping claim",
    "resources": []
  },
  "paragraph-boundaries": {
    "description": "Actual original UTF16 projection for newline/EOF/Unicode/TXT/EPUB samples; no native pixel claim",
    "resources": []
  }
};

async function case_paragraph_boundaries() {
const { default: assert } = await import('node:assert/strict');
const { readFile } = await import('node:fs/promises');
const {
  readerAppearanceParagraphContentScalarOffset,
  readerAppearanceParagraphDisplayText,
  readerAppearanceParagraphIndentPrefix,
} = await import('../entry/src/main/ets/features/reading/ReaderAppearanceRenderStyle.ts');
const {
  collectReadingParagraphUtf16Ranges,
  readingParagraphBoundaryMode,
} = await import('../entry/src/main/ets/features/reading/ReadingParagraphProjection.ts');
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
// VM regression: a processed EPUB chapter ends in one logical break. ArkUI
// reports the final empty line [22,23) over the previous line's end 23.
// Keep source offsets/content intact, but do not shape its EOF separator.
for (const newline of ['\n', '\r', '\r\n']) {
  for (const suffix of ['', ' \t']) {
    const paragraph = '这是独立的目录验证样书，不包含用户内容。🙂';
    const body = `第一章${newline}${newline}${paragraph}${newline}${suffix}`;
    const ranges = collectReadingParagraphUtf16Ranges(body, 'blankLineSeparated');
    assert.deepEqual(ranges.map(range => body.slice(range.startUtf16, range.endUtf16)), ['第一章', paragraph]);
    assert.equal(ranges[1].startUtf16, body.indexOf(paragraph));
    assert.equal(ranges[1].endUtf16, body.indexOf(paragraph) + paragraph.length);
    assert.equal(body.slice(ranges[1].endUtf16), newline + suffix, 'original separator stays in canonical content');
  }
  const internal = `甲😀${newline} \t乙e\u0301`;
  assert.deepEqual(collectReadingParagraphUtf16Ranges(internal, 'blankLineSeparated'),
    [{ startUtf16: 0, endUtf16: internal.length }],
    'a single logical break followed by text remains inside the original paragraph');
  const withTerminalBreak = internal + newline + ' \t';
  assert.deepEqual(collectReadingParagraphUtf16Ranges(withTerminalBreak, 'blankLineSeparated'),
    [{ startUtf16: 0, endUtf16: internal.length }],
    'only the terminal separator is excluded; the internal break and spaces remain');
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

}

async function case_native_measurement_boundary(){
const {default:assert}=await import('node:assert/strict');
const {productionMotionMethods}=await import('./lib/reader-motion-method-probe.mjs');
const style=await import('../entry/src/main/ets/features/reading/ReaderAppearanceRenderStyle.ts');
const Paragraph=productionMotionMethods(new URL('../entry/src/main/ets/features/reading/ReadingSurface.ets',import.meta.url),['indentPrefix'],style);
const Host=productionMotionMethods(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets',import.meta.url),['measurementNodeText','measureNativeParagraph'],{...style,FontWeight:{Regular:400},TextAlign:{JUSTIFY:'justify',Start:'start'}});
for(const start of [true,false])for(const indent of ['none','single','firstLine']){
 const display=Object.assign(new Paragraph(),{isParagraphStart:start,appearance:{indent}});assert.equal(display.indentPrefix(),start?style.readerAppearanceParagraphIndentPrefix(indent):'');
 const captures=[];const owner=Object.assign(new Host(),{appearanceSnapshot:{fontSize:20,font:'serif',activeTheme:'paper',indent,lineSpacing:1,letterSpacing:0,alignment:'left'},measurementTextWidth:()=>300,getUIContext:()=>({px2vp:v=>v/3,fp2px:v=>v*3}),nativeTextMeasurement:{measure:(_c,text,_controller,recipe)=>captures.push({text,recipe})}});
 const paragraph={text:'A🙂\r\n  原文',isParagraphStart:start,controller:{}};owner.measureNativeParagraph(paragraph);assert.equal(captures[0].text,paragraph.text,'display indent never enters canonical native measurement text');assert.equal(captures[0].recipe.indentVp,start?style.readerAppearanceParagraphIndent(20,indent):0);assert.equal(paragraph.nativeMeasured,true);owner.measureNativeParagraph(paragraph);assert.equal(captures.length,1,'already measured owner is not shaped twice');
}
}
const implementations = {'native-measurement-boundary':case_native_measurement_boundary,'paragraph-boundaries':case_paragraph_boundaries};
for (const id of selectContractCases(CONTRACT_CASES)) {
  await implementations[id]();
  recordContractCasePass(id);
}
