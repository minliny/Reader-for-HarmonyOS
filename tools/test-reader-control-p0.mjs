import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(repo, path), 'utf8');

// Execution reference v1.1 supersedes the old independent fades, 120ms handle
// snap and Home->Directory / Replace->external expansion assumptions.
// These are production wiring guards; executable event/geometry tests remain
// in test-reader-control-session-state / gesture / motion-geometry suites.
const control = read('entry/src/main/ets/features/reading/ReaderControlPanel.ets');
const stage = read('entry/src/main/ets/features/reading/ReaderControlMotionStage.ets');
const appearance = read('entry/src/main/ets/features/reading/ReaderControlAppearanceContent.ets');
assert.match(control, /@Link @Watch\('onControlSessionChanged'\) controlSession: ReaderControlSessionState/);
// Runtime execution is covered by test-reader-control-runtime. This guard
// checks that production no longer crosses a non-reactive BuilderParam owner.
assert.match(control, /@State private visualExpansionProgress:/);
assert.match(control, /@State private visualVisibilityProgress:/);
assert.doesNotMatch(control, /@State private visualSession:/);
assert.match(control, /new ReaderControlRuntime/);
assert.match(control, /runtime\.command\(this\.controlSession\)/);
assert.match(control, /update\.endpoint !== undefined.*commitVisualSession/);
assert.match(control, /this\.topBar\(\)/);
assert.match(control, /this\.controlContent\(\)/);
assert.doesNotMatch(control, /ReaderControlMotionStage\(|@BuilderParam|contentSlotActive|secondaryModuleActive/);
assert.doesNotMatch(control, /renderGroup\(true\)|animateTo\(|setTimeout\(/);
assert.match(control, /this\.handleControlTouch\(event\)/);
assert.match(control, /\.width\(72\)\.height\(28\)/);
for (const component of ['ReaderControlDirectoryContent', 'ReaderControlAppearanceContent',
  'ReaderControlSearchContent', 'ReaderControlSettingsContent', 'ReaderControlTtsContent',
  'ReaderControlAutoPageContent', 'ReaderControlReplaceContent']) {
  assert.equal((control.match(new RegExp(component + '\\(\\{', 'g')) ?? []).length, component === 'ReaderControlTtsContent' || component === 'ReaderControlAutoPageContent' ? 2 : 1,
    component + ' keeps one business instance; playback also exposes a pure visual-source factory');
}
assert.match(control, /tab: this\.contentLocation\(\)\.directoryTab/,
  'Directory keeps the last visible location through the hidden endpoint');
assert.match(control, /setReaderControlDirectoryTab/);
assert.match(control, /motionProgress: this\.contentMotionProgress/);
assert.doesNotMatch(appearance, /animateTo\(|panelActorTransition/);
assert.match(control, /Slider\(\{\s*value: this\.effectiveProgressPercent\(\)/);
assert.match(control, /onPreviousChapter\(\)/);
assert.match(control, /onNextChapter\(\)/);
assert.match(control, /this\.onOpenReplace\(\)/);
assert.match(control, /const destination: ReaderControlPage = this\.isActiveModule\(module\) \? 'home' : page/);
assert.match(control, /\.accessibilityText\('阅读进度'\)/);
assert.match(control, /\.accessibilityText\('阅读亮度'\)/);
assert.match(control, /onAppearanceFontOrderChange\(fontOrder\)/);
assert.match(control, /onAppearanceCustomFontImport\(\)/);

const gateway = read('entry/src/main/ets/features/reading/LocalReadingFlowGateway.ts');
const sessionGateway = read('entry/src/main/ets/features/reading/ReadingSessionFlowGateway.ts');
assert.match(sessionGateway, /async searchContentPage\(/);
assert.match(sessionGateway, /request\('search\.content', params/);
assert.match(sessionGateway, /sourceId: this\.sourceId/);
assert.doesNotMatch(sessionGateway, /READING_CONTENT_SEARCH_REQUIRES_LOCAL_MATERIALIZATION/);
assert.doesNotMatch(gateway, /async searchContent\(/,
  'source-scoped cache search belongs to the shared reading session, not the local acquisition gateway');
assert.match(gateway, /request\('cache\.book\.status'/);
assert.match(gateway, /request\('bookmark\.list'/);
assert.match(gateway, /downloadState: LocalReadingDownloadState/);

const experience = read('entry/src/main/ets/features/reading/LocalReadingExperience.ets');
assert.match(experience, /@State @Watch\('onControlSessionChanged'\) private controlSession/);
assert.match(experience, /controlSession: \$controlSession/);
assert.match(experience, /private latestControlVisualSession: ReaderControlSessionState/,
  'Host keeps the latest visual sample as a plain field');
assert.match(experience, /onVisualSessionChange: \(state: ReaderControlSessionState\)/,
  'Panel visual sample callback is wired to the plain Host field');
assert.match(experience, /private controlMotionSession\(\): ReaderControlSessionState/,
  'Back/close derives from the latest visual sample');
assert.doesNotMatch(experience, /this\.controlVisible\s*=(?!=)|this\.controlPage\s*=(?!=)|scheduleControlRouteReset/);
assert.match(experience, /private hideControl\(\): void \{[\s\S]*?dismissReaderControlSession/);
assert.match(experience, /readerControlHostCloseCommitted\(this\.controlSession, this\.observedControlCloseRevision\)/);
assert.match(experience, /private requestExit\(\): void \{[\s\S]*?controlTemporaryLayer[\s\S]*?backReaderControlHostSession[\s\S]*?if \(result\.consumed\)/);
assert.match(experience, /reduceReaderControlBackdropTouch\(this\.controlBackdropState/);
assert.match(experience, /invalidationRevision: this\.controlInputRevision/);
assert.match(experience, /ReaderControlPanel\(\{[\s\S]*?onDismiss: \(\): void => this\.hideControl\(\)/);
assert.match(experience,
  /this\.activeGateway\(\)\.searchContentPage\(this\.bookId, keyword, READER_CONTENT_SEARCH_PAGE_SIZE, 0, isCurrent\)/);
assert.match(experience,
  /this\.controlPage\(\) === 'quickSearch' \|\| this\.controlPage\(\) === 'fullSearch'/,
  'a running search must remain live while Quick Search expands into Full Search');
assert.match(experience, /this\.selectBookmarkAnchor\(result\.chapterIndex, result\.chapterOffset, result\.positionScope\)/,
  'search positions pass through the shared persisted-anchor scope guard before selection');
assert.match(experience, /onExpandDirectory: \(\): void => this\.expandControlDirectory\(\)/);
assert.match(experience, /void this\.loadReaderSettingsSnapshot\(lifecycleToken\)/);
assert.match(experience, /settingsSnapshot: this\.readerSettingsSnapshot/);
assert.match(experience, /onSettingsToggleChange: \(key: ReaderSettingsToggleKey, value: boolean\)/);
assert.match(experience, /private requestPageTurn\(direction: ReaderPageTurnDirection\): ReaderPageTurnOutcome/);
assert.match(experience, /private turnNextPage\(\): ReaderPageTurnOutcome/);
assert.match(experience, /private turnPreviousPage\(\): ReaderPageTurnOutcome/);
assert.match(experience, /this\.measureCommittedPageAt\(nextOffset\)/);
assert.match(experience, /this\.paginationIndex\.findContainingPage\(key, page\.startScalar\)/);
assert.match(experience, /this\.paginationIndex\.findPreviousPage\(key, page\.startScalar, previousChapterKey\)/);
assert.doesNotMatch(experience, /pageBackStack|ReadingPageHistoryAnchor/);
assert.match(experience, /private seekControlProgress\(percent: number\): void/);
assert.match(experience, /private stepControlChapter\(delta: number\): void/);
assert.match(experience, /this\.enqueueReaderBrightness\(readerBrightnessWindowValue\(percent\), 'manual'\)/);
assert.match(experience, /this\.enqueueReaderBrightness\(-1, 'automatic'\)/);
assert.match(experience, /private brightnessMutationQueue: Promise<void> = Promise\.resolve\(\)/,
  'brightness side effects must be serialized so the last user intent wins');
assert.match(experience, /ReaderWindowCoordinator\.brightness\(\)\.request\(owner, target\)/);
assert.match(experience, /private restoreInitialWindowBrightness\(\): void/,
  'the reader must restore the pre-reader window brightness policy on exit');
assert.match(experience, /ReaderPageInteractionLayer\(\{/);
assert.match(experience,
  /onTurn: \(direction: ReaderPageTurnDirection\): ReaderPageTurnOutcome =>\s*this\.requestPageTurn\(direction\)/);
assert.match(experience, /onManualInteraction: \(\): void => this\.onReaderManualInteraction\(\)/);
assert.match(experience, /private onReaderManualInteraction\(\): void \{[\s\S]*screenAwakeLease\?\.rearm\(\)[\s\S]*pauseAutoPageForInteraction/);
assert.doesNotMatch(experience, /\.onClick\(\(\): void => \{\s*this\.pauseAutoPageForInteraction\(\);\s*this\.turn(Previous|Next)Page\(\)/,
  'tap and pan must not retain separate direct page-turn paths');
assert.doesNotMatch(experience, /reader\.page\.turn\.none.*animateTo/);
assert.match(experience, /inputEnabled: this\.isControlInputEnabled\(\)/);
assert.match(experience, /reduceMotion: this\.reduceMotion/);
assert.match(experience, /autoPageStatus: this\.autoPageState\.status/);
assert.match(experience, /private armAutoPageTimer\(resetDeadline: boolean\): void/);
assert.match(experience, /private onAppForegroundChanged\(\): void/);
assert.match(experience, /endReaderAutoPageAtBookEnd\(this\.autoPageState, generation\)/);
assert.doesNotMatch(experience, /\.width\('(33|34)%'\)/,
  'page-turn hit regions must not be separate percentage-width click rows');
assert.match(experience, /private numericAreaLength\(value: Length\): number \{[\s\S]*typeof value === 'string'[\s\S]*Number\.parseFloat\(value\)/,
  'physical-device vp string Areas must drive the real pagination viewport');

const pageInteraction = read('entry/src/main/ets/features/reading/ReaderPageInteractionLayer.ets');
const pageGestureState = read('entry/src/main/ets/features/reading/ReaderPageGestureState.ts');
assert.match(pageInteraction,
  /\.onTouch\(\(event: TouchEvent\): void => this\.handleTouch\(event\)\)[\s\S]*TouchType\.Down[\s\S]*TouchType\.Move[\s\S]*TouchType\.Up/,
  'one raw pointer arena must own tap, horizontal drag, control, and selection arbitration');
assert.doesNotMatch(pageInteraction, /\bGestureGroup\(|\bPanGesture\(|\bTapGesture\(/,
  'page input must not wait for ArkUI Pan recognition or a delayed Tap callback');
assert.match(pageInteraction, /startReaderPagePan\([\s\S]*localX,[\s\S]*localY/,
  'the normalized physical DOWN must be recorded before touch slop is crossed');
assert.match(pageInteraction, /const offsetX = localX - this\.gestureState\.startLocalX/,
  'tap and drag zones must stay in the page-stage local vp space');
assert.match(pageInteraction, /readerPagePointerCoordinate\([\s\S]*pointer\.x/,
  'touch-target coordinates must be normalized to the measured page-stage extent');
assert.match(pageInteraction, /event\.target\.area\.width/,
  'input zones must prefer the width from the same raw touch target');
assert.match(pageInteraction,
  /normalized\.indexOf\('%'\) < 0 \? Number\.parseFloat\(normalized\) : Number\.NaN/,
  'a declarative 100% target length must fall back to the measured viewport instead of becoming 100vp');
assert.match(pageInteraction,
  /READER_PAGE_TAP_MAX_DURATION_MS = READER_PAGE_GESTURE_LONG_PRESS_MS/);
assert.doesNotMatch(pageInteraction,
  /if \(event\.type === TouchType\.Down\)[\s\S]{0,500}this\.onManualInteraction\(\)/,
  'pointer DOWN must not pause Auto Page before a center control tap is distinguished');
assert.match(pageInteraction,
  /if \(intent === 'control'\) \{[\s\S]*?this\.onOpenControl\(\);[\s\S]*?return;[\s\S]*?\}\s*this\.reportManualInteraction\(\);\s*this\.onTurn\(intent\)/,
  'opening controls must preserve a running session while side taps still report manual page turns');
const continuousStage = read('entry/src/main/ets/features/reading/ReaderContinuousReadingStage.ets');
assert.doesNotMatch(continuousStage,
  /if \(event\.type === TouchType\.Down\)[\s\S]{0,300}this\.onManualInteraction\(\)/,
  'continuous reading DOWN must not pause Auto Page before tap-versus-scroll is known');
assert.match(continuousStage,
  /this\.touchMoved = this\.touchMoved \|\| moved;[\s\S]*?if \(event\.type === TouchType\.Move\)[\s\S]*?this\.reportManualInteraction\(\)/,
  'continuous scrolling must still pause Auto Page once movement is established');
assert.match(pageGestureState, /READER_PAGE_GESTURE_LONG_PRESS_MS = 500/,
  'a stationary long press belongs to text selection and must not open controls on release');
assert.match(pageInteraction,
  /if \(this\.activePointerId >= 0\) \{\s*return;\s*\}/,
  'later fingers must be ignored without restarting or cancelling the first pointer');
assert.match(pageInteraction,
  /event\.type === TouchType\.Up \?\s*this\.changedPointerForEvent\(event\) : this\.pointerForEvent\(event\)/,
  'an UP must resolve only from changedTouches so a later finger cannot end the first pointer');
assert.match(pageInteraction,
  /private changedPointerForEvent\([\s\S]*event\.changedTouches[\s\S]*return undefined;/,
  'later-finger UP must be ignored while the first pointer remains active');
assert.match(pageInteraction, /event\.stopPropagation\(\)[\s\S]*event\.preventDefault\(\)/,
  'only a horizontally admitted page turn may cancel underlying text input');
assert.match(pageInteraction, /this\.onManualInteraction\(\)/,
  'manual touch must pause auto-page before dispatching a page turn');
assert.match(pageInteraction,
  /systemOwnsPointer\(event, pointer\)[\s\S]*Do not stop propagation/,
  'Harmony back/home edge streams must be rejected before the reader creates gesture state');
assert.match(pageInteraction, /event\.timestamp[\s\S]*lastSampleTimeMs/,
  'pointer velocity and tap duration must use the platform event clock');
assert.match(pageInteraction, /this\.inputClock\.sample\(event\.timestamp, readerMotionNowMs\(\)\)/,
  'ArkUI monotonic touch timestamps are nanoseconds and must be normalized before gesture math');
assert.match(experience,
  /systemGestureLeftInset: this\.readerSystemGestureLeftInset\(\)[\s\S]*systemGestureBottomInset: this\.readerSystemGestureBottomInset\(\)/,
  'the page arena must consume the current Window gesture/navigation insets');
assert.match(experience,
  /const pageCanReceiveInput = this\.phase === 'ready' \|\| this\.visiblePage !== undefined;/,
  'a committed visible page must keep centre controls touchable during neighbour preparation');
const tapOnlyInput = experience.match(
  /private pageTurnTapOnlyInput\(\): boolean \{([\s\S]*?)\n  \}/,
)?.[1] ?? '';
assert.match(tapOnlyInput,
  /this\.pageTurnSettlementActive \|\| this\.pageTurnSettlingPrepared !== undefined/,
  'only a non-interruptible settlement may reserve a deferred pointer segment');
assert.doesNotMatch(tapOnlyInput, /pageTurnPreparation|phase === 'measuring'/,
  'background neighbour preparation must not turn the whole screen into a delayed tap-only surface');
assert.match(experience,
  /private canStartReaderPageTurn\(direction: ReaderPageTurnDirection\): boolean \{[\s\S]*if \(!this\.canTurnPage\(\)\) return false;/,
  'page motion must stay silent while the materialized context is speculative');
assert.match(experience,
  /canStartBookmark: \(\): boolean => this\.canStartReaderBookmarkGesture\(\)/,
  'bookmark preview must use the same background-preparation readiness boundary');
assert.match(pageInteraction,
  /const bookmarkBlocked = priorOwner === 'undecided' &&\s*this\.gestureState\.owner === 'bookmark' && !this\.canStartBookmark\(\);[\s\S]*pageOwnerBlocked \|\| bookmarkBlocked/,
  'a blocked speculative bookmark must not mutate the visible page');
assert.match(pageInteraction, /左侧上一页，中间打开阅读控制，右侧下一页/);
assert.match(pageInteraction,
  /READER_PAGE_POINTER_STALL_TIMEOUT_MS = 15000[\s\S]*armPointerWatchdog\(\)[\s\S]*this\.cancelPan\(\);[\s\S]*this\.resetRawPointer\(\);/,
  'a lost UP or CANCEL must roll back and release page/control ownership');
assert.doesNotMatch(pageInteraction, /pendingTurn|queuedTurn/,
  'a busy manual turn must not be queued or replayed');
assert.match(experience,
  /pageTurnInputPhase\(\): ReaderPageTurnInputPhase[\s\S]*return 'idle';[\s\S]*pageTurnOwnsReaderInput\(\)[\s\S]*pageTurnInputPhase\(\) !== 'idle'[\s\S]*openReaderControl\(\)[\s\S]*this\.pageTurnOwnsReaderInput\(\)/,
  'the control surface must never replace an active native or host page-turn input owner');
assert.match(experience,
  /private beginExit\(\): void \{[\s\S]*inputPhase === 'tracking' \|\| inputPhase === 'dragging'[\s\S]*cancelReaderPagePan[\s\S]*pageTurnPendingExit = true/,
  'back must roll an uncommitted sheet to rest before route ownership exits');

const requestTurn = experience.match(
  /private requestPageTurn\(direction: ReaderPageTurnDirection\): ReaderPageTurnOutcome \{([\s\S]*?)\n  \}\n\n  private turnNextPage/,
);
assert.ok(requestTurn, 'the unified page-turn request gate must exist');
assert.match(requestTurn[1], /interactionBlocked \|\| this\.controlObscured[\s\S]*kind: 'blocked', reason: 'overlay'/);
assert.match(requestTurn[1], /this\.controlVisible[\s\S]*kind: 'blocked', reason: 'control'/);
assert.ok(requestTurn[1].indexOf("reason: 'overlay'") < requestTurn[1].indexOf('this.turnPreviousPage()'),
  'an overlay must block before either production page-turn handler can run');

const shell = read('entry/src/main/ets/features/shell/ReaderShell.ets');
assert.match(shell, /animateFromControl: this\.directoryOpenedFromControl/);
assert.match(shell, /controlObscured: this\.route === 'directory'/);
assert.match(shell, /interactionBlocked: !this\.visible \|\| this\.route !== 'reading' \|\| this\.sourceSwitchVisible/,
  'hidden, directory, and source-switch layers must transfer pointer ownership away from reading');
assert.match(shell, /onDeleteBookmarks: \(bookmarkTimes: number\[\]\): void => this\.onDeleteBookmarks\(bookmarkTimes\)/);
assert.equal((shell.match(/reduceMotion: this\.reduceMotion/g) ?? []).length, 2);
assert.match(shell, /\.opacity\(this\.visible \? 1 : 0\)/);

const index = read('entry/src/main/ets/pages/Index.ets');
assert.match(index, /if \(this\.route === 'directory'\) \{\s*this\.closeDirectory\(\)/);
assert.match(index, /route: this\.route === 'directory' \? 'directory' : 'reading'/);
assert.match(index, /private openReaderControlDirectory\(\): void/);
assert.match(index, /this\.directoryReturnTarget === 'readerControl'/);
assert.match(index, /reduceMotion: this\.settingsSnapshot\.reduceMotion/);

const settings = read('entry/src/main/ets/features/settings/SettingsPage.ets');
assert.match(settings, /@Prop @Watch\('onSnapshotChanged'\) snapshot/);
assert.match(settings, /onRowClick: \(\): void => this\.toggleSetting\(key, !this\.settingValue\(key\)\)/);
assert.match(settings, /this\.reduceMotionValue = value/);

const fullDirectory = read('entry/src/main/ets/features/reading/ReaderFullDirectory.ets');
assert.match(fullDirectory,
  /return this\.collapsedPanelHeight\(\) \+ \(this\.panelHeightDelta\(\) \* this\.panelProgress\)/);
assert.match(fullDirectory,
  /return this\.fullPanelTop\(\) \+ \(this\.panelHeightDelta\(\) \* \(1 - this\.panelProgress\)\)/);
assert.match(fullDirectory,
  /const available = Math\.max\(0, this\.liveContainerHeight\(\) - this\.fullPanelTop\(\) - safeBottom\);\s*return Math\.min\(designHeight, available\)/,
  'full directory height must clamp its Figma endpoint to the live safe viewport');
assert.match(fullDirectory, /motionAnimateParam\('reader\.panel\.collapse'/);
assert.match(fullDirectory, /return this\.animateFromControl && !this\.usesExpandedLayout\(\) && !this\.reduceMotion/);
assert.match(fullDirectory, /\.accessibilityText\('收起目录'\)/);

const fullDirectoryPanel = read('entry/src/main/ets/features/reading/FullDirectoryPanel.ets');
const directoryList = read('entry/src/main/ets/features/reading/ReaderDirectoryList.ets');
assert.match(fullDirectoryPanel, /return Math\.max\(117, this\.bodyContentHeight\(\) - 143\)/);
assert.match(directoryList, /List\(\{ space: 0, scroller: this\.scroller \}\)[\s\S]*LazyForEach\(this\.dataSource/);
assert.match(fullDirectoryPanel, /this\.listScroller\.scrollEdge\(Edge\.Bottom\)/);
assert.match(fullDirectoryPanel, /this\.activeTab === 'bookmarks'/);
assert.match(fullDirectoryPanel, /ReaderSearchField\(\{[\s\S]*variant: 'readerDirectory'/);
assert.match(fullDirectoryPanel, /private controlButtonLabel\(kind: string\): string/);
assert.match(fullDirectoryPanel, /\.accessibilityText\(repeatItem\.item\.navigable === false \? `卷标题：\$\{repeatItem\.item\.title\}` : `打开章节：\$\{repeatItem\.item\.title\}`\)/);
assert.match(fullDirectoryPanel, /this\.onDeleteBookmarks\(markerState\.bookmarkTimes\)/);

const entryAbility = read('entry/src/main/ets/entryability/EntryAbility.ets');
assert.match(entryAbility, /onForeground\(\): void \{\s*AppStorage\.setOrCreate\('readerAppForeground', true\)/);
assert.match(entryAbility, /onBackground\(\): void \{\s*AppStorage\.setOrCreate\('readerAppForeground', false\)/);

console.log('reader-control-p0 static contract: PASS');
