import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { X509Certificate } from 'node:crypto';
import { readSigningAuthority, assertSigningCertificateAuthority, assertSigningMaterialAuthority } from './reader-signing-authority.mjs';

const root = mkdtempSync(resolve(tmpdir(), 'reader-authority-test-'));
try {
  writeFileSync(resolve(root, 'openssl.cnf'), '[req]\ndistinguished_name=dn\nx509_extensions=ext\nprompt=no\n[dn]\nCN=Reader signing test\n[ext]\nbasicConstraints=critical,CA:false\nkeyUsage=digitalSignature\n');
  for (const name of ['approved', 'other']) {
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
      '-config', resolve(root, 'openssl.cnf'), '-keyout', resolve(root, `${name}.key`),
      '-out', resolve(root, `${name}.cer`)], { stdio: 'ignore' });
  }
  const fingerprint = name => new X509Certificate(readFileSync(resolve(root, `${name}.cer`))).fingerprint256;
  const approved = fingerprint('approved');
  const other = fingerprint('other');
  copyFileSync(resolve(root, 'approved.cer'), resolve(root, 'certificate.cer'));
  const policyPath = resolve(root, 'authority.json');
  writeFileSync(policyPath, JSON.stringify({ schema: 1, certificateSha256: approved }));
  const policy = readSigningAuthority(policyPath);
  assert.doesNotThrow(() => assertSigningCertificateAuthority(approved, policy));
  assert.throws(() => assertSigningCertificateAuthority(other, policy), /not the user-approved/);
  const profile = path => ({ app: { signingConfigs: [{ material: { certpath: path, profile: 'private-profile' } }] } });
  assert.doesNotThrow(() => assertSigningMaterialAuthority(profile(resolve(root, 'approved.cer')), () => ({ certificateSha256: approved }), policy));
  assert.throws(() => assertSigningMaterialAuthority(profile(resolve(root, 'other.cer')), () => assert.fail('must reject before reading Profile'), policy), /not the user-approved/);
  assert.throws(() => assertSigningMaterialAuthority(profile(resolve(root, 'approved.cer')), () => ({ certificateSha256: other }), policy), /not the user-approved/);
  assert.throws(() => assertSigningMaterialAuthority(profile(resolve(root, 'approved.cer')), () => { throw new Error('bundle identity mismatch'); }, policy), /bundle identity mismatch/);
  copyFileSync(resolve(root, 'other.cer'), resolve(root, 'certificate.cer'));
  assert.throws(() => readSigningAuthority(policyPath), /pinned SHA256/);
  assert.throws(() => readSigningAuthority(resolve(root, 'missing.json')), /authority is missing/);
  console.log('Huawei signing authority: PASS (matching certificate, wrong signer, wrong Profile, wrong bundle, tampered/missing authority)');
} finally { rmSync(root, { recursive: true, force: true }); }
