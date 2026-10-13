import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const sdk = process.env.READER_ETS_LOADER_ROOT ??
  '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts = createRequire(import.meta.url)(`${sdk}/node_modules/typescript`);
const options = createRequire(import.meta.url)(`${sdk}/lib/ets_checker.js`).compilerOptions;
const walk = (node, visit) => { visit(node); ts.forEachChild(node, child => walk(child, visit)); };

/** Reverse registration uses real installed-SDK AST/import/call edges. The
 * fixture is a finite list of route implementations, never a regex whitelist
 * or a common-directory exemption. Conditional paths are audited independently
 * of the current product visibility profile. */
export function verifyReaderPageFrameworkCoverage(root, contract,
  readSource = file => readFileSync(path.join(root, 'entry/src/main/ets', file), 'utf8')) {
  const sources = readdirSync(path.join(root, 'entry/src/main/ets'), { recursive: true })
    .filter(file => file.endsWith('.ets'));
  const trees = new Map(), declarations = new Map(), imports = new Map(), graph = new Map(), hosts = new Map();
  for (const file of sources) {
    const tree = ts.createSourceFile(file, readSource(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
    assert.deepEqual(tree.parseDiagnostics, [], `${file}: page-contract SDK AST`);
    trees.set(file, tree);
    const localImports = new Map(); imports.set(file, localImports);
    for (const statement of tree.statements) {
      if (ts.isImportDeclaration(statement) && statement.moduleSpecifier.text.startsWith('.')) {
        const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), statement.moduleSpecifier.text));
        for (const element of statement.importClause?.namedBindings?.elements ?? [])
          localImports.set(element.name.text, { file: sources.find(candidate => candidate === target || candidate === target + '.ets'),
            name: element.propertyName?.text ?? element.name.text });
      }
      if (!ts.isStructDeclaration(statement)) continue;
      for (const member of statement.members.filter(ts.isMethodDeclaration))
        declarations.set(`${file}#${statement.name.text}#${member.name.getText(tree)}`, { file, tree, owner: statement.name.text, member });
    }
  }
  const index = trees.get('pages/Index.ets');
  const routes = index.statements.find(node => ts.isTypeAliasDeclaration(node) && node.name.text === 'ReaderRoute');
  assert.ok(routes && ts.isUnionTypeNode(routes.type), 'actual Index declares the finite ReaderRoute union');
  const declaredRoutes = routes.type.types.map(node => {
    assert.ok(ts.isLiteralTypeNode(node) && ts.isStringLiteral(node.literal), 'route members are explicit literals');
    return node.literal.text;
  });
  assert.deepEqual([...declaredRoutes].sort(), contract.routes.map(route => route.route).sort(),
    'every actual route requires exactly one page-framework category registration');
  assert.equal(new Set(contract.routes.map(route => route.route)).size, contract.routes.length, 'no duplicate route witness');
  for (const [key, declaration] of declarations) {
    const edges = new Set(); graph.set(key, edges);
    const hostCalls = []; hosts.set(key, hostCalls);
    walk(declaration.member.body, node => {
      if (ts.isPropertyAccessExpression(node) && node.expression.kind === ts.SyntaxKind.ThisKeyword) {
        const target = `${declaration.file}#${declaration.owner}#${node.name.text}`;
        if (declarations.has(target)) edges.add(target);
      }
      if (!(ts.isCallExpression(node) || ts.isEtsComponentExpression(node)) || !ts.isIdentifier(node.expression)) return;
      const name = node.expression.text, imported = imports.get(declaration.file).get(name);
      const target = imported?.file ? `${imported.file}#${imported.name}#build` : `${declaration.file}#${name}#build`;
      if (declarations.has(target)) edges.add(target);
      if (['ReaderPageScaffold', 'ReaderStandardPage', 'ReaderFixedHeaderHost', 'MainTabShell'].includes(name)) {
        const props = node.arguments[0];
        if (props && ts.isObjectLiteralExpression(props)) for (const prop of props.properties) {
          if (!['header', 'content', 'footer', 'overlay'].includes(prop.name?.getText(declaration.tree)) ||
            !ts.isArrowFunction(prop.initializer)) continue;
          walk(prop.initializer.body, child => {
            if (!ts.isCallExpression(child) || !ts.isIdentifier(child.expression)) return;
            const identifier = child.expression.text, importTarget = imports.get(declaration.file).get(identifier);
            const component = importTarget?.file ? `${importTarget.file}#${importTarget.name}#build` :
              `${declaration.file}#${identifier}#build`;
            assert.equal(declarations.has(component) || ['Column','Row','Stack','Scroll','List','Text','Image','Button'].includes(identifier), false,
              'bare UI component inside shared BuilderParam must delegate through a real @Builder: ' + declaration.file + ':' + identifier);
          });
        }
      }
      if (!['ReaderPageScaffold', 'ReaderStandardPage'].includes(name)) return;
      const props = node.arguments[0];
      assert.ok(props && ts.isObjectLiteralExpression(props), 'common page host uses explicit props');
      const variant = props.properties.find(prop => prop.name?.getText(declaration.tree) === 'variant');
      const raw = variant?.initializer;
      hostCalls.push({ component: name, variant: ts.isStringLiteral(raw) ? raw.text : raw?.getText(declaration.tree),
        target, fields: props.properties.map(prop => prop.name?.getText(declaration.tree)) });
    });
  }
  const reachable = start => {
    const seen = new Set(), pending = [start];
    while (pending.length) {
      const current = pending.pop(); if (seen.has(current)) continue; seen.add(current);
      for (const next of graph.get(current) ?? []) pending.push(next);
    }
    return seen;
  };
  let bindings = 0;
  for (const route of contract.routes) {
    assert.ok(route.category && route.bindings.length > 0, `route ${route.route} has actual implementations`);
    for (const binding of route.bindings) {
      const reachableMethods = reachable(binding.entry);
      assert.ok(declarations.has(binding.entry), 'registered page entry exists: ' + binding.entry);
      assert.ok(reachableMethods.has(binding.hostMethod), 'registered page actually mounts its common host: ' + binding.entry);
      for (const contentEntry of binding.contentEntries ?? []) assert.ok(reachableMethods.has(contentEntry),
        'registered common-host entry actually delegates its conditional content: ' + contentEntry);
      const calls = hosts.get(binding.hostMethod) ?? [];
      const call = calls.find(site => site.component === binding.host && site.variant === binding.variant);
      assert.ok(call, 'actual page category/common-host binding removed or changed: ' + binding.hostMethod);
      assert.equal(call.target, `features/common/${binding.host}.ets#${binding.host}#build`, 'actual page delegates the imported public host');
      assert.ok(call.fields.includes('content'), 'page body is an actual delegated BuilderParam slot');
      const scaffold = reachable(call.target);
      assert.ok([...scaffold].some(method => method === 'features/common/ReaderPageScaffold.ets#ReaderPageScaffold#build'),
        'all finite page hosts terminate at the one actual scaffold');
      bindings++;
    }
  }
  return { routes: declaredRoutes.length, bindings, declarations: declarations.size };
}
