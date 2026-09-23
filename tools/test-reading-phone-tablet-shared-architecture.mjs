import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (relative) => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');

const index = read('entry/src/main/ets/pages/Index.ets');
const shell = read('entry/src/main/ets/features/shell/ReaderShell.ets');
const experience = read('entry/src/main/ets/features/reading/LocalReadingExperience.ets');
const surface = read('entry/src/main/ets/features/reading/ReadingSurface.ets');
const geometry = read('entry/src/main/ets/features/reading/ReaderLayoutGeometry.ts');
const sessionGateway = read('entry/src/main/ets/features/reading/ReadingSessionFlowGateway.ts');
const pagination = read('entry/src/main/ets/features/reading/ReadingPaginationIndex.ts');
const offline = read('entry/src/main/ets/features/reading/ReadingOfflineGateway.ts');
const sourceSwitch = read('entry/src/main/ets/features/source/SourceSwitchGateway.ts');

assert.match(index, /ReaderShell\(\{[\s\S]*?isTablet:\s*deviceInfo\.deviceType === 'tablet'/,
  'the production route must select a viewport variant on the shared ReaderShell');
assert.equal((shell.match(/ReadingExperience\(\{/g) ?? []).length, 1,
  'Phone and TabletExpanded must mount one shared reading experience, not parallel renderers');
assert.match(shell, /ReadingExperience\(\{[\s\S]*?remoteSession:\s*this\.remoteSession,[\s\S]*?isTablet:\s*this\.isTablet/,
  'local/remote acquisition and the device form must converge before physical pagination');
assert.match(shell, /onDownloadChapter:[\s\S]*?this\.onDownloadChapter/,
  'both device forms must forward the same offline intent');
assert.match(shell, /onDownloadBook:[\s\S]*?this\.onDownloadBook/,
  'both device forms must forward the same whole-book offline intent');
assert.match(shell, /onClearBookOffline:[\s\S]*?this\.onClearBookOffline/,
  'both device forms must forward the same exact-book clear intent');
assert.match(shell, /onReadingFailure:[\s\S]*?this\.onReadingFailure/,
  'both device forms must forward the same source-switch rollback seam');

const visibleMount = experience.slice(experience.indexOf('  aboutToAppear()'), experience.indexOf('  aboutToDisappear()'));
assert.match(visibleMount, /void this\.loadInitialReading\(lifecycleToken\)/,
  'the same mounted reader starts asynchronous acquisition for either device form');
assert.match(experience, /private async ensureReadingSession[\s\S]*if \(this\.sessionGateway !== undefined\) return/,
  'the reader reuses its admitted gateway instead of constructing one per retry');
assert.equal((experience.match(/ReadingSessionFlowGateway\.open\(/g) ?? []).length, 1,
  'one lifecycle owns the shared local/remote gateway; there is no secondary preparation reader');
assert.equal((experience.match(/new ReadingPaginationIndex\(\)/g) ?? []).length, 1,
  'the mounted reader must own one physical pagination index');
assert.equal((experience.match(/new ReadingChapterWindow\(\)/g) ?? []).length, 1,
  'the mounted reader must own one bounded previous/current/next chapter window');
assert.doesNotMatch(sessionGateway, /isTablet|TabletExpanded|deviceForm/,
  'Core command routing must not fork by device form');
assert.doesNotMatch(offline, /isTablet|TabletExpanded|deviceForm/,
  'download/offline orchestration must not fork by device form');
assert.match(offline, /prefetchBook\([\s\S]*?this\.prefetchRange\(/,
  'whole-book download must reuse the existing bounded range path');
assert.doesNotMatch(offline, /class .*Queue|new .*Queue|AppStorage/,
  'Harmony must not create a second durable download queue');
assert.doesNotMatch(sourceSwitch, /isTablet|TabletExpanded|deviceForm/,
  'source-switch transactions must not fork by device form');
assert.doesNotMatch(pagination, /FIGMA_PHONE|FIGMA_TABLET|TabletExpanded/,
  'the pagination index must consume an opaque layout signature rather than own viewport constants');

assert.match(geometry, /viewportWidth >= READER_EXPANDED_MIN_WIDTH \? 'expanded' : 'compact'/,
  'the live window width, not physical device type, must select the layout class');
assert.match(experience, /deviceForm:\s*layout\.widthClass === 'expanded' \? 'tablet' : 'phone'/,
  'the resolved width class must participate in the pagination signature');
assert.match(experience, /viewportWidth:\s*layout\.viewportWidth/);
assert.match(experience, /viewportHeight:\s*layout\.viewportHeight/);
assert.match(experience, /onAreaChange\([\s\S]*?previousLayoutSignature[\s\S]*?invalidateLayout\([\s\S]*?beginMeasurement\(lifecycleToken\)/,
  'rotation or window resize must invalidate old physical pages and reflow through the same measurement path');
assert.match(experience, /this\.showChapterTitle = this\.isChapterFirstPageStart\(visiblePage\.startScalar\)/,
  'chapter-title visibility must be derived from the measured page start on both device forms');
assert.match(experience,
  /isMeasurementChapterFirstPageStart\(pageStartScalar\)[\s\S]*bodyHeightAfterTitle\(this\.measuredChapterTitleHeightVp\)/,
  'only the chapter-first page may reserve its measured wrapped title track on either width class');
assert.match(surface, /if \(this\.showChapterTitle\) \{[\s\S]*?Text\(this\.chapterTitle\)/,
  'the presentation layer must not independently repeat the chapter heading');
assert.match(surface, /@Prop @Watch\('onHighlightContentChanged'\) layout: ReaderReadingLayoutSnapshot/,
  'the presentation layer must receive owner-resolved geometry instead of selecting its own device form');
assert.doesNotMatch(surface, /this\.isTablet[\s\S]{0,120}showChapterTitle|showChapterTitle[\s\S]{0,120}this\.isTablet/,
  'chapter-title semantics must not differ between Phone and TabletExpanded');

assert.match(experience, /paginationKeyForChapter\(previousChapterIndex\)/,
  'cross-chapter previous-page lookup must reuse the same keyed manifest on both device forms');
assert.match(experience, /startPreviousChapterMeasurement\([\s\S]*?openChapter\(previousChapterIndex/,
  'a cold predecessor must use the same bounded measurement path on both device forms');
assert.doesNotMatch(experience, /if \(this\.isTablet\)[\s\S]{0,240}(new ReadingSessionFlowGateway|new ReadingPaginationIndex|turnToPreviousChapter)/,
  'Tablet geometry must not select a second gateway, paginator, or cross-chapter algorithm');

console.log('reading Phone/TabletExpanded shared architecture contract: PASS');
