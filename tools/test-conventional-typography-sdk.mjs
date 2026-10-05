import { approvedTypographyContract, approvedTypographyFile } from './lib/approved-manga-typography-carriers.mjs';
import { sharedTypographyReplacement, typographyCarrierMethod } from './lib/reader-typography-shared-replacements.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as fontFamilies from '../entry/src/main/ets/features/common/ReaderFontFamilies.ts';
import { auditTypographyConsumers, typographyProperties } from './lib/reader-typography-consumer-audit.mjs';
import { createReaderBuilderProbe } from './lib/reader-control-builder-probe.mjs';
import { typographySuccessorFile, typographySuccessorNode } from './lib/reader-typography-migration-fixture.mjs';
import { readerTypographyRoles } from './lib/reader-typography-probe.mjs';

const fixtureArgument = process.argv.find(argument => argument.startsWith('--fixture='));
const fixtureName = fixtureArgument?.slice('--fixture='.length) ?? 'conventional-typography-baseline.json';
assert.ok(/^[a-z0-9-]+\.json$/.test(fixtureName), 'bounded fixture filename');
const baseline = JSON.parse(readFileSync(new URL(`./fixtures/design/${fixtureName}`, import.meta.url)));
const carriers = { Text: "Text('consumer')", Span: "Span('consumer')", Button: "Button('consumer')",
  TextInput: "TextInput({text:'',placeholder:''})", TextArea: "TextArea({text:'',placeholder:''})",
  Marquee: "Marquee({start:true,step:4,loop:-1,fromStart:true,src:'consumer'})" };
const sites = [];
for (const file of baseline.files) {
  const source = readFileSync(new URL(`../${file.path}`, import.meta.url), 'utf8');
  const approved=approvedTypographyContract(source,file.path);
  if(approved.registered)continue;
  const consumers = auditTypographyConsumers(source, file.path), used = new Set();
  const successor = typographySuccessorFile(baseline, file.path);
  for (const originalExpected of file.nodes) {
    const expected = typographySuccessorNode(originalExpected, successor);
    const replacement = sharedTypographyReplacement(file.path, expected, source);
    const actual = replacement ?? consumers.find(node => !used.has(node) && node.method === typographyCarrierMethod(file.path, expected, source) && node.kind === expected.kind &&
      node.modifiers.fontSize?.expression === expected.changes.fontSize);
    assert.ok(actual, `${file.path}/${expected.method}: actual SDK parsed consumer`);
    used.add(actual); sites.push({ expected, actual, file: file.path, method: `site${sites.length}` });
  }
}
// Approved successor static native tuples are also sent through the installed
// SDK. Dynamic expressions retain their exact AST/occurrence contract and their
// actual owning component regressions; no fake semantic-role migration occurs.
for(const file of baseline.files){const source=readFileSync(new URL('../'+file.path,import.meta.url),'utf8');const approved=approvedTypographyContract(source,file.path);if(!approved.registered)continue;
 for(const node of auditTypographyConsumers(source,file.path)){
  const staticArgument=value=>/^(?:TYPE_\w+\.\w+(?: as number)?|READER_FONT_\w+|FontWeight\.\w+|[0-9.]+|['"][^'"]*['"])$/.test(value);
  if(!Object.values(node.modifiers).every(m=>staticArgument(m.expression))||!carriers[node.kind])continue;
  const values=Object.fromEntries(Object.entries(node.modifiers).map(([k,m])=>[k,m.expression]));
  sites.push({expected:{kind:node.kind,original:values,changes:values,extra:Object.fromEntries(Object.entries(node.modifiers).map(([k,m])=>[k,m.extra]))},actual:node,file:file.path,method:`site${sites.length}`});
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
const dependencies = { ...fontFamilies, FontWeight: { Regular: 400, Medium: 500, Bold: 700 },
  fontId: 'preview-face', font: 'preview-face', value: 0, group: 'screen', option: '当前',
  readerAppearanceFontSlotFamily: (_snapshot, slot) => `Preview:${slot}`,
  readerRegisteredFontFamily: (_registry, family) => family,
};
const before = createReaderBuilderProbe(sourceFor(true), names, dependencies).Component;
const after = createReaderBuilderProbe(sourceFor(false), names, dependencies).Component;
const scenarios = [
  { isWide: () => false, isTablet: false, coverWidth: 96.96, selectedGroupName: '其他', headerInter: () => false, snapshot: {}, visiblePreviewFamily: face => `Preview:${face}`, indentOptionActive: () => false, isActive: () => false },
  { isWide: () => true, isTablet: true, coverWidth: 128, selectedGroupName: '当前', headerInter: () => true, snapshot: {}, visiblePreviewFamily: face => `Preview:${face}`, indentOptionActive: () => true, isActive: () => true },
  { isWide: () => false, isTablet: true, coverWidth: 65.28, selectedGroupName: '当前', headerInter: () => false, snapshot: {}, visiblePreviewFamily: face => `Preview:${face}`, indentOptionActive: () => true, isActive: () => false },
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
const fontConsumers = sites.reduce((counts, site) => { const role = site.expected.changes.fontSize.match(/^(TYPE_\w+)\.fontSizeFp$/)?.[1]; if (role) counts.set(role, (counts.get(role) ?? 0)+1); return counts; }, new Map());
const role = [...fontConsumers].sort((a,b) => b[1]-a[1])[0][0];
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
assert.ok(affected >= 2 && unaffected > 0, 'shared role propagates across real page consumers while other variants remain unchanged');
assert.deepEqual(readerTypographyRoles.TYPE_SELECT_APPEARANCE_LIBRARY_OPTION_REGULAR.fontFamily, 'ReaderNotoSansSCUIRegular');
assert.equal(readerTypographyRoles.TYPE_SELECT_APPEARANCE_LIBRARY_OPTION_REGULAR.fontWeight, 400);
assert.equal(readerTypographyRoles.TYPE_SELECT_APPEARANCE_LIBRARY_OPTION_SELECTED.fontFamily, 'ReaderNotoSansSCUIBold');
assert.equal(readerTypographyRoles.TYPE_SELECT_APPEARANCE_LIBRARY_OPTION_SELECTED.fontWeight, 700);
console.log(`PASS conventional Typography real SDK: ${sites.length} consumer contracts × ${scenarios.length} states, ${affected} shared-role propagation consumers, ${unaffected} bounded variants`);
