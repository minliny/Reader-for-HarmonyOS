import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readingDir = new URL('../entry/src/main/ets/features/reading/', import.meta.url);
const fullPanel = await readFile(new URL('ReaderTtsFullPanel.ets', readingDir), 'utf8');
const controls = await readFile(new URL('ReaderControlPanel.ets', readingDir), 'utf8');
const experience = await readFile(new URL('LocalReadingExperience.ets', readingDir), 'utf8');
const manager = await readFile(new URL('ReaderHttpTtsManagerPanel.ets', readingDir), 'utf8');

assert.match(fullPanel, /@Prop engine: string = 'system'/);
assert.match(fullPanel, /@Prop httpEngines: ReaderTtsEngineOption\[\] = \[\]/);
assert.match(fullPanel, /this\.onEngineChange\('system'\)/);
assert.match(fullPanel, /`http-tts:\$\{next\.id\}`/);
assert.match(fullPanel, /this\.onSeek\(Math\.round\(value\)\)/);
assert.match(fullPanel, /Column\(\) \{\s*ReaderHttpTtsManagerPanel\(\{/);
assert.match(controls, /onTtsEngineChange: \(engine: string\)/);
assert.match(controls, /onTtsSeek: \(sliceIndex: number\)/);
assert.doesNotMatch(controls, /module === 'tts' && this\.ttsState\.status === 'unavailable'\) \{\s*return/);
assert.match(experience, /new ReaderHttpTtsGateway\(owner\)/);
assert.match(experience, /const httpEngines = await httpGateway\.list\(\)/);
assert.match(experience, /gateway\.putConfig\(\{/);
assert.match(experience, /await coordinator\.probeAvailability\(\)/);
assert.match(experience, /coordinator\.seek\(sliceIndex\)/);
assert.match(experience, /const merged: ReaderHttpTtsConfig = \{/);
assert.match(experience, /if \(existing\?\.contentType !== undefined\) merged\.contentType = existing\.contentType/);
assert.match(experience, /if \(existing\?\.enabledCookieJar !== undefined\) merged\.enabledCookieJar = existing\.enabledCookieJar/);
assert.match(experience, /gateway\.put\(merged\)/);
assert.doesNotMatch(experience, /gateway\.put\(\{ \.\.\./);
assert.match(experience, /await httpGateway\.delete\(id\)/);
assert.match(manager, /TextInput\(\{ placeholder: '配置名称'/);
assert.match(manager, /TextInput\(\{ placeholder: '请求 URL（使用 \{\{text\}\} 占位）'/);
assert.match(manager, /this\.onPut\(\{/);
assert.match(manager, /this\.onDelete\(engine\.id\)/);

console.log('reader TTS system and HttpTTS product surface: PASS');
