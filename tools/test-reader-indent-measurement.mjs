import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import {
  readerAppearanceParagraphContentScalarOffset,
  readerAppearanceParagraphDisplayText,
} from '../entry/src/main/ets/features/reading/ReaderAppearanceRenderStyle.ts';

// Execute production measurement with controlled ArkUI UTF-16 line metrics.
// This verifies scalar/continuation semantics, not actual platform line wrapping.
const reading = new URL('../entry/src/main/ets/features/reading/', import.meta.url);
const host = readFileSync(new URL('LocalReadingExperience.ets', reading), 'utf8');
const map = readFileSync(new URL('ReadingSurfaceLayoutMap.ts', reading), 'utf8')
  .replace('constructor(private readonly content: string) {', 'constructor(content: string) { this.content = content;');
const ReadingSurfaceLayoutMap = new Function(stripTypeScriptTypes(map).replace('export class', 'class') +
  ';return ReadingSurfaceLayoutMap;')();
const lineClass = host.slice(host.indexOf('class MeasuredReadingLine {'), host.indexOf('class PhysicalReadingPage {'));
const MeasuredReadingLine = new Function(stripTypeScriptTypes(lineClass) + ';return MeasuredReadingLine;')();
function method(name) {
  const start = new RegExp(`  private ${name}\\(`).exec(host);
  assert.ok(start, name);
  return host.slice(start.index, host.indexOf('\n  private ', start.index + 1));
}
const Measure = new Function('ReadingSurfaceLayoutMap', 'MeasuredReadingLine',
  'readerAppearanceParagraphContentScalarOffset', 'readerAppearanceParagraphDisplayText',
  stripTypeScriptTypes(`class Measure {${method('measuredLines')} ${method('measurementNodeText')}}`) + ';return Measure;')(
  ReadingSurfaceLayoutMap, MeasuredReadingLine, readerAppearanceParagraphContentScalarOffset,
  readerAppearanceParagraphDisplayText);
function measure(text, indent, starts, indexes) {
  const probe = new Measure();
  probe.appearanceSnapshot = { indent };
  probe.toLineMetric = value => value;
  const metrics = indexes.map(([startIndex, endIndex]) =>
    ({ startIndex, endIndex, height: 20, topHeight: 0, width: 100, baseline: 16 }));
  return probe.measuredLines({ text, layoutMap: new ReadingSurfaceLayoutMap(text),
    chapterStartScalar: 100, isParagraphStart: starts,
    controller: { getLayoutManager: () => ({ getLineCount: () => metrics.length, getLineMetrics: index => metrics[index] }) } });
}
for (const [indent, prefixLength] of [['none', 0], ['single', 1], ['firstLine', 2]]) {
  const lines = measure('甲😀乙e\u0301丙', indent, true, [[0, prefixLength + 3], [prefixLength + 3, prefixLength + 7]]);
  assert.deepEqual(lines.map(line => [line.startScalar, line.endScalar]), [[100, 102], [102, 106]]);
  assert.deepEqual(lines.map(line => line.lineIndex), [0, 1]);
  const continued = measure('甲😀乙', indent, false, [[0, 3], [3, 4]]);
  assert.deepEqual(continued.map(line => [line.startScalar, line.endScalar]), [[100, 102], [102, 103]]);
}
console.log('paragraph indent production measurement: Unicode offsets and continued fragments PASS (controlled metrics)');
