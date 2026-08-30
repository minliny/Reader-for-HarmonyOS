import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readingDir = new URL('../entry/src/main/ets/features/reading/', import.meta.url);
const fullPanel = await readFile(new URL('ReaderTtsFullPanel.ets', readingDir), 'utf8');
const quickPanel = await readFile(new URL('ReaderTtsModulePanel.ets', readingDir), 'utf8');
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
assert.match(fullPanel, /this\.requestEngineChange\(`http-tts:\$\{this\.httpEngines\[0\]\.id\}`\)/,
  'selecting the online service type must choose one stable configured engine, not invisibly cycle engines');
assert.match(fullPanel, /this\.onSeek\(Math\.round\(value\)\)/);
assert.match(quickPanel, /TTS_MODULE_RATE_SLIDER_WIDTH = 116/);
assert.match(quickPanel, /TTS_MODULE_RATE_TRACK_HEIGHT = 2/);
assert.match(quickPanel, /TTS_MODULE_RATE_THUMB_SIZE = 18/);
assert.match(quickPanel,
  /Figma `750:1056`:[\s\S]*?reader_tts_speed_thumb[\s\S]*?responseRegion\(\{ x: 0, y: -6, width: '100%', height: 44 \}\)/,
  'Quick TTS must render the Figma rail/thumb while preserving its 116x44 hit target');
assert.doesNotMatch(quickPanel,
  /source master reserves this semantic range without a visible/,
  'Quick TTS must not hide a slider that is visible in final Figma');
assert.match(quickPanel,
  /No expanded options\/reaction exists[\s\S]*?\.enabled\(false\)/,
  'Quick timer must stay closed until Figma defines its expanded option contract');
assert.doesNotMatch(quickPanel,
  /app\.media\.reader_chevron_down'[\s\S]{0,120}rotate\(\{ angle: 180 \}\)/,
  'a closed timer field must not display an expanded-state up chevron');
assert.doesNotMatch(fullPanel, /ReaderHttpTtsManagerPanel\(\{/,
  'the HTTP CRUD manager has no Figma-backed placement at the top of the full TTS page');
assert.match(fullPanel,
  /Column\(\) \{\s*this\.playbackSection\(\);[\s\S]*?this\.timerSection\(\);[\s\S]*?this\.rateSection\(\);[\s\S]*?this\.detailSection\(\);[\s\S]*?this\.systemSection\(\);/,
  'the full TTS page must preserve the authoritative playback, timer, rate, detail, and TTS-config order');
assert.match(fullPanel,
  /private ttsServiceTypeTabs\(\)[\s\S]*?this\.ttsServiceTypeTab\(false\)[\s\S]*?this\.ttsServiceTypeTab\(true\)[\s\S]*?\.height\(116\)/,
  'Final Full TTS must use the Figma 930:933 vertical service-type shell');
assert.match(fullPanel,
  /private ttsClosedConfigPanel\(\)[\s\S]*?系统引擎[\s\S]*?语言[\s\S]*?音频会话[\s\S]*?不可用处理[\s\S]*?\.height\(182\)/,
  'Final Full TTS must preserve all four closed configuration triggers in the 182vp panel');
const closedConfig = fullPanel.match(/private ttsClosedConfigPanel\(\)[\s\S]*?private ttsClosedConfigRow[\s\S]*?\n  \}/)?.[0] ?? '';
assert.ok(closedConfig.length > 0, 'closed TTS config builders must remain present');
assert.doesNotMatch(closedConfig, /\.onClick\(/,
  'closed TTS fields must not invisibly cycle values when no expanded Figma option set exists');
assert.match(fullPanel,
  /private selectorRow[\s\S]*?this\.ttsSelectValueField\(value, 70, `\$\{label\}：\$\{value\}`\)/,
  'the voice field must use the shared clean value-and-chevron field');
assert.match(closedConfig,
  /this\.ttsSelectValueField\(value, fieldWidth, `\$\{label\}：\$\{value\}，暂不可展开`\)/,
  'all four TTS configuration fields must reuse the same value-field presentation');
assert.match(fullPanel,
  /private ttsSelectValueField[\s\S]*?Text\(value\)[\s\S]*?app\.media\.reader_chevron_down[\s\S]*?this\.palette\(\)\.surfacePanelSoft[\s\S]*?this\.palette\(\)\.lineStrong/,
  'the shared TTS field must render its current value, chevron, surface, and border');
assert.doesNotMatch(fullPanel, /ttsDropdownPortGradient|153\.435|206\.565/,
  'a chevron artwork layer must not be stretched into a hard-stop gradient across TTS fields');
assert.match(manager, /export struct ReaderHttpTtsManagerPanel/,
  'the isolated HTTP CRUD capability must remain available for a future evidenced entry point');
assert.match(fullPanel, /this\.state\.status === 'failed'\) return '播放失败'/);
assert.match(fullPanel, /this\.state\.status === 'unavailable'\) return '当前引擎不可用'/);
assert.match(fullPanel, /this\.state\.errorMessage/);
assert.match(controls, /onTtsEngineChange: \(engine: string\)/);
assert.match(controls, /onTtsSeek: \(sliceIndex: number\)/);
assert.doesNotMatch(controls, /module === 'tts' && this\.ttsState\.status === 'unavailable'\) \{\s*return/);
assert.match(experience, /new ReaderHttpTtsGateway\(owner\)/);
assert.match(experience, /private async loadTtsPresentationMetadata\(/);
assert.match(experience, /httpEngines = await httpGateway\.list\(\)/);
assert.match(experience,
  /void this\.loadTtsPresentationMetadata\([\s\S]{0,220}const initialization = coordinator\.probeAvailability\(\)/,
  'optional HTTP engine and voice discovery must not gate first-play admission');
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
