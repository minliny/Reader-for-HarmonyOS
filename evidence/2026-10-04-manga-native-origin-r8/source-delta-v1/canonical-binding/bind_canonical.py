#!/usr/bin/env python3
"""Append public R8 canonical binding; no build, source or device mutation."""
import argparse
import datetime
import hashlib
import json
from pathlib import Path
import zipfile

OUTPUT = Path(__file__).resolve().parent
DELTA = OUTPUT.parent
EVIDENCE = OUTPUT.parents[2]
R4 = EVIDENCE / '2026-10-03-manga-reader-sheets-r4/source-preservation'
R5 = EVIDENCE / '2026-10-03-manga-reader-sheets-r5/source-delta'
R6 = EVIDENCE / '2026-10-03-manga-reader-system-bars-r6/source-delta'
R7 = EVIDENCE / '2026-10-03-manga-reader-stable-viewport-r7/source-delta'
ORIGIN = '/private/tmp/reader-manga-sheet-ui-delivery-20261003-1913'
CORE_FP = '9e97919470b42d81d87082c2c257984778da5e5e5e55798273b3242c99608c4b'
SO_SHA = '1fabbfa63b996e39da9a3ec01f6b396cf841f0d0b4016303daac56a974c17996'
CERT_SHA = '3a563778e5bf17cd3ead0218e13b4a5030de3f5d7d4e21e0336d8eb37b676dc4'


def sha(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1048576), b''):
            h.update(chunk)
    return h.hexdigest()


def compact_fp(files):
    h = hashlib.sha256()
    for row in files:
        h.update((json.dumps(row, ensure_ascii=False, separators=(',', ':')) + '\n').encode())
    return h.hexdigest()


def frozen_hashes():
    result = {}
    for directory in (R4, R5, R6, R7):
        for path in sorted(directory.rglob('*')):
            if path.is_file() and '__pycache__' not in path.parts:
                result[str(path)] = sha(path)
    for path in sorted(DELTA.iterdir()):
        if path.is_file():
            result[str(path)] = sha(path)
    return result


