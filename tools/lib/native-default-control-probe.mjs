import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sdk = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts = require(`${sdk}/node_modules/typescript`);
const options = require(`${sdk}/lib/ets_checker.js`).compilerOptions;
const normalise = text => (text ?? '').replace(/\s+/g, '');

/** A named native-default family may have explicit mutually exclusive actors.
 * This is not a larger omission budget: every actual branch, callback and
 * keyed capture must match, and a copied actor is rejected by cardinality. */
export function verifyNativeDefaultBranches(source, file, contract) {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  assert.equal(tree.parseDiagnostics.length, 0, `${contract.id}: actual native default AST`);
  const sites = [];
  const visit = node => {
    if (ts.isEtsComponentExpression(node) && node.expression.getText(tree) === contract.kind &&
        normalise(node.arguments[0]?.getText(tree)) === normalise(contract.argument)) {
      let member = node;
      while (member && !ts.isMethodDeclaration(member)) member = member.parent;
      if (member?.name?.getText(tree) === contract.method) {
        let branch, loop, callback;
        for (let parent = node.parent; parent && parent !== member; parent = parent.parent) {
          if (ts.isCallExpression(parent) && parent.expression.name?.text === 'onClick') callback = parent.arguments[0]?.getText(tree);
          if (!loop && ts.isCallExpression(parent) && parent.expression.getText(tree) === 'ForEach')
            loop = { input: parent.arguments[0]?.getText(tree), key: parent.arguments[2]?.getText(tree) };
          if (!branch && ts.isIfStatement(parent)) branch = { guard: parent.expression.getText(tree),
            branch: parent.thenStatement.pos <= node.pos && node.end <= parent.thenStatement.end ? 'then' : 'else', pos: parent.pos };
        }
        sites.push({ callback, loop, branch });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  assert.equal(sites.length, contract.branchInstances.length, `${contract.id}: no missing or copied native default actors`);
  const used = new Set();
  for (const expected of contract.branchInstances) {
    const site = sites.find(value => !used.has(value) && normalise(value.callback) === normalise(expected.onClick));
    assert.ok(site, `${contract.id}: exact actual branch callback`); used.add(site);
    assert.equal(normalise(site.branch?.guard), normalise(expected.guard), `${contract.id}: exact finite branch guard`);
    assert.equal(site.branch?.branch, expected.branch, `${contract.id}: exact mutually exclusive branch`);
    assert.equal(normalise(site.loop?.input), normalise(expected.forEachInput), `${contract.id}: actual exact-scope input`);
    assert.equal(normalise(site.loop?.key), normalise(expected.forEachKey), `${contract.id}: actual retained actor key`);
  }
  assert.equal(new Set(sites.map(site => site.branch.pos)).size, 1, `${contract.id}: actors must share one actual if/else, not independently true guards`);
  return sites.length;
}
