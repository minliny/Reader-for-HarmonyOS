import { readFileSync } from 'node:fs';

export const capsuleModelInputFile = 'lib/capsule-model-inputs.json';

export function capsuleModelInputPaths(definition) {
  const roles = ['presentation', 'timeline', 'controller'];
  if (!definition || !Array.isArray(definition.support) || Object.keys(definition).length !== roles.length + 1) {
    throw new Error('Invalid capsule model input declaration');
  }
  const paths = [...roles.map(role => definition[role]), ...definition.support];
  if (new Set(paths).size !== paths.length || paths.some(path => typeof path !== 'string' ||
      !/^entry\/src\/main\/ets\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.ts$/u.test(path))) {
    throw new Error('Capsule model paths must be unique Reader TypeScript inputs');
  }
  return paths;
}

export function readCapsuleModelInputs(root = new URL('../', import.meta.url)) {
  return capsuleModelInputPaths(JSON.parse(readFileSync(new URL(capsuleModelInputFile, root), 'utf8')));
}
