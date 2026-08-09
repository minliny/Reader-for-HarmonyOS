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

const initial = createDefaultReaderAutoPageFullConfiguration();
assert.deepEqual(initial, {
  timerMinutes: 15,
  timerSeconds: 0,
  speedSeconds: 8,
  followHighlight: true,
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
assert.equal(formatReaderAutoPageFullWheelValue(0), '00');
assert.equal(formatReaderAutoPageFullWheelValue(8), '08');
assert.equal(formatReaderAutoPageFullWheelValue(180), '180');
assert.equal(readerAutoPageFullTimerDurationSeconds(initial), 15 * 60);
assert.equal(formatReaderAutoPageFullTimerSummary(initial), '15:00');

const root = new URL('../entry/src/main/', import.meta.url);
const panel = await readFile(new URL('ets/features/reading/ReaderAutoPageFullPanel.ets', root), 'utf8');

assert.match(panel, /Phone final page `1771:10277`/);
assert.match(panel, /Full panel instance `1771:10280`/);
assert.match(panel, /Content master `1764:10223`/);
assert.match(panel, /Motion sources `1938:6245` and `1979:21744`/);
assert.match(panel, /if \(!this\.isTablet\) \{[\s\S]*this\.phonePanel\(\)/,
  'Tablet must not render a scaled Phone Full panel');
assert.match(panel, /\.width\(364\)[\s\S]*\.height\(736\)/);
assert.match(panel, /\.width\(336\)[\s\S]*\.height\(665\)/);
assert.match(panel, /\.position\(\{ x: 14, y: 58 \}\)/);
assert.match(panel, /Text\('自动翻页控制'\)/);
assert.match(panel, /Text\('定时'\)/);
assert.match(panel, /Text\('自动停止'\)/);
assert.match(panel, /Text\('详细配置'\)/);
assert.match(panel, /Text\('跟随高亮'\)/);
assert.match(panel, /\.fontFamily\('ReaderInter'\)/);
assert.match(panel, /collapsedBackActor\(\)[\s\S]*ReaderNotoSansSC/,
  'the outgoing Quick Back actor retains the Quick endpoint font');
assert.match(panel, /min: READER_AUTO_PAGE_FULL_MIN_SPEED_SECONDS/);
assert.match(panel, /max: READER_AUTO_PAGE_FULL_MAX_SPEED_SECONDS/);
assert.match(panel, /\.opacity\(0\.001\)/,
  'the empty Figma speed frame must not gain an invented visible slider');
assert.doesNotMatch(panel, /animateTo|animation\(/,
  'the panel must expose actor endpoints while the owner keeps production timing');
assert.match(panel, /persistentActorTranslateX\(-31\.492\)/);
assert.match(panel, /persistentActorTranslateX\(-33\.106\)/);
assert.match(panel, /persistentActorTranslateX\(-5\.45\)/);
assert.match(panel, /persistentActorTranslateY\(-208\.623\)/);
assert.match(panel, /addedActorTranslateY\(22\)/);
assert.match(panel, /outgoingActorTranslateY\(14\)/);

const control = await readFile(new URL('ets/features/reading/ReaderControlPanel.ets', root), 'utf8');
assert.match(control, /'fullAutoPage'/);
assert.match(control, /AUTO_PAGE_ACTOR_HOLD_RATIO = 0\.14815/);
assert.match(control, /AUTO_PAGE_COLLAPSED_SURFACE_WIDTH = 364\.896/);
assert.match(control, /AUTO_PAGE_COLLAPSED_SURFACE_X = -0\.448/);
assert.match(control, /AUTO_PAGE_COLLAPSED_SURFACE_Y = 406\.443/);
assert.match(control, /this\.autoPageStatus !== 'stopped'/,
  'only the Figma-defined stopped visual may expand');
assert.match(control, /this\.isTablet \|\| this\.activePage !== 'quickAutoPage'/,
  'Tablet Full remains fail-closed');
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
