import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, nextResolve) {
  try { return nextResolve(specifier, context); } catch (error) {
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && !specifier.endsWith('.ts'))
      return nextResolve(`${specifier}.ts`, context);
    throw error;
  }
} });
const { readerReplaceSdkFixture, readerControlReplaceDraftParams } = await import('./lib/reader-replace-legacy-sdk-probe.mjs');
const actualSdk = await readerReplaceSdkFixture();
const ReaderControlReplaceGateway = actualSdk.Full, ReaderControlReplaceGatewayError = actualSdk.FullError;
const { createReaderControlReplaceDraft } = await import('../entry/src/main/ets/features/reading/ReaderControlReplaceState.ts');
const { BookRequestNotDispatchedError } = await import('../entry/src/main/ets/app/BookRequestScheduler.ts');
const rule = (id) => ({ id, order: id, name: `规则${id}`, pattern: 'old', replacement: 'new', group: 'g',
  scope: 'book', excludeScope: 'skip', scopeTitle: true, scopeSource: true, scopeContent: true,
  isEnabled: true, isRegex: false, timeoutMillisecond: 9000 });
// Actual SDK-emitted full Owner/Gateway, AtomicFile seam and cold SQLite Core.
// Only controlled protocol observations/lost replies are injected; no rule
// persistence, identity, receipt or mutation algorithm is copied into the test.
for (let id = 1; id <= 5; id++) {
  const seed = { ...rule(id) }; delete seed.id;
  await actualSdk.command('replace.persist', { operation: 'create', params: seed });
}
await actualSdk.command('dict-rule.put', { name: 'unrelated', urlRule: 'https://dict.invalid/{{key}}', showRule: '$.definition', enabled: true, sortNumber: 0 });
const calls = [];
let current = true;
let validationValid = true;
let duringValidation;
let duringPersist;
let persistError = false;
let badReceipt = false;
let duringStartup;
const runtime = actualSdk.runtime;
const actualRequest = runtime.request.bind(runtime);
runtime.request = async (method, params = {}, options = {}) => {
  const mutation = method === 'rules.mutation.apply' ? params.mutation : undefined;
  calls.push({ method: mutation?.method ?? method, params: structuredClone(mutation?.params ?? params), options });
  if (mutation !== undefined) {
    duringStartup?.();
    assert.equal(options.shouldCancel, undefined, 'a dispatched write cannot be canceled by panel lifetime');
  }
  const result = method === 'replace.preview' ? { data: { ...params, chapterTitle: 'chapter', before: 'old', after: 'new', changed: true, truncated: false, storedRuleCount: 3, enabledRuleCount: 3 } } : await actualRequest(method, params, options);
  if (method === 'replace-rule.list') {
    assert.equal(typeof options.shouldCancel, 'function');
    return { ...result, data: { ...result.data, rules: result.data.rules.slice().reverse() } };
  }
  if (method === 'replace.validate') {
    duringValidation?.();
    return validationValid ? result : { ...result, data: { ...result.data, valid: false } };
  }
  if (method === 'replace.preview') return { ...result, data: { ...result.data, before: 'old', after: 'new' } };
  if (mutation !== undefined) {
    duringPersist?.();
    if (persistError) throw new Error('actual SQLite write committed, reply lost');
    if (badReceipt) {
      const data = structuredClone(result.data);
      if (mutation.params.operation === 'delete') data.receipt.data.data.deleted = false;
      else data.receipt.data.data.rule = { ...data.receipt.data.data.rule, id: -99, name: 'wrong' };
      return { ...result, data };
    }
  }
  return result;
};
let gateway = new ReaderControlReplaceGateway(runtime);
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
await actualSdk.command('replace.persist', { operation: 'update', params: { id: 1, group: 'concurrent Core group' } });
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
draft.name = 'renamed-after-close';
assert.equal((await gateway.save(draft, () => current)).rule.name, 'renamed-after-close',
  'confirmed real write still resolves after UI closure; Host separately protects presentation');
duringPersist = undefined;
current = true;
persistError = true;
draft.name = 'lost-original-reply';
await assert.rejects(gateway.save(draft), e => e instanceof ReaderControlReplaceGatewayError && e.writeUncertain);
persistError = false;
const writesBeforeReplacement = actualSdk.writes().length;
await assert.rejects(new ReaderControlReplaceGateway(runtime).save(draft), e => e.writeUncertain);
assert.equal(actualSdk.writes().length, writesBeforeReplacement, 'warm Gateway replacement cannot bypass original unknown');
await gateway.recoverMutation(() => true);
assert.equal(actualSdk.owner.snapshot().confirmation, 'confirmed');
gateway = new ReaderControlReplaceGateway(runtime);
badReceipt = true;
draft.name = 'malformed-original-reply';
await assert.rejects(gateway.save(draft), e => e.writeUncertain === true);
badReceipt = false;
await gateway.recoverMutation(() => true);
badReceipt = true;
gateway = new ReaderControlReplaceGateway(runtime);
await assert.rejects(gateway.deleteRule(3), e => e.writeUncertain === true);
badReceipt = false;
await gateway.recoverMutation(() => true);
gateway = new ReaderControlReplaceGateway(runtime);
// Actual startup/final-admission rejection: reaching the RPC wrapper is not
// execution. The cold SQLite lineage and rule remain unchanged and intent is
// cleared only by the existing branded nondispatch evidence.
const headBeforeRetirement = (await actualSdk.command('rules.mutation.query')).data.head;
draft.name = 'retired-before-native-send';
duringStartup = () => { current = false; };
await assert.rejects(gateway.save(draft, () => current), e => e.writeUncertain === false);
assert.deepEqual((await actualSdk.command('rules.mutation.query')).data.head, headBeforeRetirement);
assert.equal(actualSdk.owner.snapshot().confirmation, 'undispatched');
assert.equal(actualSdk.disk(), '');
duringStartup = undefined; current = true;
draft.order = 2147483648;
await assert.rejects(gateway.save(draft), /数值/);

const preview = await gateway.preview('source', 'book', 4, 80);
assert.equal(preview.before, 'old');
assert.equal(preview.after, 'new');
assert.equal(calls.some(c => c.method === 'replace.apply'), false, 'preview never re-processes already rendered UI text');
await assert.rejects(gateway.preview('source', 'book', 4, 2049), /bounds/);
const exported = JSON.parse(await gateway.exportJson());
assert.equal(exported.replaceRules.length, (await actualSdk.command('replace-rule.list')).data.rules.length);
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
assert.ok(actualSdk.writes().every(call => call.method === 'rules.mutation.apply'), 'all actual writes retain the complete typed exact-receipt envelope');
console.log('PASS reader-control-replace-gateway: actual full SDK Owner/Gateway/Atomic IO/cold SQLite requests, all rules, lossless partial CRUD, guards, receipts, preview and replace-only bundle');
