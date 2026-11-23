import { installedEtsCompiler } from './ets-compiler-runtime.mjs';
import { localFilePath } from './tool-environment.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { ts } = installedEtsCompiler();
const sdkModuleEmits = new Map();
export const readerPageShellSourceUrl = new URL(
  '../../entry/src/main/ets/ui/layout/ReaderPageShell.ts', import.meta.url);
const nativeAttributesUrl = new URL('ReaderPageNativeAttributes.ets', readerPageShellSourceUrl);
const allowed = new Set([readerPageShellSourceUrl.href, new URL('ReaderFrameStyle.ts', readerPageShellSourceUrl).href]);
allowed.add(nativeAttributesUrl.href);
const layoutFiles = ['ReaderFrameStyle.ts', 'ReaderPageGeometry.ts', 'ReaderScrollLayout.ts', 'ReaderMeasurements.ts'];
const headerSpecs = '../foundation/ReaderHeaderSpecs.ets';
for (const file of [...layoutFiles, 'SurfaceHorizontalGeometry.ts', 'ReaderFloatingBarMetrics.ts',
  headerSpecs, '../foundation/ReaderTokens.ets', '../foundation/ReaderWidthClass.ts']) {
  allowed.add(new URL(file, readerPageShellSourceUrl).href);
}
for (const name of ['ReaderThemeRegistry', 'ReaderWindowMetrics', 'ReaderLayoutTokens', 'ReaderSurfaceResolvers', 'ReaderHeaderMetrics']) {
  allowed.add(new URL(`../foundation/${name}.ts`, readerPageShellSourceUrl).href);
}

/** Execute the complete current production module. Its finite real imports
 * cross the platform seam; never duplicate the modifier or geometry policy.
 * The optional source is used by focused mutation tests without editing files. */
function pageModuleLoader(source = readFileSync(readerPageShellSourceUrl, 'utf8')) {
  const modules = new Map();
  const load = url => {
    assert.ok(allowed.has(url.href), 'only finite actual page-policy dependencies are resolved: ' + localFilePath(url));
    if (modules.has(url.href)) return modules.get(url.href);
    const text = url.href === readerPageShellSourceUrl.href ? source : readFileSync(url, 'utf8');
    const key = JSON.stringify([url.href, text]);
    let output = sdkModuleEmits.get(key);
    if (output === undefined) {
      const emitted = ts.transpileModule(text, {
        fileName: localFilePath(url), reportDiagnostics: true,
        compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.CommonJS, strict: true },
      });
      assert.deepEqual(emitted.diagnostics, [], 'actual shared page-policy module SDK emit: ' + localFilePath(url));
      output = emitted.outputText;
      if (sdkModuleEmits.size >= 64) sdkModuleEmits.delete(sdkModuleEmits.keys().next().value);
      sdkModuleEmits.set(key, output);
    }
    // Only compilation is shared. Each composition gets its own complete real
    // module graph/exports, preserving mutation controls and state isolation.
    const exports = {}; modules.set(url.href, exports);
    new Function('exports', 'require', 'Color', output)(exports, name => {
      assert.ok(name.startsWith('.'), 'page policy has no new platform dependency');
      const tsModule = new URL(`${name}.ts`, url);
      return load(allowed.has(tsModule.href) ? tsModule : new URL(`${name}.ets`, url));
    }, { Transparent: 'Color.Transparent' });
    return exports;
  };
  return load;
}

export function actualReaderPageShell(source) {
  // Builder probes receive both real modules at their native seam. Production
  // ETS consumers import modifiers directly, never through TypeScript policy.
  const load = pageModuleLoader(source);
  return Object.assign({}, load(readerPageShellSourceUrl), load(nativeAttributesUrl));
}

export function actualReaderFloatingBarMetrics() {
  return pageModuleLoader()(new URL('ReaderFloatingBarMetrics.ts', readerPageShellSourceUrl));
}

export function actualReaderPageLayout() {
  const load = pageModuleLoader();
  return Object.assign({}, load(readerPageShellSourceUrl), load(nativeAttributesUrl), ...layoutFiles.map(file => load(new URL(file, readerPageShellSourceUrl))),
    { readerPageInitialHeaderHeight: load(new URL(headerSpecs, readerPageShellSourceUrl)).readerPageInitialHeaderHeight });
}
