#!/usr/bin/env python3
"""Verify the frozen two-directory R7 partial evidence inventory without HDC/build."""
import argparse
import hashlib
import json
from pathlib import Path

EVIDENCE_ROOT = Path(__file__).resolve().parent
HOST = EVIDENCE_ROOT.parents[1]


def sha(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1048576), b''):
            h.update(chunk)
    return h.hexdigest()


def verify(host, inventory):
    expected = {row['path']: row for row in inventory['files']}
    assert len(expected) == len(inventory['files']) == inventory['fileCount']
    observed = set()
    for directory in inventory['directories']:
        for path in (host / directory).rglob('*'):
            assert not path.is_symlink(), ('Symlink evidence', str(path))
            if path.is_file() and path.relative_to(host).as_posix() != inventory['selfExcludedPath']:
                observed.add(path.relative_to(host).as_posix())
    assert observed == set(expected), ('Evidence membership changed', sorted(observed - set(expected)), sorted(set(expected) - observed))
    for rel, row in expected.items():
        path = host / rel
        assert path.stat().st_size == row['bytes'] and path.stat().st_mode & 0o777 == row['mode'] and sha(path) == row['sha256'], ('Evidence bytes/mode differ', rel)
    assert sum(row['bytes'] for row in expected.values()) == inventory['bytes']
    return len(expected)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--compare-tree', type=Path)
    args = parser.parse_args()
    inventory_path = EVIDENCE_ROOT / 'FINAL_SHA256SUMS.json'
    inventory = json.loads(inventory_path.read_bytes())
    count = verify(HOST, inventory)
    compared = False
    if args.compare_tree:
        second = args.compare_tree.resolve()
        verify(second, inventory)
        counterpart = second / inventory['selfExcludedPath']
        assert counterpart.read_bytes() == inventory_path.read_bytes()
        assert counterpart.stat().st_mode & 0o777 == inventory_path.stat().st_mode & 0o777
        compared = True
    print(json.dumps(dict(status='PASS', evidenceFiles=count, evidenceBytes=inventory['bytes'],
                          twoR7DirectoriesVerified=True, scenarioAcceptanceStatus=inventory['scenarioAcceptanceStatus'], fullScreenContentOriginStatus=inventory['fullScreenContentOriginStatus'], comparedTreeExact=compared,
                          failedZeroByteProbesRetained=inventory['retainedZeroByteProbePaths'], evidenceHistoryLimitationsDisclosed=inventory['evidenceHistoryLimitations'],
                          finalInventorySha256=sha(inventory_path), noBuildOrDeviceOperation=True)))


if __name__ == '__main__':
    main()
