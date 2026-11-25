import assert from 'node:assert/strict';
import { recordContractCasePass, selectContractCases } from './lib/contract-case-selection.mjs';
import { selectedProductionMethods } from './lib/selected-production-methods.mjs';

const definitions = {
  'fresh-and-concurrent': { description: 'Production fixture directory admission creates only isolated children and reconciles precise already-existing races', resources: [] },
};
const file = new URL('../entry/src/main/ets/entryability/EntryAbility.ets', import.meta.url);
const sandbox = '/data/storage/el4/base/haps/entry/files';
const parent = sandbox + '/reader-public-ui-fixtures';
const root = parent + '/long-directory';
const nativeError = (code, message) => Object.assign(new Error(message), { code });

function fixture() {
  const entries = new Map([[sandbox, 'directory']]);
  const calls = [];
  const createFaults = new Map();
  const lstatFaults = new Map();
  const fileIo = {
    accessSync(path) {
      calls.push(['access', path]);
      if (!entries.has(path)) throw nativeError(13900002, 'pathname absent');
      return true;
    },
    mkdirSync(path, recursive) {
      calls.push(['mkdir', path, recursive]);
      if (createFaults.has(path)) return createFaults.get(path)();
      if (entries.has(path)) throw nativeError(13900015, 'already exists');
      assert.equal(entries.get(path.slice(0, path.lastIndexOf('/'))), 'directory', 'explicit one-level creation');
      entries.set(path, 'directory');
    },
    lstatSync(path) {
      calls.push(['lstat', path]);
      if (lstatFaults.has(path)) throw lstatFaults.get(path);
      const kind = entries.get(path);
      if (kind === undefined) throw nativeError(13900002, 'pathname absent');
      return { isDirectory: () => kind === 'directory', isSymbolicLink: () => kind === 'symlink' };
    },
  };
  const EntryAbility = selectedProductionMethods(file, 'EntryAbility', ['prepareNamedFixtureDirectory'], { fileIo });
  return { calls, entries, createFaults, lstatFaults, prepare: () => new EntryAbility().prepareNamedFixtureDirectory(sandbox, root) };
}

function freshAndConcurrent() {
  const fresh = fixture();
  fresh.prepare();
  assert.deepEqual([...fresh.entries.keys()], [sandbox, parent, root]);
  assert.deepEqual(fresh.calls.filter(([op]) => op === 'mkdir'), [['mkdir', parent, undefined], ['mkdir', root, undefined]]);

  const concurrent = fixture();
  for (const [path, code] of [[parent, 13900015], [root, 'EEXIST']]) {
    concurrent.createFaults.set(path, () => {
      concurrent.entries.set(path, 'directory');
      throw nativeError(code, 'concurrent creator');
    });
  }
  concurrent.prepare();
  assert.deepEqual(concurrent.calls.filter(([op]) => op === 'lstat'), [['lstat', sandbox], ['lstat', parent], ['lstat', root]]);
  fresh.prepare();
  assert.deepEqual([...fresh.entries.keys()], [sandbox, parent, root], 'existing directory remains intact');

  for (const [path, kind] of [[sandbox, 'symlink'], [parent, 'file'], [parent, 'symlink'], [root, 'file'], [root, 'symlink']]) {
    const unsafe = fixture();
    if (path === root) unsafe.entries.set(parent, 'directory');
    unsafe.entries.set(path, kind);
    assert.throws(unsafe.prepare, /PUBLIC_FIXTURE_STORAGE_NOT_ISOLATED/);
    assert.equal(unsafe.entries.get(path), kind);
    if (path !== root) assert.equal(unsafe.entries.has(root), false);
  }
  const missing = fixture();
  missing.entries.delete(sandbox);
  assert.throws(missing.prepare, error => error.code === 13900002);
  assert.deepEqual(missing.calls, [['lstat', sandbox]], 'the fixture may never create the application sandbox');

  const denied = fixture();
  const permissionDenied = nativeError(13900012, 'permission denied');
  denied.createFaults.set(parent, () => { throw permissionDenied; });
  assert.throws(denied.prepare, error => error === permissionDenied);
  assert.equal(denied.entries.has(root), false);
  const vanished = fixture();
  vanished.createFaults.set(parent, () => { throw nativeError(13900015, 'created and then removed'); });
  assert.throws(vanished.prepare, error => error.code === 13900002);
  assert.equal(vanished.entries.has(root), false);
  const unreadable = fixture();
  unreadable.lstatFaults.set(parent, permissionDenied);
  assert.throws(unreadable.prepare, error => error === permissionDenied);
  assert.equal(unreadable.entries.has(root), false);
}

for (const id of selectContractCases(definitions)) {
  freshAndConcurrent();
  recordContractCasePass(id);
}
