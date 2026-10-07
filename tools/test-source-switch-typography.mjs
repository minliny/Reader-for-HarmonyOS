import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadReaderTypographyRoles } from './lib/reader-typography-probe.mjs';
import * as fontFamilies from '../entry/src/main/ets/features/common/ReaderFontFamilies.ts';
import {auditTypographyConsumers} from './lib/reader-typography-consumer-audit.mjs';

const read = relative => readFileSync(new URL(`../entry/src/main/ets/${relative}`, import.meta.url), 'utf8');
const typographySource = read('features/common/ReaderTypography.ets');
// Expected tuples come from the selected design source, never extracted from
// the native roles being assessed. The generator separately binds its bytes.
const design = JSON.parse(readFileSync(new URL('../../Reader-UI/design/source-switch/source-switch.visual.json', import.meta.url)));
const roleKeys = {
  HEADING: 'title', BOOK_TITLE: 'bookTitle', METADATA: 'author', CAPTION: 'metadata',
  COLUMN: 'column', ACTION: 'discoveryAction', ACTION_COMPACT: 'discoveryAction',
  CURRENT_SOURCE: 'currentSource', DISCOVERY_COUNT: 'discoveryCount', DISCOVERY_PHASE: 'discoveryPhase', DISCOVERY_STATUS: 'discoveryStatus',
  DISCOVERY_STATUS_NARROW: 'narrowDiscoveryStatus', NAME: 'sourceName', CHAPTER: 'latestChapter',
  LATENCY: 'timing', LATENCY_UNIT: 'timingUnit', FOOTER: 'footer', EMPTY: 'empty',
  SWITCH_TITLE: 'switchTitle', SWITCH_SOURCE: 'switchSource', SWITCH_STATUS: 'switchStep', SWITCH_CAPTION: 'switchCaption', TOAST: 'toast',
};
const novelTuples = Object.entries(roleKeys).map(([name, key]) => {
  const weight = design.numbers[key + 'FontWeight'] ?? design.numbers.discoveryStatusFontWeight;
  const cssFamily = name === 'HEADING' || name === 'BOOK_TITLE' || name === 'SWITCH_TITLE' ? design.strings.titleFontFamilyCss :
    name.startsWith('LATENCY') || name === 'DISCOVERY_COUNT' ? design.strings.timingFontFamilyCss : design.strings.bodyFontFamilyCss;
  const asset = design.fontAssets.find(font => font.cssFamily === cssFamily &&
    (font.weight === weight || (name === 'DISCOVERY_COUNT' && font.supportedWeights?.includes(weight))));
  assert.ok(asset, 'selected physical face for ' + name);
  if(name==='DISCOVERY_COUNT')assert.deepEqual(asset.supportedWeights,[400,500],'only the approved Inter axes share this physical font');
  return [name, fontFamilies[asset.nativeFamilyConstant], weight,
    name==='ACTION_COMPACT'?design.numbers.compactDiscoveryActionFontSize:design.numbers[key + 'FontSize'], design.numbers[key + 'LineHeight']];
});
const novelRoles = novelTuples.map(([name]) => 'TYPE_SOURCE_SWITCH_NOVEL_' + name);
const roles = loadReaderTypographyRoles(typographySource);
const { TYPE_SOURCE_SWITCH_NAME, TYPE_SOURCE_SWITCH_LATENCY, TYPE_SOURCE_SWITCH_CHAPTER } = roles;
const row = read('features/source/CandidateRow.ets');

assert.deepEqual(
  [TYPE_SOURCE_SWITCH_NAME, TYPE_SOURCE_SWITCH_LATENCY, TYPE_SOURCE_SWITCH_CHAPTER].map(style => ({
    fontFamily: style.fontFamily,
    fontWeight: style.fontWeight,
    fontSizeFp: style.fontSizeFp,
    lineHeightFp: style.lineHeightFp,
  })),
  [
    { fontFamily: 'ReaderInter', fontWeight: 500, fontSizeFp: 10, lineHeightFp: 12 },
    { fontFamily: 'ReaderInter', fontWeight: 400, fontSizeFp: 9, lineHeightFp: 10 },
    { fontFamily: 'ReaderInter', fontWeight: 500, fontSizeFp: 9, lineHeightFp: 10 },
  ],
  'source-switch roles preserve the existing compact text tuples',
);

for (const role of ['TYPE_SOURCE_SWITCH_NAME', 'TYPE_SOURCE_SWITCH_LATENCY', 'TYPE_SOURCE_SWITCH_CHAPTER']) {
  assert.match(row, new RegExp(`${role}\\.fontFamily`));
  assert.match(row, new RegExp(`${role}\\.fontWeight`));
  assert.match(row, new RegExp(`${role}\\.fontSizeFp`));
  assert.match(row, new RegExp(`${role}\\.lineHeightFp`));
}
assert.doesNotMatch(row, /fontFamily\('ReaderInter'\)/,
  'CandidateRow no longer owns a physical font family literal');
