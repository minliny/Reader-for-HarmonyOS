import assert from 'node:assert/strict';
import { posix as path } from 'node:path';

const bundleSource = '@bundle:io.reader.minliny/entry/ets/';
const legacyShared = 'features/common/';

export function isSharedUiSource(file) {
  return file.startsWith(legacyShared) || file.startsWith('ui/');
}

function isFeatureSource(file, consumer) {
  return file.startsWith('features/') && (consumer.startsWith('ui/') || !file.startsWith(legacyShared));
}

function isAppOwnerSource(file) {
  // Window metrics now have a foundation read port. No app owner needs a
  // public-UI exception, including a namespace or facade of the coordinator.
  return file.startsWith('app/');
}

function targetFile(file, specifier, files) {
  let base;
  if (specifier.startsWith('.')) {
    base = path.normalize(path.join(path.dirname(file), specifier));
  } else if (specifier.startsWith(bundleSource)) {
    base = path.normalize(specifier.slice(bundleSource.length));
  } else if (specifier.startsWith('entry/src/main/ets/')) {
    base = path.normalize(specifier.slice('entry/src/main/ets/'.length));
  } else {
    assert.match(specifier, /^(@(?:ohos|kit)\.|@reader\/core-harmony$|lib[^/]+\.so$)/,
      file + ': unclassified module ' + specifier);
    return undefined;
  }
  const target = [base, base + '.ets', base + '.ts', base + '/index.ets', base + '/index.ts']
    .find(candidate => files.has(candidate));
  assert.ok(target, file + ': unresolved local module ' + specifier);
  return target;
}

function importedNames(ts, node) {
  const clause = node.importClause;
  const names = new Map();
  if (clause?.name) names.set(clause.name.text, 'default');
  if (clause?.namedBindings) {
    if (ts.isNamedImports(clause.namedBindings)) {
      for (const element of clause.namedBindings.elements) {
        names.set(element.name.text, (element.propertyName ?? element.name).text);
      }
    } else {
      names.set(clause.namedBindings.name.text, '*');
    }
  }
  return names;
}

function qualifierName(ts, qualifier) {
  const link = qualifierLink(ts, qualifier);
  return [link.local, ...link.members].join('.');
}

function qualifierLink(ts, qualifier) {
  const members = [];
  while (qualifier && (ts.isQualifiedName(qualifier) || ts.isPropertyAccessExpression(qualifier))) {
    members.unshift((ts.isQualifiedName(qualifier) ? qualifier.right : qualifier.name).text);
    qualifier = ts.isQualifiedName(qualifier) ? qualifier.left : qualifier.expression;
  }
  return { local: qualifier?.text ?? '*', members };
}

function typeLinks(ts, node, initialShadowed = new Set()) {
  const links = [];
  function visit(current, shadowed) {
    const parameters = current.typeParameters ?? (current.typeParameter ? [current.typeParameter] : []);
    const scope = parameters.length ? new Set([...shadowed, ...parameters.map(parameter => parameter.name.text)]) : shadowed;
    function local(qualifier) {
      const link = qualifierLink(ts, qualifier);
      if (!scope.has(link.local)) links.push(link);
    }
    if (ts.isTypeReferenceNode(current)) {
      local(current.typeName);
    } else if (ts.isExpressionWithTypeArguments(current)) {
      local(current.expression);
    } else if (ts.isTypeQueryNode(current)) {
      local(current.exprName);
    } else if (ts.isImportTypeNode(current) && ts.isLiteralTypeNode(current.argument)) {
      const link = qualifierLink(ts, current.qualifier);
      links.push({ specifier: current.argument.literal,
        binding: [link.local, ...link.members].join('.') });
    }
    ts.forEachChild(current, child => visit(child, scope));
  }
  if (node) visit(node, initialShadowed);
  return links;
}

function signatureLinks(ts, node, outer = new Set()) {
  const parameters = node.typeParameters ?? [];
  const shadowed = new Set([...outer, ...parameters.map(parameter => parameter.name.text)]);
  return [node.type, ...parameters.flatMap(parameter => [parameter.constraint, parameter.default]),
    ...(node.parameters ?? []).map(parameter => parameter.type)].flatMap(type => typeLinks(ts, type, shadowed));
}

