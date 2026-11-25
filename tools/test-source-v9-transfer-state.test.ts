import { expect, test } from 'bun:test';
import {
  applyV9ImportReport, buildV9ImportRows, chooseV9ImportRow, runV9CandidateChecks,
  sourceV9ChangesToApply, sourceV9ImportedReports, sourceV9CanonicalDocument, sourceV9ReplaceRuleComparable, type SourceV9Change,
} from '../entry/src/main/ets/features/source/application/SourceV9TransferState';
import type { SourceV9TransferSnapshot } from '../entry/src/main/ets/features/source/application/SourceV9TransferOwner';
import type { SourceCheckOutcome, SourceImportCandidate } from '../entry/src/main/ets/features/source/application/SourceGateway';

const novel: SourceImportCandidate = {
  index: 0, sourceId: 'https://books.example', name: '小说', category: 'novel', supported: true,
  bookSource: { bookSourceUrl: 'https://books.example', bookSourceName: '小说' },
};
const audio: SourceImportCandidate = {
  index: 1, sourceId: 'https://audio.example', name: '听书', category: 'music', supported: false,
  bookSource: { bookSourceUrl: 'https://audio.example', bookSourceName: '听书' },
};
const report = (available: boolean): SourceCheckOutcome => ({
  sourceId: novel.sourceId, traceId: 'real-fixture', available, levelsPassed: available ? ['L1', 'L2'] : ['L1'],
  durationMs: 30, logs: [], hostEvidenceCount: 1,
});

test('unsupported source remains locked and a reviewed failure can be reselected and retained', () => {
  let rows = buildV9ImportRows([novel, audio], []);
  expect(rows.map(row => row.selected)).toEqual([true, false]);
  rows = chooseV9ImportRow(rows, 1, true);
  expect(rows[1].selected).toBe(false);
  rows = applyV9ImportReport(rows, 0, report(false), 123);
  expect(rows[0].selected).toBe(false);
  rows = chooseV9ImportRow(rows, 0, true);
  expect(rows[0].selected).toBe(true);
  expect(sourceV9ImportedReports(rows, [])).toEqual([]);
  expect(sourceV9ImportedReports(rows, [novel.sourceId])).toEqual([
    { sourceId: novel.sourceId, candidate: novel.bookSource, report: report(false), observedAtMs: 123 },
  ]);
});

test('stopping dispatch preserves completed evidence and discards stale completions', async () => {
  let current = true;
  const dispatched: number[] = [];
  const received: number[] = [];
  const started: number[] = [];
  await runV9CandidateChecks([1, 2, 3], () => current, async (id: number): Promise<number> => {
    dispatched.push(id);
    if (id === 2) current = false;
    return id;
  }, row => started.push(row), (_row, result) => received.push(result), () => {});
  expect(started).toEqual([1, 2]);
  expect(dispatched).toEqual([1, 2]);
  expect(received).toEqual([1]);
});

test('application count excludes retained conflicts, removals, unchanged and filtered candidates', () => {
  const rows: SourceV9Change[] = [
    { key: 'new', name: '新增', kind: 'added', selected: true, selectable: true, overwrite: false },
    { key: 'keep', name: '保留', kind: 'conflict', selected: true, selectable: true, overwrite: false },
    { key: 'replace', name: '覆盖', kind: 'conflict', selected: true, selectable: true, overwrite: true },
    { key: 'removed', name: '移除', kind: 'removedRemote', selected: true, selectable: true, overwrite: false },
    { key: 'same', name: '无变化', kind: 'unchanged', selected: true, selectable: true, overwrite: false },
    { key: 'media', name: '有声', kind: 'added', selected: true, selectable: false, overwrite: false },
  ];
  expect(sourceV9ChangesToApply(rows).map(item => item.key)).toEqual(['new', 'replace']);
});


test('equivalent Core replacement defaults preserve unchanged rule identity', () => {
  const sparse = { id: 7, name: '净化', pattern: '广告', group: null };
  const complete = {
    isEnabled: true, id: 7, name: '净化', pattern: '广告', replacement: '',
    scopeTitle: false, scopeSource: false, scopeContent: true, isRegex: true, timeoutMillisecond: 3000, order: 0,
  };
  expect(sourceV9ReplaceRuleComparable(sparse)).toBe(sourceV9ReplaceRuleComparable(complete));
  expect(sourceV9ReplaceRuleComparable({ ...sparse, group: '' })).not.toBe(sourceV9ReplaceRuleComparable(complete));
  expect(sourceV9ReplaceRuleComparable({ ...sparse, isRegex: false })).not.toBe(sourceV9ReplaceRuleComparable(complete));
  expect(sourceV9CanonicalDocument({ nested: { x: [1, 2], y: false } }))
    .toBe(sourceV9CanonicalDocument({ nested: { y: false, x: [1, 2] } }));
});

