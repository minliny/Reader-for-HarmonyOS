// ImportDomainValidator — fixture-based import domain validation
import { TXTParser } from '../parser/TXTParser';
import { LocalBookFormat, ChapterSplitPolicy, SplitPattern } from '../models/LocalBook';

interface TestResult { name: string; passed: boolean; error?: string; }

class TestRunner {
  results: TestResult[] = []; passed: number = 0; failed: number = 0;
  assert(c: boolean, n: string, e?: string): void {
    const ok = c;
    this.results.push({ name: n, passed: ok, error: ok ? undefined : e });
    if (ok) { this.passed++; } else { this.failed++; }
  }
  summary(): string { return `${this.passed}P ${this.failed}F / ${this.results.length}`; }
}

export function runImportDomainTests(): TestRunner {
  const r = new TestRunner();
  const parser = new TXTParser();

  // Test 1: Basic UTF-8 TXT parse
  const txtData = new Uint8Array([0xE7, 0xAC, 0xAC, 0xE4, 0xB8, 0x80, 0xE7, 0xAB, 0xA0, 0x0A,
    0xE8, 0xBF, 0x99, 0xE6, 0x98, 0xAF, 0xE6, 0xB5, 0x8B, 0xE8, 0xAF, 0x95, 0xE5, 0x86, 0x85, 0xE5, 0xAE, 0xB9]);
  const result = parser.parse(txtData, 'utf-8');
  r.assert(result.encoding === 'utf-8', 'UTF-8 encoding detected');
  r.assert(result.byteCount === txtData.byteLength, 'byteCount matches input');
  r.assert(result.content.length > 0, 'content is non-empty');
  r.assert(result.toc.length === 1, 'single chapter for plain text (auto)');

  // Test 2: Empty data
  const emptyResult = parser.parse(new Uint8Array(0));
  r.assert(emptyResult.byteCount === 0, 'empty data: byteCount=0');
  r.assert(emptyResult.content === '', 'empty data: content empty');

  // Test 3: Regex chapter split
  const chapterText = '第一章 开始\n内容1\n第二章 继续\n内容2\n第三章 结束\n内容3';
  const chData = new Uint8Array(chapterText.split('').map(c => c.charCodeAt(0)));
  const policy: ChapterSplitPolicy = { pattern: SplitPattern.regex, regex: '^第[零一二三四五六七八九十百千]+章' };
  const chResult = parser.parse(chData, 'utf-8', policy);
  r.assert(chResult.toc.length === 3, `regex split: 3 chapters, got ${chResult.toc.length}`);
  r.assert(chResult.toc[0].title === '第一章 开始', 'first chapter title');
  r.assert(chResult.toc[1].title === '第二章 继续', 'second chapter title');

  // Test 4: Marker split
  const markerText = '# Chapter 1\nContent A\n# Chapter 2\nContent B\n# Chapter 3\nContent C';
  const mkData = new Uint8Array(markerText.split('').map(c => c.charCodeAt(0)));
  const mkPolicy: ChapterSplitPolicy = { pattern: SplitPattern.marker, marker: '# Chapter ' };
  const mkResult = parser.parse(mkData, 'utf-8', mkPolicy);
  r.assert(mkResult.toc.length >= 3, `marker split: >=3 chapters, got ${mkResult.toc.length}`);

  // Test 5: Size split
  const sizeText = 'A'.repeat(1000);
  const szData = new Uint8Array(sizeText.split('').map(c => c.charCodeAt(0)));
  const szPolicy: ChapterSplitPolicy = { pattern: SplitPattern.size, sizeBytes: 200 };
  const szResult = parser.parse(szData, 'utf-8', szPolicy);
  r.assert(szResult.toc.length === Math.ceil(1000 / 200), 'size split: correct chunk count');

  // Test 6: Auto split
  const autoText = '前言\n内容\n第1章 开始\n内容\n第2章 继续\n内容';
  const aData = new Uint8Array(autoText.split('').map(c => c.charCodeAt(0)));
  const aPolicy: ChapterSplitPolicy = { pattern: SplitPattern.auto };
  const aResult = parser.parse(aData, 'utf-8', aPolicy);
  r.assert(aResult.toc.length > 1, 'auto split detects Chinese chapter patterns');

  // Test 7: BOM detection
  const bomData = new Uint8Array([0xEF, 0xBB, 0xBF, 0x48, 0x65, 0x6C, 0x6C, 0x6F]);
  const bomResult = parser.parse(bomData);
  r.assert(bomResult.encoding === 'utf-8', 'BOM detected as utf-8');
  r.assert(bomResult.content === 'Hello', 'BOM stripped from content');

  // Test 8: GBK encoding
  const gbkData = new Uint8Array([0xCE, 0xD2, 0xCA, 0xC7, 0xD6, 0xD0, 0xCE, 0xC4]);
  const gbkResult = parser.parse(gbkData, 'gbk');
  r.assert(gbkResult.content.length > 0, 'GBK decoding succeeds');
  r.assert(gbkResult.encoding === 'gbk', 'GBK encoding preserved');

  return r;
}
