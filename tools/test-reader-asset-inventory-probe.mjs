import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
const source = readFileSync(new URL('../entry/src/main/ets/app/ReaderAssetInventoryProbe.ts', import.meta.url), 'utf8');
const compiled = stripTypeScriptTypes(source.replace(/^import[\s\S]*?;\n/gm, '').replace(/^export /gm, ''));
const prefix = 'reader.webdav.config-save.';
const uuid = n => `00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;
const tag = { ALIAS: 1, RETURN_TYPE: 2, RETURN_LIMIT: 3, RETURN_OFFSET: 4, SECRET: 5 };
function attributes(alias) {
  const row = new Map([[tag.ALIAS, new TextEncoder().encode(alias)]]);
  const get = row.get.bind(row);
  row.get = key => { assert.notEqual(key, tag.SECRET, 'never reads plaintext even if a broken platform returns it'); return get(key); };
  return row;
}
function fixture({ rows = [], reply, loggingThrows = false } = {}) {
  const calls = [], samples = []; let live = true, clock = 0;
  const sdk = { Tag: tag, ReturnType: { ATTRIBUTES: 1 },
    async query(query) {
      assert.deepEqual([...query.keys()].sort(), [tag.RETURN_TYPE, tag.RETURN_LIMIT, tag.RETURN_OFFSET].sort());
      assert.equal(query.get(tag.RETURN_TYPE), sdk.ReturnType.ATTRIBUTES);
      assert.ok(query.get(tag.RETURN_LIMIT) > 0 && query.get(tag.RETURN_LIMIT) <= 64);
      calls.push(query);
      if (reply) return reply(query, calls.length, () => { live = false; });
      return rows.slice(query.get(tag.RETURN_OFFSET), query.get(tag.RETURN_OFFSET) + query.get(tag.RETURN_LIMIT));
    },
    add() { assert.fail('read-only inventory cannot create an Asset'); },
    remove() { assert.fail('read-only inventory cannot clean up orphans'); },
    update() { assert.fail('read-only inventory cannot update credentials'); },
  };
  const probe = new Function('asset', 'util', compiled + '; return probeReaderAssetInventory;')(sdk,
    { TextDecoder: { create: (...args) => { const d = new TextDecoder(...args); return { decodeToString: v => d.decode(v) }; } } });
  const run = (...args) => {
    const [debug, mode, requested, current] = args.length ? args : [true, 'debug', true];
    return probe(debug, mode, requested, current ?? (() => live), () => ++clock,
      sample => { samples.push(sample); if (loggingThrows) throw Error('log delivery failed'); });
  };
  return { calls, samples, run };
}
for (const args of [[false, 'debug', true], [true, 'release', true], [true, 'debug', 'true'],
  [true, 'debug', 1], [true, 'debug', null], [true, 'debug', undefined], [true, 'debug', true, () => false],
  [true, 'debug', true, () => { throw Error('retired owner'); }]]) {
  const f = fixture(); await f.run(...args); assert.equal(f.calls.length, 0); assert.equal(f.samples.length, 0);
}
{
  const rows = [attributes('reader.webdav.config.v2'), ...Array.from({ length: 129 }, (_, i) => attributes(prefix + uuid(i))),
    attributes('another-app-metadata')];
  const f = fixture({ rows }); await f.run();
  assert.equal(f.calls.length, 6, 'actual multi-page offsets in both scans');
  assert.deepEqual(f.calls.map(q => q.get(tag.RETURN_OFFSET)), [0, 64, 128, 0, 64, 128]);
  assert.equal(f.samples.length, 1); const sample = f.samples[0];
  assert.equal(sample.status, 'observed'); assert.equal(sample.readerConfigAliases, 130);
  assert.equal(sample.legacyAliases, 1); assert.equal(sample.immutableAliases, 129); assert.equal(sample.otherReaderAliases, 0);
  assert.equal(sample.secretBytes, 'unknown');
  assert.ok(sample.aliasMetadataBytes > 0);
  assert.ok(!JSON.stringify(sample).includes(prefix)); assert.ok(!JSON.stringify(sample).includes(uuid(0)));
  assert.ok(!JSON.stringify(sample).includes('another-app-metadata'));
}
{
  const f = fixture({ reply: (_query, count) => [attributes(prefix + uuid(count))] }); await f.run();
  assert.equal(f.samples[0].reason, 'changed', 'same alias count with different identity cannot claim stable inventory');
  assert.equal(f.samples[0].status, 'unverified');
}
{
  const f = fixture({ rows: [attributes(prefix + 'unexpected-name')] }); await f.run();
  assert.equal(f.samples[0].otherReaderAliases, 1, 'nonstandard prefix record remains counted; never silently excluded as orphan');
}
for (const rows of [[new Map()], [attributes(prefix + uuid(1)), attributes(prefix + uuid(1))],
  Array.from({ length: 65 }, () => attributes('unrelated'))]) {
  const f = fixture({ reply: () => rows }); await f.run(); assert.equal(f.samples[0].reason, 'malformed');
  assert.equal(f.samples[0].status, 'unverified');
}
{
  const f = fixture({ rows: Array.from({ length: 4096 }, (_, i) => attributes(prefix + uuid(i))) }); await f.run();
  assert.equal(f.calls.length, 64); assert.equal(f.samples[0].reason, 'capped');
  assert.equal(f.samples[0].readerConfigAliases, 4096); assert.equal(f.samples[0].status, 'unverified');
}
{
  const f = fixture({ reply: () => { throw { code: 24000017, message: 'PRIVATE platform payload' }; } }); await f.run();
  assert.equal(f.samples[0].reason, 'platform'); assert.equal(f.samples[0].errorCode, 24000017);
  assert.equal(f.samples[0].queries, 1); assert.equal(f.samples[0].status, 'unverified');
  assert.ok(!JSON.stringify(f.samples).includes('PRIVATE'));
}
{
  const f = fixture({ reply: async (_q, _c, retire) => { retire(); return [attributes(prefix + uuid(1))]; } });
  await f.run(); assert.equal(f.calls.length, 1); assert.equal(f.samples.length, 0, 'late old native scan cannot publish into new owner');
}
{
  const f = fixture({ loggingThrows: true }); await f.run(); assert.equal(f.calls.length, 2);
  assert.equal(f.samples[0].status, 'observed');
}
const ability = readFileSync(new URL('../entry/src/main/ets/entryability/EntryAbility.ets', import.meta.url), 'utf8');
assert.match(ability, /DEBUG === true && BUILD_MODE_NAME === 'debug' && want\.parameters\?\.readerAssetInventoryProbe === true/);
assert.match(ability, /ReaderRuntimeOwner\.isCurrent\(owner\), readerMotionNowMs/);
const warm = ability.slice(ability.indexOf('  onNewWant('), ability.indexOf('  private async prepareSelectedReadingFont'));
assert.ok(!warm.includes('probeReaderAssetInventory'), 'warm external file Wants cannot start inventory');
console.log('PASS actual metadata-only inventory: opt-in/current owner, multi-page/two-scan identity, cap/race/malformed/platform failure, zero secret/mutation/logged identity. Target enumeration, persistence and orphan qualification remain separate.');
