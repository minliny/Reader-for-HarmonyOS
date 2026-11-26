import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyV9ImportReport, buildV9ImportRows, chooseV9ImportRow, sourceV9ImportedReports,
  sourceV9SelectedImportRows, sourceV9ChangesToApply, type SourceV9Change } from '../../entry/src/main/ets/features/source/application/SourceV9TransferState.ts';
import type { SourceImportCandidate } from '../../entry/src/main/ets/features/source/application/SourceGateway.ts';

test('unsupported entries cannot be selected and other-source checks cannot affect the pending import', () => {
  const novel: SourceImportCandidate = { index: 0, sourceId: 'https://book.example.test', name: '小说', category: 'novel',
    supported: true, bookSource: { bookSourceUrl: 'https://book.example.test' } };
  const audio: SourceImportCandidate = { ...novel, index: 1, sourceId: 'https://audio.example.test', category: 'music', supported: false };
  let rows = chooseV9ImportRow(buildV9ImportRows([novel, audio], []), 1, true);
  assert.deepEqual(sourceV9SelectedImportRows(rows), [novel]);
  const wrong = { sourceId: audio.sourceId, traceId: 'check', available: false, levelsPassed: ['L1'],
    durationMs: 1, logs: [], hostEvidenceCount: 0 };
  rows = applyV9ImportReport(rows, 0, wrong, 77);
  assert.deepEqual(sourceV9SelectedImportRows(rows), [novel]);
  assert.deepEqual(sourceV9ImportedReports(rows, [novel.sourceId]), []);
});

test('subscription preview applies only selected changes with explicit conflict overwrite', () => {
  const rows: SourceV9Change[] = [
    { key: 'added', name: '新增', kind: 'added', selected: true, selectable: true, overwrite: false },
    { key: 'retain', name: '保留', kind: 'conflict', selected: true, selectable: true, overwrite: false },
    { key: 'replace', name: '覆盖', kind: 'conflict', selected: true, selectable: true, overwrite: true },
    { key: 'remote-removed', name: '远端删除', kind: 'removedRemote', selected: true, selectable: true, overwrite: false },
  ];
  assert.deepEqual(sourceV9ChangesToApply(rows).map(row => row.key), ['added', 'replace']);
});
