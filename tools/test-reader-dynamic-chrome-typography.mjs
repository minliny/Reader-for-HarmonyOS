import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { auditTypographyConsumers, typographyRoleImports, isSharedTypographyExpression, typographyProperties } from './lib/reader-typography-consumer-audit.mjs';
import { restoreTypographyMigration } from './lib/reader-typography-migration-fixture.mjs';
import { sharedTypographyReplacement, typographyCarrierMethod } from './lib/reader-typography-shared-replacements.mjs';
import { readerTypographyRoles } from './lib/reader-typography-probe.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { readerControlLerp } from '../entry/src/main/ets/features/reading/ReaderControlActorGeometry.ts';
import { readerControlSettingsLabel } from '../entry/src/main/ets/features/reading/ReaderControlSettingsGeometry.ts';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/design/reader-dynamic-chrome-typography-baseline.json', import.meta.url)));
// The public failure copy changed, not its physical typography. Keep the
// historical baseline and the hash-bound carrier registry byte immutable.
const failureTextSuccessor = {
  path: 'entry/src/main/ets/features/reading/LocalReadingExperience.ets',
  method: 'readingFailureContent', kind: 'Text',
  previousText: 'this.sourceSwitchFailureMessage.length > 0 ? this.sourceSwitchFailureMessage : this.failureCode',
  currentText: 'this.sourceSwitchFailureMessage.length > 0 ? this.sourceSwitchFailureMessage : this.failureHint',
};
function failureContentCarrier(file, expected, source) {
  if (file !== failureTextSuccessor.path || expected.method !== failureTextSuccessor.method ||
    expected.kind !== failureTextSuccessor.kind || expected.text !== failureTextSuccessor.previousText) return undefined;
  const consumers = auditTypographyConsumers(source, file).filter(node =>
    node.method === failureTextSuccessor.method && node.kind === failureTextSuccessor.kind);
  const matches = consumers.filter(node => node.text === failureTextSuccessor.currentText);
  assert.equal(matches.length, 1, 'one exact current failure-copy carrier');
  assert.equal(consumers.filter(node => node.text === failureTextSuccessor.previousText).length, 0,
    'the diagnostic failure field is no longer a public Text carrier');
  const actual = matches[0];
  assert.deepEqual(Object.keys(actual.modifiers).sort(), Object.keys(expected.original).sort(),
    'failure-copy successor preserves every physical attribute and AUTO omission');
  for (const [property, value] of Object.entries(expected.changes)) {
    assert.equal(actual.modifiers[property]?.expression, value, 'failure-copy successor keeps the exact font tuple');
    assert.deepEqual(actual.modifiers[property]?.extra, expected.extra[property]);
  }
  return actual;
}
const sites = [];
let failureTextSuccessorCount = 0;
for (const file of fixture.files) {
  const source = readFileSync(new URL(`../${file.path}`, import.meta.url), 'utf8');
  if (process.argv.includes('--verify-migration-source')) restoreTypographyMigration(source, file);
  const imports = typographyRoleImports(source, file.path), used = new Set();
  for (const expected of file.nodes) {
    const failureReplacement = failureContentCarrier(file.path, expected, source);
    if (failureReplacement) failureTextSuccessorCount++;
    const replacement = failureReplacement ?? sharedTypographyReplacement(file.path, expected, source);
    const producerImports = replacement?.producerPath ? typographyRoleImports(readFileSync(new URL('../' + replacement.producerPath, import.meta.url), 'utf8'), replacement.producerPath) : imports;
    const actual = replacement ?? auditTypographyConsumers(source, file.path).find(node => !used.has(node) && node.method === typographyCarrierMethod(file.path, expected, source) && node.kind === expected.kind && node.text === expected.text &&
      Object.entries(expected.changes).every(([property,value]) => node.modifiers[property]?.expression === value));
    assert.ok(actual); used.add(actual);
    assert.deepEqual(Object.keys(actual.modifiers).sort(), Object.keys(expected.original).sort(), 'AUTO/inherited modifiers stay omitted');
    for (const [property, modifier] of Object.entries(actual.modifiers)) {
      assert.deepEqual(modifier.extra, expected.extra[property], 'native variable-font options remain intact');
      for (const role of modifier.expression.matchAll(/TYPE_\w+/g)) {
        assert.ok(producerImports.has(role[0])); assert.ok(readerTypographyRoles[role[0]], `${role[0]} is an actual public export`);
      }
      assert.ok(isSharedTypographyExpression(modifier.expression) ||
        file.path.endsWith('ReaderControlSettingsContent.ets') && actual.method === 'segmentRow' && property === 'lineHeight' && modifier.expression === 'this.label(row).height',
      'only the existing spatial actor projects its physical line-box height');
    }
    sites.push({ ...expected, file: file.path, methodName: `site${sites.length}` });
  }
}
assert.equal(failureTextSuccessorCount, 1, 'only the exact historical failure-detail node has a content successor');
const failureFile = fixture.files.find(file => file.path === failureTextSuccessor.path);
const failureExpected = failureFile.nodes.find(node => node.method === failureTextSuccessor.method &&
  node.kind === failureTextSuccessor.kind && node.text === failureTextSuccessor.previousText);
