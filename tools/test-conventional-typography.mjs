import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { stripTypeScriptTypes } from 'node:module';
import { auditTypographyConsumers, typographyProperties, typographyRoleImports } from './lib/reader-typography-consumer-audit.mjs';
import { readerTypographyRoles } from './lib/reader-typography-probe.mjs';

const fixtureArgument = process.argv.find(argument => argument.startsWith('--fixture='));
const fixtureName = fixtureArgument?.slice('--fixture='.length) ?? 'conventional-typography-baseline.json';
assert.ok(/^[a-z0-9-]+\.json$/.test(fixtureName), 'bounded fixture filename');
const baseline = JSON.parse(readFileSync(new URL(`./fixtures/design/${fixtureName}`, import.meta.url)));
const fontWeights = { Regular: 400, Medium: 500, Bold: 700 };
const scenarios = [
  { isWide: () => false, isTablet: false, coverWidth: 96.96, selectedGroupName: '其他' },
  { isWide: () => true, isTablet: true, coverWidth: 128, selectedGroupName: '当前' },
  { isWide: () => false, isTablet: true, coverWidth: 65.28, selectedGroupName: '当前' },
];
const evaluate = (expression, owner) => new Function('FontWeight', 'label', ...Object.keys(readerTypographyRoles),
  `return (${stripTypeScriptTypes(expression)});`).call(owner, fontWeights, '当前', ...Object.values(readerTypographyRoles));
const verifyMigrationSource = process.argv.includes('--verify-migration-source');
let sites = 0, argumentsChecked = 0;
for (const file of baseline.files) {
  const source = readFileSync(new URL(`../${file.path}`, import.meta.url), 'utf8');
  const importedRoles = typographyRoleImports(source, file.path);
  for (const expected of file.nodes) for (const replacement of Object.values(expected.changes))
    for (const match of replacement.matchAll(/TYPE_\w+/g))
      assert.ok(importedRoles.has(match[0]), `${file.path}: actual public semantic role import ${match[0]}`);
  const consumers = auditTypographyConsumers(source, file.path), used = new Set(), edits = [];
  for (const expected of file.nodes) {
    const actual = consumers.find(node => !used.has(node) && node.method === (file.path.endsWith('/SettingsPage.ets') && expected.method === 'buildGeneral' ? 'operationFeedback' : expected.method) && node.kind === expected.kind &&
      (!verifyMigrationSource || node.text === expected.text) && node.modifiers.fontSize?.expression === expected.changes.fontSize);
    assert.ok(actual, `${file.path}/${expected.method}: actual production consumer, not a registration row`);
    used.add(actual); sites++;
    assert.deepEqual(Object.keys(actual.modifiers).sort(), Object.keys(expected.original).sort(), `${file.path}: retain every AUTO omission`);
    for (const property of typographyProperties.filter(key => Object.hasOwn(expected.original, key))) {
      const modifier = actual.modifiers[property];
      assert.equal(modifier.expression, expected.changes[property], `${file.path}/${property}: shared role consumer`);
      assert.deepEqual(modifier.extra, expected.extra[property], `${file.path}/${property}: native variable-font options`);
      for (const scenario of scenarios) assert.equal(evaluate(modifier.expression, scenario), evaluate(expected.original[property], scenario),
        `${file.path}/${expected.method}/${property}: current physical tuple and responsive state`);
      edits.push({ start: modifier.start, end: modifier.end, replacement: expected.original[property] }); argumentsChecked++;
    }
  }
  assert.ok(consumers.filter(node => node.modifiers.fontSize).every(node => /TYPE_|this\.(?:textStyle|optionTextStyle|surfaceSpec|spec)\(\)/.test(node.modifiers.fontSize.expression)),
    `${file.path}: reject any newly introduced private typography tuple`);
  let restored = source;
  for (const edit of edits.sort((a, b) => b.start - a.start)) restored = restored.slice(0, edit.start) + edit.replacement + restored.slice(edit.end);
  if (verifyMigrationSource) {
    assert.ok(restored.startsWith(file.roleImport), `${file.path}: original migration import prefix for one-time source proof`);
    restored = restored.slice(file.roleImport.length);
  }
  if (verifyMigrationSource) assert.equal(createHash('sha256').update(restored).digest('hex'), file.sha256,
    `${file.path}: layout, callbacks, business guards and content match the immutable pre-migration source`);
}
assert.equal(sites, baseline.files.reduce((sum, file) => sum + file.nodes.length, 0));
console.log(`PASS conventional Typography: ${baseline.files.length} complete files, ${sites} production consumers, ${argumentsChecked} arguments, ${verifyMigrationSource ? "exact source restoration/" : ""}AUTO/dynamic variants`);
