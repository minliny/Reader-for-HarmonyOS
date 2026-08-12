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
const detail = read('entry/src/main/ets/features/bookshelf/LocalBookDetail.ets');

// Exercise the real gateway decoder/contract logic with an injected owner.
const executableGateway = stripTypeScriptTypes(
  gatewaySource
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
  },
);
assert.equal(calls.length, 2, 'array imports must call Rust source.import once per item');
assert.deepEqual(calls[1].params.bookSource.unknownLegadoField, { preserved: true },
  'the gateway must forward the raw Legado object without rewriting unknown fields');

await assert.rejects(() => gateway.importBookSourceDocument('{'), /not valid JSON/);
await assert.rejects(() => gateway.importBookSourceDocument('[]'), /contains no sources/);
await assert.rejects(() => gateway.importBookSourceDocument('null'), /must be a JSON object/);
await assert.rejects(
  () => gateway.importBookSourceDocument(JSON.stringify({ bookSourceName: '无稳定身份' })),
  /requires a non-empty bookSourceUrl/,
);
calls.length = 0;
await assert.rejects(
  () => gateway.importBookSourceDocument(JSON.stringify([
    single,
    { bookSourceName: '数组中无稳定身份' },
  ])),
  /item 2 requires a non-empty bookSourceUrl/,
);
assert.equal(calls.length, 0, 'the full local envelope must validate before the first Core write');

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
await assert.rejects(
  () => partialGateway.importBookSourceDocument(JSON.stringify([single, second])),
  /item 2\/2 after 1 successful import\(s\): Core rejected source/,
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

// Host: one JSON picker, bounded bytes, chunked read, fatal UTF-8, no staging.
assert.match(host, /selectBoundedJsonDocument\('Legado 书源 JSON'\)/);
assert.match(host, /fileSuffixFilters = \[`\$\{label\}\|\.json`\]/);
assert.match(host, /options\.maxSelectNumber = 1/);
assert.match(host, /BookSourceDocumentLimitBytes = 16 \* 1024 \* 1024/);
assert.match(host, /BookSourceReadChunkBytes = 64 \* 1024/);
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
assert.match(index, /onAddSource: \(\): void => this\.onBookSourceImportRequested\(\)/);
assert.match(index, /this\.getSourceOrchestrator\(\)\.importBookSources\(\)/);
assert.match(orchestrator, /this\.operationChain = this\.operationChain[\s\S]*applyBookSourceImport/);
assert.match(orchestrator, /applyBookSourceImport\(session: number\)[\s\S]*if \(!this\.isCurrentSession\(session\)\)[\s\S]*selectBookSourceJson\(\)/);
assert.match(orchestrator, /selection === undefined \|\| !this\.isCurrentSession\(session\)/,
  'a picker completion from an old page session must not begin Core imports');
assert.match(orchestrator, /importBookSourceDocument\([\s\S]*this\.isCurrentSession\(session\)[\s\S]*gateway\.loadSources\(\)/);
assert.match(orchestrator, /Book-source import failed; page kept unchanged/);
assert.match(orchestrator, /isReaderCoreTransactionPendingError\(error\)/);
assert.doesNotMatch(orchestrator, /error\.message\.indexOf|error\.message\.includes/);
assert.doesNotMatch(orchestrator, /devSeed|fixture|mock|fake/i);
assert.match(detail, /onSwitchSource: \(\) => void/);
assert.match(detail, /\.onClick\(\(\): void => this\.onSwitchSource\(\)\)/);
assert.match(index, /onSwitchSource: \(\): void => this\.openSourceSwitchFromDetail\(\)/);
const detailSwitchStart = index.indexOf('private openSourceSwitchFromDetail(): void');
const detailSwitchEnd = index.indexOf('private openSourceSwitch(): void', detailSwitchStart);
assert.ok(detailSwitchStart >= 0 && detailSwitchEnd > detailSwitchStart,
  'the Detail source-switch lifecycle must stay explicit');
const detailSwitch = index.slice(detailSwitchStart, detailSwitchEnd);
assert.match(detailSwitch, /this\.openReading\(undefined\)/,
  'Detail must activate the existing ReaderShell before opening its overlay');
assert.match(detailSwitch, /this\.sourceSwitchPendingFromDetail = true/);
assert.ok(detailSwitch.indexOf('this.openReading(undefined)') <
  detailSwitch.indexOf('this.sourceSwitchPendingFromDetail = true'),
  'the pending intent is admitted only after normal reader preparation succeeds');
assert.doesNotMatch(detailSwitch, /this\.openSourceSwitch\(\)/,
  'candidate discovery must not open before the reader restores the exact chapter');
const committedStart = index.indexOf('private onReaderChapterCommitted(');
const committedEnd = index.indexOf('private refreshBookshelf(', committedStart);
assert.ok(committedStart >= 0 && committedEnd > committedStart);
const committed = index.slice(committedStart, committedEnd);
const applyCommitted = committed.indexOf('this.applyDirectoryChapter(chapterIndex, chapterTitle)');
const openCommitted = committed.indexOf('this.openSourceSwitch()');
assert.ok(applyCommitted >= 0 && openCommitted > applyCommitted,
  'the exact committed chapter must be projected before candidate selection becomes possible');
assert.match(committed, /this\.sourceSwitchOpenedFromDetail = this\.sourceSwitchVisible/);
const closeSwitchStart = index.indexOf('private closeSourceSwitch(): void');
const closeSwitchEnd = index.indexOf('private performSourceSwitchSeam(', closeSwitchStart);
const closeSwitch = index.slice(closeSwitchStart, closeSwitchEnd);
assert.match(closeSwitch, /const returnToDetail = this\.sourceSwitchOpenedFromDetail/);
assert.match(closeSwitch, /requestExit\(\)[\s\S]*this\.returnToDetail\(\)/,
  'closing a Detail-owned switch window must tear down the hidden reader and return to Detail');
assert.match(page, /source\.checkMessage !== undefined && source\.checkMessage\.length > 0/);
assert.doesNotMatch(page, /source\.checkState !== 'unchecked'/,
  'an unchecked cancellation projection must remain visible to the user');
assert.match(orchestrator, /code === 'CANCELLED'[\s\S]*登录 \/ 验证已取消/);
assert.match(orchestrator, /setCheckProjection\(id, 'failed', \[\], message\)/,
  'TIMEOUT and other host failures must not be mislabeled as user cancellation');

console.log('book-source production import contract: PASS');
