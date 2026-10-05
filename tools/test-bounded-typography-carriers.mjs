import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedTypographyReplacement, typographyCarrierMethod } from './lib/reader-typography-shared-replacements.mjs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const baseline = JSON.parse(read('tools/fixtures/design/conventional-typography-baseline.json'));
const registry = JSON.parse(read('tools/fixtures/design/typography-carrier-successors.json'));
const entries = registry.entries.filter(entry => entry.kind === 'bounded' && /SourceSwitchWindow|LocalImportDialog/.test(entry.origin.path));
assert.equal(entries.length, 6, 'bounded existing Source and import title/action carriers');
for (const entry of entries) {
  const file = baseline.files.find(file => file.path === entry.origin.path);
  const expected = file.nodes.find(node => node.method === entry.origin.method && node.kind === entry.origin.kind && node.text === entry.origin.text);
  assert.ok(expected);
  const page = read(file.path), target = read(entry.target.path);
  const actual = sharedTypographyReplacement(file.path, expected, page);
  assert.equal(actual.producerPath, entry.target.path);
  assert.match(actual.producerProof, /mounted shared SDK child/);
  assert.throws(() => sharedTypographyReplacement(file.path, expected, page.replaceAll(entry.component + '({', 'ReaderWrongSurface({')), /real finite binding/);
  assert.throws(() => sharedTypographyReplacement(file.path, expected, page.replaceAll(`specId: '${entry.specId}'`, "specId: 'unrelated-variant'")), /real finite binding/);
  const role = expected.changes.fontSize.match(/^(TYPE_\w+)\.fontSizeFp$/)[1];
  const badImport = target.replace(role + ',', 'TYPE_UNRELATED_ROLE,').replace(role + ' }', 'TYPE_UNRELATED_ROLE }');
  assert.notEqual(badImport, target);
  assert.throws(() => sharedTypographyReplacement(file.path, expected, page, badImport), /producer imports/);
  if (entry.id === 'source-switch-shared-heading') {
    const literal = target.replace('.fontSize(type.fontSizeFp)', '.fontSize(11)');
    assert.notEqual(literal, target);
    assert.throws(() => sharedTypographyReplacement(file.path, expected, page, literal), /actively consumes/, 'unchanged native values with a private literal still fail shared role propagation');
    assert.throws(() => sharedTypographyReplacement(file.path, expected, page, target.replace('.lineHeight(TYPE_SOURCE_SWITCH_HEADING.lineHeightFp as number)', '.lineHeight(13)')), /immutable original tuple/);
  } else {
    const noSpacing = target.replace(`.letterSpacing(${role}.letterSpacingFp as number)`, '');
    if (noSpacing !== target) assert.throws(() => sharedTypographyReplacement(file.path, expected, page, noSpacing), /AUTO omissions/);
  }
  for (const [origin, targetMethod] of entry.methodEdges ?? []) {
    assert.throws(() => sharedTypographyReplacement(file.path, expected, page.replace(`this.${targetMethod}();`, `/* this.${targetMethod}(); */`)), /actual AST call/);
  }
}
const file = baseline.files.find(file => file.path.endsWith('/LocalImportDialog.ets'));
for (const node of file.nodes.filter(node => node.method === 'fileSelectionPanel' && [1, 2, 3].includes(node.index))) {
  assert.equal(typographyCarrierMethod(file.path, node, read(file.path)), 'fileSelectionBody');
}
console.log('bounded typography carriers PASS: six original contracts prove actual owners→shared SDK native Text, exact tuple/AUTO and active public roles; three exact same-file body successors; missing imports/finite bindings/comment edges/private literals/drift reject');
