import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  validateContentMetricsAgainstToc,
  wholeBookAnchorForPercent,
  wholeBookProgressPercent,
} from '../entry/src/main/ets/features/reading/LocalReadingWholeBookProgress.ts';

const metrics = {
  bookId: 'book-1',
  totalScalarLength: 100,
  chapters: [
    { chapterIndex: 3, scalarLength: 2, cumulativeStart: 0, cumulativeEnd: 2 },
    { chapterIndex: 8, scalarLength: 8, cumulativeStart: 2, cumulativeEnd: 10 },
    { chapterIndex: 21, scalarLength: 90, cumulativeStart: 10, cumulativeEnd: 100 },
  ],
};
const toc = [
  { index: 3, title: '短章', downloadState: 'unknown' },
  { index: 8, title: '中章😀', downloadState: 'unknown' },
  { index: 21, title: '长章', downloadState: 'unknown' },
];

validateContentMetricsAgainstToc(metrics, toc);
assert.equal(wholeBookProgressPercent(metrics, 3, 1), 1);
assert.equal(wholeBookProgressPercent(metrics, 8, 4), 6,
  'whole-book progress must use cumulative processed scalars, not equal chapter weights');
assert.ok(Math.abs(wholeBookProgressPercent(metrics, 21, 45) - 55) < Number.EPSILON * 100);
assert.equal(wholeBookProgressPercent(metrics, 8, 999), 10,
  'an out-of-range chapter offset must clamp to the Core-owned chapter interval');
assert.deepEqual(wholeBookAnchorForPercent(metrics, 0), { chapterIndex: 3, chapterOffset: 0 });
assert.deepEqual(wholeBookAnchorForPercent(metrics, 2), { chapterIndex: 8, chapterOffset: 0 },
  'a cumulative boundary belongs to the following non-empty chapter');
assert.deepEqual(wholeBookAnchorForPercent(metrics, 6), { chapterIndex: 8, chapterOffset: 4 });
assert.deepEqual(wholeBookAnchorForPercent(metrics, 100), { chapterIndex: 21, chapterOffset: 89 },
  '100% must resolve to the final real scalar rather than an imaginary EOF anchor');
assert.throws(() => validateContentMetricsAgainstToc(metrics, toc.slice(0, 2)), /chapter count/);
assert.throws(() => validateContentMetricsAgainstToc(metrics, [toc[1], toc[0], toc[2]]), /order/);

const zeroLengthMetrics = {
  bookId: 'book-empty-prefix',
  totalScalarLength: 4,
  chapters: [
    { chapterIndex: 0, scalarLength: 0, cumulativeStart: 0, cumulativeEnd: 0 },
    { chapterIndex: 1, scalarLength: 4, cumulativeStart: 0, cumulativeEnd: 4 },
  ],
};
assert.deepEqual(wholeBookAnchorForPercent(zeroLengthMetrics, 0), {
  chapterIndex: 1,
  chapterOffset: 0,
});
assert.equal(wholeBookAnchorForPercent({ bookId: 'empty', totalScalarLength: 0, chapters: [] }, 50),
  undefined);

const experienceSource = readFileSync(
  new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url),
  'utf8',
);
const gatewaySource = readFileSync(
  new URL('../entry/src/main/ets/features/reading/LocalReadingFlowGateway.ts', import.meta.url),
  'utf8',
);

assert.match(gatewaySource, /'local_book\.content\.metrics'/,
  'Harmony must obtain aggregate lengths from Core');
assert.match(experienceSource, /this\.contentMetricIndex\.percent\([\s\S]*?this\.desiredChapterOffset/,
  'the visible progress value must consume the Core cumulative scalar index');
assert.match(experienceSource, /wholeBookAnchorForPercent\(metrics, percent\)/,
  'slider seeking must resolve through the Core cumulative scalar index');
assert.match(experienceSource, /if \(metrics !== undefined\) \{[\s\S]*this\.contentMetricIndex\.percent/,
  'materialized local books must continue to prefer exact Core scalar metrics');
assert.match(experienceSource, /if \(metrics !== undefined\) \{[\s\S]*wholeBookAnchorForPercent/,
  'local slider seeking must continue to prefer exact Core scalar anchors');
assert.match(experienceSource, /Remote sessions[\s\S]*must not download the whole[\s\S]*book/,
  'the chapter-position fallback must be documented and limited to unopened remote bodies');
assert.doesNotMatch(experienceSource, /loadChapter\([^\n]*for|Promise\.all\([^)]*loadChapter/,
  'whole-book progress must not bulk-load chapter bodies in ArkUI');
const initialStart = experienceSource.indexOf('private async loadInitialChapter(');
const initialEnd = experienceSource.indexOf('private loadInitialToc(', initialStart);
assert.ok(initialStart >= 0 && initialEnd > initialStart);
assert.doesNotMatch(experienceSource.slice(initialStart, initialEnd), /loadContentMetrics/,
  'exact whole-book metrics must be removed from first-page admission');
assert.match(experienceSource, /private async loadContentMetricsIfNeeded\(/);
assert.match(experienceSource, /this\.controlSession = openReaderControlSession[\s\S]*?void this\.loadContentMetricsIfNeeded/,
  'exact metrics may load on demand when the user opens whole-book controls');

console.log('reading whole-book processed-scalar progress: PASS');

// The production owner's index has bounded storage and never scans chapters
// again while the admitted metrics snapshot is unchanged.
const { LocalReadingContentMetricIndex } = await import('../entry/src/main/ets/features/reading/LocalReadingWholeBookProgress.ts');
let chapterReads = 0;
const largeMetrics = { bookId: 'indexed', totalScalarLength: 100000, chapters: Array.from({ length: 10000 }, (_, i) => ({
  get chapterIndex() { chapterReads++; return i; }, scalarLength: 10, cumulativeStart: i * 10, cumulativeEnd: i * 10 + 10,
})) };
const metricIndex = new LocalReadingContentMetricIndex();
assert.equal(metricIndex.percent(largeMetrics, 9999, 5), 99.995);
const builtReads = chapterReads;
for (let i = 0; i < 100; i++) assert.equal(metricIndex.percent(largeMetrics, 9999, 5), 99.995);
assert.equal(chapterReads, builtReads, 'render queries do not walk the whole book');
const replacement = { bookId: 'indexed', totalScalarLength: 20, chapters: [{ chapterIndex: 9999, scalarLength: 20, cumulativeStart: 0, cumulativeEnd: 20 }] };
assert.equal(metricIndex.percent(replacement, 9999, 5), 25, 'replacement invalidates all cached metrics');
