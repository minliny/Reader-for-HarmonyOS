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

/** Recognise complete role/spec arguments, rather than a TYPE_ substring.
 * Mixed public/private ternaries and page-local numeric overrides stay debt.
 * The sole conventional arithmetic exception is the existing proportional
 * cover geometry; its base font tuple remains owned by the public role. */
export function isSharedTypographyExpression(expression) {
  if (expression === 'TYPE_SHELF_COVER_PLACEHOLDER.fontSizeFp * this.coverWidth / 96.96' ||
      expression === '(TYPE_SHELF_COVER_PLACEHOLDER.lineHeightFp as number) * this.coverWidth / 96.96') return true;
  const parsed = ts.createSourceFile('/tmp/TypographyArgument.ts', `const value = (${expression});`, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (parsed.parseDiagnostics.length) return false;
  const root = parsed.statements[0]?.declarationList?.declarations[0]?.initializer;
  const visit = node => {
    if (!node) return false;
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node)) return visit(node.expression);
    if (ts.isConditionalExpression(node)) return visit(node.whenTrue) && visit(node.whenFalse);
    if (ts.isPropertyAccessExpression(node)) {
      if (ts.isIdentifier(node.expression) && /^TYPE_\w+$/.test(node.expression.text)) return true;
      const callee = node.expression;
      if (ts.isCallExpression(callee) && ts.isPropertyAccessExpression(callee.expression) &&
          callee.expression.expression.kind === ts.SyntaxKind.ThisKeyword &&
          ['textStyle', 'optionTextStyle', 'surfaceSpec', 'spec'].includes(callee.expression.name.text)) return true;
    }
    return false;
  };
  return visit(root);
}
