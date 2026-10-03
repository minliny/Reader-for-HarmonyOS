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
        record = { carrierStart: root.getStart(parsed), method: parent?.name?.getText(parsed) ?? '@Styles', kind: root.expression?.getText(parsed),
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
 * Proportional cover geometry and the reader's existing bounded interpolation
 * may use public role endpoints. Numeric/mixed endpoint overrides stay debt. */
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
    if (ts.isCallExpression(node)) {
      if (ts.isIdentifier(node.expression) && node.expression.text === 'readerControlLerp' && node.arguments.length === 3) {
        const [from, to, progress] = node.arguments;
        return visit(from) && visit(to) && ts.isPropertyAccessExpression(from) && ts.isPropertyAccessExpression(to) &&
          from.name.text === to.name.text && ['fontSizeFp', 'fontWeight'].includes(from.name.text) &&
          progress.getText(parsed) === 'this.p()';
      }
      if (node.expression.getText(parsed) === 'Math.round' && node.arguments.length === 1)
        return ts.isCallExpression(node.arguments[0]) && visit(node.arguments[0]);
    }
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

/** Collect every real named role import from the public typography module.
 * Business recovery work may add another import or merge named lists; the
 * migration gate must not depend on one header line remaining byte-identical. */
export function typographyRoleImports(source, file = '/tmp/TypographyImports.ets') {
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  assert.equal(parsed.parseDiagnostics.length, 0, `${file}: real ETS imports parse`);
  const roles = new Set();
  for (const statement of parsed.statements) {
    if (!ts.isImportDeclaration(statement) || !/\/(?:ReaderTypography)(?:\.ets)?$/.test(statement.moduleSpecifier.text)) continue;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const element of bindings.elements) if (/^TYPE_\w+$/.test(element.name.text)) roles.add(element.name.text);
  }
  return roles;
}

/** Actual native text/control nodes, including carriers with no font calls.
 * An omitted font tuple means the framework owns rendering; it is not a fake
 * public role and cannot be discovered by a modifier-count-only gate. */
export function auditNativeTextElements(source, file = '/tmp/NativeTypography.ets') {
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  assert.equal(parsed.parseDiagnostics.length, 0, `${file}: native element AST parsing`);
  const fonts = new Map(auditTypographyConsumers(source,file).map(node => [node.carrierStart,node.modifiers]));
  const attributes = new Map(), result = [], native = new Set(['Text','Span','Button','TextInput','TextArea','Marquee']);
  const rootOf = node => { while(ts.isCallExpression(node)&&node.expression?.expression)node=node.expression.expression;return node; };
  const modifiers = node => { if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)) {
    const root = rootOf(node); if(!attributes.has(root.pos))attributes.set(root.pos,{});
    attributes.get(root.pos)[node.expression.name.text] = node.arguments[0]?.getText(parsed);
  } ts.forEachChild(node,modifiers); };modifiers(parsed);
  const walk = node => { if(ts.isEtsComponentExpression(node)&&ts.isIdentifier(node.expression)&&native.has(node.expression.text)){
    let parent=node;while(parent&&!ts.isMethodDeclaration(parent))parent=parent.parent;
    let textParent=node.parent;while(textParent&&!(ts.isEtsComponentExpression(textParent)&&textParent.expression.getText(parsed)==='Text'))textParent=textParent.parent;
    result.push({kind:node.expression.text,inheritsTextStyle:!!textParent&&Object.keys(fonts.get(textParent.getStart(parsed))??{}).length>0,method:parent?.name?.getText(parsed)??'@module',text:node.arguments[0]?.getText(parsed),
      line:parsed.getLineAndCharacterOfPosition(node.getStart(parsed)).line+1,hasChildContent:!!node.body,
      modifiers:fonts.get(node.getStart(parsed))??{},attributes:attributes.get(node.pos)??{}});
  }ts.forEachChild(node,walk); };walk(parsed);return result;
}
