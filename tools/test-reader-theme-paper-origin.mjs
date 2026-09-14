import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readerThemeDefinition} from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import {readerAppearanceThemeStyle, readerAppearanceChromeTone} from '../entry/src/main/ets/features/reading/ReaderAppearanceRenderStyle.ts';
import {readerControlAppearanceThemeSwatch} from '../entry/src/main/ets/features/reading/ReaderControlAppearanceStyle.ts';
import {productionMotionMethods} from './lib/reader-motion-method-probe.mjs';

// Keep the independent Make V9 / PH43 baseline as historical source. PH67
// is a user-approved change to four light bases, not a correction to that source.
// These expected values are independent of the live registry and its consumers.
const reference = JSON.parse(readFileSync(new URL('../evidence/2026-09-11-appearance-make-v9/make-v9-reference.json', import.meta.url), 'utf8'));
const historicalBases = {day:'#FCF8F0',warm:'#F4E3BF',night:'#2B2823',warmNight:'#413020',
  paper:'#EBDABB',green:'#D7E8CF',paperNight:'#26313F',greenNight:'#24382C'};
const approvedBases = {day:'#F7F3EA',warm:'#F2E8D3',night:'#2B2823',warmNight:'#413020',
  paper:'#EEE4D0',green:'#E3EBDD',paperNight:'#26313F',greenNight:'#24382C'};
const unchangedInk = {day:'#FF2B241D',warm:'#FF2C241D',night:'#FFE9DECE',warmNight:'#FFE7D8C8',
  paper:'#FF2B241D',green:'#FF263423',paperNight:'#FFE9DECE',greenNight:'#FFD8E2D2'};
assert.deepEqual(Object.fromEntries(reference.themes.map(t=>[t.id,t.swatch])),historicalBases,
  'historical Make source is preserved; do not rewrite it to make PH67 pass');
const source = name => new URL(`../entry/src/main/ets/features/reading/${name}`, import.meta.url);
const Surface = productionMotionMethods(source('ReadingSurface.ets'), ['themeStyle'], {readerAppearanceThemeStyle});
const calls = [];
class ChromeStyle {constructor(underlayColor, tone, contentColor) {Object.assign(this,{underlayColor,tone,contentColor});}}
const Experience = productionMotionMethods(source('LocalReadingExperience.ets'), ['applyWindowChrome'], {
  readerAppearanceThemeStyle, readerAppearanceChromeTone, ReaderWindowChromeStyle: ChromeStyle,
  ReaderWindowCoordinator:{requestAppChrome:()=>calls.push('app'), requestReaderChrome:s=>calls.push(s), requestOverlayChrome:s=>calls.push(s)},
});
for (const expected of reference.themes) {
  const color = '#FF'+approvedBases[expected.id].slice(1);
  const def = readerThemeDefinition(expected.id);
  assert.equal(def.ink,unchangedInk[expected.id]);
  assert.equal(def.statusForeground,unchangedInk[expected.id]);
  assert.equal(def.paperTexture,expected.id==='paper'||expected.id==='paperNight');
  assert.equal(def.sourcePaperLighting,expected.id==='paper');
  assert.equal(readerControlAppearanceThemeSwatch(expected.id),color);
  for(const role of ['paperStart','paperEnd','statusBackground','paperBack','swatch']) assert.equal(def[role],color,`${expected.id} ${role}`);
  const surface = Object.assign(new Surface(),{appearance:{activeTheme:expected.id}});
  assert.equal(surface.themeStyle().paperStart,color); assert.equal(surface.themeStyle().paperEnd,color);
  for(const overlay of [false,true]) {
    const host=Object.assign(new Experience(),{windowChromeActive:true,windowChromeOverlayActive:overlay,appearanceSnapshot:{activeTheme:expected.id}});
    host.applyWindowChrome();
    assert.deepEqual(calls.at(-1),new ChromeStyle(color,def.scheme==='night'?'light':'dark',def.ink));
  }
}
// IDs, ink and existing texture capabilities are retained, not replaced by
// arbitrary colors/effects to make a swatch comparison pass.
assert.equal(readerAppearanceThemeStyle('paper').paperTexture,true);
assert.equal(readerAppearanceThemeStyle('paperNight').paperTexture,true);
assert.equal(readerAppearanceThemeStyle('paperNight').ink,'#FFE9DECE');
console.log('PASS PH67: four approved light bases and four unchanged Make night bases drive preview, ReadingSurface and system chrome; historical PH43 source, ink and effects retained.');
