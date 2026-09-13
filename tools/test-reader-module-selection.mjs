import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(repo, path), 'utf8');

const control = read('entry/src/main/ets/features/reading/ReaderControlPanel.ets');
const directory = read('entry/src/main/ets/features/reading/FullDirectoryPanel.ets');
const provenance = read('tools/svg-provenance.config.mjs');
const Control = productionMotionMethods(resolve(repo, 'entry/src/main/ets/features/reading/ReaderControlPanel.ets'), ['moduleIcon']);
const selected = new Control();
selected.isActiveModule = () => true;

for (const [module, asset] of [
  ['directory', 'reader_directory_list_active'],
  ['tts', 'reader_tts_nav_active'],
  ['appearance', 'reader_appearance_nav_active'],
  ['settings', 'reader_settings_nav_active'],
]) {
  selected.appScheme = 'day';
  assert.equal(selected.moduleIcon('', module), asset, `${module}: authored Day active outline`);
  selected.appScheme = 'night';
  assert.equal(selected.moduleIcon('', module), `${asset}_theme_night`, `${module}: Night active outline`);
}
assert.doesNotMatch(control, /module === 'appearance'[\s\S]*?\.fillColor\('#FFFAF4'\)/,
  'module selection must not depend on runtime tinting of hard-coded SVG strokes');
for (const [asset, component] of [
  ['reader_directory_list_active', 'ReaderModuleDirectory'],
  ['reader_tts_nav_active', 'ReaderModuleTts'],
  ['reader_appearance_nav_active', 'ReaderModuleAppearance'],
  ['reader_settings_nav_active', 'ReaderModuleSettings'],
]) {
  assert.match(provenance,
    new RegExp(`${asset}[\\s\\S]*?'${component}'[\\s\\S]*?#FFFAF4`),
    `${component} active navigation must use the Figma white outline component`);
}
assert.doesNotMatch(provenance, /reader_(?:directory_list|tts_nav|appearance_nav|settings_nav)_active[\s\S]*?Filled\/ReaderModule/,
  'Figma final Reader module navigation never uses filled active glyphs');

const directoryTab = directory.match(/private directoryTab\(\)[\s\S]*?private bookmarkTab\(\)/)?.[0] ?? '';
assert.ok(directoryTab.length > 0, 'directory tab builder must remain present');
assert.doesNotMatch(directoryTab, /Image\(/,
  'the Figma final active directory tab contains text and underline, not an extra directory icon');

console.log('reader module selection contract: PASS');
