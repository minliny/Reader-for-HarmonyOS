import assert from 'node:assert/strict';
import { test } from 'node:test';
import { qualifySourceTransferReports, remainingSourceReviewRows, storedSourceTransferEvidence } from
  '../../entry/src/main/ets/features/source/application/SourceTransferPublication.ts';
import type { SourceV9Change, SourceV9ImportedReport } from '../../entry/src/main/ets/features/source/application/SourceV9TransferState.ts';

test('partial review completion removes only individually confirmed rows', () => {
  const rows: SourceV9Change[] = [
    { key: 'confirmed', name: 'First', kind: 'update', selectable: true, selected: true, overwrite: false },
    { key: 'failed', name: 'Second', kind: 'update', selectable: true, selected: true, overwrite: false },
    { key: 'not-chosen', name: 'Third', kind: 'conflict', selectable: true, selected: false, overwrite: false },
  ];
  assert.deepEqual(remainingSourceReviewRows(rows, new Set(['confirmed'])), [rows[1], rows[2]]);
});

test('batch source evidence admits exact canonical rules and rejects duplicate, stale and mismatched rows', () => {
  const ids = ['confirmed', 'sameDigestDifferentRules', 'duplicate', 'stale', 'mismatchedId'];
  const reports: SourceV9ImportedReport[] = ids.map((id) => ({
    sourceId: id,
    candidate: { enabled: true, bookSourceName: 'Reader' },
    report: {
      sourceId: id === 'mismatchedId' ? 'another' : id, traceId: id, available: true, levelsPassed: [], logs: [],
      durationMs: 1, hostEvidenceCount: 0,
      report: { version: 1, mode: 'search', traceId: id, ruleDigest: 'expected', inputDigest: 'input', steps: [] },
    },
  }));
  const one = { sourceId: 'confirmed', sourceVersion: 'expected', bookSource: { bookSourceName: 'Reader', enabled: true } };
  const duplicate = { ...one, sourceId: 'duplicate' };
  const rows = [one, duplicate, { ...one, sourceId: 'stale', sourceVersion: 'old' },
    { ...one, sourceId: 'sameDigestDifferentRules', bookSource: { enabled: false, bookSourceName: 'Reader' } },
    { ...one, sourceId: 'mismatchedId' }, duplicate];
  const indexed = storedSourceTransferEvidence(rows, new Set(ids));
  assert.deepEqual(qualifySourceTransferReports(reports, indexed), [{ ...reports[0], sourceVersion: 'expected' }]);
});
