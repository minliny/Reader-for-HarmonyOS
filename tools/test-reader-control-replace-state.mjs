import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, nextResolve) {
  try { return nextResolve(specifier, context); } catch (error) {
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && !specifier.endsWith('.ts'))
      return nextResolve(`${specifier}.ts`, context);
    throw error;
  }
} });
const s = await import('../entry/src/main/ets/features/reading/ReaderControlReplaceState.ts');
const { createReaderReplaceQuickState } = await import('../entry/src/main/ets/features/reading/ReaderReplaceQuickState.ts');
const rule = (id, order = id) => ({ id, order, name: `规则${id}`, pattern: 'old', replacement: 'new',
  group: 'g', scope: 'book', excludeScope: 'excluded', scopeTitle: true, scopeSource: true,
  scopeContent: true, isEnabled: true, isRegex: false, timeoutMillisecond: 9000 });
const source = Array.from({ length: 50 }, (_, i) => rule(50 - i));
let state = s.beginReaderControlReplaceLoad(s.createReaderControlReplaceState('A:open1'));
const oldRead = s.readerControlReplaceTicket(state);
state = s.admitReaderControlReplaceLoad(state, oldRead, source);
assert.equal(state.rules.length, 50, 'Full canonical state must never receive a three-row DTO');
assert.deepEqual(state.rules.map(r => r.id), Array.from({ length: 50 }, (_, i) => i + 1));
assert.equal(source[0].id, 50);
assert.notEqual(state.rules[0], source[49]);
assert.equal(state.rules[0].scopeSource, true);
assert.deepEqual(createReaderReplaceQuickState(state.rules).rules.map(r => r.id), [1, 2, 3]);
assert.equal(state.rules.length, 50);
assert.throws(() => s.orderedReaderControlReplaceRules([rule(1), rule(1)]), /duplicate/);
assert.deepEqual(s.orderedReaderControlReplaceRules([rule(2, 0), rule(1, 0)]).map(r => r.id), [1, 2]);

const previous = state;
state = s.beginReaderControlReplaceMutation(state);
const mutation = s.readerControlReplaceTicket(state);
assert.throws(() => s.beginReaderControlReplaceMutation(state));
assert.throws(() => s.beginReaderControlReplaceLoad(state));
assert.strictEqual(s.admitReaderControlReplaceLoad(state, oldRead, []), state, 'older list cannot overwrite CRUD');
state = s.admitReaderControlReplaceRule(state, mutation, { ...rule(45), name: 'changed' });
assert.equal(state.rules.length, 50);
assert.equal(state.rules[44].name, 'changed', 'offscreen rule can be updated');
assert.equal(previous.rules[44].name, '规则45', 'no optimistic mutation of old array');
state = s.beginReaderControlReplaceMutation(state);
state = s.admitReaderControlReplaceDeletion(state, s.readerControlReplaceTicket(state), 45);
assert.equal(state.rules.length, 49);
assert.equal(state.rules.some(r => r.id === 45), false);

state = s.beginReaderControlReplaceMutation(state);
state = s.failReaderControlReplaceRequest(state, s.readerControlReplaceTicket(state), 'write timeout', true);
assert.equal(state.writeUncertain, true);
assert.equal(state.rules.length, 49, 'uncertainty retains observed rows, not invented rollback');
assert.throws(() => s.beginReaderControlReplaceMutation(state));
state = s.beginReaderControlReplaceLoad(state);
state = s.failReaderControlReplaceRequest(state, s.readerControlReplaceTicket(state), 'read failed');
assert.equal(state.writeUncertain, true, 'a failed reconciliation read cannot authorize another create');
assert.throws(() => s.beginReaderControlReplaceMutation(state));
state = s.beginReaderControlReplaceLoad(state);
state = s.admitReaderControlReplaceLoad(state, s.readerControlReplaceTicket(state), [rule(91)]);
assert.equal(state.writeUncertain, false, 'fresh canonical facts can be reviewed before a new explicit action');

state = s.beginReaderControlReplaceMutation(state);
state = s.admitReaderControlReplaceImport(state, s.readerControlReplaceTicket(state));
assert.equal(state.mutationPending, false);
assert.equal(state.status, 'idle');
assert.equal(state.canonicalReloadRequired, true);
assert.equal(state.writeUncertain, false, 'import receipt is confirmed; missing post-import list is a distinct state');
assert.throws(() => s.beginReaderControlReplaceMutation(state), /核对/);
state = s.beginReaderControlReplaceLoad(state);
state = s.failReaderControlReplaceRequest(state, s.readerControlReplaceTicket(state), 'post-import read failed');
assert.equal(state.rules.length, 1, 'retain prior observed rows without claiming they are current');
assert.equal(state.status, 'error');
assert.equal(state.canonicalReloadRequired, true);
assert.equal(state.writeUncertain, false);
assert.throws(() => s.beginReaderControlReplaceMutation(state), /核对/);
state = s.beginReaderControlReplaceLoad(state);
state = s.admitReaderControlReplaceLoad(state, s.readerControlReplaceTicket(state), []);
assert.equal(state.status, 'ready');
assert.equal(state.canonicalReloadRequired, false);
assert.deepEqual(state.rules, [], 'confirmed empty remains ready and supports Add');

const staleA = s.readerControlReplaceTicket(state);
let b = s.createReaderControlReplaceState('B:open2');
let newA = s.createReaderControlReplaceState('A:open3');
for (const current of [b, newA]) {
  assert.strictEqual(s.admitReaderControlReplaceRule(current, staleA, rule(2)), current);
  assert.strictEqual(s.failReaderControlReplaceRequest(current, staleA, 'old failure', true), current);
  assert.strictEqual(s.admitReaderControlReplaceImport(current, staleA), current);
}
const draft = s.createReaderControlReplaceDraft(rule(3));
assert.equal(draft.scopeSource, true);
draft.original.name = 'local snapshot';
assert.equal(source.find(r => r.id === 3).name, '规则3');
console.log('PASS reader-control-replace-state: canonical all rows, partial/full guards, uncertainty, import and stale sessions');
