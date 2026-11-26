import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { installedEtsCompiler } from './lib/ets-compiler-runtime.mjs';
import { pureModuleProbe } from './lib/ets-pure-module-probe.mjs';
import { virtualFilePath } from './lib/tool-environment.mjs';

const sourcePathOnHost = fileURLToPath(new URL('../entry/src/main/ets/features/sync/application/WebDavLibraryBackup.ts', import.meta.url));
const source = readFileSync(sourcePathOnHost, 'utf8');
const base = 'https://backup.example.invalid/dav';
const directory = '/reader-library';
const collection = base + directory + '/';
const sourcePath = '/sandbox/staged.readerbackup';
const restoredPath = '/sandbox/restored.readerbackup';
const maximum = 512 * 1024 * 1024;
const partBytes = 4 * 1024 * 1024;
const manifestName = hash => `reader-library-v1-${hash}.manifest`;
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const reason = expected => error => error.name === 'Error' && error.reason === expected;

function provider(options = {}) {
  const files = new Map();
  const remote = new Map();
  const requests = [];
  const calls = [];
  let clock = 1780000000000;
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
          assert.deepEqual(params, { baseUrl: base, directory }, 'credentials stay in the Host');
          return { data: { request: { method: 'PROPFIND', url: base + directory, headers: { Depth: '1' }, body: '<propfind/>' } } };
        case 'sync.webdav.multistatus.parse':
          assert.equal(params.response.status, 207);
          if (options.invalidListing) throw new Error('malformed provider listing');
          return { data: { resources: [
            ...Array.from(remote, ([name, data]) => ({ href: collection + name, lastModified: data.modified })),
            ...(options.extraListings ?? []),
          ] } };
        default: assert.fail(`unexpected Core request ${method}`);
      }
    },
  };

  const http = {
    async executeBounded(params, limit, _requestId, cancelled) {
      assert.equal(params.httpsOnly, true);
      assert.equal(params.sameOriginRedirectsOnly, true);
      assert.equal(params.followRedirects, false);
      assert.equal(params.headers.Authorization, credentials);
      assert.equal(cancelled(), false);
      assert.ok(params.url.startsWith(collection));
      assert.ok(limit > 0 && limit < 16 * 1024 * 1024);
      const name = params.url.slice(collection.length);
      requests.push({ method: params.method, name, condition: params.headers['If-None-Match'] });
      const fault = await options.before?.(params.method, name, { remote, store, retire: () => { active = false; } });
      if (fault !== undefined) return fault;
      if (params.method === 'PROPFIND') return { status: hasDirectory ? 207 : 404, body: '<multistatus/>' };
      if (params.method === 'MKCOL') { hasDirectory = true; return { status: 201 }; }
      if (params.method === 'GET') {
        const item = remote.get(name);
        if (item === undefined) {
          if (options.bodyless) throw new Error('http.execute: source returned HTTP 404 without response content');
          return { status: 404, body: '' };
        }
        if (params.headers['If-Match'] !== undefined && params.headers['If-Match'] !== item.etag) {
          return { status: 412 };
        }
        assert.ok(item.body.length <= limit);
        const headers = { ETag: options.weakEtag ? `W/${item.etag}` : item.etag };
        return options.textOnly ? { status: 200, body: item.body.toString(), headers } :
          { status: 200, bodyBase64: item.body.toString('base64'), headers };
      }
      assert.equal(params.method, 'PUT', 'manual publisher never deletes or overwrites through another verb');
      assert.equal(params.headers['If-None-Match'], '*');
      assert.equal(params.headers['Content-Type'], 'application/octet-stream');
      if (remote.has(name) && !options.ignoreConditions) {
        if (options.bodyless) throw new Error('http.execute: source returned HTTP 412 without response content');
        return { status: 412 };
      }
      store(name, params.body);
      await options.afterPut?.(name, { remote, store, retire: () => { active = false; } });
      return { status: 201 };
    },
  };

  const { WebDavLibraryBackup } = pureModuleProbe(source, 'WebDavLibraryBackup.ts', {
    LOCAL_RECOVERY_MAX_BYTES: maximum,
    recoveryDigest: async bytes => digest(bytes),
    recoveryReserve: async (path, bytes) => { assert.equal(path, '/sandbox'); assert.ok(bytes <= maximum); },
    recoveryText: bytes => new TextDecoder('utf-8', { fatal: true }).decode(bytes),
    recoveryUtf8: text => Buffer.from(text),
    recoveryOutput: async (path, consume) => {
      assert.equal(path, restoredPath);
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
    url: { URL: { parseURL: (value, baseUrl) => new URL(value, baseUrl) } },
    util: { Base64Helper: class {
      encodeToStringSync(bytes) { return Buffer.from(bytes).toString('base64'); }
      decodeSync(text) { return Buffer.from(text, 'base64'); }
    } },
  }, ['WebDavLibraryBackup']);
  const assertCurrent = async () => {
    if (!active) throw new Error('original provider retired');
  };
  const transport = new WebDavLibraryBackup(runtime, { url: base, directory }, credentials, assertCurrent, () => !active);

  return {
    transport, requests, calls, remote, store, files,
    async publish(bytes) {
      files.set(sourcePath, bytes);
      const hash = digest(bytes);
      await transport.publish(sourcePath, hash, bytes.length);
      return hash;
    },
    async receive() { return transport.downloadLatest(restoredPath); },
  };
}

