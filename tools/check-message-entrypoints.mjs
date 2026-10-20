#!/usr/bin/env node
/** Explicit source-entry inventory. This is neither a build prerequisite nor
 * proof that every user-visible business scene has been integrated. */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolveEtsLoaderRoot } from './lib/tool-environment.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const registryPath = resolve(root, 'tools/message-entrypoints.json');
const sourceRoot = 'entry/src/main/ets';
const scopeBoundary = [
  'Scans shipping entry/src/main/ets .ets/.ts source, including retained disabled modules; no feature is enabled.',
  'Stable IDs group file + class + owning member + entry family. Occurrences and source lines are informational, never baselines.',
  'Official installed ETS SDK AST only; no transpilation, type checking, business tests, build, native API or device execution.',
  'Static local aliases, API references and common literal/computed property access are inspected; arbitrary runtime reflection and cross-module dynamic flows are not proven.',
  'A registered source entry is not a complete business-scene inventory, lifecycle behavior proof, visual acceptance, or whole-app notification coverage claim.',
];
const components = new Map([
  ['ReaderRecoveryNotice', 'shared.recovery-notice'],
  ['ReaderPageState', 'shared.page-state'],
  ['ReaderDialogSurface', 'shared.dialog-surface'],
]);
const owners = new Map([
  ['ReaderTransientFeedback', 'shared.transient'],
  ['ReaderNativeAlertOwner', 'shared.alert-owner'],
]);
const idFor = (file, owner, member, family) => `${file}#${owner}.${member}::${family}`;
const toastBridge = idFor(`${sourceRoot}/features/common/ReaderTransientFeedback.ts`, 'ReaderTransientFeedback', 'show', 'native.toast');
const usage = 'node tools/check-message-entrypoints.mjs --inventory | --check';

function sourceFiles(directory) {
  return readdirSync(resolve(root, directory), { withFileTypes: true }).flatMap(entry => {
    const name = `${directory}/${entry.name}`;
    return entry.isDirectory() ? sourceFiles(name) : ['.ets', '.ts'].includes(extname(name)) ? [name] : [];
  }).sort();
}

