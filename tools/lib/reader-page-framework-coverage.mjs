import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { installedEtsCompiler } from './ets-compiler-runtime.mjs';
import { readerPageBuilderSlots } from './reader-page-builder-slots.mjs';

const { ts, options } = installedEtsCompiler();
const UNKNOWN = Symbol('runtime fact');
const parseCache = new Map();
const each = (node, visit) => { visit(node); ts.forEachChild(node, child => each(child, visit)); };
const tag = (member, name) => ts.getAllDecorators(member).some(decorator =>
  (ts.isCallExpression(decorator.expression) ? decorator.expression.expression : decorator.expression).getText() === name);
const componentKey = (file, name) => `${file}#${name}`;

/** Source architecture evidence only. Reader's finite route values and literal
 * constructor inputs restrict paths; all other runtime conditions retain both
 * alternatives. Each UI branch is visited independently up to its common frame.
 * No production condition is executed or substituted with a fake UI algorithm. */
export function verifyReaderPageFrameworkCoverage(root, contract,
  readSource = file => readFileSync(path.join(root, 'entry/src/main/ets', file), 'utf8')) {
  assert.equal(contract.schema, 2, 'current page coverage registration schema');
  const files = readdirSync(path.join(root, 'entry/src/main/ets'), { recursive: true }).filter(file => file.endsWith('.ets'));
  const trees = new Map(), owners = new Map(), imports = new Map();
  for (const file of files) {
    const source = readSource(file), key = JSON.stringify([file, source]);
    let tree = parseCache.get(key);
    if (!tree) {
      tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
      assert.deepEqual(tree.parseDiagnostics, [], `${file}: actual page SDK AST`);
      if (parseCache.size >= 768) parseCache.delete(parseCache.keys().next().value);
      parseCache.set(key, tree);
    }
    trees.set(file, tree);
    const local = new Map(); imports.set(file, local);
    for (const statement of tree.statements) {
      if (ts.isImportDeclaration(statement) && statement.moduleSpecifier.text.startsWith('.')) {
        const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), statement.moduleSpecifier.text));
        for (const element of statement.importClause?.namedBindings?.elements ?? [])
          local.set(element.name.text, componentKey(files.find(candidate => candidate === target || candidate === target + '.ets'), element.propertyName?.text ?? element.name.text));
      }
      if (ts.isStructDeclaration(statement)) {
        readerPageBuilderSlots(source, statement.name.text);
        owners.set(componentKey(file, statement.name.text), { file, tree, declaration: statement,
          members: new Map(statement.members.filter(member => member.name).map(member => [member.name.getText(tree), member])) });
      }
    }
  }
  const index = owners.get(contract.entry);
  assert.ok(index?.members.has('build'), 'registered actual application entry');
  const routeType = index.tree.statements.find(node => ts.isTypeAliasDeclaration(node) && node.name.text === contract.routeType);
  assert.ok(routeType && ts.isUnionTypeNode(routeType.type), 'actual finite route type');
  const routes = routeType.type.types.map(node => {
    assert.ok(ts.isLiteralTypeNode(node) && ts.isStringLiteral(node.literal), 'explicit route identities'); return node.literal.text;
  });
  assert.equal(new Set(contract.routes.map(row => row.route)).size, contract.routes.length, 'unique route registration');
  assert.deepEqual([...routes].sort(), contract.routes.map(row => row.route).sort(), 'every actual route requires exactly one registration');
  const frames = new Set(contract.frames), exceptions = new Map();
  for (const row of contract.actors) {
    assert.ok(owners.has(row.component), `registered actual non-page/embedded actor: ${row.component}`);
    assert.ok(row.reason && row.contract && readFileSync(path.join(root, row.contract), 'utf8').length,
      'a finite actor exception retains its own specific contract');
    assert.ok(!exceptions.has(row.component), 'no duplicate actor exception'); exceptions.set(row.component, row);
  }
  const summary = { routes: routes.length, routeBindings: 0, frames: new Set(), actors: new Set(), pages: new Set() };
  const context = (owner, values = new Map(), slots = new Map(), locals = new Map()) => ({ owner, values, slots, locals });
  const boolean = value => value === UNKNOWN ? UNKNOWN : Boolean(value);
  const evaluate = (node, ctx, stack = []) => {
    if (!node) return UNKNOWN;
    if (ts.isParenthesizedExpression(node) || ts.isNonNullExpression(node) || ts.isAsExpression(node)) return evaluate(node.expression, ctx, stack);
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    if (ts.isNumericLiteral(node)) return Number(node.text);
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (node.kind === ts.SyntaxKind.NullKeyword) return null;
    if (ts.isIdentifier(node)) {
      if(node.text==='undefined')return undefined;
      const local=ctx.locals.get(node.text);
      if(local&&Object.hasOwn(local,'constant'))return local.constant;
      return local?.expression&&!stack.includes('local:'+node.text)?evaluate(local.expression,{...ctx,locals:local.locals??ctx.locals},[...stack,'local:'+node.text]):UNKNOWN;
    }
    if (ts.isPropertyAccessExpression(node) && node.expression.kind === ts.SyntaxKind.ThisKeyword)
      return ctx.values.has(node.name.text) ? ctx.values.get(node.name.text) : UNKNOWN;
    if (ts.isPropertyAccessExpression(node) && node.expression.kind!==ts.SyntaxKind.ThisKeyword) {
      const base=evaluate(node.expression,ctx,stack);
      if(base!==UNKNOWN&&base!==null&&typeof base==='object'&&Object.hasOwn(base,node.name.text))return base[node.name.text];
    }
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'HitTestMode')
      return 'enum:HitTestMode.' + node.name.text;
    if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken) {
      const value = boolean(evaluate(node.operand, ctx, stack)); return value === UNKNOWN ? UNKNOWN : !value;
    }
    if (ts.isBinaryExpression(node)) {
      const left = evaluate(node.left, ctx, stack), right = evaluate(node.right, ctx, stack), op = node.operatorToken.kind;
      if (op === ts.SyntaxKind.AmpersandAmpersandToken) {
        if (boolean(left) === false || boolean(right) === false) return false;
        return left === UNKNOWN || right === UNKNOWN ? UNKNOWN : Boolean(left && right);
      }
      if (op === ts.SyntaxKind.BarBarToken) {
        if (boolean(left) === true || boolean(right) === true) return true;
        return left === UNKNOWN || right === UNKNOWN ? UNKNOWN : Boolean(left || right);
      }
      if (left !== UNKNOWN && right !== UNKNOWN) {
        if (op === ts.SyntaxKind.EqualsEqualsEqualsToken) return left === right;
        if (op === ts.SyntaxKind.ExclamationEqualsEqualsToken) return left !== right;
      }
      return UNKNOWN;
    }
    // Finite pure predicate delegation: only an unambiguous return expression
    // is interpreted. Unknown helpers keep both branches; nothing is executed.
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.expression.kind === ts.SyntaxKind.ThisKeyword) {
      const name = node.expression.name.text, member = ctx.owner.members.get(name);
      if (member?.body && !stack.includes(name)) {
        const statements = member.body.statements;
        if (statements.length === 1 && ts.isReturnStatement(statements[0])) {
          const locals=new Map(ctx.locals);
          for(const [position,param]of (member.parameters??[]).entries())if(ts.isIdentifier(param.name))locals.set(param.name.text,{expression:node.arguments[position]??param.initializer,locals:ctx.locals});
          return evaluate(statements[0].expression,{...ctx,locals},[...stack,name]);
        }
      }
    }
    return UNKNOWN;
  };
  const combine = values => values.reduce((out, value) => ({ frames: out.frames + value.frames, opaque: [...out.opaque, ...value.opaque] }), { frames: 0, opaque: [] });
  const result = () => ({ frames: 0, opaque: [] });
  const propsOf = node => node.arguments?.[0] && ts.isObjectLiteralExpression(node.arguments[0]) ? node.arguments[0].properties : [];
  const resolveComponent = (ctx, name) => imports.get(ctx.owner.file).get(name) ?? componentKey(ctx.owner.file, name);
  const childContext = (key, props, caller, body) => {
    const values = new Map(), slots = new Map(), owner = owners.get(key);
    for (const prop of props) if (ts.isPropertyAssignment(prop)) {
      const name = prop.name.getText(caller.owner.tree), member = owner.members.get(name);
      if (member && tag(member, 'BuilderParam') && ts.isArrowFunction(prop.initializer)) slots.set(name, { node: prop.initializer.body, ctx: caller });
      else values.set(name, evaluate(prop.initializer, caller));
    }
    if(body){
      const required=[...owner.members.values()].filter(member=>tag(member,'BuilderParam')&&!member.initializer&&!slots.has(member.name.getText(owner.tree)));
      assert.equal(required.length,1,'trailing UI body binds the one required actual BuilderParam');
      slots.set(required[0].name.getText(owner.tree),{node:body,ctx:caller});
    }
    return context(owner, values, slots);
  };
  const validateFrame = (node, ctx, name) => {
    const props = propsOf(node), names = props.map(prop => prop.name?.getText(ctx.owner.tree));
    assert.ok(names.includes('content'), 'common page frame retains its body slot');
    if (name === 'ReaderPageScaffold') assert.ok(names.includes('frameStyle') && names.includes('geometry'), 'public Scaffold receives explicit feature frameStyle and geometry');
    for (const prop of props) if (['content','header','footer','overlayContent'].includes(prop.name?.getText(ctx.owner.tree)) && ts.isArrowFunction(prop.initializer)) {
      const check = child => {
        if (ts.isArrowFunction(child) || ts.isFunctionExpression(child)) return;
        if ((ts.isCallExpression(child) || ts.isEtsComponentExpression(child)) && ts.isIdentifier(child.expression) && /^[A-Z]/.test(child.expression.text))
          assert.fail('bare UI component inside shared BuilderParam requires an actual Builder');
        ts.forEachChild(child, check);
      };
      check(prop.initializer.body);
    }
  };
  const windowOwner = (member, ctx) => {
    const found = new Set(); let unexpectedUI=false;
    const scan = node => {
      if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) return;
      if ((ts.isCallExpression(node) || ts.isEtsComponentExpression(node)) && ts.isIdentifier(node.expression)) {
        if (['ForEach','LazyForEach'].includes(node.expression.text)) {
          const body=node.arguments.find(ts.isArrowFunction)?.body;if(body)scan(body);return;
        }
        const key=resolveComponent(ctx,node.expression.text);
        if(exceptions.get(key)?.kind==='businessWindow')found.add(key);
        else if(/^[A-Z]/.test(node.expression.text)&&!['Stack','Column','Row','Flex','Scroll','List','Grid'].includes(node.expression.text))unexpectedUI=true;
      }
      ts.forEachChild(node,scan);
    };
    scan(member.body);return unexpectedUI?[]:[...found];
  };
  const visit = (node, ctx, framed, chain, reached) => {
    if (!node || ts.isArrowFunction(node) || ts.isFunctionExpression(node)) return result();
    if (ts.isBlock(node)) return combine(node.statements.map(child => visit(child, ctx, framed, chain, reached)));
    if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) if (ts.isIdentifier(declaration.name)) ctx.locals.set(declaration.name.text, {expression:declaration.initializer});
      return result();
    }
    if (ts.isIfStatement(node)) {
      const value = boolean(evaluate(node.expression, ctx));
      return combine([...(value === false ? [] : [visit(node.thenStatement, { ...ctx, locals: new Map(ctx.locals) }, framed, chain, reached)]),
        ...(value === true ? [] : [visit(node.elseStatement, { ...ctx, locals: new Map(ctx.locals) }, framed, chain, reached)])]);
    }
    if (ts.isExpressionStatement(node)) return visit(node.expression, ctx, framed, chain, reached);
    if (ts.isCallExpression(node) || ts.isEtsComponentExpression(node)) {
      if (ts.isPropertyAccessExpression(node.expression)) {
        const base = node.expression.expression, name = node.expression.name.text;
        if (base.kind === ts.SyntaxKind.ThisKeyword) {
          if (ctx.slots.has(name)) { const slot = ctx.slots.get(name); return visit(slot.node, slot.ctx, framed, chain, reached); }
          const member = ctx.owner.members.get(name);
          if (member?.body) {
            // A method directly composing a registered modal owner is that
            // finite business-window assembly. Its native scrim is not a page
            // frame; a renamed/extracted helper retains the same owner edge.
            const windows=windowOwner(member,ctx);
            if(windows.length){for(const key of windows)summary.actors.add(key);return{frames:0,opaque:['businessWindow']};}
            const key = `${componentKey(ctx.owner.file, ctx.owner.declaration.name.text)}#${name}`;
            assert.ok(!chain.includes(key), 'finite page Builder graph');
            const locals=new Map(ctx.locals);
            for(const [position,param]of (member.parameters??[]).entries())if(ts.isIdentifier(param.name)){
              const expression=node.arguments[position]??param.initializer;
              locals.set(param.name.text,{expression,locals:ctx.locals});
            }
            return visit(member.body, { ...ctx, locals }, framed, [...chain, key], reached);
          }
          // An unprovided BuilderParam uses its actual default empty Builder.
          if (member?.initializer && tag(member, 'BuilderParam') && ts.isPropertyAccessExpression(member.initializer)) {
            const fallback = ctx.owner.members.get(member.initializer.name.text); return visit(fallback?.body, ctx, framed, chain, reached);
          }
          return result();
        }
        // Native modifier chains have one base UI actor. Their event arguments
        // do not execute during composition and cannot create page evidence.
        if (ts.isCallExpression(base) || ts.isEtsComponentExpression(base)) {
          const value = visit(base, ctx, framed, chain, reached);
          if (!framed && value.frames === 0 && value.opaque.length && value.opaque.every(kind => kind === 'nonmodalFeedback')) {
            if (name === 'height') assert.fail('quiet feedback cannot claim a fixed/full-screen height');
            if (name === 'hitTestBehavior') assert.equal(evaluate(node.arguments[0], ctx), 'enum:HitTestMode.Transparent', 'quiet feedback cannot mask page input');
          }
          return value;
        }
      }
      if (ts.isIdentifier(node.expression)) {
        const name = node.expression.text;
        if (name === 'ForEach' || name === 'LazyForEach') return combine(node.arguments.filter(ts.isArrowFunction).slice(0, 1).map(argument => visit(argument.body, ctx, framed, chain, reached)));
        const key = resolveComponent(ctx, name), owner = owners.get(key), exception = exceptions.get(key);
        if (owner) {
          for(const rule of contract.forwardedInputs??[])if(rule.from===componentKey(ctx.owner.file,ctx.owner.declaration.name.text)&&rule.component===key){
            const field=propsOf(node).find(prop=>prop.name?.getText(ctx.owner.tree)===rule.prop);
            assert.ok(field?.initializer,'actual page/runtime input remains present: '+key+'.'+rule.prop);
            for(const sample of rule.samples){
              const values=new Map(ctx.values);for(const [name,value]of Object.entries(sample.fields))values.set(name,value);
              assert.deepEqual(evaluate(field.initializer,{...ctx,values}),sample.expected,'actual page/runtime input preserves its owner fact: '+key+'.'+rule.prop);
            }
          }
          reached.add(key); summary.pages.add(key);
          if (frames.has(key)) {
            validateFrame(node, ctx, name); summary.frames.add(key);
            // Follow bound body slots as already framed; component bodies then
            // terminate at their own boundary. This records shelf/results pages
            // without auditing every native control inside their implementation.
            const child = childContext(key, propsOf(node), ctx, node.body);
            for (const slot of child.slots.values()) visit(slot.node, slot.ctx, true, chain, reached);
            return { frames: 1, opaque: [] };
          }
          if (exception) {
            summary.actors.add(key);
            const child = childContext(key, propsOf(node), ctx, node.body);
            for (const name of exception.slots ?? []) {
              const slot = child.slots.get(name); assert.ok(slot, `embedded actor retains its registered body slot ${key}.${name}`);
              visit(slot.node, slot.ctx, framed, chain, reached);
            }
            return { frames: 0, opaque: [exception.kind] };
          }
          if (framed) return result();
          const member = owner.members.get('build'); assert.ok(member?.body, `actual component build ${key}`);
          assert.ok(!chain.includes(key), 'finite page component graph');
          return visit(member.body, childContext(key, propsOf(node), ctx, node.body), false, [...chain, key], reached);
        }
        if (node.body) {
          assert.ok(framed || ['Stack','Column','Row','Flex','Scroll','List','Grid'].includes(name), 'category/common-host binding removed: bare native page actor '+name);
          const nested=visit(node.body,ctx,framed,chain,reached);
          assert.ok(framed || nested.frames>0 || nested.opaque.length>0,'category/common-host binding removed: empty/private native page container '+ctx.owner.file+':'+name);
          return nested;
        }
        if (/^[A-Z]/.test(name)) assert.ok(framed, 'category/common-host binding removed: bare/unknown page UI leaf ' + ctx.owner.file + ':' + name);
      }
      return result();
    }
    return result();
  };
  for (const row of contract.routes) {
    const reached = new Set(), stats = visit(index.members.get('build').body, context(index, new Map([['route', row.route]])), false, [contract.entry], reached);
    assert.ok(stats.frames > 0, `actual page route ${row.route} retains a common frame`);
    assert.ok(row.pages.length, `route ${row.route} has actual page witnesses`);
    for (const key of row.pages) { assert.ok(reached.has(key), `registered page actually mounts for route ${row.route}: ${key}`); summary.routeBindings++; }
  }
  for (const row of contract.standalone ?? []) {
    const owner = owners.get(row.component); assert.ok(owner, 'actual standalone fallback');
    const stats = visit(owner.members.get('build').body, context(owner, new Map(Object.entries(row.props))), false, [row.component], new Set());
    assert.ok(stats.frames > 0, 'actual bounded fallback retains common-host binding');
  }
  // The StandardPage public adapter still terminates at the single Scaffold.
  const standard = owners.get('features/common/ReaderStandardPage.ets#ReaderStandardPage');
  let scaffold = 0; each(standard.members.get('build'), node => {
    if ((ts.isCallExpression(node) || ts.isEtsComponentExpression(node)) && ts.isIdentifier(node.expression) && resolveComponent({ owner: standard }, node.expression.text) === 'features/common/ReaderPageScaffold.ets#ReaderPageScaffold') { validateFrame(node, context(standard), node.expression.text); scaffold++; }
  });
  assert.equal(scaffold, 1, 'one public StandardPage-to-Scaffold owner');
  return { routes: routes.length, routeBindings: summary.routeBindings, frameOwners: [...summary.frames], registeredActors: [...summary.actors], pageActors: [...summary.pages] };
}
