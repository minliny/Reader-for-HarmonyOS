import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (relative) => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');

const appTopBar = read('entry/src/main/ets/features/common/AppTopBar.ets');
const pageBackBar = read('entry/src/main/ets/features/common/PageBackBar.ets');
const mainTabBar = read('entry/src/main/ets/features/shell/MainTabBar.ets');
const mainTabShell = read('entry/src/main/ets/features/shell/MainTabShell.ets');

for (const [name, source] of [
  ['AppTopBar', appTopBar],
  ['PageBackBar', pageBackBar],
]) {
  assert.match(source, /readerInteractiveSafeLeft\(ReaderWindowCoordinator\.metrics\(\)\)/,
    `${name} must honor the measured left interactive safe edge`);
  assert.match(source, /readerInteractiveSafeRight\(ReaderWindowCoordinator\.metrics\(\)\)/,
    `${name} must honor the measured right interactive safe edge independently`);
}

assert.match(mainTabBar,
  /resolveHorizontalFrame\([\s\S]*readerInteractiveSafeLeft\(metrics\)[\s\S]*readerInteractiveSafeRight\(metrics\)[\s\S]*new SurfaceWidthSpec\(360, 15, 15, 'center'\)/,
  'Phone navigation must resolve its 360vp Figma cap inside live asymmetric safe edges');
assert.match(mainTabBar, /\.margin\(\{ bottom: Math\.max\(15, this\.interactiveBottom\(\)\) \}\)/,
  'Phone navigation must preserve the 15vp design gap while clearing the live bottom gesture edge');
assert.match(mainTabBar, /private verticalRail\(\)[\s\S]*\.width\(82\)\s*\.height\(332\)/,
  'Tablet navigation must preserve the 82x332 Figma rail');

assert.match(mainTabShell, /return Math\.max\(17, readerInteractiveSafeLeft\(ReaderWindowCoordinator\.metrics\(\)\)\)/,
  'Tablet rail must preserve its 17vp design gap while clearing the live left gesture edge');
assert.match(mainTabShell,
  /const availableHeight = Math\.max\(0, windowHeight - safeTop - safeBottom\);[\s\S]*return Math\.max\(0, \(availableHeight - 332\) \/ 2\);/,
  'Tablet rail must center in the safe-height span using host-local coordinates');
assert.doesNotMatch(mainTabShell,
  /return safeTop \+ Math\.max\(0, \(availableHeight - 332\) \/ 2\)/,
  'Tablet rail must not apply the Index-owned safeTop twice');

console.log('app shell safe geometry: PASS');
