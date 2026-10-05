#!/usr/bin/env python3
"""Append R5 published source/artifact binding without modifying frozen records."""
import datetime
import hashlib
import json
from pathlib import Path
import zipfile

OUTPUT = Path(__file__).resolve().parent
DELTA = OUTPUT.parent
BASE = OUTPUT.parents[2] / '2026-10-03-manga-reader-sheets-r4/source-preservation'
RUN_ID = '20261003T123734Z-568ec4e3-52338352'
RUN = Path('/Users/minliny/Documents/Reader/.reader-isolated/manga-ui-20261002/Reader-for-HarmonyOS/.reader-artifacts/manga-sheet-ui-20261003/hap') / RUN_ID
SIGNED_SHA = 'f00ebc4a15240832ee5decf39f660cf30eafcf7454759c85875dd94af4f74719'
CORE_FP = '9e97919470b42d81d87082c2c257984778da5e5e5e55798273b3242c99608c4b'
SO_SHA = '1fabbfa63b996e39da9a3ec01f6b396cf841f0d0b4016303daac56a974c17996'
CERT_SHA = '3a563778e5bf17cd3ead0218e13b4a5030de3f5d7d4e21e0336d8eb37b676dc4'
EXPECTED_CHANGES = {
    'Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryNavigationSurface.ets':
        '00087dbd1fc42a843b93242f4c450d17f7f70dde8bd7e1ea575431aebfce3685',
    'Reader-for-HarmonyOS/tools/test-manga-directory-font-readiness-sdk.mjs':
        'd70ab1686040b7a45408b6b87b951966106c934ec8a417be9287ad6cc9e22f67',
}


def digest_bytes(data):
    return hashlib.sha256(data).hexdigest()


def sha(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1048576), b''):
            h.update(chunk)
    return h.hexdigest()


def frozen_hashes():
    # Existing evidence is immutable. Only this new binding directory may grow.
    result = {}
    for directory in (BASE, DELTA):
        for path in sorted(directory.iterdir()):
            if path.is_file():
                result[str(path)] = sha(path)
    return result


def save_exact(name, data):
    path = OUTPUT / name
    if path.exists():
        if path.read_bytes() != data:
            raise RuntimeError('Binding destination already differs: ' + name)
    else:
        with path.open('xb') as f:
            f.write(data)
    return dict(path=name, bytes=len(data), sha256=digest_bytes(data))


def compact_fp(records):
    h = hashlib.sha256()
    for record in records:
        h.update((json.dumps(record, ensure_ascii=False, separators=(',', ':')) + '\n').encode())
    return h.hexdigest()


