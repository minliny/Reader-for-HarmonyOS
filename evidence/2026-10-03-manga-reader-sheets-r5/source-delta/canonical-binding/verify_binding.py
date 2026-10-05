#!/usr/bin/env python3
"""Verify appended public R5 binding without the original temporary source tree."""
import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def sha(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1048576), b''):
            h.update(chunk)
    return h.hexdigest()


def fingerprint(files):
    h = hashlib.sha256()
    for record in files:
        h.update((json.dumps(record, ensure_ascii=False, separators=(',', ':')) + '\n').encode())
    return h.hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--require-artifacts', action='store_true')
    args = parser.parse_args()
    binding = json.loads((ROOT / 'binding.json').read_text())
    for record in binding['savedPublicRecords']:
        p = ROOT / record['path']
        assert p.stat().st_size == record['bytes'] and sha(p) == record['sha256']
    manifest_path = ROOT / binding['canonicalManifest']['preservedCopy']
    assert sha(manifest_path) == binding['canonicalManifest']['sha256']
    manifest = json.loads(manifest_path.read_text())
    assert manifest['runId'] == binding['runId']
    assert manifest['buildClass'] == binding['buildClass'] == 'iteration'
    assert manifest['acceptanceEligible'] is binding['acceptanceEligible'] is False
    effective_path = ROOT.parent / 'effective-source-inventory.json'
    assert sha(effective_path) == binding['sourceReconstruction']['effectiveInventorySha256']
    effective = json.loads(effective_path.read_text())
    assert fingerprint(effective['files']) == binding['sourceReconstruction']['effectiveSourceFingerprint']
    files = {r['path']: r for r in effective['files']}
    matched = 0
    for check in binding['sourceReconstruction']['canonicalSnapshots']:
        snapshot = json.loads((ROOT / check['snapshot']).read_text())
        assert fingerprint(snapshot['files']) == snapshot['fingerprint'] == check['fingerprint']
        assert snapshot['fileCount'] == len(snapshot['files']) == check['matchedRecords']
        for record in snapshot['files']:
            path = record['path']
            if check['scope'] == 'workspace':
                path = path if path.startswith('Reader-Core-Native/') else 'workspace/' + path
            else:
                path = 'Reader-for-HarmonyOS/' + path
            assert all(files[path][k] == record[k] for k in ('type', 'mode', 'bytes', 'sha256'))
        matched += len(snapshot['files'])
    for path, digest in binding['sourceReconstruction']['changedSourceSha256'].items():
        assert files[path]['sha256'] == digest
    assert manifest['source']['vendoredCoreNapi']['sha256'] == binding['native']['originalHostAndSdkSoSha256']
    assert files['Reader-for-HarmonyOS/' + manifest['source']['vendoredCoreNapi']['path']]['sha256'] == binding['native']['originalHostAndSdkSoSha256']
    for check in binding['native']['provenance']:
        p = json.loads((ROOT / check['file']).read_text())
        assert p['core']['buildInputFingerprint'] == binding['native']['coreBuildInputFingerprint']
        assert p['napi']['nativeInput']['sha256'] == binding['native']['originalHostAndSdkSoSha256']
        assert p['harmony']['nativeInput']['sha256'] == binding['native']['originalHostAndSdkSoSha256']
        assert p['harmony']['nativePackaging'] == check['nativePackaging']
    artifact_count = 0
    for record in binding['artifacts']:
        path = Path(record['path'])
        if path.is_file():
            assert path.stat().st_size == record['bytes'] and sha(path) == record['sha256']
            artifact_count += 1
        elif args.require_artifacts:
            raise RuntimeError('Required published artifact no longer exists: ' + str(path))
    print(json.dumps(dict(status='PASS', runId=binding['runId'], buildClass='iteration',
                          acceptanceEligible=False, canonicalSourceRecordsMatched=matched,
                          artifactFilesVerified=artifact_count, originalTemporarySourceRequired=False,
                          vmPhysicalInteractionOrUserAcceptanceClaim=False)))


if __name__ == '__main__':
    main()
