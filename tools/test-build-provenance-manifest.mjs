import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const generator = await readFile(new URL('./generate-build-provenance-manifest.mjs', import.meta.url), 'utf8');

assert.match(generator,
  /const embeddedNative = archiveEntryRecord\(hapPath, 'libs\/arm64-v8a\/libreader_core_napi\.so'\)/,
  'provenance generation must hash the NAPI actually embedded in the HAP');
assert.match(generator,
  /if \(embeddedNative\.sha256 !== appNativeSo\.sha256 \|\| embeddedNative\.bytes !== appNativeSo\.bytes\) \{[\s\S]*throw new Error\('HAP embedded NAPI does not match the Harmony app native input'\)/,
  'a HAP with a stale or substituted NAPI must be rejected');
assert.match(generator, /hap: \{[\s\S]*embeddedNative,[\s\S]*\}/,
  'the verified embedded NAPI record must be preserved in the manifest');

console.log('build provenance embedded NAPI contract: PASS');
