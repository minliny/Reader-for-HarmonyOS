import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';

const file = new URL('../entry/src/main/ets/features/reading/ReadingSurface.ets', import.meta.url);
const Surface = productionMotionMethods(file, ['renderFragments']);
const surface = new Surface();
let reads = 0;
let fallback = [{ id: 'fallback', nativeTitle: { text: 'old title' } }];
let current = [{ id: 'text-page', nativeTitle: { text: 'new title' } }];
Object.defineProperty(surface, 'pageFragments', { get() { reads++; return fallback; } });
surface.contentRevision = 7;
surface.fragmentsProvider = () => current;
assert.equal(surface.renderFragments(), current);
assert.equal(reads, 1, 'provider path must read the reactive fragment property');
current = [{ id: 'image-page', image: { src: 'retained-image' } }];
fallback = current;
assert.equal(surface.renderFragments(), current, 'same revision can carry a different page');
assert.equal(reads, 2, 'reused offscreen page keeps a fragment dependency');
surface.fragmentsProvider = undefined;
assert.equal(surface.renderFragments(), fallback);
surface.fragmentsProvider = () => { throw Error('provider is not active'); };
surface.contentRevision = -1;
assert.equal(surface.renderFragments(), fallback);

const source = readFileSync(file, 'utf8');
assert.doesNotMatch(source, /this\.pageFragments\[0\]/, 'title must not bypass the body authority');
assert.match(source, /recipe: this\.renderFragments\(\)\[0\]\.nativeTitle!/);

const Experience = productionMotionMethods(new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url),
  ['isChapterFirstPageStart', 'isMeasurementChapterFirstPageStart']);
for (const start of [0, 4096]) {
  const owner = Object.assign(new Experience(), {
    chapter: { documentRange: { startScalar: start } },
    paragraphRanges: [{ startScalar: start }],
    measuringChapter() { return this.chapter; },
    measuringRanges() { return this.paragraphRanges; },
  });
  assert.equal(owner.isChapterFirstPageStart(start), start === 0);
  assert.equal(owner.isMeasurementChapterFirstPageStart(start), start === 0);
}
console.log('PASS fragment authority and property-read contract; window title bounds. Native reactive scheduling/pixels not simulated.');
