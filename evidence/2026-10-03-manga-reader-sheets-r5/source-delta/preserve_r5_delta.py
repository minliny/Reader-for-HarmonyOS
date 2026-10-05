#!/usr/bin/env python3
"""Preserve the explicitly frozen two-file R5 delta; no source/build mutation."""
import datetime
import hashlib
import importlib.util
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import tarfile
import tempfile

OUTPUT = Path(__file__).resolve().parent
EVIDENCE = OUTPUT.parent.parent
BASE = EVIDENCE / '2026-10-03-manga-reader-sheets-r4/source-preservation'
DELIVERY = Path('/private/tmp/reader-manga-sheet-ui-delivery-20261003-1913')
ORIGINAL = Path('/Users/minliny/Documents/Reader/.reader-isolated/manga-ui-20261002')
PARENT_SHA = '765627819aa7433c1fa9c575240bee471ea7a3174217af8272e338fdad275132'
CORE_FINGERPRINT = '9e97919470b42d81d87082c2c257984778da5e5e5e55798273b3242c99608c4b'
EXPECTED = {
    'Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderDirectoryNavigationSurface.ets':
        '00087dbd1fc42a843b93242f4c450d17f7f70dde8bd7e1ea575431aebfce3685',
    'Reader-for-HarmonyOS/tools/test-manga-directory-font-readiness-sdk.mjs':
        'd70ab1686040b7a45408b6b87b951966106c934ec8a417be9287ad6cc9e22f67',
}
spec = importlib.util.spec_from_file_location('frozen_r4_preservation', BASE / 'preserve_sources.py')
R4 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(R4)


