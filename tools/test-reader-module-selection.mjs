import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(repo, path), 'utf8');

const control = read('entry/src/main/ets/features/reading/ReaderControlPanel.ets');
const directory = read('entry/src/main/ets/features/reading/FullDirectoryPanel.ets');
const provenance = read('tools/svg-provenance.config.mjs');

for (const [module, asset] of [
  ['directory', 'reader_directory_list_active'],
  ['tts', 'reader_tts_nav_active'],
  ['appearance', 'reader_appearance_nav_active'],
  ['settings', 'reader_settings_nav_active'],
]) {
  assert.match(control, new RegExp(`module === '${module}'[\\s\\S]*?return '${asset}'`),
    `${module} must use its official light active resource`);
}
assert.doesNotMatch(control, /module === 'appearance'[\s\S]*?\.fillColor\('#FFFAF4'\)/,
  'module selection must not depend on runtime tinting of hard-coded SVG strokes');
assert.match(provenance, /reader_appearance_nav_active[\s\S]*?Filled\/ReaderModuleAppearance/);
assert.match(provenance, /reader_settings_nav_active[\s\S]*?Filled\/ReaderModuleSettings/);

const directoryTab = directory.match(/private directoryTab\(\)[\s\S]*?private bookmarkTab\(\)/)?.[0] ?? '';
assert.ok(directoryTab.length > 0, 'directory tab builder must remain present');
assert.doesNotMatch(directoryTab, /Image\(/,
  'the Figma final active directory tab contains text and underline, not an extra directory icon');

console.log('reader module selection contract: PASS');
