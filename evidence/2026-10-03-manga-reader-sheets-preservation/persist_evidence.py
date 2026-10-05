#!/usr/bin/env python3
"""Copy frozen R3/R4 evidence without replacing an existing different file."""
import datetime
import hashlib
import json
import os
from pathlib import Path
import shutil
import stat

SOURCE = Path('/private/tmp/reader-manga-sheet-ui-delivery-20261003-1913/Reader-for-HarmonyOS/evidence')
DEST = Path('/Users/minliny/Documents/Reader/.reader-isolated/manga-ui-20261002/Reader-for-HarmonyOS/evidence')
OUTPUT = Path(__file__).resolve().parent
NAMES = ('2026-10-03-manga-reader-sheets-r3', '2026-10-03-manga-reader-sheets-r4')
R4_PARENT_SHA = '765627819aa7433c1fa9c575240bee471ea7a3174217af8272e338fdad275132'


def sha(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1048576), b''):
            h.update(chunk)
    return h.hexdigest()


def describe(path):
    s = path.lstat()
    if not stat.S_ISREG(s.st_mode) or any(p.is_symlink() for p in path.parents):
        raise RuntimeError('Only regular files with safe parents are allowed: ' + str(path))
    return dict(bytes=s.st_size, sha256=sha(path), mode=s.st_mode & 0o777)


def main():
    parent = DEST / '2026-10-03-manga-reader-sheets-r4/source-preservation/reader-source.tar.gz'
    parent_before = describe(parent)
    if parent_before['sha256'] != R4_PARENT_SHA:
        raise RuntimeError('Frozen R4 source parent differs')
    rows = []
    # Preflight every input and destination before writing any evidence.
    for name in NAMES:
        root = SOURCE / name
        if not root.is_dir():
            raise RuntimeError('Missing original evidence directory: ' + name)
        for p in sorted(root.rglob('*')):
            if p.is_symlink():
                raise RuntimeError('Symlink evidence input forbidden: ' + str(p))
            if not p.is_file():
                continue
            rel = p.relative_to(SOURCE).as_posix()
            record = describe(p)
            destination = DEST / rel
            existing = destination.exists()
            conflict = existing and describe(destination)['sha256'] != record['sha256']
            # A conflict is kept as a separate exact object, never a replacement.
            if conflict:
                destination = OUTPUT / 'conflicts' / record['sha256'] / rel
            rows.append(dict(path=rel, source=str(p), destination=str(destination),
                             **record, existed=existing, differentHashConflict=conflict))
    for row in rows:
        source = Path(row['source'])
        destination = Path(row['destination'])
        if describe(source) != {k: row[k] for k in ('bytes', 'sha256', 'mode')}:
            raise RuntimeError('Original evidence changed after preflight: ' + row['path'])
        destination.parent.mkdir(parents=True, exist_ok=True)
        if destination.exists():
            if describe(destination)['sha256'] != row['sha256']:
                raise RuntimeError('Existing destination changed or conflict-object differs')
            row['copyAction'] = 'existing-identical-kept'
        else:
            # Exclusive creation prevents a concurrent file from being overwritten.
            try:
                with source.open('rb') as src, destination.open('xb') as dst:
                    shutil.copyfileobj(src, dst, 1048576)
                os.chmod(destination, row['mode'])
            except Exception:
                raise
            row['copyAction'] = 'copied'
        actual = describe(destination)
        if actual['sha256'] != row['sha256'] or actual['bytes'] != row['bytes']:
            raise RuntimeError('Persistent evidence differs: ' + row['path'])
        row['destinationBytes'] = actual['bytes']
        row['destinationSha256'] = actual['sha256']
        row['destinationMode'] = actual['mode']
    # Verify the entire source set again, including exact paths, after copying.
    for name in NAMES:
        actual_paths = {p.relative_to(SOURCE).as_posix() for p in (SOURCE / name).rglob('*') if p.is_file()}
        expected_paths = {r['path'] for r in rows if r['path'].startswith(name + '/')}
        if actual_paths != expected_paths:
            raise RuntimeError('Original evidence member set changed')
    for row in rows:
        if describe(Path(row['source'])) != {k: row[k] for k in ('bytes', 'sha256', 'mode')}:
            raise RuntimeError('Original evidence changed during copying: ' + row['path'])
        if sha(Path(row['destination'])) != row['sha256']:
            raise RuntimeError('Persistent evidence changed after copying')
    if describe(parent) != parent_before:
        raise RuntimeError('Frozen R4 parent archive changed')
    result = dict(schemaVersion=1, status='PASS',
                  copiedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                  sourceRoot=str(SOURCE), persistentRoot=str(DEST),
                  sourceFiles=len(rows), sourceBytes=sum(r['bytes'] for r in rows),
                  copiedFiles=sum(r['copyAction'] == 'copied' for r in rows),
                  existingIdenticalFiles=sum(r['copyAction'] == 'existing-identical-kept' for r in rows),
                  differentHashConflicts=sum(r['differentHashConflict'] for r in rows),
                  everyDestinationByteVerified=True, exactSourceMemberSetVerified=True,
                  sourceUnchangedDuringCopy=True, existingDifferentFileOverwritten=False,
                  frozenR4SourceParentUnchanged=parent_before, files=rows)
    (OUTPUT / 'evidence-inventory.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: result[k] for k in ('status', 'sourceFiles', 'sourceBytes', 'copiedFiles',
                                            'existingIdenticalFiles', 'differentHashConflicts')}))


if __name__ == '__main__':
    main()
