import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url),
  'utf8',
);
const sessionGateway = readFileSync(
  new URL('../entry/src/main/ets/features/reading/ReadingSessionFlowGateway.ts', import.meta.url),
  'utf8',
);

assert.match(source, /createReadingPaginationLayoutSignature\(\{[\s\S]*?deviceForm:[\s\S]*?viewportWidth:[\s\S]*?viewportHeight:[\s\S]*?fontFamily:[\s\S]*?fontSize:[\s\S]*?lineHeight:[\s\S]*?topInset:[\s\S]*?bottomInset:[\s\S]*?leftInset:[\s\S]*?rightInset:/,
  'the production key must include viewport, device form, typography, and all four insets');
assert.match(sessionGateway, /materializeReadingDocument\(/,
  'local and remote chapter bodies must enter the same reading-document projection');
assert.match(sessionGateway, /images:\s*document\.images/,
  'the canonical reading-session chapter must retain projected body images');
assert.match(sessionGateway, /contentVersion:\s*document\.contentVersion/,
  'pagination invalidation must use the projection version of text and image anchors');
assert.match(sessionGateway, /async resolveReadingImage\(/,
  'body-image bytes must resolve through the existing session gateway only when requested');
assert.match(source, /readingImageForParagraph\(/,
  'the physical-page measurement path must recognize canonical image-object paragraphs');
assert.match(source, /bodyImage\.state === 'pending'[\s\S]*resolvePendingReadingImage\(/,
  'pagination must pause at—not preload past—the first unresolved body image');
assert.match(source, /scaledReadingImageHeight\(/,
  'inline images must contribute intrinsic aspect-ratio height to the same paginator');
assert.match(source, /bodyImage\.state === 'ready' \? bodyImage\.pixelMap : undefined/,
  'measured image fragments must carry one Host-decoded PixelMap into the physical page');
const surface = readFileSync(
  new URL('../entry/src/main/ets/features/reading/ReadingSurface.ets', import.meta.url),
  'utf8',
);
assert.match(surface, /Image\(fragment\.imageSource\)/,
  'the reading surface must render image fragments from the same measured page list');
assert.match(surface, /else if \(fragment\.imageHeight > 0\)[\s\S]*Blank\(\)\.height\(fragment\.imageHeight\)/,
  'one image failure must retain a stable measurable block instead of aborting the chapter');
assert.match(surface, /if \(this\.showChapterTitle\) \{[\s\S]*Text\(this\.chapterTitle\)/,
  'the presentation surface must mount the semantic chapter heading only when admitted by the paginator');
assert.match(source, /showChapterTitle:\s*this\.showChapterTitle/,
  'the reading session must pass its physical-page title decision to the presentation surface');
assert.match(source, /this\.showChapterTitle = this\.isChapterFirstPageStart\(visiblePage\.startScalar\)/,
  'only the physical page beginning at the chapter head may expose the chapter heading');
assert.match(source, /const titleTrackHeight = this\.isChapterFirstPageStart\(pageStartScalar\) \?[\s\S]*FIGMA_TITLE_LINE_HEIGHT \+ FIGMA_TITLE_TO_BODY_SPACE : 0/,
  'only the first physical page may reserve chapter-title height in pagination');
assert.doesNotMatch(source, /private bodyCapacity\(\): number \{[\s\S]*FIGMA_TITLE_LINE_HEIGHT/,
  'continuation pages must not retain the former unconditional title-height deduction');

const observation = source.match(
  /private observeMeasuredPhysicalPage\(page: PhysicalReadingPage\): void \{([\s\S]*?)\n  \}\n\n  private resetPaginationDraft/,
);
assert.ok(observation, 'the physical-page observation path must exist');
assert.match(observation[1], /new ReadingPaginationPrefix\(key, observation\)/,
  'any real measured anchor may seed a continuous run for exact successor-to-predecessor lookup');
assert.match(observation[1], /draft\.matches\(key\) && draft\.admit\(observation\)/,
  'the measured prefix must admit only exact re-observations or a continuous real successor');
assert.match(observation[1], /page\.endScalar <= this\.lastVisibleScalar/,
  'a partial draft must not be admitted before the measured final page');
assert.match(observation[1], /this\.paginationIndex\.recordChapter\(/,
  'only the completed continuous draft may enter the pagination index');
assert.match(observation[1], /activeDraft\.startsAtRequest\(chapterStartRequest\)/,
  'only a continuous run that began at chapter head may become a full manifest');

const previousTurn = source.match(
  /private turnPreviousPage\(\): void \{([\s\S]*?)\n  \}\n\n  private canTurnPage/,
);
assert.ok(previousTurn, 'the previous-page production handler must exist');
assert.match(previousTurn[1], /paginationIndex\.findContainingPage/);
assert.match(previousTurn[1], /paginationIndex\.findPreviousPage/);
assert.doesNotMatch(previousTurn[1], /findPreviousPage\(key, page\.startScalar, null\)/,
  'a real TOC predecessor must no longer be erased at the chapter boundary');
assert.match(previousTurn[1], /prefix\.matches\(key\)/);
assert.match(previousTurn[1], /prefix\.previousRequestForPageStart\(page\.startScalar\)/,
  'page two and later must use the exact continuously measured prefix before a full manifest exists');
assert.match(previousTurn[1], /measureCommittedPageAt\(previousRequest\)/,
  'the prefix path must remeasure the exact request that produced the preceding page');
assert.match(previousTurn[1], /continuous measurement or complete manifest required/,
  'restore/search/seek must still fail closed before any exact predecessor has been measured');
assert.match(previousTurn[1], /measureCommittedPageAt\(previous\.page\.startScalar\)/,
  'an indexed previous page must reuse the existing real ArkUI measurement and Core commit path');
assert.match(previousTurn[1], /turnToPreviousChapter\(previousChapterIndex/,
  'the chapter-head path must enter the bounded predecessor workflow');
assert.doesNotMatch(source, /pageBackStack|ReadingPageHistoryAnchor/,
  'session navigation history must not be used as pagination truth');

assert.match(source, /invalidateLayout\([\s\S]*?previousLayoutSignature/,
  'viewport reflow must invalidate the predecessor layout manifest');
assert.match(source, /invalidateChapter\(this\.sourceId, this\.bookId, chapterIndex\)/,
  'a changed materialized body must invalidate every stale chapter manifest');
assert.match(source, /context\.px2vp\(metric\.height\)/,
  'ArkUI physical-pixel line metrics must be converted to the vp unit used by page capacity');
assert.match(source, /reader\.page\.turn\.none/,
  'the admitted page replacement remains the 0ms none mode');
assert.doesNotMatch(previousTurn[1], /animateTo|animation\(/,
  'previous-page replacement must not invent a transition');

const predecessorMeasurement = source.match(
  /private continuePreviousChapterMeasurement\(([\s\S]*?)\n  \}\n\n  private async completeFirstPage/,
);
assert.ok(predecessorMeasurement, 'the cold predecessor measurement path must exist');
assert.match(predecessorMeasurement[1], /measuredPage\.endScalar/,
  'cold measurement must advance from the real preceding physical-page end');
assert.match(predecessorMeasurement[1], /paginationIndex\.findLastPage\(this\.currentPaginationKey\(\)\)/,
  'the cold path must enter the exact indexed final page only after EOF');
assert.doesNotMatch(predecessorMeasurement[1], /updateProgress|resolveLocation/,
  'intermediate predecessor pages must not produce transient Core progress writes');
const predecessorBatch = source.match(
  /private recordPendingPreviousChapterPage\(\): void \{([\s\S]*?)\n  \}\n\n  private requireChapterLayoutMap/,
);
assert.ok(predecessorBatch, 'cold predecessor measurement must batch already-laid-out physical pages');
assert.match(predecessorBatch[1], /observeMeasuredPhysicalPage\(page\)/,
  'each batched predecessor page must enter the existing exact pagination prefix');
assert.match(predecessorBatch[1], /measurementRequestedAnchorScalar = page\.endScalar/,
  'the next batched observation must use the preceding real page end as its request anchor');
assert.doesNotMatch(predecessorBatch[1], /updateProgress|resolveLocation|beginMeasurement/,
  'batching must not add transient persistence or remount the hidden tree per ordinary page');
assert.match(source, /this\.previousChapterMeasurement === undefined \|\| paragraph\.isRangeTruncated/,
  'giant truncated paragraphs must retain the conservative one-page fallback');
assert.match(source, /private readonly chapterWindow: ReadingChapterWindow/,
  'the reader must own one bounded previous-current-next materialized chapter window');
assert.match(source, /retainChapterWindow\(this\.sourceId, this\.bookId, retained\)/,
  'pagination manifests must be bounded by the same three-chapter session window');

console.log('reading pagination integration contract: PASS');
