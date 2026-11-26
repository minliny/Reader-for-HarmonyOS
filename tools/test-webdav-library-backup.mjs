import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { installedEtsCompiler } from './lib/ets-compiler-runtime.mjs';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';
import { selectedProductionMethods } from './lib/selected-production-methods.mjs';
import { virtualFilePath } from './lib/tool-environment.mjs';

const sourcePathOnHost = fileURLToPath(new URL('../entry/src/main/ets/features/sync/application/WebDavLibraryBackup.ts', import.meta.url));
const source = readFileSync(sourcePathOnHost, 'utf8');
const base = 'https://backup.example.invalid/dav';
const directory = '/reader-library';
const collection = base + directory + '/';
const sourcePath = '/sandbox/staged.readerbackup';
const restoredPath = '/sandbox/restored.readerbackup';
const verifiedPath = '/sandbox/verified.readerbackup';
const maximum = 512 * 1024 * 1024;
const partBytes = 4 * 1024 * 1024;
const manifestName = hash => `reader-library-v1-${hash}.manifest`;
const partName = (hash, index = '000') => `reader-library-v1-${hash}.${index}.part`;
const retiredName = hash => `reader-library-v1-${hash}.retired`;
const removedName = hash => `reader-library-v1-${hash}.removed`;
const probe = 'reader-library-conditional-v2.probe';
const authored = (offset, libraryId = 'library-mine') => ({ libraryId, createdAt: 1700000000000 + offset });
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const reason = expected => error => error.name === 'Error' && error.reason === expected;
const archiveDeletes = requests => requests.filter(request => request.method === 'DELETE' && request.name !== probe);

function provider(options = {}) {
  const folder = options.directory ?? directory;
  const remoteCollection = base + folder + '/';
  const files = new Map();
  const remote = new Map();
  const proofs = new Map();
  const requests = [];
  const calls = [];
  let clock = 1780000000000;
  let uptime = 100;
  let hasDirectory = options.hasDirectory ?? true;
  let active = true;
  const credentials = 'Basic fixture-secret';

  function store(name, bytes, { etag, modified } = {}) {
    const body = Buffer.from(bytes);
    remote.set(name, {
      body,
      etag: etag ?? `"${digest(body)}"`,
      modified: modified ?? new Date(clock += 1000).toUTCString(),
    });
  }

  const runtime = {
    async request(method, params) {
      calls.push(method);
      switch (method) {
        case 'sync.webdav.directory.list.plan':
          assert.deepEqual(params, { baseUrl: base, directory: folder }, 'credentials stay in the Host');
          return { data: { request: { method: 'PROPFIND', url: base + folder, headers: { Depth: '1' }, body: '<propfind/>' } } };
        case 'sync.webdav.multistatus.parse':
          assert.equal(params.response.status, 207);
          if (options.invalidListing) throw new Error('malformed provider listing');
          return { data: { resources: [
            ...Array.from(remote, ([name, data]) => ({ href: remoteCollection + name, lastModified: data.modified })),
            ...(options.extraListings ?? []),
          ] } };
        default: assert.fail(`unexpected Core request ${method}`);
      }
    },
  };

  const response = (status, body = '', headers = {}) => ({ status, bytes: Buffer.from(body), headers, finalUrl: remoteCollection });
  const http = {
    async executeWebDav(endpoint, params, limit, cancelled) {
      assert.equal(endpoint, base, 'uses WebDAV-origin-scoped raw HTTP');
      assert.equal(params.headers.Authorization, credentials);
      assert.equal(cancelled(), false);
      assert.ok(params.url.startsWith(params.method === 'MKCOL' ? base + '/' : remoteCollection));
      assert.ok(limit > 0 && limit < 16 * 1024 * 1024);
      const name = params.method === 'MKCOL' ? params.url.slice(base.length) : params.url.slice(remoteCollection.length);
      requests.push({ method: params.method, name, condition: params.headers['If-None-Match'], match: params.headers['If-Match'] });
      const fault = await options.before?.(params.method, name, { remote, store, response,
        advance: elapsed => { uptime += elapsed; }, retire: () => { active = false; } }, params);
      if (fault !== undefined) return fault;
      if (params.method === 'PROPFIND') return response(hasDirectory ? 207 : 404, '<multistatus/>');
      if (params.method === 'MKCOL') { hasDirectory = name === folder + '/'; return response(201); }
      if (params.method === 'GET') {
        const item = remote.get(name);
        if (item === undefined) {
          if (options.bodyless) throw new Error('http.execute: source returned HTTP 404 without response content');
          return response(404);
        }
        if (params.headers['If-Match'] !== undefined && params.headers['If-Match'] !== item.etag) {
          return response(412);
        }
        assert.ok(item.body.length <= limit);
        const headers = { ETag: options.weakEtag ? `W/${item.etag}` : item.etag,
          'Content-Type': options.mime ?? 'application/octet-stream' };
        return response(200, item.body, headers);
      }
      if (params.method === 'DELETE') {
        assert.ok(params.headers['If-Match'], 'every deletion uses a strong tag');
        const item = remote.get(name);
        if (item === undefined) return response(404);
        if (!options.ignoreDeleteCondition && params.headers['If-Match'] !== item.etag) return response(412);
        remote.delete(name);
        await options.afterDelete?.(name);
        return response(204);
      }
      assert.equal(params.method, 'PUT');
      assert.equal(params.headers['If-None-Match'], '*');
      assert.equal(params.headers['Content-Type'], 'application/octet-stream');
      if (remote.has(name) && !options.ignoreConditions) {
        if (options.bodyless) throw new Error('http.execute: source returned HTTP 412 without response content');
        return response(412);
      }
      store(name, params.body);
      await options.afterPut?.(name, { remote, store, retire: () => { active = false; } });
      return response(201);
    },
  };

  const { WebDavLibraryBackup, WebDavLibraryBackupError, WEB_DAV_ARCHIVE_READ_WINDOW } = pureModuleProbe(source, 'WebDavLibraryBackup.ts', {
    LOCAL_RECOVERY_MAX_BYTES: maximum,
    recoveryDigest: async bytes => digest(bytes),
    recoveryReserve: async (path, bytes) => { assert.equal(path, '/sandbox'); assert.ok(bytes <= maximum); },
    recoveryText: bytes => new TextDecoder('utf-8', { fatal: true }).decode(bytes),
    recoveryUtf8: text => Buffer.from(text),
    recoveryOutput: async (path, consume) => {
      assert.ok(path === restoredPath || path === verifiedPath);
      const pieces = [];
      await consume(async bytes => { pieces.push(Buffer.from(bytes)); });
      files.set(path, Buffer.concat(pieces));
    },
    recoveryVisitFile: async (path, emit, current, expectedSize) => {
      const file = files.get(path);
      assert.equal(file.length, expectedSize);
      for (let offset = 0; offset < file.length; offset += 730_000) {
        assert.equal(current(), true);
        await emit(file.subarray(offset, offset + 730_000));
      }
      return digest(file);
    },
    HttpExecuteHost: { instance: http },
    systemDateTime: { TimeType: { STARTUP: 0 }, getUptime: () => uptime },
    url: { URL: { parseURL: (value, baseUrl) => new URL(value, baseUrl) } },
    util: { Base64Helper: class {
      encodeToStringSync(bytes) { return Buffer.from(bytes).toString('base64'); }
      decodeSync(text) { return Buffer.from(text, 'base64'); }
    } },
  }, ['WebDavLibraryBackup', 'WebDavLibraryBackupError', 'WEB_DAV_ARCHIVE_READ_WINDOW']);
  const assertCurrent = async () => {
    if (!active) throw new Error('original provider retired');
  };
  const transport = new WebDavLibraryBackup(runtime, { url: base, directory: folder }, credentials, assertCurrent, () => !active);
  const verification = {
    path: verifiedPath,
    async inspect(path) {
      assert.equal(path, verifiedPath);
      const proof = proofs.get(digest(files.get(path)));
      if (proof === undefined) throw new Error('Archive could not be authenticated with the supplied password');
      return proof;
    },
  };

  return {
    transport, WebDavLibraryBackupError, requests, calls, remote, store, files, proofs, verification,
    readWindow: WEB_DAV_ARCHIVE_READ_WINDOW, getUptime: () => uptime,
    async publish(bytes, metadata, authenticated) {
      files.set(sourcePath, bytes);
      const hash = digest(bytes);
      await transport.publish(sourcePath, hash, bytes.length, metadata);
      if (authenticated !== null && metadata !== undefined) {
        proofs.set(hash, { libraryId: metadata.libraryId, createdAt: metadata.createdAt, includedOriginals: [],
          ...authenticated });
      }
      return hash;
    },
    advanceTime(elapsed) { uptime += elapsed; },
    async receive(sha256) { return transport.downloadLatest(restoredPath, sha256); },
  };
}

