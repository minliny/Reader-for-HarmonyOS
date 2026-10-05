#!/usr/bin/env python3
"""Verify R4 + the two-file R5 delta without the original delivery source."""
import hashlib
import json
from pathlib import Path, PurePosixPath
import tarfile

OUTPUT = Path(__file__).resolve().parent
BASE = OUTPUT.parent.parent / '2026-10-03-manga-reader-sheets-r4/source-preservation'
PARENT_SHA = '765627819aa7433c1fa9c575240bee471ea7a3174217af8272e338fdad275132'
CORE_FINGERPRINT = '9e97919470b42d81d87082c2c257984778da5e5e5e55798273b3242c99608c4b'
EXPECTED = {
    'Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryNavigationSurface.ets':
        '00087dbd1fc42a843b93242f4c450d17f7f70dde8bd7e1ea575431aebfce3685',
    'Reader-for-HarmonyOS/tools/test-manga-directory-font-readiness-sdk.mjs':
        'd70ab1686040b7a45408b6b87b951966106c934ec8a417be9287ad6cc9e22f67',
}


def sha(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1048576), b''):
            h.update(chunk)
    return h.hexdigest()


def verify_tar(path, expected):
    seen = set()
    with tarfile.open(path, 'r:gz') as tar:
        for member in tar:
            p = PurePosixPath(member.name)
            assert not p.is_absolute() and '..' not in p.parts and member.isfile()
            assert member.name in expected and member.name not in seen
            r = expected[member.name]
            h = hashlib.sha256()
            size = 0
            with tar.extractfile(member) as f:
                for chunk in iter(lambda: f.read(1048576), b''):
                    h.update(chunk)
                    size += len(chunk)
            assert size == r['bytes'] and h.hexdigest() == r['sha256'] and member.mode == r['mode']
            seen.add(member.name)
    assert seen == set(expected)


def main():
    manifest = json.loads((OUTPUT / 'delta-manifest.json').read_text())
    parent_path = BASE / 'reader-source.tar.gz'
    parent_inventory_path = BASE / 'reader-source-inventory.json'
    assert sha(parent_path) == manifest['parent']['sha256'] == PARENT_SHA
    assert sha(parent_inventory_path) == manifest['parent']['inventorySha256']
    parent_inventory = json.loads(parent_inventory_path.read_text())
    parent = {r['path']: r for r in parent_inventory['files']}
    assert len(parent) == len(parent_inventory['files'])
    verify_tar(parent_path, parent)
    operations = manifest['operations']
    assert len(operations) == 2 and {o['path'] for o in operations} == set(EXPECTED)
    after = {}
    effective = dict(parent)
    for operation in operations:
        rel = operation['path']
        assert operation['operation'] == 'replace' and operation['before'] == parent[rel]
        assert operation['after']['path'] == rel and operation['after']['sha256'] == EXPECTED[rel]
        after[rel] = operation['after']
        effective[rel] = operation['after']
    delta_path = OUTPUT / manifest['archive']['path']
    assert delta_path.stat().st_size == manifest['archive']['bytes']
    assert sha(delta_path) == manifest['archive']['sha256']
    verify_tar(delta_path, after)
    effective_path = OUTPUT / manifest['effectiveInventory']['path']
    assert sha(effective_path) == manifest['effectiveInventory']['sha256']
    effective_inventory = json.loads(effective_path.read_text())
    assert effective_inventory['files'] == [effective[r['path']] for r in parent_inventory['files']]
    h = hashlib.sha256()
    for r in effective_inventory['files']:
        h.update((json.dumps(r, ensure_ascii=False, separators=(',', ':')) + '\n').encode())
    assert h.hexdigest() == manifest['effectiveInventory']['fingerprint'] == effective_inventory['inventoryFingerprint']
    core = json.loads((OUTPUT / 'r5-core-build-snapshot.json').read_text())
    h = hashlib.sha256()
    for r in core['files']:
        h.update((json.dumps(r, ensure_ascii=False, separators=(',', ':')) + '\n').encode())
        observed = effective['Reader-Core-Native/' + r['path']]
        assert all(observed[k] == r[k] for k in ('type', 'mode', 'bytes', 'sha256'))
    assert h.hexdigest() == core['fingerprint'] == manifest['coreBuildInputFingerprint'] == CORE_FINGERPRINT
    assert sha(BASE / 'native-sdk.tar.gz') == manifest['nativeParent']['sha256']
    assert effective['Reader-for-HarmonyOS/entry/libs/arm64-v8a/libreader_core_napi.so']['sha256'] == manifest['nativeParent']['hostSoSha256']
    print(json.dumps(dict(status='PASS', sourceFiles=len(effective), deltaFiles=2,
                          fullParentAndDeltaBytesVerified=True, parentUnchanged=True,
                          effectiveSourceFingerprint=effective_inventory['inventoryFingerprint'],
                          coreBuildInputFingerprint=core['fingerprint'],
                          originalDeliverySourceRequired=False,
                          canonicalRunOrDeviceAcceptanceClaim=False)))


if __name__ == '__main__':
    main()
