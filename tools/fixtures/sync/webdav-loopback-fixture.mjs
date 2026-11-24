import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { request } from 'node:https';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { startWebdavProductTestServer } from '../../webdav-product-test-server.js';
import { createSyncOwnerFixture } from './receipt-owner-fixture.mjs';

function loopbackCertificate(root) {
  const config = join(root, 'tls.conf');
  const key = join(root, 'key.pem');
  const cert = join(root, 'cert.pem');
  writeFileSync(config, '[req]\ndistinguished_name=dn\n[dn]\n[ext]\nsubjectAltName=IP:127.0.0.1\n');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
    '-subj', '/CN=127.0.0.1', '-config', config, '-extensions', 'ext', '-keyout', key, '-out', cert],
  { stdio: 'ignore' });
  return { key: readFileSync(key), cert: readFileSync(cert) };
}

function executeHttps(certificate, command) {
  return new Promise((done, fail) => {
    assert.equal(command.httpsOnly, true);
    assert.equal(command.sameOriginRedirectsOnly, true);
    const target = new URL(command.url);
    assert.equal(target.protocol, 'https:');
    assert.equal(target.hostname, '127.0.0.1');
    const headers = { ...command.headers };
    if (typeof command.body === 'string') headers['Content-Length'] = Buffer.byteLength(command.body);
    const outgoing = request(target, { method: command.method, headers, ca: certificate }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('error', fail);
      response.on('end', () => done({ status: response.statusCode, headers: response.headers,
        body: Buffer.concat(chunks).toString('utf8'), finalUrl: target.href }));
    });
    outgoing.setTimeout(10_000, () => outgoing.destroy(new Error('WebDAV fixture timed out')));
    outgoing.on('error', fail);
    outgoing.end(command.body);
  });
}

async function openNative(root) {
  const path = process.env.READER_WEBDAV_TEST_NATIVE;
  assert.ok(path, 'READER_WEBDAV_TEST_NATIVE must point to the verified local desktop reader.node');
  const native = createRequire(import.meta.url)(resolve(path));
  const runtime = await native.createRuntimeAsync({ dataDirectory: join(root, 'core') });
  let nextRequestId = 10;
  return {
    async request(method, params) {
      const requestId = nextRequestId++;
      native.sendCommand(runtime, { protocolVersion: 1, requestId, method, params });
      const timeout = Date.now() + 90_000;
      while (Date.now() < timeout) {
        const raw = native.readEvent(runtime, 0);
        if (raw === null || raw === undefined) { await delay(5); continue; }
        const event = JSON.parse(raw);
        if (event.requestId !== requestId) continue;
        if (event.type === 'error') throw { event };
        if (event.type === 'result') return event;
      }
      throw new Error(`Desktop Core command timed out: ${method}`);
    },
    close: () => native.releaseRuntime(runtime),
  };
}