function retirementGateway(service) {
  const gatewaySource = new URL('../entry/src/main/ets/features/sync/application/SyncGateway.ts', import.meta.url);
  const identity = '13945f39-a019-4371-ba3b-367a26ec2782';
  const directory = `/sandbox/${identity}`;
  const journalPath = `${directory}/retirement.json`;
  const pausedPath = sha256 => `${directory}/retirement-paused-${sha256}.json`;
  const local = new Map();
  const localActions = [];
  const missing = Object.assign(new Error('absent'), { code: 'ENOENT' });
  const Gateway = selectedProductionMethods(gatewaySource, 'SyncGateway', [
    'removeLibraryArchive', 'resumeLibraryRetirement', 'leaveLibraryRetirement', 'libraryRetirement',
    'libraryRetirementStatus', 'writeLibraryRetirement', 'pausedLibraryRetirementPath',
    'driveLibraryRetirement', 'libraryLocalStat', 'unlinkLibraryFile',
  ], {
    LOCAL_RECOVERY_MAX_BYTES: maximum,
    WEB_DAV_ARCHIVE_READ_WINDOW: service.readWindow,
    WebDavLibraryBackupError: service.WebDavLibraryBackupError,
    systemDateTime: { TimeType: { STARTUP: 0 }, getUptime: service.getUptime },
    recoveryWithFile: async (path, _mode, work) => {
      assert.equal(path, directory);
      await work({ fd: 1 });
    },
    replaceReaderAtomicSnapshot: async (path, parent, content) => {
      assert.equal(parent, directory);
      localActions.push(['write', path]);
      local.set(path, content);
    },
    fileIo: {
      OpenMode: { READ_ONLY: 0 },
      async access(path) { return path === directory || local.has(path); },
      async lstat(path) {
        if (!local.has(path)) throw missing;
        return { isFile: () => true, size: local.get(path).length };
      },
      async readText(path) { return local.get(path); },
      async unlink(path) { localActions.push(['unlink', path]); if (!local.delete(path)) throw missing; },
      async rename(from, to) {
        assert.ok(local.has(from));
        assert.equal(local.has(to), false);
        localActions.push(['rename', from, to]);
        local.set(to, local.get(from));
        local.delete(from);
      },
      async fsync() { localActions.push(['fsync']); },
    },
  });
  return {
    identity, journalPath, pausedPath, local, localActions,
    open: () => Object.assign(new Gateway(), {
      libraryDirectory: id => { assert.equal(id, identity); return directory; },
      withLibraryArchiveVerification: (_provider, _directory, _current, work) => work(service.verification),
      async runLibraryOperation(current, work, scope) {
        assert.equal(scope, 'staging');
        const assertCurrent = async () => { if (!current()) throw new Error('retired'); };
        try {
          await assertCurrent();
          return await work({ identity, transport: service.transport, assertCurrent });
        } catch (error) {
          if (!current()) return { state: 'cancelled' };
          if (error instanceof service.WebDavLibraryBackupError) return { state: error.reason };
          throw error;
        }
      },
    }),
    async row(sha256) {
      const row = (await service.transport.listArchives({})).find(item => item.sha256 === sha256);
      assert.ok(row);
      return { ...row, providerIdentity: identity };
    },
  };
}

const currentRetirement = () => true;
const archiveWrites = requests => requests.filter(request => request.name !== probe &&
  ['PUT', 'DELETE', 'MKCOL'].includes(request.method));

test('publishes verified chunks before the immutable manifest and restores the exact encrypted archive', async () => {
  const service = provider({ hasDirectory: false, bodyless: true, directory: '/ReaderBackup/ReaderHarmony',
    mime: 'text/cache-manifest; charset=utf-8',
    extraListings: [{ href: 'https://outside.example.invalid/' + manifestName('2'.repeat(64)), lastModified: 'Nov 1, 2060' }],
  });
  const bytes = Buffer.alloc(partBytes + 137, 0x65);
  const hash = await service.publish(bytes);
  const remoteNames = Array.from(service.remote.keys());
  assert.deepEqual(remoteNames, [
    probe, `reader-library-v1-${hash}.000.part`,
    `reader-library-v1-${hash}.001.part`, manifestName(hash),
  ]);
  assert.deepEqual(service.requests.filter(item => item.method === 'MKCOL').map(item => item.name),
    ['/ReaderBackup/', '/ReaderBackup/ReaderHarmony/']);
  const writes = service.requests.filter(item => item.method === 'PUT');
  assert.equal(writes.at(-1).name, manifestName(hash));
  assert.ok(service.requests.every(item => item.method !== 'DELETE'));
  const rawManifest = JSON.parse(service.remote.get(manifestName(hash)).body.toString());
  assert.deepEqual(rawManifest, { format: 'reader.library.webdav', version: 1, sha256: hash,
    bytes: bytes.length, parts: [digest(bytes.subarray(0, partBytes)), digest(bytes.subarray(partBytes))] });
  assert.equal(await service.receive(), 'downloaded');
  assert.deepEqual(service.files.get(restoredPath), bytes);
  assert.ok(service.calls.includes('sync.webdav.multistatus.parse'));
});

