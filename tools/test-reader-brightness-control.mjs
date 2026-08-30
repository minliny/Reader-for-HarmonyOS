import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const control = readFileSync(resolve(repo,
  'entry/src/main/ets/features/reading/ReaderControlPanel.ets'), 'utf8');
const experience = readFileSync(resolve(repo,
  'entry/src/main/ets/features/reading/LocalReadingExperience.ets'), 'utf8');
const brightness = control.match(/private brightnessRail\(\)[\s\S]*?private moduleNav\(\)/)?.[0] ?? '';

assert.ok(brightness.length > 0, 'brightness rail builder and mapping helpers must remain present');
assert.doesNotMatch(brightness, /Slider\(\{/,
  'the authored 92vp track must not be controlled by an invisible slider with an implicit thumb inset');
assert.doesNotMatch(brightness, /\.opacity\(0\.001\)/);
assert.match(brightness, /GestureGroup\([\s\S]*?PanGesture\([\s\S]*?TapGesture\(/,
  'the full 24x92 target must own both drag and tap input');
assert.match(brightness,
  /this\.brightnessDragStartPercent - offsetY \/ READER_CONTROL_BRIGHTNESS_TRACK_HEIGHT \* range/,
  'drag mapping must use the authored track height');
assert.match(brightness,
  /1 - clampedY \/ READER_CONTROL_BRIGHTNESS_TRACK_HEIGHT/,
  'tap mapping must cover the complete track from maximum to minimum');
assert.match(brightness, /\.fontColor\(this\.palette\(\)\.ink\)/);
assert.match(brightness, /\.backgroundColor\(this\.palette\(\)\.surfaceElevated\)/);
assert.doesNotMatch(brightness, /brightnessAutomatic \? (Color\.White|TOK_READ_PRIMARY)/,
  'Figma does not define an invented cyan automatic-brightness endpoint');
assert.match(experience, /private brightnessMutationQueue: Promise<void> = Promise\.resolve\(\)/);
assert.match(experience,
  /private enqueueReaderBrightness[\s\S]*?this\.brightnessMutationQueue = this\.brightnessMutationQueue[\s\S]*?setWindowBrightness\(target\)/,
  'manual and automatic brightness requests must share a serialized window side-effect lane');
assert.match(experience,
  /aboutToDisappear\(\)[\s\S]*?this\.restoreInitialWindowBrightness\(\)[\s\S]*?private restoreInitialWindowBrightness/,
  'reader exit must restore the exact brightness policy captured before the reader changed it');

console.log('reader brightness control contract: PASS');
