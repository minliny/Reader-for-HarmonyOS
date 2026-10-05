#!/usr/bin/env python3
"""Verify the copied R3/R4 evidence without reading the original temporary tree."""
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


def main():
    inventory = json.loads((ROOT / 'evidence-inventory.json').read_text())
    for row in inventory['files']:
        p = Path(row['destination'])
        assert p.is_file() and not p.is_symlink(), 'missing/unsafe persistent evidence'
        assert p.stat().st_size == row['bytes'], 'persistent evidence size mismatch'
        assert sha(p) == row['sha256'], 'persistent evidence SHA mismatch: ' + row['path']
    parent = Path(inventory['persistentRoot']) / '2026-10-03-manga-reader-sheets-r4/source-preservation/reader-source.tar.gz'
    assert sha(parent) == inventory['frozenR4SourceParentUnchanged']['sha256'], 'R4 source baseline changed'
    print(json.dumps(dict(status='PASS', files=len(inventory['files']),
                          sourceBytes=inventory['sourceBytes'],
                          allPersistentBytesVerified=True, originalSourceRequired=False,
                          r4SourceParentUnchanged=True)))


if __name__ == '__main__':
    main()