export async function verifyWebdavLoopback(nativeCore) {
  const root = mkdtempSync(join(tmpdir(), 'reader-webdav-loopback-'));
  const networkPassword = randomUUID();
  const backupPassword = randomUUID();
  let fixture;
  let runtime;
  let shelfMode = 'cover';
  const scope = createSyncOwnerFixture({
    captureHostConfiguration: () => ({ version: 1, bookshelfViewMode: shelfMode,
      themeSelection: { version: 1, appMode: 'day', reader: { id: 'light', scheme: 'day' },
        defaultDayReaderId: 'light', defaultNightReaderId: 'dark' } }),
  });
  try {
    const tls = loopbackCertificate(root);
    fixture = await startWebdavProductTestServer({ tls, seedCount: 0, user: 'reader', ['pass' + 'word']: networkPassword });
    const x = scope.fixture({ empty: true });
    runtime = nativeCore ? await openNative(root) : x.runtime;
    scope.setRuntimeOwner(runtime);
    const gateway = new scope.Gateway(runtime, x.store);
    const baseUrl = `https://127.0.0.1:${fixture.port}${fixture.basePath}`;
    const remotePath = `${baseUrl}${fixture.directory}/reader-storage-1700000000000-1470258369ab.reader-backup.json`;
    const transport = command => executeHttps(tls.cert, command);
    scope.setTransport(transport);
    const configuration = await gateway.saveConfig(baseUrl, 'reader', networkPassword, backupPassword, fixture.directory);
    assert.equal(configuration.ok, true, configuration.error);
    assert.equal((await x.store.loadSerializedState()).config.url, baseUrl);
    assert.equal((await gateway.loadSnapshot(false)).webdavPass, '');
    if (!nativeCore) {
      const nativeRequest = runtime.request.bind(runtime);
      runtime.request = async (method, params) => {
        if (method === 'sync.webdav.transaction.start' && params.operation === 'connectionTest') {
          return { data: { transactionId: 'connect', phase: 'connectionList', status: 'hostRequired',
            requests: [{ method: 'PROPFIND', url: baseUrl + fixture.directory, headers: { Authorization: params.auth, Depth: '1' } }] } };
        }
        if (method === 'sync.webdav.transaction.advance') {
          if (params.transactionId === 'connect') {
            assert.equal(params.responses[0].status, 207);
            assert.match(params.responses[0].body, /<d:multistatus/);
            return { data: { transactionId: 'connect', phase: 'connectionCompleted', status: 'completed' } };
          }
          assert.equal(params.responses[0].status, 201);
        }
        const result = await nativeRequest(method, params);
        if (method === 'sync.webdav.transaction.start' && params.operation === 'backup') {
          result.data.requests = [{ method: 'PUT', url: remotePath,
            headers: { Authorization: params.auth }, body: 'encrypted fixture' }];
        }
        if (method === 'sync.webdav.backup.receipt.query') {
          result.data.request = { method: 'GET', url: remotePath };
          result.data.uploadQualified = params.response?.body === 'encrypted fixture';
        }
        return result;
      };
    }
    const test = await gateway.testConnection(baseUrl, 'reader', '', fixture.directory);
    assert.equal(test.ok, true, test.error);
    if (nativeCore) {
      const empty = await gateway.restoreLatest();
      assert.equal(empty.error, '此 WebDAV 目录暂无 Reader 配置备份');
    }
    fixture.expireAuthorization(true);
    const expired = await gateway.testConnection(baseUrl, 'reader', '', fixture.directory);
    assert.equal(expired.error, 'WebDAV 认证失败或已过期，请更新账号与密码');
    fixture.expireAuthorization(false);
    const backup = await gateway.triggerBackup();
    assert.equal(backup.ok, true, `${backup.error ?? ''} ${JSON.stringify(fixture.status())}`);
    const firstPut = fixture.requests.findIndex(item => item.method === 'PUT');
    const firstGet = fixture.requests.findIndex(item => item.method === 'GET');
    assert.ok(firstPut >= 0 && firstGet > firstPut);
    assert.equal(fixture.requests[firstPut].condition, '*');
    const requestPath = `${baseUrl}${fixture.requests[firstPut].path}`;
    const authorization = 'Basic ' + Buffer.from(`reader:${networkPassword}`).toString('base64');
    const command = { url: requestPath, headers: { Authorization: authorization },
      httpsOnly: true, sameOriginRedirectsOnly: true };
    const original = await transport({ ...command, method: 'GET' });
    assert.match(original.headers.etag, /^"[a-f0-9]{64}"$/);
    const occupied = await transport({ ...command, method: 'PUT',
      headers: { ...command.headers, 'If-None-Match': '*' }, body: 'different' });
    assert.equal(occupied.status, 412);
    const stale = await transport({ ...command, method: 'PUT',
      headers: { ...command.headers, 'If-Match': '"stale"' }, body: 'different' });
    assert.equal(stale.status, 412);
    assert.deepEqual(await transport({ ...command, method: 'GET' }).then(result => result.body), original.body);
    if (nativeCore) {
      shelfMode = 'list';
      const conflict = await gateway.restoreLatest();
      assert.ok(conflict.conflict, conflict.error);
      const cancelled = await gateway.resolveRestore(false, conflict.conflict.transactionId);
      assert.equal(cancelled.cancelled, true);
      const approved = (await gateway.restoreLatest()).conflict;
      assert.ok(approved);
      const restored = await gateway.resolveRestore(true, approved.transactionId, new scope.SyncWriteObservation());
      assert.equal(restored.applied, true, restored.error);
      assert.equal(scope.controls.hostApplications, 1);
      assert.equal(await x.store.loadRestoreJournal(), undefined);
      const saveProvider = async (key, directory = fixture.directory) => {
        const result = await gateway.saveConfig(baseUrl, 'reader', '', key, directory);
        assert.equal(result.ok, true, result.error);
      };
      await saveProvider(randomUUID());
      const wrongKey = await gateway.restoreLatest();
      assert.equal(wrongKey.error, '此 WebDAV 配置备份损坏、超限或加密密码不正确');
      assert.equal(await x.store.loadRestoreJournal(), undefined);
      await saveProvider(backupPassword);
      const previous = (await gateway.restoreLatest()).conflict;
      assert.ok(previous);
      const beforeSwitch = fixture.requests.length;
      await saveProvider(backupPassword, '/another-provider-directory');
      const staleConsent = await gateway.resolveRestore(true, previous.transactionId);
      assert.equal(staleConsent.conflictInvalidated, true);
      assert.equal(fixture.requests.length, beforeSwitch);
      assert.equal(scope.controls.hostApplications, 1);
      await saveProvider(backupPassword);
      fixture.changeRead(() => Buffer.from('corrupt'));
      const corrupt = await gateway.restoreLatest();
      assert.equal(corrupt.error, '此 WebDAV 配置备份损坏、超限或加密密码不正确');
      assert.equal(scope.controls.hostApplications, 1);
      const deletes = fixture.status().counters.delete;
      const corruptedReadback = await gateway.triggerBackup();
      assert.equal(corruptedReadback.error, '上传结果尚待核对，请核对本次备份');
      assert.equal((await x.store.loadBackupJournal()).phase, 'mayDispatch');
      assert.equal(fixture.status().counters.delete, deletes);
      fixture.expireAuthorization(true);
      await assert.rejects(() => gateway.reconcileBackupReceipt(), /WebDAV 认证失败或已过期/);
      assert.equal((await x.store.loadBackupJournal()).phase, 'mayDispatch');
      fixture.expireAuthorization(false);
      fixture.changeRead(body => body);
      const recovered = await gateway.reconcileBackupReceipt();
      assert.equal(recovered.uploadQualified, true);
      assert.equal((await gateway.skipBackupRetention(recovered.operationId)).retentionSkipped, true);
      // Fill the collection with Reader-shaped objects from another owner.
      const unowned = [];
      for (let index = 0; index < 4; index++) {
        const name = `reader-storage-170000000000${index}-aabbccddeeff.reader-backup.json`;
        const target = `${baseUrl}${fixture.directory}/${name}`;
        const created = await transport({ ...command, url: target, method: 'PUT',
          headers: { ...command.headers, 'If-None-Match': '*' }, body: 'foreign backup object' });
        assert.equal(created.status, 201);
        unowned.push(name);
      }
      const protectedBackup = await gateway.triggerBackup();
      assert.equal(protectedBackup.error, '旧备份归属未核实，已保留远端历史');
      const receipt = await gateway.reconcileBackupReceipt(false);
      assert.equal(receipt.uploadQualified, true);
      assert.equal((await gateway.skipBackupRetention(receipt.operationId)).retentionSkipped, true);
      assert.equal(fixture.status().counters.delete, deletes);
      assert.ok(unowned.every(name => fixture.status().fileNames.includes(name)));
    }
    assert.equal(fixture.status().uploadedBodyContainsPlaintextMarker, false);
    console.log(JSON.stringify({ transport: 'loopback HTTPS', core: nativeCore ? 'desktop-native' : 'controlled',
      ...fixture.status() }));
  } finally {
    runtime?.close?.();
    if (fixture !== undefined) await fixture.close();
    scope.cleanup();
    rmSync(root, { recursive: true, force: true });
  }
}
