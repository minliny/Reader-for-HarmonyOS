import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sdkRoot = process.env.READER_ETS_LOADER_ROOT ?? '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts = require(`${sdkRoot}/node_modules/typescript`);
const options = require(`${sdkRoot}/lib/ets_checker.js`).compilerOptions;
export const typographyProperties = ['fontFamily', 'fontWeight', 'fontSize', 'lineHeight', 'letterSpacing'];

/** Parse actual ETS modifier chains, including Marquee/native-input carriers.
 * A Text inside a string/comment is never counted as a production consumer. */
export function auditTypographyConsumers(source, file = '/tmp/TypographyConsumer.ets') {
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  assert.equal(parsed.parseDiagnostics.length, 0, `${file}: real ETS parsing`);
  const groups = new Map();
  const rootOf = node => {
    while (node && ts.isCallExpression(node) && node.expression?.expression) node = node.expression.expression;
    return node;
  };
  const walk = node => {
    if (ts.isCallExpression(node) && typographyProperties.includes(node.expression?.name?.text) && node.arguments.length) {
      const root = rootOf(node);
      let record = groups.get(root.pos);
      if (!record) {
        let parent = node;
        while (parent && !ts.isMethodDeclaration(parent)) parent = parent.parent;
        record = { method: parent?.name?.getText(parsed) ?? '@Styles', kind: root.expression?.getText(parsed),
          text: root.arguments?.[0]?.getText(parsed), modifiers: {}, line: parsed.getLineAndCharacterOfPosition(node.getStart(parsed)).line + 1 };
        groups.set(root.pos, record);
      }
      record.modifiers[node.expression.name.text] = { expression: node.arguments[0].getText(parsed),
        extra: node.arguments.slice(1).map(argument => argument.getText(parsed)),
        start: node.arguments[0].getStart(parsed), end: node.arguments[0].end };
    }
    ts.forEachChild(node, walk);
  };
  walk(parsed);
  return [...groups.values()].sort((a, b) => a.line - b.line);
}
