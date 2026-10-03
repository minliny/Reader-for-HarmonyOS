import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { auditTypographyConsumers, typographyProperties } from './lib/reader-typography-consumer-audit.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { readerTypographyRoles } from './lib/reader-typography-probe.mjs';

const baseline = JSON.parse(readFileSync(new URL('./fixtures/design/conventional-typography-baseline.json', import.meta.url)));
const carriers = { Text: "Text('consumer')", Span: "Span('consumer')", Button: "Button('consumer')",
  TextInput: "TextInput({text:'',placeholder:''})", TextArea: "TextArea({text:'',placeholder:''})",
  Marquee: "Marquee({start:true,step:4,loop:-1,fromStart:true,src:'consumer'})" };
const sites = [];
for (const file of baseline.files) {
  const source = readFileSync(new URL(`../${file.path}`, import.meta.url), 'utf8');
  const consumers = auditTypographyConsumers(source, file.path), used = new Set();
  for (const expected of file.nodes) {
    const actual = consumers.find(node => !used.has(node) && node.method === expected.method && node.kind === expected.kind &&
      node.modifiers.fontSize?.expression === expected.changes.fontSize);
    assert.ok(actual, `${file.path}/${expected.method}: actual SDK parsed consumer`);
    used.add(actual); sites.push({ expected, actual, file: file.path, method: `site${sites.length}` });
  }
}
// Compile the exact authored typography modifier expressions from every real
// consumer onto its native ArkUI carrier. Business/layout preservation is
// independently proved by byte-identical source restoration in the audit gate.
const sourceFor = original => `@Component struct TypographyConsumerProbe {\n${sites.map(site => {
  const modifiers = typographyProperties.filter(property => Object.hasOwn(site.expected.original, property)).map(property =>
    `.${property}(${original ? site.expected.original[property] : site.actual.modifiers[property].expression}${site.expected.extra[property].length ? ', '+site.expected.extra[property].join(', ') : ''})`).join('\n');
  assert.ok(carriers[site.expected.kind], `native typography carrier ${site.expected.kind}`);
  return `@Builder private ${site.method}(label: string) { ${carriers[site.expected.kind]}\n${modifiers}\n }`;
}).join('\n')}\nbuild() { Column() {} }\n}`;
const names = sites.map(site => site.method);
const dependencies = { FontWeight: { Regular: 400, Medium: 500, Bold: 700 } };
const before = createReaderBuilderProbe(sourceFor(true), names, dependencies).Component;
const after = createReaderBuilderProbe(sourceFor(false), names, dependencies).Component;
const scenarios = [
  { isWide: () => false, isTablet: false, coverWidth: 96.96, selectedGroupName: '其他' },
  { isWide: () => true, isTablet: true, coverWidth: 128, selectedGroupName: '当前' },
  { isWide: () => false, isTablet: true, coverWidth: 65.28, selectedGroupName: '当前' },
];
const tuple = node => Object.fromEntries(typographyProperties.filter(property => Object.hasOwn(node, property)).map(property => [property, node[property]]));
for (const scenario of scenarios) {
  for (const site of sites) {
    const a = Object.assign(new before(undefined), scenario), b = Object.assign(new after(undefined), scenario);
    a[site.method]('当前'); b[site.method]('当前');
    assert.equal(a.nodes.size, 1); assert.equal(b.nodes.size, 1);
    assert.equal([...a.nodes.values()][0].type, [...b.nodes.values()][0].type);
    assert.deepEqual(tuple([...b.nodes.values()][0]), tuple([...a.nodes.values()][0]),
      `${site.file}/${site.expected.method}: exact real SDK native tuple including AUTO and secondary options`);
  }
}
const role = 'TYPE_FORM_LABEL_ACTION';
const propagated = createReaderBuilderProbe(sourceFor(false), names, {
  ...dependencies, [role]: { ...readerTypographyRoles[role], fontSizeFp: readerTypographyRoles[role].fontSizeFp + 2 },
}).Component;
let affected = 0, unaffected = 0;
for (const site of sites) {
  const owner = Object.assign(new propagated(undefined), scenarios[0]); owner[site.method]('当前');
  const node = [...owner.nodes.values()][0];
  const base = Object.assign(new after(undefined), scenarios[0]); base[site.method]('当前');
  if (site.expected.changes.fontSize.includes(`${role}.fontSizeFp`)) {
    affected++; assert.equal(node.fontSize, [...base.nodes.values()][0].fontSize + 2);
  } else { unaffected++; assert.deepEqual(tuple(node), tuple([...base.nodes.values()][0])); }
}
assert.ok(affected >= 10 && unaffected > 200, 'shared role propagates across real page consumers while other variants remain unchanged');
assert.deepEqual(readerTypographyRoles.TYPE_SELECT_APPEARANCE_LIBRARY_OPTION_REGULAR.fontFamily, 'ReaderNotoSansSCUIRegular');
assert.equal(readerTypographyRoles.TYPE_SELECT_APPEARANCE_LIBRARY_OPTION_REGULAR.fontWeight, 400);
assert.equal(readerTypographyRoles.TYPE_SELECT_APPEARANCE_LIBRARY_OPTION_SELECTED.fontFamily, 'ReaderNotoSansSCUIBold');
assert.equal(readerTypographyRoles.TYPE_SELECT_APPEARANCE_LIBRARY_OPTION_SELECTED.fontWeight, 700);
console.log(`PASS conventional Typography real SDK: ${sites.length} consumers × ${scenarios.length} states, ${affected} shared-role propagation consumers, ${unaffected} bounded variants`);
