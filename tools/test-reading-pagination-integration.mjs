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
const imageHost = readFileSync(
  new URL('../entry/src/main/ets/app/ReadingBodyImageHost.ts', import.meta.url),
  'utf8',
);
const httpHost = readFileSync(
  new URL('../entry/src/main/ets/app/HttpExecuteHost.ts', import.meta.url),
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
assert.match(httpHost, /isCancelled\?: \(\) => boolean[\s\S]*cancelDeadline\(deadline,[\s\S]*destroy/,
  'a stale direct image fetch must reach the underlying HttpRequest cancellation state');
assert.match(imageHost, /MAX_READING_IMAGE_PIXELS[\s\S]*options\.desiredSize[\s\S]*createPixelMap\(options\)/,
  'oversized compressed images must be downsampled before their PixelMap is allocated');
assert.match(imageHost, /finally \{[\s\S]*pixelMap\.release\(\)[\s\S]*imageSource\.release\(\)/,
  'decode-only PixelMap and ImageSource objects must be released before publication');
assert.match(imageHost, /displayFileReferences[\s\S]*release\(fileUri:[\s\S]*unlinkBestEffort\(path\)/,
  'display files must be reference-counted and removed at their final session release');
assert.match(imageHost, /MAX_READING_DISPLAY_FILE_BYTES[\s\S]*await fs\.stat\(tmpPath\)[\s\S]*await this\.unlinkBestEffort\(tmpPath\)/,
  'downsampled display files must remain byte-bounded and clean partial writes');
assert.match(imageHost, /configureDisplayCache[\s\S]*void this\.cleanupDisplayCache/,
  'startup must launch display-cache maintenance asynchronously');
assert.match(imageHost, /async cleanupDisplayCache[\s\S]*displayFileReferences\.size > 0[\s\S]*await fs\.listFile\(directory\)[\s\S]*await this\.unlinkBestEffort/,
  'a new process must reclaim crash-left display files without racing an active reading session');
assert.match(imageHost, /cleanupDisplayCache[\s\S]*await fs\.listFile\(cacheDir\)[\s\S]*LEGACY_DISPLAY_FILE_PREFIX[\s\S]*LEGACY_DISPLAY_TEMP_PREFIX[\s\S]*unlinkBestEffort/,
  'an upgraded process must reclaim legacy display files outside the startup critical path');
assert.doesNotMatch(imageHost, /openSync|writeSync|statSync|renameSync|listFileSync|unlinkSync/,
  'display-image materialization and cleanup must never block the ArkUI thread with sync filesystem calls');
assert.match(source, /readingImageResources:[\s\S]*releaseUnretainedReadingImages\(\)/,
  'the reader session must bound display-file lifetime to its active chapter window');
assert.match(source, /scaledReadingImageHeight\(/,
  'inline images must contribute intrinsic aspect-ratio height to the same paginator');
assert.match(source, /bodyImage\.state === 'ready' \? bodyImage\.fileUri : undefined/,
  'measured image fragments must carry the bounded Host display URI into the physical page');
const surface = readFileSync(
  new URL('../entry/src/main/ets/features/reading/ReadingSurface.ets', import.meta.url),
  'utf8',
);
const pageTurnStage = readFileSync(
  new URL('../entry/src/main/ets/features/reading/ReaderPageTurnStage.ets', import.meta.url),
  'utf8',
);
const continuousStage = readFileSync(
  new URL('../entry/src/main/ets/features/reading/ReaderContinuousReadingStage.ets', import.meta.url),
  'utf8',
);
assert.match(surface, /Image\(fragment\.fileUri\)/,
  'the reading surface must render file-backed image fragments from the same measured page list');
assert.match(surface, /else if \(fragment\.imageHeight > 0\)[\s\S]*Blank\(\)\.height\(fragment\.imageHeight\)/,
  'one image failure must retain a stable measurable block instead of aborting the chapter');
assert.match(surface, /if \(this\.showChapterTitle\) \{[\s\S]*Text\(this\.chapterTitle\)/,
  'the presentation surface must mount the semantic chapter heading only when admitted by the paginator');
const pagedTitle = surface.match(
  /if \(this\.showChapterTitle\) \{\s*Text\(this\.chapterTitle\)([\s\S]*?)\n\s*\}/,
);
assert.ok(pagedTitle, 'the paged chapter-title block must exist');
assert.match(pagedTitle[1], /\.wordBreak\(WordBreak\.BREAK_ALL\)/,
  'paged chapter titles must wrap at the measured reading width');
assert.doesNotMatch(pagedTitle[1], /\.maxLines\(1\)|TextOverflow\.Ellipsis/,
  'paged chapter titles must never collapse to a one-line ellipsis');
const continuousTitle = continuousStage.match(
  /if \(this\.chapterTitle\.length > 0\) \{[\s\S]*?Text\(this\.chapterTitle\)([\s\S]*?)\n\s*\}/,
);
assert.ok(continuousTitle, 'the continuous chapter-title block must exist');
assert.match(continuousTitle[1], /\.wordBreak\(WordBreak\.BREAK_ALL\)/,
  'continuous chapter titles must use the same wrapping contract');
assert.doesNotMatch(continuousTitle[1], /\.maxLines\(1\)|TextOverflow\.Ellipsis/,
  'continuous chapter titles must never collapse to a one-line ellipsis');
assert.match(source,
  /new ReaderPageTurnRenderPage\([\s\S]*this\.chapterTitle,[\s\S]*this\.showChapterTitle,[\s\S]*this\.visibleFragments/,
  'the reading session must pass its physical-page title decision into the page-turn render model');
assert.match(pageTurnStage,
  /struct ReaderPageTurnSurface[\s\S]*showChapterTitle: this\.showChapterTitle/,
  'the primitive page-slot component must forward each physical-page title decision to ReadingSurface');
for (const page of ['currentPage', 'previousPage', 'nextPage']) {
  assert.match(pageTurnStage, new RegExp(`showChapterTitle: this\\.${page}\\.showChapterTitle`),
    `the stage must bind the ${page} title decision directly into its page slot`);
}
assert.match(source, /this\.showChapterTitle = this\.isChapterFirstPageStart\(visiblePage\.startScalar\)/,
  'only the physical page beginning at the chapter head may expose the chapter heading');
assert.match(source,
  /captureChapterTitleMeasurementAfterLayout\(lifecycleToken\)[\s\S]*allBatchParagraphsHaveLayout\(\)/,
  'the wrapped title must be measured before body lines can be consumed');
assert.match(source,
  /Text\(this\.requireChapter\(\)\.chapterTitle, \{ controller: this\.chapterTitleMeasurementController \}\)[\s\S]*?\.fontFamily\(TYPE_READER_CHAPTER_TITLE\.fontFamily\)[\s\S]*?\.fontWeight\(TYPE_READER_CHAPTER_TITLE\.fontWeight\)[\s\S]*?\.fontSize\(TYPE_READER_CHAPTER_TITLE\.fontSizeFp\)[\s\S]*?\.lineHeight\(this\.readingLayout\(\)\.titleLineHeightFp\)[\s\S]*?\.wordBreak\(WordBreak\.BREAK_ALL\)/,
  'the hidden title measurement must use the same typography and wrapping as the visible title');
assert.match(source,
  /ForEach\(\[this\.measurementEpoch\], \(_epoch: number\) => \{\s*if \(this\.measurementIncludesChapterTitle\(\)\) \{\s*Text\(this\.requireChapter\(\)\.chapterTitle, \{ controller: this\.chapterTitleMeasurementController \}\)/,
  'the hidden title Text must be rebuilt per measurement epoch: a plain if branch keeps its first ' +
  'TextController binding across re-begins while beginMeasurement swaps in a new controller, so ' +
  'getLayoutManager() throws until the 6s deadline (regression: restore/directory chapter-head ' +
  'open stalled PAGINATION_LAYOUT_METRICS_UNAVAILABLE)');
assert.match(source,
  /\}, \(_epoch: number\): string => `chapterTitle:\$\{this\.measurementEpoch\}`\)/,
  'the title rebuild key must track the same measurement epoch the batch ForEach keys on');
assert.match(source,
  /const CHAPTER_TITLE_GATE_ATTEMPT_LIMIT = \d+;/,
  'the title gate must declare its fail-closed retry bound');
assert.match(source,
  /private retryOrFailingTitleGate\(lifecycleToken: number\): boolean \{[\s\S]*?this\.chapterTitleGateAttempts \+= 1;[\s\S]*?this\.fail\(new Error\('PAGINATION_CHAPTER_TITLE_METRICS_UNAVAILABLE'\), lifecycleToken\)/,
  'a stably unbindable title gate must fail closed with a specific reason instead of stalling');
assert.match(source,
  /return this\.readingLayout\(\)\.bodyHeightAfterTitle\(this\.measuredChapterTitleHeightVp\)/,
  'chapter-first body pagination must consume only the space left by the measured wrapped title');
assert.match(source,
  /if \(!this\.isChapterFirstPageStart\(pageStartScalar\)\) \{\s*return this\.readingLayout\(\)\.bodyHeightAfterTitle\(0\)/,
  'later physical pages must retain the full body track');
assert.match(source, /ReaderPageTurnStage\(\{[\s\S]*layout: this\.readingLayout\(\)/,
  'the page-turn stage must consume the same owner-resolved layout as pagination');
assert.match(pageTurnStage, /ReadingSurface\(\{[\s\S]*layout: this\.layout/,
  'every staged physical page must forward that layout to ReadingSurface');
assert.match(source,
  /titleLineHeight: layout\.titleLineHeightFp,[\s\S]*titleToBodySpacing: layout\.titleToBodySpacingVp/,
  'the pagination key must be derived from the same title metrics rendered by ReadingSurface');
assert.doesNotMatch(source, /FIGMA_(PHONE|TABLET|TITLE)_(WIDTH|HEIGHT|TOP|BOTTOM|HORIZONTAL|LINE)/,
  'the reading owner must not retain a second copy of Figma viewport or title geometry');

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
  /private turnPreviousPage\(\): ReaderPageTurnOutcome \{([\s\S]*?)\n  \}\n\n  private turnToPreviousChapter/,
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
assert.match(previousTurn[1], /startCurrentChapterPredecessorMeasurement\(chapter\.chapterIndex, page\.startScalar\)/,
  'restore/search/directory jumps must start a chapter-head measurement for an exact predecessor');
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
assert.match(source, /readerPageTransitionUsesPreparedPages\(this\.readerSettingsSnapshot\)/,
  'the admitted page replacement must select between paged transitions and direct or continuous navigation');
assert.doesNotMatch(previousTurn[1], /animateTo|animation\(/,
  'previous-page replacement must not invent a transition');

const predecessorMeasurement = source.match(
  /private continuePreviousChapterMeasurement\(([\s\S]*?)\n  \}\n\n  private async completeFirstPage/,
);
assert.ok(predecessorMeasurement, 'the cold predecessor measurement path must exist');
assert.match(predecessorMeasurement[1], /measuredPage\.endScalar/,
  'cold measurement must advance from the real preceding physical-page end');
assert.match(predecessorMeasurement[1], /draft\.containsAnchor\(pending\.originalChapterOffset\)/,
  'same-chapter predecessor measurement must stop once the real prefix contains the jumped anchor');
assert.match(predecessorMeasurement[1], /paginationIndex\.findContainingPage\([\s\S]*pending\.originalChapterOffset/,
  'a jump into the final page must survive promotion of the prefix into a completed manifest');
assert.match(predecessorMeasurement[1], /draft\.previousRequestForAnchor\(pending\.originalChapterOffset\)/,
  'the jumped anchor must resolve through continuous layout observations rather than session history');
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
