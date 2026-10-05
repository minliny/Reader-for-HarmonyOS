#!/usr/bin/env python3
"""Verify R4 + R5 + R6 source bytes and modes without delivery source trees."""
import hashlib
import json
from pathlib import Path, PurePosixPath
import tarfile

ROOT = Path(__file__).resolve().parent
EVIDENCE = ROOT.parent.parent
R4 = EVIDENCE / '2026-10-03-manga-reader-sheets-r4/source-preservation'
R5 = EVIDENCE / '2026-10-03-manga-reader-sheets-r5/source-delta'
CORE_FP = '9e97919470b42d81d87082c2c257984778da5e5e5e55798273b3242c99608c4b'
R4_SHA = '765627819aa7433c1fa9c575240bee471ea7a3174217af8272e338fdad275132'
R5_SHA = 'a1bba804791fc0873bb924d6696755fd91132629c645c5331391d112c6a04137'
FREEZE_SHA = '87946896c17aad3edcfee490d13d321064ca74222acefcd9e6cbf77375d41ec9'


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


def verify_tar(path, expected):
    seen = set()
    with tarfile.open(path, 'r:gz') as tar:
        for member in tar:
            p = PurePosixPath(member.name)
            assert not p.is_absolute() and '..' not in p.parts and member.isfile()
            assert member.name in expected and member.name not in seen
            row = expected[member.name]
            h = hashlib.sha256()
            size = 0
            with tar.extractfile(member) as stream:
                for chunk in iter(lambda: stream.read(1048576), b''):
                    h.update(chunk)
                    size += len(chunk)
            assert member.mode == row['mode'] and size == row['bytes'] and h.hexdigest() == row['sha256']
            seen.add(member.name)
    assert seen == set(expected)


def main():
    manifest = json.loads((ROOT / 'delta-manifest.json').read_bytes())
    assert sha(R4 / 'reader-source.tar.gz') == manifest['parent']['r4ArchiveSha256'] == R4_SHA
    assert sha(R4 / 'reader-source-inventory.json') == manifest['parent']['r4InventorySha256']
    assert sha(R5 / 'r5-source-delta.tar.gz') == manifest['parent']['r5ArchiveSha256'] == R5_SHA
    assert sha(R5 / 'delta-manifest.json') == manifest['parent']['r5ManifestSha256']
    assert sha(R5 / 'effective-source-inventory.json') == manifest['parent']['effectiveInventorySha256']
    r4_inventory = json.loads((R4 / 'reader-source-inventory.json').read_bytes())
    effective = {row['path']: row for row in r4_inventory['files']}
    assert len(effective) == len(r4_inventory['files']) == 7111
    verify_tar(R4 / 'reader-source.tar.gz', effective)
    r5_manifest = json.loads((R5 / 'delta-manifest.json').read_bytes())
    r5_after = {}
    for operation in r5_manifest['operations']:
        rel = operation['path']
        assert operation['operation'] == 'replace' and operation['before'] == effective[rel]
        r5_after[rel] = operation['after']
        effective[rel] = operation['after']
    assert len(r5_after) == 2
    verify_tar(R5 / 'r5-source-delta.tar.gz', r5_after)
    parent_inventory = json.loads((R5 / 'effective-source-inventory.json').read_bytes())
    assert parent_inventory['files'] == [effective[row['path']] for row in r4_inventory['files']]
    assert fingerprint(parent_inventory['files']) == parent_inventory['inventoryFingerprint']
    assert sha(ROOT / 'freeze-inputs.json') == manifest['freeze']['sha256'] == FREEZE_SHA
    freeze = json.loads((ROOT / 'freeze-inputs.json').read_bytes())
    expected = {'Reader-for-HarmonyOS/' + row['path']: row['sha256'] for row in freeze['allowlist'] + freeze['sources']}
    assert len(freeze['allowlist']) == 10 and len(freeze['sources']) == 3
    after = {}
    additions = []
    replacements = 0
    for operation in manifest['operations']:
        rel = operation['path']
        assert rel in expected and rel not in after and operation['after']['path'] == rel
        assert operation['after']['sha256'] == expected[rel]
        if operation['operation'] == 'replace':
            assert operation['before'] == effective[rel]
            replacements += 1
        else:
            assert operation['operation'] == 'add' and operation['before'] is None and rel not in effective
            additions.append(rel)
        after[rel] = operation['after']
        effective[rel] = operation['after']
    assert len(after) == 12 and replacements == 10 and len(additions) == 2
    archive = ROOT / manifest['archive']['path']
    assert archive.stat().st_size == manifest['archive']['bytes'] and sha(archive) == manifest['archive']['sha256']
    verify_tar(archive, after)
    for rel, digest in expected.items():
        assert effective[rel]['sha256'] == digest
    inventory_path = ROOT / manifest['effectiveInventory']['path']
    assert sha(inventory_path) == manifest['effectiveInventory']['sha256']
    inventory = json.loads(inventory_path.read_bytes())
    expected_files = [effective[row['path']] for row in parent_inventory['files']] + [effective[rel] for rel in sorted(additions)]
    assert inventory['files'] == expected_files and inventory['sourceFileCount'] == len(effective) == 7113
    assert fingerprint(inventory['files']) == inventory['inventoryFingerprint'] == manifest['effectiveInventory']['fingerprint']
    assert inventory['sourceBytes'] == sum(row['bytes'] for row in expected_files)
    core = json.loads((ROOT / 'r6-core-build-snapshot.json').read_bytes())
    assert fingerprint(core['files']) == core['fingerprint'] == manifest['coreBuildInputFingerprint'] == CORE_FP
    for row in core['files']:
        source = effective['Reader-Core-Native/' + row['path']]
        assert all(source[key] == row[key] for key in ('type', 'mode', 'bytes', 'sha256'))
    assert sha(R4 / 'native-sdk.tar.gz') == manifest['nativeParent']['sha256']
    assert effective['Reader-for-HarmonyOS/entry/libs/arm64-v8a/libreader_core_napi.so']['sha256'] == manifest['nativeParent']['hostSoSha256']
    print(json.dumps(dict(status='PASS', sourceFiles=7113, deltaFiles=12, replaceFiles=10, addFiles=2,
                          fullParentChainAndDeltaBytesVerified=True, parentsUnchanged=True,
                          effectiveSourceFingerprint=inventory['inventoryFingerprint'], coreBuildInputFingerprint=CORE_FP,
                          originalDeliveryOrPersistentSourceRequired=False, canonicalRunOrDeviceAcceptanceClaim=False)))


if __name__ == '__main__':
    main()
