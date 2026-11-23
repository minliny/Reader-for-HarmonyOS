import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, extname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installedEtsCompiler } from './lib/ets-compiler-runtime.mjs';

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const defaultInventory = 'tools/page-structure/overlay-assembly-contracts.json';
const frameSlots = {
  ReaderPageScaffold: ['header', 'content', 'footer', 'overlayContent'],
  ReaderStandardPage: ['header', 'content', 'nativeListItems', 'footer', 'overlayContent', 'boundedOverlayContent'],
  MainTabShell: ['header', 'content', 'overlayContent', 'scrollOverlayContent', 'boundedOverlayContent'],
  SettingsShell: ['homeContent', 'generalContent', 'overlayContent', 'boundedOverlayContent'],
  BookshelfShell: ['content'],
};
const overlayComponents = new Set([
  'ReaderRecoveryGroup', 'ReaderRecoveryNotice', 'ReaderDirectoryRecoverySurface', 'RssOriginalRecoverySurface',
  'ReaderTransientToast', 'ReaderDialogSurface', 'ReaderSelectPanel', 'ReaderSheetChrome',
]);
const detachedMethods = new Set(['bindPopup', 'bindSheet', 'bindContentCover', 'overlay']);
const overlaySlot = slot => ['overlayContent', 'boundedOverlayContent', 'scrollOverlayContent', 'stackedOverlay'].includes(slot);
const contentSlot = slot => ['content', 'nativeListItems', 'homeContent', 'generalContent'].includes(slot);
const digest = source => createHash('sha256').update(source).digest('hex');

function sourcePath(path) {
  if (typeof path !== 'string' || isAbsolute(path) || path.includes('..') ||
    !path.startsWith('entry/src/main/ets/') || !['.ets', '.ts'].includes(extname(path)))
    throw new Error(`Shipping source path required: ${path}`);
  return path;
}

/** Inspects declared Builder assembly and explicitly named base-geometry methods.
 * The installed ETS parser is the only parser. This does not execute Builders,
 * infer Native hit arbitration, or certify arbitrary runtime callback values. */
