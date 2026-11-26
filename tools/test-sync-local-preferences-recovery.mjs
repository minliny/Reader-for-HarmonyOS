import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { ReaderWriteEvidence } from '../entry/src/main/ets/app/ReaderWriteEvidence.ts';
import { recordContractCasePass, selectContractCases } from './lib/contract-case-selection.mjs';

const definitions = {
  'unqualified-cache': { description: 'WebDAV local receipts and bookshelf mode reopen persistent data after uncertain preference writes', resources: [] },
  'credential-digest': { description: 'WebDAV secure configuration rejects failures at any digest stage before writing the original intent', resources: [] },
};
const source = readFileSync(new URL('../entry/src/main/ets/features/sync/application/WebDavCredentialStore.ts', import.meta.url), 'utf8');
const production = stripTypeScriptTypes(source.replace(/^import[\s\S]*?from ['"][^'"]+['"];\n/gm, '').replace(/^export /gm, ''));
const restore = { version: 1, operationId: 'restore-fixture-1', checksum: 'b'.repeat(64) };
const backup = { version: 1, operationId: 'webdav-' + 'c'.repeat(32), phase: 'mayDispatch' };

function fixture() {
  const state = {
    durable: new Map([['bookshelfViewMode', 'cover'], ['bookshelfConfigVersion', 1]]),
    cache: undefined, failFlush: undefined, failCompensation: false, failReload: false, reloads: 0,
    digestStage: '', intentWrites: 0,
  };
  const preferences = {
    async getPreferences() {
      if (state.cache !== undefined) return state.cache;
      const data = new Map(state.durable);
      state.cache = {
        async has(key) { return data.has(key); },
        async get(key, fallback) { return data.get(key) ?? fallback; },
        async put(key, value) {
          if (state.failCompensation) throw new Error('compensation put failed');
          data.set(key, value);
        },
        async delete(key) { data.delete(key); },
        async flush() {
          const fail = state.failFlush;
          state.failFlush = undefined;
          if (fail !== 'before') state.durable = new Map(data);
          if (fail !== undefined) {
            state.failCompensation = true;
            throw new Error('original flush failed');
          }
        },
      };
      return state.cache;
    },
    async removePreferencesFromCache() {
      state.reloads += 1;
      if (state.failReload) throw new Error('persistent read not yet available');
      state.cache = undefined;
      state.failCompensation = false;
    },
  };
  const unavailable = () => new Error('digest capability unavailable');
  const cryptoFramework = { createMd() {
    if (state.digestStage === 'create') throw unavailable();
    return {
      async update() { if (state.digestStage === 'update') throw unavailable(); },
      async digest() { if (state.digestStage === 'digest') throw unavailable(); return { data: new Uint8Array(32) }; },
    };
  } };
  const fileIo = { async readText() { throw Object.assign(new Error('missing'), { code: 13900002 }); } };
  const Store = new Function('preferences', 'readerHostPreferencesName', 'DEFAULT_BOOKSHELF_VIEW', 'cryptoFramework', 'fileIo',
    'readerHostFilesDirectory', 'replaceReaderAtomicSnapshot', 'util', production + '; return WebDavCredentialStore;')(
    preferences, (_files, name) => name, 'list', cryptoFramework, fileIo, directory => directory,
    async () => { state.intentWrites += 1; }, { TextEncoder: class { encodeInto(value) { return new TextEncoder().encode(value); } } });
  const store = new Store();
  store.attachContext({ filesDir: '/sync-preferences-fixture' });
  return { store, state };
}

async function unqualifiedCache() {
  const mode = fixture();
  assert.equal(await mode.store.loadBookshelfViewMode(), 'cover');
  mode.state.failFlush = 'before';
  const evidence = new ReaderWriteEvidence();
  await assert.rejects(mode.store.saveBookshelfViewMode('list', undefined, evidence), /original flush failed/);
  assert.equal(evidence.confirmation(), 'unknown');
  mode.state.failReload = true;
  await assert.rejects(mode.store.loadBookshelfViewMode(false), /persistent read not yet available/);
  mode.state.failReload = false;
  assert.equal(await mode.store.loadBookshelfViewMode(false), 'cover', 'fresh read does not consume the dirty SDK cache');
  assert.equal(mode.state.reloads, 2, 'failed cache reopen remains retryable');
  assert.equal(evidence.confirmation(), 'unknown', 'independent readback does not forge original write acknowledgement');
  await mode.store.saveBookshelfViewMode('list');
  assert.equal(await mode.store.loadBookshelfViewMode(false), 'list');

  for (const [journal, save, load, clear] of [
    [restore, 'saveRestoreJournal', 'loadRestoreJournal', 'clearRestoreJournal'],
    [backup, 'saveBackupJournal', 'loadBackupJournal', 'clearBackupJournal'],
  ]) {
    const f = fixture();
    f.state.failFlush = 'after';
    await assert.rejects(f.store[save](journal), /original flush failed/);
    assert.deepEqual(await f.store[load](), journal, 'a persisted journal with a lost ACK remains discoverable');
    f.state.failFlush = 'before';
    await assert.rejects(f.store[clear](journal.operationId), /original flush failed/);
    assert.deepEqual(await f.store[load](), journal, 'the dirty cached deletion cannot hide the durable journal');
    await f.store[clear](journal.operationId);
    assert.equal(await f.store[load](), undefined);
  }
}

async function credentialDigest() {
  const f = fixture();
  const publicConfig = { url: 'https://fixture.invalid/dav', user: '', password: '', backupPassword: 'test-only-input', directory: 'reader' };
  for (const stage of ['create', 'update', 'digest']) {
    f.state.digestStage = stage;
    const evidence = new ReaderWriteEvidence();
    await assert.rejects(f.store.save(publicConfig, evidence, undefined, '00000000-0000-4000-8000-000000000001'),
      /digest capability unavailable/);
    assert.equal(evidence.confirmation(), 'undispatched');
    assert.equal(f.state.intentWrites, 0);
    assert.equal(await f.store.loadConfigIntent(), undefined);
  }
}

const cases = { 'unqualified-cache': unqualifiedCache, 'credential-digest': credentialDigest };
for (const id of selectContractCases(definitions)) {
  await cases[id]();
  recordContractCasePass(id);
}
