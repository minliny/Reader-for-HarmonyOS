#!/usr/bin/env python3
"""Preserve an explicitly frozen R6 delta over exact R4 + R5 archives."""
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import tarfile
import tempfile

OUTPUT = Path(__file__).resolve().parent
EVIDENCE = OUTPUT.parent.parent
R4_ROOT = EVIDENCE / '2026-10-03-manga-reader-sheets-r4/source-preservation'
R5_ROOT = EVIDENCE / '2026-10-03-manga-reader-sheets-r5/source-delta'
DELIVERY = Path('/private/tmp/reader-manga-sheet-ui-delivery-20261003-1913')
PERSISTENT = Path('/Users/minliny/Documents/Reader/.reader-isolated/manga-ui-20261002')
CORE_FP = '9e97919470b42d81d87082c2c257984778da5e5e5e55798273b3242c99608c4b'
PARENT_SHA = '765627819aa7433c1fa9c575240bee471ea7a3174217af8272e338fdad275132'
R5_SHA = 'a1bba804791fc0873bb924d6696755fd91132629c645c5331391d112c6a04137'
R5_INVENTORY_SHA = 'b12d9258e697fbce0c7c198549cfaf1178f7114946eaf5e72d9171ac2159f1fa'

# Reuse the frozen archive/source safety helpers without creating a pycache in
# the immutable R4 evidence directory.
R4 = {'__name__': 'frozen_r4_helpers', '__file__': str(R4_ROOT / 'preserve_sources.py')}
exec(compile((R4_ROOT / 'preserve_sources.py').read_bytes(), str(R4_ROOT / 'preserve_sources.py'), 'exec'), R4)


def sha(path):
    return R4['sha_file'](path)


def record(path, rel):
    return R4['source_record'](path, rel)


