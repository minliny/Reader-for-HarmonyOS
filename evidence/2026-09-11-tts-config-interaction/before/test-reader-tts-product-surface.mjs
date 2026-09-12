import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readingDir = new URL('../entry/src/main/ets/features/reading/', import.meta.url);
// The active TTS business surface is the persistent content, not the retained
// standalone Full component. Legacy Quick artwork checks below are explicitly
// separate; shared actor geometry is verified against live CSS in its own test.
const fullPanel = await readFile(new URL('ReaderControlTtsContent.ets', readingDir), 'utf8');
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
assert.match(quickPanel, /Text\(this\.playbackLabel\(\)\)/);
assert.match(quickPanel,
  /if \(this\.isActivelySpeaking\(\)\) \{[\s\S]*?Row\(\)\.width\(3\)\.height\(13\)[\s\S]*?reader_tts_play/,
  'quick TTS control must replace play with pause bars while speaking');
assert.match(fullPanel,
  /this\.isActivelySpeaking\(\) \? 'app\.media\.reader_session_pause' : 'app\.media\.reader_tts_play'/,
  'the persistent TTS control must replace play with its pause glyph while speaking');
assert.match(fullPanel, /this\.quickLabel\('playback'\)/);
assert.match(fullPanel, /private quickLabel\(kind:[\s\S]*?Text\(this\.playbackLabel\(\)\)/,
  'the actual Quick label must project current state instead of a hard-coded idle label');
assert.match(fullPanel, /this\.state\.status === 'error' \|\| this\.state\.status === 'failed'\) return '失败·重试'/,
  'the actual Quick failure must remain visible and retryable');
assert.match(fullPanel, /this\.state\.status === 'unavailable'\) return '不可用'/);
assert.match(fullPanel, /this\.state\.status === 'preparing' \|\| this\.state\.status === 'resuming'\) return '准备中'/);
assert.match(quickPanel, /this\.state\.status === 'error'.*return '失败·重试'/,
  'quick TTS must expose a retryable failure instead of continuing to look idle');
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
  /this\.playback\(\);[\s\S]*?this\.timer\(\);[\s\S]*?this\.speed\(\);[\s\S]*?this\.detailSection\(\);[\s\S]*?this\.systemSection\(\);/,
  'the persistent TTS tree must preserve playback, timer, rate, detail and TTS-config actor order');
assert.match(fullPanel,
  /private ttsServiceTypeTabs\(\)[\s\S]*?this\.ttsServiceTypeTab\(false\)[\s\S]*?this\.ttsServiceTypeTab\(true\)[\s\S]*?\.height\(87\)/,
  'Make Full TTS uses the measured 87vp service cards');
assert.match(fullPanel,
  /private ttsClosedConfigPanel\(\)[\s\S]*?ttsClosedConfigRow\('engine'\)[\s\S]*?ttsClosedConfigRow\('language'\)[\s\S]*?ttsClosedConfigRow\('session'\)[\s\S]*?ttsClosedConfigRow\('failure'\)[\s\S]*?\.height\(192\)/,
  'Final Full TTS must preserve all four closed configuration triggers in the 192vp panel');
assert.match(fullPanel,
  /private fieldLabel\(kind:[\s\S]*?'系统引擎'[\s\S]*?'语言'[\s\S]*?'音频会话'[\s\S]*?'不可用处理'/,
  'static field identities must retain their original user-facing labels');
const closedConfig = fullPanel.match(/private ttsClosedConfigPanel\(\)[\s\S]*?private ttsClosedConfigRow[\s\S]*?\n  \}/)?.[0] ?? '';
assert.ok(closedConfig.length > 0, 'closed TTS config builders must remain present');
assert.doesNotMatch(closedConfig, /\.onClick\(/,
  'closed TTS fields must not invisibly cycle values when no expanded Figma option set exists');
assert.match(fullPanel,
  /private voiceSelectorRow\(\)[\s\S]*?this\.ttsSelectValueField\('voice'\)/,
  'the voice field must use the shared clean value-and-chevron field');
assert.match(fullPanel, /private fieldWidth\(kind:[\s\S]*?Math\.min\(170, this\.frame\(\)\.config\.width/);
assert.match(closedConfig,
  /this\.ttsSelectValueField\(kind\)/,
  'all four TTS configuration fields must reuse the same value-field presentation');
assert.match(fullPanel, /accessibilityText\(`\$\{this\.fieldLabel\(kind\)\}：\$\{this\.fieldValue\(kind\)\}[\s\S]*?暂不可展开/);
assert.match(fullPanel,
  /private ttsSelectValueField[\s\S]*?Text\(this\.fieldValue\(kind\)\)[\s\S]*?if \(kind === 'voice'\)[\s\S]*?app\.media\.reader_chevron_right[\s\S]*?TOK_TTS_FIELD/,
  'the real voice action has a disclosure; read-only fields retain their current values');
assert.doesNotMatch(fullPanel, /ttsDropdownPortGradient|153\.435|206\.565/,
  'a chevron artwork layer must not be stretched into a hard-stop gradient across TTS fields');
assert.match(manager, /export struct ReaderHttpTtsManagerPanel/,
  'the isolated HTTP CRUD capability must remain available for a future evidenced entry point');
assert.match(fullPanel, /this\.state\.status === 'failed'\) return '播放失败'/);
assert.match(fullPanel, /this\.state\.status === 'unavailable'\) return '当前引擎不可用'/);
assert.match(fullPanel, /this\.state\.errorMessage/);
assert.match(controls, /onTtsEngineChange: \(engine: string\)/);
assert.match(controls, /onTtsSeek: \(sliceIndex: number\)/);
assert.equal((controls.match(/ReaderControlTtsContent\(\{/g) ?? []).length, 1);
assert.doesNotMatch(controls, /ReaderTts(?:Full|Module)Panel\(\{/);
const ttsBinding = controls.match(/ReaderControlTtsContent\(\{([\s\S]*?)\n\s*\}\);/)?.[1];
assert.ok(ttsBinding, 'actual persistent TTS binding exists');
assert.match(ttsBinding, /motionProgress: this\.frame\(\)\.progress/);
assert.match(ttsBinding, /form: this\.contentLocation\(\)\.form/);
assert.match(ttsBinding, /availableWidth: this\.frame\(\)\.content\.width,/);
assert.match(ttsBinding, /availableHeight: this\.frame\(\)\.content\.height,/);
assert.match(ttsBinding, /interactionEnabled: this\.secondaryModuleInputEnabled\('tts'\)/);
assert.match(ttsBinding, /reportSessionMorphSource\(kind, left, top, width, height\)/);
assert.doesNotMatch(ttsBinding, /content\.(?:width|height) \+|readerSessionMorphActorId\('fullTtsPlayback'\)/);
for (const callback of ['onTtsToggle', 'onTtsStop', 'onTtsPrevious', 'onTtsNext', 'onTtsSeek',
  'onTtsRateChange', 'onTtsTimerChange', 'onTtsFollowHighlightChange', 'onTtsPauseOnInterruptionChange',
  'onTtsAllowMixingChange', 'onTtsFailurePolicyChange', 'onTtsVoiceChange', 'onTtsEngineChange',
  'onTtsHttpEnginePut', 'onTtsHttpEngineDelete']) {
  assert.ok(ttsBinding.includes(`this.${callback}(`), `business callback lost from actual TTS: ${callback}`);
}
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
