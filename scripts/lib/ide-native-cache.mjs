import { createHash } from 'node:crypto';
import { constants, copyFileSync, lstatSync, mkdirSync, mkdtempSync, readFileSync,
  readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const libraries = new Set(['libc++_shared.so', 'libreader_bookturn_napi.so', 'libreader_core_napi.so']);
const stages = ['cmake/default/obj', 'libs/default', 'stripped_native_libs/default'];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

// These are generated Hvigor directories, never entry/libs or an input SDK.
// Run before task execution/input snapshots, while holding the build lease.
// A numbered copy is recoverable only when the canonical sibling is identical.
export function reconcileIdeNativeCache(repoRoot) {
  const root = resolve(repoRoot);
  function realDirectory(path) {
    const parent = dirname(path);
    if (path !== root && !realDirectory(parent)) return false;
    const stat = lstatSync(path, { throwIfNoEntry: false });
    if (!stat) return false;
    if (!stat.isDirectory()) throw new Error(`Native cache parent must be a real directory: ${path}`);
    return true;
  }
  const candidates = [];
  function visit(directory) {
    for (const name of readdirSync(directory).sort()) {
      const path = join(directory, name), stat = lstatSync(path);
      const nativeName = /\.so(?:\.\d+)*$/.test(name);
      if (stat.isDirectory() && !nativeName) { visit(path); continue; }
      if (!stat.isFile()) throw new Error(`Native cache entry must be a regular file or real directory: ${path}`);
      if (!nativeName) continue;
      if (libraries.has(name)) continue;
      const match = /^(.*) [1-9]\d*\.so$/.exec(name);
      const canonicalName = match ? `${match[1]}.so` : undefined;
      if (!libraries.has(canonicalName)) throw new Error(`Unexpected generated Native library; refusing automatic recovery: ${path}`);
      const canonical = join(directory, canonicalName), canonicalStat = lstatSync(canonical, { throwIfNoEntry: false });
      if (!canonicalStat?.isFile()) throw new Error(`Numbered Native copy has no regular canonical sibling: ${path}`);
      const bytes = readFileSync(path), expected = readFileSync(canonical);
      if (!bytes.equals(expected)) throw new Error(`Numbered Native copy differs from its canonical sibling; refusing automatic recovery: ${path}`);
      candidates.push({ path: relative(root, path), canonical: relative(root, canonical),
        bytes: bytes.length, sha256: digest(bytes), recoveryPath: relative(root, path), stat });
    }
  }
  for (const stage of stages) {
    const directory = join(root, 'entry/build/default/intermediates', stage);
    if (realDirectory(directory)) visit(directory);
  }
  if (!candidates.length) return { removed: [], recoveryDirectory: null };

  // Validate the whole inventory before touching any generated file. Preserve
  // bytes in independent files, since ProcessLibs can hard-link its inputs.
  const recoveryRoot = join(root, '.reader-local/native-cache-recovery');
  realDirectory(recoveryRoot);
  mkdirSync(recoveryRoot, { recursive: true, mode: 0o700 });
  const recoveryDirectory = mkdtempSync(join(recoveryRoot, 'recovery-'));
  const files = candidates.map(({ stat, ...record }) => record);
  const receipt = { schemaVersion: 1, operation: 'recover-identical-generated-native-copies',
    status: 'BACKED_UP', files, removed: [] };
  const receiptPath = join(recoveryDirectory, 'receipt.json');
  function saveReceipt() {
    const stat = lstatSync(receiptPath, { throwIfNoEntry: false });
    if (!realDirectory(recoveryDirectory) || (stat && !stat.isFile())) throw new Error('Native cache recovery receipt path changed');
    writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600 });
  }
  function unchanged(candidate) {
    const path = join(root, candidate.path), canonical = join(root, candidate.canonical);
    if (!realDirectory(dirname(path)) || !realDirectory(dirname(canonical))) throw new Error('Native cache parent changed during recovery');
    const stat = lstatSync(path), canonicalStat = lstatSync(canonical);
    if (!stat.isFile() || !canonicalStat.isFile() || stat.ino !== candidate.stat.ino ||
        stat.dev !== candidate.stat.dev || digest(readFileSync(path)) !== candidate.sha256 ||
        digest(readFileSync(canonical)) !== candidate.sha256) {
      throw new Error(`Native cache changed during recovery; refusing removal: ${path}`);
    }
  }
  for (const candidate of candidates) {
    unchanged(candidate);
    const backup = join(recoveryDirectory, candidate.recoveryPath);
    if (!realDirectory(recoveryDirectory)) throw new Error('Native cache recovery directory changed');
    mkdirSync(dirname(backup), { recursive: true, mode: 0o700 });
    if (!realDirectory(dirname(backup))) throw new Error('Native cache backup parent changed');
    copyFileSync(join(root, candidate.path), backup, constants.COPYFILE_EXCL);
    if (digest(readFileSync(backup)) !== candidate.sha256) throw new Error('Native cache backup verification failed');
  }
  saveReceipt();
  for (const candidate of candidates) unchanged(candidate);
  for (const candidate of candidates) {
    unchanged(candidate);
    unlinkSync(join(root, candidate.path));
    receipt.removed.push(candidate.path);
    saveReceipt();
  }
  receipt.status = 'RECOVERED';
  saveReceipt();
  return { removed: files, recoveryDirectory };
}
