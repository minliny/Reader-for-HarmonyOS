import { resolveEtsLoaderRoot } from './tool-environment.mjs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const require = createRequire(import.meta.url);
const sdk = resolveEtsLoaderRoot();
const ts = require(`${sdk}/node_modules/typescript`);
const options = require(`${sdk}/lib/ets_checker.js`).compilerOptions;
const normalise = text => (text ?? '').replace(/\s+/g, '');
const read = file => readFileSync(new URL('../../' + file, import.meta.url), 'utf8');
const digest = value => createHash('sha256').update(value).digest('hex');
const recoverySuccessor = JSON.parse(read('tools/fixtures/design/native-default-recovery-successor-20261015.json'));
assert.equal(recoverySuccessor.schema, 1);
assert.equal(recoverySuccessor.previousFixture, 'tools/fixtures/design/native-default-control-contracts.json');
assert.equal(digest(read(recoverySuccessor.previousFixture)), recoverySuccessor.previousFixtureSha256,
  'native-default recovery keeps the historical witness immutable');

/** Only the existing ordinary retry gains a nested inline-recovery fallback.
 * The historical native family, cardinality, callbacks and typography stay
 * immutable; this finite successor does not add an omission or modal owner. */
export function nativeDefaultRecoveryBranchContract(previous) {
  if (previous.id !== 'NATIVE-DEFAULT-05') return previous;
  const { count: _observedActorCount, ...historical } = previous;
  assert.equal(digest(JSON.stringify(historical)), recoverySuccessor.previousRowSha256, 'exact original native retry row');
  assert.deepEqual([recoverySuccessor.id, recoverySuccessor.file, recoverySuccessor.method, recoverySuccessor.sdkProof],
    ['NATIVE-DEFAULT-05', 'features/reading/LocalReadingExperience.ets', 'readingFailureContent', 'tools/test-native-default-control-contracts.mjs']);
  assert.equal(recoverySuccessor.exclusiveGuard, previous.branchInstances[0].guard);
  assert.equal(recoverySuccessor.branchInstances.length, previous.branchInstances.length, 'no added native actor');
  const inlineGuard = 'this.readerRecoveryView.visible && this.readerRecoveryView.canRetry';
  assert.equal(recoverySuccessor.branchInstances[0].guard, recoverySuccessor.exclusiveGuard);
  assert.equal(recoverySuccessor.branchInstances[1].guard, inlineGuard, 'one exact inline recovery admission');
  assert.deepEqual(recoverySuccessor.branchInstances.map(branch => branch.branchPath), [
    [{ guard: recoverySuccessor.exclusiveGuard, branch: 'then' }],
    [{ guard: inlineGuard, branch: 'else' }, { guard: recoverySuccessor.exclusiveGuard, branch: 'else' }],
  ], 'only the ordinary native retry moves below the shared inline recovery choice');
  for (const [index, branch] of recoverySuccessor.branchInstances.entries()) {
    const original = previous.branchInstances[index];
    for (const field of ['onClick', 'forEachInput', 'forEachKey', 'branch']) assert.equal(branch[field], original[field],
      'recovery successor preserves the original native action/scope: ' + field);
  }
  return { ...previous, exclusiveGuard: recoverySuccessor.exclusiveGuard, branchInstances: recoverySuccessor.branchInstances };
}

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
        const branches = [];
        for (let parent = node.parent; parent && parent !== member; parent = parent.parent) {
          if (ts.isCallExpression(parent) && parent.expression.name?.text === 'onClick') callback = parent.arguments[0]?.getText(tree);
          if (!loop && ts.isCallExpression(parent) && parent.expression.getText(tree) === 'ForEach')
            loop = { input: parent.arguments[0]?.getText(tree), key: parent.arguments[2]?.getText(tree) };
          if (ts.isIfStatement(parent)) {
            const ancestor = { guard: parent.expression.getText(tree),
              branch: parent.thenStatement.pos <= node.pos && node.end <= parent.thenStatement.end ? 'then' : 'else', pos: parent.pos };
            branches.push(ancestor);
            branch ??= ancestor;
          }
        }
        sites.push({ callback, loop, branch, branches });
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
    if (expected.branchPath !== undefined) assert.deepEqual(site.branches.map(value => ({ guard: normalise(value.guard), branch: value.branch })),
      expected.branchPath.map(value => ({ guard: normalise(value.guard), branch: value.branch })), `${contract.id}: exact finite branch path`);
    assert.equal(normalise(site.loop?.input), normalise(expected.forEachInput), `${contract.id}: actual exact-scope input`);
    assert.equal(normalise(site.loop?.key), normalise(expected.forEachKey), `${contract.id}: actual retained actor key`);
  }
  const exclusiveGuard = normalise(contract.exclusiveGuard ?? contract.branchInstances[0].guard);
  const exclusiveBranches = sites.map(site => site.branches.find(branch => normalise(branch.guard) === exclusiveGuard));
  assert.ok(exclusiveBranches.every(Boolean), `${contract.id}: exact finite branch guard owns every actor`);
  assert.equal(new Set(exclusiveBranches.map(branch => branch.pos)).size, 1, `${contract.id}: actors must share one actual if/else, not independently true guards`);
  assert.deepEqual([...new Set(exclusiveBranches.map(branch => branch.branch))].sort(), ['else', 'then'], `${contract.id}: native retries remain mutually exclusive`);
  return sites.length;
}