def write_json(name, data):
    (OUTPUT / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')


def candidate_path(rel):
    return DELIVERY / (rel[len('workspace/'):] if rel.startswith('workspace/') else rel)


def fingerprint(records):
    h = hashlib.sha256()
    for row in records:
        h.update((json.dumps(row, ensure_ascii=False, separators=(',', ':')) + '\n').encode())
    return h.hexdigest()


def extract_exact(archive, directory, expected):
    seen = set()
    with tarfile.open(archive, 'r:gz') as tar:
        for member in tar:
            p = PurePosixPath(member.name)
            if p.is_absolute() or '..' in p.parts or not member.isfile():
                raise RuntimeError('Unsafe archive member')
            if member.name not in expected or member.name in seen:
                raise RuntimeError('Unexpected archive member: ' + member.name)
            seen.add(member.name)
            destination = directory / member.name
            destination.parent.mkdir(parents=True, exist_ok=True)
            with tar.extractfile(member) as source, destination.open('wb') as target:
                shutil.copyfileobj(source, target, 1048576)
            os.chmod(destination, member.mode)
            if R4.source_record(destination, member.name) != expected[member.name]:
                raise RuntimeError('Extracted archive byte/mode mismatch: ' + member.name)
    if seen != set(expected):
        raise RuntimeError('Missing archive members')


def main():
    parent_archive = BASE / 'reader-source.tar.gz'
    parent_inventory_file = BASE / 'reader-source-inventory.json'
    if R4.sha_file(parent_archive) != PARENT_SHA:
        raise RuntimeError('Frozen R4 source parent changed')
    parent_inventory = json.loads(parent_inventory_file.read_text())
    parent = {r['path']: r for r in parent_inventory['files']}
    current = {}
    changed = []
    for old in parent_inventory['files']:
        rel = old['path']
        now = R4.source_record(candidate_path(rel), rel)
        current[rel] = now
        if now != old:
            changed.append(rel)
    if set(changed) != set(EXPECTED):
        raise RuntimeError('Unexpected source differences: ' + json.dumps(changed))
    for rel, expected in EXPECTED.items():
        if current[rel]['sha256'] != expected:
            raise RuntimeError('R5 frozen source SHA mismatch: ' + rel)
        if R4.source_record(ORIGINAL / rel, rel) != current[rel]:
            raise RuntimeError('Original and delivery trees differ: ' + rel)
        R4.audit_content(candidate_path(rel), rel)
    # The candidate Git inventory must not add any production/source/tool path.
    extra = []
    state = []
    parent_paths = set(parent)
    for name in R4.REPOS:
        repo = DELIVERY / name
        paths = R4.candidates(repo)
        additions = [name + '/' + p for p in paths
                     if name + '/' + p not in parent_paths and
                     not p.startswith(('evidence/', 'reports/'))]
        extra.extend(additions)
        state.append(dict(repo=name,
                          head=R4.git(repo, 'rev-parse', 'HEAD').decode().strip(),
                          dirty=R4.parse_dirty(repo),
                          additionalNonEvidencePaths=additions))
    if extra:
        raise RuntimeError('Unexpected additional production/tool source paths: ' + json.dumps(extra))
    root_expected = {p[len('workspace/'):] for p in parent if p.startswith('workspace/')}
    root_actual = set(R4.ROOT_DOCUMENTS)
    for directory in ('scripts', '.agents'):
        root_actual.update(p.relative_to(DELIVERY).as_posix()
                           for p in (DELIVERY / directory).rglob('*') if p.is_file())
    if root_actual != root_expected:
        raise RuntimeError('Controlled Root source membership changed')
    core_snapshot_file = OUTPUT / 'r5-core-build-snapshot.json'
    subprocess.run(['node', 'scripts/build-input-snapshot.mjs', 'capture', str(core_snapshot_file)],
                   cwd=DELIVERY / 'Reader-Core-Native', env=R4.ENV, check=True,
                   stdout=subprocess.DEVNULL)
    core = json.loads(core_snapshot_file.read_text())
    if core['fingerprint'] != CORE_FINGERPRINT:
        raise RuntimeError('Core canonical input fingerprint changed')
    native_inventory_file = BASE / 'native-sdk-inventory.json'
    native_inventory = json.loads(native_inventory_file.read_text())
    native_root = DELIVERY / 'Reader-Core-Native/target/harmony-napi/arm64-v8a'
    for r in native_inventory['files']:
        rel = r['path']
        p = native_root / rel[len('native-sdk/'):]
        if R4.source_record(p, rel) != r:
            raise RuntimeError('Native package or identity changed: ' + rel)
    delta = R4.archive(OUTPUT, 'r5-source-delta',
                       [(candidate_path(p), p) for p in sorted(EXPECTED)])
    operations = [dict(operation='replace', path=p, before=parent[p], after=current[p])
                  for p in sorted(EXPECTED)]
    effective = [current[r['path']] for r in parent_inventory['files']]
    effective_inventory = dict(schemaVersion=1, sourceFileCount=len(effective),
                               sourceBytes=sum(r['bytes'] for r in effective),
                               inventoryFingerprint=fingerprint(effective), files=effective)
    write_json('effective-source-inventory.json', effective_inventory)
    write_json('comparison.json', dict(schemaVersion=1, status='PASS',
                                      comparedParentPaths=len(parent), changedPaths=changed,
                                      unchangedPaths=len(parent) - len(changed), missingPaths=[],
                                      extraProductionOrToolPaths=[], repoStates=state,
                                      allOtherSourceBytesAndModesUnchanged=True,
                                      twoSourceTreesMatch=True, coreBuildInputFingerprint=core['fingerprint'],
                                      nativePackageAndIdentityUnchanged=True))
    # Actual complete reconstruction in a new temporary directory, no Git/build.
    with tempfile.TemporaryDirectory(prefix='manga-r5-source-reconstruction-', dir='/private/tmp') as tmp:
        reconstruction = Path(tmp)
        extract_exact(parent_archive, reconstruction, parent)
        delta_records = {r['path']: r for r in delta['files']}
        extract_exact(OUTPUT / delta['archive']['path'], reconstruction, delta_records)
        observed_paths = {p.relative_to(reconstruction).as_posix()
                          for p in reconstruction.rglob('*') if p.is_file()}
        if observed_paths != set(current):
            raise RuntimeError('Reconstructed source path set differs')
        for rel, expected in current.items():
            if R4.source_record(reconstruction / rel, rel) != expected:
                raise RuntimeError('Reconstructed R5 differs: ' + rel)
            if R4.source_record(candidate_path(rel), rel) != expected:
                raise RuntimeError('Frozen delivery source changed during delta preservation: ' + rel)
        reconstructed_count = len(observed_paths)
    if R4.sha_file(parent_archive) != PARENT_SHA:
        raise RuntimeError('Frozen R4 parent changed during delta preservation')
    manifest = dict(schemaVersion=1, purpose='Frozen R5 source delta over exact R4 parent',
                    createdAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    parent=dict(archive=str(parent_archive), sha256=PARENT_SHA,
                                inventory=str(parent_inventory_file),
                                inventorySha256=R4.sha_file(parent_inventory_file)),
                    archive=delta['archive'], operations=operations,
                    effectiveInventory=dict(path='effective-source-inventory.json',
                                            sha256=R4.sha_file(OUTPUT / 'effective-source-inventory.json'),
                                            fingerprint=effective_inventory['inventoryFingerprint'],
                                            files=len(effective), sourceBytes=effective_inventory['sourceBytes']),
                    coreBuildInputFingerprint=CORE_FINGERPRINT,
                    nativeParent=dict(archive=str(BASE / 'native-sdk.tar.gz'),
                                      sha256=native_inventory['archive']['sha256'],
                                      hostSoSha256=R4.SO_SHA, exactPackageAndIdentityUnchanged=True),
                    verification=dict(status='PASS', exactTwoFileDelta=True,
                                      fullFilesystemReconstruction=True, files=reconstructed_count,
                                      everyReconstructedByteAndModeVerified=True,
                                      frozenSourcesUnchanged=True, frozenR4ParentUnchanged=True),
                    sourceMutation=False, buildOrDeviceOperation=False)
    # No placeholder artifact hashes, run ids or fabricated canonical manifest.
    write_json('delta-manifest.json', manifest)
    print(json.dumps(dict(status='PASS', deltaFiles=2, deltaArchive=delta['archive'],
                          reconstructedFiles=reconstructed_count,
                          effectiveSourceFingerprint=effective_inventory['inventoryFingerprint'],
                          coreBuildInputFingerprint=CORE_FINGERPRINT)))


if __name__ == '__main__':
    main()
