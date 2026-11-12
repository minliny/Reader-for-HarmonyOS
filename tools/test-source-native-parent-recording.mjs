import assert from 'node:assert/strict';
import { readerControlNativeTree } from './fixtures/reader-control-native-tree.mjs';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const selected = selectContractCases({
  'cross-owner': 'The finite native recorder separates two real ViewPU-style owner/id namespaces and records Button.createWithChild ancestry; legacy numeric-id collision is rejected.',
  'default-parent': 'The existing single-owner numeric parentId interface remains available, including balanced native Button creation/pop.',
});

function observe(tree, owner, id, action) {
  tree.hooks.onObserverEnter(owner, id);
  try { action(); } finally { tree.hooks.onObserverExit(); }
}

function record(crossComponent) {
  const tree = readerControlNativeTree(['Row', 'Stack', 'Button'], { crossComponent });
  const parent = { nodes: new Map([[0, {}], [1, {}]]), attributeCalls: [] };
  const child = { nodes: new Map([[0, {}]]), attributeCalls: [] };
  observe(tree, parent, 0, () => tree.dependencies.Row.create({ space: 8 }));
  observe(tree, parent, 1, () => tree.dependencies.Stack.create({ alignContent: 'center' }));
  observe(tree, child, 0, () => tree.dependencies.Button.createWithChild());
  return { tree, parent, child };
}

for (const id of selected) {
  if (id === 'cross-owner') {
    const current = record(true);
    const row = current.parent.nodes.get(0);
    const carrier = current.parent.nodes.get(1);
    const button = current.child.nodes.get(0);
    assert.notEqual(row.nativeKey, button.nativeKey, 'owner-local id zero is not a global native identity');
    assert.equal(button.parentId, carrier.nativeKey);
    assert.equal(carrier.parentId, row.nativeKey);
    current.tree.dependencies.Button.pop();
    current.tree.dependencies.Stack.pop();
    current.tree.dependencies.Row.pop();
    assert.equal(current.tree.remaining(), 0);
    const collision = record(false);
    assert.equal(collision.child.nodes.get(0).parentId, undefined, 'the prior numeric-only cross-owner recipe loses this ancestry');
    assert.throws(() => collision.tree.dependencies.Button.pop(), /type mismatch/);
  } else {
    const tree = readerControlNativeTree(['Row', 'Button']);
    const owner = { nodes: new Map([[0, {}], [1, {}]]), attributeCalls: [] };
    observe(tree, owner, 0, () => tree.dependencies.Row.create());
    observe(tree, owner, 1, () => tree.dependencies.Button.createWithChild());
    assert.equal(owner.nodes.get(1).parentId, 0);
    assert.equal(tree.parents.get(1), 0);
    assert.equal(owner.nodes.get(1).nativeKey, undefined);
    tree.dependencies.Button.pop();
    tree.dependencies.Row.pop();
    assert.equal(tree.remaining(), 0);
  }
  recordContractCasePass(id);
}
