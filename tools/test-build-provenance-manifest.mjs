import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const generator = await readFile(new URL('./generate-build-provenance-manifest.mjs', import.meta.url), 'utf8');

assert.match(generator,
  /const embeddedNative = archiveEntryRecord\(hapPath, 'libs\/arm64-v8a\/libreader_core_napi\.so'\)/,
  'provenance generation must hash the NAPI actually embedded in the HAP');
assert.match(generator,
  /const packagedNative = stripAllRecord\(appNativeSoPath, nativeStripToolPath\)/,
  'the HAP packaging-time strip transform must be reproduced from the accepted app input');
assert.match(generator,
  /execFileSync\(stripToolPath, \['--strip-all', outputPath\]/,
  'the reproduced packaging transform must use the observed Hvigor strip-all behavior');
assert.match(generator,
  /if \(embeddedNative\.sha256 !== packagedNative\.sha256 \|\| embeddedNative\.bytes !== packagedNative\.bytes\) \{[\s\S]*throw new Error\('HAP embedded NAPI does not match the reproducibly stripped Harmony app native input'\)/,
  'a HAP with a stale or substituted NAPI must be rejected after reproducing the packaging transform');
assert.match(generator, /nativePackaging: \{[\s\S]*arguments: \['--strip-all'\],[\s\S]*output: packagedNative,[\s\S]*\}/,
  'the strip tool, arguments, and derived packaged NAPI identity must be preserved');
assert.match(generator, /hap: \{[\s\S]*embeddedNative,[\s\S]*\}/,
  'the verified embedded NAPI record must be preserved in the manifest');
assert.match(generator, /fileRecord\(hapPath, basename\(hapPath\)\)/,
  'published provenance must not retain the ephemeral staging HAP path');

console.log('build provenance embedded NAPI contract: PASS');
