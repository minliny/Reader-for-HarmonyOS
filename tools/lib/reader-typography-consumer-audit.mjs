import assert from 'node:assert/strict';
import path from 'node:path';
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
        let owner = node;
        while (owner && !ts.isStructDeclaration(owner) && !ts.isClassDeclaration(owner)) owner = owner.parent;
        record = { owner: owner?.name?.text, carrierStart: root.getStart(parsed), method: parent?.name?.getText(parsed) ?? '@Styles', kind: root.expression?.getText(parsed),
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

/** Finite real getter bindings. A method name or common-folder location is
 * never sufficient. Current producers are admitted only when the actual SDK
 * AST getter returns the imported finite resolver / public role alternatives.
 * Their producer implementations, variants and propagation have separate
 * actual-source/SDK contracts; this closes local helper-name laundering. */
const getterPolicies = {
  'ReaderActionMenuSurface.ets': { owner: 'ReaderActionMenuSurface', getter: 'spec', resolver: 'resolvePopupSpec', module: 'ReaderSurfaceSpecs', argument: 'this.specId', fields: ['actionFontFamily','actionFontWeight','actionFontSize','actionLineHeight'],
    additionalGetters: [{ getter: 'actionSheetSpec', resolver: 'resolveActionSheetSpec', module: 'ReaderSurfaceSpecs', argument: "this.variant === 'quick' ? 'quick' : 'grouped'", fields: [
      'sectionHeadingFontSize', 'sectionHeadingLineHeight', 'quickLabelFontSize', 'quickLabelLineHeight',
      'quickSecondaryFontSize', 'quickSecondaryLineHeight', 'labelFontSize', 'labelLineHeight',
      'secondaryFontSize', 'secondaryLineHeight', 'trailingFontSize', 'trailingLineHeight',
      'regularFontFamily', 'emphasisFontFamily', 'regularFontWeight', 'emphasisFontWeight',
    ] }] },
  'ReaderDialogSurface.ets': { owner: 'ReaderDialogSurface', getter: 'spec', resolver: 'resolveDialogSpec', module: 'ReaderSurfaceSpecs', argument: 'this.specId', fields: ['headerFontFamily','headerFontWeight','headerFontSize','headerLineHeight'] },
  'ReaderBoundedSurfaceHeader.ets': { owner: 'ReaderBoundedSurfaceHeader', getter: 'drawerSpec', resolver: 'resolveDrawerSpec', module: 'ReaderSurfaceSpecs', argument: "'reader-action-sheet'", fields: [
    'titleFontFamily', 'titleFontWeight', 'titleFontSize', 'titleLineHeight',
    'sideTitleFontFamily', 'sideTitleFontWeight', 'sideTitleFontSize', 'sideTitleLineHeight',
    'titleMinFontScale', 'titleMaxFontScale',
  ] },
  'ReaderChoiceRow.ets': { owner: 'ReaderChoiceRow', getter: 'spec', resolver: 'resolveReaderChoiceSpec', module: 'ReaderChoiceSpecs', argument: 'this.specId', fields: ['selectedWeight','text','selectedText'], textGetter: 'textStyle' },
  'ReaderSearchField.ets': { owner: 'ReaderSearchField', getter: 'textStyle', roles: ['TYPE_SEARCH_SOURCE_INPUT','TYPE_SEARCH_DIRECTORY_INPUT','TYPE_SEARCH_MANGA_DIRECTORY_INPUT','TYPE_SEARCH_READER_QUICK_INPUT'], fields: ['fontFamily','fontWeight','fontSizeFp','lineHeightFp','letterSpacingFp'] },
};
const roleFields = ['fontFamily','fontWeight','fontSizeFp','lineHeightFp','letterSpacingFp'];
export function typographyExpressionContext(source, file) {
  const tree = ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);
  assert.equal(tree.parseDiagnostics.length,0,file+': getter binding SDK AST');
  const normalized=file.replaceAll('\\','/');
  // Full / relative production paths are accepted; basename-only test fixtures
  // cannot impersonate a producer from an unrelated folder.
  const policy = /(?:^|\/)common\//.test(normalized) ? getterPolicies[path.basename(normalized)] : undefined;
  const bindings = new Map();
  if (!policy) return { bindings };
  const owner=tree.statements.find(n=>ts.isStructDeclaration(n)&&n.name.text===policy.owner);
  if (!owner) return { bindings };
  const methods=new Map(owner.members.filter(ts.isMethodDeclaration).map(n=>[n.name.getText(tree),n]));
  const imports=new Map();
  for(const n of tree.statements)if(ts.isImportDeclaration(n)&&ts.isNamedImports(n.importClause?.namedBindings))
    for(const e of n.importClause.namedBindings.elements)imports.set(e.name.text,{ exported:(e.propertyName??e.name).text,module:n.moduleSpecifier.text });
  const bind=(name,fields)=>bindings.set(policy.owner+'#'+name,new Set(fields));
  for (const getterPolicy of policy.additionalGetters ?? []) {
    const imported=imports.get(getterPolicy.resolver),getter=methods.get(getterPolicy.getter),statements=getter?.body?.statements;
    const returned=statements?.length===1&&ts.isReturnStatement(statements[0])?statements[0].expression:undefined;
    if(imported?.exported===getterPolicy.resolver&&imported.module==='./'+getterPolicy.module&&
      ts.isCallExpression(returned)&&ts.isIdentifier(returned.expression)&&returned.expression.text===getterPolicy.resolver&&
      returned.arguments.length===1&&returned.arguments[0].getText(tree)===getterPolicy.argument) bind(getterPolicy.getter,getterPolicy.fields);
  }
  if(policy.resolver){
    const imported=imports.get(policy.resolver),getter=methods.get(policy.getter);
    const statements=getter?.body?.statements;
    const returned=statements?.length===1&&ts.isReturnStatement(statements[0])?statements[0].expression:undefined;
    const validImport=imported?.exported===policy.resolver&&imported.module==='./'+policy.module;
    const validReturn=ts.isCallExpression(returned)&&ts.isIdentifier(returned.expression)&&returned.expression.text===policy.resolver&&
      returned.arguments.length===1&&returned.arguments[0].getText(tree)===policy.argument;
    if(validImport&&validReturn)bind(policy.getter,policy.fields);
    if(policy.textGetter&&bindings.has(policy.owner+'#'+policy.getter)){
      const returned=methods.get(policy.textGetter)?.body?.statements;
      const expression=returned?.length===1&&ts.isReturnStatement(returned[0])?returned[0].expression:undefined;
      if(ts.isConditionalExpression(expression)&&expression.condition.getText(tree)==='this.selected'&&
        expression.whenTrue.getText(tree)==='this.spec().selectedText'&&expression.whenFalse.getText(tree)==='this.spec().text')
        bind(policy.textGetter,roleFields);
    }
  }else{
    const getter=methods.get(policy.getter),seen=[];
    const validStatement=n=>{
      if(ts.isReturnStatement(n)&&ts.isIdentifier(n.expression)){seen.push(n.expression.text);return policy.roles.includes(n.expression.text)&&
        imports.get(n.expression.text)?.exported===n.expression.text&&imports.get(n.expression.text)?.module==='./ReaderTypography';}
      if(ts.isBlock(n))return n.statements.length===1&&validStatement(n.statements[0]);
      if(ts.isIfStatement(n))return !n.elseStatement&&/^(?:this\.variant === '(?:sourceManagement|readerDirectory|mangaDirectory)')$/.test(n.expression.getText(tree))&&validStatement(n.thenStatement);
      return false;
    };
    if(getter?.body?.statements.length===4&&getter.body.statements.every(validStatement)&&
      new Set(seen).size===policy.roles.length)bind(policy.getter,policy.fields);
  }
  return { bindings };
}