test('a rejected in-flight request after stop cannot publish a candidate failure', async () => {
  let current = true;
  const failed: number[] = [];
  await runV9CandidateChecks([1, 2, 3], () => current, async (id: number): Promise<number> => {
    if (id < 2) throw new Error('request failed before stop');
    current = false;
    throw new Error('request cancelled after stop');
  }, () => {}, () => {}, (row: number): void => { failed.push(row); });
  expect(failed).toEqual([1]);
});

test('import passes only admitted selections through the versioned write and confirms the report on exact readback', async () => {
  let selected: SourceImportCandidate[] = [];
  let present: unknown;
  const admitted: string[] = [];
  const failures = report(false);
  const runtime = {
    async loadOnlineJsonDocument(value: string) {
      admitted.push(value);
      return { text: 'document' };
    },
  };
  class ImportGateway {
    supportsEphemeralSourceCheck() { return true; }
    prepareGroupedSourceDocument() {
      return { items: [novel, audio], failures: [], filteredUnsupportedCount: 1 };
    }
    async loadSourceGroupCatalog() {
      return { groups: [{ groupId: 'reading', name: '阅读' }], revision: 9, memberships: [] };
    }
    async checkEphemeralSources(sources: SourceImportCandidate['bookSource'][], current: () => boolean,
      keyword: string, mode: string, levels: string[]) {
      expect(sources).toEqual([novel.bookSource]);
      expect(current()).toBe(true);
      expect([keyword, mode, levels]).toEqual(['我的', 'search', ['L1', 'L2']]);
      return [failures];
    }
    async importGroupedSources(items: SourceImportCandidate[], revision: number, strategy: string, target: object) {
      selected = items;
      expect([revision, strategy, target]).toEqual([9, 'all', { groupId: 'reading' }]);
      return { addedCount: 1, updatedCount: 0, failedCount: 0, failures: [], sourceIds: [novel.sourceId],
        results: [{ index: novel.index, status: 'imported' }] };
    }
    async readSourceDefinition(id: string) {
      expect(id).toBe(novel.sourceId);
      return { hasRawBookSource: true, sourceVersion: 'retained', text: JSON.stringify(novel.bookSource) };
    }
  }
  class RuleGateway {
    observeWrites() {}
    mutationSnapshot() { return { blocked: false, generation: 0, canRetryOriginal: false }; }
  }
  const flowClass = await transferFixture(ImportGateway, RuleGateway);
  let state: SourceV9TransferSnapshot | undefined;
  const flow = new flowClass(runtime, (next: SourceV9TransferSnapshot) => { state = next; },
    () => true, (accepted: unknown) => { present = accepted; });

  await flow.parseImport({ origin: 'url', url: 'https://127.0.0.1/p.json', paste: '' });
  expect(admitted).toEqual([]);
  expect(state?.importStep).toBe(1);
  await flow.parseImport({ origin: 'paste', url: '', paste: 'pasted' });
  expect(state?.importStep).toBe(2);
  await flow.checkImport({ mode: 'search', depth: 'L2', keyword: '我的' });
  expect(state?.rows.map(row => row.selected)).toEqual([false, false]);
  flow.chooseImportRow(audio.index, true);
  flow.chooseImportRow(novel.index, true);
  await flow.importSelected({ strategy: 'all', target: { groupId: 'reading' } });
  expect(selected).toEqual([novel]);
  expect(state?.importStep).toBe(3);
  expect(state?.importResult).toMatchObject({ addedCount: 1, updatedCount: 0, failedCount: 0, unsupportedCount: 1 });
  expect(present).toMatchObject([{ report: failures, sourceId: novel.sourceId, sourceVersion: 'retained' }]);
});

async function transferFixture(SourceGateway: object, RulesManagementGateway: object) {
  const [{ bookshelfOperationClass }, state, { isPrivateNetworkTarget }, { errorMessageOf }] = await Promise.all([
    import('./lib/bookshelf-operation-owner-probe.mjs'),
    import('../entry/src/main/ets/features/source/application/SourceV9TransferState'),
    import('../entry/src/main/ets/platform/network/HttpTransportPolicy'),
    import('../entry/src/main/ets/app/ErrorMessage'),
  ]);
  return bookshelfOperationClass('features/source/application/SourceV9TransferOwner.ts', 'SourceV9TransferOwner', {
    ...state, SourceGateway, RulesManagementGateway, isPrivateNetworkTarget, errorMessageOf,
    ReaderRuntimeOwner: { isCurrent: () => true }, url: { URL: { parseURL: (input: string) => new URL(input) } },
  });
}

