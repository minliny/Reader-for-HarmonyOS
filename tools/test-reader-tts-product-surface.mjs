import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readingDir = new URL('../entry/src/main/ets/features/reading/', import.meta.url);
const fullPanel = await readFile(new URL('ReaderTtsFullPanel.ets', readingDir), 'utf8');
const controls = await readFile(new URL('ReaderControlPanel.ets', readingDir), 'utf8');
const experience = await readFile(new URL('LocalReadingExperience.ets', readingDir), 'utf8');
const manager = await readFile(new URL('ReaderHttpTtsManagerPanel.ets', readingDir), 'utf8');
const moduleManifest = await readFile(
  new URL('../entry/src/main/module.json5', import.meta.url),
  'utf8',
);
const runtimeOwner = await readFile(
  new URL('../entry/src/main/ets/app/ReaderRuntimeOwner.ts', import.meta.url),
  'utf8',
);

assert.match(fullPanel, /@Prop engine: string = 'system'/);
assert.match(fullPanel, /@Prop httpEngines: ReaderTtsEngineOption\[\] = \[\]/);
assert.match(fullPanel, /this\.requestEngineChange\('system'\)/);
assert.match(fullPanel, /`http-tts:\$\{next\.id\}`/);
assert.match(fullPanel, /this\.onSeek\(Math\.round\(value\)\)/);
assert.doesNotMatch(fullPanel, /ReaderHttpTtsManagerPanel\(\{/,
  'the HTTP CRUD manager has no Figma-backed placement at the top of the full TTS page');
assert.match(fullPanel,
  /Column\(\) \{\s*this\.playbackSection\(\);[\s\S]*?this\.timerSection\(\);[\s\S]*?this\.rateSection\(\);[\s\S]*?this\.detailSection\(\);[\s\S]*?this\.systemSection\(\);/,
  'the full TTS page must preserve the authoritative playback, timer, rate, detail, and TTS-config order');
assert.match(manager, /export struct ReaderHttpTtsManagerPanel/,
  'the isolated HTTP CRUD capability must remain available for a future evidenced entry point');
assert.match(fullPanel, /this\.state\.status === 'failed'\) return '播放失败'/);
assert.match(fullPanel, /this\.state\.status === 'unavailable'\) return '当前引擎不可用'/);
assert.match(fullPanel, /this\.state\.errorMessage/);
assert.match(controls, /onTtsEngineChange: \(engine: string\)/);
assert.match(controls, /onTtsSeek: \(sliceIndex: number\)/);
assert.doesNotMatch(controls, /module === 'tts' && this\.ttsState\.status === 'unavailable'\) \{\s*return/);
assert.match(experience, /new ReaderHttpTtsGateway\(owner\)/);
assert.match(experience, /const httpEngines = await httpGateway\.list\(\)/);
assert.match(experience, /const config = coordinator\.getProbedConfig\(\)/,
  'TTS initialization must reuse the config already read by the availability probe');
assert.doesNotMatch(experience, /const config = await gateway\.getConfig\(\)/,
  'TTS initialization must not issue a duplicate config request');
assert.match(experience, /page === 'moduleTts' \|\| page === 'fullTts'/,
  'TTS initialization must be scoped to the user entering the TTS controls');
assert.match(experience, /gateway\.putConfig\(\{/);
assert.match(experience, /await coordinator\.probeAvailability\(\)/);
assert.match(experience, /coordinator\.seek\(sliceIndex\)/);
assert.match(experience, /isBackgroundPlaybackActive\(\)/,
  'lifecycle fallback may pause TTS only when the audio continuous-task lease is inactive');
assert.doesNotMatch(experience, /if \(coordinator !== undefined\) \{\s*void coordinator\.pauseForBackground/,
  'background playback must not be unconditionally paused');
assert.match(experience, /const merged: ReaderHttpTtsConfig = \{/);
assert.match(experience, /if \(existing\?\.contentType !== undefined\) merged\.contentType = existing\.contentType/);
assert.match(experience, /if \(existing\?\.enabledCookieJar !== undefined\) merged\.enabledCookieJar = existing\.enabledCookieJar/);
assert.match(experience, /gateway\.put\(merged\)/);
assert.doesNotMatch(experience, /gateway\.put\(\{ \.\.\./);
assert.match(experience, /await httpGateway\.delete\(id\)/);
assert.match(manager, /TextInput\(\{ placeholder: '配置名称'/);
assert.match(manager, /TextInput\(\{ placeholder: '请求 URL（使用 \{\{text\}\} 占位）'/);
assert.match(manager, /void this\.onPut\(config\)[\s\S]*\.then\(\(\): void => this\.clearDraft\(\)\)/,
  'the manager may clear its draft only after Core confirms the save');
assert.match(manager, /\.catch\(\(error: Error\): void => \{\s*this\.errorText = error\.message/,
  'CRUD failures must remain visible inline');
assert.match(manager, /void this\.onDelete\(id\)/);
assert.match(manager, /@State private busy: boolean = false/);
assert.match(manager, /在线 TTS 操作失败/);
assert.match(moduleManifest, /ohos\.permission\.KEEP_BACKGROUND_RUNNING/);
assert.match(moduleManifest, /"backgroundModes": \[[\s\S]*?"audioPlayback"/);
assert.match(runtimeOwner, /new HarmonyTtsBackgroundSession\(context\)/);

console.log('reader TTS system and HttpTTS product surface: PASS');
