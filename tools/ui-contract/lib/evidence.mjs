import { mkdirSync, readFileSync, writeFileSync, lstatSync, realpathSync } from 'node:fs';
import { dirname, resolve, relative, isAbsolute, sep } from 'node:path';
import Ajv from 'ajv';
import { canonicalAppJson } from '../../../scripts/lib/app-build-identity.mjs';
import { EvidenceError, requireEvidence, sha256 } from '../../lib/native-ui-evidence.mjs';

const schema = JSON.parse(readFileSync(new URL('../schema/evidence.json', import.meta.url), 'utf8'));
const ajv = new Ajv({ allErrors: true, strict: true });
ajv.addSchema(schema);
const validators = new Map(['case', 'session', 'receipt', 'event'].map(type => [
  type, ajv.compile({ $ref: `reader-ui-phase0-v1#/$defs/${type}` }),
]));

export { EvidenceError, requireEvidence, sha256 };
export const jsonBytes = value => Buffer.from(`${canonicalAppJson(value)}\n`);
export const jsonDigest = value => sha256(jsonBytes(value));

export function validate(type, value) {
  const check = validators.get(type);
  requireEvidence(check?.(value), `Malformed ${type}: ${ajv.errorsText(check?.errors)}`);
  return value;
}

function safeEvidencePath(root, path, writing = false) {
  requireEvidence(typeof path === 'string' && !isAbsolute(path) && !path.includes('\\') &&
    ![...path].some(character => character.charCodeAt(0) < 0x20) &&
    path.split('/').every(part => part !== '.' && part !== '..' && part.length > 0),
  'Invalid evidence-relative path');
  let current = root;
  for (const part of path.split('/')) {
    current = resolve(current, part);
    const stat = lstatSync(current, { throwIfNoEntry: false });
    if (!stat && writing) continue;
    requireEvidence(stat && !stat.isSymbolicLink(), 'Evidence path is missing or a symbolic link');
  }
  if (!writing) {
    const rel = relative(root, realpathSync(current));
    requireEvidence(rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel) &&
      lstatSync(current).isFile(), 'Evidence reference must name a file inside the bundle');
  }
  return current;
}

export function evidenceStore(directory) {
  const root = realpathSync(directory);
  function reference(path) {
    const bytes = readFileSync(safeEvidencePath(root, path));
    return { path, bytes: bytes.length, sha256: sha256(bytes) };
  }
  function bytes(ref) {
    const data = readFileSync(safeEvidencePath(root, ref.path));
    requireEvidence(data.length === ref.bytes && sha256(data) === ref.sha256, `Changed evidence bytes: ${ref.path}`);
    return data;
  }
  function write(path, bytes) {
    const destination = safeEvidencePath(root, path, true);
    mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });
    writeFileSync(destination, bytes, { flag: 'wx', mode: 0o600 });
    return reference(path);
  }
  return { root, reference, bytes, write, json: ref => JSON.parse(bytes(ref)),
    writeJson: (path, value) => write(path, jsonBytes(value)) };
}

export function sealChain(entries) {
  let previous = null;
  return entries.map((entry, index) => {
    const child = { index, previous, entry };
    previous = jsonDigest(child);
    return { ...child, sha256: previous };
  });
}

export function verifyChain(chain) {
  let previous = null;
  for (const [index, { sha256: hash, ...child }] of chain.entries()) {
    requireEvidence(child.index === index && child.previous === previous && jsonDigest(child) === hash,
      `Broken evidence chain at index ${index}`);
    previous = hash;
  }
  return previous;
}
