import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  deriveReaderSessionCapsule,
  readerTtsSessionBlocksAutoPageStart,
} from '../entry/src/main/ets/features/reading/ReaderSessionCapsuleModel.ts';

const readingDir = new URL('../entry/src/main/ets/features/reading/', import.meta.url);
const capsule = await readFile(new URL('ReaderSessionCapsule.ets', readingDir), 'utf8');
const experience = await readFile(new URL('LocalReadingExperience.ets', readingDir), 'utf8');

const baseInput = {
  mounted: true,
  exitRequested: false,
  pageReady: true,
  controlObscured: false,
  interactionBlocked: false,
  controlVisible: false,
  autoPageStatus: 'stopped',
  autoPageRemainingSeconds: 8,
  ttsStatus: 'idle',
};

assert.equal(deriveReaderSessionCapsule(baseInput), undefined, 'terminal runtimes own no blank capsule');
assert.deepEqual(deriveReaderSessionCapsule({ ...baseInput, autoPageStatus: 'running' }), {
  type: 'autoPage', sessionState: 'playing', countdown: 8,
});
assert.deepEqual(deriveReaderSessionCapsule({
  ...baseInput, autoPageStatus: 'paused', autoPageRemainingSeconds: 5.9,
}), { type: 'autoPage', sessionState: 'paused', countdown: 5 });
assert.deepEqual(deriveReaderSessionCapsule({ ...baseInput, ttsStatus: 'preparing' }), {
  type: 'tts', sessionState: 'playing', countdown: 0,
});
assert.deepEqual(deriveReaderSessionCapsule({ ...baseInput, ttsStatus: 'interrupted' }), {
  type: 'tts', sessionState: 'paused', countdown: 0,
});
assert.equal(deriveReaderSessionCapsule({ ...baseInput, ttsStatus: 'stopping' }), undefined,
  'Figma has no stopping/loading capsule variant');
assert.equal(deriveReaderSessionCapsule({ ...baseInput, controlVisible: true, ttsStatus: 'playing' }), undefined);
assert.equal(readerTtsSessionBlocksAutoPageStart('playing'), true);
assert.equal(readerTtsSessionBlocksAutoPageStart('stopping'), true);
assert.equal(readerTtsSessionBlocksAutoPageStart('idle'), false);

assert.match(capsule, /Figma `Reader\/SessionCapsule` \(`1164:10275`\)/);
assert.match(capsule, /AUTO_PAGE_CAPSULE_MIN_WIDTH = 96/);
assert.match(capsule, /TTS_CAPSULE_MIN_WIDTH = 94/);
assert.match(capsule, /READER_SESSION_CAPSULE_HEIGHT = 24/);
assert.match(capsule, /Text\(this\.type === 'autoPage' \? '自动翻页' : '朗读'\)/);
assert.match(capsule, /reader_session_pause[\s\S]*?reader_tts_play/);
assert.match(capsule, /\.onClick\(\(\): void => \{[\s\S]*if \(this\.interactionEnabled\) this\.onToggle\(\);/);
assert.match(capsule, /\.responseRegion\(\{ x: 0, y: -10, width: '100%', height: 44 \}\)/,
  'the 24vp visual capsule must expose a practical 44vp touch target');
assert.match(capsule,
  /\.hitTestBehavior\(this\.interactionEnabled \? HitTestMode\.Block : HitTestMode\.None\)/,
  'the capsule owns idle hits but cannot steal an already active page-turn stream');
assert.match(capsule, /\.constraintSize\(\{ minWidth: this\.capsuleMinimumWidth\(\) \}\)/,
  'Figma variant width is a minimum; localized content must be allowed to measure wider');
assert.match(capsule, /\.onAreaChange\([\s\S]*?this\.onMeasured\(/,
  'the live component must report its actual footprint to the page footer layout');
assert.doesNotMatch(capsule, /animateTo|\.transition\(/,
  'the static capsule must not invent the unapproved panel-to-capsule flight timeline');

assert.match(experience,
  /if \(this\.shouldShowSessionCapsule\(\)\) \{[\s\S]*?ReaderSessionCapsule\(\{[\s\S]*?onToggle: \(\): void => this\.toggleSessionCapsule\(\)/,
  'the reader must mount one state-owned capsule with a real pause/resume callback');
assert.match(experience,
  /\.transition\(this\.reduceMotion \? TransitionEffect\.IDENTITY :[\s\S]*?reader\.session\.capsule\.enter[\s\S]*?reader\.session\.capsule\.exit/,
  'the capsule must fade via the Reader-UI token pair (enter 160ms / exit 200ms); countdown updates mutate the mounted node and never replay this');
assert.match(experience,
  /return deriveReaderSessionCapsule\(\{/,
  'one pure projection must own visibility, type, state and countdown');
assert.match(experience, /interactionEnabled: !this\.pageTurnInputOwned/,
  'the live capsule must disable activation from the one-bit input owner without rebuilding on every MOVE');
assert.match(experience,
  /const ownsInput = state\.phase !== 'idle';[\s\S]*if \(this\.pageTurnInputOwned !== ownsInput\) this\.pageTurnInputOwned = ownsInput;/,
  'page input ownership must change only at the gesture boundary, never invalidate ArkUI on every MOVE');
assert.match(experience,
  /state\.phase === 'tracking'[\s\S]*liveSessionCapsuleSnapshot\(\)[\s\S]*pageTurnSessionCapsuleFrozen = true/,
  'the capsule must retain its DOWN-frame visual state through settlement');
assert.match(experience,
  /resolveReaderPageChromeLayout\(this\.readingLayout\(\), new ReaderPageChromeMeasurements\(/,
  'the live capsule and page-owned ordinal must use the same responsive footer resolver');
assert.match(experience,
  /this\.stopAutoPage\(\);[\s\S]*?coordinator\.start\(\{/,
  'starting TTS must stop auto-page first');
assert.match(experience,
  /readerTtsSessionBlocksAutoPageStart\(this\.ttsState\.status\)[\s\S]*?coordinator\.stop\('user'\)/,
  'starting auto-page must stop TTS first');
const toggleAutoPage = experience.slice(
  experience.indexOf('  private toggleAutoPage(): void {'),
  experience.indexOf('  private startAutoPageSession(): void {'),
);
assert.ok(toggleAutoPage.indexOf("coordinator.stop('user')") >= 0);
assert.ok(toggleAutoPage.indexOf('.then((): void => {') > toggleAutoPage.indexOf("coordinator.stop('user')"));
assert.ok(toggleAutoPage.indexOf('this.startAutoPageSession()') > toggleAutoPage.indexOf('.then((): void => {'),
  'auto-page may start only after the TTS stop promise resolves');
assert.match(toggleAutoPage, /\.catch\([\s\S]*?this\.logTtsFailure\('stop before auto-page', error\)/,
  'a failed TTS stop must fail closed instead of overlapping both runtimes');
assert.match(experience,
  /coordinator\.start\(\{[\s\S]*?\.then\(\(\): void => \{[\s\S]*?this\.hideControl\(\)/,
  'a successful TTS start must return to immersive reading where the capsule is visible');

console.log('reader session capsule: PASS');
