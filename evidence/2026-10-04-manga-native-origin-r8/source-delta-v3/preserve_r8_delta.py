#!/usr/bin/env python3
"""Preserve an explicitly frozen R8 delta over exact R4 + R5 + R6 + R7 archives."""
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import tarfile

OUTPUT = Path(__file__).resolve().parent
EVIDENCE = OUTPUT.parent.parent
R4_ROOT = EVIDENCE / '2026-10-03-manga-reader-sheets-r4/source-preservation'
R5_ROOT = EVIDENCE / '2026-10-03-manga-reader-sheets-r5/source-delta'
R6_ROOT = EVIDENCE / '2026-10-03-manga-reader-system-bars-r6/source-delta'
R7_ROOT = EVIDENCE / '2026-10-03-manga-reader-stable-viewport-r7/source-delta'
R8_V1_ROOT = EVIDENCE / '2026-10-04-manga-native-origin-r8/source-delta-v1'
R8_V2_ROOT = EVIDENCE / '2026-10-04-manga-native-origin-r8/source-delta-v2'
DELIVERY = Path('/private/tmp/reader-manga-sheet-ui-delivery-20261003-1913')
PERSISTENT = Path('/Users/minliny/Documents/Reader/.reader-isolated/manga-ui-20261002')
CORE_FP = '9e97919470b42d81d87082c2c257984778da5e5e5e55798273b3242c99608c4b'
PARENT_SHA = '765627819aa7433c1fa9c575240bee471ea7a3174217af8272e338fdad275132'
R5_SHA = 'a1bba804791fc0873bb924d6696755fd91132629c645c5331391d112c6a04137'
R6_SHA = 'bcaad688874908ffb83bfb9d0de8a21497c1dce55f56887b4721a7c843132a55'
R7_SHA = '6bb34e5d026ea86ace1608e6d3d295b16fa64f5a86fb9fd9e60500ba9a27c386'
R7_INVENTORY_SHA = '58975951a8fb45a827d56c85b4d33ed9388922ab4a444393a228d450a0b8431f'

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
    for root in (R4_ROOT, R5_ROOT, R6_ROOT, R7_ROOT, R8_V1_ROOT, R8_V2_ROOT):
        for path in sorted(root.rglob('*')):
            if path.is_file() and '__pycache__' not in path.parts:
                result[str(path)] = sha(path)
    return result


def verify_archive_bytes(archive, expected):
    seen = set()
    with tarfile.open(archive, 'r:gz') as tar:
        for member in tar:
            path = PurePosixPath(member.name)
            assert not path.is_absolute() and '..' not in path.parts and member.isfile()
            assert member.name in expected and member.name not in seen
            row = expected[member.name]
            digest = hashlib.sha256()
            count = 0
            with tar.extractfile(member) as stream:
                for chunk in iter(lambda: stream.read(1048576), b''):
                    digest.update(chunk)
                    count += len(chunk)
            assert member.mode == row['mode'] and count == row['bytes'] and digest.hexdigest() == row['sha256']
            seen.add(member.name)
    assert seen == set(expected)


