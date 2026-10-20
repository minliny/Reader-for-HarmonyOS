import assert from 'node:assert/strict';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

async function dependencyBoundaryCase() {
  const { existsSync, readFileSync } = await import('node:fs');
  const { installedEtsCompiler } = await import('./lib/ets-compiler-runtime.mjs');
  const { ts, options } = installedEtsCompiler();
  const reading = new URL('../entry/src/main/ets/features/reading/', import.meta.url);
  for (const relative of [
    '../entry/src/main/cpp/pagecurl',
    '../entry/src/main/ets/features/reading/ReaderNativePageCurlSurface.ets',
    '../entry/src/main/ets/features/reading/ReaderPageRasterCache.ts',
  ]) assert.equal(existsSync(new URL(relative, import.meta.url)), false, `retired production path ${relative}`);

  // This is a finite dependency policy, not a renderer/gesture behavior test.
  // Parse imports/calls so shader spelling, comments and dead text do not
  // stand in for the production protocols exercised by their own case owners.
  for (const name of ['LocalReadingExperience.ets', 'ReaderPageTurnStage.ets',
    'ReaderBookTurnSurface.ets', 'BookTurnTextureBuilder.ets',
    'ReaderPageInteractionLayer.ets', 'BookTurnPresentationSession.ets']) {
    const source = readFileSync(new URL(name, reading), 'utf8');
    const tree = ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
    assert.deepEqual(tree.parseDiagnostics, [], `${name} parses for dependency inspection`);
    for (const declaration of tree.statements.filter(ts.isImportDeclaration)) {
      assert.doesNotMatch(declaration.moduleSpecifier.text,
        /(?:^|[/\\])(?:pagecurl|ReaderNativePageCurlSurface|ReaderPageRasterCache)(?:[./\\]|$)/i,
        `${name} cannot import the withdrawn implementation`);
    }
    if (name === 'ReaderBookTurnSurface.ets' || name === 'ReaderPageInteractionLayer.ets') {
      const forbidden = name === 'ReaderBookTurnSurface.ets'
        ? new Set(['Canvas', 'DrawingRenderingContext'])
        : new Set(['createFromComponent', 'uploadTexture']);
      function visit(node) {
        if (ts.isCallExpression(node) || ts.isNewExpression(node) || ts.isEtsComponentExpression?.(node)) {
          const called = ts.isPropertyAccessExpression(node.expression) ? node.expression.name.text : node.expression?.text;
          assert.ok(!forbidden.has(called), `${name} dependency boundary forbids ${called}`);
        }
        ts.forEachChild(node, visit);
      }
      visit(tree);
    }
  }
}

for (const id of selectContractCases({
  'dependency-boundary': { description: 'Finite retired-path/import and native-visual/raw-input dependency policy; no shader/progress behavior claim', resources: [] },
})) { await dependencyBoundaryCase(); recordContractCasePass(id); }
