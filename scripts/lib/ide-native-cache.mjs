import { createHash } from 'node:crypto';
import { constants, copyFileSync, lstatSync, mkdirSync, mkdtempSync, readFileSync,
  unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const libraries = new Set(['libc++_shared.so', 'libreader_bookturn_napi.so', 'libreader_core_napi.so']);
const stages = ['cmake/default/obj', 'libs/default', 'stripped_native_libs/default'];
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

// These are generated Hvigor directories, never entry/libs or an input SDK.
// Run before task execution/input snapshots, while holding the build lease.
// A numbered copy is recoverable only when the canonical sibling is identical.
export function reconcileIdeNativeCache(repoRoot, { paths = [], repair = false } = {}) {
  const root = resolve(repoRoot);
  if (!Array.isArray(paths) || new Set(paths).size !== paths.length) throw new Error('Select unique generated Native file paths');
  if (!paths.length) return { status: 'NOT_RUN', removed: [], recoveryDirectory: null };
  function realDirectory(path) {
    const parent = dirname(path);
    if (path !== root && !realDirectory(parent)) return false;
    const stat = lstatSync(path, { throwIfNoEntry: false });
    if (!stat) return false;
    if (!stat.isDirectory()) throw new Error(`Native cache parent must be a real directory: ${path}`);
    return true;
  }
  const candidates = [];
  function inspect(path) {
      const directory = dirname(path), name = path.slice(directory.length + 1), stat = lstatSync(path);
      if (!stat.isFile()) throw new Error(`Native cache entry must be a regular file or real directory: ${path}`);
      if (libraries.has(name)) return;
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
  for (const selected of paths) {
    if (typeof selected !== 'string' || isAbsolute(selected) || selected.split(/[\\/]/).some(part => ['', '.', '..'].includes(part))) throw new Error('Select an exact repository-relative generated Native file');
    if (!stages.some(stage => selected.startsWith(`entry/build/default/intermediates/${stage}/`))) throw new Error('Native diagnosis is limited to the three generated stages');
    const path = resolve(root, selected);
    if (!realDirectory(dirname(path))) throw new Error('Selected Native cache parent is missing');
    inspect(path);
  }
  if (!repair || !candidates.length) return { status: 'DIAGNOSED', candidates: candidates.map(({ stat, ...record }) => record), removed: [], recoveryDirectory: null };

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
  return { status: 'RECOVERED', removed: files, recoveryDirectory };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { path: { type: 'string', multiple: true }, repair: { type: 'boolean' }, list: { type: 'boolean' } }, allowPositionals: false });
  if(values.list && (values.path?.length || values.repair)) throw new Error('--list cannot perform diagnosis or repair');
  if(!values.path?.length && !values.repair) console.log(JSON.stringify({status:'NOT_RUN',defaultExecution:'OFF',usage:'--path <exact generated SO> [--repair]; ordinary builds never scan the cache'}));
  else {
  if (!values.path?.length) throw new Error('Use --path <exact generated SO> [--repair]; ordinary builds never scan the cache');
  const lease = values.repair ? (await import('../../../Reader-Core/scripts/lib/build-resource-lock.mjs')).acquireBuildLease() : { release() {} };
  try { console.log(JSON.stringify(reconcileIdeNativeCache(resolve(dirname(fileURLToPath(import.meta.url)), '../..'), { paths: values.path, repair: values.repair === true }))); }
  finally { lease.release(); }
  }
}