// Follow explicit value aliases, rather than interpreting arbitrary function
// bodies. Public annotations are part of the exported API even for an empty value.
function valueLinks(ts, expression) {
  if (!expression) return [];
  if (ts.isIdentifier(expression) || ts.isPropertyAccessExpression(expression)) return [qualifierLink(ts, expression)];
  if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) return signatureLinks(ts, expression);
  if (ts.isArrayLiteralExpression(expression)) return expression.elements.flatMap(element => valueLinks(ts, element));
  if (ts.isSpreadElement(expression)) return valueLinks(ts, expression.expression);
  if (ts.isObjectLiteralExpression(expression)) return expression.properties.flatMap(property => {
    if (ts.isPropertyAssignment(property)) return valueLinks(ts, property.initializer);
    if (ts.isShorthandPropertyAssignment(property)) return [qualifierLink(ts, property.name)];
    if (ts.isSpreadAssignment(property)) return valueLinks(ts, property.expression);
    return signatureLinks(ts, property);
  });
  if (ts.isParenthesizedExpression(expression)) return valueLinks(ts, expression.expression);
  if (ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression) || ts.isSatisfiesExpression?.(expression)) {
    return [...valueLinks(ts, expression.expression), ...typeLinks(ts, expression.type)];
  }
  return [];
}

function forwardedExports(ts, tree, binding) {
  const [selected, ...selectedMembers] = binding.split('.');
  const locals = new Map();
  const remember = (name, links) => locals.set(name, [...(Array.isArray(locals.get(name)) ? locals.get(name) : []), ...links]);
  for (const node of tree.statements) {
    if (ts.isImportDeclaration(node)) {
      for (const [local, original] of importedNames(ts, node)) {
        locals.set(local, { specifier: node.moduleSpecifier, binding: original });
      }
    }
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      locals.set(node.name.text, { specifier: node.moduleReference.expression, binding: '*' });
    }
    if (ts.isTypeAliasDeclaration(node)) {
      remember(node.name.text, typeLinks(ts, node));
    }
    if (ts.isInterfaceDeclaration(node)) {
      remember(node.name.text, typeLinks(ts, node));
    }
    if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) remember(declaration.name.text,
          [...typeLinks(ts, declaration.type), ...valueLinks(ts, declaration.initializer)]);
      }
    }
    const defaultName = node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.DefaultKeyword) ? 'default' : undefined;
    if (ts.isFunctionDeclaration(node) && (node.name || defaultName)) {
      remember(node.name?.text ?? defaultName, signatureLinks(ts, node));
    }
    if (ts.isClassDeclaration(node) && (node.name || defaultName)) {
      const shadowed = new Set((node.typeParameters ?? []).map(parameter => parameter.name.text));
      const links = [...signatureLinks(ts, node),
        ...(node.heritageClauses ?? []).flatMap(clause => typeLinks(ts, clause, shadowed))];
      for (const member of node.members) {
        if (member.name && ts.isPrivateIdentifier?.(member.name)) continue;
        if (member.modifiers?.some(modifier => [ts.SyntaxKind.PrivateKeyword, ts.SyntaxKind.ProtectedKeyword].includes(modifier.kind))) continue;
        links.push(...signatureLinks(ts, member, shadowed));
        links.push(...valueLinks(ts, member.initializer));
      }
      remember(node.name?.text ?? defaultName, links);
    }
  }

  const links = [];
  const wildcard = [];
  let hasNamedExport = false;
  function add(name, link) {
    if (selected !== '*' && selected !== name) return;
    hasNamedExport = true;
    const seen = new Set();
    function resolve(current, members = selectedMembers) {
      if (Array.isArray(current)) {
        for (const item of current) resolve(item, members);
      } else if (current?.local) {
        const nextMembers = [...(current.members ?? []), ...members];
        const key = [current.local, ...nextMembers].join('.');
        if (seen.has(key)) return;
        seen.add(key);
        resolve(locals.get(current.local), nextMembers);
      } else if (current?.specifier) {
        const nextBinding = current.binding === '*' && members.length ? members.join('.') :
          [current.binding, ...members].join('.');
        links.push({ ...current, binding: nextBinding });
      }
    }
    resolve(link);
  }

  for (const node of tree.statements) {
    if (ts.isExportDeclaration(node)) {
      const clause = node.exportClause;
      if (!clause && node.moduleSpecifier && selected !== 'default') {
        wildcard.push({ specifier: node.moduleSpecifier, binding });
      } else if (clause && ts.isNamedExports(clause)) {
        for (const element of clause.elements) {
          const original = (element.propertyName ?? element.name).text;
          add(element.name.text, node.moduleSpecifier ? { specifier: node.moduleSpecifier, binding: original } :
            { local: original });
        }
      } else if (clause && ts.isNamespaceExport(clause)) {
        add(clause.name.text, { specifier: node.moduleSpecifier, binding: '*' });
      }
    } else if (ts.isExportAssignment(node) && !node.isExportEquals) {
      add('default', valueLinks(ts, node.expression));
    } else if (node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      const isDefault = node.modifiers.some(modifier => modifier.kind === ts.SyntaxKind.DefaultKeyword);
      if (ts.isVariableStatement(node)) {
        for (const declaration of node.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name)) add(declaration.name.text, { local: declaration.name.text });
        }
      } else if (node.name && ts.isIdentifier(node.name)) {
        add(isDefault ? 'default' : node.name.text, { local: node.name.text });
      } else if (isDefault && (ts.isClassDeclaration(node) || ts.isFunctionDeclaration(node))) {
        add('default', { local: 'default' });
      }
    }
  }
  return binding !== '*' && hasNamedExport ? links : links.concat(wildcard);
}

