import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installedEtsCompiler } from './ets-compiler-runtime.mjs';
import { pureModuleProbe } from './ets-pure-module-probe.mjs';
import { ReversibleMotionTimeline, motionSegment } from '../../entry/src/main/ets/features/common/MotionTimeline.ts';
import { bookshelfMotionTransformAt } from '../../entry/src/main/ets/features/bookshelf/BookshelfNavigationMotion.ts';

const actorFile = new URL('../../entry/src/main/ets/features/bookshelf/BookshelfNavigationTransition.ets', import.meta.url);
export const bookshelfOpeningSource = () => readFileSync(actorFile, 'utf8');
export function parseBookshelfOpening(source, fileName = 'BookshelfNavigationTransition.ets') {
  const { ts, options } = installedEtsCompiler();
  const tree = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  assert.equal(tree.parseDiagnostics.length, 0, 'complete current bookshelf source parses');
  return { ts, tree };
}

/** Feature-local assembly only. All parsing/emission uses the common SDK.
 * Current registry objects supply durations/curve points; interpolation is an
 * explicit finite linear port for ordinary authored-time assertions. */
export function bookshelfOpeningInputs(source = bookshelfOpeningSource()) {
  const { ts, tree } = parseBookshelfOpening(source);
  const declarations = tree.statements.filter(node => ts.isClassDeclaration(node) || ts.isFunctionDeclaration(node) || ts.isVariableStatement(node));
  const names = declarations.flatMap(node => ts.isVariableStatement(node) ?
    node.declarationList.declarations.map(value => value.name.getText(tree)) : [node.name.text]);
  const requestedIds = declarations.filter(ts.isVariableStatement).flatMap(node => node.declarationList.declarations)
    .filter(node => ts.isCallExpression(node.initializer) && node.initializer.arguments.length === 1 && ts.isStringLiteral(node.initializer.arguments[0]))
    .map(node => node.initializer.arguments[0].text);
  assert.equal(requestedIds.length, 4, 'current four opening registry inputs');
  const registrySource = readFileSync(new URL('../../entry/src/main/ets/features/common/MotionSpec.ets', import.meta.url), 'utf8');
  const { tree: registry } = parseBookshelfOpening(registrySource, 'MotionSpec.ets');
  const entries = registry.statements.filter(ts.isVariableStatement).flatMap(node => node.declarationList.declarations)
    .find(node => node.name.getText(registry) === 'ENTRIES');
  assert.ok(entries && ts.isArrayLiteralExpression(entries.initializer));
  const selected = requestedIds.map(id => {
    const matches = entries.initializer.elements.filter(node => ts.isObjectLiteralExpression(node) &&
      node.properties.some(property => property.name?.getText(registry) === 'id' && property.initializer?.text === id));
    assert.equal(matches.length, 1, 'one current MotionSpec entry ' + id);
    return matches[0].getText(registry);
  });
  const { specs } = pureModuleProbe('const specs = [' + selected.join(',') + '];', 'OpeningSpecs.ets',
    { curves: { cubicBezierCurve: (...points) => ({ points, interpolate: value => value }) } }, ['specs']);
  const byId = new Map(specs.map(spec => [spec.id, spec]));
  const values = pureModuleProbe(declarations.map(node => node.getText(tree)).join('\n'), 'OpeningDeclarations.ets',
    { FrameCallback: class {}, motionSpecGet: id => byId.get(id) }, names);
  return { ...values, ReversibleMotionTimeline, motionSegment, bookshelfMotionTransformAt, specs };
}

/** Ordinary state/method layer; no Builder/property runtime is claimed here.
 * Decorators are omitted from AST-selected declarations. Builders are selected
 * by their SDK decorator, so private Builder renaming does not change the seam. */
export function bookshelfOpeningActor(dependencies, source = bookshelfOpeningSource()) {
  const { ts, tree } = parseBookshelfOpening(source);
  const owner = tree.statements.find(node => node.name?.text === 'BookshelfNavigationTransition');
  assert.ok(owner);
  const members = owner.members.filter(node => node.name?.getText(tree) !== 'build' &&
    !ts.getAllDecorators(node).some(decorator => decorator.getText(tree) === '@Builder')).map(node => {
    const decorators = ts.getAllDecorators(node);
    return source.slice(decorators.length ? decorators.at(-1).end : node.getStart(tree), node.end);
  });
  return pureModuleProbe('class OpeningOrdinaryOwner {\n' + members.join('\n') + '\n}', 'OpeningOrdinaryOwner.ets',
    { ...bookshelfOpeningInputs(source), ...dependencies }, ['OpeningOrdinaryOwner']).OpeningOrdinaryOwner;
}