def save_exact(name, data):
    path = OUTPUT / name
    if path.exists():
        assert path.read_bytes() == data, ('Binding destination differs', name)
    else:
        with path.open('xb') as stream:
            stream.write(data)
    return dict(path=name, bytes=len(data), sha256=hashlib.sha256(data).hexdigest())


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--manifest', type=Path, required=True)
    parser.add_argument('--expected-signed-sha256', required=True)
    args = parser.parse_args()
    manifest_path = args.manifest.resolve()
    run = manifest_path.parent
    before = frozen_hashes()
    inventory = json.loads((DELTA / 'effective-source-inventory.json').read_bytes())
    source = {row['path']: row for row in inventory['files']}
    delta = json.loads((DELTA / 'delta-manifest.json').read_bytes())
    expected = {operation['path']: operation['after']['sha256'] for operation in delta['operations']}
    raw_manifest = manifest_path.read_bytes()
    manifest = json.loads(raw_manifest)
    assert manifest['buildClass'] == 'iteration' and manifest['acceptanceEligible'] is False
    assert run.name == manifest['runId']
    for kind, repo in [('harmony', 'Reader-for-HarmonyOS'), ('core', 'Reader-Core-Native')]:
        assert manifest['source'][kind]['repo'] == ORIGIN + '/' + repo
    saved = [save_exact('published-manifest.json', raw_manifest)]
    snapshots = []
    for filename, scope in [('source-snapshot.json', 'harmony'), ('controller-snapshot.json', 'controller'),
                            ('workspace-contract-snapshot.json', 'workspace')]:
        data = (run / filename).read_bytes()
        snapshot = json.loads(data)
        header = (manifest['source']['buildInputs'] if scope == 'harmony' else
                  manifest['gates']['controllerInputs'] if scope == 'controller' else
                  manifest['gates']['workspaceContractInputs'])
        assert compact_fp(snapshot['files']) == snapshot['fingerprint'] == header['fingerprint']
        assert snapshot['fileCount'] == len(snapshot['files']) == header['fileCount']
        for row in snapshot['files']:
            rel = row['path']
            key = (rel if rel.startswith('Reader-Core-Native/') else 'workspace/' + rel) if scope == 'workspace' else 'Reader-for-HarmonyOS/' + rel
            assert key in source and all(source[key][field] == row[field] for field in ('type', 'mode', 'bytes', 'sha256')), ('Canonical input differs', key)
        saved.append(save_exact(filename, data))
        snapshots.append(dict(scope=scope, snapshot=filename, fingerprint=snapshot['fingerprint'],
                              matchedRecords=snapshot['fileCount'], missingRecords=[], differentRecords=[]))
    for rel, digest in expected.items():
        assert source[rel]['sha256'] == digest
    fixtures = ['tools/fixtures/manga-system-bars-r5/MangaReadingSurface.ets',
                'tools/fixtures/manga-system-bars-r5/ReaderShell.ets',
                'tools/fixtures/manga-viewport-r6/Index.ets',
                'tools/fixtures/manga-viewport-r6/MangaReadingSurface.ets']
    fixtures += sorted(rel[len('Reader-for-HarmonyOS/'):] for rel in expected
                       if rel.startswith('Reader-for-HarmonyOS/tools/fixtures/') and
                       rel[len('Reader-for-HarmonyOS/'):] not in fixtures)
    controller = json.loads((run / 'controller-snapshot.json').read_bytes())
    controller_paths = {row['path'] for row in controller['files']}
    assert set(fixtures) <= controller_paths, 'Counterfactual fixtures missing from canonical controller closure'
    native_input = manifest['source']['vendoredCoreNapi']
    assert native_input['sha256'] == source['Reader-for-HarmonyOS/' + native_input['path']]['sha256'] == SO_SHA
    native = json.loads((R4 / 'native-sdk-inventory.json').read_bytes())
    native_records = {row['path']: row for row in native['files']}
    package = {rel[len('native-sdk/package/'):]: row for rel, row in native_records.items() if rel.startswith('native-sdk/package/')}
    artifacts = []
    for item in manifest['artifacts']:
        path = run / item['path']
        assert path.stat().st_size == item['bytes'] and sha(path) == item['sha256']
        with zipfile.ZipFile(path) as hap:
            h = hashlib.sha256()
            size = 0
            with hap.open(item['embeddedCoreNapi']['path']) as stream:
                for chunk in iter(lambda: stream.read(1048576), b''):
                    h.update(chunk)
                    size += len(chunk)
            assert size == item['embeddedCoreNapi']['bytes'] and h.hexdigest() == item['embeddedCoreNapi']['sha256']
        artifacts.append(dict(kind=item['kind'], path=str(path), bytes=item['bytes'], sha256=item['sha256'],
                              signature=item['signature'], embeddedCoreNapi=item['embeddedCoreNapi'],
                              actualArtifactAndEmbeddedBytesVerified=True))
    signed = next(item for item in artifacts if item['kind'] == 'signed')
    assert signed['sha256'] == args.expected_signed_sha256
    assert signed['signature']['certificateSha256'].lower() == CERT_SHA
    provenance_checks = []
    for filename in manifest['nativeProvenance']:
        data = (run / filename).read_bytes()
        provenance = json.loads(data)
        assert provenance['core']['buildInputFingerprint'] == CORE_FP
        for key, preserved in [('buildInputSnapshot', 'native-sdk/core-input-snapshot.json'),
                               ('buildIdentityArtifact', 'native-sdk/core-build-identity.json')]:
            row = provenance['core'][key]
            assert all(row[field] == native_records[preserved][field] for field in ('bytes', 'sha256'))
        package_manifest = provenance['napi']['packageManifest']
        assert all(package_manifest[field] == native_records['native-sdk/harmony-package-manifest.sha256'][field] for field in ('bytes', 'sha256'))
        assert {row['path'] for row in package_manifest['entries']} == set(package)
        for row in package_manifest['entries']:
            assert all(row[field] == package[row['path']][field] for field in ('bytes', 'sha256'))
        assert provenance['napi']['nativeInput']['sha256'] == provenance['harmony']['nativeInput']['sha256'] == SO_SHA
        for row in provenance['harmony']['vendor']['entries']:
            archived = source['Reader-for-HarmonyOS/entry/vendor/core-harmony/' + row['path']]
            assert all(row[field] == archived[field] for field in ('bytes', 'sha256'))
        artifact = next(item for item in artifacts if item['sha256'] == provenance['hap']['sha256'])
        packaging = provenance['harmony']['nativePackaging']
        assert packaging['output']['sha256'] == artifact['embeddedCoreNapi']['sha256']
        saved.append(save_exact(filename, data))
        provenance_checks.append(dict(file=filename, coreBuildInputFingerprint=CORE_FP, nativePackageMembers=len(package),
                                      originalNativeSoSha256=SO_SHA, nativePackaging=packaging, matched=True))
    assert frozen_hashes() == before, 'Frozen R4/R5/R6/R7/R8 source evidence changed'
    binding = dict(schemaVersion=1, purpose='Published R8 build/source binding only',
                   recordedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(), runId=manifest['runId'],
                   buildClass='iteration', acceptanceEligible=False,
                   canonicalManifest=dict(path=str(manifest_path), bytes=len(raw_manifest), sha256=hashlib.sha256(raw_manifest).hexdigest(),
                                          preservedCopy='published-manifest.json'),
                   sourceOrigin={key: manifest['source'][key] for key in ('harmony', 'core')},
                   sourceReconstruction=dict(parentChain=delta['parent'], deltaArchiveSha256=delta['archive']['sha256'],
                                             effectiveInventorySha256=sha(DELTA / 'effective-source-inventory.json'),
                                             effectiveSourceFingerprint=inventory['inventoryFingerprint'], sourceRecords=len(source),
                                             changedSourceSha256=expected, canonicalSnapshots=snapshots,
                                             canonicalCounterfactualFixtures=fixtures, allCanonicalInputsReconstructible=True),
                   native=dict(coreBuildInputFingerprint=CORE_FP, originalHostAndSdkSoSha256=SO_SHA,
                               sdkParentArchiveSha256=native['archive']['sha256'], provenance=provenance_checks),
                   artifacts=artifacts, publishedBuildGates=manifest['gates'], effectiveBuildProfile=manifest['source']['effectiveBuildProfile'],
                   scope=dict(sourceBytesAndPublishedArtifacts=True, buildExecutionPerformedByParent=True,
                              childBuiltOrUsedDevice=False, privateSigningMaterialCopied=False,
                              vmPhysicalInteractionOrUserAcceptanceClaim=False),
                   frozenR4R5R6R7AndR8SourceDeltaUnchanged=True, savedPublicRecords=saved)
    save_exact('binding.json', (json.dumps(binding, ensure_ascii=False, indent=2) + '\n').encode())
    assert manifest_path.read_bytes() == raw_manifest
    print(json.dumps(dict(status='PASS', runId=manifest['runId'], buildClass='iteration', acceptanceEligible=False,
                          signedArtifactSha256=signed['sha256'], canonicalMatchedSourceRecords=sum(item['matchedRecords'] for item in snapshots),
                          canonicalCounterfactualFixturesBound=True, allCanonicalSourceRecordsReconstructible=True,
                          privateSigningMaterialCopied=False, deviceOperation=False)))


if __name__ == '__main__':
    main()
