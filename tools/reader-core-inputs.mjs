// Compatibility entry points for the local sync-core/input-safety workflow.
// The current pipeline owns source, SDK and Native validation; this adapter
// cannot accept the former core-source-snapshot/package contract as a fallback.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CORE = resolve(ROOT, '../Reader-Core-Native');

export function assertCoreInputs(core = CORE, app = ROOT) {
  const base = resolve(core, 'target/harmony-napi/arm64-v8a');
  const scratch = mkdtempSync(resolve(tmpdir(), 'reader-core-preflight-'));
  const output = resolve(scratch, 'preflight.json');
  try {
    execFileSync(process.execPath, [resolve(ROOT, 'tools/generate-build-provenance-manifest.mjs'),
      '--preflight', '--allow-dirty', '--core-repo', core, '--harmony-repo', app,
      '--core-identity', resolve(base, 'core-build-identity.json'),
      '--core-input-snapshot', resolve(base, 'core-input-snapshot.json'),
      '--napi-manifest', resolve(base, 'harmony-package-manifest.sha256'),
      '--native-so', resolve(base, 'package/libs/arm64-v8a/libreader_core_napi.so'),
      '--app-native-so', resolve(app, 'entry/libs/arm64-v8a/libreader_core_napi.so'),
      '--harmony-vendor', resolve(app, 'entry/vendor/core-harmony'),
      '--core-build-evidence', resolve(base, 'harmony-napi-build-evidence.txt'), '--output', output,
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    const checked = JSON.parse(readFileSync(output, 'utf8'));
    const snapshot = JSON.parse(readFileSync(resolve(base, 'core-input-snapshot.json'), 'utf8'));
    return { fingerprint: checked.coreInputFingerprint, fileCount: snapshot.fileCount,
      buildId: checked.buildId, nativeSha256: checked.nativeSo.sha256 };
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}

export function syncCoreInputs(core = CORE, app = ROOT) {
  if (resolve(core) !== CORE || resolve(app) !== ROOT) {
    throw new Error('Native synchronization uses the current pipeline workspace; use the authoritative preflight for isolated fixtures');
  }
  execFileSync(process.execPath, [resolve(ROOT, 'scripts/hap-pipeline.mjs'), 'sync-native'],
    { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return assertCoreInputs(core, app);
}