test('publishes verified chunks before the immutable manifest and restores the exact encrypted archive', async () => {
  const service = provider({ hasDirectory: false, bodyless: true,
    extraListings: [{ href: 'https://outside.example.invalid/' + manifestName('2'.repeat(64)), lastModified: 'Nov 1, 2060' }],
  });
  const bytes = Buffer.alloc(partBytes + 137, 0x65);
  const hash = await service.publish(bytes);
  const remoteNames = Array.from(service.remote.keys());
  assert.deepEqual(remoteNames, [
    `reader-library-v1-${hash}.probe`, `reader-library-v1-${hash}.000.part`,
    `reader-library-v1-${hash}.001.part`, manifestName(hash),
  ]);
  const writes = service.requests.filter(item => item.method === 'PUT');
  assert.equal(writes.at(-1).name, manifestName(hash));
  assert.equal(service.requests.at(-1).method, 'GET');
  const rawManifest = JSON.parse(service.remote.get(manifestName(hash)).body.toString());
  assert.deepEqual(rawManifest, { format: 'reader.library.webdav', version: 1, sha256: hash,
    bytes: bytes.length, parts: [digest(bytes.subarray(0, partBytes)), digest(bytes.subarray(partBytes))] });
  assert.equal(await service.receive(), 'downloaded');
  assert.deepEqual(service.files.get(restoredPath), bytes);
  assert.ok(service.calls.includes('sync.webdav.multistatus.parse'));
});

test('conditional creation failure and weak or unprovable ETags keep the destination read-only', async () => {
  for (const options of [{ ignoreConditions: true }, { weakEtag: true }, { textOnly: true }]) {
    const service = provider(options);
    await assert.rejects(service.publish(Buffer.from('ciphertext')), reason('readOnly'));
    assert.deepEqual(Array.from(service.remote.keys()).map(name => name.split('.').at(-1)), ['probe']);
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

test('keeps empty, absent, access denied, and ambiguous latest states distinct', async () => {
  const empty = provider();
  assert.equal(await empty.receive(), 'empty');
  await assert.rejects(provider({ hasDirectory: false }).receive(), reason('missing'));
  const denied = provider({ before() { throw new Error('http.execute: source returned HTTP 401 without response content'); } });
  await assert.rejects(denied.receive(), reason('authentication'));
  const first = await empty.publish(Buffer.from('first'));
  const second = await empty.publish(Buffer.from('second'));
  empty.remote.get(manifestName(second)).modified = empty.remote.get(manifestName(first)).modified;
  await assert.rejects(empty.receive(), reason('conflict'));
});

test('rejects a malformed multistatus before writing any object', async () => {
  const service = provider({ invalidListing: true });
  await assert.rejects(service.publish(Buffer.from('archive')), reason('failed'));
  assert.deepEqual(service.requests.map(item => item.method), ['PROPFIND']);
});

test('downloads a checked snapshot in read-only mode and detects a racing manifest update', async () => {
  const writer = provider();
  const bytes = Buffer.from('secure portable archive');
  const sha = await writer.publish(bytes);
  const reader = provider({ textOnly: true, weakEtag: true });
  for (const [name, item] of writer.remote) reader.store(name, item.body);
  assert.equal(await reader.receive(), 'downloaded');
  assert.deepEqual(reader.files.get(restoredPath), bytes);
  assert.ok(reader.requests.every(item => item.method !== 'PUT'));

  const raced = provider({ before(method, name, owner) {
    if (method === 'GET' && name.endsWith('.part')) owner.store(manifestName(sha), 'successor manifest');
  } });
  for (const [name, item] of writer.remote) raced.store(name, item.body);
  await assert.rejects(raced.receive(), reason('conflict'));
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
      export declare class HttpExecuteHost {
        static readonly instance:HttpExecuteHost;
        executeBounded(params:JsonObject, maxBytes:number, requestId?:number, cancelled?:()=>boolean):Promise<JsonObject>;
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
