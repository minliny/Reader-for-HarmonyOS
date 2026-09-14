import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readerThemeDefinition} from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
import {readerAppearanceThemeStyle, readerAppearanceChromeTone} from '../entry/src/main/ets/features/reading/ReaderAppearanceRenderStyle.ts';
import {readerControlAppearanceThemeSwatch} from '../entry/src/main/ets/features/reading/ReaderControlAppearanceStyle.ts';
import {productionMotionMethods} from './lib/reader-motion-method-probe.mjs';

// This independent pre-repair design capture is the expected value. Comparing
// two consumers of the same wrong registry would repeat PH31's false pass.
const reference = JSON.parse(readFileSync(new URL('../evidence/2026-09-11-appearance-make-v9/make-v9-reference.json', import.meta.url), 'utf8'));
const source = name => new URL(`../entry/src/main/ets/features/reading/${name}`, import.meta.url);
const Surface = productionMotionMethods(source('ReadingSurface.ets'), ['themeStyle'], {readerAppearanceThemeStyle});
const calls = [];
class ChromeStyle {constructor(underlayColor, tone, contentColor) {Object.assign(this,{underlayColor,tone,contentColor});}}
const Experience = productionMotionMethods(source('LocalReadingExperience.ets'), ['applyWindowChrome'], {
  readerAppearanceThemeStyle, readerAppearanceChromeTone, ReaderWindowChromeStyle: ChromeStyle,
  ReaderWindowCoordinator:{requestAppChrome:()=>calls.push('app'), requestReaderChrome:s=>calls.push(s), requestOverlayChrome:s=>calls.push(s)},
});
for (const expected of reference.themes) {
  const color = '#FF'+expected.swatch.slice(1);
  const def = readerThemeDefinition(expected.id);
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
console.log('PASS PH43: eight original Make bases drive preview, production ReadingSurface and reader/overlay system chrome; IDs/ink/texture retained.');
