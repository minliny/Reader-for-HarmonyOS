import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  createDefaultReaderAutoPageFullConfiguration,
  formatReaderAutoPageFullTimerSummary,
  formatReaderAutoPageFullWheelValue,
  normalizeReaderAutoPageFullConfiguration,
  readerAutoPageFullTimerDurationSeconds,
  setReaderAutoPageFullFollowHighlight,
  setReaderAutoPageFullSpeed,
  stepReaderAutoPageFullTimer,
} from '../entry/src/main/ets/features/reading/ReaderAutoPageFullState.ts';
import {
  READER_AUTO_PAGE_ACTOR_HOLD_RATIO,
  READER_AUTO_PAGE_COLLAPSED_BACK_TRANSLATE_Y,
  READER_AUTO_PAGE_COLLAPSED_SURFACE_WIDTH,
  READER_AUTO_PAGE_COLLAPSED_SURFACE_X,
  READER_AUTO_PAGE_COLLAPSED_SURFACE_Y,
  READER_AUTO_PAGE_DETAILS_SECTION_Y,
  READER_AUTO_PAGE_FULL_BODY_HEIGHT,
  READER_AUTO_PAGE_FULL_BODY_WIDTH,
  READER_AUTO_PAGE_FULL_CONTENT_HEIGHT,
  READER_AUTO_PAGE_FULL_HEIGHT,
  READER_AUTO_PAGE_FULL_WIDTH,
  READER_AUTO_PAGE_PERSISTENT_PLAY_LABEL_TRANSLATE_X,
  READER_AUTO_PAGE_PERSISTENT_SPEED_TRANSLATE_X,
  READER_AUTO_PAGE_PERSISTENT_SPEED_TRANSLATE_Y,
  READER_AUTO_PAGE_PERSISTENT_STOP_TRANSLATE_X,
} from '../entry/src/main/ets/features/reading/ReaderAutoPageMotionGeometry.ts';

const initial = createDefaultReaderAutoPageFullConfiguration();
assert.deepEqual(initial, {
  timerMinutes: 15,
  timerSeconds: 0,
  speedSeconds: 8,
  followHighlight: false,
});

assert.deepEqual(normalizeReaderAutoPageFullConfiguration({
  timerMinutes: 999,
  timerSeconds: -4,
  speedSeconds: Number.NaN,
  followHighlight: false,
}), {
  timerMinutes: 180,
  timerSeconds: 0,
  speedSeconds: 2,
  followHighlight: false,
});

let next = stepReaderAutoPageFullTimer(initial, 'minutes', 1);
assert.equal(next.timerMinutes, 16);
next = stepReaderAutoPageFullTimer(next, 'seconds', 1);
assert.equal(next.timerSeconds, 1);
assert.equal(initial.timerMinutes, 15, 'pure transitions must not mutate their input');
assert.equal(stepReaderAutoPageFullTimer({ ...initial, timerMinutes: 0 }, 'minutes', -1).timerMinutes, 0);
assert.equal(stepReaderAutoPageFullTimer({ ...initial, timerMinutes: 180 }, 'minutes', 1).timerMinutes, 180);
assert.equal(stepReaderAutoPageFullTimer({ ...initial, timerSeconds: 59 }, 'seconds', 1).timerSeconds, 59);
assert.equal(setReaderAutoPageFullSpeed(initial, 100).speedSeconds, 20);
assert.equal(setReaderAutoPageFullSpeed(initial, 1).speedSeconds, 2);
assert.equal(setReaderAutoPageFullFollowHighlight(initial, false).followHighlight, false);
assert.equal(setReaderAutoPageFullFollowHighlight(initial, true).followHighlight, false,
  'unimplemented follow highlight must fail closed even for legacy callers');
assert.equal(formatReaderAutoPageFullWheelValue(0), '00');
assert.equal(formatReaderAutoPageFullWheelValue(8), '08');
assert.equal(formatReaderAutoPageFullWheelValue(180), '180');
assert.equal(readerAutoPageFullTimerDurationSeconds(initial), 15 * 60);
assert.equal(formatReaderAutoPageFullTimerSummary(initial), '15:00');
assert.equal(READER_AUTO_PAGE_FULL_WIDTH, 364);
assert.equal(READER_AUTO_PAGE_FULL_HEIGHT, 736);
assert.equal(READER_AUTO_PAGE_FULL_BODY_WIDTH, 336);
assert.equal(READER_AUTO_PAGE_FULL_BODY_HEIGHT, 665);
assert.equal(READER_AUTO_PAGE_FULL_CONTENT_HEIGHT, 435.17);
assert.equal(READER_AUTO_PAGE_DETAILS_SECTION_Y, 285.78);
assert.equal(READER_AUTO_PAGE_ACTOR_HOLD_RATIO, 0.14815);
assert.equal(READER_AUTO_PAGE_COLLAPSED_SURFACE_WIDTH, 364.896);
assert.equal(READER_AUTO_PAGE_COLLAPSED_SURFACE_X, -0.448);
assert.equal(READER_AUTO_PAGE_COLLAPSED_SURFACE_Y, 406.443);

