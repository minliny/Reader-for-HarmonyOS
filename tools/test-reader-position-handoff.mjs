import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';
const Decoder = productionMotionMethods(new URL('../entry/src/main/ets/app/ReaderCoreGateway.ts', import.meta.url),
  ['decodeShelfReadingPosition','requiredNonNegativeInteger','optionalString']);
const decoder = new Decoder();
const valid = {chapterIndex:4,chapterOffset:123,updatedAt:91,bodyVersion:'body',processingVersion:'rules'};
assert.deepEqual(decoder.decodeShelfReadingPosition(valid), {...valid,locationRevision:undefined});
const legacy = {chapterIndex:4,chapterOffset:123,updatedAt:91};
assert.equal(decoder.decodeShelfReadingPosition(legacy).bodyVersion,undefined,'legacy projection has no fabricated body proof');
for(const malformed of [undefined,null,[],{}, {...valid,chapterOffset:-1}, {...valid,chapterIndex:1.5},
  {...valid,updatedAt:-1}, {...valid,updatedAt:Infinity}, {...valid,bodyVersion:''}, {...valid,processingVersion:' '},
  {...valid,bodyVersion:undefined}, {...valid,bodyVersion:123}]) {
  assert.equal(decoder.decodeShelfReadingPosition(malformed),undefined,'invalid optional position is dropped without failing the shelf');
}
const prep=readFileSync(new URL('../entry/src/main/ets/features/reading/ReadingEntryPreparation.ts',import.meta.url),'utf8');
assert.match(prep,/const progress = await gateway\.loadProgress\(seed\.bookId, isCurrent\)/);
assert.doesNotMatch(prep,/seed\.readingPosition/,'no authority is minted for an older shelf row');
console.log('bookshelf optional position decoder: actual valid/legacy/malformed behavior; preparation retains authority read PASS');