test('conditional creation failure and weak or unprovable ETags keep the destination read-only', async () => {
  for (const options of [{ ignoreConditions: true }, { weakEtag: true }]) {
    const service = provider(options);
    await assert.rejects(service.publish(Buffer.from('ciphertext')), reason('readOnly'));
    assert.ok(Array.from(service.remote.keys()).every(name => name === probe));
    assert.ok(service.requests.every(item => !item.name.endsWith('.manifest') && !item.name.endsWith('.part')));
  }
});

test('reads back a lost PUT response and reuses exact staged bytes without writing the archive twice', async () => {
  let disconnect = true;
  const service = provider({
    afterPut(name) {
      if (disconnect && name.endsWith('.manifest')) {
        disconnect = false;
        throw new Error('lost response after remote manifest persisted');
      }
    },
  });
  const bytes = Buffer.from('encrypted package 1');
  const hash = await service.publish(bytes);
  await service.publish(bytes);
  assert.equal(service.requests.filter(item => item.name === manifestName(hash) && item.method === 'PUT').length, 1);
  assert.equal(service.requests.filter(item => item.name.endsWith('.part') && item.method === 'PUT').length, 1);
});

test('abandons an old provider after retirement and refuses a conflicting existing object', async () => {
  const retired = provider({ afterPut(name, owner) { if (name.endsWith('.part')) owner.retire(); } });
  await assert.rejects(retired.publish(Buffer.from('encrypted old provider')), /original provider retired/);
  assert.ok(retired.requests.every(item => !item.name.endsWith('.manifest')));
  const different = provider();
  const bytes = Buffer.from('encrypted new provider');
  const name = `reader-library-v1-${digest(bytes)}.000.part`;
  different.store(name, Buffer.from('different bytes').toString('base64'));
  await assert.rejects(different.publish(bytes), reason('conflict'));
  assert.ok(different.requests.every(item => !(item.name === name && item.method === 'PUT')));
  assert.ok(different.requests.every(item => !item.name.endsWith('.manifest')));
});

test('keeps older published backups, chooses a unique latest commit and verifies every chunk', async () => {
  const service = provider();
  const old = await service.publish(Buffer.from('old archive'));
  const latestBytes = Buffer.from('latest archive');
  const latest = await service.publish(latestBytes);
  assert.ok(service.remote.has(manifestName(old)));
  assert.equal(await service.receive(), 'downloaded');
  assert.deepEqual(service.files.get(restoredPath), latestBytes);
  service.store(`reader-library-v1-${latest}.000.part`, Buffer.alloc(latestBytes.length).toString('base64'));
  await assert.rejects(service.receive(), reason('corrupt'));
});

test('keeps empty, absent and access denied distinct, and restores concrete rows even when timestamps tie', async () => {
  const empty = provider();
  assert.equal(await empty.receive(), 'empty');
  await assert.rejects(provider({ hasDirectory: false }).receive(), reason('missing'));
  const denied = provider({ before() { throw new Error('http.execute: source returned HTTP 401 without response content'); } });
  await assert.rejects(denied.receive(), reason('authentication'));
  const first = await empty.publish(Buffer.from('first'));
  const second = await empty.publish(Buffer.from('second'));
  empty.remote.get(manifestName(second)).modified = empty.remote.get(manifestName(first)).modified;
  const rows = await empty.transport.listArchives({});
  assert.deepEqual(rows.map(row => row.sha256), [first, second].sort());
  assert.ok(rows.every(row => !row.canDelete));
  assert.equal(await empty.receive(second), 'downloaded');
  assert.deepEqual(empty.files.get(restoredPath), Buffer.from('second'));
});

test('rejects a malformed multistatus before writing any object', async () => {
  const service = provider({ invalidListing: true });
  await assert.rejects(service.publish(Buffer.from('archive')), reason('failed'));
  assert.deepEqual(service.requests.map(item => item.method), ['PROPFIND']);
});

test('downloads a checked snapshot in read-only mode and detects a pre-admission manifest update', async () => {
  const writer = provider();
  const bytes = Buffer.from('secure portable archive');
  const sha = await writer.publish(bytes);
  const reader = provider({ mime: 'text/plain; charset=UTF-8', weakEtag: true });
  for (const [name, item] of writer.remote) reader.store(name, item.body);
  assert.equal(await reader.receive(), 'downloaded');
  assert.deepEqual(reader.files.get(restoredPath), bytes);
  assert.ok(reader.requests.every(item => item.method !== 'PUT'));

  const raced = provider({ before(method, name, owner, params) {
    if (method === 'GET' && name === manifestName(sha) && params.headers['If-Match'] !== undefined) {
      owner.store(manifestName(sha), 'successor manifest');
    }
  } });
  for (const [name, item] of writer.remote) raced.store(name, item.body);
  await assert.rejects(raced.receive(), reason('conflict'));
});

test('lists authored times and library scope, falls back only for legacy, and protects pinned and undated backups', async () => {
  const service = provider();
  const stamp = 1700000000000;
  const latest = await service.publish(Buffer.from('newest authored archive'), {
    libraryId: 'library-mine', writerInstanceId: 'writer-new', createdAt: stamp + 3000,
  });
  const foreign = await service.publish(Buffer.from('old other library'), { libraryId: 'library-other', createdAt: stamp + 1000 });
  const pinned = await service.publish(Buffer.from('pinned archive'), { libraryId: 'library-mine', createdAt: stamp + 2000 });
  const pin = JSON.parse(service.remote.get(manifestName(pinned)).body.toString());
  assert.equal(pin.pinned, false);
  service.store(manifestName(pinned), JSON.stringify({ ...pin, pinned: true }));
  const legacy = await service.publish(Buffer.from('legacy undated'));
  service.remote.get(manifestName(legacy)).modified = undefined;
  const rows = await service.transport.listArchives({ libraryId: 'library-mine' });
  assert.deepEqual(rows.map(row => [row.sha256, row.createdAt, row.latest, row.canDelete, row.library]), [
    [latest, stamp + 3000, true, false, 'same'], [pinned, stamp + 2000, false, false, 'same'],
    [foreign, stamp + 1000, false, false, 'other'], [legacy, undefined, false, false, 'unknown'],
  ]);
  for (const sha of [latest, pinned, legacy]) {
    await assert.rejects(service.transport.planRemoval(sha, rows.find(row => row.sha256 === sha).manifestSha256,
      service.verification), reason('replacementUnverified'));
  }
  assert.equal(service.requests.filter(request => request.method === 'DELETE').length, 0);
});

