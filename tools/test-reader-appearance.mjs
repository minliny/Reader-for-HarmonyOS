import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  copyReaderAppearanceSnapshot,
  createDefaultReaderAppearanceSnapshot,
  normalizeReaderAppearanceSnapshot,
  setReaderAppearanceAlignment,
  setReaderAppearanceDayTheme,
  setReaderAppearanceIndent,
  setReaderAppearanceMetric,
  setReaderAppearanceNightTheme,
  setReaderAppearanceTheme,
} from '../entry/src/main/ets/features/reading/ReaderAppearanceState.ts';

const initial = createDefaultReaderAppearanceSnapshot();
assert.deepEqual(initial, {
  version: 1,
  activeTheme: 'paper',
  dayTheme: 'paper',
  nightTheme: 'paperNight',
  font: 'serif',
  fontSize: 18,
  lineHeightMultiplier: 1.96,
  paragraphSpacing: 16,
  letterSpacing: 0,
  indent: 'none',
  alignment: 'justify',
  pageTurn: 'none',
});

const normalized = normalizeReaderAppearanceSnapshot({
  ...initial,
  activeTheme: 'missing',
  dayTheme: 'green',
  font: 'import',
  fontSize: Number.NaN,
  pageTurn: 'slide',
});
assert.equal(normalized.activeTheme, 'paper');
assert.equal(normalized.dayTheme, 'green');
assert.equal(normalized.font, 'serif', 'unbundled fonts must fail closed to the Figma Serif slot');
assert.equal(normalized.fontSize, 18);
assert.equal(normalized.pageTurn, 'none', 'non-none page turn must fail closed');

let next = setReaderAppearanceTheme(initial, 'greenNight');
assert.equal(next.activeTheme, 'greenNight');
assert.equal(initial.activeTheme, 'paper', 'pure transitions must not mutate their input');
next = setReaderAppearanceDayTheme(next, 'warm');
next = setReaderAppearanceNightTheme(next, 'night');
next = setReaderAppearanceIndent(next, 'firstLine');
next = setReaderAppearanceAlignment(next, 'start');
next = setReaderAppearanceMetric(next, 'fontSize', 20);
next = setReaderAppearanceMetric(next, 'lineHeightMultiplier', 2.04);
next = setReaderAppearanceMetric(next, 'paragraphSpacing', 18);
next = setReaderAppearanceMetric(next, 'letterSpacing', 0.5);
assert.deepEqual({
  activeTheme: next.activeTheme,
  dayTheme: next.dayTheme,
  nightTheme: next.nightTheme,
  indent: next.indent,
  alignment: next.alignment,
  fontSize: next.fontSize,
  lineHeightMultiplier: next.lineHeightMultiplier,
  paragraphSpacing: next.paragraphSpacing,
  letterSpacing: next.letterSpacing,
}, {
  activeTheme: 'greenNight',
  dayTheme: 'warm',
  nightTheme: 'night',
  indent: 'firstLine',
  alignment: 'start',
  fontSize: 20,
  lineHeightMultiplier: 2.04,
  paragraphSpacing: 18,
  letterSpacing: 0.5,
});
assert.notStrictEqual(copyReaderAppearanceSnapshot(next), next);
assert.throws(() => setReaderAppearanceMetric(next, 'fontSize', 0), /positive finite number/);
assert.throws(() => setReaderAppearanceMetric(next, 'paragraphSpacing', -1), /non-negative finite number/);
assert.throws(() => setReaderAppearanceMetric(next, 'letterSpacing', Number.NaN), /finite number/);

const readingDir = new URL('../entry/src/main/ets/features/reading/', import.meta.url);
const quickPanel = await readFile(new URL('ReaderAppearanceModulePanel.ets', readingDir), 'utf8');
const fullPanel = await readFile(new URL('ReaderAppearanceFullPanel.ets', readingDir), 'utf8');
const gateway = await readFile(new URL('ReaderAppearanceGateway.ts', readingDir), 'utf8');

assert.match(quickPanel, /Figma Reader Quick Appearance content area \(`1505:18040` \/ `1505:18349`\)/);
assert.match(quickPanel, /\.width\(286\)[\s\S]*\.height\(190\)/);
assert.match(quickPanel, /\.position\(\{ x: 11, y: 12 \}\)/);
assert.match(quickPanel, /'day', 'warm', 'night', 'warmNight', 'paper', 'green', 'paperNight', 'greenNight'/);
assert.match(quickPanel, /\.enabled\(fontId === 'serif'\)/);

assert.match(fullPanel, /Figma Reader Full Appearance sheet \/ Phone \(`1505:18040` \/ `1505:18349`\)/);
assert.match(fullPanel, /\.width\(364\)[\s\S]*\.height\(736\)/);
assert.match(fullPanel, /\.width\(338\)[\s\S]*\.height\(666\)/);
assert.match(fullPanel, /\.height\(989\)/);
assert.match(fullPanel, /Text\('主题库'\)/);
assert.match(fullPanel, /Text\('字体库'\)/);
assert.match(fullPanel, /Text\('排版库'\)/);
assert.match(fullPanel, /return '无动画'/);
assert.match(fullPanel, /return kind === 'indent' \|\| kind === 'alignment'/,
  'language conversion and page-turn selectors must remain fail-closed');
assert.match(fullPanel, /\.enabled\(fontId === 'serif'\)/,
  'the active Figma Serif slot must receive input and use the bundled Noto Serif face');

assert.match(gateway, /ReaderRuntimeOwner/);
assert.match(gateway, /getUIAbilityContext\(\)/);
assert.match(gateway, /reader_appearance_v1/);
assert.doesNotMatch(gateway, /\.request\(/,
  'appearance settings must not misuse the fixed Reader Core persistence snapshot');

console.log('reader appearance pure/static contract: PASS');
