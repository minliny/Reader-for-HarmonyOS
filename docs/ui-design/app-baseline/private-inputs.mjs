// The historical baseline is conditional on a reviewed private evidence snapshot.
// Verify its closed file set before importing the local registry module.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const relative = (root, file) => path.relative(root, file).split(path.sep).join('/');

export async function verifyPrivateInputs(root, contract) {
  root = path.resolve(root);
  const found = new Set([contract.registry]);
  for (const session of contract.sessions) {
    const directory = path.join(root, session);
    let entries;
    try { entries = await fs.readdir(directory); }
    catch { throw new Error(`BASELINE_PRIVATE_INPUTS_MISSING ${session}; restore the reviewed private snapshot or pass --evidence-host-root PATH`); }
    for (const name of entries) {
      if (/^preflight-.*\.json$|^batch-.*\.jsonl$|^session-preflight\.json$/.test(name)) found.add(`${session}/${name}`);
    }
    const captures = path.join(directory, 'captures');
    for (const name of await fs.readdir(captures)) {
      if (name.endsWith('.jsonl')) found.add(`${session}/captures/${name}`);
      if (!/^reader-control-(?:nui|redo)-.*\.png$/.test(name)) continue;
      found.add(`${session}/captures/${name}`);
      for (const suffix of ['.json', '-before.json']) {
        const sidecar = path.join(captures, name.replace(/\.png$/, suffix));
        try { await fs.access(sidecar); found.add(relative(root, sidecar)); } catch {}
      }
    }
  }
  const expected = Object.keys(contract.files).sort();
  if (JSON.stringify([...found].sort()) !== JSON.stringify(expected)) throw new Error('BASELINE_PRIVATE_INPUT_SET_CHANGED; review and bind the new snapshot before regeneration');
  for (const name of expected) {
    const file = path.join(root, name);
    const real = await fs.realpath(file);
    const realRoot = await fs.realpath(root);
    if (!real.startsWith(realRoot + path.sep) || (await fs.lstat(file)).isSymbolicLink()) throw new Error(`BASELINE_PRIVATE_INPUT_PATH_INVALID ${name}`);
    if (sha(await fs.readFile(file)) !== contract.files[name]) throw new Error(`BASELINE_PRIVATE_INPUT_HASH_CHANGED ${name}`);
  }
  return { fileCount: expected.length, inputSetSha256: sha(JSON.stringify(contract.files)), evidenceSnapshotAt: contract.evidenceSnapshotAt };
}

export async function loadPrivateRegistry(argv = process.argv.slice(2)) {
  const index = argv.indexOf('--evidence-host-root');
  if (index >= 0 && (!argv[index + 1] || argv[index + 1].startsWith('--'))) throw new Error('--evidence-host-root requires a path');
  const hostRoot = path.resolve(index >= 0 ? argv[index + 1] : path.join(here, '../../..'));
  const contract = JSON.parse(await fs.readFile(path.join(here, 'private-inputs.json'), 'utf8'));
  if (contract.schemaVersion !== 1 || contract.private !== true) throw new Error('BASELINE_PRIVATE_INPUT_CONTRACT_INVALID');
  const inputBinding = await verifyPrivateInputs(hostRoot, contract);
  const module = await import(pathToFileURL(path.join(hostRoot, contract.registry)).href);
  const registry = module.readNativeCaptureRegistry();
  if (registry.captureCount !== contract.captureCount || registry.observedStateCount !== contract.observedStateCount) throw new Error('BASELINE_PRIVATE_REGISTRY_COUNTS_CHANGED');
  // Preserve the historical index date; this maintenance does not capture a new UI.
  registry.generatedAt = contract.evidenceSnapshotAt;
  return { hostRoot, registry, confirmedDirections: module.confirmedDirections, inputBinding };
}
