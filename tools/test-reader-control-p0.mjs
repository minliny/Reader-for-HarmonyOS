import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readerControlExpansionTarget } from
  '../entry/src/main/ets/features/reading/ReaderControlRouting.ts';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(repo, path), 'utf8');

const motion = read('entry/src/main/ets/features/common/MotionSpec.ets');
assert.match(motion, /reader\.panel\.expand', durationMs: 420, curve: Curve\.EaseOut/);
assert.match(motion, /reader\.panel\.collapse', durationMs: 360, curve: Curve\.EaseIn/);
assert.match(motion, /reader\.control\.handle\.snap', durationMs: 120, curve: Curve\.EaseOut/,
  'the grabber release settle must own its own 120ms snap token, not borrow the 360ms panel collapse');
assert.match(motion,
  /function fadeSlideTransition[\s\S]*?TransitionEffect\.OPACITY\s*\.combine\(TransitionEffect\.translate\(\{ y: fromY \}\)\)/,
  'MR1 authors control show/hide as opacity + translate; the pure-translate version left the hide beat invisible');
assert.match(motion,
  /export function showHideTransition\(showId: string, hideId: string, fromY: number\): TransitionEffect \{\s*return TransitionEffect\.asymmetric\(/,
  'show and hide must resolve through the asymmetric pair so the exit uses the hide token');
assert.match(motion,
  /export function panelActorTransition\(id: string, fromY: number, delayMs: number = 0\): TransitionEffect \{\s*const entry = requireEntry\(id\);\s*const anim: AnimateParam = delayMs > 0 \?/,
  'the J~Q shell-morph actors resolve through one registry-backed transition factory');
assert.match(motion,
  /export function panelActorTransition\([\s\S]*?TransitionEffect\.OPACITY\s*\.combine\(TransitionEffect\.translate\(\{ y: fromY \}\)\)/,
  'J~Q authors every shell-morph actor as opacity + 18px translate, never translate-only');
assert.match(motion,
  /reader\.panel\.shell\.expand', durationMs: 420, curve: curves\.cubicBezierCurve\(0\.2, 0, 0, 1\)/,
  'the shell board expands on the J/L cubic(0.2,0,0,1) beat at 420ms');
assert.match(motion,
  /reader\.panel\.shell\.collapse', durationMs: 360, curve: curves\.cubicBezierCurve\(0\.45, 0, 0\.55, 1\)/,
  'the shell board collapses on the K/M/O/Q ease-in-out beat at 360ms');
assert.match(motion,
  /reader\.panel\.dock\.outgoing', durationMs: 230, curve: Curve\.EaseIn/,
  'the quick dock leaves on the J~Q ease-out keyframe pair scaled to 420ms');
assert.match(motion,
  /reader\.panel\.dock\.incoming', durationMs: 150, curve: Curve\.EaseOut/,
  'the quick dock returns with the late ease-out beat at 150ms');
assert.match(motion,
  /reader\.panel\.full\.incoming', durationMs: 330, curve: Curve\.EaseOut/,
  'full panel content fades in late (delay 140) on the J~Q ease-out window');
assert.match(motion,
  /reader\.panel\.full\.outgoing', durationMs: 150, curve: curves\.cubicBezierCurve\(0\.45, 0, 0\.55, 1\)/,
  'full panel content leaves first on the collapse ease-in-out beat (delay 10)');
assert.match(motion,
  /reader\.session\.capsule\.morph\.flight',\s*\n\s*durationMs: 480, curve: curves\.cubicBezierCurve\(0\.4, 0, 0\.2, 1\)/,
  'the Review C/D/E/F flight beat is the 2026-09-02 product supplement at 480ms');
assert.match(motion,
  /reader\.session\.capsule\.morph\.expand',\s*\n\s*durationMs: 240, curve: curves\.cubicBezierCurve\(0\.2, 0, 0, 1\)/,
  'the right-edge shell expand is the 2026-09-02 product supplement at 240ms');
assert.match(motion,
  /reader\.session\.capsule\.morph\.reveal', durationMs: 160, curve: Curve\.EaseOut/,
  'the content reveal is the 2026-09-02 product supplement at 160ms');
assert.match(motion,
  /reader\.session\.capsule\.morph\.dot\.hold', durationMs: 120, curve: Curve\.Linear/,
  'the canonical 24vp shell holds before it expands');

const control = read('entry/src/main/ets/features/reading/ReaderControlPanel.ets');
const appearanceStage = read('entry/src/main/ets/features/reading/ReaderAppearanceMotionStage.ets');
const appearanceMotionState = read('entry/src/main/ets/features/reading/ReaderAppearanceMotionState.ts');
const appearanceQuick = read('entry/src/main/ets/features/reading/ReaderAppearanceModulePanel.ets');
const appearanceSharedActors = read('entry/src/main/ets/features/reading/ReaderAppearanceSharedActors.ets');

assert.equal((control.match(/panelActorTransition\('reader\.panel\.full\.incoming', 18, 140\)/g) ?? []).length, 3,
  'Search/Settings/Tts enter with the delayed J~Q fade+slide; Appearance is element-level (N frame)');
assert.equal((control.match(/panelActorTransition\('reader\.panel\.full\.outgoing', 18, 10\)/g) ?? []).length, 4,
  'all four full panels leave on the collapse ease-in-out beat while the shell board shrinks');
assert.match(control,
  /private fullAppearanceDock\(\)[\s\S]*?TransitionEffect\.asymmetric\(\s*TransitionEffect\.IDENTITY,\s*panelActorTransition\('reader\.panel\.full\.outgoing', 18, 10\)/,
  'the Appearance dock must hand its entrance to the element-level children (N frame) and keep only the board exit');
assert.equal((control.match(/panelActorTransition\('reader\.panel\.dock\.incoming', 18, 150\)/g) ?? []).length, 1,
  'the quick dock returns through the single morph-shell B layer, once');
assert.equal((control.match(/panelActorTransition\('reader\.panel\.dock\.outgoing', 18\)/g) ?? []).length, 1,
  'the quick dock leaves through the single morph-shell B layer, once');
assert.match(control, /private morphShellControlDock\(\)/,
  'quick and full control pages must share one morph-shell board (J~Q MorphStage)');
assert.match(control,
  /private controlDock\(\) \{\s*if \(this\.usesPhoneAppearanceMotionStage\(\)\) \{\s*this\.appearanceMotionDock\(\);/,
  'Phone Appearance must bypass the generic conditional-mount shell and enter its persistent N/O stage');
assert.match(control,
  /return !this\.isExpanded\(\) &&\s*\(this\.activePage === 'moduleAppearance' \|\| this\.activePage === 'fullAppearance'\)/,
  'both Appearance route endpoints must preserve the same Phone stage instance');
assert.match(control,
  /ReaderAppearanceMotionStage\(\{[\s\S]*?expanded: this\.activePage === 'fullAppearance'[\s\S]*?onEndpointChange:/,
  'route state may follow only the motion stage stable endpoint callback');
assert.match(control,
  /motionFrame: context\.frame/,
  'the persistent FullPanel must keep legacy TransitionEffects disabled for both N and O');
assert.match(control, /showGrabber: false/,
  'the persistent appearance stage must own the only visible and interactive grabber');
assert.match(control, /return this\.usesPhoneAppearanceMotionStage\(\) \|\|/,
  'quick Appearance must use the same top-anchored 736vp stage as full Appearance');
assert.match(appearanceStage, /class ReaderAppearanceStageFrameCallback extends FrameCallback/);
assert.match(appearanceStage,
  /\.onTouch\(\(event: TouchEvent\): void => this\.handleGrabberTouch\(event\)\)/,
  'appearance grabber must directly sample raw touch for one-to-one follow');
assert.doesNotMatch(appearanceStage, /PanGesture\s*\(/,
  'appearance follow must not return to the old release-only PanGesture path');
assert.doesNotMatch(appearanceStage, /animateTo\s*\(/,
  'appearance stage must have one interruptible frame clock, not competing animateTo owners');
assert.match(appearanceStage, /expectedEpoch !== this\.motionState\.epoch/,
  're-grab must invalidate already posted settlement frames');
assert.match(appearanceStage,
  /private fullMorphStageLayer\(\)[\s\S]*?this\.fullLayer\(\)[\s\S]*?\.height\(this\.contentShellHeight\(\)\)[\s\S]*?y: this\.contentShellTop\(\)[\s\S]*?\.clip\(true\)/,
  'Full content must inherit the bottom-anchored MorphStage coordinate and clip');
assert.match(appearanceStage,
  /private quickMorphStageLayer\(\)[\s\S]*?this\.quickMorphLayer\(\)[\s\S]*?\.height\(this\.contentShellHeight\(\)\)[\s\S]*?y: this\.contentShellTop\(\)[\s\S]*?\.clip\(true\)/,
  'only the shared QuickMorph subtree may inherit MorphStage inside QuickDock');
assert.doesNotMatch(appearanceStage,
  /private quickMorphLayer\(\)[\s\S]*?\.opacity\(this\.renderFrame\.quickMorph\.opacity\)/,
  'the persistent Stage must not revive a QuickMorph root dissolve');
assert.doesNotMatch(appearanceQuick,
  /\.opacity\(frame\.quickMorph\.opacity\)/,
  'QuickMorph root dissolve must not be duplicated inside the module panel');
assert.match(appearanceStage,
  /private quickDockLayer\(\)[\s\S]*?this\.quickMorphStageLayer\(\);[\s\S]*?this\.brightnessLayer\(\);[\s\S]*?this\.moduleNavLayer\(\);[\s\S]*?\.height\(READER_APPEARANCE_MOTION_STAGE_HEIGHT\)/,
  'O QuickIncoming must own one fixed 736vp QuickDock wrapper');
assert.match(appearanceStage,
  /private brightnessLayer\(\)[\s\S]*?y: READER_APPEARANCE_BRIGHTNESS_FIXED_Y/,
  'N BrightnessRail must remain at its fixed screen y rather than inherit MorphStage travel');
assert.match(appearanceStage,
  /private moduleNavLayer\(\)[\s\S]*?\.height\(READER_APPEARANCE_MOTION_STAGE_HEIGHT\)/,
  'N ModuleNav must remain bottom-aligned in the fixed 736vp stage');
assert.match(appearanceStage,
  /@Prop @Watch\('onMotionTimeScaleChanged'\) motionTimeScale: number = 1/,
  'whole-timeline time scaling must be live rather than mount-only');
assert.match(appearanceMotionState, /export function readerAppearanceMotionIsActive/,
  'the pure state driver must expose its active lifecycle to the Stage');
assert.match(appearanceMotionState, /export function setReaderAppearanceMotionTimeScale/,
  'retiming must preserve the current sampled frame while scaling the remaining clock');
for (const actorAccess of [
  'this.frame.quickMorph',
  'this.frame.themeItems[index]',
  'this.frame.fontItems[safeIndex]',
]) {
  assert.ok(appearanceSharedActors.includes(actorAccess),
    `QuickMorph shared tree omitted sampled actor access ${actorAccess}`);
}
assert.match(appearanceQuick,
  /if \(!this\.isTablet && this\.motionFrame !== undefined\) \{\s*this\.motionPanel\(\);/,
  'the QuickMorph Builder must read the live @Prop directly instead of freezing a frame argument');
assert.doesNotMatch(appearanceQuick,
  /private motion(?:Panel|ThemeHeader|Divider|FontHeader)\([^)]*(?:frame|actor|reflow)/,
  'reactive QuickMorph values must not cross an ArkUI @Builder ordinary-parameter boundary');
assert.match(control,
  /\.scale\(\{ y: this\.shellBoardScaleY\(\), centerY: this\.shellBoardHeight\(\) \}\)/,
  'the shell board must bottom-anchor its scaleY morph (330<->736 with no translate drift)');
assert.match(control,
  /if \(!this\.isFullControlPage\(this\.activePage\)\) \{[\s\S]*?this\.controlSheet\(\);[\s\S]*?this\.moduleNav\(\);/,
  'quick dock content lives outside the scaled shell board so it is never squashed');
assert.equal((control.match(/showHideTransition\('reader\.control\.show', 'reader\.control\.hide',/g) ?? []).length, 2,
  'TopBar and Dock must keep the MR1 show/hide pair (now with the authored opacity component)');
assert.equal((control.match(/\.transition\(this\.reduceMotion \|\| this\.shellExitArmed \? TransitionEffect\.IDENTITY :\s*showHideTransition\('reader\.control\.show', 'reader\.control\.hide',/g) ?? []).length, 2,
  'session morph handoff must suppress both root control-layer exits to prevent double exposure');
assert.match(control, /fadeSlideTransition\('reader\.quick\.promote', 12\)/,
  'quick.promote keeps its own 320ms token and carries the MR1/C opacity+12px pair');

const grabberSnap = control.slice(
  control.indexOf('private resetControlGrabberDrag(): void {'),
  control.indexOf('private resetControlGrabberDrag(): void {') + 900,
);
assert.ok(grabberSnap.includes('motionAnimateParam(\'reader.control.handle.snap\')'),
  'the grabber rollback must animate with the dedicated handle.snap token');
assert.ok(!grabberSnap.includes('reader.panel.collapse'),
  'the grabber settle must not borrow the panel collapse timing');
assert.match(control,
  /@Prop shellExitArmed: boolean = false;[\s\S]*private fullSearchDock\(\)[\s\S]*?\.transition\(this\.reduceMotion \|\| this\.shellExitArmed \? TransitionEffect\.IDENTITY/,
  'a full-panel child must not run a second exit transition under the control shell');
assert.match(control,
  /private homeContent\(\)[\s\S]*?Shell dismissal owns the only exit transition[\s\S]*?\.transition\(this\.reduceMotion \|\| this\.shellExitArmed \? TransitionEffect\.IDENTITY/,
  'control content and its bordered shell must leave as one actor');
assert.match(control, /ReaderDirectoryModulePanel\(\{/);
assert.match(control, /ReaderQuickSearchPanel\(\{/);
assert.match(control, /ReaderSearchFullPanel\(\{/);
assert.match(control, /ReaderAutoPagePanel\(\{/);
assert.match(control, /ReaderAppearanceModulePanel\(\{/);
assert.match(control, /ReaderAppearanceFullPanel\(\{/);
assert.match(control, /ReaderSettingsModulePanel\(\{/);
assert.match(control, /ReaderSettingsFullPanel\(\{/);
assert.match(control, /this\.onExpandDirectory\(\)/);
assert.match(control, /readerControlExpansionTarget\(this\.activePage\)/,
  'every grabber must resolve through the single audited routing table');
assert.match(control, /requestExpandSearch\(\)[\s\S]*this\.onPageChange\('fullSearch'\)/,
  'Quick Search and Full Search must be one explicit control-domain route');
assert.match(control, /READER_CONTROL_GRABBER_HIT_WIDTH = 72/,
  'the visual grabber must expose a practical direct hit target');
assert.match(control, /\.hitTestBehavior\(HitTestMode\.Block\)\s*\.accessibilityText\(this\.controlGrabberAccessibilityText\(\)\)/,
  'the expanded grabber target must own hits even when the visible child row is tapped');
assert.match(control, /PanGesture\(\{ direction: PanDirection\.Up, distance: READER_CONTROL_GRABBER_PAN_DISTANCE \}\)[\s\S]{0,220}updateControlGrabberDrag\(event\.offsetY\)[\s\S]{0,220}finishControlGrabberDrag\(event\.offsetY\)/,
  'the dock must follow the live upward drag before release chooses expand or rollback');
const expansionRoutes = new Map([
  ['home', 'directory'],
  ['moduleDirectory', 'directory'],
  ['quickSearch', 'fullSearch'],
  ['quickAutoPage', 'fullAutoPage'],
  ['quickReplace', 'rulesManagement'],
  ['moduleTts', 'fullTts'],
  ['moduleAppearance', 'fullAppearance'],
  ['moduleSettings', 'fullSettings'],
]);
for (const [page, target] of expansionRoutes) {
  assert.equal(readerControlExpansionTarget(page), target, `${page} expansion target drifted`);
}
for (const page of ['fullSearch', 'fullAutoPage', 'fullTts', 'fullAppearance', 'fullSettings']) {
  assert.equal(readerControlExpansionTarget(page), undefined, `${page} must not recursively expand`);
}
assert.match(control, /Slider\(\{\s*value: this\.effectiveProgressPercent\(\)/);
assert.match(control, /onPreviousChapter\(\)/);
assert.match(control, /onNextChapter\(\)/);
assert.match(control, /action === 'autoPage'/);
assert.match(control, /this\.promoteAutoPage\(\)/);
assert.match(control, /this\.onOpenReplace\(\)/);
assert.doesNotMatch(control, /action === 'replace'[\s\S]{0,180}this\.onSourceSwitch\(\)/);
assert.doesNotMatch(control, /currently exist only as Review frames/);
for (const page of ['moduleDirectory', 'moduleTts', 'moduleAppearance', 'moduleSettings',
  'fullSearch', 'fullAppearance', 'fullSettings']) {
  assert.ok(control.includes(page), `Reader control state machine is missing ${page}`);
}
assert.match(control, /module !== 'directory'[\s\S]*module !== 'settings'/);
assert.match(control, /const destination: ReaderControlPage = this\.isActiveModule\(module\) \? 'home' : page/,
  'tapping the active main tab must return to the control home page');
assert.match(control, /if \(this\.reduceMotion\) \{\s*this\.onPageChange\(destination\)/);
assert.match(control, /if \(this\.reduceMotion\) \{\s*this\.onPageChange\('quickSearch'\)/);
assert.match(control, /this\.reduceMotion \|\| this\.shellExitArmed \? TransitionEffect\.IDENTITY/);
assert.match(control, /\.height\('100%'\)\s+\.zIndex\(0\)\s+\.onClick\(\(\): void => this\.onDismiss\(\)\)/);
assert.equal((control.match(/\.height\('100%'\)\s+\.zIndex\(1\)\s+\.hitTestBehavior\(HitTestMode\.None\)/g) ?? []).length, 2);
assert.match(control, /\.accessibilityText\('阅读进度'\)/);
assert.match(control, /\.accessibilityText\('阅读亮度'\)/);
assert.doesNotMatch(control, /真面板\(目录\/朗读\/界面\/设置\)后续挂入本层/);

for (const [file, importsLineStrong] of [
  ['ReaderSearchFullPanel.ets', true],
  ['ReaderAppearanceFullPanel.ets', false],
  ['ReaderSettingsFullPanel.ets', false],
  ['ReaderTtsFullPanel.ets', false],
]) {
  const panel = read(`entry/src/main/ets/features/reading/${file}`);
  assert.doesNotMatch(panel, /TOK_READ_SURFACE/,
    `${file} must not draw its own surface — the morph-shell board is the single background source`);
  if (!importsLineStrong) {
    assert.doesNotMatch(panel, /TOK_LINE_STRONG/,
      `${file} no longer needs the shell-border token after de-boarding`);
  }
  assert.match(panel, /\.clip\(true\)/,
    `${file} must keep content clipping so the shell board radius bounds its content`);
}

const appearance = read('entry/src/main/ets/features/reading/ReaderAppearanceFullPanel.ets');
for (const [id, delay] of [
  ['surface.in', 128],
  ['content.in', 146],
  ['header.in', 146],
  ['theme.in', 146],
  ['font.in', 175],
  ['typography.in', 256],
]) {
  assert.match(appearance,
    new RegExp(`panelActorTransition\\('reader\\.panel\\.appearance\\.${id}', (?:0|-12), ${delay}\\)`),
    `N-frame element entrance ${id} must run through the registry factory at delay ${delay}`);
}
assert.match(motion,
  /reader\.panel\.appearance\.typography\.in', durationMs: 164, curve: Curve\.EaseOut/,
  'the N-frame stagger table is mirrored in the motion registry, not hardcoded at call sites');

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
const hideControl = experience.match(/private hideControl\(\): void \{([\s\S]*?)\n  private reloadCurrentChapterAfterContentProjectionChange/);
assert.ok(hideControl, 'control hide lifecycle owner must exist');
assert.match(hideControl[1], /this\.controlVisible = false/);
assert.doesNotMatch(hideControl[1], /this\.controlPage = 'home'/,
  'active control content must remain mounted for the complete shell exit transition');
assert.match(hideControl[1],
  /this\.controlShellExitArmed = true;[\s\S]*postFrameCallback[\s\S]*this\.controlVisible = false/,
  'the host must present nested-transition suppression before removing the unified shell');
assert.match(experience,
  /private openReaderControl\(\): void \{[\s\S]*?this\.controlPage = 'home';[\s\S]*?this\.controlVisible = true/,
  'the next presentation, not the previous exit, owns the Home reset');
assert.match(experience, /if \(this\.controlVisible\) \{/);
assert.match(experience, /if \(this\.controlPage !== 'home'\) \{/);
assert.match(experience, /this\.activeGateway\(\)\.searchContent\(this\.bookId, keyword, 50, isCurrent\)/);
assert.match(experience,
  /this\.controlPage === 'quickSearch' \|\| this\.controlPage === 'fullSearch'/,
  'a running search must remain live while Quick Search expands into Full Search');
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
assert.match(experience, /this\.enqueueReaderBrightness\(normalized, 'manual'\)/);
assert.match(experience, /this\.enqueueReaderBrightness\(-1, 'automatic'\)/);
assert.match(experience, /private brightnessMutationQueue: Promise<void> = Promise\.resolve\(\)/,
  'brightness side effects must be serialized so the last user intent wins');
assert.match(experience, /return readerWindow\.setWindowBrightness\(target\)/);
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
assert.match(pageInteraction, /event\.timestamp \/ 1_000_000/,
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
  /const bookmarkBlocked = this\.gestureState\.owner === 'bookmark' && !this\.canStartBookmark\(\);[\s\S]*pageOwnerBlocked \|\| bookmarkBlocked/,
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
assert.match(directoryList, /List\(\{ space: 0, scroller: this\.scroller \}\)[\s\S]*Repeat\(this\.entries\)[\s\S]*\.virtualScroll\(\{ totalCount: this\.entries\.length, reusable: false \}\)/);
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
