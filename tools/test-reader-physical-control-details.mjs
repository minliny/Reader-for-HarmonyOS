import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { readerAppColor } from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
const read = name => readFileSync(new URL(`../entry/src/main/ets/features/reading/${name}.ets`, import.meta.url), 'utf8');
const capsule = read('ReaderSessionCapsule');
for (const type of ['autoPage', 'tts']) {
  const { owner } = createReaderBuilderProbe(capsule, ['build'], {
    TYPE_READER_SESSION_COUNTDOWN: {}, TYPE_READER_SESSION_LABEL: {}, readerSessionCapsuleMinimumWidth: () => 96,
  });
  Object.assign(owner, { type, countdown: 8, capsuleWidth: 96, primaryColor: 'primary', onPrimaryColor: 'onPrimary' });
  owner.initialRender();
  const nodes = [...owner.nodes.values()];
  const row = nodes.find(n => n.type === 'Row');
  assert.equal(row.height, 24);
  assert.equal(row.alignItems, 'VerticalAlign.Center');
  const actor = nodes.find(n => n.type === 'Stack');
  assert.equal(actor.width, 16); assert.equal(actor.height, 16);
  const label = nodes.find(n => n.type === 'Text' && n.create === (type === 'autoPage' ? '自动翻页' : '朗读'));
  assert.equal(label.height, 16, 'label and leading actor share the centre lane');
  if (type === 'autoPage') {
    const digit = nodes.find(n => n.type === 'Text' && n.create === '8');
    assert.equal(digit.width, 16); assert.equal(digit.height, 16);
    assert.equal(digit.textAlign, 'TextAlign.Center');
    assert.equal(actor.borderRadius, 999, 'equal width and height produce a circle');
  }
}
for (const scheme of ['day', 'night']) for (const size of [24, 32]) {
  const { owner } = createReaderBuilderProbe(read('ReaderControlSearchContent'), ['searchField', 'searchAction'], {});
  Object.assign(owner, { appThemeScheme: scheme, query: '鸣龙', frame: () => ({
    field: { width: 240, height: size, x: 10, y: 9 }, action: { width: size, height: size, x: 260, y: 9 },
  }), presentation: () => ({ contentOpacity: 1, contentBlur: 0 }), canSearch: () => true });
  owner.searchField();
  assert.equal([...owner.nodes.values()].filter(n => n.type === 'Image').length, 0, 'input has no redundant search icon');
  assert.equal([...owner.nodes.values()].filter(n => n.type === 'TextInput').length, 1);
  owner.searchAction();
  const icons = [...owner.nodes.values()].filter(n => n.type === 'Image');
  assert.equal(icons.length, 1);
  assert.equal(icons[0].create, `app.media.reader_directory_search${scheme === 'night' ? '_theme_night' : ''}`);
  const action = [...owner.nodes.values()].find(n => n.accessibilityText === '搜索正文');
  assert.equal(action.width, size); assert.equal(action.height, size);
  assert.equal(action.border.color, readerAppColor('TOK_LINE', scheme));
  assert.equal(action.backgroundColor, readerAppColor('TOK_SURFACE_PANEL_SOFT', scheme));
}
console.log('PH89/91 actual SDK Builders: circular countdown/centred leading lane and one themed search action in both forms PASS; native text raster still requires VM inspection');
