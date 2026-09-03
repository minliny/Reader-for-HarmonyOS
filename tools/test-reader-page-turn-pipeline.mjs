import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const readingDir = new URL('../entry/src/main/ets/features/reading/', import.meta.url);
const localReading = readFileSync(new URL('LocalReadingExperience.ets', readingDir), 'utf8');
const stage = readFileSync(new URL('ReaderPageTurnStage.ets', readingDir), 'utf8');
const interaction = readFileSync(new URL('ReaderPageInteractionLayer.ets', readingDir), 'utf8');
const settingsState = readFileSync(new URL('ReaderSettingsState.ts', readingDir), 'utf8');
const controlPanel = readFileSync(new URL('ReaderControlPanel.ets', readingDir), 'utf8');
const appearancePanel = readFileSync(new URL('ReaderAppearanceFullPanel.ets', readingDir), 'utf8');
const motionSpec = readFileSync(new URL('../common/MotionSpec.ets', readingDir), 'utf8');

const failures = [];

function contract(name, check) {
  try {
    check();
  } catch (error) {
    failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function methodSection(source, name) {
  const plainAnchor = `  private ${name}(`;
  const asyncAnchor = `  private async ${name}(`;
  const publicAnchor = `  ${name}(`;
  let start = source.indexOf(plainAnchor);
  if (start < 0) {
    start = source.indexOf(asyncAnchor);
  }
  if (start < 0) {
    start = source.indexOf(publicAnchor);
  }
  assert.notEqual(start, -1, `missing ${name} method`);
  const nextPrivate = source.indexOf('\n  private ', start + 4);
  return nextPrivate < 0 ? source.slice(start) : source.slice(start, nextPrivate);
}

contract('reading owner mounts the two-page stage with live state', () => {
  assert.match(localReading,
    /import \{[\s\S]*ReaderPageTurnRenderPage,[\s\S]*ReaderPageTurnStage,[\s\S]*\} from '\.\/ReaderPageTurnStage';/);
  assert.match(localReading,
    /ReaderPageTurnStage\(\{[\s\S]*currentPage: this\.currentPageTurnRenderPage\(\),[\s\S]*previousPage: this\.preparedPageTurnRenderPage\('previous'\),[\s\S]*nextPage: this\.preparedPageTurnRenderPage\('next'\),[\s\S]*pageTurnStyle: this\.effectivePageTurnStyle\(\),[\s\S]*turnDirection: this\.pageTurnDirection,[\s\S]*offsetX: this\.pageTurnOffsetX,[\s\S]*viewportWidth: this\.pageTurnStageViewportWidth\(\),/,
    'LocalReadingExperience must give the stage current, adjacent, style, direction, offset, and live width');
  assert.match(stage, /export struct ReaderPageTurnStage/);
  assert.match(stage, /ReadingSurface\(\{/,
    'the stage must reuse the admitted page renderer instead of forking pagination presentation');
});

contract('adjacent preparation stops before the normal Core commit', () => {
  const beginCommit = methodSection(localReading, 'beginFirstPageCommit');
  assert.match(beginCommit,
    /if \(this\.pageTurnPreparation !== undefined\) \{\s*this\.completePreparedPageTurn\(page, generation, selectionToken, lifecycleToken\);\s*return;\s*\}/,
    'the prepared-page branch must return before completeFirstPage');
  assert.ok(beginCommit.indexOf('completePreparedPageTurn') < beginCommit.lastIndexOf('completeFirstPage'),
    'the prepared-page branch must precede the normal visible-page commit');

  const prepare = methodSection(localReading, 'completePreparedPageTurn');
  assert.doesNotMatch(prepare,
    /completeFirstPage|activeGateway|runProgressCommitSerial|resolveLocation|updateProgress|admitCommittedProgress/,
    'preparation may materialize a page but must not write or admit Core progress');
  assert.match(prepare, /this\.restoreMaterializedChapterContext\(preparation\.origin, false\);/,
    'preparation must restore the still-visible chapter/page context');
  assert.doesNotMatch(prepare, /this\.visiblePage\s*=|this\.visibleFragments\s*=/,
    'preparation must not promote the adjacent page into the visible snapshot');
});

contract('prepared slide waits for both animation and durable progress before promotion', () => {
  const start = methodSection(localReading, 'startPreparedPageTurnSettlement');
  const animate = methodSection(localReading, 'animatePreparedPageTurnSlide');
  const persist = methodSection(localReading, 'persistPreparedPageTurn');
  const finish = methodSection(localReading, 'finishPreparedPageTurnSettlement');
  const promote = methodSection(localReading, 'promotePreparedPageTurn');

  assert.match(start, /this\.animatePreparedPageTurnSlide\(targetOffset, settlementGeneration\)/,
    'slide settlement must enter the shared viewport animation');
  assert.match(animate, /animateTo\([\s\S]*this\.pageTurnOffsetX = targetOffset/,
    'the shared slide path must animate the live page offset');
  assert.match(start, /this\.beginPreparedPageTurnPersistence\(prepared, lifecycleToken, settlementGeneration\)/,
    'slide settlement must start the durable progress transaction through the shared gate');
  assert.match(methodSection(localReading, 'beginPreparedPageTurnPersistence'),
    /this\.persistPreparedPageTurn\(prepared, lifecycleToken, settlementGeneration\)/);
  assert.doesNotMatch(start, /promotePreparedPageTurn|this\.visiblePage\s*=/,
    'starting an animation must not switch the pagination fact');

  assert.match(persist, /runProgressCommitSerial/);
  assert.match(persist, /resolveLocation/);
  assert.match(persist, /updateProgress/);
  assert.doesNotMatch(persist, /promotePreparedPageTurn|this\.visiblePage\s*=/,
    'finishing Core persistence alone must not switch the pagination fact');

  assert.match(finish,
    /!this\.pageTurnAnimationFinished\s*\|\|\s*!this\.pageTurnCommitFinished/,
    'settlement must wait for both independent completions');
  assert.match(finish, /this\.promotePreparedPageTurn\(prepared, stored\);/,
    'one guarded join point owns page promotion');
  assert.match(promote, /this\.visiblePage = prepared\.page;/);
  assert.match(promote, /this\.admitCommittedProgress\(stored\);/);
  assert.match(promote, /this\.schedulePageTurnPreparation\(\);/,
    'the newly committed visible page must seed its own adjacent-page cache');

  assert.match(motionSpec, /'reader\.page\.slide\.commit'/);
  assert.match(motionSpec, /'reader\.page\.slide\.rollback'/);
});

contract('failed prepared commit rolls the same stage back', () => {
  const persist = methodSection(localReading, 'persistPreparedPageTurn');
  const finish = methodSection(localReading, 'finishPreparedPageTurnSettlement');
  const rollback = methodSection(localReading, 'animatePageTurnRollback');

  assert.match(persist, /catch \(error\) \{[\s\S]*return false;/,
    'a rejected Core transaction must become an explicit failed settlement');
  assert.match(finish,
    /if \(!this\.pageTurnCommitSucceeded[\s\S]*this\.animatePageTurnRollback\(\);\s*return;[\s\S]*this\.promotePreparedPageTurn/,
    'failure must clear the in-flight prepared page and roll back before the success-only promotion');
  assert.match(rollback, /motionAnimateParam\('reader\.page\.slide\.rollback'/);
  assert.match(rollback, /this\.pageTurnOffsetX = 0;/);
});

contract('manual, gesture, and auto page turns converge before choosing slide or direct mode', () => {
  const perform = methodSection(localReading, 'performPageTurn');
  const manual = methodSection(localReading, 'requestPageTurn');
  const automatic = methodSection(localReading, 'requestAutoPageTurn');

  assert.match(manual, /const result = this\.performPageTurn\(direction\);[\s\S]*return result;/,
    'manual taps and committed gestures must enter the shared page-turn dispatcher');
  assert.doesNotMatch(manual, /this\.turnPreviousPage\(|this\.turnNextPage\(/);
  assert.match(automatic, /this\.performPageTurn\('next'\)/,
    'automatic paging must enter the same dispatcher as manual input');
  assert.doesNotMatch(automatic, /this\.turnNextPage\(/);
  assert.doesNotMatch(automatic, /setTimeout\([\s\S]*requestAutoPageTurn/,
    'a busy Auto Page request must be resumed by state completion, not 250ms polling');
  assert.match(automatic, /this\.autoPageTurnPending = true/);

  assert.match(perform, /this\.preparedPageTurn\(direction\)/,
    'the shared dispatcher must prefer an admitted adjacent render page');
  assert.match(perform, /this\.startPreparedPageTurnSettlement\(direction, prepared\)/,
    'the shared dispatcher must use the two-stage slide settlement');
  assert.match(perform, /this\.turnPreviousPage\(\)[\s\S]*this\.turnNextPage\(\)/,
    'none mode and cold-cache taps retain the existing committed pagination fallback');

  assert.match(interaction,
    /onTurn: \(direction: ReaderPageTurnDirection\) => ReaderPageTurnOutcome/);
  assert.match(interaction,
    /this\.onTurn\(decision\.direction\)/,
    'a committed pan must use the same page-turn command as a tap');
});

contract('rapid input is bounded to one first-pending manual or pointer intent', () => {
  const manual = methodSection(localReading, 'requestPageTurn');
  const drain = methodSection(localReading, 'drainPendingManualPageTurn');
  const reserve = methodSection(localReading, 'reserveDeferredPointerSegment');
  const resolve = methodSection(localReading, 'resolveDeferredPointerSegment');

  assert.match(localReading,
    /private pendingManualPageTurnIntent: ReaderPageTapIntent \| undefined/);
  assert.match(localReading, /private pendingPointerSegmentReserved: boolean = false/);
  assert.doesNotMatch(localReading, /pendingManualPageTurn(?:Queue|Directions):/,
    'rapid input must not grow an animation or pagination work queue');
  assert.match(manual,
    /this\.pendingManualPageTurnIntent === undefined && !this\.pendingPointerSegmentReserved\) \{[\s\S]*this\.pendingManualPageTurnIntent = direction;/,
    'only the first busy manual direction may claim the retained intent slot');
  assert.doesNotMatch(manual, /else[\s\S]*this\.pendingManualPageTurnIntent = direction/,
    'a later direction must not overwrite the first pending intent');
  assert.match(drain, /this\.preparedPageTurn\(direction\) === undefined[\s\S]*queuePageTurnPreparation/,
    'the retained intent waits for the existing three-page window instead of expanding prefetch');
  assert.match(reserve,
    /if \(this\.pendingPointerSegmentReserved\) return false;[\s\S]*if \(this\.pendingManualPageTurnIntent !== undefined &&[\s\S]*this\.pageTurnSettlementActive[\s\S]*return false;[\s\S]*this\.pendingManualPageTurnIntent = undefined;[\s\S]*this\.pendingPointerSegmentReserved = true/,
    'the first pointer-down during settlement reserves the same bounded slot; a stale intent with no settlement in flight is superseded');
  assert.match(resolve,
    /if \(intent !== undefined && this\.pendingManualPageTurnIntent === undefined\) \{[\s\S]*this\.pendingManualPageTurnIntent = intent;/,
    'a reserved pointer publishes its parsed intent without replacing an existing owner');
  assert.match(interaction, /@Prop @Watch\('onInteractionModeChanged'\) tapOnly: boolean = false/);
  assert.match(interaction, /onDeferredSegmentStart: \(\) => boolean/);
  assert.match(interaction, /onDeferredSegmentResolve: \(intent: ReaderPageTapIntent \| undefined\) => void/);
  assert.match(interaction, /onDeferredSegmentPromote: \(\) => void/);
  assert.match(interaction,
    /if \(this\.tapOnlyPointer\)[\s\S]*finishReaderPagePan\([\s\S]*this\.resolveDeferredSegment\(intent\)/,
    'a non-interruptible commit parses one complete pending segment without presenting its drag');
  assert.match(interaction,
    /if \(this\.activePointerId >= 0\) \{\s*return;\s*\}/,
    'later fingers must not replace or cancel the first pointer owner');
});

contract('cold-cache pans remain actionable and both directions are prepared', () => {
  const schedule = methodSection(localReading, 'schedulePageTurnPreparation');
  const gesture = methodSection(localReading, 'onReaderPageGestureStateChanged');
  const drain = methodSection(localReading, 'drainPageTurnPreparationQueue');
  const directFinish = methodSection(localReading, 'completeDirectPageTurnGesture');
  const rollbackFinish = methodSection(localReading, 'finishPageTurnRollback');

  assert.match(schedule, /\['next', 'previous'\]/,
    'each committed page must prepare both adjacent directions when their exact boundaries are known');
  assert.doesNotMatch(gesture, /beginPageTurnPreparation/,
    'an active Pan must never synchronously begin hidden measurement');
  const drains = [...gesture.matchAll(/this\.drainPageTurnPreparationQueue\(\)/g)];
  assert.ok(drains.length >= 1,
    'the gesture callback must re-drain queued preparations once it settles back to idle');
  for (const match of drains) {
    const prefix = gesture.slice(Math.max(0, match.index - 200), match.index);
    assert.match(prefix, /state\.phase === 'idle' && this\.pageTurnPreparationQueue\.length > 0/,
      'a drain inside the gesture callback is only allowed behind the idle guard, never during an active Pan');
  }
  assert.match(drain, /this\.pageTurnGestureState\.phase !== 'idle'/,
    'an asynchronously completed chapter prefetch must not start hidden measurement during a Pan');
  assert.match(directFinish, /completeReaderPageGestureSettlement[\s\S]*drainPageTurnPreparationQueue/,
    'a direct or boundary fallback must resume queued preparation only after the gesture is idle');
  assert.match(rollbackFinish, /completeReaderPageGestureSettlement[\s\S]*drainPageTurnPreparationQueue/,
    'rollback must resume queued preparation only after the gesture is idle');
  assert.match(gesture,
    /this\.pageTurnDirection = undefined;\s*this\.pageTurnOffsetX = 0;/,
    'a missing prepared neighbour must stay stationary until the shared dispatcher uses its direct fallback');
});

contract('simulation proves page boundaries before arming preparation or Native', () => {
  const perform = methodSection(localReading, 'performPageTurn');
  const boundary = methodSection(localReading, 'knownPageTurnBoundary');

  assert.match(perform,
    /prepared === undefined[\s\S]*this\.knownPageTurnBoundary\(direction\)[\s\S]*this\.completeDirectPageTurnGesture\(\);[\s\S]*return boundary;/,
    'a proven first/last page must close the gesture without a blank simulation');
  assert.ok(perform.indexOf('this.knownPageTurnBoundary(direction)') <
    perform.indexOf('this.queuePageTurnPreparation(direction)'),
  'boundary proof must run before readiness preparation is retained');
  assert.match(boundary, /page\.endScalar > lastVisible/);
  assert.match(boundary, /containingPage\.pageIndex === 0 && previousChapterIndex === undefined/);
});

contract('an unknown restored predecessor is discovered without committing the visible page', () => {
  const drain = methodSection(localReading, 'drainPageTurnPreparationQueue');
  const start = methodSection(localReading, 'startPreviousPagePreparationDiscovery');
  const continueMeasurement = methodSection(localReading, 'continuePreviousChapterMeasurement');
  const prepare = methodSection(localReading, 'beginDiscoveredPreviousPagePreparation');
  const completeChapter = methodSection(localReading, 'completePreviousChapterPreparation');

  assert.match(drain,
    /target === undefined && direction === 'previous'[\s\S]*knownPageTurnBoundary\(direction\) === undefined[\s\S]*startPreviousPagePreparationDiscovery\(\)/,
    'a non-boundary cold predecessor must enter one explicit discovery lane');
  assert.match(start, /this\.captureMaterializedChapterContext\(\)/);
  assert.match(start, /new PreviousChapterMeasurement\([\s\S]*true,[\s\S]*origin,[\s\S]*this\.pageTurnGeneration/);
  assert.doesNotMatch(start, /updateProgress|resolveLocation|visiblePage\s*=/,
    'discovery must not write or promote reading progress');
  assert.match(continueMeasurement,
    /pending\.prepareOnly[\s\S]*beginDiscoveredPreviousPagePreparation/);
  assert.match(prepare, /restoreMaterializedChapterContext\(origin, false\)/);
  assert.match(prepare, /beginPageTurnPreparation\('previous', target\)/,
    'a discovered same-chapter page must rejoin the one normal preparation transaction');
  assert.match(completeChapter, /new PreparedReaderPageTurn\([\s\S]*'previous'/);
  assert.match(completeChapter, /this\.preparedPreviousPage = prepared/);
  assert.doesNotMatch(completeChapter, /completeFirstPage|updateProgress|resolveLocation/,
    'a discovered previous chapter must become a prepared texture page, not a direct page turn');
});

contract('settings and Appearance share one ReaderSettings page-turn truth', () => {
  assert.match(settingsState, /navigationMode: 'paged'/);
  assert.match(settingsState, /pageTransition: 'slide'/,
    'new and invalid snapshots must default to paged slide');
  assert.match(settingsState, /candidate\.version === 1 \?[\s\S]*pageTurnContractFor\(candidate\.pageTurnStyle\)/,
    'legacy overloaded values must migrate only at the settings boundary');
  assert.match(settingsState, /export function readerPageTurnStyle/);
  assert.match(settingsState,
    /export function setReaderPageTurnStyle\([\s\S]*isReaderPageTurnStyleAvailable\(style\)/);
  assert.match(settingsState,
    /style === 'simulation'[\s\S]*style === 'cover'[\s\S]*style === 'slide'[\s\S]*style === 'scroll'[\s\S]*style === 'none'/);

  assert.match(localReading, /const snapshot = setReaderPageTurnStyle\(this\.readerSettingsSnapshot, style\);/);
  assert.match(localReading, /const selected = readerPageTurnStyle\(this\.readerSettingsSnapshot\);/,
    'runtime presentation must derive from the same persisted setting exposed by control pages');
  assert.match(localReading,
    /if \(this\.reduceMotion \|\| \(selected === 'simulation' && this\.bookTurnRuntimeFailed\)\) \{\s*return 'none';/,
    'Reduce Motion or a failed simulation probe must explicitly choose no animation before DOWN');
  assert.match(localReading,
    /onPageTurnStyleChange: \(style: ReaderPageTurnStyle\): void =>\s*this\.changeReaderPageTurnStyle\(style\)/);

  assert.match(controlPanel, /pageTurnStyle: readerPageTurnStyle\(this\.settingsSnapshot\)/,
    'Appearance must display ReaderSettings rather than its legacy appearance.pageTurn field');
  assert.ok((controlPanel.match(/this\.onPageTurnStyleChange\(style\)/g) ?? []).length >= 3,
    'full Appearance plus compact/full Settings must forward the same mutation callback');
  assert.match(appearancePanel, /return kind === 'alignment' \|\| kind === 'language' \|\| kind === 'pageTurn';/);
  assert.match(appearancePanel, /return \['仿真', '覆盖', '平移', '滚动', '无动画'\];/);
  assert.match(appearancePanel,
    /const next: ReaderPageTurnStyle = option === '仿真' \? 'simulation'[\s\S]*this\.onPageTurnStyleChange\(next\);/);
});

contract('page-turn generations invalidate stale preparation and settlement owners', () => {
  const invalidate = methodSection(localReading, 'invalidatePageTurnRuntime');
  assert.match(invalidate, /this\.pageTurnGeneration/,
    'invalidation must advance the generation checked by every prepared page');
  assert.match(invalidate, /this\.preparedPreviousPage = undefined;/);
  assert.match(invalidate, /this\.preparedNextPage = undefined;/);
  assert.match(invalidate, /this\.pageTurnPreparationQueue/);
  assert.match(invalidate, /this\.pageTurnSettlementGeneration/,
    'invalidation must also revoke in-flight animation/Core settlement callbacks');
  assert.match(invalidate, /this\.pageTurnOffsetX = 0;/);
  assert.match(invalidate, /this\.pageTurnDirection = undefined;/);

  assert.match(localReading,
    /prepared\.generation === this\.pageTurnGeneration/,
    'prepared-page admission must reject an obsolete generation');
  assert.match(methodSection(localReading, 'aboutToDisappear'), /this\.invalidatePageTurnRuntime\(/,
    'unmount must revoke all page-turn work');
  assert.match(methodSection(localReading, 'resetForChapterSelection'), /this\.invalidatePageTurnRuntime\(/,
    'an explicit chapter transaction must revoke adjacent pages from its predecessor');
  assert.match(methodSection(localReading, 'changeReaderPageTurnStyle'), /this\.invalidatePageTurnRuntime\(/,
    'changing animation mode must revoke old stage ownership');
  assert.match(methodSection(localReading, 'admitAppearanceSnapshot'), /this\.invalidatePageTurnRuntime\(/,
    'a pagination-layout mutation must revoke pages measured with old typography');
  assert.match(localReading,
    /previousLayoutSignature !== undefined && previousLayoutSignature !== this\.paginationLayoutSignature\(\)[\s\S]*this\.invalidatePageTurnRuntime\(/,
    'a live viewport-layout mutation must revoke pages measured with old geometry');
});

contract('a live resize updates presentation geometry without invalidating an in-flight commit', () => {
  const admitViewport = methodSection(localReading, 'admitReaderViewportSize');
  const admitPresentation = methodSection(localReading, 'admitPageTurnPresentationWidth');
  const stageWidth = methodSection(localReading, 'pageTurnStageViewportWidth');
  const readingLayout = methodSection(localReading, 'readingLayout');
  const start = methodSection(localReading, 'startPreparedPageTurnSettlement');
  const finish = methodSection(localReading, 'finishPreparedPageTurnSettlement');
  const metricsReflow = methodSection(localReading, 'reflowAfterWindowGeometryChange');

  assert.match(admitViewport,
    /if \(this\.pageTurnInputPhase\(\) !== 'idle'\)[\s\S]*this\.pageTurnPendingViewportWidth = width;[\s\S]*if \(this\.pageTurnSettlementActive\) this\.admitPageTurnPresentationWidth\(width\);[\s\S]*rollbackPageTurnForDeferredMutation\(\);[\s\S]*return;/,
    'tracking rolls back before resize while settlement adapts the visible endpoint and defers logical width');
  assert.ok(admitViewport.indexOf("if (this.pageTurnInputPhase() !== 'idle')") <
    admitViewport.indexOf('Math.abs(width - this.viewportWidth)'),
  'returning to the original width during settlement must replace a newer pending width instead of being ignored');
  assert.doesNotMatch(admitViewport.match(/if \(this\.pageTurnInputPhase\(\) !== 'idle'\)[\s\S]*?\n    \}/)?.[0] ?? '',
    /this\.viewportWidth = width/,
    'the layout signature used by the durable prepared-page transaction must remain frozen until the join');
  assert.match(admitPresentation,
    /this\.pageTurnOffsetX = this\.pageTurnDirection === 'next' \? -width : width;/,
    'a resize during settlement must keep the moving page aligned to the live viewport endpoint');
  assert.match(stageWidth,
    /this\.pageTurnPresentationWidth > 0 \? this\.pageTurnPresentationWidth : this\.viewportWidth/,
    'stable rendering must fall back to the normal logical viewport width');
  assert.match(readingLayout,
    /if \(this\.pageTurnSettlementLayout !== undefined\) \{\s*return this\.pageTurnSettlementLayout;\s*\}/,
    'safe-area metrics and Core layout signatures must use the same frozen settlement snapshot');
  assert.match(start, /this\.pageTurnSettlementLayout = this\.readingLayout\(\);/,
    'the complete reading layout must be captured before animation and Core persistence race');
  const presented = methodSection(localReading, 'finishSuccessfulPageTurnPresentation');
  assert.ok(presented.indexOf('this.pageTurnSettlementLayout = undefined;') <
    presented.indexOf('this.resumeDeferredPageTurnWork();'),
  'new viewport and metrics facts may be admitted only after the transaction join releases its layout snapshot');
  assert.ok(metricsReflow.indexOf("if (this.pageTurnInputPhase() !== 'idle')") <
    metricsReflow.indexOf('const nextLayoutKey = this.windowMetricsLayoutKey();'),
  'a metrics-only change must roll back tracking or defer settlement before comparing frozen geometry');
});

if (failures.length > 0) {
  console.error(`reader page-turn pipeline contract: FAIL (${failures.length})`);
  failures.forEach((failure, index) => console.error(`${index + 1}. ${failure}`));
  process.exitCode = 1;
} else {
  console.log('reader page-turn pipeline contract: PASS');
}
