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
assert.match(capsule, /reader_session_pause[\s\S]*?reader_session_play/);
assert.doesNotMatch(capsule, /reader_session_pause[\s\S]*?reader_tts_play/,
  'capsule playback actors must use the dedicated solid Figma glyph pair');
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
  'the capsule stays a pure actor; the approved Review C/D/E/F flight choreography lives in the host');
assert.match(capsule, /@Prop morphShellWidth: number = 0;/,
  'the morph window is host-driven; 0 means the static production shell');
assert.match(capsule, /@Prop morphContentOffsetX: number = 0;/,
  'the morph content slide-in offset is fed by the host reveal beat');
assert.match(capsule,
  /if \(this\.morphShellWidth > 0\) \{\s*this\.morphShell\(\);\s*\} else \{\s*this\.staticShell\(\);\s*\}/,
  'the morph shell must be a separate builder so the production path never changes shape');
assert.match(capsule, /private morphShell\(\)[\s\S]*?\.clip\(true\)/,
  'the morph shell must clip the sliding content inside the pill');
assert.match(capsule, /READER_SESSION_CAPSULE_SHADOW: ShadowOptions = \{[\s\S]*?radius: 8,[\s\S]*?offsetY: 3/,
  'the shared shadow constant keeps the flight-proxy handoff pixel-continuous');

assert.match(experience,
  /if \(this\.shouldShowSessionCapsule\(\)\) \{[\s\S]*?ReaderSessionCapsule\(\{[\s\S]*?onToggle: \(\): void => this\.toggleSessionCapsule\(\)/,
  'the reader must mount one state-owned capsule with a real pause/resume callback');
assert.match(experience,
  /\.transition\(this\.sessionMorphPhase !== 'none' \|\| this\.reduceMotion \?\s*TransitionEffect\.IDENTITY :\s*TransitionEffect\.asymmetric\(\s*TransitionEffect\.OPACITY\.animation\(motionAnimateParam\('reader\.session\.capsule\.enter'\)\),\s*TransitionEffect\.OPACITY\.animation\(motionAnimateParam\('reader\.session\.capsule\.exit'\)\)/,
  'the capsule must fade via the Reader-UI token pair (enter 160ms / exit 200ms); countdown updates mutate the mounted node and never replay this, and the morph handoff suppresses the fade until the window closes');
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
  experience.indexOf('  private startAutoPageSession(presentation: ReaderControlPlaybackPresentation): void {'),
);
assert.ok(toggleAutoPage.indexOf("coordinator.stop('user')") >= 0);
assert.ok(toggleAutoPage.indexOf('.then((): void => {') > toggleAutoPage.indexOf("coordinator.stop('user')"));
assert.ok(toggleAutoPage.indexOf('this.startAutoPageSession(presentation)') > toggleAutoPage.indexOf('.then((): void => {'),
  'auto-page may start only after the TTS stop promise resolves');
assert.match(toggleAutoPage, /\.catch\([\s\S]*?this\.logTtsFailure\('stop before auto-page', error\)/,
  'a failed TTS stop must fail closed instead of overlapping both runtimes');
assert.match(experience,
  /coordinator\.start\(\{[\s\S]*?\.then\(\(\): Promise<boolean> => coordinator\.whenStarted\(\)\)[\s\S]*?this\.beginSessionCapsuleMorph\(\)/,
  'a successful TTS start must enter the capsule morph only after runtime start resolves');

assert.match(experience,
  /private shouldShowSessionCapsule\(\): boolean \{[\s\S]*?sessionMorphPhase === 'capture'[\s\S]*?sessionMorphPhase === 'dotHold'[\s\S]*?return false;/,
  'capture, flight, handoff and dot hold own the capsule anchor before expansion');
assert.doesNotMatch(experience.slice(experience.indexOf('  private toggleSessionCapsule()'),
  experience.indexOf('  private activeSessionCapsuleWidth()')), /finishSessionCapsuleMorph/,
  'a playback toggle must not jump the moving capsule straight to its endpoint');
assert.match(experience,
  /private admitSessionCapsuleMeasurement\([\s\S]*?if \(this\.sessionMorphPhase !== 'none'\) \{\s*return;\s*\}/,
  'transient morph shell widths must not overwrite the settled capsule measurement');
assert.match(experience,
  /if \(this\.sessionMorphPhase === 'flight' && this\.sessionMorphSourceImage !== undefined\) \{[\s\S]*?Image\(this\.sessionMorphSourceImage\)[\s\S]*?\.blur\(12\)[\s\S]*?\.zIndex\(9\)\s*\.hitTestBehavior\(HitTestMode\.None\);/,
  'the exact captured source and authored blur ghost must be non-interactive above the capsule');
assert.match(experience,
  /private beginSessionCapsuleMorph\(\): void \{[\s\S]*?if \(this\.reduceMotion \|\| this\.sessionMorphPhase !== 'none' \|\|\s*!this\.controlVisible\(\) \|\| this\.controlObscured\) \{\s*this\.hideControl\(\);\s*return;/,
  'Reduce Motion and hidden-control paths settle immediately without a blank proxy');
assert.match(experience,
  /getComponentSnapshot\(\)\.get\(source\.actorId,[\s\S]*?motionSpecGet\('reader\.session\.capsule\.morph\.flight'[\s\S]*?motionSpecGet\('reader\.session\.capsule\.morph\.dot\.hold'[\s\S]*?motionSpecGet\('reader\.session\.capsule\.morph\.expand'[\s\S]*?motionSpecGet\('reader\.session\.capsule\.morph\.reveal'/,
  'the source snapshot and all authored beats must use the registered choreography');
assert.match(experience,
  /this\.autoPageState = startReaderAutoPage\(this\.autoPageState\);\s*if \(this\.isControlPlaybackPresentationCurrent\(presentation, 'autoPage'\)\) \{\s*this\.beginSessionCapsuleMorph\(\);\s*\}\s*this\.armAutoPageTimer/,
  'current auto-page presentation stays mounted until capture owns the hide; stale presentation cannot hide a new module');
assert.match(experience,
  /this\.beginSessionCapsuleMorph\(\);\s*\}\s*\}\)\.catch\(\(error: Error\): void => this\.logTtsFailure\('start', error\)\);/,
  'TTS source also remains mounted until capture succeeds');

console.log('reader session capsule: PASS');
