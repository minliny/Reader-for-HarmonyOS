import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { ReaderControlReplacePanel, type ReaderControlReplacePanelGateway } from
  '../../entry/src/main/ets/features/reading/presentation/ReaderControlReplacePanel.ts';
import { createReaderControlReplaceDraft, createReaderControlReplaceState } from
  '../../entry/src/main/ets/features/reading/presentation/ReaderControlReplaceState.ts';
import type { RulesMutationSnapshot } from '../../entry/src/main/ets/features/settings/application/RulesMutationOwner.ts';
import type { ReaderReplaceRule } from '../../entry/src/main/ets/features/reading/application/ReaderReplaceQuickState.ts';
import type { ReadingSessionChapter } from '../../entry/src/main/ets/features/reading/application/ReadingChapterWindow.ts';
import type { ReaderReplacePreview } from '../../entry/src/main/ets/features/reading/application/ReaderReplaceQuickGateway.ts';

class UncertainReply extends Error {}

const baseRule: ReaderReplaceRule = { id: 10, name: 'Rule', pattern: 'a', replacement: 'b', scopeTitle: false,
  scopeContent: true, isEnabled: true, isRegex: false, timeoutMillisecond: 30, order: 0 };
const chapter: ReadingSessionChapter = { sourceId: 'remote', bookId: 'book', chapterIndex: 9, chapterTitle: 'Chapter',
  chapterUrl: undefined, content: '', images: [], contentVersion: 'body', extractionVia: 'rule' };

function fixture() {
  const calls: string[] = [];
  const facts: RulesMutationSnapshot = { generation: 0, busy: false, confirmation: 'undispatched',
    label: '', method: '', message: '', blocked: false, canRetryOriginal: false, writeStage: 'intent' };
  const active = { lifecycleToken: 4, sourceId: 'remote', bookId: 'book', mounted: true, runtime: true,
    selection: 13, panel: true, input: true, identity: 'minimum', chapter };
  const initial = Promise.withResolvers<() => boolean>();
  let state = createReaderControlReplaceState();
  let recovery = { message: '', visible: false, canRetry: false, generation: 0 };
  const gateway: ReaderControlReplacePanelGateway = {
    recoverMutation: async (current, retry) => { assert.equal(current(), true); calls.push(`recover:${retry}`); return facts; },
    loadRules: async current => { assert.equal(current(), true); calls.push('list'); return [baseRule]; },
    save: async (_draft, current) => {
      assert.equal(current(), true);
      calls.push('save');
      return { rule: { ...baseRule, name: 'Edited' }, changed: true };
    },
    toggle: async (rule, enabled, current) => {
      assert.equal(current(), true);
      calls.push('toggle');
      return { rule: { ...rule, isEnabled: enabled }, changed: rule.isEnabled !== enabled };
    },
    deleteRule: async (ruleId, current) => { assert.equal(current(), true); calls.push('delete'); return ruleId; },
    preview: async () => assert.fail('preview fixture needs explicit data'),
    importJson: async (json, current) => { assert.equal(current(), true); calls.push(`import:${json}`); return 1; },
    exportJson: async current => { assert.equal(current(), true); calls.push('export'); return 'exported rules'; },
  };
  const owner = new ReaderControlReplacePanel({ snapshot: () => ({ ...facts }) }, gateway, {
    readState: () => state,
    publishState: next => { state = next; },
    recovery: () => recovery,
    publishRecovery: next => { recovery = next; },
    panelOpen: () => active.panel,
    committedPresentationIdentity: () => active.identity,
    controlInputEnabled: () => active.input,
  }, {
    session: () => ({ lifecycleToken: active.lifecycleToken, bookId: active.bookId, sourceId: active.sourceId }),
    sessionActive: lifecycle => active.mounted && lifecycle === active.lifecycleToken,
    runtimeCurrent: () => active.runtime,
    chapter: () => active.chapter,
    selectionToken: () => active.selection,
    selectionActive: (lifecycle, selection) => lifecycle === active.lifecycleToken && selection === active.selection,
    persistPosition: () => { calls.push('persist'); return initial.promise; },
    reloadContent: (lifecycle, book) => { calls.push(`reload-content:${lifecycle}:${book}`); },
  }, error => error instanceof UncertainReply);
  const original = (id: string) => {
    facts.confirmation = 'unknown';
    facts.operationId = id;
    facts.blocked = true;
    facts.canRetryOriginal = true;
    facts.message = 'reply missing';
  };
  const ready = async () => {
    owner.open(() => 'Book');
    await owner.reload();
    calls.length = 0;
  };
  return { calls, active, facts, original, initial, gateway, owner, ready, state: () => state, recovery: () => recovery };
}

