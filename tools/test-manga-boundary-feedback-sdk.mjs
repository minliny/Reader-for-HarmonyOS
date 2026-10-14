import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { readerTypographyRoles } from './lib/reader-typography-probe.mjs';

const source = readFileSync(new URL('../entry/src/main/ets/features/manga/MangaBoundaryTurnFeedback.ets', import.meta.url), 'utf8');
const require = createRequire(import.meta.url);
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts = require(`${sdk}/node_modules/typescript`);
const tree = ts.createSourceFile('/tmp/MangaBoundaryFeedback.ets', source, ts.ScriptTarget.Latest, true,
  ts.ScriptKind.ETS, require(`${sdk}/lib/ets_checker.js`).compilerOptions);
assert.equal(tree.parseDiagnostics.length, 0);
const actor = tree.statements.find(node => node.name?.getText(tree) === 'MangaBoundaryTurnFeedback');
assert.ok(actor);
const names = actor.members.map(node => node.name?.getText(tree)).filter(Boolean);
const role = readerTypographyRoles.TYPE_SOURCE_SWITCH_NOVEL_ACTION;
const captions = ['上拉进入下一章节', '松手进入下一章节', '正在进入下一章节…'];
const outcomes = [];
for (const [scheme, palette] of Object.entries({
  day: { paperColor: '#F8F4EC', inkColor: '#1F1B17', mutedColor: '#777777' },
  night: { paperColor: '#1C1E1A', inkColor: '#EAE7DE', mutedColor: '#999999' },
})) {
  const properties = createArkUIPropertyRuntimeProbe();
  const { owner } = createReaderBuilderProbe(source, names, properties.sdk, properties.hooks);
  owner.updateStateVars({ ...palette, caption: captions[0] });
  owner.initialRender();
  const nodes = [...owner.nodes.values()], row = nodes.find(node => node.type === 'Row');
  const texts = nodes.filter(node => node.type === 'Text');
  assert.deepEqual(nodes.map(node => node.type), ['Row', 'Text', 'Text'], 'footer has only a direction and one-line copy; no card, button or progress actor');
  assert.equal(texts[0].create, '↑');
  assert.equal(texts[0].fontColor, palette.mutedColor);
  assert.equal(texts[1].fontColor, palette.inkColor);
  for (const text of texts) {
    assert.equal(text.fontFamily, role.fontFamily);
    assert.equal(text.fontWeight, role.fontWeight);
    assert.equal(text.fontSize, role.fontSizeFp);
    assert.equal(text.lineHeight, role.lineHeightFp);
    assert.equal(text.maxLines, 1);
    assert.equal(text.onClick, undefined);
  }
  assert.equal(row.width, '100%'); assert.equal(row.height, 48);
  assert.equal(row.backgroundColor, palette.paperColor);
  assert.equal(row.hitTestBehavior, 'HitTestMode.None');
  assert.equal(row.borderRadius, undefined, 'flat footer must not become a floating card');
  assert.deepEqual(row.padding, { left: 18, right: 18 });
  const identities = nodes.map(node => node.id);
  for (const caption of captions) {
    owner.updateStateVars({ caption }); properties.flush();
    assert.equal(texts[1].create, caption, 'actual SDK caption observer reflects pull, release and preparation copy');
    assert.deepEqual([...owner.nodes.values()].map(node => node.id), identities, 'copy changes retain the finite footer actors');
  }
  const updated = { paperColor: '#202020', inkColor: '#eeeeee', mutedColor: '#aaaaaa' };
  owner.updateStateVars(updated); properties.flush();
  assert.equal(row.backgroundColor, updated.paperColor);
  assert.equal(texts[0].fontColor, updated.mutedColor); assert.equal(texts[1].fontColor, updated.inkColor);
  outcomes.push(`${scheme}: SDK footer retains its two public-role Text actors through release/preparation copy and live theme changes`);
}
console.log(JSON.stringify({ outcomes,
  boundary: 'Actual official SDK component emission and property runtime; footer structure/copy/theme only. Parent release threshold, native gestures, chapter readiness, HAP and user acceptance are separate checks.' }, null, 2));