def write_json(name, value):
    path = OUTPUT / name
    data = (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode()
    with path.open('xb') as f:
        f.write(data)


def fingerprint(files):
    h = hashlib.sha256()
    for row in files:
        h.update((json.dumps(row, ensure_ascii=False, separators=(',', ':')) + '\n').encode())
    return h.hexdigest()


def candidate(rel):
    return DELIVERY / (rel[len('workspace/'):] if rel.startswith('workspace/') else rel)


def frozen_parent_hashes():
    result = {}
    for root in (R4_ROOT, R5_ROOT):
        for path in sorted(root.rglob('*')):
            if path.is_file() and '__pycache__' not in path.parts:
                result[str(path)] = sha(path)
    return result


def extract_exact(archive, directory, expected):
    seen = set()
    with tarfile.open(archive, 'r:gz') as tar:
        for member in tar:
            path = PurePosixPath(member.name)
            assert not path.is_absolute() and '..' not in path.parts and member.isfile()
            assert member.name in expected and member.name not in seen
            destination = directory / member.name
            destination.parent.mkdir(parents=True, exist_ok=True)
            with tar.extractfile(member) as source, destination.open('wb') as target:
                shutil.copyfileobj(source, target, 1048576)
            os.chmod(destination, member.mode)
            assert record(destination, member.name) == expected[member.name]
            seen.add(member.name)
    assert seen == set(expected)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--freeze-sha256', required=True)
    args = parser.parse_args()
    freeze_path = OUTPUT / 'freeze-inputs.json'
    assert sha(freeze_path) == args.freeze_sha256
    freeze = json.loads(freeze_path.read_bytes())
    expected = {'Reader-for-HarmonyOS/' + row['path']: row['sha256']
                for row in freeze['allowlist'] + freeze['sources']}
    assert len(expected) == len(freeze['allowlist']) + len(freeze['sources'])
    before = frozen_parent_hashes()
    assert sha(R4_ROOT / 'reader-source.tar.gz') == PARENT_SHA
    assert sha(R5_ROOT / 'r5-source-delta.tar.gz') == R5_SHA
    assert sha(R5_ROOT / 'effective-source-inventory.json') == R5_INVENTORY_SHA
    parent_inventory = json.loads((R5_ROOT / 'effective-source-inventory.json').read_bytes())
    parent = {row['path']: row for row in parent_inventory['files']}
    current = {rel: record(candidate(rel), rel) for rel in parent}
    changed = {rel for rel in parent if current[rel] != parent[rel]}
    for rel, digest in expected.items():
        observed = record(candidate(rel), rel)
        assert observed['sha256'] == digest, ('Frozen input drift', rel)
        assert record(PERSISTENT / rel, rel) == observed, ('Persistent differs', rel)
        R4['audit_content'](candidate(rel), rel)
        current[rel] = observed
    additions = set(current) - set(parent)
    assert changed | additions == {rel for rel in expected if rel not in parent or current[rel] != parent[rel]}
    assert changed <= set(expected), ('Unexpected source changes', sorted(changed - set(expected)))
    extra = []
    repo_states = []
    for name in R4['REPOS']:
        repo = DELIVERY / name
        additions_in_repo = [name + '/' + rel for rel in R4['candidates'](repo)
                             if name + '/' + rel not in parent and
                             not rel.startswith(('evidence/', 'reports/'))]
        extra.extend(rel for rel in additions_in_repo if rel not in additions)
        repo_states.append(dict(repo=name, head=R4['git'](repo, 'rev-parse', 'HEAD').decode().strip(),
                                dirty=R4['parse_dirty'](repo), additionalNonEvidencePaths=additions_in_repo))
    assert not extra, ('Unexpected production or tool additions', extra)
    root_expected = {rel[len('workspace/'):] for rel in parent if rel.startswith('workspace/')}
    root_actual = set(R4['ROOT_DOCUMENTS'])
    for directory in ('scripts', '.agents'):
        root_actual.update(path.relative_to(DELIVERY).as_posix()
                           for path in (DELIVERY / directory).rglob('*') if path.is_file())
    assert root_expected == root_actual, 'Controlled workspace source membership changed'
    core_path = OUTPUT / 'r6-core-build-snapshot.json'
    subprocess.run(['node', 'scripts/build-input-snapshot.mjs', 'capture', str(core_path)],
                   cwd=DELIVERY / 'Reader-Core-Native', env=R4['ENV'], check=True,
                   stdout=subprocess.DEVNULL)
    core = json.loads(core_path.read_bytes())
    assert core['fingerprint'] == CORE_FP
    native = json.loads((R4_ROOT / 'native-sdk-inventory.json').read_bytes())
    native_root = DELIVERY / 'Reader-Core-Native/target/harmony-napi/arm64-v8a'
    for row in native['files']:
        assert record(native_root / row['path'][len('native-sdk/'):], row['path']) == row
    delta_paths = sorted(changed | additions)
    delta = R4['archive'](OUTPUT, 'r6-source-delta', [(candidate(rel), rel) for rel in delta_paths])
    operations = [dict(operation='replace' if rel in parent else 'add', path=rel,
                       before=parent.get(rel), after=current[rel]) for rel in delta_paths]
    effective = [current[row['path']] for row in parent_inventory['files']] + [current[rel] for rel in sorted(additions)]
    inventory = dict(schemaVersion=1, sourceFileCount=len(effective), sourceBytes=sum(row['bytes'] for row in effective),
                     inventoryFingerprint=fingerprint(effective), files=effective)
    write_json('effective-source-inventory.json', inventory)
    r4_inventory = json.loads((R4_ROOT / 'reader-source-inventory.json').read_bytes())
    r4 = {row['path']: row for row in r4_inventory['files']}
    r5_delta = json.loads((R5_ROOT / 'r5-source-delta-inventory.json').read_bytes())
    r5 = {row['path']: row for row in r5_delta['files']}
    with tempfile.TemporaryDirectory(prefix='manga-r6-source-reconstruction-', dir='/private/tmp') as temporary:
        reconstruction = Path(temporary)
        extract_exact(R4_ROOT / 'reader-source.tar.gz', reconstruction, r4)
        extract_exact(R5_ROOT / 'r5-source-delta.tar.gz', reconstruction, r5)
        extract_exact(OUTPUT / delta['archive']['path'], reconstruction, {row['path']: row for row in delta['files']})
        observed_paths = {path.relative_to(reconstruction).as_posix() for path in reconstruction.rglob('*') if path.is_file()}
        assert observed_paths == set(current)
        for rel, row in current.items():
            assert record(reconstruction / rel, rel) == row, ('Reconstructed differs', rel)
            assert record(candidate(rel), rel) == row, ('Delivery drift during preservation', rel)
    assert frozen_parent_hashes() == before, 'Frozen R4/R5 evidence changed'
    write_json('comparison.json', dict(status='PASS', comparedParentPaths=len(parent), changedPaths=sorted(changed),
                                      addedPaths=sorted(additions), unchangedParentPaths=len(parent)-len(changed),
                                      extraProductionOrToolPaths=[], repoStates=repo_states,
                                      allOtherSourceBytesAndModesUnchanged=True, persistentFrozenChangesMatch=True,
                                      coreBuildInputFingerprint=CORE_FP, nativePackageAndIdentityUnchanged=True))
    manifest = dict(schemaVersion=1, purpose='Frozen R6 delta over exact R4 source plus R5 delta',
                    recordedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    freeze=dict(path='freeze-inputs.json', sha256=args.freeze_sha256),
                    parent=dict(r4Archive=str(R4_ROOT / 'reader-source.tar.gz'), r4ArchiveSha256=PARENT_SHA,
                                r4InventorySha256=sha(R4_ROOT / 'reader-source-inventory.json'),
                                r5Archive=str(R5_ROOT / 'r5-source-delta.tar.gz'), r5ArchiveSha256=R5_SHA,
                                r5ManifestSha256=sha(R5_ROOT / 'delta-manifest.json'),
                                effectiveInventorySha256=R5_INVENTORY_SHA), archive=delta['archive'], operations=operations,
                    effectiveInventory=dict(path='effective-source-inventory.json', sha256=sha(OUTPUT / 'effective-source-inventory.json'),
                                            fingerprint=inventory['inventoryFingerprint'], files=len(effective), sourceBytes=inventory['sourceBytes']),
                    coreBuildInputFingerprint=CORE_FP,
                    nativeParent=dict(archive=str(R4_ROOT / 'native-sdk.tar.gz'), sha256=native['archive']['sha256'],
                                      hostSoSha256=R4['SO_SHA'], exactPackageAndIdentityUnchanged=True),
                    verification=dict(status='PASS', fullFilesystemReconstruction=True, files=len(effective),
                                      everyReconstructedByteAndModeVerified=True, deliverySourcesUnchanged=True,
                                      frozenR4AndR5EvidenceUnchanged=True), sourceMutation=False, buildOrDeviceOperation=False)
    write_json('delta-manifest.json', manifest)
    print(json.dumps(dict(status='PASS', deltaFiles=len(delta_paths), replaceFiles=len(changed), addFiles=len(additions),
                          deltaArchive=delta['archive'], reconstructedFiles=len(effective),
                          effectiveSourceFingerprint=inventory['inventoryFingerprint'], coreBuildInputFingerprint=CORE_FP)))


if __name__ == '__main__':
    main()
