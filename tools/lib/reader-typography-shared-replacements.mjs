import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { auditTypographyConsumers } from './reader-typography-consumer-audit.mjs';
const require = createRequire(import.meta.url);
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts = require(`${sdk}/node_modules/typescript`);
const options = require(`${sdk}/lib/ets_checker.js`).compilerOptions;
const registry = JSON.parse(readFileSync(new URL('../fixtures/design/typography-carrier-successors.json', import.meta.url), 'utf8'));
assert.equal(registry.schemaVersion, 1);
const successor = (file, expected) => registry.entries.find(entry => entry.origin.path === file && entry.origin.method === expected.method && entry.origin.kind === expected.kind && entry.origin.text === expected.text);
function methodOf(source, file, name) {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  assert.equal(tree.parseDiagnostics.length, 0, `${file}: real SDK AST for carrier successor`);
  const declaration = tree.statements.find(node => node.members?.some(member => member.name?.text === 'build'));
  const method = declaration?.members.find(member => ts.isMethodDeclaration(member) && member.name?.text === name);
  assert.ok(method, `${file}: actual origin ${name}`);
  return { tree, method };
}
function callsMethod(source, file, origin, target) {
  const { tree, method } = methodOf(source, file, origin); let found = false;
  const visit = node => {
    if (ts.isCallExpression(node) && node.expression?.getText(tree) === `this.${target}` && node.arguments.length === 0) found = true;
    ts.forEachChild(node, visit);
  };
  visit(method); assert.ok(found, `${file}/${origin}: actual AST call to ${target}, not a comment or unrelated carrier`);
}
/** Only explicitly audited same-file relocations. The immutable tuple remains
 * the baseline; an actual current origin->Builder edge is mandatory. */
export function typographyCarrierMethod(file, expected, pageSource) {
  const entry = successor(file, expected);
  if (entry?.kind === 'sameFile') {
    assert.equal(entry.target.path, file);
    callsMethod(pageSource, file, entry.origin.method, entry.target.method);
    const carrier = auditTypographyConsumers(pageSource, file).find(node => node.method === entry.target.method && node.kind === entry.target.kind && node.text === entry.target.text);
    assert.ok(carrier, `${entry.id}: exact authored successor carrier`);
    assert.deepEqual(Object.keys(carrier.modifiers).sort(), Object.keys(expected.original).sort(), `${entry.id}: all native tuple attributes/AUTO omissions`);
    for (const [property, value] of Object.entries(expected.changes)) {
      assert.equal(carrier.modifiers[property]?.expression, value, `${entry.id}: exact public successor tuple`);
      assert.deepEqual(carrier.modifiers[property]?.extra, expected.extra[property]);
    }
    return entry.target.method;
  }
  return expected.method;
}
/** Two actual page Texts became one shared native carrier. The origin method,
 * finite child binding and tuple must exist in the real SDK AST. No baseline
 * rows/counts, physical values or AUTO omissions are changed. */
export function sharedTypographyReplacement(file, expected, pageSource, targetSource) {
  const entry = successor(file, expected);
  if (entry?.kind !== 'shared') return undefined;
  const { tree, method } = methodOf(pageSource, file, expected.method); let found = false;
  assert.ok(tree.statements.some(node => ts.isImportDeclaration(node) && node.moduleSpecifier?.text === entry.module &&
    node.importClause?.namedBindings?.elements?.some(element => element.name?.text === entry.component)), `${file}: actual shared implementation import`);
  const visit = node => {
    if ((ts.isCallExpression(node) || ts.isEtsComponentExpression?.(node)) && node.expression?.getText(tree) === entry.component) {
      const props = node.arguments?.[0];
      if (props && ts.isObjectLiteralExpression(props)) {
        const view = props.properties.find(property => property.name?.text === 'view');
        const action = props.properties.find(property => property.name?.text === 'onReconcile');
        if (view?.initializer?.getText(tree) === entry.view && action?.initializer) found = true;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(method);
  assert.ok(found, `${file}/${expected.method}: actual page consumes the finite shared replacement`);
  const target = entry.target.path;
  const source = targetSource ?? readFileSync(new URL('../../'+target, import.meta.url), 'utf8');
  const actual = auditTypographyConsumers(source, target).find(node => node.method === entry.target.method && node.kind === entry.target.kind && node.text === entry.target.text);
  assert.ok(actual, 'shared actual message carrier');
  assert.deepEqual(Object.keys(actual.modifiers).sort(), Object.keys(expected.original).sort(), 'all five physical attributes and every AUTO omission are preserved');
  for (const [property, value] of Object.entries(expected.changes)) {
    assert.equal(actual.modifiers[property]?.expression, value, 'exact original shared role is preserved');
    assert.deepEqual(actual.modifiers[property]?.extra, expected.extra[property], 'native secondary options remain exact');
  }
  return actual;
}
