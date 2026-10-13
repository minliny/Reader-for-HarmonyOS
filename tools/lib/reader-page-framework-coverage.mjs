import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { readerPageBuilderSlots } from './reader-page-builder-slots.mjs';

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
    const source=readSource(file);
    const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
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
      readerPageBuilderSlots(source,statement.name.text);
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
          if (!['header', 'content', 'footer', 'overlayContent'].includes(prop.name?.getText(declaration.tree)) ||
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
        target, node, fields: props.properties.map(prop => prop.name?.getText(declaration.tree)),
        inputFacts: Object.fromEntries(props.properties.map(prop=>[prop.name?.getText(declaration.tree),prop.initializer?.getText(declaration.tree)])) });
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
  // Trace every leaf of the actual Index page dispatcher, not a union of all
  // calls under the route. Shared hosts end this check: their business slots
  // have the separate exact binding/SDK contracts below. The installed SDK
  // supplies the component/Builder AST; no route is evaluated or simulated.
  const nativeContainers = new Set(['Stack', 'Column', 'Row', 'Flex', 'Scroll', 'List', 'Grid']);
  const nativeLeaves = new Set(['Blank', 'Text', 'Image', 'Button', 'TextInput', 'TextArea', 'LoadingProgress']);
  let dispatchFrames = 0;
  const auditUiPath = (node, declaration, chain = []) => {
    if (node === undefined || ts.isArrowFunction(node) || ts.isFunctionExpression(node)) return;
    if (ts.isCallExpression(node) || ts.isEtsComponentExpression(node)) {
      if (ts.isIdentifier(node.expression)) {
        const name = node.expression.text;
        if (['ReaderPageScaffold', 'ReaderStandardPage'].includes(name)) {
          const imported = imports.get(declaration.file).get(name);
          assert.equal(imported?.file, `features/common/${name}.ets`, 'actual dispatcher terminates at the imported common page frame');
          dispatchFrames++;
          return;
        }
        if (name === 'ForEach') {
          for (const argument of node.arguments) if (ts.isArrowFunction(argument)) auditUiPath(argument.body, declaration, chain);
          return;
        }
        const imported = imports.get(declaration.file).get(name);
        const target = imported?.file ? `${imported.file}#${imported.name}#build` : `${declaration.file}#${name}#build`;
        if (declarations.has(target)) {
          assert.ok(!chain.includes(target), 'page dispatcher Builder/component graph must be finite');
          auditUiPath(declarations.get(target).member.body, declarations.get(target), [...chain, target]);
          return;
        }
        if (nativeContainers.has(name)) {
          const before = dispatchFrames;
          auditUiPath(node.body, declaration, chain);
          assert.ok(dispatchFrames > before, 'actual page category/common-host binding removed or changed: bare page dispatcher native container: ' + declaration.file + ':' + name);
          return;
        }
        assert.equal(nativeLeaves.has(name) || ts.isEtsComponentExpression(node) || /^[A-Z]/.test(name), false,
          'actual page category/common-host binding removed or changed: bare/unknown page dispatcher UI leaf: ' + declaration.file + ':' + name);
      } else if (ts.isPropertyAccessExpression(node.expression) && node.expression.expression.kind === ts.SyntaxKind.ThisKeyword) {
        const target = `${declaration.file}#${declaration.owner}#${node.expression.name.text}`;
        const member = declarations.get(target);
        if (member && ts.getAllDecorators(member.member).some(decorator => decorator.getText(member.tree) === '@Builder')) {
          assert.ok(!chain.includes(target), 'page dispatcher Builder/component graph must be finite');
          auditUiPath(member.member.body, member, [...chain, target]);
          return;
        }
      }
    }
    ts.forEachChild(node, child => auditUiPath(child, declaration, chain));
  };
  const dispatcher = declarations.get('pages/Index.ets#Index#build');
  const primaryDispatch = [];
  walk(dispatcher.member.body, node => {
    if (!ts.isIfStatement(node) || !ts.isBinaryExpression(node.expression)) return;
    const expression = node.expression;
    if (expression.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken &&
      ts.isPropertyAccessExpression(expression.left) && expression.left.expression.kind === ts.SyntaxKind.ThisKeyword &&
      expression.left.name.text === 'route' && ts.isStringLiteral(expression.right) && expression.right.text === 'bookshelf') primaryDispatch.push(node);
  });
  assert.equal(primaryDispatch.length, 1, 'actual Index primary page dispatcher is unambiguous');
  let dispatchBranches = 0;
  for (let branch = primaryDispatch[0]; branch; branch = branch.elseStatement && ts.isIfStatement(branch.elseStatement) ? branch.elseStatement : undefined) {
    auditUiPath(branch.thenStatement, dispatcher, ['pages/Index.ets#Index#build']);
    dispatchBranches++;
    if (branch.elseStatement && !ts.isIfStatement(branch.elseStatement)) auditUiPath(branch.elseStatement, dispatcher, ['pages/Index.ets#Index#build']);
  }
  // A route's conditional entry is an independent production surface. A
  // sibling branch reaching a common host cannot prove this branch's wiring.
  const branchEntry = binding => {
    let current = binding.entry, directHostCall, directHostMethod;
    for (const step of binding.entryPath ?? []) {
      assert.equal(step.from, current, 'conditional page path continues from its exact previous actor');
      const declaration = declarations.get(current);
      assert.ok(declaration, 'conditional page entry exists: ' + current);
      let branch = declaration.member.body;
      for (const guard of step.guards ?? [{ condition: step.condition, branch: step.branch }]) {
        const guards = [];
        walk(branch, node => {
          if (ts.isIfStatement(node) && node.expression.getText(declaration.tree) === guard.condition) guards.push(node);
        });
        assert.equal(guards.length, 1, 'exact conditional page branch exists once: ' + current + ':' + guard.condition);
        assert.ok(['then', 'else'].includes(guard.branch), 'finite page branch selects then or else');
        branch = guard.branch === 'then' ? guards[0].thenStatement : guards[0].elseStatement;
        assert.ok(branch, 'actual conditional page branch is present: ' + current + ':' + guard.branch);
      }
      const calls = [];
      walk(branch, node => {
        if (!(ts.isCallExpression(node) || ts.isEtsComponentExpression(node))) return;
        if (step.method !== undefined && ts.isPropertyAccessExpression(node.expression) &&
          node.expression.expression.kind === ts.SyntaxKind.ThisKeyword && node.expression.name.text === step.method) calls.push(node);
        if (step.component !== undefined && ts.isIdentifier(node.expression) && node.expression.text === step.component) calls.push(node);
      });
      assert.equal(calls.length, 1, 'actual conditional page branch mounts its exact actor once: ' + current + ':' + (step.method ?? step.component));
      const call = calls[0];
      if (step.component !== undefined) {
        if (step.component === binding.host) { directHostCall = call; directHostMethod = current; }
        const imported = imports.get(declaration.file).get(step.component);
        assert.ok(imported?.file, 'conditional page component is a real imported actor: ' + step.component);
        current = `${imported.file}#${imported.name}#build`;
        const props = call.arguments[0];
        assert.ok(ts.isObjectLiteralExpression(props), 'conditional page component has actual explicit props');
        for (const [key, expression] of Object.entries(step.inputFacts ?? {})) {
          const field = props.properties.find(prop => prop.name?.getText(declaration.tree) === key);
          assert.equal(field?.initializer?.getText(declaration.tree), expression,
            'exact conditional page fact reaches its selected actor: ' + current + ':' + key);
        }
      } else {
        current = `${declaration.file}#${declaration.owner}#${step.method}`;
      }
      assert.ok(declarations.has(current), 'actual conditional page actor exists: ' + current);
    }
    return { entry: current, directHostCall, directHostMethod };
  };
  const rootStacks = [];
  walk(dispatcher.member.body, node => {
    if (ts.isEtsComponentExpression(node) && node.expression.getText(dispatcher.tree) === 'Stack') rootStacks.push(node);
  });
  const indexBody = rootStacks.sort((left, right) => left.pos - right.pos)[0].body;
  assert.equal(dispatcher.member.body.statements.length, 1, 'Index page dispatch stays inside its one actual canvas; new outside siblings require registration');
  const sideBranches = indexBody.statements.filter(node => ts.isIfStatement(node) && node !== primaryDispatch[0]);
  const normalized = value => value.replace(/\s+/g, '');
  assert.deepEqual(sideBranches.map(node => normalized(node.expression.getText(dispatcher.tree))).sort(),
    contract.sideSurfaces.map(row => normalized(row.condition)).sort(), 'every retained/side page or business-window condition needs its own actual registration');
  const directActors = branch => {
    const actors = [];
    const visit = node => {
      if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) return;
      if (ts.isCallExpression(node) || ts.isEtsComponentExpression(node)) {
        if (ts.isPropertyAccessExpression(node.expression) && node.expression.expression.kind === ts.SyntaxKind.ThisKeyword &&
          declarations.has('pages/Index.ets#Index#' + node.expression.name.text)) {
          const member = declarations.get('pages/Index.ets#Index#' + node.expression.name.text);
          if (ts.getAllDecorators(member.member).some(decorator => decorator.getText(index) === '@Builder')) {
            actors.push({ method: node.expression.name.text }); return;
          }
        }
        if (ts.isIdentifier(node.expression) && /^[A-Z]/.test(node.expression.text)) {
          actors.push({ component: node.expression.text }); return;
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(branch); return actors;
  };
  for (const surface of contract.sideSurfaces) {
    const branch = sideBranches.find(node => normalized(node.expression.getText(index)) === normalized(surface.condition));
    assert.deepEqual(directActors(branch.thenStatement), [surface.actor], 'side entry admits exactly its registered page/window actor');
    if (surface.kind === 'page') auditUiPath(branch.thenStatement, dispatcher, ['pages/Index.ets#Index#build']);
    else {
      assert.equal(surface.kind, 'businessWindow', 'only explicit existing business-window branches bypass ordinary page frames');
      assert.ok(surface.contract && readFileSync(path.join(root, surface.contract), 'utf8').length,
        'business-window branch retains its independent actual SDK contract');
    }
  }
  const directNonPages = indexBody.statements.filter(node => !ts.isIfStatement(node)).flatMap(directActors);
  assert.deepEqual(directNonPages, contract.nonPageActors.map(row => ({ component: row.component })),
    'only the existing runtime debug/execution actors mount outside classified page/window conditions');
  let bindings = 0, routeBindings = 0;
  const verifyBinding = binding => {
      const branch = branchEntry(binding);
      const reachableMethods = reachable(branch.entry);
      assert.ok(declarations.has(binding.entry), 'registered page entry exists: ' + binding.entry);
      assert.ok(reachableMethods.has(binding.hostMethod) || branch.directHostMethod === binding.hostMethod,
        'registered page actually mounts its common host: ' + binding.entry);
      for (const contentEntry of binding.contentEntries ?? []) assert.ok(reachableMethods.has(contentEntry),
        'registered common-host entry actually delegates its conditional content: ' + contentEntry);
      const calls = hosts.get(binding.hostMethod) ?? [];
      const call = calls.find(site => site.component === binding.host && site.variant === binding.variant &&
        (branch.directHostCall === undefined || site.node === branch.directHostCall));
      assert.ok(call, 'actual page category/common-host binding removed or changed: ' + binding.hostMethod);
      assert.equal(call.target, `features/common/${binding.host}.ets#${binding.host}#build`, 'actual page delegates the imported public host');
      assert.ok(call.fields.includes('content'), 'page body is an actual delegated BuilderParam slot');
      for(const[key,expression]of Object.entries(binding.inputFacts??{}))assert.equal(call.inputFacts[key],expression,
        'exact page/runtime fact reaches the public native host: '+binding.hostMethod+':'+key);
      const scaffold = reachable(call.target);
      assert.ok([...scaffold].some(method => method === 'features/common/ReaderPageScaffold.ets#ReaderPageScaffold#build'),
        'all finite page hosts terminate at the one actual scaffold');
      bindings++;
  };
  for (const route of contract.routes) {
    assert.ok(route.category && route.bindings.length > 0, `route ${route.route} has actual implementations`);
    for (const binding of route.bindings) {
      verifyBinding(binding);
      routeBindings++;
    }
  }
  for (const fallback of contract.finiteFallbacks ?? []) {
    assert.equal(fallback.kind, 'finiteFallback', 'nonroute branches are explicitly finite fallbacks');
    assert.ok(fallback.reason && fallback.entryPath?.length > 0, 'fallback has an exact branch and cannot impersonate a route');
    verifyBinding(fallback);
  }
  const fallbackBindings = bindings - routeBindings;
  for (const binding of contract.sideBindings ?? []) verifyBinding(binding);
  return { routes: declaredRoutes.length, bindings, routeBindings,
    fallbackBindings, sideBindings: bindings - routeBindings - fallbackBindings,
    dispatchBranches, sideSurfaces: sideBranches.length, dispatchFrames, declarations: declarations.size };
}