test('dated legacy manifests remain restorable and can never be removed by the archive list', async () => {
  const service = provider();
  const bytes = Buffer.from('older legacy backup');
  const old = await service.publish(bytes);
  service.remote.get(manifestName(old)).modified = new Date(1500000000000).toUTCString();
  await service.publish(Buffer.from('newer authored backup'), authored(1000));
  const row = (await service.transport.listArchives({})).find(item => item.sha256 === old);
  assert.equal(row.latest, false);
  assert.equal(row.canDelete, false);
  assert.equal(row.createdAt, 1500000000000);
  await assert.rejects(service.transport.planRemoval(old, row.manifestSha256, service.verification), reason('replacementUnverified'));
  assert.equal(await service.receive(old), 'downloaded');
  assert.deepEqual(service.files.get(restoredPath), bytes);
  assert.ok(service.requests.every(request => request.method !== 'DELETE'));
});

test('unpublishes only the selected exact commit and keeps an admitted read intact, then removes verified retired parts', async () => {
  let notifyPart;
  let releasePart;
  let old;
  const waitForRead = new Promise(resolve => { notifyPart = resolve; });
  const holdRead = new Promise(resolve => { releasePart = resolve; });
  let pause = false;
  const service = provider({
    async before(method, name) {
      if (pause && method === 'GET' && name === partName(old)) {
        notifyPart();
        await holdRead;
      }
    },
  });
  const oldBytes = Buffer.from('old selected archive');
  old = await service.publish(oldBytes, authored(1000));
  const newBytes = Buffer.from('new verified archive');
  const latest = await service.publish(newBytes, authored(2000));
  const rows = await service.transport.listArchives({});
  const displayed = rows.find(row => row.sha256 === old);
  const plan = await service.transport.planRemoval(old, displayed.manifestSha256, service.verification);
  assert.equal(plan.replacementSha256, latest);
  assert.deepEqual(service.files.get(verifiedPath), newBytes);
  pause = true;
  const runningRead = service.receive(old);
  await waitForRead;
  await service.transport.unpublish(plan, service.verification);
  await service.transport.unpublish(plan, service.verification);
  assert.equal(service.remote.has(manifestName(old)), false);
  assert.equal(service.remote.has(retiredName(old)), true);
  assert.equal(service.remote.has(removedName(old)), true);
  assert.equal(service.remote.has(partName(old)), true);
  const operations = service.requests.filter(op => op.method === 'PUT' || op.method === 'DELETE');
  assert.ok(operations.findIndex(op => op.method === 'PUT' && op.name === retiredName(old)) <
    operations.findIndex(op => op.method === 'DELETE' && op.name === manifestName(old)));
  assert.ok(operations.findIndex(op => op.method === 'DELETE' && op.name === manifestName(old)) <
    operations.findIndex(op => op.method === 'PUT' && op.name === removedName(old)));
  const remaining = await service.transport.listArchives({});
  assert.deepEqual(remaining.map(row => row.sha256), [latest]);
  await assert.rejects(service.receive(old), reason('missing'));
  await assert.rejects(service.publish(oldBytes, authored(1000)), reason('conflict'));
  pause = false;
  releasePart();
  assert.equal(await runningRead, 'downloaded');
  assert.deepEqual(service.files.get(restoredPath), oldBytes);
  // The gateway invokes this phase after the durable monotonic read window.
  await service.transport.removeRetiredParts(plan, service.verification);
  await service.transport.removeRetiredParts(plan, service.verification);
  assert.equal(service.remote.has(partName(old)), false);
  assert.equal(service.remote.has(retiredName(old)), true);
  assert.equal(service.remote.has(partName(latest)), true);
  assert.equal(service.remote.has(manifestName(latest)), true);
  assert.equal(await service.receive(), 'downloaded');
  assert.deepEqual(service.files.get(restoredPath), newBytes);
});

test('the download read window is monotonic and a late part is never accepted', async () => {
  let expire = false;
  const service = provider({ before(method, name, owner) {
    if (expire && method === 'GET' && name.endsWith('.part')) owner.advance(service.readWindow);
  } });
  const hash = await service.publish(Buffer.from('encrypted archive expired in transit'));
  expire = true;
  await assert.rejects(service.receive(hash), reason('conflict'));
  assert.equal(service.files.has(restoredPath), false);
});

test('deletion requires a verified replacement and tolerates a lost result only when the exact object is absent', async () => {
  let old;
  let dropped = false;
  const service = provider({ afterDelete(name) {
    if (name === manifestName(old)) {
      dropped = true;
      throw Error('provider acknowledged the removal after losing its connection');
    }
  } });
  old = await service.publish(Buffer.from('old complete backup'), authored(1000));
  const latest = await service.publish(Buffer.from('new complete backup'), authored(2000));
  const row = (await service.transport.listArchives({})).find(item => item.sha256 === old);
  const part = service.remote.get(partName(latest)).body;
  service.remote.delete(partName(latest));
  await assert.rejects(service.transport.planRemoval(old, row.manifestSha256, service.verification), reason('corrupt'));
  assert.equal(service.remote.has(manifestName(old)), true);
  assert.ok(service.requests.every(request => request.method !== 'DELETE'));
  service.store(partName(latest), part);
  const plan = await service.transport.planRemoval(old, row.manifestSha256, service.verification);
  await service.transport.unpublish(plan, service.verification);
  assert.equal(dropped, true);
  assert.equal(service.remote.has(manifestName(old)), false);
  assert.equal(service.remote.has(partName(old)), true);
});

test('a weak tag, a stale manifest, an inconsistent part, and ignored DELETE conditions fail closed', async () => {
  const service = provider({ ignoreDeleteCondition: true });
  const old = await service.publish(Buffer.from('older bytes'), authored(1000));
  const latest = await service.publish(Buffer.from('latest bytes'), authored(2000));
  const original = service.remote.get(manifestName(old));
  const row = (await service.transport.listArchives({})).find(entry => entry.sha256 === old);
  const plan = await service.transport.planRemoval(old, row.manifestSha256, service.verification);
  service.store(manifestName(old), Buffer.concat([original.body, Buffer.from('\n')]), { modified: original.modified });
  await assert.rejects(service.transport.unpublish(plan, service.verification), reason('cleanupFailed'));
  service.store(manifestName(old), original.body, { modified: original.modified });
  await assert.rejects(service.transport.unpublish(plan, service.verification), reason('readOnly'));
  assert.equal(service.remote.has(manifestName(old)), true);
  assert.equal(service.remote.has(retiredName(old)), false);
  assert.ok(service.requests.filter(op => op.method === 'DELETE').every(op => op.name === probe));

  const weak = provider({ weakEtag: true });
  for (const [name, item] of service.remote) weak.store(name, item.body);
  assert.ok((await weak.transport.listArchives({})).every(item => !item.canDelete));
  await assert.rejects(weak.transport.planRemoval(old, row.manifestSha256, weak.verification), reason('cleanupFailed'));
  assert.equal(await weak.receive(latest), 'downloaded');
  assert.ok(weak.requests.every(op => ['GET', 'PROPFIND'].includes(op.method)));

  const changed = provider();
  for (const [name, item] of service.remote) changed.store(name, item.body);
  changed.proofs.set(latest, service.proofs.get(latest));
  await changed.transport.unpublish(plan, changed.verification);
  changed.store(partName(old), Buffer.from('wrong size').toString('base64'));
  await assert.rejects(changed.transport.removeRetiredParts(plan, changed.verification), reason('cleanupFailed'));
  assert.equal(changed.remote.has(partName(old)), true);
  assert.equal(changed.remote.has(manifestName(latest)), true);
});

