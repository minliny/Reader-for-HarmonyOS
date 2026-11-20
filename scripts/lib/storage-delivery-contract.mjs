import { lstatSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { storageSha256, verifyStorageBuildContract } from '../../../Reader-Core/scripts/storage-build-contract.mjs';

export const STORAGE_BOOTSTRAP_RESOURCE = 'reader-core-storage-identity.v1.json';
export function storageBootstrapIdentityBytes(companion) {
  const build = verifyStorageBuildContract(companion);
  return Buffer.from(JSON.stringify({ format: 'reader.storage-bootstrap-identity', version: 1,
    buildId: build.coreBuildId, contractSha256: build.contractSha256,
    coreInputFingerprint: build.coreInputFingerprint }, null, 2) + '\n');
}
export function verifyStorageBootstrapIdentity(bytes, companion) {
  if (!Buffer.from(bytes).equals(storageBootstrapIdentityBytes(companion))) throw new Error('storage bootstrap expectation does not match the verified Native companion');
}

function readRegular(path) {
  if (!lstatSync(path).isFile()) throw new Error('storage delivery input must be a regular file');
  return readFileSync(path);
}
export function publishStorageDeliveryContract(directory, artifact, provenance) {
  const build = verifyStorageBuildContract(provenance.storageBuildContract, {
    coreIdentity: provenance.core.buildIdentity,
    identitySha256: provenance.core.buildIdentityArtifact.sha256,
    nativeRecord: provenance.napi.nativeInput,
  });
  if (build.coreInputFingerprint !== provenance.core.buildInputFingerprint ||
      provenance.hap?.sha256 !== artifact.sha256 ||
      provenance.hap?.embeddedNative?.sha256 !== artifact.embeddedCoreNapi.sha256) {
    throw new Error('storage/HAP provenance binding mismatch');
  }
  // Keep the signed HAP immutable. This separately hashed companion binds the
  // same verified Native input to the actual stripped library inside this HAP.
  const { contract, ...buildCompanion } = build;
  const value = { format: 'reader.storage-delivery-contract', version: 1, build: buildCompanion,
    hapSha256: artifact.sha256, embeddedNativeSha256: artifact.embeddedCoreNapi.sha256,
    nativePackaging: provenance.harmony.nativePackaging };
  const path = `${artifact.kind}-storage-contract.v1.json`;
  const bytes = Buffer.from(JSON.stringify(value, null, 2) + '\n');
  writeFileSync(resolve(directory, path), bytes, { flag: 'wx', mode: 0o644 });
  return { path, bytes: bytes.length, sha256: storageSha256(bytes) };
}
export function verifyStorageDeliveryContract(directory, artifact, sourceNative) {
  const record = artifact.storageContract;
  if (!record) return null; // Historical evidence stays readable, never installable.
  if (!sourceNative || !/^[a-f0-9]{64}$/.test(sourceNative.sha256 ?? '') ||
      !Number.isSafeInteger(sourceNative.bytes) || sourceNative.bytes <= 0) throw new Error('storage Native source binding is missing');
  if (record.path !== `${artifact.kind}-storage-contract.v1.json`) throw new Error('invalid storage companion path');
  const bytes = readRegular(resolve(directory, record.path));
  if (record.sha256 !== storageSha256(bytes) || record.bytes !== bytes.length) throw new Error('storage companion artifact changed');
  const value = JSON.parse(bytes);
  if (value.format !== 'reader.storage-delivery-contract' || value.version !== 1 ||
      value.hapSha256 !== artifact.sha256 || value.embeddedNativeSha256 !== artifact.embeddedCoreNapi.sha256 ||
      value.nativePackaging?.output?.sha256 !== artifact.embeddedCoreNapi.sha256 ||
      value.nativePackaging?.output?.bytes !== artifact.embeddedCoreNapi.bytes ||
      JSON.stringify(value.nativePackaging?.arguments) !== JSON.stringify(['--strip-all'])) throw new Error('storage/HAP Native binding mismatch');
  const build = verifyStorageBuildContract(value.build, { nativeRecord: sourceNative });
  const bootstrap = artifact.requiredResources?.find(record => record.path === `resources/rawfile/${STORAGE_BOOTSTRAP_RESOURCE}`);
  const expectedBootstrap = storageBootstrapIdentityBytes(value.build);
  if (!bootstrap || bootstrap.sha256 !== storageSha256(expectedBootstrap) || bootstrap.bytes !== expectedBootstrap.length) throw new Error('storage bootstrap resource is not bound to this HAP Native');
  return { contract: build.contract, contractSha256: build.contractSha256, coreBuildId: build.coreBuildId,
    coreInputFingerprint: build.coreInputFingerprint, nativeInputSha256: build.nativeSha256,
    nativeSha256: value.embeddedNativeSha256, hapSha256: value.hapSha256, companionSha256: record.sha256 };
}
