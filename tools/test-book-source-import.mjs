import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => readFileSync(resolve(repo, relative), 'utf8');
const gatewaySource = read('entry/src/main/ets/features/source/SourceGateway.ts');
const host = read('entry/src/main/ets/app/ReaderHostRegistry.ts');
const owner = read('entry/src/main/ets/app/ReaderRuntimeOwner.ts');
const orchestrator = read('entry/src/main/ets/features/source/SourceOrchestrator.ets');
const page = read('entry/src/main/ets/features/source/SourceManagementPage.ets');
const index = read('entry/src/main/ets/pages/Index.ets');

// Exercise the real gateway decoder/contract logic with an injected owner.
// The helper modules are inlined because data-URL loads cannot resolve
// relative specifiers like '../../app/ErrorMessage'.
const errorMessageModule = stripTypeScriptTypes(read('entry/src/main/ets/app/ErrorMessage.ts'))
  .replace('export function errorMessageOf', 'function errorMessageOf');
const errorMessageImport =
  /^import \{ errorMessageOf \} from ['"][^'"]*ErrorMessage(\.ts)?['"];$/m;
const sourceCategoryModule = stripTypeScriptTypes(
  read('entry/src/main/ets/features/source/ReaderSourceCategory.ts'),
).replace(/^export /gm, '');
const sourceCategoryImport =
  /^import \{ classifyReaderSource, type ReaderSourceCategory \} from ['"]\.\/ReaderSourceCategory['"];$/m;
// P1-5: the import-time URL gate lives in the shared HttpTransportPolicy;
// inline the same production module so the harness exercises the real judge.
const transportPolicyModule = stripTypeScriptTypes(
  read('entry/src/main/ets/app/HttpTransportPolicy.ts'),
).replace(/^export /gm, '');
const transportPolicyImport =
  /^import \{ httpUrlHostname, isPrivateNetworkTarget \} from ['"][^'"]*HttpTransportPolicy(\.ts)?['"];$/m;
const executableGateway = stripTypeScriptTypes(
  gatewaySource
    .replace(errorMessageImport, () => errorMessageModule)
    .replace(transportPolicyImport, () => transportPolicyModule)
    .replace(sourceCategoryImport, () => sourceCategoryModule)
    .replace(/^import url from ['"]@ohos\.url['"];$/m, 'const url = { URL };')
    .replace(/^import type \{ JsonObject \} from ['"]@reader\/core-harmony['"];$/m, '')
    .replace(/^import \{ ReaderRuntimeOwner \} from ['"]\.\.\/\.\.\/app\/ReaderRuntimeOwner['"];$/m, ''),
);
const gatewayUrl = `data:text/javascript;base64,${Buffer.from(executableGateway).toString('base64')}`;
const { SourceGateway } = await import(gatewayUrl);

const calls = [];
const runtimeOwner = {
  request: async (method, params) => {
    calls.push({ method, params });
    assert.equal(method, 'source.import');
    return {
      data: {
        sourceId: params.sourceId,
        name: params.bookSource.bookSourceName,
        imported: true,
      },
    };
  },
};
const gateway = new SourceGateway(runtimeOwner);
const single = {
  bookSourceUrl: 'https://source-a.example#remark',
  bookSourceName: '书源甲',
  enabled: true,
  ruleSearch: { bookList: 'div.item' },
};
const summary = await gateway.importBookSourceDocument(JSON.stringify(single));
assert.deepEqual(summary, {
  importedCount: 1,
  sourceIds: ['https://source-a.example#remark'],
  failedCount: 0,
  failures: [],
});
assert.deepEqual(calls[0], {
  method: 'source.import',
  params: {
    sourceId: 'https://source-a.example#remark',
    bookSource: single,
  },
});

calls.length = 0;
const second = {
  bookSourceUrl: 'https://source-b.example',
  bookSourceName: '书源乙',
  unknownLegadoField: { preserved: true },
};
assert.deepEqual(
  await gateway.importBookSourceDocument(JSON.stringify([single, second])),
  {
    importedCount: 2,
    sourceIds: ['https://source-a.example#remark', 'https://source-b.example'],
    failedCount: 0,
    failures: [],
  },
);
assert.equal(calls.length, 2, 'array imports must call Rust source.import once per item');
assert.deepEqual(calls[1].params.bookSource.unknownLegadoField, { preserved: true },
  'the gateway must forward the raw Legado object without rewriting unknown fields');

// The exact raw file shipped in every HAP is also a normal user-importable
// collection. Exercise it through the production decoder without any network
// requests or live source checks.
calls.length = 0;
const collectionDocument = read(
  'entry/src/main/resources/rawfile/reader-tested-book-source-collection.json');
const collection = JSON.parse(collectionDocument);
const collectionSummary = await gateway.importBookSourceDocument(collectionDocument);
assert.equal(collectionSummary.importedCount, collection.length);
assert.equal(collectionSummary.failedCount, 0);
assert.deepEqual(collectionSummary.sourceIds, collection.map(source => source.bookSourceUrl));
assert.equal(calls.length, collection.length,
  'the packaged collection must import every admitted source exactly once');
assert.equal(calls[0].params.bookSource.ruleFingerprint, collection[0].ruleFingerprint,
  'collection import must preserve supply metadata and the raw Legado rule object');

await assert.rejects(() => gateway.importBookSourceDocument('{'), /not valid JSON/);
await assert.rejects(() => gateway.importBookSourceDocument('[]'), /contains no sources/);

// Non-abort admission: an item that fails local validation is recorded as a
// per-item failure while the remaining items still import.
calls.length = 0;
assert.deepEqual(
  await gateway.importBookSourceDocument('null'),
  {
    importedCount: 0,
    sourceIds: [],
    failedCount: 1,
    failures: [{ index: 0, sourceId: '', message: 'Book-source document item 1 must be a JSON object' }],
  },
);
assert.equal(calls.length, 0, 'a non-object document item never reaches Core');

assert.deepEqual(
  await gateway.importBookSourceDocument(JSON.stringify({ bookSourceName: '无稳定身份' })),
  {
    importedCount: 0,
    sourceIds: [],
    failedCount: 1,
    failures: [{
      index: 0,
      sourceId: '',
      message: 'Book-source document item 1 requires a non-empty bookSourceUrl',
    }],
  },
);

const third = {
  bookSourceUrl: 'https://source-c.example',
  bookSourceName: '书源丙',
};
calls.length = 0;
assert.deepEqual(
  await gateway.importBookSourceDocument(JSON.stringify([
    single,
    { bookSourceName: '数组中无稳定身份' },
    third,
  ])),
  {
    importedCount: 2,
    sourceIds: ['https://source-a.example#remark', 'https://source-c.example'],
    failedCount: 1,
    failures: [{
      index: 1,
      sourceId: '',
      message: 'Book-source document item 2 requires a non-empty bookSourceUrl',
    }],
  },
);
assert.equal(calls.length, 2, 'an invalid item must not abort the items after it');

// P1-5 import-time url guard: a source whose primary key targets private,
// loopback, or link-local space (or is not http/https) is a per-item failure
// and never reaches Core, while public sources keep importing untouched.
calls.length = 0;
const urlGuardSummary = await gateway.importBookSourceDocument(JSON.stringify([
  single,
  { bookSourceUrl: 'http://127.0.0.1:65432/', bookSourceName: '环回' },
  { bookSourceUrl: 'http://169.254.169.254/latest/meta-data/', bookSourceName: '链路本地' },
  { bookSourceUrl: 'http://10.1.2.3/search', bookSourceName: '私网' },
  { bookSourceUrl: 'file:///etc/passwd', bookSourceName: '非 HTTP' },
  { bookSourceUrl: 'ftp://source-a.example/', bookSourceName: '非 HTTP 方案' },
]));
assert.deepEqual(urlGuardSummary.sourceIds, [single.bookSourceUrl]);
assert.equal(urlGuardSummary.importedCount, 1);
assert.equal(urlGuardSummary.failedCount, 5);
for (const failure of urlGuardSummary.failures) {
  assert.equal(failure.sourceId, '');
  assert.match(
    failure.message,
    /bookSourceUrl must be an http\(s\) URL on a public host/,
  );
}
assert.equal(calls.length, 1, 'a private-target source never reaches Core');

let item = 0;
const partialGateway = new SourceGateway({
  request: async (_method, params) => {
    item += 1;
    if (item === 2) {
      throw new Error('Core rejected source');
    }
    return { data: { sourceId: params.sourceId, name: '成功', imported: true } };
  },
});
assert.deepEqual(
  await partialGateway.importBookSourceDocument(JSON.stringify([single, second, third])),
  {
    importedCount: 2,
    sourceIds: ['https://source-a.example#remark', 'https://source-c.example'],
    failedCount: 1,
    failures: [{ index: 1, sourceId: 'https://source-b.example', message: 'Core rejected source' }],
  },
  'a Core-level item failure must not abort later items',
);

let current = true;
let cancellationCalls = 0;
const cancellationGateway = new SourceGateway({
  request: async (_method, params) => {
    cancellationCalls += 1;
    current = false;
    return { data: { sourceId: params.sourceId, name: '已持久化', imported: true } };
  },
});
await assert.rejects(
  () => cancellationGateway.importBookSourceDocument(
    JSON.stringify([single, second]),
    () => current,
  ),
  /cancelled after 1 successful import\(s\): page session changed/,
);
assert.equal(cancellationCalls, 1, 'a stale page must not submit the next source.import');

// List projection exposes the real Legado group from the raw Core payload.
const listGateway = new SourceGateway({
  request: async (method) => {
    assert.equal(method, 'source.list');
    return {
      data: {
        sources: [{
          sourceId: single.bookSourceUrl,
          name: single.bookSourceName,
          baseUrl: 'https://source-a.example',
          enabled: true,
          enabledExplore: true,
          bookSource: {
            bookSourceGroup: '小说',
            loginUrl: 'https://source-a.example/login',
          },
        }],
      },
    };
  },
});
assert.deepEqual(await listGateway.loadSources(), [{
  sourceId: single.bookSourceUrl,
  name: single.bookSourceName,
  baseUrl: 'https://source-a.example',
      enabled: true,
      enabledExplore: true,
      group: '小说',
      category: 'novel',
      loginUrl: 'https://source-a.example/login',
}]);

// Product debug consumes the Host evidence captured by the same real
// source.check.run command; no second empty-response replay is needed.
let checkParams;
const checkGateway = new SourceGateway({
  request: async (method, params) => {
    assert.equal(method, 'source.check.run');
    checkParams = params;
    return {
      requestId: 91,
      data: {
        traceId: 'source.check.run:91:1',
        results: [{
          sourceId: single.bookSourceUrl,
          available: true,
          levelsPassed: ['L1', 'L2', 'L3', 'L4', 'L5'],
          durationMs: 88,
          debugLogs: [{
            state: 1,
            msg: 'L2 搜索解析完成：1 本书',
            timestampMs: 12,
            step: 'search',
            extractedCount: 1,
          }, {
            state: 1000,
            msg: '真实检测完成（88ms）',
            timestampMs: 88,
            step: 'content',
          }],
        }],
      },
    };
  },
  takeSourceHttpDiagnostics: (requestId) => {
    assert.equal(requestId, 91);
    return [{
      traceId: 'source.check.run:91:1',
      requestId: 91,
      sourceId: single.bookSourceUrl,
      stage: 'L2',
      method: 'GET',
      url: 'https://source-a.example/search',
      timestampMs: 1000,
      durationMs: 12,
      statusCode: 200,
    }];
  },
});
const checked = await checkGateway.checkSource(single.bookSourceUrl, () => true, '读者');
assert.equal(checkParams.keyword, '读者');
assert.equal(checked.available, true);
assert.equal(checked.traceId, 'source.check.run:91:1');
assert.equal(checked.hostEvidenceCount, 1);
assert.equal(checked.logs.length, 3);
assert.match(checked.logs[0].message, /\[Core\] L2 搜索解析完成/);
assert.equal(checked.logs[0].extractedCount, 1);
assert.match(checked.logs[2].message, /\[Host\] L2 GET https:\/\/source-a\.example\/search → HTTP 200/);
assert.ok(checked.logs.every((log) => log.traceId === checked.traceId));

const mismatchGateway = new SourceGateway({
  request: async () => ({
    requestId: 92,
    data: {
      traceId: 'source.check.run:92:1',
      results: [{
        sourceId: single.bookSourceUrl,
        available: false,
        levelsPassed: ['L1'],
        failureReason: 'L2: host HTTP failed',
        durationMs: 5,
        debugLogs: [{ state: -1, msg: 'L2 failed', timestampMs: 5, step: 'search' }],
      }],
    },
  }),
  takeSourceHttpDiagnostics: () => [{
    traceId: 'wrong-trace',
    requestId: 92,
    sourceId: single.bookSourceUrl,
    stage: 'L2',
    method: 'GET',
    url: 'https://source-a.example/search',
    timestampMs: 1000,
    durationMs: 5,
    statusCode: 500,
  }],
});
await assert.rejects(
  () => mismatchGateway.checkSource(single.bookSourceUrl),
  /Host evidence correlation mismatch/,
);

// Host: one JSON picker, bounded bytes, chunked read, fatal UTF-8, no staging.
assert.match(host, /selectBoundedJsonDocument\('Legado 书源 JSON'\)/);
assert.match(host, /fileSuffixFilters = \[`\$\{label\}\|\.json`\]/);
assert.match(host, /options\.maxSelectNumber = 1/);
assert.match(host, /JsonDocumentLimitBytes = 16 \* 1024 \* 1024/);
assert.match(host, /JsonDocumentReadChunkBytes = 64 \* 1024/);
assert.match(host, /readBoundedUtf8Document\([\s\S]*fileIo\.stat\(uri\)/);
assert.match(host, /while \(totalBytes < stat\.size\)[\s\S]*fileIo\.read/);
assert.match(host, /new ArrayBuffer\(1\)[\s\S]*changed while being read/);
assert.match(host, /TextDecoder\.create\('utf-8', \{ fatal: true \}\)/);
const sourcePickerStart = host.indexOf('async selectBookSourceJson(');
const sourcePickerEnd = host.indexOf('async commitLocalBookInput(', sourcePickerStart);
assert.ok(sourcePickerStart >= 0 && sourcePickerEnd > sourcePickerStart);
const sourcePicker = host.slice(sourcePickerStart, sourcePickerEnd);
assert.doesNotMatch(sourcePicker, /stageLocalBook/,
  'book-source JSON must not enter the local-book staging/asset pipeline');
assert.match(owner, /async selectBookSourceJson\(\)[\s\S]*this\.host\.selectBookSourceJson\(\)/);

// UI/orchestration: real button intent, serialized mutation, refresh, real log.
assert.match(page, /onAddSource: \(\) => void/);
assert.match(page, /\.onClick\(\(\): void => this\.onAddSource\(\)\)/);
assert.match(index, /onAddSource: \(\): void => this\.openJsonImport\('bookSource'\)/);
assert.match(index, /this\.getSourceOrchestrator\(\)\.importBookSources\(/);
assert.match(orchestrator, /this\.operationChain = this\.operationChain[\s\S]*applyBookSourceImport/);
assert.match(orchestrator,
  /applyBookSourceImport\([\s\S]*session: number,[\s\S]*onlineUrl\?: string,[\s\S]*selectBookSourceJson\(\)[\s\S]*loadOnlineJsonDocument\(onlineUrl\)/);
assert.match(orchestrator, /selection === undefined \|\| !this\.isCurrentSession\(session\)/,
  'a picker completion from an old page session must not begin Core imports');
assert.match(orchestrator, /importBookSourceDocument\([\s\S]*this\.isCurrentSession\(session\)[\s\S]*gateway\.loadSources\(\)/);
assert.match(orchestrator, /Book-source import failed; page kept unchanged/);
assert.match(orchestrator, /Core 已导入 \$\{importedCount\} 个书源，但列表刷新失败/);
assert.match(orchestrator, /publishStatus\('error', `书源列表读取失败/);
assert.match(orchestrator, /isReaderCoreTransactionPendingError\(error\)/);
assert.doesNotMatch(orchestrator, /error\.message\.indexOf|error\.message\.includes/);
assert.doesNotMatch(orchestrator, /devSeed|fixture|mock|fake/i);

console.log('book-source production import contract: PASS');