test('403 on a mutation preserves the successful read-only path, while read denial and 401 report authentication', async () => {
  let blocked;
  let status;
  const service = provider({ before(method, name, owner) {
    if (method === blocked) return owner.response(status);
  } });
  const bytes = Buffer.from('older readable backup');
  const old = await service.publish(bytes, authored(1000));
  await service.publish(Buffer.from('newer readable backup'), authored(2000));
  const row = (await service.transport.listArchives({})).find(item => item.sha256 === old);
  const plan = await service.transport.planRemoval(old, row.manifestSha256, service.verification);
  status = 403;
  blocked = 'DELETE';
  await assert.rejects(service.transport.unpublish(plan, service.verification), reason('readOnly'));
  assert.equal(service.remote.has(retiredName(old)), false);
  blocked = 'PUT';
  await assert.rejects(service.publish(Buffer.from('forbidden new write')), reason('readOnly'));
  const start = service.requests.length;
  assert.equal(await service.receive(old), 'downloaded');
  assert.deepEqual(service.files.get(restoredPath), bytes);
  assert.ok(service.requests.slice(start).every(request => ['GET', 'PROPFIND'].includes(request.method)));
  for (const method of ['GET', 'PROPFIND']) {
    blocked = method;
    await assert.rejects(service.receive(old), reason('authentication'));
  }
  status = 401;
  blocked = 'PUT';
  await assert.rejects(service.publish(Buffer.from('expired credentials')), reason('authentication'));
});

test('a denied archive DELETE keeps the exact manifest readable until removal is verified', async () => {
  let old;
  let denyTarget = false;
  const service = provider({ before(method, name, owner) {
    if (denyTarget && method === 'DELETE' && name === manifestName(old)) return owner.response(403);
  } });
  const bytes = Buffer.from('archive stays readable when provider denies removal');
  old = await service.publish(bytes, authored(1000));
  await service.publish(Buffer.from('retained successor'), authored(2000));
  const row = (await service.transport.listArchives({})).find(item => item.sha256 === old);
  const manifest = service.remote.get(manifestName(old)).body;
  const plan = await service.transport.planRemoval(old, row.manifestSha256, service.verification);
  denyTarget = true;
  await assert.rejects(service.transport.unpublish(plan, service.verification), reason('readOnly'));
  assert.equal(service.remote.has(retiredName(old)), true);
  assert.equal(service.remote.has(removedName(old)), false);
  assert.ok((await service.transport.listArchives({})).some(item => item.sha256 === old));
  assert.equal(await service.receive(old), 'downloaded');
  assert.deepEqual(service.files.get(restoredPath), bytes);
  await assert.rejects(service.transport.removeRetiredParts(plan, service.verification), reason('cleanupFailed'));
  denyTarget = false;
  await service.transport.unpublish(plan, service.verification);
  service.store(manifestName(old), manifest);
  assert.equal(service.remote.has(removedName(old)), true);
  assert.ok(!(await service.transport.listArchives({})).some(item => item.sha256 === old));
  await assert.rejects(service.receive(old), reason('missing'));
  await assert.rejects(service.transport.removeRetiredParts(plan, service.verification), reason('cleanupFailed'));
  assert.equal(service.remote.has(partName(old)), true);
});

test('a correct scratch DELETE must succeed and remove the object before any archive mutation', async () => {
  for (const denial of [412, 204]) {
    const service = provider({ before(method, name, owner, params) {
      if (method === 'DELETE' && name === probe && params.headers['If-Match'] === owner.remote.get(probe)?.etag) {
        return owner.response(denial);
      }
    } });
    const old = await service.publish(Buffer.from('older archive'), authored(1000));
    await service.publish(Buffer.from('newer archive'), authored(2000));
    const row = (await service.transport.listArchives({})).find(item => item.sha256 === old);
    const plan = await service.transport.planRemoval(old, row.manifestSha256, service.verification);
    await assert.rejects(service.transport.unpublish(plan, service.verification), reason('readOnly'));
    assert.ok(service.remote.has(probe));
    assert.ok(service.remote.has(manifestName(old)));
    assert.ok(!service.remote.has(retiredName(old)));
    assert.deepEqual(service.requests.filter(request => request.method === 'DELETE').map(request => request.name), [probe, probe]);
  }
});

test('only a strictly newer archive for the same library can replace a selected backup', async () => {
  const service = provider();
  const hash = await service.publish(Buffer.from('original'), authored(1000));
  const other = await service.publish(Buffer.from('other library'), authored(3000, 'library-other'));
  const row = (await service.transport.listArchives({})).find(item => item.sha256 === hash);
  assert.equal(row.canDelete, false);
  await assert.rejects(service.transport.planRemoval(hash, row.manifestSha256, service.verification), reason('replacementUnverified'));
  assert.deepEqual(archiveDeletes(service.requests), []);

  const same = await service.publish(Buffer.from('newer same library'), authored(2000));
  const plan = await service.transport.planRemoval(hash, row.manifestSha256, service.verification);
  assert.equal(plan.replacementSha256, same);
  assert.deepEqual(plan.replacementProof, {
    libraryId: 'library-mine', createdAt: authored(2000).createdAt,
    manifestSha256: digest(service.remote.get(manifestName(same)).body),
    manifestEtag: service.remote.get(manifestName(same)).etag,
  });
  await service.transport.unpublish(plan, service.verification);
  assert.deepEqual(archiveDeletes(service.requests).map(op => op.name), [manifestName(hash)]);
  assert.ok(service.remote.has(manifestName(same)) && service.remote.has(manifestName(other)));
});