def main():
    before = frozen_hashes()
    effective = json.loads((DELTA / 'effective-source-inventory.json').read_text())
    source = {r['path']: r for r in effective['files']}
    delta_manifest = json.loads((DELTA / 'delta-manifest.json').read_text())
    raw_manifest = (RUN / 'manifest.json').read_bytes()
    manifest = json.loads(raw_manifest)
    if manifest['runId'] != RUN_ID or manifest['buildClass'] != 'iteration' or manifest['acceptanceEligible'] is not False:
        raise RuntimeError('Unexpected canonical run identity/classification')
    expected_origin = '/private/tmp/reader-manga-sheet-ui-delivery-20261003-1913'
    for kind, repo in [('harmony', 'Reader-for-HarmonyOS'), ('core', 'Reader-Core-Native')]:
        if manifest['source'][kind]['repo'] != expected_origin + '/' + repo:
            raise RuntimeError('Canonical source is not the frozen independent delivery tree')
    saved = []
    saved.append(save_exact('published-manifest.json', raw_manifest))
    matches = []
    snapshots = [('source-snapshot.json', 'harmony'),
                 ('controller-snapshot.json', 'controller'),
                 ('workspace-contract-snapshot.json', 'workspace')]
    for filename, scope in snapshots:
        data = (RUN / filename).read_bytes()
        snapshot = json.loads(data)
        actual_fp = compact_fp(snapshot['files'])
        expected_header = (manifest['source']['buildInputs'] if scope == 'harmony' else
                           manifest['gates']['controllerInputs'] if scope == 'controller' else
                           manifest['gates']['workspaceContractInputs'])
        if actual_fp != snapshot['fingerprint'] or actual_fp != expected_header['fingerprint']:
            raise RuntimeError('Canonical snapshot fingerprint mismatch: ' + filename)
        if len(snapshot['files']) != snapshot['fileCount'] or snapshot['fileCount'] != expected_header['fileCount']:
            raise RuntimeError('Canonical snapshot member count mismatch')
        for record in snapshot['files']:
            rel = record['path']
            if scope in ('harmony', 'controller'):
                key = 'Reader-for-HarmonyOS/' + rel
            else:
                key = rel if rel.startswith('Reader-Core-Native/') else 'workspace/' + rel
            archived = source.get(key)
            if archived is None or any(record[k] != archived[k] for k in ('type', 'mode', 'bytes', 'sha256')):
                raise RuntimeError('Canonical input cannot be reconstructed from R4+R5: ' + key)
        saved.append(save_exact(filename, data))
        matches.append(dict(scope=scope, snapshot=filename, matchedRecords=snapshot['fileCount'],
                            fingerprint=actual_fp, missingRecords=[], differentRecords=[]))
    for path, expected in EXPECTED_CHANGES.items():
        if source[path]['sha256'] != expected:
            raise RuntimeError('Expected R5 source is absent from effective source inventory')
    host = manifest['source']['vendoredCoreNapi']
    if host['sha256'] != SO_SHA or source['Reader-for-HarmonyOS/' + host['path']]['sha256'] != SO_SHA:
        raise RuntimeError('Canonical Host Native input is not the preserved SO')
    native = json.loads((BASE / 'native-sdk-inventory.json').read_text())
    native_records = {r['path']: r for r in native['files']}
    package_records = {k[len('native-sdk/package/'):]: v for k, v in native_records.items()
                       if k.startswith('native-sdk/package/')}
    artifacts = []
    for item in manifest['artifacts']:
        path = RUN / item['path']
        if path.stat().st_size != item['bytes'] or sha(path) != item['sha256']:
            raise RuntimeError('Published artifact bytes/hash differ from manifest')
        with zipfile.ZipFile(path) as hap:
            member = item['embeddedCoreNapi']['path']
            h = hashlib.sha256()
            size = 0
            with hap.open(member) as stream:
                for chunk in iter(lambda: stream.read(1048576), b''):
                    h.update(chunk)
                    size += len(chunk)
            if h.hexdigest() != item['embeddedCoreNapi']['sha256'] or size != item['embeddedCoreNapi']['bytes']:
                raise RuntimeError('Embedded Native entry differs from published manifest')
        artifacts.append(dict(kind=item['kind'], path=str(path), bytes=item['bytes'], sha256=item['sha256'],
                              signature=item['signature'], embeddedCoreNapi=item['embeddedCoreNapi'],
                              actualArtifactAndEmbeddedBytesVerified=True))
    signed = next(a for a in artifacts if a['kind'] == 'signed')
    if signed['sha256'] != SIGNED_SHA or signed['signature']['certificateSha256'] != CERT_SHA:
        raise RuntimeError('Signed artifact or signing identity differs from supplied canonical publication')
    provenance_checks = []
    for filename in manifest['nativeProvenance']:
        data = (RUN / filename).read_bytes()
        provenance = json.loads(data)
        if provenance['core']['buildInputFingerprint'] != CORE_FP:
            raise RuntimeError('Core input fingerprint differs in canonical provenance')
        snapshot_record = provenance['core']['buildInputSnapshot']
        stored = native_records['native-sdk/core-input-snapshot.json']
        if snapshot_record['sha256'] != stored['sha256'] or snapshot_record['bytes'] != stored['bytes']:
            raise RuntimeError('Canonical Native snapshot differs from preserved package identity')
        identity_record = provenance['core']['buildIdentityArtifact']
        identity = native_records['native-sdk/core-build-identity.json']
        if identity_record['sha256'] != identity['sha256'] or identity_record['bytes'] != identity['bytes']:
            raise RuntimeError('Canonical Native build identity differs')
        package = provenance['napi']['packageManifest']
        stored_manifest = native_records['native-sdk/harmony-package-manifest.sha256']
        if package['sha256'] != stored_manifest['sha256'] or package['bytes'] != stored_manifest['bytes']:
            raise RuntimeError('Canonical SDK package manifest differs')
        if {r['path'] for r in package['entries']} != set(package_records):
            raise RuntimeError('Canonical SDK package members differ')
        for record in package['entries']:
            r = package_records[record['path']]
            if record['sha256'] != r['sha256'] or record['bytes'] != r['bytes']:
                raise RuntimeError('Canonical SDK package bytes differ')
        if provenance['napi']['nativeInput']['sha256'] != SO_SHA or provenance['harmony']['nativeInput']['sha256'] != SO_SHA:
            raise RuntimeError('Canonical Native input differs from the preserved original SO')
        for record in provenance['harmony']['vendor']['entries']:
            path = record['path']
            key = 'Reader-for-HarmonyOS/entry/vendor/core-harmony/' + path
            r = source.get(key)
            if r is None or record['sha256'] != r['sha256'] or record['bytes'] != r['bytes']:
                raise RuntimeError('Canonical vendored SDK cannot be reconstructed: ' + path)
        artifact = next(a for a in artifacts if a['sha256'] == provenance['hap']['sha256'])
        packaging = provenance['harmony']['nativePackaging']
        if packaging['output']['sha256'] != artifact['embeddedCoreNapi']['sha256']:
            raise RuntimeError('Native strip output and embedded artifact differ')
        saved.append(save_exact(filename, data))
        provenance_checks.append(dict(file=filename, coreBuildInputFingerprint=CORE_FP,
                                      nativePackageMembers=len(package_records),
                                      originalNativeSoSha256=SO_SHA,
                                      nativePackaging=packaging, matched=True))
    if frozen_hashes() != before:
        raise RuntimeError('Frozen R4 or R5 delta files changed')
    binding = dict(schemaVersion=1, purpose='Published R5 build/source binding only',
                   recordedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                   runId=RUN_ID, buildClass='iteration', acceptanceEligible=False,
                   canonicalManifest=dict(path=str(RUN / 'manifest.json'),
                                          bytes=len(raw_manifest), sha256=digest_bytes(raw_manifest),
                                          preservedCopy='published-manifest.json'),
                   sourceOrigin={k: manifest['source'][k] for k in ('harmony', 'core')},
                   sourceReconstruction=dict(parentArchiveSha256=delta_manifest['parent']['sha256'],
                                             deltaArchiveSha256=delta_manifest['archive']['sha256'],
                                             effectiveInventorySha256=sha(DELTA / 'effective-source-inventory.json'),
                                             effectiveSourceFingerprint=effective['inventoryFingerprint'],
                                             sourceRecords=len(source), changedSourceSha256=EXPECTED_CHANGES,
                                             canonicalSnapshots=matches, allCanonicalInputsReconstructible=True),
                   native=dict(coreBuildInputFingerprint=CORE_FP, originalHostAndSdkSoSha256=SO_SHA,
                               sdkParentArchiveSha256=native['archive']['sha256'],
                               provenance=provenance_checks),
                   artifacts=artifacts, publishedBuildGates=manifest['gates'],
                   effectiveBuildProfile=manifest['source']['effectiveBuildProfile'],
                   scope=dict(sourceBytesAndPublishedArtifacts=True, buildExecutionPerformedByParent=True,
                              childBuiltOrUsedDevice=False, privateSigningMaterialCopied=False,
                              vmPhysicalInteractionOrUserAcceptanceClaim=False),
                   frozenR4AndR5DeltaFilesUnchanged=True, savedPublicRecords=saved)
    save_exact('binding.json', (json.dumps(binding, ensure_ascii=False, indent=2) + '\n').encode())
    if (RUN / 'manifest.json').read_bytes() != raw_manifest:
        raise RuntimeError('Canonical published manifest changed during binding')
    print(json.dumps(dict(status='PASS', runId=RUN_ID, buildClass='iteration', acceptanceEligible=False,
                          signedArtifactSha256=SIGNED_SHA,
                          canonicalMatchedSourceRecords=sum(r['matchedRecords'] for r in matches),
                          allCanonicalSourceRecordsReconstructible=True,
                          privateSigningMaterialCopied=False, deviceOperation=False)))


if __name__ == '__main__':
    main()
