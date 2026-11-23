import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { installedEtsCompiler } from './ets-compiler-runtime.mjs';
import { pureModuleProbe } from './ets-pure-module-probe.mjs';
import { virtualFilePath } from './tool-environment.mjs';

const root = new URL('../../entry/src/main/ets/features/reading/', import.meta.url);
export const readingSource = path => readFileSync(new URL(path, root), 'utf8');
export function readerP1Module(path, dependencies, names) {
  return pureModuleProbe(readingSource(path), path, dependencies, names);
}
export function readerP1Methods(path, names, dependencies) {
  const { ts, options } = installedEtsCompiler();
  const tree = ts.createSourceFile(virtualFilePath(path), readingSource(path), ts.ScriptTarget.Latest, true, ts.ScriptKind.ETS, options);
  assert.deepEqual(tree.parseDiagnostics, []);
  const owner = tree.statements.find(node => node.members && names.every(name =>
    node.members.some(member => member.name?.getText(tree) === name)));
  assert.ok(owner, 'actual production owner contains requested methods');
  const methods = names.map(name => owner.members.find(member => member.name?.getText(tree) === name).getText(tree));
  return pureModuleProbe('class Owner {\n' + methods.join('\n') + '\n}', path, dependencies, ['Owner']).Owner;
}

export { readerExperienceDeclarationSource } from './reader-experience-fixture-source.mjs';