const root = new URL('../entry/src/main/', import.meta.url);
const panel = await readFile(new URL('ets/features/reading/ReaderAutoPageFullPanel.ets', root), 'utf8');

assert.match(panel, /Phone final page `1771:10277`/);
assert.match(panel, /Full panel instance `1771:10280`/);
assert.match(panel, /Content master `1764:10223`/);
assert.match(panel, /Motion sources `1938:6245` and `1979:21744`/);
assert.match(panel, /if \(!this\.isTablet\) \{[\s\S]*this\.phonePanel\(\)/,
  'Tablet must not render a scaled Phone Full panel');
assert.match(panel, /@Prop availableWidth: number = 0/);
assert.match(panel, /@Prop availableHeight: number = 0/);
assert.match(panel, /\.width\(this\.panelWidth\(\)\)[\s\S]*\.height\(this\.panelHeight\(\)\)/);
assert.match(panel, /Scroll\(\) \{[\s\S]*\.width\(this\.bodyWidth\(\)\)[\s\S]*\.height\(READER_AUTO_PAGE_FULL_BODY_HEIGHT\)/);
assert.match(panel, /\.height\(this\.bodyViewportHeight\(\)\)[\s\S]*READER_AUTO_PAGE_FULL_BODY_Y/,
  'the fixed header must own a bounded scroll viewport on short phones');
assert.match(panel,
  /private bodyViewportHeight\(\): number \{[\s\S]*this\.panelHeight\(\) - READER_AUTO_PAGE_FULL_BODY_Y - 13/);
assert.match(panel, /READER_AUTO_PAGE_FULL_CONTENT_Y - READER_AUTO_PAGE_FULL_BODY_Y/,
  'the full-height endpoint must preserve the original global actor coordinates');
assert.match(panel, /private panelWidth\(\): number \{[\s\S]*Math\.min\(READER_AUTO_PAGE_FULL_WIDTH, this\.availableWidth\)/,
  'the phone-only motion surface must clamp its outer actor to the physical viewport');
assert.match(panel, /Text\('自动翻页控制'\)/);
assert.match(panel, /Text\('定时'\)/);
assert.match(panel, /Text\('自动停止'\)/);
assert.match(panel, /Text\('详细配置'\)/);
assert.match(panel, /Text\('跟随高亮'\)/);
assert.match(panel, /跟随高亮，当前能力未接入，已关闭/);
assert.match(panel, /\.enabled\(false\)[\s\S]*addedActorOpacity\(\) \* 0\.55/,
  'follow highlight must remain visible but disabled until a consumer exists');
assert.match(panel, /\.fontFamily\('ReaderInter'\)/);
assert.match(panel, /collapsedBackActor\(\)[\s\S]*ReaderNotoSansSC/,
  'the outgoing Quick Back actor retains the Quick endpoint font');
assert.match(panel, /min: READER_AUTO_PAGE_FULL_MIN_SPEED_SECONDS/);
assert.match(panel, /max: READER_AUTO_PAGE_FULL_MAX_SPEED_SECONDS/);
assert.match(panel, /\.opacity\(0\.001\)/,
  'the empty Figma speed frame must not gain an invented visible slider');
assert.doesNotMatch(panel, /animateTo|animation\(/,
  'the panel must expose actor endpoints while the owner keeps production timing');
assert.equal(READER_AUTO_PAGE_PERSISTENT_PLAY_LABEL_TRANSLATE_X, -31.492);
assert.equal(READER_AUTO_PAGE_PERSISTENT_STOP_TRANSLATE_X, -33.106);
assert.equal(READER_AUTO_PAGE_PERSISTENT_SPEED_TRANSLATE_X, -5.45);
assert.equal(READER_AUTO_PAGE_PERSISTENT_SPEED_TRANSLATE_Y, -208.623);
assert.equal(READER_AUTO_PAGE_COLLAPSED_BACK_TRANSLATE_Y, 14);
assert.match(panel, /persistentActorTranslateX\(READER_AUTO_PAGE_PERSISTENT_PLAY_LABEL_TRANSLATE_X\)/);
assert.match(panel, /persistentActorTranslateX\(READER_AUTO_PAGE_PERSISTENT_STOP_TRANSLATE_X\)/);
assert.match(panel, /persistentActorTranslateX\(READER_AUTO_PAGE_PERSISTENT_SPEED_TRANSLATE_X\)/);
assert.match(panel, /persistentActorTranslateY\(READER_AUTO_PAGE_PERSISTENT_SPEED_TRANSLATE_Y\)/);

const control = await readFile(new URL('ets/features/reading/ReaderControlPanel.ets', root), 'utf8');
assert.match(control, /'fullAutoPage'/);
assert.match(control, /READER_AUTO_PAGE_ACTOR_HOLD_RATIO/);
assert.match(control, /READER_AUTO_PAGE_COLLAPSED_SURFACE_WIDTH/);
assert.match(control, /READER_AUTO_PAGE_COLLAPSED_SURFACE_X/);
assert.match(control, /READER_AUTO_PAGE_COLLAPSED_SURFACE_Y/);
assert.match(control, /this\.autoPageStatus !== 'stopped'/,
  'only the Figma-defined stopped visual may expand');
assert.match(control, /this\.isExpanded\(\) \|\| this\.activePage !== 'quickAutoPage'/,
  'Tablet Full remains fail-closed');
assert.match(control, /availableHeight: this\.autoPageSurfaceHeight\(\)/,
  'the auto-page full actor must receive the same live height budget as its owner surface');
assert.match(control, /motionSpecGet\('reader\.panel\.expand'\)|autoPageActorHoldMs\('reader\.panel\.expand'\)/);
assert.match(control, /autoPageActorAnimateParam\('reader\.panel\.collapse'/);
assert.match(control, /ReaderAutoPageFullPanel\(\{/);
assert.match(control, /opacity\(this\.autoPageOutgoingOpacity\(\)\)[\s\S]*translate\(\{ y: this\.autoPageActorExpanded \? 20 : 0 \}\)/);

const experience = await readFile(new URL('ets/features/reading/LocalReadingExperience.ets', root), 'utf8');
assert.match(experience, /autoPageFullConfiguration: ReaderAutoPageFullConfiguration/);
assert.match(experience, /private armAutoPageSessionTimer\(resetDeadline: boolean\): void/);
assert.match(experience, /private onAutoPageSessionTimer\(generation: number\): void/);
assert.match(experience, /this\.autoPageSessionRemainingSeconds <= 0[\s\S]*stopReaderAutoPage/);
assert.match(experience, /onAutoPageFollowHighlightChange:/);
const pauseOwner = experience.match(
  /private pauseAutoPage\(reason: ReaderAutoPagePauseReason\): void \{([\s\S]*?)\n  \}\n\n  private captureAutoPageRemaining/,
);
assert.ok(pauseOwner, 'the reading owner pause path must exist');
assert.match(pauseOwner[1], /captureAutoPageSessionRemaining\(\)/);
assert.match(pauseOwner[1], /configuredSessionSeconds > 0 && this\.autoPageSessionRemainingSeconds <= 0/);
assert.match(pauseOwner[1], /stopReaderAutoPage\(this\.autoPageState, 'manual'\)[\s\S]*return/,
  'an expiry racing background/touch pause must stop instead of becoming resumable');
assert.match(experience, /pauseAutoPageForInteraction\(\): void \{\s*this\.pauseAutoPage\('touch'\)/,
  'reading touch must use the guarded owner pause path');
assert.match(experience, /onAppForegroundChanged\(\): void \{[\s\S]*this\.pauseAutoPage\('background'\)/,
  'backgrounding must use the guarded owner pause path');
const sessionArm = experience.match(
  /private armAutoPageSessionTimer\(resetDeadline: boolean\): void \{([\s\S]*?)\n  \}\n\n  private onAutoPageSessionTimer/,
);
assert.ok(sessionArm, 'the session timer owner path must exist');
assert.match(sessionArm[1], /if \(resetDeadline\) \{\s*this\.autoPageSessionRemainingSeconds = configuredSeconds/,
  'only a new session may reset the configured duration');
assert.match(sessionArm[1], /else if \(this\.autoPageSessionRemainingSeconds <= 0\)[\s\S]*stopReaderAutoPage[\s\S]*return/,
  'resuming with zero remaining time must stop and must not revive the timer');
assert.doesNotMatch(sessionArm[1], /resetDeadline \|\| this\.autoPageSessionRemainingSeconds <= 0/,
  'an expired resumed session must never share the new-session reset branch');

for (const asset of [
  'reader_auto_full_header.svg',
  'reader_auto_full_clock.svg',
  'reader_auto_full_chevron_left.svg',
  'reader_auto_full_chevron_right.svg',
  'reader_auto_full_play.svg',
  'reader_auto_full_stop.svg',
]) {
  const source = await readFile(new URL(`resources/base/media/${asset}`, root), 'utf8');
  assert.match(source, /<svg/);
  assert.doesNotMatch(source, /TODO|placeholder/i);
}

console.log('reader Full Auto Page pure/static contract: PASS');
