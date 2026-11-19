import { createHash } from 'node:crypto';
import { basename } from 'node:path';
import { assertAppVersion } from '../../scripts/lib/app-build-identity.mjs';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export function requireEvidence(condition, message) {
  if (!condition) throw new Error(message);
}

export function candidateIdentity(manifest, deployment, snapshot) {
  const signed = manifest.artifacts?.filter(item => item.kind === 'signed');
  const expected = manifest.expectedVersion;
  const installed = deployment.postInstall?.appVersion;
  requireEvidence(manifest.schemaVersion === 2 && signed?.length === 1 &&
    signed[0].signature?.verified === true && deployment.install === 'PASS' &&
    deployment.launch === 'PASS' && deployment.appVersionCheck === 'PASS' &&
    deployment.postInstall?.bundleName === 'io.reader.minliny' &&
    deployment.runId === manifest.runId && deployment.artifact?.sha256 === signed[0].sha256 &&
    /^[0-9a-f]{12}$/.test(deployment.targetRef ?? '') && /^[0-9a-f]{64}$/.test(signed[0].sha256),
  'Deployment does not bind the signed Reader candidate');
  assertAppVersion(expected, installed, 'Deployment');
  const descriptor = manifest.source?.buildInputs;
  requireEvidence(descriptor?.snapshot === 'source-snapshot.json' && Array.isArray(snapshot?.files),
    'Manifest has no registered source snapshot');
  const hash = createHash('sha256');
  const sources = new Map();
  for (const file of snapshot.files) {
    requireEvidence(typeof file.path === 'string' && !sources.has(file.path) &&
      /^[0-9a-f]{64}$/.test(file.sha256 ?? ''), 'Malformed or duplicated deployed source identity');
    hash.update(JSON.stringify(file)).update('\n');
    sources.set(file.path, file.sha256);
  }
  requireEvidence(snapshot.files.length === descriptor.fileCount && hash.digest('hex') === descriptor.fingerprint,
    'Source snapshot differs from the deployed manifest');
  return {
    appBuildId: expected.appBuildId, appContentHash: expected.appContentHash,
    hapSha256: signed[0].sha256, sourceFingerprint: descriptor.fingerprint,
    targetRef: deployment.targetRef, buildRunId: manifest.runId, sources,
  };
}

export function captureRecord(session, reference, bytes, primitive, { first = 0, last = session.length } = {}) {
  const matches = [];
  for (let index = first + 2; index < last; index++) {
    const integrity = session[index];
    if (integrity.event === 'capture-integrity' &&
      basename(integrity.path) === basename(reference.path) &&
      integrity.sha256 === reference.sha256 && integrity.bytes === bytes.length) matches.push(index);
  }
  requireEvidence(matches.length === 1, `Expected one matching device capture: ${reference.path}`);
  const entry = matches[0];
  const transfer = session[entry - 1];
  const remote = transfer.args?.[2];
  requireEvidence(transfer.ok === true && transfer.args?.slice(0, 2).join(' ') === 'file recv' &&
    typeof remote === 'string' && basename(remote) === basename(reference.path) &&
    transfer.args[3] === session[entry].path, `No matching native readback: ${reference.path}`);
  const captures = session.slice(first, entry - 1).flatMap((record, index) =>
    record.ok === true && record.args?.join(' ') === `shell uitest ${primitive} -p ${remote}` ? [index + first] : []);
  requireEvidence(captures.length === 1, `Expected one successful native ${primitive} for ${reference.path}`);
  return { bytes, entry, capture: captures[0] };
}

export function pngSize(bytes) {
  requireEvidence(bytes.length >= 33 && bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' &&
    bytes.readUInt32BE(8) === 13 && bytes.toString('ascii', 12, 16) === 'IHDR',
  'Native screenshot is missing a valid PNG header');
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  requireEvidence(width > 0 && height > 0, 'Native screenshot is empty');
  return { width, height };
}


export function nativeBounds(value) {
  return typeof value === 'string' ? /^\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]$/u.exec(value)?.slice(1).map(Number) : undefined;
}

export function normalReaderWindowRoots(tree) {
  return (tree?.children ?? []).filter(({attributes: a}) => a?.type === 'root' &&
    a.bundleName === 'io.reader.minliny' && a.abilityName === 'EntryAbility' &&
    a.pagePath === 'pages/Index' && a.hostWindowId);
}
