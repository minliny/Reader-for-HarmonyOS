import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
const read = p => readFileSync(new URL(`../entry/src/main/ets/${p}.ets`, import.meta.url), 'utf8');
const style = { fontFamily: 'ReaderInter', fontWeight: 400, fontSizeFp: 14, lineHeightFp: 20 };
for (const name of ['fixedLineHeightField', 'autoLineHeightField']) {
  const { owner } = createReaderBuilderProbe(read('features/common/ReaderSearchField'), [name], {
    TYPE_SEARCH_BOOK_INPUT: style,
  });
  Object.assign(owner, { appThemeScheme: 'day', text: '', placeholder: '搜索', clearable: false,
    iconGap: () => 5, searchIcon: () => 'search', iconSize: () => 16, inputHeight: () => 36,
    textStyle: () => style, inputColor: () => 'ink', caretColor: () => 'ink', placeholderColor: () => 'muted',
    fieldHeight: () => 44, horizontalPadding: () => 12, fieldBackgroundColor: () => 'surface',
    fieldBorderWidth: () => 1, fieldBorderColor: () => 'border', cornerRadius: () => 999,
    resolvedAccessibilityLabel: () => '搜索',
  });
  owner[name]();
  const nodes = [...owner.nodes.values()];
  assert.equal(nodes.find(n => n.type === 'TextInput').borderRadius, 0,
    'native start caret cannot be clipped by an inherited TextInput round rect');
  assert.equal(nodes.find(n => n.type === 'Row').borderRadius, 999,
    'outer authored search field retains its shape');
}
const { owner } = createReaderBuilderProbe(read('app/ArkWebExecutionHost'), ['build','surfacesForRender']);
Object.assign(owner, { interactive: false, appThemeScheme: 'day', surfaceId: 1, currentSurface: { id: 1, controller: {} } });
owner.initialRender();
const web = [...owner.nodes.values()].find(n => n.type === 'Web');
assert.ok(web);
assert.equal(web.focusable, false); assert.equal(web.focusOnTouch, false);
owner.interactive = true; owner.replay();
assert.equal(web.focusable, true); assert.equal(web.focusOnTouch, true,
  'visible source login/captcha remains keyboard-capable');
owner.interactive = false; owner.replay();
assert.equal(web.focusable, false); assert.equal(web.focusOnTouch, false);
console.log('PH81/82/90 SDK input clip and hidden Web focus isolation PASS; native caret pixels checked separately');
