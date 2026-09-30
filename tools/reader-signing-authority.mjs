import { X509Certificate } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';

const AUTHORITY_FILE = resolve(homedir(), '.codex/harmony-signing/authority.json');
const normalize = value => String(value || '').replaceAll(':', '').toLowerCase();

function leafFingerprint(path) {
  try {
    const bytes = readFileSync(path);
    const chain = bytes.toString('utf8').match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g) || [bytes];
    const leaves = chain.map(value => new X509Certificate(value)).filter(cert => !cert.ca);
    if (leaves.length !== 1) throw new Error('ambiguous application certificate');
    return normalize(leaves[0].fingerprint256);
  } catch {
    throw new Error('Cannot read the unique application signing certificate; no private material was logged.');
  }
}

export function readSigningAuthority(path = AUTHORITY_FILE) {
  let policy;
  try { policy = JSON.parse(readFileSync(path, 'utf8')); }
  catch { throw new Error('Huawei signing authority is missing or invalid; configure ~/.codex/harmony-signing/authority.json.'); }
  const fingerprint = normalize(policy.certificateSha256);
  if (policy.schema !== 1 || !/^[a-f0-9]{64}$/.test(fingerprint) ||
      leafFingerprint(resolve(dirname(path), 'certificate.cer')) !== fingerprint) {
    throw new Error('Huawei signing authority certificate does not match its pinned SHA256.');
  }
  return { certificateSha256: fingerprint };
}

export function assertSigningCertificateAuthority(fingerprint, authority = readSigningAuthority()) {
  if (normalize(fingerprint) !== authority.certificateSha256) {
    throw new Error('Signing certificate is not the user-approved Huawei certificate. Configure its matching keystore and Profile; automatic replacement is forbidden.');
  }
}

export function assertSigningMaterialAuthority(profile, readProfileIdentity, authority = readSigningAuthority()) {
  const material = profile?.app?.signingConfigs?.[0]?.material;
  assertSigningCertificateAuthority(leafFingerprint(material?.certpath), authority);
  // Reuse the pipeline CMS/Profile parser and bundle-identity validation.
  const identity = readProfileIdentity(material.profile);
  assertSigningCertificateAuthority(identity.certificateSha256, authority);
}