test('authenticated identity, chronology, passphrase and original coverage are required before any archive deletion', async () => {
  const original = digest('one locally archived original');
  const scenarios = [
    { name: 'incorrect password for original', old: null, replacement: {} },
    { name: 'incorrect password for replacement', old: {}, replacement: null },
    { name: 'no authenticated identity', old: {}, replacement: { libraryId: undefined } },
    { name: 'public identity contradicts authenticated identity', old: {}, replacement: { libraryId: 'library-other' } },
    { name: 'authenticated chronology is reversed', old: {}, replacement: { createdAt: authored(900).createdAt } },
    { name: 'authenticated chronology is missing', old: {}, replacement: { createdAt: undefined } },
    { name: 'replacement does not cover an original', old: { includedOriginals: [original] }, replacement: {},
      failure: 'replacementMissingOriginals' },
  ];
  for (const scenario of scenarios) {
    const service = provider();
    const old = await service.publish(Buffer.from('old archive'), authored(1000), scenario.old);
    await service.publish(Buffer.from('new archive'), authored(2000), scenario.replacement);
    const row = (await service.transport.listArchives({})).find(item => item.sha256 === old);
    await assert.rejects(service.transport.planRemoval(old, row.manifestSha256, service.verification),
      reason(scenario.failure ?? 'replacementUnverified'), scenario.name);
    assert.deepEqual(archiveDeletes(service.requests), [], scenario.name);
    assert.ok(service.remote.has(manifestName(old)) && service.remote.has(partName(old)), scenario.name);
    assert.equal(service.remote.has(retiredName(old)), false, scenario.name);
  }
});

test('an inadmissible newest same-library archive does not disqualify a valid earlier replacement', async () => {
  const service = provider();
  const original = digest('original retained in both admissible archives');
  const old = await service.publish(Buffer.from('old archive'), authored(1000), { includedOriginals: [original] });
  const usable = await service.publish(Buffer.from('valid replacement'), authored(2000), { includedOriginals: [original] });
  await service.publish(Buffer.from('replacement missing original'), authored(3000));
  await service.publish(Buffer.from('replacement with wrong password'), authored(4000), null);
  const corrupt = await service.publish(Buffer.from('replacement with broken part'), authored(5000));
  service.store(partName(corrupt), 'not base64');
  const retiring = await service.publish(Buffer.from('replacement being retired'), authored(6000), { includedOriginals: [original] });
  const marker = service.remote.get(manifestName(retiring));
  const details = JSON.parse(marker.body.toString());
  service.store(retiredName(retiring), JSON.stringify({ format: details.format, version: 1, sha256: retiring,
    manifestSha256: digest(marker.body), manifestEtag: marker.etag, replacementSha256: digest('replacement elsewhere'),
    bytes: details.bytes, parts: details.parts }));
  const row = (await service.transport.listArchives({})).find(item => item.sha256 === old);
  const plan = await service.transport.planRemoval(old, row.manifestSha256, service.verification);
  assert.equal(plan.replacementSha256, usable);
  assert.deepEqual(archiveDeletes(service.requests), []);
  await service.transport.unpublish(plan, service.verification);
  assert.deepEqual(archiveDeletes(service.requests).map(op => op.name), [manifestName(old)]);
});

test('a retired marker cannot resume manifest deletion once the exact protected replacement changes or disappears', async () => {
  let old;
  let denyTarget = true;
  const service = provider({ before(method, name, owner) {
    if (denyTarget && method === 'DELETE' && name === manifestName(old)) return owner.response(403);
  } });
  old = await service.publish(Buffer.from('still visible old archive'), authored(1000));
  const replacement = await service.publish(Buffer.from('exact protected successor'), authored(2000));
  const row = (await service.transport.listArchives({})).find(item => item.sha256 === old);
  const plan = await service.transport.planRemoval(old, row.manifestSha256, service.verification);
  await assert.rejects(service.transport.unpublish(plan, service.verification), reason('readOnly'));
  assert.ok(service.remote.has(retiredName(old)) && service.remote.has(manifestName(old)));
  const initial = service.remote.get(manifestName(replacement));
  denyTarget = false;
  for (const changed of [Buffer.concat([initial.body, Buffer.from('\n')]), undefined, initial.body]) {
    if (changed === undefined) service.remote.delete(manifestName(replacement));
    else service.store(manifestName(replacement), changed, { modified: initial.modified });
    const start = service.requests.length;
    if (changed === initial.body) service.store(retiredName(replacement), 'replacement retirement in progress');
    await assert.rejects(service.transport.unpublish(plan, service.verification), reason('replacementUnverified'));
    assert.deepEqual(archiveDeletes(service.requests.slice(start)), []);
    assert.ok(service.remote.has(manifestName(old)) && service.remote.has(partName(old)));
  }
  assert.equal(service.remote.has(removedName(old)), false);
});

test('part cleanup after the graced phase reauthenticates the replacement instead of trusting the journal', async () => {
  const service = provider();
  const included = digest('shared original');
  const old = await service.publish(Buffer.from('archive waiting for part cleanup'), authored(1000),
    { includedOriginals: [included] });
  const replacement = await service.publish(Buffer.from('archive retained for recovery'), authored(2000),
    { includedOriginals: [included] });
  const row = (await service.transport.listArchives({})).find(item => item.sha256 === old);
  const plan = await service.transport.planRemoval(old, row.manifestSha256, service.verification);
  await service.transport.unpublish(plan, service.verification);
  service.advanceTime(service.readWindow);
  const saved = service.remote.get(manifestName(replacement));
  const proof = service.proofs.get(replacement);
  service.proofs.delete(replacement);
  let start = service.requests.length;
  await assert.rejects(service.transport.removeRetiredParts(plan, service.verification), reason('replacementUnverified'));
  assert.deepEqual(archiveDeletes(service.requests.slice(start)), []);
  assert.ok(service.remote.has(partName(old)));
  service.proofs.set(replacement, proof);
  service.remote.delete(manifestName(replacement));
  start = service.requests.length;
  await assert.rejects(service.transport.removeRetiredParts(plan, service.verification), reason('replacementUnverified'));
  assert.deepEqual(archiveDeletes(service.requests.slice(start)), []);
  assert.ok(service.remote.has(partName(old)));
  service.store(manifestName(replacement), saved.body, { modified: saved.modified });
  await service.transport.removeRetiredParts(plan, service.verification);
  assert.equal(service.remote.has(partName(old)), false);
  assert.ok(service.remote.has(manifestName(replacement)) && service.remote.has(partName(replacement)));
});

test('archive deletion rechecks the exact successor after probes and other intervening remote operations', async () => {
  let old, successor;
  let failBeforeManifest = true;
  let failBeforePart = false;
  const service = provider({
    afterPut(name, owner) {
      if (failBeforeManifest && name === retiredName(old)) owner.remote.delete(manifestName(successor));
    },
    before(method, name, owner) {
      if (failBeforePart && method === 'GET' && name === partName(old)) owner.remote.delete(manifestName(successor));
    },
  });
  old = await service.publish(Buffer.from('exact target'), authored(1000));
  successor = await service.publish(Buffer.from('exact successor'), authored(2000));
  const row = (await service.transport.listArchives({})).find(item => item.sha256 === old);
  const plan = await service.transport.planRemoval(old, row.manifestSha256, service.verification);
  const manifest = service.remote.get(manifestName(successor));
  await assert.rejects(service.transport.unpublish(plan, service.verification), reason('replacementUnverified'));
  assert.deepEqual(archiveDeletes(service.requests), []);
  assert.ok(service.remote.has(retiredName(old)) && service.remote.has(manifestName(old)));
  failBeforeManifest = false;
  service.store(manifestName(successor), manifest.body, { modified: manifest.modified });
  await service.transport.unpublish(plan, service.verification);
  service.advanceTime(service.readWindow);
  failBeforePart = true;
  const start = service.requests.length;
  await assert.rejects(service.transport.removeRetiredParts(plan, service.verification), reason('replacementUnverified'));
  assert.deepEqual(archiveDeletes(service.requests.slice(start)), []);
  assert.ok(service.remote.has(partName(old)));
});

