import assert from 'node:assert/strict';
import { installedEtsCompiler } from './ets-compiler-runtime.mjs';

// Selected source edges, with the official ETS parser. No workspace inventory,
// historical style budget, implementation snapshot, or subprocess is evaluated.
export function verifySharedProducerInputCalls(producerSource, consumerSource, { component, producerFile, consumerFile }) {
  const { ts, options } = installedEtsCompiler();
  const parse = (source, file) => {
    const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
    assert.deepEqual(tree.parseDiagnostics, [], `${file}: SDK AST`);
    return tree;
  };
  const producer = parse(producerSource, producerFile);
  const owner = producer.statements.find(node => node.name?.text === component && node.members);
  assert.ok(owner, `actual producer ${component}`);
  const fields = new Set(owner.members.filter(node => ts.isPropertyDeclaration(node) &&
    !node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.PrivateKeyword)).map(node => node.name.getText(producer)));
  const consumer = parse(consumerSource, consumerFile), calls = [];
  const visit = node => {
    if ((ts.isCallExpression(node) || ts.isEtsComponentExpression?.(node)) && node.expression?.getText(consumer) === component) {
      const props = node.arguments?.[0];
      assert.ok(props && ts.isObjectLiteralExpression(props), `${component}: explicit finite Props required`);
      const keys = props.properties.map(property => {
        assert.ok(!ts.isSpreadAssignment(property), `${component}: spread cannot hide unknown inputs`);
        const name = property.name?.getText(consumer);
        assert.ok(fields.has(name), `${component}: illegal shared input ${name}`);
        return name;
      });
      assert.equal(new Set(keys).size, keys.length, `${component}: duplicate input`);
      calls.push({ line: consumer.getLineAndCharacterOfPosition(node.getStart(consumer)).line + 1, keys });
    }
    ts.forEachChild(node, visit);
  };
  visit(consumer);
  assert.ok(calls.length, `${consumerFile}: selected actual producer edge missing`);
  return calls;
}
