import { createRequire } from 'node:module';
import path from 'node:path';
import { resolveEtsLoaderRoot } from './tool-environment.mjs';

/** One installed SDK loader for probes. Dialect, target, module format and
 * injected business dependencies remain explicit at each call site. Node's
 * module cache is keyed by the resolved SDK path, never by the first host. */
export function installedEtsCompiler(root = resolveEtsLoaderRoot()) {
  const require = createRequire(path.join(root, 'package.json'));
  return {
    root,
    require,
    ts: require(path.join(root, 'node_modules/typescript')),
    get options() { return require(path.join(root, 'lib/ets_checker.js')).compilerOptions; },
  };
}