test('a legacy retirement plan can only be upgraded with its exact original manifest and successor still available', async () => {
  let old;
  let denyTarget = true;
  const service = provider({ before(method, name, owner) {
    if (denyTarget && method === 'DELETE' && name === manifestName(old)) return owner.response(403);
  } });
  old = await service.publish(Buffer.from('legacy journal target'), authored(1000));
  const replacement = await service.publish(Buffer.from('legacy journal successor'), authored(2000));
  const row = (await service.transport.listArchives({})).find(item => item.sha256 === old);
  const plan = await service.transport.planRemoval(old, row.manifestSha256, service.verification);
  const { replacementProof, ...legacy } = plan;
  await assert.rejects(service.transport.unpublish(plan, service.verification), reason('readOnly'));
  assert.ok(service.remote.has(retiredName(old)));
  await service.publish(Buffer.from('an even newer archive'), authored(3000));
  const recorded = service.remote.get(manifestName(replacement));
  const pending = service.requests.length;
  service.remote.delete(manifestName(replacement));
  await assert.rejects(service.transport.upgradeRemovalPlan(legacy, service.verification), reason('replacementUnverified'));
  assert.deepEqual(archiveDeletes(service.requests.slice(pending)), []);
  service.store(manifestName(replacement), recorded.body, { modified: recorded.modified });
  const upgraded = await service.transport.upgradeRemovalPlan(legacy, service.verification);
  assert.equal(upgraded.replacementSha256, replacement);
  assert.deepEqual(upgraded.replacementProof, replacementProof);
  denyTarget = false;
  await service.transport.unpublish(upgraded, service.verification);
  assert.ok(service.remote.has(partName(old)));
  const start = service.requests.length;
  await assert.rejects(service.transport.upgradeRemovalPlan(legacy, service.verification), reason('replacementUnverified'));
  await assert.rejects(service.transport.removeRetiredParts(legacy, service.verification), reason('replacementUnverified'));
  assert.deepEqual(archiveDeletes(service.requests.slice(start)), []);
  assert.ok(service.remote.has(partName(old)));
});

test('an unsupported DELETE probe leaves no retirement journal or archive changes and still permits recovery', async () => {
  let host;
  const service = provider({ before(method, name, context) {
    if (method === 'DELETE' && name === probe) {
      assert.deepEqual(host.localActions, [], 'preflight precedes every retirement journal write');
      return context.response(405);
    }
  } });
  host = retirementGateway(service);
  const old = await service.publish(Buffer.from('older backup archive'), authored(1000, '7'.repeat(32)));
  const latest = await service.publish(Buffer.from('newer backup archive'), authored(2000, '7'.repeat(32)));
  const row = await host.row(old);
  const before = service.requests.length;
  const original = service.remote.get(manifestName(old)).body;
  assert.deepEqual(await host.open().removeLibraryArchive(row, currentRetirement), { state: 'deletionUnavailable' });
  assert.deepEqual(host.localActions, []);
  assert.deepEqual(archiveWrites(service.requests.slice(before)), []);
  assert.deepEqual(service.remote.get(manifestName(old)).body, original);
  assert.equal(service.remote.has(retiredName(old)), false);
  assert.equal(await service.receive(latest), 'downloaded');
});

test('a stale exit cannot discard a receipt and an exact untouched legacy retirement can be abandoned', async () => {
  const service = provider();
  const host = retirementGateway(service);
  const old = await service.publish(Buffer.from('older backup archive'), authored(1000, '7'.repeat(32)));
  await service.publish(Buffer.from('newer backup archive'), authored(2000, '7'.repeat(32)));
  const row = await host.row(old);
  const plan = await service.transport.planRemoval(old, row.manifestSha256, service.verification);
  const legacy = { schemaVersion: 1, configOperationId: host.identity, plan: { ...plan, replacementProof: undefined } };
  host.local.set(host.journalPath, JSON.stringify(legacy));
  const before = service.requests.length;
  assert.deepEqual(await host.open().leaveLibraryRetirement('stale receipt', currentRetirement), { state: 'cancelled' });
  assert.equal(service.requests.length, before);
  assert.equal(host.local.has(host.journalPath), true);
  const receipt = host.open().libraryRetirementStatus(legacy).receipt;
  assert.deepEqual(await host.open().leaveLibraryRetirement(receipt, currentRetirement), { state: 'retirementAbandoned' });
  assert.deepEqual(host.localActions, [['unlink', host.journalPath], ['fsync']]);
  assert.deepEqual(archiveWrites(service.requests.slice(before)), []);
  assert.equal(await service.receive(old), 'downloaded');
  assert.equal(await host.open().libraryRetirement(host.identity), undefined);
});

test('a changed or unreadable pre-unpublish archive retains its full receipt and releases unrelated retirements', async () => {
  for (const fault of ['changed', 'missing', 'transport']) {
    const service = provider({ before(method, name, context) {
      if (method === 'GET' && name === unavailableName) return context.response(503);
    } });
    let unavailableName;
    const host = retirementGateway(service);
    const old = await service.publish(Buffer.from('older backup archive'), authored(1000, '7'.repeat(32)));
    const middle = await service.publish(Buffer.from('middle backup archive'), authored(2000, '7'.repeat(32)));
    await service.publish(Buffer.from('newest backup archive'), authored(3000, '7'.repeat(32)));
    const row = await host.row(old);
    const plan = await service.transport.planRemoval(old, row.manifestSha256, service.verification);
    const journal = { schemaVersion: 1, configOperationId: host.identity, plan };
    const bytes = JSON.stringify(journal);
    host.local.set(host.journalPath, bytes);
    const name = manifestName(old);
    const original = service.remote.get(name);
    if (fault === 'changed') service.store(name, original.body, { etag: '"new-version"' });
    if (fault === 'missing') service.remote.delete(name);
    if (fault === 'transport') unavailableName = name;
    const before = service.requests.length;
    const receipt = host.open().libraryRetirementStatus(journal).receipt;
    assert.deepEqual(await host.open().leaveLibraryRetirement(receipt, currentRetirement), { state: 'retirementPaused' });
    assert.deepEqual(archiveWrites(service.requests.slice(before)), []);
    assert.equal(host.local.get(host.pausedPath(old)), bytes);
    assert.equal(await host.open().libraryRetirement(host.identity), undefined);
    assert.deepEqual(await host.open().removeLibraryArchive(row, currentRetirement), { state: 'retirementPaused' });
    unavailableName = undefined;
    service.remote.set(name, original);
    assert.deepEqual(await host.open().removeLibraryArchive(await host.row(middle), currentRetirement),
      { state: 'retirementPending' });
  }
});