test('subscription conflict overwrite reconciles the Core baseline from the original package and counts confirmed writes', async () => {
  const conflict = { ...novel, index: 1, sourceId: 'https://conflict.example', name: '本地已修改',
    bookSource: { bookSourceUrl: 'https://conflict.example', bookSourceName: '远端规则' } };
  const remote = [novel.bookSource, conflict.bookSource];
  const capturedVersion = 'a'.repeat(64);
  const sourceWrites: string[][] = [];
  const overwrites: string[][] = [];
  const actions: string[] = [];
  let matchingAfterWrite = false;
  let previewMatches = true;
  let fetches = 0;
  const digest = 'b'.repeat(64);
  const subscription = { id: 11, name: '书源订阅', type: 0, url: 'https://packages.example/source.json', autoUpdate: true, customOrder: 0, update: 0 };
  const runtime = {
    supportsCoreCapability: (capability: string) => capability === 'source.import.conditional.v1',
    async loadOnlineJsonDocument() {
      fetches++;
      return { text: JSON.stringify(remote) };
    },
  };
  class ImportGateway {
    supportsEphemeralSourceCheck() { return false; }
    prepareGroupedSourceDocument() { return { items: [novel, conflict], failures: [], filteredUnsupportedCount: 0 }; }
    async loadSources() { return [{ sourceId: conflict.sourceId, sourceVersion: capturedVersion }]; }
    async overwriteSubscriptionSource(id: string, raw: object, version: string) {
      expect(raw).toEqual(conflict.bookSource);
      actions.push('overwrite');
      overwrites.push([id, version]);
      matchingAfterWrite = previewMatches;
    }
  }
  class RuleGateway {
    observeWrites() {}
    mutationSnapshot() { return { blocked: false, generation: 0, canRetryOriginal: false }; }
    async listRuleSubscriptions() { return [subscription]; }
    async captureSourceSubscription(row: object) { return { subscription: row }; }
    async previewSourceSubscription(id: number, document: string, expected: object) {
      expect([id, JSON.parse(document), expected]).toEqual([11, remote, { subscription }]);
      actions.push('preview');
      return { subscriptionId: 11, expiresAt: Date.now() + 1000, remoteDigest: digest, changes: [
        { sourceId: novel.sourceId, name: novel.name, kind: 'added' },
        { sourceId: conflict.sourceId, name: conflict.name, kind: matchingAfterWrite ? 'unchanged' : 'conflict' },
      ] };
    }
    async applySourceSubscription(_plan: object, ids: string[]) {
      actions.push('apply:' + ids.length);
      sourceWrites.push(ids);
      return ids;
    }
  }
  const flowClass = await transferFixture(ImportGateway, RuleGateway);
  let state: SourceV9TransferSnapshot | undefined;
  const flow = new flowClass(runtime, (next: SourceV9TransferSnapshot) => { state = next; }, () => true, () => {});
  await flow.loadSubscriptions();
  await flow.previewSubscriptions([11]);
  await flow.applyReviews();
  expect(sourceWrites).toEqual([[novel.sourceId]]);
  expect(overwrites).toEqual([]);
  expect(state?.status).toBe('已确认应用 1 项');
  await flow.previewSubscriptions([11]);
  flow.selectReviewRow('11:' + novel.sourceId, false);
  flow.resolveReviewConflict('11:' + conflict.sourceId, true);
  await flow.applyReviews();
  expect(sourceWrites).toEqual([[novel.sourceId], []]);
  expect(overwrites).toEqual([[conflict.sourceId, capturedVersion]]);
  expect(actions).toEqual(['preview', 'apply:1', 'preview', 'overwrite', 'preview', 'apply:0']);
  expect(fetches).toBe(2);
  expect(state?.status).toBe('已确认应用 1 项');
  expect(state?.error).toBe('');

  matchingAfterWrite = false;
  previewMatches = false;
  await flow.previewSubscriptions([11]);
  flow.selectReviewRow('11:' + novel.sourceId, false);
  flow.resolveReviewConflict('11:' + conflict.sourceId, true);
  await flow.applyReviews();
  expect(overwrites).toHaveLength(2);
  expect(sourceWrites).toEqual([[novel.sourceId], []]);
  expect(actions.slice(-3)).toEqual(['preview', 'overwrite', 'preview']);
  expect(fetches).toBe(3);
  expect(state?.status).toBe('已确认应用 1 项');
  expect(state?.error).toMatch(/订阅基线/);
});