const failureSource = readFileSync(new URL(`../${failureFile.path}`, import.meta.url), 'utf8');
const failureCarrier = failureContentCarrier(failureFile.path, failureExpected, failureSource);
assert.throws(() => failureContentCarrier(failureFile.path, failureExpected,
  failureSource.replace(failureTextSuccessor.currentText, failureTextSuccessor.previousText)),
/one exact current failure-copy carrier/, 'returning to the diagnostic field must fail');
const failureSize = failureCarrier.modifiers.fontSize;
assert.throws(() => failureContentCarrier(failureFile.path, failureExpected,
  failureSource.slice(0, failureSize.start) + failureSize.expression + ' + 1' + failureSource.slice(failureSize.end)),
/exact font tuple/, 'content succession cannot change the actual font size');
const failureCall = `Text(${failureTextSuccessor.currentText})`;
assert.throws(() => failureContentCarrier(failureFile.path, failureExpected,
  failureSource.replace(failureCall, `${failureCall}.fontSize(${failureSize.expression});\n${failureCall}`)),
/one exact current failure-copy carrier/, 'duplicate current carriers cannot satisfy a single historical occurrence');
assert.equal(sites.length, 26); assert.equal(sites.filter(site => site.kind === 'Span').length, 9);
const makeSource = original => `@Component struct DynamicTypographyProbe {\n${sites.map(site => `@Builder private ${site.methodName}(kind: string, selected: boolean, delta: number, choice: Choice, value: string, group: string, option: string, row: number) {\n${site.kind === 'Span' ? "Span('snippet')" : "Text('consumer')"}\n${typographyProperties.filter(property => Object.hasOwn(site.original, property)).map(property =>
  `.${property}(${(original ? site.original : site.changes)[property]}${site.extra[property].length ? ', '+site.extra[property].join(', ') : ''})`).join('\n')}\n}`).join('\n')}\nbuild() { Column() {} }\n}`;
const names = sites.map(site => site.methodName), dependencies = { readerControlLerp, FontWeight: { Regular: 400, Medium: 500, Bold: 700 } };
const Before = createReaderBuilderProbe(makeSource(true), names, dependencies).Component;
const After = createReaderBuilderProbe(makeSource(false), names, dependencies).Component;
const tuple = owner => Object.fromEntries(typographyProperties.filter(property => Object.hasOwn([...owner.nodes.values()][0],property)).map(property => [property,[...owner.nodes.values()][0][property]]));
let cases = 0;
// Exhaust each categorical branch with every existing p sample, including the
// actual Settings spatial line box. Preview/font installation belongs to the
// registrar tests; no user runtime face is replaced by this finite-role batch.
for (const p of [0,.25,.5,.75,1,.5,0]) for (const category of [0,1,2,3]) {
  const ownerState = { p: () => p, isTablet: !!(category & 1), headerInter: () => !!(category & 1),
    manager: !!(category & 1), voicePicker: !!(category & 2), selectedId: category & 1 ? 'selected' : 'other',
    indentOptionActive: () => !!(category & 1), isActive: () => !!(category & 1),
    frame: () => ({ nameSize: 12 }), label: row => readerControlSettingsLabel(row,p), selectedSize: 17, neighbourSize: 11 };
  const args = [category === 0 ? 'speed' : category === 1 ? 'playback' : 'timer', !!(category & 1), category === 0 ? 0 : category === 1 ? -1 : 1,
    { id: 'selected' }, 'firstLine', 'direction', '当前', category % 3];
  for (const site of sites) {
    const before = Object.assign(new Before(undefined), ownerState), after = Object.assign(new After(undefined), ownerState);
    before[site.methodName](...args); after[site.methodName](...args);
    assert.equal(before.nodes.size,1); assert.equal(after.nodes.size,1);
    assert.deepEqual(tuple(after),tuple(before),`${site.file}/${site.method}: actual SDK native tuple for p=${p}, branch=${category}`); cases++;
  }
}
// Alter one shared wheel role: both compatibility and retained consumers must
// follow their own aliases/contracts, with no change to unrelated state styles.
const role = 'TYPE_READER_SNIPPET_NOTO_REGULAR';
const Mutated = createReaderBuilderProbe(makeSource(false), names, { ...dependencies,
  [role]: { ...readerTypographyRoles[role], fontWeight: 500 } }).Component;
let affected=0,unaffected=0;
for (const site of sites) {
  const state = { p:()=>.5, isTablet:false, headerInter:()=>false, manager:false, voicePicker:false,selectedId:'other',
    indentOptionActive:()=>false,isActive:()=>false,label:row=>readerControlSettingsLabel(row,.5) };
  const a=Object.assign(new After(undefined),state),b=Object.assign(new Mutated(undefined),state);
  const args=['speed',false,1,{id:'selected'},'firstLine','direction','当前',0];
  a[site.methodName](...args);b[site.methodName](...args);
  if (Object.values(site.changes).some(expression => expression.includes(`${role}.`))) {affected++;assert.equal(tuple(b).fontWeight,500);}
  else {unaffected++;assert.deepEqual(tuple(b),tuple(a));}
}
assert.equal(affected,4);assert.equal(unaffected,22);
for (const expression of ['readerControlLerp(TYPE_A.fontSizeFp, TYPE_B.fontSizeFp, this.p())',
  'Math.round(readerControlLerp(TYPE_A.fontWeight, TYPE_B.fontWeight, this.p()))']) assert.equal(isSharedTypographyExpression(expression),true);
for (const expression of ['readerControlLerp(TYPE_A.fontSizeFp, 10, this.p())',
  'readerControlLerp(TYPE_A.fontSizeFp, TYPE_B.fontWeight, this.p())', 'readerControlLerp(TYPE_A.fontSizeFp, TYPE_B.fontSizeFp, this.p()+.1)',
  'TYPE_A.fontSizeFp + 2', 'Math.round(TYPE_A.fontWeight + 2)']) assert.equal(isSharedTypographyExpression(expression),false);
console.log(`PASS dynamic reader Typography: ${sites.length} carriers, ${cases} actual SDK native tuple cases, four real inline consumers propagate; AUTO/morph branches retained; source hash proof is explicit --verify-migration-source`);
