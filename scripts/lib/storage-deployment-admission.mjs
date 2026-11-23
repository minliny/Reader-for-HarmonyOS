import { storageSha256, requireStorageSha, validateStorageContract } from '../../../Reader-Core/scripts/storage-build-contract.mjs';

// Only a live session created by the canonical, in-process device collector can
// authorize install. A saved receipt or JSON {status: 'PASS'} cannot acquire it.
const sessions = new WeakMap();
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
const encode = value => JSON.stringify(canonical(value));
function freezeTree(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freezeTree); Object.freeze(value); }
  return value;
}
export const installedStorageIdentity = value => storageSha256(encode(value));
function checkFacts(context, facts) {
  if (!facts || typeof facts !== 'object') throw new Error('storage device facts are missing');
  const expected = { serverKey: context.serverKey, target: context.target, bootIdSha256: context.bootIdSha256,
    bundleName: context.bundleName, installedIdentitySha256: context.installedIdentitySha256 };
  if (encode(facts.binding) !== encode(expected)) throw new Error('storage target, boot or installed identity changed');
  requireStorageSha(facts.snapshot?.manifestSha256, 'storage snapshot manifest');
  if (context.mode === 'install') {
    if (facts.barrier?.held !== true || typeof facts.barrier.kind !== 'string' || !facts.barrier.kind) throw new Error('storage write barrier is not held');
    requireStorageSha(facts.barrier.tokenSha256, 'storage barrier token');
    requireStorageSha(facts.snapshot.backupReceiptSha256, 'consistent storage backup');
  }
  if (facts.freshStorage === true) {
    // The collector must prove a genuinely empty storage root. Neither bundle
    // absence nor a missing/overwritten sidecar establishes empty user data.
    if (facts.layout !== null || facts.snapshot.databaseSha256 !== null || facts.snapshot.walSha256 !== null ||
        facts.emptyStorageObserved !== true) throw new Error('fresh storage lacks an observed empty-root proof');
    return;
  }
  requireStorageSha(facts.snapshot.databaseSha256, 'storage database');
  if (facts.snapshot.walSha256 !== null) requireStorageSha(facts.snapshot.walSha256, 'storage WAL');
  const contract = context.candidate.contract;
  const generation = facts.dataFormatGeneration ?? facts.layout?.dataFormatGeneration;
  if (generation !== undefined && generation !== null && !contract.dataFormatGenerations.includes(generation)) throw new Error('candidate cannot preserve observed data format generation');
  if (facts.requiresMigration === true) {
    const plan = facts.explicitMigration;
    const range = contract.migrations.explicitLegacyRange;
    const target = contract.layouts.find(layout => layout.schemaVersion === plan?.targetSchemaVersion);
    if (facts.layout !== null || !plan || !Array.isArray(range) || range.length !== 2 ||
        !range.every(value => Number.isSafeInteger(value) && value >= 0) || range[0] > range[1] ||
        !Number.isSafeInteger(plan.sourceSchemaVersion) || plan.sourceSchemaVersion < range[0] || plan.sourceSchemaVersion > range[1] ||
        plan.targetSchemaVersion !== contract.migrations.targetSchemaVersion || plan.sourceSchemaVersion >= plan.targetSchemaVersion ||
        !target?.read || !target.write || !contract.normalOpen.acceptedLayouts.includes(plan.targetSchemaVersion)) throw new Error('candidate cannot execute the observed explicit legacy migration');
    // The source cursor comes from Core's read-only legacy shape validator.
    // Keep it as a migration plan; never label target 44 as the observed layout.
    return;
  }
  if (facts.explicitMigration !== undefined && facts.explicitMigration !== null) throw new Error('storage migration plan and observation disagree');
  requireStorageSha(facts.layout?.schemaFingerprint, 'actual storage layout fingerprint');
  if (!Number.isSafeInteger(facts.layout.schemaCookie) || facts.layout.schemaCookie < 0) throw new Error('storage schema cookie is missing');
  const layout = contract.layouts.find(value => value.schemaVersion === facts.layout.schemaVersion && value.layoutId === facts.layout.layoutId);
  if (!layout || !contract.normalOpen.acceptedLayouts.includes(layout.schemaVersion) || !layout.read || !layout.write ||
      layout.syncEpochOwner !== facts.layout.syncEpochOwner) throw new Error('candidate cannot read and write the observed storage layout');
  if (layout.schemaProfileSha256 !== undefined && layout.schemaProfileSha256 !== facts.layout.schemaFingerprint) {
    throw new Error('observed storage layout does not match the candidate schema profile');
  }
  if (facts.layout.directoryPolicyId !== undefined && !contract.acceptedDirectoryPolicies?.includes(facts.layout.directoryPolicyId)) throw new Error('candidate cannot preserve the observed directory policy');
  if (facts.layout.syncProtocolVersion !== undefined && !layout.syncProtocolVersions.includes(facts.layout.syncProtocolVersion)) throw new Error('candidate cannot preserve observed sync protocol');
  if (facts.layout.syncProtocolVersions !== undefined && (!Array.isArray(facts.layout.syncProtocolVersions) ||
      facts.layout.syncProtocolVersions.some(version => !layout.syncProtocolVersions.includes(version)))) throw new Error('candidate cannot preserve observed sync protocols');
  if (facts.layout.syncLogReceipts === true && layout.syncLogReceipts !== true) throw new Error('candidate cannot preserve sync log receipts');
}
export function collectStorageAdmission(context, collector) {
  if (!context.candidate) throw new Error('candidate has no verified storage capability companion');
  validateStorageContract(context.candidate.contract);
  for (const key of ['hapSha256', 'nativeSha256', 'contractSha256', 'coreBuildId', 'coreInputFingerprint']) requireStorageSha(context.candidate[key], key);
  if (!['inspect', 'install'].includes(context.mode)) throw new Error('invalid storage admission mode');
  const owned = collector(Object.freeze({ ...context }));
  try {
    if (typeof owned?.release !== 'function' || typeof owned?.revalidate !== 'function') throw new Error('controlled storage collector lifecycle is unavailable');
    checkFacts(context, owned.facts);
    const facts = freezeTree(JSON.parse(encode(owned.facts)));
    const session = Object.freeze({ status: context.mode === 'install' ? 'READY' : 'OBSERVED',
      factsSha256: storageSha256(encode(facts)), candidateSha256: context.candidate.hapSha256,
      storageLayout: facts.layout, freshStorage: facts.freshStorage === true,
      migration: facts.requiresMigration === true ? facts.explicitMigration : null,
      ...(owned.recovery ? { recovery: freezeTree(JSON.parse(encode(owned.recovery))) } : {}) });
    sessions.set(session, { context, facts, owned, active: true, revalidated: false });
    return session;
  } catch (error) { owned?.release?.(); throw error; }
}
export function storageAdmissionAllowed(session, { targetKind, installed, artifact }) {
  const value = sessions.get(session);
  return Boolean(value?.active && value.context.mode === 'install' && value.context.targetKind === targetKind &&
    value.context.installedIdentitySha256 === installedStorageIdentity(installed) &&
    value.context.candidate.hapSha256 === artifact.sha256 &&
    value.context.candidate.nativeSha256 === artifact.embeddedCoreNapi?.sha256);
}
export function revalidateStorageAdmission(session) {
  const value = sessions.get(session);
  if (!value?.active || value.context.mode !== 'install' || value.revalidated) throw new Error('storage install session is stale, untrusted or already consumed');
  const current = value.owned.revalidate();
  checkFacts(value.context, current);
  if (encode(current) !== encode(value.facts)) throw new Error('storage facts changed after admission; installation stopped');
  value.revalidated = true;
  return { status: 'PASS', factsSha256: session.factsSha256, candidateSha256: session.candidateSha256 };
}
export function recordInstalledStorageCandidate(session, installed) {
  const value = sessions.get(session);
  if (!value?.active || !value.revalidated) throw new Error('storage install session was not revalidated');
  if (installed?.bundlePresent !== true) throw new Error('installed bundle identity is unavailable');
  // Bundle Manager identity was independently checked by the pipeline. Device
  // sandbox policy can deny raw installed HAP/SO access; these hashes describe
  // the verified bytes handed to install, never a claimed device observation.
  return { status: 'CANDIDATE_BOUND', nativeSha256: value.context.candidate.nativeSha256,
    hapSha256: value.context.candidate.hapSha256, actualNativeIdentity: 'OPEN',
    evidence: 'immutable-candidate-and-successful-install-receipt' };
}
export function releaseStorageAdmission(session) {
  const value = sessions.get(session);
  if (!value?.active) return;
  value.active = false;
  value.owned.release();
}