/** Resolve direct and forwarded bindings to the boundary's forbidden sources. */
function boundaryImports(ts, options, file, source, files, readSource, isForbidden) {
  function parse(module, contents) {
    const tree = ts.createSourceFile(module, contents, ts.ScriptTarget.Latest, true,
      module.endsWith('.ets') ? ts.ScriptKind.ETS : ts.ScriptKind.TS, options);
    assert.equal(tree.parseDiagnostics.length, 0, module + ': cannot audit unparsed source');
    return tree;
  }
  const tree = parse(file, source);
  const trees = new Map([[file, tree]]);
  const edges = [];
  function isEnvironmentWriter(module, binding) {
    return isSharedUiSource(file) && module === 'ui/foundation/ReaderWindowEnvironment.ts' &&
      !['readerWindowMetrics', 'ReaderWindowMetricsSource'].includes(binding);
  }
  function collect(specifier, kind, bindings) {
    assert.ok(specifier && ts.isStringLiteralLike(specifier), file + ': nonliteral ' + kind);
    const target = targetFile(file, specifier.text, files);
    if (!target) return;
    if (isForbidden(target)) {
      edges.push({ file, target, kind, bindings, through: [] });
      return;
    }
    const visited = new Set();
    function follow(module, binding, through) {
      const key = `${module}:${binding}`;
      if (visited.has(key)) return;
      visited.add(key);
      if (isForbidden(module) || isEnvironmentWriter(module, binding)) {
        edges.push({ file, target: module, kind, bindings, through });
        return;
      }
      if (!trees.has(module)) trees.set(module, parse(module, readSource(module)));
      for (const link of forwardedExports(ts, trees.get(module), binding)) {
        assert.ok(ts.isStringLiteralLike(link.specifier), module + ': nonliteral forwarded export');
        const next = targetFile(module, link.specifier.text, files);
        if (next) follow(next, link.binding, [...through, module]);
      }
    }
    for (const binding of bindings) follow(target, binding, []);
  }
  function visit(node) {
    if (ts.isImportDeclaration(node)) {
      collect(node.moduleSpecifier, 'import', [...importedNames(ts, node).values()]);
    }
    if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      const clause = node.exportClause;
      const bindings = clause && ts.isNamedExports(clause) ?
        clause.elements.map(element => (element.propertyName ?? element.name).text) : ['*'];
      collect(node.moduleSpecifier, 're-export', bindings);
    }
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      collect(node.moduleReference.expression, 'import-equals', ['*']);
    }
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      collect(node.argument.literal, 'import-type', [qualifierName(ts, node.qualifier)]);
    }
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
      (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
      collect(node.arguments[0], 'dynamic import', ['*']);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return edges;
}

export function sharedUiFeatureImports(ts, options, file, source, files, readSource) {
  return boundaryImports(ts, options, file, source, files, readSource,
    target => isFeatureSource(target, file) || isAppOwnerSource(target));
}

export function platformUiImports(ts, options, file, source, files, readSource) {
  return boundaryImports(ts, options, file, source, files, readSource,
    target => isSharedUiSource(target) || /^features\/[^/]+\/ui\//.test(target));
}

export function assertSharedUiFeatureImports(edges) {
  assert.equal(edges.length, 0, edges.map(({ file, target, kind, bindings, through }) =>
    file + ': shared UI cannot depend on ' + [...through, target].join(' -> ') +
      ' via ' + kind + (bindings.length ? ' (' + bindings.join(', ') + ')' : '')).join('\n'));
}

export function assertPlatformUiImports(edges) {
  assert.equal(edges.length, 0, edges.map(({ file, target, kind, through }) =>
    file + ': non-UI platform cannot depend on ' + [...through, target].join(' -> ') + ' via ' + kind).join('\n'));
}