export function inventoryMessageEntrypoints() {
  const require = createRequire(import.meta.url), sdk = resolveEtsLoaderRoot();
  const ts = require(`${sdk}/node_modules/typescript`);
  const compilerOptions = require(`${sdk}/lib/ets_checker.js`).compilerOptions;
  const entries = new Map(), declarations = [], parseErrors = [];
  for (const file of sourceFiles(sourceRoot)) {
    const text = readFileSync(resolve(root, file), 'utf8');
    const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true,
      extname(file) === '.ets' ? ts.ScriptKind.ETS : ts.ScriptKind.TS, compilerOptions);
    for (const diagnostic of tree.parseDiagnostics ?? []) {
      parseErrors.push({ file, line: tree.getLineAndCharacterOfPosition(diagnostic.start ?? 0).line + 1,
        message: ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ') });
    }
    const scopes = new Map(), classScopes = new Map(), imports = new Map();
    const isClass = node => !!node?.members && !!node?.name &&
      (ts.isClassDeclaration(node) || ts.isClassExpression(node) || node.kind === ts.SyntaxKind.StructDeclaration);
    const isFunction = node => ts.isFunctionLike(node);
    const isScope = node => ts.isSourceFile(node) || ts.isBlock(node) || isFunction(node) || isClass(node);
    const closest = (node, predicate) => { for (let item = node; item; item = item.parent) if (predicate(item)) return item; };
    const bindingScope = node => closest(node.parent, isScope) ?? tree;
    const nameOf = node => {
      if (!node) return undefined;
      if (ts.isIdentifier(node) || ts.isPrivateIdentifier(node) || ts.isStringLiteralLike(node)) return node.text;
      if (ts.isComputedPropertyName(node)) return literal(node.expression);
      return undefined;
    };
    function addBinding(scope, name, value) {
      if (!name || !value) return;
      if (!scopes.has(scope)) scopes.set(scope, new Map());
      const bindings = scopes.get(scope);
      if (!bindings.has(name)) bindings.set(name, []);
      bindings.get(name).push(value);
    }
    function lookup(node, name) {
      for (let item = node; item; item = item.parent) {
        const values = scopes.get(item)?.get(name);
        if (values) return values;
      }
      return [];
    }
    function literal(node, seen = new Set()) {
      if (!node || seen.has(node)) return undefined;
      seen.add(node);
      if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
      if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) return literal(node.expression, seen);
      if (ts.isIdentifier(node)) {
        const values = lookup(node, node.text).map(value => literal(value, new Set(seen))).filter(value => value !== undefined);
        return values.length > 0 && values.every(value => value === values[0]) ? values[0] : undefined;
      }
      return undefined;
    }
    const accessName = node => ts.isPropertyAccessExpression(node) ? nameOf(node.name) :
      ts.isElementAccessExpression(node) ? literal(node.argumentExpression) : undefined;
    const classFor = node => closest(node, isClass);
    function types(node) {
      if (!node) return [];
      if (ts.isTypeReferenceNode(node)) return [nameOf(node.typeName)];
      if (ts.isUnionTypeNode(node)) return node.types.flatMap(types);
      return [];
    }
    function instanceBindings(declaration) {
      return types(declaration.type).flatMap(type => {
        const actual = imports.get(type) ?? type;
        if (owners.has(actual)) return [{ instanceOf: actual }];
        if (actual === 'UIContext') return [{ resolvedKind: 'ui-context' }];
        if (actual === 'PromptAction') return [{ resolvedKind: 'prompt-action' }];
        return [];
      });
    }
    function collect(node) {
      if (ts.isImportDeclaration(node)) {
        const bindings = node.importClause?.namedBindings;
        if (bindings && ts.isNamedImports(bindings)) {
          for (const specifier of bindings.elements) imports.set(specifier.name.text, specifier.propertyName?.text ?? specifier.name.text);
        }
        if (node.importClause?.name && String(node.moduleSpecifier.text).includes('promptAction')) imports.set(node.importClause.name.text, 'promptAction');
      }
      if (isClass(node)) {
        classScopes.set(node, new Map());
        declarations.push({ file, owner: nameOf(node.name), members: node.members.map(member => nameOf(member.name)).filter(Boolean) });
      }
      if (ts.isVariableDeclaration(node) || ts.isPropertyDeclaration(node) || ts.isParameter(node)) {
        const values = [...(node.initializer ? [node.initializer] : []), ...instanceBindings(node)];
        if (ts.isIdentifier(node.name) || ts.isPrivateIdentifier(node.name)) {
          if (ts.isPropertyDeclaration(node)) {
            const owner = classFor(node);
            if (owner) classScopes.get(owner)?.set(nameOf(node.name), values);
          } else for (const value of values) addBinding(bindingScope(node), nameOf(node.name), value);
        } else if (ts.isObjectBindingPattern(node.name) && node.initializer) {
          for (const element of node.name.elements) {
            const property = nameOf(element.propertyName ?? element.name);
            if (property && ts.isIdentifier(element.name)) addBinding(bindingScope(node), element.name.text,
              { bindingObject: node.initializer, bindingProperty: property });
          }
        }
      }
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
        if (ts.isIdentifier(node.left)) addBinding(bindingScope(node), node.left.text, node.right);
        else if ((ts.isPropertyAccessExpression(node.left) || ts.isElementAccessExpression(node.left)) &&
          node.left.expression.kind === ts.SyntaxKind.ThisKeyword) {
          const owner = classFor(node), name = accessName(node.left);
          if (owner && name) {
            const bindings = classScopes.get(owner);
            if (!bindings.has(name)) bindings.set(name, []);
            bindings.get(name).push(node.right);
          }
        }
      }
      ts.forEachChild(node, collect);
    }
    collect(tree);
    const union = lists => new Set(lists.flatMap(value => [...value]));
    function propertyValue(receiver, property, node, seen) {
      if (property === 'showToast') return new Set(['api:native.toast']);
      if (property === 'showAlertDialog') return new Set(['api:native.alert']);
      if (components.has(property)) return new Set([`api:${components.get(property)}`]);
      if (owners.has(property) || property === 'CustomDialogController') return new Set([`constructor:${property}`]);
      const values = resolveValue(receiver, seen);
      if (property === 'getUIContext') return new Set(['factory:ui-context']);
      if (property === 'getPromptAction') return new Set(['factory:prompt-action']);
      if (property === 'show' && values.has('instance:ReaderTransientFeedback')) return new Set(['api:shared.transient']);
      if (property === 'show' && values.has('platform-alert')) return new Set(['api:native.alert']);
      if (property === 'present' && values.has('instance:ReaderNativeAlertOwner')) return new Set(['api:shared.alert-owner']);
      if (['bind', 'call', 'apply'].includes(property) && [...values].some(value => value.startsWith('api:'))) return values;
      if (receiver?.kind === ts.SyntaxKind.ThisKeyword) {
        const owner = classFor(node), candidates = classScopes.get(owner)?.get(property) ?? [];
        return union(candidates.map(value => resolveValue(value, new Set(seen))));
      }
      return new Set();
    }
    function resolveValue(node, seen = new Set()) {
      if (!node || seen.has(node)) return new Set();
      seen.add(node);
      if (node.instanceOf) return new Set([`instance:${node.instanceOf}`]);
      if (node.resolvedKind) return new Set([node.resolvedKind]);
      if (node.bindingObject) return propertyValue(node.bindingObject, node.bindingProperty, node.bindingObject, seen);
      if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isTypeAssertionExpression(node) || ts.isNonNullExpression(node)) return resolveValue(node.expression, seen);
      if (ts.isIdentifier(node)) {
        const candidates = lookup(node, node.text);
        if (candidates.length > 0) return union(candidates.map(value => resolveValue(value, new Set(seen))));
        const name = imports.get(node.text) ?? node.text;
        if (owners.has(name) || name === 'CustomDialogController') return new Set([`constructor:${name}`]);
        if (components.has(name)) return new Set([`api:${components.get(name)}`]);
        if (name === 'AlertDialog') return new Set(['platform-alert']);
        return name === 'promptAction' ? new Set(['prompt-action']) : new Set();
      }
      if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
        const property = accessName(node);
        if (!property && ts.isElementAccessExpression(node)) {
          const receiver = resolveValue(node.expression, seen);
          if (receiver.has('prompt-action') || receiver.has('ui-context')) return new Set(['api:native.dynamic-access']);
          return new Set();
        }
        return propertyValue(node.expression, property, node, seen);
      }
      if (ts.isNewExpression(node)) {
        const constructor = resolveValue(node.expression, seen);
        return new Set([...constructor].filter(value => value.startsWith('constructor:')).map(value => value.replace('constructor:', 'instance:')));
      }
      if (ts.isCallExpression(node)) {
        const callee = resolveValue(node.expression, seen);
        if (callee.has('factory:ui-context')) return new Set(['ui-context']);
        if (callee.has('factory:prompt-action')) return new Set(['prompt-action']);
        if (accessName(node.expression) === 'bind') return callee;
      }
      return new Set();
    }
    function location(node) {
      const owner = classFor(node);
      let member = '<top-level>';
      for (let item = node; item && item !== tree; item = item.parent) {
        if (owner && item.parent === owner && nameOf(item.name)) { member = nameOf(item.name); break; }
        if (!owner && ts.isFunctionDeclaration(item) && item.name) { member = item.name.text; break; }
      }
      return { owner: owner ? nameOf(owner.name) : '<module>', member };
    }
    function ownedAlertCallback(node) {
      for (let item = node; item && item !== tree; item = item.parent) {
        const parent = item.parent;
        if (parent?.arguments?.[0] === item && resolveValue(parent.expression).has('api:shared.alert-owner')) return true;
      }
      return false;
    }
    function record(node, family, form) {
      const { owner, member } = location(node), id = idFor(file, owner, member, family);
      if (!entries.has(id)) entries.set(id, { id, file, owner, member, family, occurrences: [], nativeOwnerCallback: true });
      const entry = entries.get(id);
      entry.occurrences.push({ line: tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1, form });
      if (family === 'native.alert') entry.nativeOwnerCallback &&= ownedAlertCallback(node);
    }
    function visit(node) {
      const callLike = ts.isCallExpression(node) || (node.expression && Array.isArray(node.arguments) && node.kind === ts.SyntaxKind.EtsComponentExpression);
      if (callLike) {
        for (const value of resolveValue(node.expression)) if (value.startsWith('api:')) record(node, value.slice(4), 'call');
      } else if (ts.isNewExpression(node)) {
        const values = resolveValue(node.expression);
        if (values.has('constructor:CustomDialogController')) record(node, 'native.custom-dialog', 'constructor');
        for (const value of values) if (value.startsWith('api:')) record(node, value.slice(4), 'constructor');
      } else if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
        // API value references (including private aliases) count even before
        // invocation. Strings/comments and type-only names never enter here.
        const invoked = node.parent?.expression === node && (ts.isCallExpression(node.parent) || ts.isNewExpression(node.parent));
        if (!invoked) for (const value of resolveValue(node)) if (value.startsWith('api:')) record(node, value.slice(4), 'reference');
      }
      ts.forEachChild(node, visit);
    }
    visit(tree);
  }
  return { schemaVersion: 1, scopeBoundary, parser: { source: 'installed HarmonyOS ETS SDK', version: ts.version },
    entries: [...entries.values()].sort((a, b) => a.id.localeCompare(b.id)), declarations, parseErrors };
}

