import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { ReadingSurfaceLayoutMap } from '../entry/src/main/ets/features/reading/ReadingSurfaceLayoutMap.ts';
import { ReadingPaginationPrefix } from '../entry/src/main/ets/features/reading/ReadingPaginationIndex.ts';
import {
  readerAppearanceParagraphContentScalarOffset,
  readerAppearanceParagraphDisplayText,
} from '../entry/src/main/ets/features/reading/ReaderAppearanceRenderStyle.ts';

// Execute production measurement with controlled ArkUI UTF-16 line metrics.
// This verifies scalar/continuation semantics, not actual platform line wrapping.
const reading = new URL('../entry/src/main/ets/features/reading/', import.meta.url);
const host = readFileSync(new URL('LocalReadingExperience.ets', reading), 'utf8');
const lineClass = host.slice(host.indexOf('class MeasuredReadingLine {'), host.indexOf('class PhysicalReadingPage {'));
const MeasuredReadingLine = new Function(stripTypeScriptTypes(lineClass) + ';return MeasuredReadingLine;')();
function method(name) {
  const start = new RegExp(`  private ${name}\\(`).exec(host);
  assert.ok(start, name);
  return host.slice(start.index, host.indexOf('\n  private ', start.index + 1));
}
const Measure = new Function('ReadingSurfaceLayoutMap', 'MeasuredReadingLine', 'readerNativeParagraphHeight',
  'readerAppearanceParagraphContentScalarOffset', 'readerAppearanceParagraphDisplayText',
  stripTypeScriptTypes(`class Measure {${method('measuredLines')} ${method('measurementNodeText')}}`) + ';return Measure;')(
  ReadingSurfaceLayoutMap, MeasuredReadingLine, (_manager, first, last) => (last-first+1)*20, readerAppearanceParagraphContentScalarOffset,
  readerAppearanceParagraphDisplayText);
function measure(text, indent, starts, indexes, requestedStartScalar = 100) {
  const probe = new Measure();
  probe.appearanceSnapshot = { indent };
  probe.toLineMetric = value => value;
  probe.getUIContext = () => ({px2vp:v=>v});
  probe.pendingPageBodyCapacity = () => 100;
  const metrics = indexes.map(([startIndex, endIndex]) =>
    ({ startIndex, endIndex, height: 20, topHeight: 0, width: 100, baseline: 16 }));
  return probe.measuredLines({ text, layoutMap: new ReadingSurfaceLayoutMap(text),
    chapterStartScalar: 100, isParagraphStart: starts, requestedStartScalar,
    controller: { getLayoutManager: () => ({ getLineCount: () => metrics.length, getLineMetrics: index => metrics[index] }) } });
}
for (const indent of ['none', 'single', 'firstLine']) {
  assert.equal(new Measure().measurementNodeText({text:'甲😀乙',isParagraphStart:true}), '甲😀乙', 'native indent must not insert synthetic scalar slots');
  const lines = measure('甲😀乙e\u0301丙', indent, true, [[0, 3], [3, 7]]);
  assert.deepEqual(lines.map(line => [line.startScalar, line.endScalar]), [[100, 102], [102, 106]]);
  assert.deepEqual(lines.map(line => line.lineIndex), [0, 1]);
  const continued = measure('甲😀乙', indent, false, [[0, 3], [3, 4]]);
  assert.deepEqual(continued.map(line => [line.startScalar, line.endScalar]), [[100, 102], [102, 103]]);
}
console.log('paragraph indent production measurement: Unicode offsets and continued fragments PASS (controlled metrics)');

const resumed=measure('甲😀乙e\u0301丙','firstLine',true,[[0,3],[3,7]],103);
assert.deepEqual(resumed.map(line=>[line.lineIndex,line.startScalar,line.endScalar]),[[1,102,106]],
 'a deep resume selects the containing original line without changing its paragraph or Unicode context');
const resumedPage = {requestScalar:103,startScalar:resumed[0].startScalar,
  endScalarExclusive:resumed.at(-1).endScalar};
const resumedPrefix = new ReadingPaginationPrefix({sourceId:'local',bookId:'mixed-resume',chapterIndex:0,
  layoutSignature:'controlled-native-lines',contentVersion:'mixed-v1'},resumedPage);
assert.equal(resumedPrefix.admit(resumedPage),true,
  'production native measurement must also satisfy the actual pagination contract');
assert.equal(resumedPrefix.admit({requestScalar:106,startScalar:106,endScalarExclusive:110}),true);
assert.equal(resumedPrefix.previousRequestForPageStart(106),103,
  'returning to the resumed page preserves the original scalar intent');
const paragraphClass=host.slice(host.indexOf('class MeasurementParagraph {'),host.indexOf('class MeasuredReadingLine {'));
const MeasurementParagraph=new Function(stripTypeScriptTypes(paragraphClass)+';return MeasurementParagraph;')();
const Batch=new Function('MeasurementParagraph','ReadingSurfaceLayoutMap','TextController',
 'MAX_MEASUREMENT_BATCH_PARAGRAPHS','MAX_MEASUREMENT_BATCH_UTF16',
 stripTypeScriptTypes(`class Batch {${method('prepareNextMeasurementBatch')}}`)+';return Batch;')(
 MeasurementParagraph,ReadingSurfaceLayoutMap,class {},8,12288);
for(const content of ['甲😀 e\u0301 العربية Hebrew אבג 正文','段落'.repeat(16000)]) {
 const map=new ReadingSurfaceLayoutMap(content), target=Math.floor(map.scalarCount()/2);
 const range={id:'p',startUtf16:0,endUtf16:content.length,startScalar:0,endScalar:map.scalarCount()};
 const batch=Object.assign(new Batch(),{requireMeasurementChapter:()=>({content}),requireMeasurementLayoutMap:()=>map,
  nativeTextMeasurement:{clear(){}},measurementBatch:[],nextRangeIndex:0,firstRangeStartScalar:target,measuringRanges:()=>[range]});
 assert.equal(batch.prepareNextMeasurementBatch(),true);
 assert.equal(batch.measurementBatch.length,1);
 const paragraph=batch.measurementBatch[0];
 assert.equal(paragraph.text,content,'never cut a semantic paragraph at resume or a byte budget');
 assert.equal(paragraph.chapterStartScalar,0);assert.equal(paragraph.requestedStartScalar,target);
 assert.equal(paragraph.isParagraphStart,true,'native indent belongs to original paragraph, not displayed continuation');
}
console.log('PASS original paragraph resume and giant-paragraph context fallback, no synthetic prefix or truncated shaping');
{
 const text='甲'.repeat(10000), probe=new Measure();let reads=0;
 Object.assign(probe,{toLineMetric:v=>v,getUIContext:()=>({px2vp:v=>v}),pendingPageBodyCapacity:()=>100});
 const lines=probe.measuredLines({text,layoutMap:new ReadingSurfaceLayoutMap(text),chapterStartScalar:0,
  requestedStartScalar:9000,isParagraphStart:true,controller:{getLayoutManager:()=>({getLineCount:()=>10000,
    getLineMetrics:i=>{reads++;return {startIndex:i,endIndex:i+1,height:20,topHeight:i*20,width:100,baseline:i*20+16};}})}});
 assert.deepEqual(lines.map(l=>l.lineIndex),[9000,9001,9002,9003,9004,9005]);
 assert.ok(reads<30,'deep resume reads a logarithmic search plus visible lines, not all preceding metrics');
}
console.log('PASS deep native paragraph line lookup reads only binary-search path plus one-page overflow');
