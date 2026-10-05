import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { readerTypographyRoles } from './lib/reader-typography-probe.mjs';
const baseline = JSON.parse(readFileSync(new URL('./fixtures/design/conventional-typography-baseline.json', import.meta.url)));
const weights = { Regular: 400, Medium: 500, Bold: 700 };
const scenarios = [
  { isWide: () => false, isTablet: false, coverWidth: 96.96, selectedGroupName: '其他' },
  { isWide: () => true, isTablet: true, coverWidth: 128, selectedGroupName: '当前' },
];
const evaluate = (expression, owner) => new Function('FontWeight', 'label', ...Object.keys(readerTypographyRoles),
  `return (${stripTypeScriptTypes(expression)});`).call(owner, weights, '当前', ...Object.values(readerTypographyRoles));
const usedRoles = new Set();
let nodes = 0;
for (const file of baseline.files) for (const node of file.nodes) {
  nodes++;
  for (const [property, replacement] of Object.entries(node.changes)) {
    const names = [...replacement.matchAll(/TYPE_\w+/g)].map(match => match[0]);
    assert.ok(names.length, `${file.path}/${node.method}/${property}: finite semantic role`);
    for (const name of names) {
      usedRoles.add(name); const role = readerTypographyRoles[name];
      assert.ok(role, `${name}: production export exists`);
      assert.equal(role.scalePolicy, 'system');
      assert.ok(['appBaseline','figmaNode'].includes(role.source), `${name}: evidence provenance`);
      assert.ok(Number.isFinite(role.fontSizeFp));
      assert.ok(role.lineHeightFp === undefined || Number.isFinite(role.lineHeightFp));
    }
    for (const owner of scenarios) assert.equal(evaluate(replacement, owner), evaluate(node.original[property], owner),
      `${file.path}/${node.method}/${property}: original physical tuple`);
  }
}
assert.equal(nodes, 248);
console.log(`PASS conventional Typography registry: ${nodes} consumers, ${usedRoles.size} semantic roles, exact current baseline and finite variants`);