test('an unavailable successor during grace permits a durable exit without further remote requests or deletion', async () => {
  const service = provider();
  const host = retirementGateway(service);
  const old = await service.publish(Buffer.from('older backup archive'), authored(1000, '7'.repeat(32)));
  const middle = await service.publish(Buffer.from('middle backup archive'), authored(2000, '7'.repeat(32)));
  const latest = await service.publish(Buffer.from('newest backup archive'), authored(3000, '7'.repeat(32)));
  const row = await host.row(old);
  assert.deepEqual(await host.open().removeLibraryArchive(row, currentRetirement), { state: 'retirementPending' });
  const active = await host.open().libraryRetirement(host.identity);
  const original = host.local.get(host.journalPath);
  const { receipt, phase } = host.open().libraryRetirementStatus(active);
  assert.equal(phase, 'waiting');
  const successor = service.remote.get(manifestName(latest));
  service.remote.delete(manifestName(latest));
  const before = service.requests.length;
  assert.deepEqual(await host.open().resumeLibraryRetirement(receipt, currentRetirement), { state: 'replacementUnverified' });
  assert.deepEqual(archiveWrites(service.requests.slice(before)), []);
  const beforeExit = service.requests.length;
  assert.deepEqual(await host.open().leaveLibraryRetirement(receipt, currentRetirement), { state: 'retirementPaused' });
  assert.equal(service.requests.length, beforeExit);
  assert.equal(await host.open().libraryRetirement(host.identity), undefined);
  assert.deepEqual(await host.open().resumeLibraryRetirement(receipt, currentRetirement), { state: 'cancelled' });
  assert.equal(host.local.get(host.pausedPath(old)), original);
  for (const name of [partName(old), retiredName(old), removedName(old)]) assert.equal(service.remote.has(name), true);
  service.remote.set(manifestName(latest), successor);
  assert.deepEqual(await host.open().removeLibraryArchive(await host.row(middle), currentRetirement),
    { state: 'retirementPending' });
});

test('uses the installed declarations and ArkTS 1.1 checks for the production transport', () => {
  const { root: loader, require, ts } = installedEtsCompiler();
  const sdk = resolve(loader, '../..');
  const official = require(loader + '/lib/ets_checker.js');
  const compilerOptions = {
    ...official.compilerOptions,
    ets: { ...official.compilerOptions.ets, libs: [loader + '/declarations/index-full.d.ts'] },
    target: ts.ScriptTarget.ES2021,
    lib: ['lib.es2021.d.ts'],
    module: ts.ModuleKind.CommonJS,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    allowNonTsExtensions: true,
    needDoArkTsLinter: true,
    isCompatibleVersion: false,
    etsLoaderPath: loader,
  };
  const declared = {
    '@reader/core-harmony': 'export type JsonObject = {[key:string]:unknown};',
    '../../../app/ReaderRuntimeOwner': `
      import type { JsonObject } from '@reader/core-harmony';
      export declare class ReaderRuntimeOwner { request(method:string, params?:JsonObject):Promise<{data:JsonObject}>; }`,
    '../../../platform/backup/LocalRecoveryFile': `
      export declare const LOCAL_RECOVERY_MAX_BYTES:number;
      type ChunkSink = (part:Uint8Array)=>Promise<void>;
      export declare function recoveryDigest(bytes:Uint8Array):Promise<string>;
      export declare function recoveryOutput(path:string, consume:(emit:ChunkSink)=>Promise<void>):Promise<void>;
      export declare function recoveryReserve(dir:string, bytes:number):Promise<void>;
      export declare function recoveryText(bytes:Uint8Array):string;
      export declare function recoveryUtf8(text:string):Uint8Array;
      export declare function recoveryVisitFile(path:string, emit:ChunkSink, current:()=>boolean, expected?:number):Promise<string>;`,
    '../../../platform/network/HttpExecuteHost': `
      import type { JsonObject } from '@reader/core-harmony';
      export interface HttpBytesResponse { status:number; bytes:Uint8Array; headers:Record<string,string>; finalUrl:string; }
      export declare class HttpExecuteHost {
        static readonly instance:HttpExecuteHost;
        executeWebDav(endpoint:string, params:JsonObject, maxBytes:number, cancelled?:()=>boolean):Promise<HttpBytesResponse>;
      }`,
    '../../bookshelf/application/LocalRecoveryGateway': `
      export interface LocalRecoveryArchiveProof {
        libraryId?:string; createdAt?:number; includedOriginals:string[];
      }`,
  };
  const paths = new Map(Object.keys(declared).map((name, index) => [name, virtualFilePath(`webdav-library-transport-port-${index}.d.ts`)]));
  const inputs = new Map(Object.entries(declared).map(([name, value]) => [paths.get(name), value]));
  const host = ts.createCompilerHost(compilerOptions);
  const original = host.getSourceFile;
  const exists = host.fileExists;
  host.fileExists = path => inputs.has(path) || exists(path);
  host.getSourceFile = (path, version, ...args) => {
    const actual = inputs.has(path) ? ts.createSourceFile(path, inputs.get(path), version, true, ts.ScriptKind.TS, compilerOptions) :
      original(path, version, ...args);
    if (actual) actual.version = '1';
    return actual;
  };
  host.resolveModuleNames = (names, from) => names.map(name => {
    if (paths.has(name)) return { resolvedFileName: paths.get(name), extension: ts.Extension.Dts, isExternalLibraryImport: true };
    if (name.startsWith('@ohos.')) return { resolvedFileName: resolve(sdk, 'api/' + name + '.d.ts'),
      extension: ts.Extension.Dts, isExternalLibraryImport: true };
    return ts.resolveModuleName(name, from, compilerOptions, host).resolvedModule;
  });
  const builder = ts.createSemanticDiagnosticsBuilderProgram([sourcePathOnHost, ...official.readDeaclareFiles()], compilerOptions, host);
  const simplify = d => ({ code: d.code, line: d.file.getLineAndCharacterOfPosition(d.start).line + 1,
    message: ts.flattenDiagnosticMessageText(d.messageText, ' ') });
  const belongs = d => d.file?.fileName === sourcePathOnHost;
  assert.deepEqual(builder.getSyntacticDiagnostics().concat(builder.getSemanticDiagnostics()).filter(belongs).map(simplify), []);
  assert.deepEqual(ts.ArkTSLinter_1_1.runArkTSLinter(builder, undefined, () => {}, '1.1').filter(belongs).map(simplify), []);
});