def source_path(root, rel):
    return root / (rel[len('workspace/'):] if rel.startswith('workspace/') else rel)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--freeze-sha256', required=True)
    args = parser.parse_args()
    freeze_path = OUTPUT / 'freeze-inputs.json'
    assert sha(freeze_path) == args.freeze_sha256
    freeze = json.loads(freeze_path.read_bytes())
    expected = {'Reader-for-HarmonyOS/' + row['path']: row['sha256']
                for row in freeze['tools'] + freeze['productInputs']}
    assert len(expected) == len(freeze['tools']) + len(freeze['productInputs'])
    before = frozen_parent_hashes()
    assert sha(R4_ROOT / 'reader-source.tar.gz') == PARENT_SHA
    assert sha(R5_ROOT / 'r5-source-delta.tar.gz') == R5_SHA
    assert sha(R6_ROOT / 'r6-source-delta.tar.gz') == R6_SHA
    assert sha(R7_ROOT / 'r7-source-delta.tar.gz') == R7_SHA
    assert sha(R7_ROOT / 'effective-source-inventory.json') == R7_INVENTORY_SHA
    parent_inventory = json.loads((R7_ROOT / 'effective-source-inventory.json').read_bytes())
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
    core_path = OUTPUT / 'r8-core-build-snapshot.json'
    subprocess.run(['node', 'scripts/build-input-snapshot.mjs', 'capture', str(core_path)],
                   cwd=DELIVERY / 'Reader-Core-Native', env=R4['ENV'], check=True,
                   stdout=subprocess.DEVNULL)
    core = json.loads(core_path.read_bytes())
    assert core['fingerprint'] == CORE_FP
    native = json.loads((R4_ROOT / 'native-sdk-inventory.json').read_bytes())
    for workspace in (DELIVERY,):
        native_root = workspace / 'Reader-Core-Native/target/harmony-napi/arm64-v8a'
        for row in native['files']:
            assert record(native_root / row['path'][len('native-sdk/'):], row['path']) == row, ('Native differs', str(workspace), row['path'])
    verify_archive_bytes(R4_ROOT / 'native-sdk.tar.gz', {row['path']: row for row in native['files']})
    delta_paths = sorted(changed | additions)
    delta = R4['archive'](OUTPUT, 'r8-source-delta', [(candidate(rel), rel) for rel in delta_paths])
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
    r6_delta = json.loads((R6_ROOT / 'r6-source-delta-inventory.json').read_bytes())
    r6 = {row['path']: row for row in r6_delta['files']}
    r7_delta = json.loads((R7_ROOT / 'r7-source-delta-inventory.json').read_bytes())
    r7 = {row['path']: row for row in r7_delta['files']}
    # Verify complete archive bytes/modes in streams, then replay each exact
    # overlay. This proves every effective file is reproducible without writing
    # another 440 MB source tree after the user's disk-space cleanup.
    verify_archive_bytes(R4_ROOT / 'reader-source.tar.gz', r4)
    rebuilt = dict(r4)
    for layer_root, archive_name, records in [
            (R5_ROOT, 'r5-source-delta.tar.gz', r5),
            (R6_ROOT, 'r6-source-delta.tar.gz', r6),
            (R7_ROOT, 'r7-source-delta.tar.gz', r7),
            (OUTPUT, delta['archive']['path'], {row['path']: row for row in delta['files']})]:
        verify_archive_bytes(layer_root / archive_name, records)
        layer = operations if layer_root == OUTPUT else json.loads((layer_root / 'delta-manifest.json').read_bytes())['operations']
        assert set(records) == {operation['path'] for operation in layer}
        for operation in layer:
            rel = operation['path']
            if operation['operation'] == 'replace':
                assert rebuilt[rel] == operation['before']
            else:
                assert operation['operation'] == 'add' and operation['before'] is None and rel not in rebuilt
            assert records[rel] == operation['after']
            rebuilt[rel] = operation['after']
    assert rebuilt == current
    for rel, row in current.items():
        assert record(candidate(rel), rel) == row, ('Delivery drift during preservation', rel)
    assert frozen_parent_hashes() == before, 'Frozen R4/R5/R6/R7 evidence changed'
    workspace_audit = json.loads((OUTPUT / 'ATTEMPT1_WORKSPACE_MISMATCH.json').read_bytes())
    assert workspace_audit['tempMismatchCount'] == 0
    write_json('comparison.json', dict(status='PASS',
                                      sourceAuthority='Frozen temp delivery; persistent other-agent differences are outside v3 source/archive',
                                      informationalPersistentDifferences=dict(count=workspace_audit['persistentMismatchCount'], path='ATTEMPT1_WORKSPACE_MISMATCH.json', sha256=sha(OUTPUT / 'ATTEMPT1_WORKSPACE_MISMATCH.json')), comparedParentPaths=len(parent), changedPaths=sorted(changed),
                                      addedPaths=sorted(additions), unchangedParentPaths=len(parent)-len(changed),
                                      extraProductionOrToolPaths=[], repoStates=repo_states,
                                      allOtherSourceBytesAndModesUnchanged=True, tempEveryEffectiveFileByteModeMatch=True, persistentSixFrozenInputsByteModeMatch=True, persistentFrozenChangesMatch=True,
                                      coreBuildInputFingerprint=CORE_FP, nativePackageAndIdentityUnchanged=True))
    manifest = dict(schemaVersion=1, purpose='Frozen R8 delta over exact R4 source plus R5, R6 and R7 deltas',
                    recordedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    freeze=dict(path='freeze-inputs.json', sha256=args.freeze_sha256),
                    parent=dict(r4Archive=str(R4_ROOT / 'reader-source.tar.gz'), r4ArchiveSha256=PARENT_SHA,
                                r4InventorySha256=sha(R4_ROOT / 'reader-source-inventory.json'),
                                r5Archive=str(R5_ROOT / 'r5-source-delta.tar.gz'), r5ArchiveSha256=R5_SHA,
                                r5ManifestSha256=sha(R5_ROOT / 'delta-manifest.json'),
                                r6Archive=str(R6_ROOT / 'r6-source-delta.tar.gz'), r6ArchiveSha256=R6_SHA,
                                r6ManifestSha256=sha(R6_ROOT / 'delta-manifest.json'),
                                r7Archive=str(R7_ROOT / 'r7-source-delta.tar.gz'), r7ArchiveSha256=R7_SHA,
                                r7ManifestSha256=sha(R7_ROOT / 'delta-manifest.json'),
                                effectiveInventorySha256=R7_INVENTORY_SHA), archive=delta['archive'], operations=operations,
                    effectiveInventory=dict(path='effective-source-inventory.json', sha256=sha(OUTPUT / 'effective-source-inventory.json'),
                                            fingerprint=inventory['inventoryFingerprint'], files=len(effective), sourceBytes=inventory['sourceBytes']),
                    coreBuildInputFingerprint=CORE_FP,
                    nativeParent=dict(archive=str(R4_ROOT / 'native-sdk.tar.gz'), sha256=native['archive']['sha256'],
                                      hostSoSha256=R4['SO_SHA'], exactPackageAndIdentityUnchanged=True),
                    verification=dict(status='PASS', fullFilesystemReconstruction=False, fullStreamingReconstruction=True, files=len(effective),
                                      everyReconstructedByteAndModeVerified=True, deliverySourcesUnchanged=True,
                                      frozenR4R5R6R7AndR8V1V2EvidenceUnchanged=True), sourceMutation=False, buildOrDeviceOperation=False)
    write_json('delta-manifest.json', manifest)
    print(json.dumps(dict(status='PASS', deltaFiles=len(delta_paths), replaceFiles=len(changed), addFiles=len(additions),
                          deltaArchive=delta['archive'], reconstructedFiles=len(effective),
                          effectiveSourceFingerprint=inventory['inventoryFingerprint'], coreBuildInputFingerprint=CORE_FP)))


if __name__ == '__main__':
    main()
