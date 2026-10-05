#!/usr/bin/env python3
"""Verify preserved bytes without the original delivery tree or any Git checkout."""
import hashlib
import json
from pathlib import Path, PurePosixPath
import tarfile

BASE = Path(__file__).resolve().parent
CORE_FINGERPRINT = '9e97919470b42d81d87082c2c257984778da5e5e5e55798273b3242c99608c4b'
SO_SHA = '1fabbfa63b996e39da9a3ec01f6b396cf841f0d0b4016303daac56a974c17996'
SURFACE_SHA = '0f5e6d2654e8cc228b43b2ab2c9023e728db904193a147ce71da425113a6b897'


def sha_file(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def verify(name):
    inventory = json.loads((BASE / (name + '-inventory.json')).read_text())
    path = BASE / inventory['archive']['path']
    assert path.stat().st_size == inventory['archive']['bytes'], 'archive size mismatch'
    assert sha_file(path) == inventory['archive']['sha256'], 'archive SHA mismatch'
    expected = {r['path']: r for r in inventory['files']}
    assert len(expected) == len(inventory['files']), 'duplicate inventory path'
    seen = set()
    with tarfile.open(path, 'r:gz') as tar:
        for member in tar:
            rel = PurePosixPath(member.name)
            assert not rel.is_absolute() and '..' not in rel.parts, 'unsafe archive path'
            assert member.isfile(), 'non-regular archive member'
            assert member.name in expected and member.name not in seen, 'unexpected/duplicate member'
            record = expected[member.name]
            h = hashlib.sha256()
            size = 0
            with tar.extractfile(member) as f:
                for chunk in iter(lambda: f.read(1024 * 1024), b''):
                    h.update(chunk)
                    size += len(chunk)
            assert size == record['bytes'], 'file size mismatch: ' + member.name
            assert h.hexdigest() == record['sha256'], 'file SHA mismatch: ' + member.name
            assert member.mode == record['mode'], 'file mode mismatch: ' + member.name
            seen.add(member.name)
    assert seen == set(expected), 'missing archive members'
    return inventory, expected


def main():
    results = {}
    for name in ('reader-source', 'approved-design-source', 'native-sdk'):
        inventory, records = verify(name)
        results[name] = (inventory, records)
        print(json.dumps(dict(name=name, files=len(records),
                              bytes=inventory['sourceBytes'],
                              archiveSha256=inventory['archive']['sha256'],
                              allBytesAndModesVerified=True)))
    core = json.loads((BASE / 'core-build-snapshot-before.json').read_text())
    after = json.loads((BASE / 'core-build-snapshot-after.json').read_text())
    assert core == after, 'Core snapshots differ'
    h = hashlib.sha256()
    source = results['reader-source'][1]
    for record in core['files']:
        # Preserve the authoritative JS ordering and exact compact JSON fields.
        h.update((json.dumps(record, ensure_ascii=False, separators=(',', ':')) + '\n').encode())
        archived = source['Reader-Core-Native/' + record['path']]
        assert all(archived[k] == record[k] for k in ('type', 'mode', 'bytes', 'sha256')), 'Core input mismatch'
    assert h.hexdigest() == core['fingerprint'] == CORE_FINGERPRINT, 'Core fingerprint mismatch'
    native = results['native-sdk'][1]
    assert source['Reader-for-HarmonyOS/entry/libs/arm64-v8a/libreader_core_napi.so']['sha256'] == SO_SHA
    assert native['native-sdk/package/libs/arm64-v8a/libreader_core_napi.so']['sha256'] == SO_SHA
    surface = source['Reader-for-HarmonyOS/entry/src/main/ets/features/manga/MangaReadingSurface.ets']
    assert surface['sha256'] == SURFACE_SHA, 'R4 border-order source mismatch'
    # Read preserved package manifest and enforce its exact member set and sizes.
    with tarfile.open(BASE / 'native-sdk.tar.gz', 'r:gz') as tar:
        manifest = tar.extractfile('native-sdk/harmony-package-manifest.sha256').read().decode()
        snapshot = json.loads(tar.extractfile('native-sdk/core-input-snapshot.json').read())
    assert snapshot['fingerprint'] == CORE_FINGERPRINT
    assert snapshot['files'] == core['files'], 'SDK snapshot differs from archived source'
    expected_package = set()
    for line in manifest.splitlines():
        digest, size, rel = line.split(None, 2)
        path = 'native-sdk/package/' + rel.strip().lstrip('*')
        expected_package.add(path)
        assert native[path]['sha256'] == digest and native[path]['bytes'] == int(size)
    assert expected_package == {p for p in native if p.startswith('native-sdk/package/')}
    print(json.dumps(dict(result='PASS', canonicalCoreInputs=len(core['files']),
                          coreFingerprint=CORE_FINGERPRINT, hostAndSdkSoSha256=SO_SHA,
                          r4SurfaceSha256=SURFACE_SHA, originalSourceRequired=False)))


if __name__ == '__main__':
    main()