/** Recognise complete role/spec arguments, rather than a TYPE_ substring.
 * Mixed public/private ternaries and page-local numeric overrides stay debt.
 * Proportional cover geometry and the reader's existing bounded interpolation
 * may use public role endpoints. Numeric/mixed endpoint overrides stay debt. */
export function isSharedTypographyExpression(expression, context, owner) {
  if (expression === 'TYPE_SHELF_COVER_PLACEHOLDER.fontSizeFp * this.coverWidth / 96.96' ||
      expression === '(TYPE_SHELF_COVER_PLACEHOLDER.lineHeightFp as number) * this.coverWidth / 96.96') return true;
  const parsed = ts.createSourceFile('/tmp/TypographyArgument.ts', `const value = (${expression});`, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (parsed.parseDiagnostics.length) return false;
  const root = parsed.statements[0]?.declarationList?.declarations[0]?.initializer;
  const visit = node => {
    if (!node) return false;
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node)) return visit(node.expression);
    if (ts.isConditionalExpression(node)) return visit(node.whenTrue) && visit(node.whenFalse);
    // A native symbol's fixed geometry uses a public size with an explicit
    // platform unit. Only the exact no-argument numeric conversion is allowed;
    // mixed arithmetic or private operands remain rejected.
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken &&
        ts.isStringLiteral(node.right) && node.right.text === 'vp' &&
        ts.isCallExpression(node.left) && node.left.arguments.length === 0 &&
        ts.isPropertyAccessExpression(node.left.expression) && node.left.expression.name.text === 'toString') {
      const size = node.left.expression.expression;
      return ts.isPropertyAccessExpression(size) && size.name.text === 'fontSizeFp' && visit(size);
    }
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
          callee.arguments.length === 0 && context?.bindings) {
        const key = owner ? owner + '#' + callee.expression.name.text : undefined;
        if (key) return context.bindings.get(key)?.has(node.name.text) === true;
        const qualified = [...context.bindings].filter(([name]) => name.endsWith('#' + callee.expression.name.text));
        return qualified.length === 1 && qualified[0][1].has(node.name.text);
      }
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
    const first = node.arguments[0];
    const unlabelledNormalButton = node.expression.text === 'Button' && !!node.body && first !== undefined &&
      ts.isObjectLiteralExpression(first) && first.properties.length === 1 &&
      ts.isPropertyAssignment(first.properties[0]) && first.properties[0].name.getText(parsed) === 'type' &&
      first.properties[0].initializer.getText(parsed) === 'ButtonType.Normal';
    result.push({kind:node.expression.text,unlabelledNormalButton,inheritsTextStyle:!!textParent&&Object.keys(fonts.get(textParent.getStart(parsed))??{}).length>0,method:parent?.name?.getText(parsed)??'@module',text:node.arguments[0]?.getText(parsed),
      line:parsed.getLineAndCharacterOfPosition(node.getStart(parsed)).line+1,hasChildContent:!!node.body,
      modifiers:fonts.get(node.getStart(parsed))??{},attributes:attributes.get(node.pos)??{}});
  }ts.forEachChild(node,walk); };walk(parsed);return result;
}