test('minimum preparation claims one load per committed geometry and panel generation', async () => {
  const reader = fixture();
  assert.equal(reader.state().sessionKey, '');
  reader.owner.open(() => 'Book');
  reader.owner.prepare('minimum');
  reader.owner.prepare('minimum');
  await setImmediate();
  assert.deepEqual(reader.calls, ['recover:false', 'list']);
  assert.equal(reader.state().sessionKey, 'remote:book:4');
  assert.equal(reader.state().defaultScope, 'Book;remote');
  assert.equal(reader.state().status, 'ready');
  reader.active.identity = 'next minimum';
  reader.owner.prepare(reader.active.identity);
  await setImmediate();
  assert.deepEqual(reader.calls, ['recover:false', 'list', 'recover:false', 'list']);
});

test('only an explicit matching original receipt can retry recovery, then read and re-materialize content', async () => {
  const reader = fixture();
  reader.original('operation');
  reader.owner.open(() => 'Book');
  assert.equal(reader.owner.recoveryCurrent(reader.recovery().generation), true);
  assert.equal(reader.state().writeUncertain, true);
  await reader.owner.reload(true, 'foreign');
  await reader.owner.reload(true);
  assert.deepEqual(reader.calls, []);
  reader.gateway.recoverMutation = async (current, retry) => {
    assert.equal(current(), true);
    assert.equal(retry, true);
    reader.calls.push('recover-original');
    Object.assign(reader.facts, { blocked: false, confirmation: 'confirmed', canRetryOriginal: false });
    return reader.facts;
  };
  await reader.owner.reload(true, 'operation');
  assert.deepEqual(reader.calls, ['recover-original', 'list', 'reload-content:4:book']);
  assert.equal(reader.state().status, 'ready');
  assert.equal(reader.state().writeUncertain, false);
  assert.equal(reader.state().canonicalReloadRequired, false);
  assert.equal(reader.owner.recoveryCurrent(reader.recovery().generation), false);
});

test('retired panel read and replaced rule-list ticket cannot publish late replies', async () => {
  const reader = fixture();
  const early = Promise.withResolvers<ReaderReplaceRule[]>();
  const late = Promise.withResolvers<ReaderReplaceRule[]>();
  const guards: Array<() => boolean> = [];
  reader.gateway.loadRules = current => { guards.push(current); return guards.length === 1 ? early.promise : late.promise; };
  reader.owner.open(() => 'Book');
  const first = reader.owner.reload();
  await setImmediate();
  reader.owner.open(() => 'Book');
  const second = reader.owner.reload();
  await setImmediate();
  assert.equal(guards[0](), false);
  assert.equal(guards[1](), true);
  early.resolve([{ ...baseRule, id: 11 }]);
  await first;
  assert.deepEqual(reader.state().rules, []);
  late.resolve([baseRule]);
  await second;
  assert.deepEqual(reader.state().rules, [baseRule]);
});

test('a write requires the position barrier and the exact still-open panel before dispatch', async () => {
  const reader = fixture();
  await reader.ready();
  const save = reader.owner.save(createReaderControlReplaceDraft(baseRule));
  assert.deepEqual(reader.calls, ['persist']);
  reader.active.panel = false;
  reader.owner.advancePanel();
  reader.initial.resolve(() => true);
  await assert.rejects(save, /READING_CONTENT_MUTATION_SUPERSEDED/);
  assert.deepEqual(reader.calls, ['persist']);
  assert.equal(reader.state().mutationPending, false);
});

test('an accepted write retains its book/session after the panel closes and reloads the original page once', async () => {
  const reader = fixture();
  await reader.ready();
  const result = Promise.withResolvers<{ rule: ReaderReplaceRule; changed: boolean }>();
  reader.gateway.save = (_draft, current) => {
    assert.equal(current(), true);
    reader.calls.push('dispatch');
    return result.promise;
  };
  reader.initial.resolve(() => true);
  const save = reader.owner.save(createReaderControlReplaceDraft(baseRule));
  await setImmediate();
  await assert.rejects(reader.owner.delete(baseRule), /请先完成或重新核对当前替换规则操作/);
  reader.active.panel = false;
  reader.owner.advancePanel();
  result.resolve({ rule: { ...baseRule, name: 'Accepted' }, changed: true });
  await save;
  assert.deepEqual(reader.calls, ['persist', 'dispatch', 'reload-content:4:book']);
  assert.equal(reader.state().rules[0].name, 'Accepted');
});

