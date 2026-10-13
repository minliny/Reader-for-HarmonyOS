import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const sdk = process.env.READER_ETS_LOADER_ROOT ??
  '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts = createRequire(import.meta.url)(`${sdk}/node_modules/typescript`);
export const readerPageShellSourceUrl = new URL(
  '../../entry/src/main/ets/features/common/ReaderPageShell.ts', import.meta.url);
const allowed = new Set(['ReaderPageShell', 'ReaderThemeRegistry', 'ReaderWindowMetrics',
  'SurfaceHorizontalGeometry', 'ReaderFloatingBarMetrics'].map(name =>
  new URL(`${name}.ts`, readerPageShellSourceUrl).href));
allowed.add(new URL('../manga/MangaDirectoryVisual.ts', readerPageShellSourceUrl).href);

/** Execute the complete current production module. Its finite real imports
 * cross the platform seam; never duplicate the modifier or geometry policy.
 * The optional source is used by focused mutation tests without editing files. */
export function actualReaderPageShell(source = readFileSync(readerPageShellSourceUrl, 'utf8')) {
  const modules = new Map();
  const load = url => {
    assert.ok(allowed.has(url.href), 'only finite actual page-policy dependencies are resolved: ' + url.pathname);
    if (modules.has(url.href)) return modules.get(url.href);
    const emitted = ts.transpileModule(url.href === readerPageShellSourceUrl.href ? source : readFileSync(url, 'utf8'), {
      fileName: url.pathname, reportDiagnostics: true,
      compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS, strict: true },
    });
    assert.deepEqual(emitted.diagnostics, [], 'actual shared page-policy module SDK emit: ' + url.pathname);
    const exports = {}; modules.set(url.href, exports);
    new Function('exports', 'require', 'Color', emitted.outputText)(exports, name => {
      assert.ok(name.startsWith('.'), 'page policy has no new platform dependency');
      return load(new URL(`${name}.ts`, url));
    }, { Transparent: 'Color.Transparent' });
    return exports;
  };
  return load(readerPageShellSourceUrl);
}
