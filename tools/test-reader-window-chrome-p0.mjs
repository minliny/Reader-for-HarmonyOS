import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (relative) => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');

const coordinator = read('entry/src/main/ets/app/ReaderWindowCoordinator.ts');
const index = read('entry/src/main/ets/pages/Index.ets');
const experience = read('entry/src/main/ets/features/reading/LocalReadingExperience.ets');

assert.match(coordinator,
  /class ReaderWindowChromeStyle[\s\S]*underlayColor: string;[\s\S]*tone: ReaderWindowChromeTone;/,
  'system-bar underlay and icon tone must be one style value');
assert.match(coordinator,
  /statusBarColor: request\.style\.underlayColor,[\s\S]*navigationBarColor: request\.style\.underlayColor,[\s\S]*statusBarContentColor: contentColor/,
  'one revision must atomically apply the paired underlay and content tone');
assert.match(coordinator,
  /contentColor: string;[\s\S]*constructor\(underlayColor: string, tone: ReaderWindowChromeTone, contentColor\?: string\)[\s\S]*this\.contentColor = contentColor \?\? /,
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
  /readerOwnsWindowEdges\(\): boolean \{[\s\S]*this\.readingSessionActive && \(this\.route === 'reading' \|\| this\.route === 'directory'\)/,
  'a hidden reader warming behind Detail must not remove the Detail safe top');
assert.match(experience,
  /applyWindowPolicyForChromeOwner\(\)[\s\S]*?if \(this\.windowChromeActive\)[\s\S]*?applyReaderWindowPolicy[\s\S]*?requestAppWindowPolicy/,
  'a hidden reader warming behind Detail must not hide the app status bar');

console.log('reader window chrome P0 contract: PASS');