assert.doesNotMatch(row, /fontSize\((?:9|10)\)\.lineHeight\((?:10|12)\)/,
  'CandidateRow no longer owns the compact text tuple inline');

for (const [name, fontFamily, fontWeight, fontSizeFp, lineHeightFp] of novelTuples) {
  assert.deepEqual({ ...roles['TYPE_SOURCE_SWITCH_NOVEL_' + name] }, {
    fontFamily, fontWeight, fontSizeFp, lineHeightFp, letterSpacingFp: undefined,
    scalePolicy: 'system', source: 'appBaseline',
  }, 'selected novel ' + name + ' retains the demo tuple with an explicit physical weight');
}
assert.equal(fontFamilies.READER_FONT_NOTO_SANS_SC_UI_MEDIUM, 'ReaderNotoSansSCUIMedium');
const fonts = read('features/common/ReaderFonts.ets');
for (const [family, asset] of [
  ['READER_FONT_NOTO_SANS_SC_UI_REGULAR', 'NotoSansSC-UIRegular.otf'],
  ['READER_FONT_NOTO_SANS_SC_UI_MEDIUM', 'NotoSansSC-UIMedium.otf'],
]) {
  assert.ok(fonts.includes(`if (family === ${family}) return $rawfile('${asset}');`), 'the existing static UI asset is the actual registered family');
}
for (const [path, names] of [
  ['features/source/SourceSwitchWindow.ets', novelRoles.filter(role => !role.includes('_NOVEL_SWITCH_') && !role.endsWith('_TOAST'))],
  ['features/source/SourceSwitchProgress.ets', ['SWITCH_TITLE', 'SWITCH_SOURCE', 'SWITCH_STATUS', 'SWITCH_CAPTION'].map(name => 'TYPE_SOURCE_SWITCH_NOVEL_' + name)],
  ['features/source/SourceSwitchCompletionOverlay.ets', ['TYPE_SOURCE_SWITCH_NOVEL_TOAST']],
]) {
  const source = read(path);
  const carriers = auditTypographyConsumers(source,'entry/src/main/ets/'+path);
  for (const name of names) {
    if (name.endsWith('_NARROW')) {
      assert.ok(source.includes(`${name}.fontSizeFp`) && source.includes(`${name}.lineHeightFp`), 'narrow discovery consumes the selected smaller line box');
    } else {
      const action = name === 'TYPE_SOURCE_SWITCH_NOVEL_ACTION' || name === 'TYPE_SOURCE_SWITCH_NOVEL_ACTION_COMPACT';
      const weight = action ? 'this.compactDiscoveryAction() ? TYPE_SOURCE_SWITCH_NOVEL_ACTION_COMPACT.fontWeight : TYPE_SOURCE_SWITCH_NOVEL_ACTION.fontWeight' : `${name}.fontWeight`;
      const line = action ? 'this.compactDiscoveryAction() ? TYPE_SOURCE_SWITCH_NOVEL_ACTION_COMPACT.lineHeightFp : TYPE_SOURCE_SWITCH_NOVEL_ACTION.lineHeightFp' : `${name}.lineHeightFp`;
      assert.ok(carriers.some(node => node.modifiers.fontWeight?.expression === weight), 'actual novel text consumes explicit weight: ' + name);
      if(name==='TYPE_SOURCE_SWITCH_NOVEL_DISCOVERY_STATUS') {
        const narrowLine='this.narrowWindow() ? TYPE_SOURCE_SWITCH_NOVEL_DISCOVERY_STATUS_NARROW.lineHeightFp : TYPE_SOURCE_SWITCH_NOVEL_DISCOVERY_STATUS.lineHeightFp';
        assert.ok(carriers.some(node=>node.modifiers.lineHeight?.expression===narrowLine),'actual discovery label consumes the explicit normal/narrow line boxes');
      } else assert.ok(carriers.some(node => node.modifiers.lineHeight?.expression === line), 'actual novel text consumes the CSS line box: ' + name);
      if(name==='TYPE_SOURCE_SWITCH_NOVEL_DISCOVERY_COUNT'){
        const count=carriers.filter(node=>node.modifiers.fontWeight?.expression===weight);
        assert.equal(count.length,1);assert.deepEqual(count[0].modifiers.fontWeight.extra,['{ enableVariableFontWeight: true }'],'only count opts into the existing Inter variable axis');
      }
    }
  }
}

console.log('PASS source-switch typography: historical compact tuples retained; 23 bounded novel roles match independent selected design sizes, physical weights and line boxes; actual SDK AST checks direct/finite action roles and the sole count variable axis');
