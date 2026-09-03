import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(repo, path), 'utf8');
const page = read('entry/src/main/ets/features/settings/SettingsPage.ets');
const overlay = read('entry/src/main/ets/features/settings/SettingsSelectOverlay.ets');

assert.match(page, /import \{ SettingsSelectOverlay, type SettingsSelectField \}/);
assert.match(page, /\['简体中文', '繁體中文', 'English', '日本語', '한국어'\]/,
  'language spelling must follow the explicit Figma documentation');
assert.match(page,
  /right: Number\(newValue\.globalPosition\.x\) \+ Number\(newValue\.width\)[\s\S]*bottom: Number\(newValue\.globalPosition\.y\) \+ Number\(newValue\.height\)/,
  'Tablet positioning must derive the live trigger right/bottom anchor');
assert.match(page,
  /SettingsSelectOverlay\(\{[\s\S]*isTablet: this\.isTablet[\s\S]*anchorRight: this\.anchorRight - this\.originX[\s\S]*anchorBottom: this\.anchorBottom - this\.originY/);

assert.match(overlay, /Settings\/SelectPanel `4106:64687`/);
assert.match(overlay, /Settings\/SelectOptionRow `4103:909`/);
assert.match(overlay, /const PHONE_OPTION_HEIGHT = 52/);
assert.match(overlay, /const TABLET_PANEL_WIDTH = 160/);
assert.match(overlay, /const TABLET_OPTION_HEIGHT = 42/);
assert.match(overlay, /const TABLET_ANCHOR_GAP = 6/);
assert.match(overlay,
  /backgroundColor\(this\.isTablet \? Color\.Transparent : '#521F1B17'\)/,
  'Phone must use the Figma 32% modal scrim while Tablet remains non-modal visually');
assert.match(overlay,
  /linearGradient\(\{[\s\S]*'#FAF7F2'[\s\S]*'#F5F0E8'[\s\S]*borderRadius\(\{ topLeft: 18, topRight: 18 \}\)/,
  'Phone sheet must preserve its Figma gradient and top radius');
assert.match(overlay, /Blank\(\)[\s\S]*\.width\(36\)[\s\S]*\.height\(4\)/,
  'Phone sheet must keep its 36 by 4 handle');
assert.match(overlay, /Text\('取消'\)[\s\S]*\.height\(PHONE_OPTION_HEIGHT\)/,
  'Phone cancellation remains a separate 52vp card');
assert.match(overlay,
  /\.position\(\{[\s\S]*x: this\.anchorRight - TABLET_PANEL_WIDTH[\s\S]*y: this\.anchorBottom \+ TABLET_ANCHOR_GAP/,
  'Tablet popover must be trigger-right-aligned and placed 6vp below it');
assert.match(overlay, /Image\(\$r\('app\.media\.settings_select_check'\)\)/,
  'selected options must expose the Figma check actor');

console.log('settings responsive select overlay contract: PASS');
