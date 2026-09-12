import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, nextResolve) {
  try { return nextResolve(specifier, context); } catch (error) {
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && !specifier.endsWith('.ts'))
      return nextResolve(`${specifier}.ts`, context);
    throw error;
  }
} });
const { ReaderControlReplaceGateway, ReaderControlReplaceGatewayError, readerControlReplaceDraftParams } =
  await import('../entry/src/main/ets/features/reading/ReaderControlReplaceGateway.ts');
const { createReaderControlReplaceDraft } = await import('../entry/src/main/ets/features/reading/ReaderControlReplaceState.ts');
const rule = (id) => ({ id, order: id, name: `规则${id}`, pattern: 'old', replacement: 'new', group: 'g',
  scope: 'book', excludeScope: 'skip', scopeTitle: true, scopeSource: true, scopeContent: true,
  isEnabled: true, isRegex: false, timeoutMillisecond: 9000 });
let rows = [5, 2, 1, 4, 3].map(rule);
const calls = [];
let current = true;
let validationValid = true;
let duringValidation;
let duringPersist;
let persistError = false;
let badReceipt = false;
const runtime = { async request(method, params = {}, options = {}) {
  calls.push({ method, params: structuredClone(params), options });
  if (method === 'replace-rule.list') {
    assert.equal(typeof options.shouldCancel, 'function');
    return { data: { rules: structuredClone(rows) } };
  }
  if (method === 'replace.validate') {
    duringValidation?.();
    return { data: { valid: validationValid } };
  }
  if (method === 'replace.persist') {
    assert.equal(options.shouldCancel, undefined, 'a dispatched write cannot be canceled by panel lifetime');
    duringPersist?.();
    if (persistError) throw new Error('write may have committed, receipt lost');
    if (params.operation === 'delete') {
      rows = rows.filter(r => r.id !== params.params.id);
      return { data: { operation: 'delete', data: { id: params.params.id, deleted: !badReceipt } } };
    }
    const stored = params.operation === 'create' ? { id: 100, ...params.params } :
      { ...rows.find(r => r.id === params.params.id), ...params.params };
    rows = rows.filter(r => r.id !== stored.id).concat(stored);
    return { data: { operation: params.operation, data: { rule: badReceipt ? { ...stored, id: -99, name: 'wrong' } : stored } } };
  }
  if (method === 'replace.preview') return { data: { ...params, chapterTitle: 'chapter', before: 'old', after: 'new',
    changed: true, truncated: false, storedRuleCount: rows.length, enabledRuleCount: rows.length } };
  if (method === 'rule-bundle.export') return { data: { schemaVersion: 1, json: JSON.stringify({
    schemaVersion: 1, replaceRules: rows, dictRules: [{ secret: 'must not export this family' }],
    txtTocRules: [], ruleSubscriptions: [] }) } };
  if (method === 'rule-bundle.import') {
    assert.equal(options.shouldCancel, undefined);
    const bundle = JSON.parse(params.json);
    return { data: { schemaVersion: 1, replaceExisting: params.replaceExisting,
      counts: { replaceRules: bundle.replaceRules.length, dictRules: bundle.dictRules.length,
        txtTocRules: bundle.txtTocRules.length, ruleSubscriptions: bundle.ruleSubscriptions.length } } };
  }
  throw new Error(`unexpected Core method ${method}`);
} };
const gateway = new ReaderControlReplaceGateway(runtime);
const all = await gateway.loadRules(() => current);
assert.deepEqual(all.map(r => r.id), [1, 2, 3, 4, 5]);
assert.equal(all[0].scopeSource, true);
assert.deepEqual((await gateway.load()).rules.map(r => r.id), [1, 2, 3], 'legacy Quick facade stays bounded');
const original = all[0];
let draft = createReaderControlReplaceDraft(original);
assert.deepEqual(readerControlReplaceDraftParams(draft), { id: 1 });
let count = calls.length;
assert.equal((await gateway.save(draft)).changed, false);
assert.equal(calls.length, count, 'Core rejects no-op updates, so do not send them');
draft.name = 'renamed';
assert.deepEqual(readerControlReplaceDraftParams(draft), { id: 1, name: 'renamed' });
rows.find(r => r.id === 1).group = 'concurrent Core group';
const saved = await gateway.save(draft);
assert.equal(saved.rule.group, 'concurrent Core group', 'unchanged fields must not overwrite latest Core values');
assert.equal(saved.rule.scopeSource, true);
assert.equal(saved.rule.timeoutMillisecond, 9000);
assert.deepEqual(calls.find(c => c.method === 'replace.validate').params.scope, ['title', 'source', 'chapter']);
assert.equal((await gateway.toggle(saved.rule, false)).rule.isEnabled, false);
assert.equal(await gateway.deleteRule(5), 5);