test('a lost write acknowledgement projects only the original receipt and keeps writes blocked', async () => {
  const reader = fixture();
  await reader.ready();
  reader.initial.resolve(() => true);
  reader.gateway.deleteRule = async (_rule, current) => {
    assert.equal(current(), true);
    reader.original('lost operation');
    throw new UncertainReply('unconfirmed');
  };
  await assert.rejects(reader.owner.delete(baseRule), /unconfirmed/);
  assert.deepEqual(reader.calls, ['persist', 'reload-content:4:book']);
  assert.equal(reader.state().writeOperationId, 'lost operation');
  assert.equal(reader.state().writeUncertain, true);
  assert.equal(reader.state().writeBlocked, true);
  assert.equal(reader.owner.recoveryCurrent(reader.recovery().generation), true);
  reader.facts.operationId = 'different operation';
  assert.equal(reader.owner.recoveryCurrent(reader.recovery().generation), false);
  await assert.rejects(reader.owner.toggle(baseRule, false), /reply missing/);
});

test('a changed book/session cannot receive the spent write result or its page refresh', async () => {
  const reader = fixture();
  await reader.ready();
  const result = Promise.withResolvers<{ rule: ReaderReplaceRule; changed: boolean }>();
  reader.gateway.toggle = () => result.promise;
  reader.initial.resolve(() => true);
  const toggle = reader.owner.toggle(baseRule, false);
  await setImmediate();
  reader.active.bookId = 'other';
  reader.active.lifecycleToken += 1;
  reader.owner.advancePanel();
  reader.owner.invalidateMutation();
  reader.owner.open(() => 'Another Book');
  await reader.owner.reload();
  result.resolve({ rule: { ...baseRule, isEnabled: false }, changed: true });
  await toggle;
  assert.equal(reader.calls.some(call => call.startsWith('reload-content:')), false);
  assert.deepEqual(reader.state().rules, [baseRule]);
});

test('cold picker results require their original panel, accepted imports reread the same-book new opening', async () => {
  const reader = fixture();
  await reader.ready();
  const picked = Promise.withResolvers<{ fileName: string; text: string }>();
  const first = reader.owner.importBundle(() => picked.promise);
  reader.owner.open(() => 'Book');
  picked.resolve({ fileName: 'rules.json', text: 'retired picker' });
  await assert.rejects(first, /导入选择已过期/);
  const write = Promise.withResolvers<number>();
  reader.gateway.importJson = (text, current) => {
    assert.equal(text, 'selected rules');
    assert.equal(current(), true);
    reader.calls.push('import');
    return write.promise;
  };
  reader.initial.resolve(() => true);
  const current = reader.owner.importBundle(async () => ({ fileName: 'rules.json', text: 'selected rules' }));
  await setImmediate();
  reader.owner.open(() => 'Book');
  write.resolve(1);
  await current;
  assert.deepEqual(reader.calls, ['persist', 'import', 'reload-content:4:book', 'recover:false', 'list']);
  assert.equal(reader.state().canonicalReloadRequired, false);
});

test('preview and export retain the actual chapter/selection and control-input prerequisites', async () => {
  const reader = fixture();
  await reader.ready();
  const preview = Promise.withResolvers<ReaderReplacePreview>();
  reader.gateway.preview = (source, book, index) => {
    assert.deepEqual([source, book, index], ['remote', 'book', 9]);
    return preview.promise;
  };
  const reading = reader.owner.preview();
  reader.active.chapter = { ...chapter };
  preview.resolve({ sourceId: 'remote', bookId: 'book', chapterIndex: 9, chapterTitle: 'Chapter', before: '', after: '',
    changed: false, truncated: false, storedRuleCount: 1, enabledRuleCount: 1 });
  await assert.rejects(reading, /替换预览已过期/);
  const exporting = reader.owner.exportBundle(async () => assert.fail('retired control cannot open save'));
  reader.active.input = false;
  await exporting;
  assert.deepEqual(reader.calls, ['export']);
});
