import assert from 'node:assert/strict';
import { installedEtsCompiler } from './ets-compiler-runtime.mjs';
import { pureModuleProbe } from './ets-pure-module-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './arkui-property-runtime-probe.mjs';
import { readerFoundationTokens, foundationSpecs } from './reader-foundation-control-probe.mjs';
import { readerTypographyRoles } from './reader-typography-probe.mjs';
import { readerAppColor } from '../../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';

/** Directory-family ordinary declarations, selected after parsing the complete
 * source. Native bases/dependencies stay explicit; no comment/prefix delimiter
 * or inferred feature assembly is used. Component bodies remain with Builder. */
export function directorySdkDeclarations(source, fileName, dependencies = {}) {
  const { ts, options } = installedEtsCompiler();
  const tree = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  assert.equal(tree.parseDiagnostics.length, 0, 'complete directory declaration source parses');
  const declarations = tree.statements.filter(node => ts.isClassDeclaration(node) || ts.isFunctionDeclaration(node) || ts.isVariableStatement(node) || ts.isEnumDeclaration(node));
  const names = declarations.flatMap(node => ts.isVariableStatement(node) ?
    node.declarationList.declarations.map(value => { assert.ok(ts.isIdentifier(value.name)); return value.name.text; }) : [node.name.text]);
  assert.ok(names.length > 0); assert.equal(new Set(names).size, names.length);
  return pureModuleProbe(declarations.map(node => node.getText(tree)).join('\n'), fileName, dependencies, names);
}

/** Explicit shared policies and SDK properties only. Each caller provides all
 * directory/row/message children, native scheduling and transport ports. */
export function directoryControlSdk(metrics = { densityPixels: 1, systemFontScale: 1, keyboardInsets: { bottom: 0 } }) {
  const properties = createArkUIPropertyRuntimeProbe();
  const deps = { ...properties.sdk, ...readerFoundationTokens, ...foundationSpecs(), ...readerTypographyRoles,
    readerAppColor, ReaderWindowCoordinator: { metrics: () => metrics } };
  const hooks = { ...properties.hooks, mountChildren: true, lifecycleChildren: true };
  const walk = owner => [owner, ...[...(owner.children?.values() ?? [])].flatMap(child => child.nodes ? walk(child) : [])];
  return { properties, deps, hooks, nodes: owner => walk(owner).flatMap(child => [...child.nodes.values()]) };
}

/** Source-specific fault controls, using the installed SDK AST. Mutating a
 * native chain changes only its suffix so nested DSL edits cannot overlap. */
export function directoryControlFault(source, kind) {
  const { ts, options } = installedEtsCompiler();
  const tree = ts.createSourceFile('ReaderControlDirectoryContent.ets', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  assert.equal(tree.parseDiagnostics.length, 0);
  const component = tree.statements.find(node => node.name?.text === 'ReaderControlDirectoryContent'); assert.ok(component);
  const method = name => { const node = component.members.find(node => node.name?.getText(tree) === name); assert.ok(node, name); return node; };
  const edits = [];
  const visit = (node, action) => { action(node); ts.forEachChild(node, child => visit(child, action)); };
  const callName = node => node && ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) ? node.expression.name.text : undefined;
  const callsMethod = (node, name) => callName(node) === name && node.expression.expression.kind === ts.SyntaxKind.ThisKeyword;
  const edit = (node, text) => edits.push({ start: node.getStart(tree), end: node.end, text });
  const suffix = node => edits.push({ start: node.expression.expression.end, end: node.end, text: '' });
  if (kind === 'blocking-toolbar-ancestor' || kind === 'active-partial-toolbar') {
    visit(method('build'), node => { if (callName(node) === 'enabled' && node.arguments.some(arg => callsMethod(arg, 'toolbarInteractive'))) {
      if (kind === 'blocking-toolbar-ancestor') edits.push({ start: node.end, end: node.end, text: '.focusable(false)' });
      else edit(node.arguments[0], 'this.interactionEnabled');
    } });
  } else if (kind === 'unknown-keyboard-is-hidden') {
    visit(method('syncContentLayout'), node => { if (ts.isIfStatement(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'directoryKeyboardWasVisible') edit(node, node.thenStatement.getText(tree)); });
  } else if (kind === 'old-list-top') {
    edit(method('listTop').body, "{ return (this.tab === 'bookmarks' ? this.value(47, 99) : this.value(48, 99)) + this.queryGrowth() * this.progress; }");
  } else if (kind === 'wrong-list-reservation') {
    edit(method('listHeight').body, '{ return this.contentGeometry().listHeight + 1; }');
  } else if (kind === 'missing-tab-growth') {
    edit(method('tabHeight').body, '{ return 44; }');
  } else if (['old-toolbar-top', 'missing-toolbar-clip', 'missing-footer-clip'].includes(kind)) {
    const key = kind === 'missing-footer-clip' ? 'footerTop' : 'toolbarTop';
    const isPosition = node => callName(node) === 'position' && node.arguments[0]?.properties?.some(property =>
      property.name?.getText(tree) === 'y' && callName(property.initializer?.expression) === 'contentGeometry' && property.initializer.name?.text === key);
    visit(method('build'), node => {
      if (kind === 'old-toolbar-top' && isPosition(node)) {
        const value = node.arguments[0].properties.find(property => property.name?.getText(tree) === 'y'); edit(value.initializer, 'this.value(61, 43)');
      } else if (kind !== 'old-toolbar-top' && callName(node) === 'clip' && isPosition(node.expression.expression)) suffix(node);
    });
  } else if (kind === 'unguarded-search-callback') {
    visit(method('directoryToolbar'), node => { if (ts.isPropertyAssignment(node) && node.name.getText(tree) === 'onSearch') edit(node.initializer, '(): void => this.search()'); });
  } else throw new Error('Unknown directory fault ' + kind);
  assert.equal(edits.length, 1, 'one actual directory fault target: ' + kind);
  let result = source;
  for (const value of edits.sort((a,b) => b.start-a.start)) result = result.slice(0,value.start) + value.text + result.slice(value.end);
  return result;
}
