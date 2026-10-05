#!/usr/bin/env python3
"""Verify R7 public canonical binding without the original delivery tree."""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parent
CORE_FP = '9e97919470b42d81d87082c2c257984778da5e5e5e55798273b3242c99608c4b'
SO_SHA = '1fabbfa63b996e39da9a3ec01f6b396cf841f0d0b4016303daac56a974c17996'
CERT_SHA = '3a563778e5bf17cd3ead0218e13b4a5030de3f5d7d4e21e0336d8eb37b676dc4'


def sha(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1048576), b''):
            h.update(chunk)
    return h.hexdigest()


def fingerprint(files):
    h = hashlib.sha256()
    for row in files:
        h.update((json.dumps(row, ensure_ascii=False, separators=(',', ':')) + '\n').encode())
    return h.hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--require-artifacts', action='store_true')
    args = parser.parse_args()
    binding = json.loads((ROOT / 'binding.json').read_bytes())
    for row in binding['savedPublicRecords']:
        path = ROOT / row['path']
        assert path.stat().st_size == row['bytes'] and sha(path) == row['sha256']
    manifest_path = ROOT / binding['canonicalManifest']['preservedCopy']
    assert manifest_path.stat().st_size == binding['canonicalManifest']['bytes']
    assert sha(manifest_path) == binding['canonicalManifest']['sha256']
    manifest = json.loads(manifest_path.read_bytes())
    assert manifest['runId'] == binding['runId']
    assert manifest['buildClass'] == binding['buildClass'] == 'iteration'
    assert manifest['acceptanceEligible'] is binding['acceptanceEligible'] is False
    inventory_path = ROOT.parent / 'effective-source-inventory.json'
    assert sha(inventory_path) == binding['sourceReconstruction']['effectiveInventorySha256']
    inventory = json.loads(inventory_path.read_bytes())
    assert fingerprint(inventory['files']) == inventory['inventoryFingerprint'] == binding['sourceReconstruction']['effectiveSourceFingerprint']
    files = {row['path']: row for row in inventory['files']}
    assert len(files) == len(inventory['files']) == binding['sourceReconstruction']['sourceRecords']
    matched = 0
    controller_paths = set()
    for check in binding['sourceReconstruction']['canonicalSnapshots']:
        snapshot = json.loads((ROOT / check['snapshot']).read_bytes())
        assert fingerprint(snapshot['files']) == snapshot['fingerprint'] == check['fingerprint']
        assert snapshot['fileCount'] == len(snapshot['files']) == check['matchedRecords']
        header = (manifest['source']['buildInputs'] if check['scope'] == 'harmony' else
                  manifest['gates']['controllerInputs'] if check['scope'] == 'controller' else
                  manifest['gates']['workspaceContractInputs'])
        assert header['fileCount'] == snapshot['fileCount'] and header['fingerprint'] == snapshot['fingerprint']
        for row in snapshot['files']:
            rel = row['path']
            if check['scope'] == 'workspace':
                key = rel if rel.startswith('Reader-Core-Native/') else 'workspace/' + rel
            else:
                key = 'Reader-for-HarmonyOS/' + rel
            assert all(files[key][field] == row[field] for field in ('type', 'mode', 'bytes', 'sha256'))
            if check['scope'] == 'controller':
                controller_paths.add(rel)
        matched += snapshot['fileCount']
    assert set(binding['sourceReconstruction']['canonicalCounterfactualFixtures']) <= controller_paths
    for rel, digest in binding['sourceReconstruction']['changedSourceSha256'].items():
        assert files[rel]['sha256'] == digest
    assert manifest['source']['vendoredCoreNapi']['sha256'] == binding['native']['originalHostAndSdkSoSha256'] == SO_SHA
    assert binding['native']['coreBuildInputFingerprint'] == CORE_FP
    assert files['Reader-for-HarmonyOS/' + manifest['source']['vendoredCoreNapi']['path']]['sha256'] == SO_SHA
    for check in binding['native']['provenance']:
        provenance = json.loads((ROOT / check['file']).read_bytes())
        assert provenance['core']['buildInputFingerprint'] == CORE_FP
        assert provenance['napi']['nativeInput']['sha256'] == provenance['harmony']['nativeInput']['sha256'] == SO_SHA
        assert provenance['harmony']['nativePackaging'] == check['nativePackaging']
        artifact = next(item for item in binding['artifacts'] if item['sha256'] == provenance['hap']['sha256'])
        assert provenance['harmony']['nativePackaging']['output']['sha256'] == artifact['embeddedCoreNapi']['sha256']
    verified = 0
    for row in binding['artifacts']:
        path = Path(row['path'])
        if path.is_file():
            assert path.stat().st_size == row['bytes'] and sha(path) == row['sha256']
            with zipfile.ZipFile(path) as hap:
                h = hashlib.sha256()
                size = 0
                with hap.open(row['embeddedCoreNapi']['path']) as stream:
                    for chunk in iter(lambda: stream.read(1048576), b''):
                        h.update(chunk)
                        size += len(chunk)
                assert size == row['embeddedCoreNapi']['bytes'] and h.hexdigest() == row['embeddedCoreNapi']['sha256']
            verified += 1
        elif args.require_artifacts:
            raise RuntimeError('Required published artifact no longer exists: ' + str(path))
    signed = next(row for row in binding['artifacts'] if row['kind'] == 'signed')
    assert signed['signature']['certificateSha256'].lower() == CERT_SHA
    assert signed['sha256'] == next(row for row in manifest['artifacts'] if row['kind'] == 'signed')['sha256']
    print(json.dumps(dict(status='PASS', runId=binding['runId'], buildClass='iteration', acceptanceEligible=False,
                          canonicalSourceRecordsMatched=matched, counterfactualFixtureInputsBound=True,
                          artifactAndEmbeddedNativeFilesVerified=verified, originalTemporarySourceRequired=False,
                          vmPhysicalInteractionOrUserAcceptanceClaim=False)))


if __name__ == '__main__':
    main()