validationValid = false;
count = calls.filter(c => c.method === 'replace.persist').length;
await assert.rejects(gateway.save(draft), /校验/);
assert.equal(calls.filter(c => c.method === 'replace.persist').length, count);
validationValid = true;
duringValidation = () => { current = false; };
await assert.rejects(gateway.save(draft, () => current), /过期/);
assert.equal(calls.filter(c => c.method === 'replace.persist').length, count);
duringValidation = undefined;
current = true;
duringPersist = () => { current = false; };
assert.equal((await gateway.save(draft, () => current)).rule.name, 'renamed',
  'confirmed real write still resolves after UI closure; Host separately protects presentation');
duringPersist = undefined;
current = true;
persistError = true;
await assert.rejects(gateway.save(draft), e => e instanceof ReaderControlReplaceGatewayError && e.writeUncertain);
persistError = false;
badReceipt = true;
await assert.rejects(gateway.save(draft), e => e.writeUncertain === true);
await assert.rejects(gateway.deleteRule(3), e => e.writeUncertain === true);
badReceipt = false;
draft.order = 2147483648;
await assert.rejects(gateway.save(draft), /数值/);

const preview = await gateway.preview('source', 'book', 4, 80);
assert.equal(preview.before, 'old');
assert.equal(preview.after, 'new');
assert.equal(calls.some(c => c.method === 'replace.apply'), false, 'preview never re-processes already rendered UI text');
await assert.rejects(gateway.preview('source', 'book', 4, 2049), /bounds/);
const exported = JSON.parse(await gateway.exportJson());
assert.equal(exported.replaceRules.length, rows.length);
assert.deepEqual(exported.dictRules, [], 'in-reader export must not disclose unrelated rule families');
assert.equal(exported.replaceRules[0].scopeSource, true);
await assert.rejects(gateway.importJson(JSON.stringify({ ...exported, dictRules: [{ name: 'other' }] })), /其他规则/);
const incoming = { schemaVersion: 1, replaceRules: [rule(21)], dictRules: [], txtTocRules: [], ruleSubscriptions: [] };
assert.equal(await gateway.importJson(JSON.stringify(incoming)), 1);
const importCall = calls.findLast(c => c.method === 'rule-bundle.import');
assert.equal(importCall.params.replaceExisting, false, 'never clear/replace other rule collections');
assert.deepEqual(JSON.parse(importCall.params.json), incoming);
count = calls.filter(c => c.method === 'rule-bundle.import').length;
await assert.rejects(gateway.importJson(JSON.stringify({ ...incoming, replaceRules: [rule(21), rule(21)] })), /duplicate/);
assert.equal(calls.filter(c => c.method === 'rule-bundle.import').length, count);
assert.equal(await gateway.importJson(JSON.stringify({ ...incoming, replaceRules: [] })), 0);
current = false;
await assert.rejects(gateway.loadRules(() => current), /过期/);
await assert.rejects(gateway.importJson(JSON.stringify(incoming), () => current), /过期/);
console.log('PASS reader-control-replace-gateway: real production requests, all rules, lossless partial CRUD, guards, receipts, preview and replace-only bundle');
