import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
async function mapping() {
 const palette = {
  day: ['FAF7F1', 'F7F3EA', '2B241D', '766C61'],
  warm: ['F5E7CE', 'F2E8D3', '2C241D', '766C61'],
  paper: ['EAE0CA', 'EDE2CB', '2B241D', '766C61'],
  green: ['DCE7D6', 'E3EBDD', '263423', '63755F'],
  night: ['201F1C', '21221F', 'E4DDD0', '9D968B'],
  warmNight: ['2A231B', '31271D', 'E7D8C8', 'B3A18F'],
  paperNight: ['22262E', '202630', 'E2DDD5', '9BA5B2'],
  greenNight: ['1F2C22', '1D2D23', 'D8E2D2', '97AA9A'],
 };
 const {readerThemeDefinition}=await import('../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts');
 const {readerAppearanceThemeStyle,readerAppearanceChromeTone}=await import('../entry/src/main/ets/features/reading/ui/ReaderAppearanceRenderStyle.ts');
 const {readerControlAppearanceThemeSwatch}=await import('../entry/src/main/ets/features/reading/ui/ReaderControlAppearanceStyle.ts');
 const {productionMotionMethods}=await import('./lib/reader-motion-method-probe.mjs');
 const source=name=>new URL(`../entry/src/main/ets/features/reading/ui/${name}`,import.meta.url);
 const Surface=productionMotionMethods(source('ReadingSurface.ets'),['themeStyle'],{readerAppearanceThemeStyle});
 const calls=[];class ChromeStyle {constructor(underlayColor,tone,contentColor){Object.assign(this,{underlayColor,tone,contentColor});}}
 const Experience=productionMotionMethods(source('LocalReadingExperience.ets'),['applyWindowChrome'],{readerAppearanceThemeStyle,readerAppearanceChromeTone,ReaderWindowChromeStyle:ChromeStyle,
  ReaderWindowCoordinator:{requestAppChrome:()=>calls.push('app'),requestReaderChrome:s=>calls.push(s),requestOverlayChrome:s=>calls.push(s)}});
 for(const [id, [swatch, background, ink, meta]] of Object.entries(palette)) {
  const def=readerThemeDefinition(id),color='#FF'+background;
  for(const role of ['paperStart','paperEnd','statusBackground','paperBack'])assert.equal(def[role],color,id+' '+role);
  assert.equal(def.ink, '#FF'+ink, id+' ink');
  assert.equal(def.chromeMeta, '#FF'+meta, id+' meta');
  assert.equal(readerControlAppearanceThemeSwatch(id),'#FF'+swatch);
  const surface=Object.assign(new Surface(),{appearance:{activeTheme:id}});assert.equal(surface.themeStyle().paperStart,color);assert.equal(surface.themeStyle().paperEnd,color);
  for(const overlay of [false,true]){const host=Object.assign(new Experience(),{windowChromeActive:true,windowChromeOverlayActive:overlay,appearanceSnapshot:{activeTheme:id}});host.applyWindowChrome();assert.deepEqual(calls.at(-1),new ChromeStyle(color,def.scheme==='night'?'light':'dark',def.ink));}
  assert.equal(def.paperTexture,id==='paper'||id==='paperNight');assert.equal(def.sourcePaperLighting,id==='paper');
 }
}
async function documentedPalette() {
 // A specification record is independent of the registry being tested. This
 // does not supply the missing original PH67-applied/user approval evidence.
 const spec=readFileSync(new URL('../docs/READER_REPAIR_SPEC.md',import.meta.url),'utf8');
 const record=spec.split('\n').find(line=>line.includes('**PH67 已批准基色**'));
 assert.ok(record,'the documented optional palette must have a current normative record');
 const colors=Object.fromEntries([...record.matchAll(/\b(day|warm|paper|green)\s+(#[0-9A-Fa-f]{6})/g)].map(([,id,color])=>[id,color.toUpperCase()]));
 assert.deepEqual(Object.keys(colors),['day','warm','paper','green']);
 const {readerThemeDefinition}=await import('../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts');
 for(const[id,color]of Object.entries(colors))for(const role of ['paperStart','paperEnd','swatch','statusBackground','paperBack'])assert.equal(readerThemeDefinition(id)[role],'#FF'+color.slice(1),id+' '+role);
 console.log(JSON.stringify({evidence:'specification-record-only',source:'docs/READER_REPAIR_SPEC.md:PH67 已批准基色',scope:'four light palettes/five background roles',unresolved:'Referenced PH67-applied.md and original approval are not supplied; no new user acceptance claimed'}));
}
const cases={mapping,'documented-palette':documentedPalette};
for(const id of selectContractCases({mapping:'Current preview/body/system chrome mapping consistency','documented-palette':'Optional four-light palette against the explicit PH67 specification record; original approval unresolved'})){await cases[id]();recordContractCasePass(id);}
