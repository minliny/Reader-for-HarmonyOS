import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(repo, path), 'utf8');

const motion = read('entry/src/main/ets/features/common/MotionSpec.ets');
assert.match(motion, /reader\.panel\.expand', durationMs: 420, curve: Curve\.EaseOut/);
assert.match(motion, /reader\.panel\.collapse', durationMs: 360, curve: Curve\.EaseIn/);

const control = read('entry/src/main/ets/features/reading/ReaderControlPanel.ets');
assert.match(control, /ReaderDirectoryModulePanel\(\{/);
assert.match(control, /ReaderQuickSearchPanel\(\{/);
assert.match(control, /ReaderAutoPagePanel\(\{/);
assert.match(control, /ReaderAppearanceModulePanel\(\{/);
assert.match(control, /ReaderAppearanceFullPanel\(\{/);
assert.match(control, /ReaderSettingsModulePanel\(\{/);
assert.match(control, /ReaderSettingsFullPanel\(\{/);
assert.match(control, /this\.onExpandDirectory\(\)/);
assert.match(control, /this\.activePage === 'home'[\s\S]{0,160}this\.onExpandDirectory\(\)/,
  'the grabber on the default quick control must expand the full directory');
assert.match(control, /READER_CONTROL_GRABBER_HIT_WIDTH = 72/,
  'the visual grabber must expose a practical direct hit target');
assert.match(control, /\.hitTestBehavior\(HitTestMode\.Block\)\s*\.accessibilityText\(this\.controlGrabberAccessibilityText\(\)\)/,
  'the expanded grabber target must own hits even when the visible child row is tapped');
assert.match(control, /PanGesture\(\{ direction: PanDirection\.Up, distance: READER_CONTROL_GRABBER_PAN_DISTANCE \}\)[\s\S]{0,160}this\.expandCurrentControl\(\)/,
  'an upward pull on the grabber must use the same expansion path as a click');
assert.match(control, /this\.activePage === 'quickReplace'[\s\S]{0,100}this\.onOpenRulesManagement\(\)/,
  'the Replace quick panel grabber must open its corresponding full management surface');
assert.match(control, /Slider\(\{\s*value: this\.effectiveProgressPercent\(\)/);
assert.match(control, /onPreviousChapter\(\)/);
assert.match(control, /onNextChapter\(\)/);
assert.match(control, /action === 'autoPage'/);
assert.match(control, /this\.promoteAutoPage\(\)/);
assert.match(control, /this\.onOpenReplace\(\)/);
assert.doesNotMatch(control, /action === 'replace'[\s\S]{0,180}this\.onSourceSwitch\(\)/);
assert.doesNotMatch(control, /currently exist only as Review frames/);
for (const page of ['moduleDirectory', 'moduleTts', 'moduleAppearance', 'moduleSettings',
  'fullAppearance', 'fullSettings']) {
  assert.ok(control.includes(page), `Reader control state machine is missing ${page}`);
}
assert.match(control, /module !== 'directory'[\s\S]*module !== 'settings'/);
assert.match(control, /if \(this\.reduceMotion\) \{\s*this\.onPageChange\(page\)/);
assert.match(control, /if \(this\.reduceMotion\) \{\s*this\.onPageChange\('quickSearch'\)/);
assert.match(control, /this\.reduceMotion \? TransitionEffect\.IDENTITY/);
assert.match(control, /\.height\('100%'\)\s+\.zIndex\(0\)\s+\.onClick\(\(\): void => this\.onDismiss\(\)\)/);
assert.equal((control.match(/\.height\('100%'\)\s+\.zIndex\(1\)\s+\.hitTestBehavior\(HitTestMode\.None\)/g) ?? []).length, 2);
assert.match(control, /\.accessibilityText\('阅读进度'\)/);
assert.match(control, /\.accessibilityText\('阅读亮度'\)/);
assert.doesNotMatch(control, /真面板\(目录\/朗读\/界面\/设置\)后续挂入本层/);

const gateway = read('entry/src/main/ets/features/reading/LocalReadingFlowGateway.ts');
const sessionGateway = read('entry/src/main/ets/features/reading/ReadingSessionFlowGateway.ts');
assert.match(sessionGateway, /async searchContent\(/);
assert.match(sessionGateway, /request\('search\.content', \{/);
assert.match(sessionGateway, /sourceId: this\.sourceId/);
assert.doesNotMatch(sessionGateway, /READING_CONTENT_SEARCH_REQUIRES_LOCAL_MATERIALIZATION/);
assert.doesNotMatch(gateway, /async searchContent\(/,
  'source-scoped cache search belongs to the shared reading session, not the local acquisition gateway');
assert.match(gateway, /request\('cache\.book\.status'/);
assert.match(gateway, /request\('bookmark\.list'/);
assert.match(gateway, /downloadState: LocalReadingDownloadState/);

const experience = read('entry/src/main/ets/features/reading/LocalReadingExperience.ets');
assert.match(experience, /if \(this\.controlVisible\) \{/);
assert.match(experience, /if \(this\.controlPage !== 'home'\) \{/);
assert.match(experience, /this\.activeGateway\(\)\.searchContent\(this\.bookId, keyword, 50, isCurrent\)/);
assert.match(experience, /this\.selectChapterAnchor\(result\.chapterIndex, result\.chapterOffset, false\)/);
assert.match(experience, /onExpandDirectory: \(\): void => this\.onOpenDirectory\(\)/);
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
assert.match(experience, /readerWindow\.setWindowBrightness\(normalized\)/);
assert.match(experience, /readerWindow\.setWindowBrightness\(-1\)/);
assert.match(experience, /ReaderPageInteractionLayer\(\{/);
assert.match(experience, /onTurn: \(direction: ReaderPageTurnDirection\): ReaderPageTurnOutcome =>\s*this\.requestPageTurn\(direction\)/);
assert.match(experience, /onManualInteraction: \(\): void => this\.pauseAutoPageForInteraction\(\)/);
assert.doesNotMatch(experience, /\.onClick\(\(\): void => \{\s*this\.pauseAutoPageForInteraction\(\);\s*this\.turn(Previous|Next)Page\(\)/,
  'tap and pan must not retain separate direct page-turn paths');
assert.doesNotMatch(experience, /reader\.page\.turn\.none.*animateTo/);
assert.match(experience, /visible: this\.controlVisible && !this\.controlObscured/);
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
assert.match(pageInteraction, /GestureGroup\(\s*GestureMode\.Exclusive,\s*PanGesture\(\{/,
  'the horizontal pan must compete exclusively with tap and be registered first');
assert.match(pageInteraction, /direction: PanDirection\.Horizontal/);
assert.match(pageInteraction, /distance: READER_PAGE_PAN_DISTANCE/);
assert.match(pageInteraction, /\.onActionStart\([\s\S]*\.onActionUpdate\([\s\S]*\.onActionEnd\([\s\S]*\.onActionCancel\(/);
assert.match(pageInteraction, /TapGesture\(\{ fingers: 1, count: 1 \}\)/);
assert.match(pageInteraction, /event\.fingerList\[0\]\.localX/,
  'tap zones must use element-local rather than global screen coordinates');
assert.match(pageInteraction, /event\.target\.area\.width/,
  'tap zones must prefer the width from the same local gesture target');
assert.match(pageInteraction, /this\.onManualInteraction\(\)/,
  'manual touch must pause auto-page before dispatching a page turn');
assert.match(pageInteraction, /左侧上一页，中间打开阅读控制，右侧下一页/);
assert.doesNotMatch(pageInteraction, /setTimeout|pendingTurn|queuedTurn/,
  'a busy manual turn must not be queued or replayed');

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
assert.match(fullDirectoryPanel, /return Math\.max\(117, this\.bodyContentHeight\(\) - 143\)/);
assert.match(fullDirectoryPanel, /List\(\{ space: 0, scroller: this\.listScroller \}\)[\s\S]*Repeat\(this\.projectedEntries\)[\s\S]*\.virtualScroll\(\{ totalCount: this\.projectedEntries\.length, reusable: false \}\)/);
assert.match(fullDirectoryPanel, /this\.listScroller\.scrollEdge\(Edge\.Bottom\)/);
assert.match(fullDirectoryPanel, /this\.activeTab === 'bookmarks'/);
assert.match(fullDirectoryPanel, /ReaderSearchField\(\{[\s\S]*variant: 'readerDirectory'/);
assert.match(fullDirectoryPanel, /private controlButtonLabel\(kind: string\): string/);
assert.match(fullDirectoryPanel, /\.accessibilityText\(`打开章节：\$\{repeatItem\.item\.title\}`\)/);
assert.match(fullDirectoryPanel, /this\.onDeleteBookmarks\(markerState\.bookmarkTimes\)/);

const entryAbility = read('entry/src/main/ets/entryability/EntryAbility.ets');
assert.match(entryAbility, /onForeground\(\): void \{\s*AppStorage\.setOrCreate\('readerAppForeground', true\)/);
assert.match(entryAbility, /onBackground\(\): void \{\s*AppStorage\.setOrCreate\('readerAppForeground', false\)/);

console.log('reader-control-p0 static contract: PASS');
