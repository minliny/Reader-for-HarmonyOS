import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { productionMotionMethods } from './lib/reader-motion-method-probe.mjs';

const read = (relative) => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');

const coordinator = read('entry/src/main/ets/app/ReaderWindowCoordinator.ts');
const index = read('entry/src/main/ets/pages/Index.ets');
const experience = read('entry/src/main/ets/features/reading/LocalReadingExperience.ets');

assert.doesNotMatch(index, /\$r\('app\.color\.reader_surface'\)/,
  'app safe-area root must not paint a fixed day resource behind night window chrome');
assert.equal((index.match(/backgroundColor\(readerAppColor\('app.window.background', this.appThemeScheme\)\)/g) ?? []).length, 2,
  'normal and startup-failure roots share the same app palette as ReaderThemeHost window chrome');

assert.match(coordinator,
  /class ReaderWindowChromeStyle[\s\S]*underlayColor: string;[\s\S]*tone: ReaderWindowChromeTone;/,
  'system-bar underlay and icon tone must be one style value');
assert.match(coordinator,
  /statusBarColor: ReaderWindowCoordinator\.nativeStatusBarColor\(request\),[\s\S]*navigationBarColor: request\.style\.underlayColor,[\s\S]*statusBarContentColor: contentColor/,
  'one revision must expose the owned paper while preserving paired navigation base and content ink');
assert.match(coordinator,
  /contentColor: string;[\s\S]*constructor\(underlayColor: string, tone: ReaderWindowChromeTone, contentColor\?: string,[\s\S]*paperThemeId: string = ''\)[\s\S]*this\.contentColor = contentColor \?\? /,
  'chrome style must carry an explicit foreground color with a tone fallback');
assert.doesNotMatch(coordinator, /#99000000/, 'system-bar content must not use translucent black');
assert.doesNotMatch(coordinator, /requestOverlayChrome\(tone:/,
  'overlay chrome must not accept an independent tone-only request');
assert.match(coordinator,
  /requestOverlayChrome\(inheritedReaderStyle: ReaderWindowChromeStyle\)[\s\S]*new ReaderWindowChromeRequest\('overlay', inheritedReaderStyle\)/,
  'overlay chrome must inherit the complete reader style');

assert.match(experience,
  /const themeStyle = readerAppearanceThemeStyle\(this\.appearanceSnapshot\.activeTheme\);[\s\S]*new ReaderWindowChromeStyle\([\s\S]*themeStyle\.paperStart,[\s\S]*readerAppearanceChromeTone\(this\.appearanceSnapshot\.activeTheme\),[\s\S]*themeStyle\.ink/,
  'the active reading theme must provide exact underlay, tone, and ink');
assert.match(experience, /requestOverlayChrome\(chromeStyle\)/,
  'reader overlays must inherit the active paired style');

assert.match(index,
  /padding\(\{ top: this\.readerOwnsWindowEdges\(\) \? 0 : this\.appContentTopInset\(\) \}\)/,
  'safe-top removal must depend on visible reader edge ownership');
assert.match(index,
  /expandSafeArea\(\[SafeAreaType\.SYSTEM\], this\.readerOwnsWindowEdges\(\) \?\s*\[SafeAreaEdge\.TOP, SafeAreaEdge\.BOTTOM\] : \[SafeAreaEdge\.BOTTOM\]\)/,
  'the root must also grant the reader the full top edge; a child cannot restore an excluded ancestor viewport');
const EdgeOwner = productionMotionMethods(fileURLToPath(new URL('../entry/src/main/ets/pages/Index.ets', import.meta.url)), ['readerOwnsWindowEdges']);
for (const [route, readingSessionActive, directoryReturnTarget, expected] of [
  ['detail', false, 'detail', false], ['detail', true, 'detail', false],
  ['directory', false, 'detail', false], ['directory', true, 'detail', false],
  ['directory', false, 'readerControl', false], ['directory', true, 'readerControl', true],
  ['reading', true, 'detail', true], ['reading', false, 'detail', false],
]) {
  const owner = Object.assign(new EdgeOwner(), { route, readingSessionActive, directoryReturnTarget });
  assert.equal(owner.readerOwnsWindowEdges(), expected,
    'ordinary catalog inherits App safe top; only visible reading control owns window edges');
}
assert.match(experience,
  /applyWindowPolicyForChromeOwner\(\)[\s\S]*?if \(this\.windowChromeActive\)[\s\S]*?applyReaderWindowPolicy[\s\S]*?requestAppWindowPolicy/,
  'a hidden reader warming behind Detail must not hide the app status bar');

console.log('reader window chrome P0 contract: PASS');
