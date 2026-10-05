#!/usr/bin/env python3
"""Reconstruct exact v1 source bytes; never claim unavailable original metadata."""
import datetime
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import tarfile
import tempfile

OUTPUT = Path(__file__).resolve().parent
R7 = OUTPUT.parent
EVIDENCE = R7.parent
R4 = EVIDENCE / '2026-10-03-manga-reader-sheets-r4/source-preservation'
R6 = EVIDENCE / '2026-10-03-manga-reader-system-bars-r6/source-delta'
FINAL = R7 / 'source-delta'
SDK = EVIDENCE / '2026-10-03-manga-reader-system-bars-r7/sdk'
HELPERS = {'__name__': 'frozen_r4_helpers', '__file__': str(R4 / 'preserve_sources.py')}
exec(compile((R4 / 'preserve_sources.py').read_bytes(), str(R4 / 'preserve_sources.py'), 'exec'), HELPERS)


def sha(path):
    return HELPERS['sha_file'](path)


def fp(rows):
    h = hashlib.sha256()
    for row in rows:
        h.update((json.dumps(row, ensure_ascii=False, separators=(',', ':')) + '\n').encode())
    return h.hexdigest()


def save(name, value):
    with (OUTPUT / name).open('x') as stream:
        stream.write(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def main():
    previous = json.loads((R7 / 'SOURCE_DELTA_ATTEMPT_1_RECORD.json').read_bytes())
    originals = {row['path']: row for row in previous['files']}
    freeze_path = SDK / 'INPUTS_FROZEN.v1.json'
    assert sha(freeze_path) == 'd3be88efc5d0f7a5d90b6fcb71a7d5ced99103c0975f5e05a26b96a91602008c'
    freeze = json.loads(freeze_path.read_bytes())
    expected = {'Reader-for-HarmonyOS/' + row['path']: row['sha256']
                for row in freeze['tools'] + freeze['productInputs']}
    assert len(expected) == 12
    final = json.loads((FINAL / 'delta-manifest.json').read_bytes())
    archive = FINAL / final['archive']['path']
    assert sha(archive) == '6bb34e5d026ea86ace1608e6d3d295b16fa64f5a86fb9fd9e60500ba9a27c386'
    after = {operation['path']: operation['after'] for operation in final['operations'] if operation['path'] in expected}
    assert len(after) == 12
    for rel, digest in expected.items():
        assert after[rel]['sha256'] == digest
    with tempfile.TemporaryDirectory(prefix='manga-r7-v1-reconstructed-', dir='/private/tmp') as temporary:
        directory = Path(temporary)
        seen = set()
        with tarfile.open(archive, 'r:gz') as tar:
            for member in tar:
                rel = member.name
                if rel not in expected:
                    continue
                path = PurePosixPath(rel)
                assert member.isfile() and not path.is_absolute() and '..' not in path.parts and rel not in seen
                destination = directory / rel
                destination.parent.mkdir(parents=True, exist_ok=True)
                with tar.extractfile(member) as source, destination.open('wb') as target:
                    shutil.copyfileobj(source, target, 1048576)
                os.chmod(destination, member.mode)
                assert HELPERS['source_record'](destination, rel) == after[rel]
                seen.add(rel)
        assert seen == set(expected)
        result = HELPERS['archive'](OUTPUT, 'r7-source-delta', [(directory / rel, rel) for rel in sorted(expected)])
    assert result['archive']['sha256'] == originals['r7-source-delta.tar.gz']['sha256'] == '4a582979e0a31f5cee691856f66b8f39c8457002fe2c379c9e854f168d9badc2'
    assert result['archive']['bytes'] == originals['r7-source-delta.tar.gz']['bytes']
    assert sha(OUTPUT / 'r7-source-delta-inventory.json') == originals['r7-source-delta-inventory.json']['sha256']
    parent = json.loads((R6 / 'effective-source-inventory.json').read_bytes())
    records = {row['path']: row for row in parent['files']}
    operations = []
    additions = []
    for rel in sorted(after):
        operations.append(dict(operation='replace' if rel in records else 'add', path=rel, before=records.get(rel), after=after[rel]))
        if rel not in records:
            additions.append(rel)
        records[rel] = after[rel]
    effective = [records[row['path']] for row in parent['files']] + [records[rel] for rel in sorted(additions)]
    inventory = dict(schemaVersion=1, sourceFileCount=len(effective), sourceBytes=sum(row['bytes'] for row in effective),
                     inventoryFingerprint=fp(effective), files=effective)
    save('effective-source-inventory.json', inventory)
    assert sha(OUTPUT / 'effective-source-inventory.json') == originals['effective-source-inventory.json']['sha256']
    with (OUTPUT / 'freeze-inputs.json').open('xb') as stream:
        stream.write(freeze_path.read_bytes())
    report = dict(schemaVersion=1, recordedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                  status='PASS_RECONSTRUCTED_SOURCE_BYTES', provenance='Reconstructed after evidence-directory drift; not original metadata',
                  originalPreservationReceipt='SOURCE_DELTA_ATTEMPT_1_RECORD.json', archive=result['archive'], deltaOperations=operations,
                  exactOriginalArchiveSha256AndBytesMatched=True, exactOriginalDeltaInventorySha256Matched=True,
                  exactOriginalEffectiveInventorySha256Matched=True, originalFreezeBytesMatched=True,
                  originalMetadataUnavailable=['delta-manifest.json', 'comparison.json'],
                  originalMetadataNotRecreatedOrFabricated=True, originalMetadataHashesRetained=originals,
                  temporaryReconstructionRemoved=True, productSourceOrTestsMutated=False,
                  canonicalArtifactOrPriorR4R5R6EvidenceMutated=False, buildOrDeviceOperation=False)
    save('RECONSTRUCTION_RECORD.json', report)
    print(json.dumps(dict(status='PASS_RECONSTRUCTED_SOURCE_BYTES', deltaFiles=12, archiveSha256=result['archive']['sha256'],
                          originalArchiveAndInventoriesExactHashMatched=True, originalMetadataStillUnavailable=True)))


if __name__ == '__main__':
    main()
