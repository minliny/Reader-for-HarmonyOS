import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  createDefaultReaderTtsPreferencesSnapshot,
  isReaderTtsVoiceInstalled,
  normalizeReaderTtsPreferencesSnapshot,
} from '../entry/src/main/ets/features/reading/ReaderTtsPreferencesState.ts';

const fallback = createDefaultReaderTtsPreferencesSnapshot();
assert.deepEqual(fallback, {
  version: 1,
  language: 'zh-CN',
  person: 0,
  pauseOnInterruption: true,
  allowMixing: false,
  failurePolicy: 'stop',
  followHighlight: true,
});

assert.deepEqual(normalizeReaderTtsPreferencesSnapshot({
  version: 1,
  language: ' en-US ',
  person: 7,
  pauseOnInterruption: false,
  allowMixing: true,
  failurePolicy: 'skip',
  followHighlight: false,
}), {
  version: 1,
  language: 'en-US',
  person: 7,
  pauseOnInterruption: false,
  allowMixing: true,
  failurePolicy: 'skip',
  followHighlight: false,
});

assert.deepEqual(normalizeReaderTtsPreferencesSnapshot({
  version: 1,
  language: '',
  person: -1,
  pauseOnInterruption: 'invalid',
  allowMixing: 'invalid',
  failurePolicy: 'retry',
  followHighlight: 'invalid',
}), fallback, 'invalid fields must fall back independently instead of entering Host state');

assert.equal(isReaderTtsVoiceInstalled('INSTALLED'), true);
assert.equal(isReaderTtsVoiceInstalled(' installed '), true);
assert.equal(isReaderTtsVoiceInstalled(undefined), true, 'older system images omit voice status');
assert.equal(isReaderTtsVoiceInstalled('GA'), false, 'downloadable catalogue voices are not immediately playable');

const appDir = new URL('../entry/src/main/ets/app/', import.meta.url);
const readingDir = new URL('../entry/src/main/ets/features/reading/', import.meta.url);
const systemHost = await readFile(new URL('HarmonySystemTtsHost.ts', appDir), 'utf8');
const router = await readFile(new URL('HarmonyTtsHostRouter.ts', appDir), 'utf8');
const coordinator = await readFile(new URL('ReaderTtsSessionCoordinator.ts', readingDir), 'utf8');
const gateway = await readFile(new URL('ReaderTtsPreferencesGateway.ts', readingDir), 'utf8');
const panel = await readFile(new URL('ReaderTtsFullPanel.ets', readingDir), 'utf8');
const experience = await readFile(new URL('LocalReadingExperience.ets', readingDir), 'utf8');

assert.match(systemHost, /textToSpeech\.listVoices\(\{/);
assert.match(systemHost, /isReaderTtsVoiceInstalled\(voice\.status\)/,
  'only voices that can be created immediately may enter persisted choices');
assert.match(systemHost, /ensureEngine\(request\.language, request\.person\)/);
assert.match(systemHost, /requested system TTS voice failed; falling back to default/,
  'a stale persisted voice must fall back to the already-probed system default');
assert.match(systemHost, /'languageContext': this\.engineLanguage \?\? request\.language/,
  'fallback speech must use the effective engine language');
assert.match(systemHost, /person,/);
assert.match(router, /listSystemVoices\(\): Promise<ReaderTtsVoiceOption\[\]>/);
assert.match(coordinator, /setVoice\(language: string, person: number\): Promise<void>/);
assert.match(coordinator, /this\.active\?\.input\.pauseOnInterruption \?\? true/);
assert.match(gateway, /reader_tts_preferences_v1/);
assert.match(gateway, /await store\.flush\(\)/);
assert.match(panel, /this\.toggleRow\('来电暂停', this\.pauseOnInterruption, true/);
assert.match(panel,
  /this\.ttsClosedConfigRow\([\s\S]*?'不可用处理',[\s\S]*?this\.failurePolicy === 'skip'/,
  'persisted failure policy must still be projected into the Figma-backed closed field');
assert.doesNotMatch(panel, /this\.onFailurePolicyChange\(this\.failurePolicy === 'skip'/,
  'a closed field with no Figma option surface must not invisibly cycle persisted policy');
assert.match(panel, /this\.selectNextVoice\(\)/);
assert.doesNotMatch(panel, /this\.selectNextLanguage\(\)/,
  'language must not be changed by an undisclosed tap-to-cycle interaction');
assert.match(experience, /await this\.ttsPreferencesGateway\.load\(\)/);
assert.match(experience, /listSystemVoices\(\)/);
assert.match(experience, /language: this\.ttsLanguage/);
assert.match(experience, /person: this\.ttsPerson/);
assert.match(experience, /pauseOnInterruption: this\.ttsPauseOnInterruption/);

console.log('reader TTS voice and persisted Host preferences: PASS');