export function compareMessageEntrypoints(inventory, registry) {
  const failures = [...inventory.parseErrors.map(error => ({ kind: 'parse-error', ...error }))];
  const registered = new Map();
  for (const row of registry.entries ?? []) {
    if (registered.has(row.id)) failures.push({ kind: 'duplicate-registration', id: row.id });
    registered.set(row.id, row);
    for (const field of ['category', 'effectiveHost', 'retireRule', 'status']) {
      if (typeof row[field] !== 'string' || row[field].trim().length === 0) failures.push({ kind: 'incomplete-registration', id: row.id, field });
    }
    if (row.id !== idFor(row.file, row.owner, row.member, row.family)) failures.push({ kind: 'unstable-registration-id', id: row.id });
  }
  const actual = new Map(inventory.entries.map(row => [row.id, row]));
  for (const row of inventory.entries) {
    const registration = registered.get(row.id);
    if (!registration) failures.push({ kind: 'unregistered-entry', id: row.id, family: row.family });
    if (row.family === 'native.toast' && row.id !== toastBridge) failures.push({ kind: 'toast-bypasses-adapter', id: row.id });
    if (row.family === 'native.alert' && (!row.nativeOwnerCallback || registration?.bridge !== 'owned-alert-native-callback')) {
      failures.push({ kind: 'alert-bypasses-owner', id: row.id });
    }
    if (row.family === 'native.custom-dialog' && registration?.bridge !== 'registered-dialog-controller') failures.push({ kind: 'unregistered-dialog-controller', id: row.id });
    if (row.family === 'native.dynamic-access') failures.push({ kind: 'unresolved-native-api-access', id: row.id });
  }
  for (const row of registered.values()) if (!actual.has(row.id)) failures.push({ kind: 'stale-registration', id: row.id });
  for (const retained of registry.retainedScopes ?? []) {
    if (typeof retained.authority !== 'string' || !retained.authority.startsWith(`${sourceRoot}/`) ||
      !existsSync(resolve(root, retained.authority))) failures.push({ kind: 'missing-retained-scope-authority', scope: retained.scope, authority: retained.authority });
  }
  for (const exception of registry.dedicatedExceptions ?? []) {
    const declaration = inventory.declarations.find(row => row.file === exception.file && row.owner === exception.owner);
    if (!declaration || (exception.member && !declaration.members.includes(exception.member))) failures.push({ kind: 'stale-dedicated-exception', id: exception.id });
    for (const field of ['category', 'effectiveHost', 'retireRule', 'reason', 'status']) {
      if (typeof exception[field] !== 'string' || exception[field].trim().length === 0) failures.push({ kind: 'incomplete-dedicated-exception', id: exception.id, field });
    }
  }
  return { status: failures.length === 0 ? 'PASS' : 'FAIL', scopeBoundary, registeredGroups: registered.size,
    observedGroups: inventory.entries.length, failures };
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) { console.log(JSON.stringify({ status: 'NOT_RUN', usage, scopeBoundary }, null, 2)); return; }
  if (args.length !== 1 || !['--inventory', '--check'].includes(args[0])) {
    console.error(JSON.stringify({ status: 'FAIL', error: 'explicit mode required', usage }, null, 2)); process.exitCode = 2; return;
  }
  try {
    const inventory = inventoryMessageEntrypoints();
    const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
    const comparison = compareMessageEntrypoints(inventory, registry);
    if (args[0] === '--inventory') {
      console.log(JSON.stringify({ status: 'INVENTORY', scopeBoundary, parser: inventory.parser,
        entries: inventory.entries, unknown: comparison.failures.filter(row => row.kind === 'unregistered-entry'),
        parseErrors: inventory.parseErrors }, null, 2));
      if (inventory.parseErrors.length > 0) process.exitCode = 1;
    } else {
      console.log(JSON.stringify(comparison, null, 2));
      if (comparison.status === 'FAIL') process.exitCode = 1;
    }
  } catch (error) { console.error(JSON.stringify({ status: 'FAIL', error: error.message, usage, scopeBoundary }, null, 2)); process.exitCode = 1; }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) main();