export function inspectOverlayAssembly({ files, sourceOverrides = new Map(), geometryContracts = [], localContentContracts = [],
  checkedSlots = [...new Set(Object.values(frameSlots).flat())] }) {
  if (!Array.isArray(files) || files.length === 0 || new Set(files).size !== files.length)
    throw new Error('Select a nonempty unique source file list');
  files.forEach(sourcePath);
  if (!(sourceOverrides instanceof Map)) throw new Error('Source overrides must be an explicit Map');
  const allSlots = new Set(Object.values(frameSlots).flat());
  if (!Array.isArray(checkedSlots) || checkedSlots.length === 0 || new Set(checkedSlots).size !== checkedSlots.length ||
    checkedSlots.some(slot => !allSlots.has(slot))) throw new Error('Select unique declared frame slots');
  for (const contract of geometryContracts) {
    if (typeof contract.owner !== 'string' || !Array.isArray(contract.methods) || contract.methods.length === 0 ||
      !Array.isArray(contract.overlayMembers) || contract.overlayMembers.length === 0)
      throw new Error('Geometry contracts require an owner, explicit methods and overlay members');
  }
  for (const contract of localContentContracts) {
    sourcePath(contract.file);
    if (!files.includes(contract.file) || typeof contract.owner !== 'string' ||
      !Array.isArray(contract.methods) || contract.methods.length === 0)
      throw new Error('Local content contracts require an explicitly selected file, owner and body Builders');
  }
  const { ts, options, require, root: sdkRoot } = installedEtsCompiler();
  const sdkComponents = require(`${sdkRoot}/lib/component_map.js`);
  const nativeComponents = new Set([
    ...sdkComponents.INNER_COMPONENT_NAMES, ...sdkComponents.BUILDIN_CONTAINER_COMPONENT,
    ...sdkComponents.AUTOMIC_COMPONENT, ...sdkComponents.JS_BIND_COMPONENTS,
  ]);
  const modules = new Map(), diagnostics = [], slots = [], detached = [], genericSlots = [];
  const diagnosticKeys = new Set();

  function report(rule, module, node, details) {
    const row = { rule, file: module.path,
      line: module.tree.getLineAndCharacterOfPosition(node?.getStart(module.tree) ?? 0).line + 1, ...details };
    const key = JSON.stringify(row);
    if (!diagnosticKeys.has(key)) { diagnosticKeys.add(key); diagnostics.push(row); }
  }

  function load(path) {
    if (modules.has(path)) return modules.get(path);
    const source = sourceOverrides.has(path) ? sourceOverrides.get(path) : readFileSync(resolve(repository, path), 'utf8');
    const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true,
      extname(path) === '.ets' ? ts.ScriptKind.ETS : ts.ScriptKind.TS, options);
    const module = { path, source, tree, declarations: new Map(), imports: new Map() };
    modules.set(path, module);
    for (const error of tree.parseDiagnostics ?? [])
      report('PARSE', module, undefined, { message: ts.flattenDiagnosticMessageText(error.messageText, ' ') });
    for (const statement of tree.statements) {
      if (statement.name && statement.members) {
        const members = new Map(statement.members.filter(member => member.name)
          .map(member => [member.name.getText(tree).replace(/^['"]|['"]$/g, ''), member]));
        module.declarations.set(statement.name.text, { module, node: statement, name: statement.name.text, members });
      }
      if (ts.isImportDeclaration(statement) && statement.importClause?.namedBindings &&
        ts.isNamedImports(statement.importClause.namedBindings)) {
        for (const element of statement.importClause.namedBindings.elements)
          module.imports.set(element.name.text, { specifier: statement.moduleSpecifier.text,
            exported: element.propertyName?.text ?? element.name.text });
      }
    }
    return module;
  }

  function resolveImport(module, name) {
    if (module.declarations.has(name)) return module.declarations.get(name);
    const imported = module.imports.get(name);
    if (!imported?.specifier.startsWith('.')) return undefined;
    const stem = resolve(repository, dirname(module.path), imported.specifier);
    const target = [stem + '.ets', stem + '.ts', stem + '/index.ets'].find(path =>
      sourceOverrides.has(relative(repository, path)) || existsSync(path));
    if (!target) return undefined;
    return load(relative(repository, target)).declarations.get(imported.exported);
  }

  function nameOf(node, module) { return node?.getText(module.tree).replace(/^['"]|['"]$/g, ''); }
  function decoratorNames(member, module) {
    if (!member?.kind) return [];
    return ts.getAllDecorators(member).map(decorator =>
      nameOf(ts.isCallExpression(decorator.expression) ? decorator.expression.expression : decorator.expression, module));
  }
  function thisMember(expression) {
    return ts.isPropertyAccessExpression(expression) && expression.expression.kind === ts.SyntaxKind.ThisKeyword ?
      expression.name.text : undefined;
  }
  function initializerMap(node) {
    return node && ts.isObjectLiteralExpression(node) ? new Map(node.properties.filter(ts.isPropertyAssignment)
      .map(property => [property.name.getText().replace(/^['"]|['"]$/g, ''), property.initializer])) : new Map();
  }

  function branchFacts(condition, truth, owner, previous) {
    const facts = new Map(previous ?? []);
    function add(key, value, equal) {
      const old = facts.get(key) ?? { excluded: new Set() };
      if (equal && ((old.value !== undefined && old.value !== value) || old.excluded.has(value))) return false;
      if (!equal && old.value === value) return false;
      facts.set(key, equal ? { ...old, value } : { ...old, excluded: new Set([...old.excluded, value]) });
      return true;
    }
    function literal(node) {
      if (ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return `${node.kind}:${node.text}`;
      if ([ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword, ts.SyntaxKind.NullKeyword].includes(node.kind)) return String(node.kind);
      return undefined;
    }
    function typeOwner(module, type) {
      if (!type) return undefined;
      if (ts.isUnionTypeNode(type)) {
        const candidates = type.types.filter(node => ts.isTypeReferenceNode(node) || ts.isTypeLiteralNode(node));
        return candidates.length === 1 ? typeOwner(module, candidates[0]) : undefined;
      }
      if (ts.isTypeReferenceNode(type)) return resolveImport(module, type.typeName.getText(module.tree));
      if (ts.isTypeLiteralNode(type)) return { module, members: new Map(type.members.filter(member => member.name)
        .map(member => [member.name.getText(module.tree), member])) };
      return undefined;
    }
    function declaredBoolean(node) {
      const path = [];
      let current = node;
      while (ts.isPropertyAccessExpression(current)) { path.unshift(current.name.text); current = current.expression; }
      if (current.kind !== ts.SyntaxKind.ThisKeyword || path.length === 0) return false;
      let declaration = owner, type;
      for (const name of path) {
        const member = declaration?.members.get(name);
        if (!member?.type) return false;
        type = member.type;
        declaration = typeOwner(declaration.module, type);
      }
      return type.kind === ts.SyntaxKind.BooleanKeyword ||
        (ts.isUnionTypeNode(type) && type.types.every(item =>
          [ts.SyntaxKind.BooleanKeyword, ts.SyntaxKind.UndefinedKeyword].includes(item.kind)));
    }
    function collect(node, expected) {
      if (ts.isParenthesizedExpression(node)) return collect(node.expression, expected);
      if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken) return collect(node.operand, !expected);
      if (!ts.isBinaryExpression(node)) {
        if (ts.isPropertyAccessExpression(node) && declaredBoolean(node)) {
          const key = `${owner.module.path}#${owner.name}:${node.getText(owner.module.tree).replace(/\s/g, '')}`;
          return add(key, String(expected ? ts.SyntaxKind.TrueKeyword : ts.SyntaxKind.FalseKeyword), true);
        }
        return true;
      }
      const operator = node.operatorToken.kind;
      if ((operator === ts.SyntaxKind.AmpersandAmpersandToken && expected) ||
        (operator === ts.SyntaxKind.BarBarToken && !expected)) return collect(node.left, expected) && collect(node.right, expected);
      if (![ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken].includes(operator)) return true;
      const right = literal(node.right), left = literal(node.left);
      const expression = right === undefined ? node.right : node.left, value = right ?? left;
      if (value === undefined) return true;
      const key = `${owner.module.path}#${owner.name}:${expression.getText(owner.module.tree).replace(/\s/g, '')}`;
      return add(key, value, expected === (operator === ts.SyntaxKind.EqualsEqualsEqualsToken));
    }
    return collect(condition, truth) ? facts : undefined;
  }

  function fillViewportStack(node) {
    const dimensions = new Set();
    let current = node;
    while (ts.isPropertyAccessExpression(current.parent) && current.parent.expression === current &&
      ts.isCallExpression(current.parent.parent)) {
      const call = current.parent.parent, name = current.parent.name.text, value = call.arguments[0];
      if (['width', 'height'].includes(name) && value && ts.isStringLiteral(value) && value.text === '100%') dimensions.add(name);
      current = call;
    }
    return dimensions.has('width') && dimensions.has('height');
  }

  // A separate overlay-only child of an explicitly full-viewport Stack does
  // not join a sibling page's linear layout. Mixed children remain flow.
  function overlayOnly(node, owner, bindings, seen = new Set()) {
    const roles = { overlay: false, ordinary: false };
    const visit = current => {
      if (!current || roles.ordinary || ts.isArrowFunction(current) || ts.isFunctionExpression(current)) return;
      if (ts.isCallExpression(current) && ts.isPropertyAccessExpression(current.expression)) {
        const memberName = thisMember(current.expression);
        if (memberName) {
          const member = owner.members.get(memberName);
          if (member && decoratorNames(member, owner.module).includes('Builder')) {
            if (seen.has(member)) return;
            const next = new Set(seen); next.add(member);
            const result = overlayOnly(member.body, owner, bindings, next);
            roles.overlay ||= result.overlay; roles.ordinary ||= result.ordinary;
          } else if (member && decoratorNames(member, owner.module).includes('BuilderParam')) {
            const supplied = bindings.get(memberName);
            if (supplied) {
              const result = overlayOnly(supplied.node.body ?? supplied.node, supplied.owner, supplied.bindings, seen);
              roles.overlay ||= result.overlay; roles.ordinary ||= result.ordinary;
            } else if (!member.questionToken) roles.ordinary = true;
          }
          return;
        }
        visit(current.expression.expression); return;
      }
      if (ts.isEtsComponentExpression(current) || ts.isCallExpression(current)) {
        if (ts.isIdentifier(current.expression)) {
          const name = owner.module.imports.get(current.expression.text)?.exported ?? current.expression.text;
          if (overlayComponents.has(name)) { roles.overlay = true; return; }
          if (name === 'ForEach' || name === 'LazyForEach') {
            visit(current.arguments?.[1]?.body); return;
          }
          if (!['Column', 'Row', 'Stack', 'Flex', 'Scroll', 'Blank'].includes(name)) {
            roles.ordinary = true; return;
          }
        }
        if (current.body) visit(current.body);
        return;
      }
      ts.forEachChild(current, visit);
    };
    visit(node);
    return roles;
  }

  function walkBinding(node, owner, state, bindings, stack) {
    if (!node) return;
    if (ts.isBlock(node)) { walk(node, owner, state, bindings, stack); return; }
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
      walk(node.body, owner, state, bindings, stack); return;
    }
    const memberName = thisMember(node);
    if (memberName) { follow(memberName, node, owner, state, bindings, stack); return; }
    if (ts.isCallExpression(node) && thisMember(node.expression)) {
      follow(thisMember(node.expression), node, owner, state, bindings, stack); return;
    }
    report('UNRESOLVED', owner.module, node, { slot: state.slot, chain: state.chain,
      message: `Dynamic Builder value: ${node.getText(owner.module.tree)}` });
  }

  function follow(memberName, node, owner, state, bindings, stack) {
    const member = owner.members.get(memberName);
    if (decoratorNames(member ?? {}, owner.module).includes('BuilderParam')) {
      const supplied = bindings.get(memberName);
      if (supplied) walkBinding(supplied.node, supplied.owner, { ...state, facts: supplied.facts }, supplied.bindings, stack);
      else if (member.initializer) walkBinding(member.initializer, owner, state, bindings, stack);
      else if (member.questionToken) return;
      else if (Object.hasOwn(frameSlots, owner.name)) genericSlots.push({ file: owner.module.path,
        owner: owner.name, member: memberName, reason: 'Generic frame slot is inspected at explicit callers.' });
      else report('UNRESOLVED', owner.module, node, { slot: state.slot, chain: state.chain,
        message: `Unbound BuilderParam: ${owner.name}.${memberName}` });
      return;
    }
    if (!member?.body || !decoratorNames(member, owner.module).includes('Builder')) {
      report('UNRESOLVED', owner.module, node, { slot: state.slot, chain: state.chain,
        message: `Builder method unavailable: ${owner.name}.${memberName}` }); return;
    }
    const key = `${owner.module.path}#${owner.name}.${memberName}:${state.slot}`;
    if (stack.has(key)) return;
    const next = new Set(stack); next.add(key);
    walk(member.body, owner, { ...state, chain: [...state.chain, `${owner.name}.${memberName}`] }, bindings, next);
  }

  function walk(node, owner, state, bindings, stack) {
    if (!node) return;
    const module = owner.module;
    if (ts.isIfStatement(node)) {
      const yes = branchFacts(node.expression, true, owner, state.facts);
      const no = branchFacts(node.expression, false, owner, state.facts);
      if (yes) walk(node.thenStatement, owner, { ...state, facts: yes }, bindings, stack);
      if (no && node.elseStatement) walk(node.elseStatement, owner, { ...state, facts: no }, bindings, stack);
      return;
    }
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) return;
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const attribute = node.expression.name.text;
      if (thisMember(node.expression)) {
        const member = owner.members.get(attribute);
        if (member && decoratorNames(member, module).some(name => name === 'Builder' || name === 'BuilderParam'))
          follow(attribute, node, owner, state, bindings, stack);
        return;
      }
      // Native detached content has a distinct layout host. Event callbacks
      // are not evaluated while a parent Builder measures its children.
      if (detachedMethods.has(attribute)) {
        detached.push({ file: module.path, owner: owner.name, slot: state.slot, method: attribute });
        walk(node.expression.expression, owner, state, bindings, stack);
        return;
      }
      if (attribute === 'each' || attribute === 'template') {
        walk(node.expression.expression, owner, state, bindings, stack);
        const builder = node.arguments[attribute === 'each' ? 0 : 1];
        if (builder) walkBinding(builder, owner, state, bindings, stack);
        return;
      }
      const positioned = attribute === 'position';
      walk(node.expression.expression, owner, positioned ? { ...state, slot: 'positionedOverlay' } : state, bindings, stack);
      return;
    }
    if (ts.isEtsComponentExpression(node) || ts.isCallExpression(node)) {
      if (ts.isIdentifier(node.expression)) {
        const localName = node.expression.text;
        const name = module.imports.get(localName)?.exported ?? localName;
        if (name === 'ReaderPageState') return;
        if (name === 'ForEach' || name === 'LazyForEach') {
          if (node.arguments?.[1]) walkBinding(node.arguments[1], owner, state, bindings, stack);
          return;
        }
        if (name === 'Stack' && contentSlot(state.slot) && node.body && fillViewportStack(node)) {
          for (const child of node.body.statements) {
            const roles = overlayOnly(child, owner, bindings);
            walk(child, owner, roles.overlay && !roles.ordinary ? { ...state, slot: 'stackedOverlay' } : state, bindings, stack);
          }
          return;
        }
        if (overlayComponents.has(name)) {
          if (state.localContent || (!overlaySlot(state.slot) && state.slot !== 'positionedOverlay'))
            report('OVERLAY_IN_FLOW', module, node, { slot: state.slot, component: name, chain: state.chain,
              message: 'Overlay presentation is reachable from a measured page slot.' });
          return;
        }
        if (!nativeComponents.has(name) && !Object.hasOwn(frameSlots, name)) {
          const component = resolveImport(module, localName);
          if (component?.members.get('build')?.body) {
            const props = initializerMap(node.arguments?.[0]);
            const nextBindings = new Map([...props].map(([key, value]) => [key, { node: value, owner, bindings, facts: state.facts }]));
            if (node.body) {
              const emptySlots = [...component.members].filter(([key, member]) =>
                decoratorNames(member, component.module).includes('BuilderParam') && !props.has(key));
              if (emptySlots.length === 1) nextBindings.set(emptySlots[0][0], { node: node.body, owner, bindings, facts: state.facts });
              else if (emptySlots.length > 1) report('UNRESOLVED', module, node,
                { slot: state.slot, chain: state.chain, message: `Ambiguous trailing Builder: ${localName}` });
            }
            const key = `${component.module.path}#${component.name}.build:${state.slot}`;
            if (!stack.has(key)) {
              const next = new Set(stack); next.add(key);
              walk(component.members.get('build').body, component,
                { ...state, facts: new Map(), chain: [...state.chain, `${component.name}.build`] }, nextBindings, next);
            }
          } else if (ts.isEtsComponentExpression(node)) report('UNRESOLVED', module, node,
            { slot: state.slot, chain: state.chain, message: `Component body unavailable: ${localName}` });
        }
      }
      if (node.body) walk(node.body, owner, state, bindings, stack);
      return;
    }
    ts.forEachChild(node, child => walk(child, owner, state, bindings, stack));
  }

  for (const path of files) {
    const module = load(path);
    for (const owner of module.declarations.values()) for (const member of owner.members.values()) {
      if (!member.body) continue;
      const visit = node => {
        if ((ts.isEtsComponentExpression(node) || ts.isCallExpression(node)) && ts.isIdentifier(node.expression) &&
          Object.hasOwn(frameSlots, node.expression.text)) {
          const props = initializerMap(node.arguments?.[0]);
          const frame = resolveImport(module, node.expression.text);
          if (frame) for (const [name, declaration] of frame.members) {
            if (props.has(name) && decoratorNames(declaration, frame.module).includes('BuilderParam') &&
              !frameSlots[node.expression.text].includes(name))
              report('UNRESOLVED', module, props.get(name), { frame: node.expression.text, slot: name,
                message: `Declared frame BuilderParam has no assembly role: ${node.expression.text}.${name}` });
          }
          for (const slot of frameSlots[node.expression.text]) if (props.has(slot) && checkedSlots.includes(slot)) {
            const chain = [`${owner.name}.${nameOf(member.name, module)}`, `${node.expression.text}.${slot}`];
            slots.push({ file: path, owner: owner.name, frame: node.expression.text, slot, chain });
            walkBinding(props.get(slot), owner, { slot, chain }, new Map(), new Set());
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(member.body);
    }
  }

  // Temporary editors and native covers can own a nested content flow even
  // when their whole surface is positioned independently of the page.
  for (const contract of localContentContracts) {
    const module = load(contract.file);
    const owner = module.declarations.get(contract.owner);
    if (!owner) {
      report('UNRESOLVED', module, undefined, { message: `Local content owner missing: ${contract.owner}` });
      continue;
    }
    for (const method of contract.methods) {
      const chain = [`${contract.owner}.${method}:local-content`];
      slots.push({ file: contract.file, owner: contract.owner, frame: 'localSurface', slot: 'content', chain });
      follow(method, owner.members.get(method), owner, { slot: 'content', chain, localContent: true }, new Map(), new Set());
    }
  }

  for (const contract of geometryContracts) {
    const module = load(sourcePath(contract.file)), owner = module.declarations.get(contract.owner);
    if (!owner) { report('UNRESOLVED', module, undefined, { message: `Declared geometry owner missing: ${contract.owner}` }); continue; }
    for (const methodName of contract.methods) {
      const method = owner.members.get(methodName);
      if (!method?.body) { report('UNRESOLVED', module, method, { message: `Declared geometry method missing: ${contract.owner}.${methodName}` }); continue; }
      const seen = new Set();
      function reads(member, chain) {
        if (seen.has(member)) return;
        seen.add(member);
        const visit = node => {
          if (ts.isPropertyAccessExpression(node) && node.expression.kind === ts.SyntaxKind.ThisKeyword) {
            if (contract.overlayMembers.includes(node.name.text)) report('OVERLAY_GEOMETRY_DEPENDENCY', module, node,
              { method: methodName, member: node.name.text, chain, message: 'Declared base geometry consumes an overlay fact.' });
          }
          if (ts.isCallExpression(node)) {
            const called = thisMember(node.expression), target = owner.members.get(called);
            if (target?.body) reads(target, [...chain, `${owner.name}.${called}`]);
          }
          ts.forEachChild(node, visit);
        };
        visit(member.body);
      }
      reads(method, [`${owner.name}.${methodName}`]);
    }
    for (const fact of contract.overlayMembers) {
      const field = owner.members.get(fact);
      if (!field) continue;
      for (const decorator of ts.getAllDecorators(field)) {
        const expression = decorator.expression;
        if (!ts.isCallExpression(expression) || nameOf(expression.expression, module) !== 'Watch') continue;
        const watched = expression.arguments[0];
        if (!watched || !ts.isStringLiteral(watched)) {
          report('UNRESOLVED', module, decorator, { member: fact, message: 'Dynamic overlay Watch target.' }); continue;
        }
        const seen = new Set();
        function inspectWatcher(methodName, chain) {
          if (seen.has(methodName)) return;
          seen.add(methodName);
          const method = owner.members.get(methodName);
          if (!method?.body) { report('UNRESOLVED', module, field,
            { member: fact, message: `Overlay Watch method unavailable: ${methodName}` }); return; }
          const visit = node => {
            if (ts.isCallExpression(node)) {
              const called = thisMember(node.expression);
              if (contract.invalidationMethods?.includes(called)) report('OVERLAY_FRAME_INVALIDATION', module, node,
                { member: fact, chain, message: 'Overlay Watch reaches a declared base-frame invalidator.' });
              else if (owner.members.get(called)?.body) inspectWatcher(called, [...chain, `${owner.name}.${called}`]);
            }
            ts.forEachChild(node, visit);
          };
          visit(method.body);
        }
        inspectWatcher(watched.text, [`${owner.name}.${fact}@Watch`, `${owner.name}.${watched.text}`]);
      }
    }
  }
  const inputs = [...modules.values()].map(module => {
    const sha256 = digest(module.source);
    const override = sourceOverrides.has(module.path);
    const exitSha256 = override ? sha256 : digest(readFileSync(resolve(repository, module.path)));
    if (exitSha256 !== sha256) report('SOURCE_DRIFT', module, undefined,
      { message: 'Source changed while its declared assembly was inspected.' });
    return { path: module.path, sha256, exitSha256, source: override ? 'explicit-override' : 'repository' };
  }).sort((a, b) => a.path.localeCompare(b.path));
  const failures = diagnostics.filter(row => row.rule !== 'UNRESOLVED');
  const unresolved = diagnostics.filter(row => row.rule === 'UNRESOLVED');
  return { status: failures.length ? 'FAIL' : unresolved.length ? 'UNRESOLVED' : 'PASS',
    scope: 'Explicit files, resolvable Builder assembly and declared base-geometry methods only.',
    files, checkedSlots, localContentContracts, slots, detached, genericSlots, diagnostics,
    inputs,
    boundary: 'Source assembly only. Runtime values, actual geometry equality, Native pixels, hit arbitration and focus require separate evidence.' };
}

const main = process.argv[1] && process.argv[1] !== '-' && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (main) {
  const args = process.argv.slice(2);
  if (args.length === 0 || (args.length === 1 && args[0] === '--list')) {
    console.log(JSON.stringify({ status: 'NOT_RUN', defaultExecution: 'OFF',
      usage: `node tools/check-overlay-assembly.mjs --check --inventory-file ${defaultInventory} | --check --file entry/src/main/ets/<exact-file>` }));
  } else {
    if (args.length !== 3 || args[0] !== '--check' || !['--file', '--inventory-file'].includes(args[1]))
      throw new Error('Select --check and one exact --file or --inventory-file');
    const selection = args[1] === '--file' ? { files: [args[2]] } : JSON.parse(readFileSync(resolve(repository, args[2]), 'utf8'));
    if (args[1] === '--inventory-file' && selection.schemaVersion !== 1) throw new Error('Unsupported overlay assembly inventory schema');
    const report = inspectOverlayAssembly(selection);
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.status === 'PASS' ? 0 : report.status === 'UNRESOLVED' ? 2 : 1;
  }
}
