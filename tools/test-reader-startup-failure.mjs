import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const owner = readFileSync('entry/src/main/ets/app/ReaderRuntimeOwner.ts', 'utf8');
const page = readFileSync(
  'entry/src/main/ets/features/startup/ReaderStartupFailurePage.ets',
  'utf8',
);
const index = readFileSync('entry/src/main/ets/pages/Index.ets', 'utf8');

const startRuntime = owner.slice(
  owner.indexOf('private async startRuntime()'),
  owner.indexOf('private requireCoreBuildIdentity'),
);
const tryIndex = startRuntime.indexOf('try {');
const createIndex = startRuntime.indexOf('createReaderCoreRuntime({');
assert.ok(tryIndex >= 0 && createIndex > tryIndex,
  'native runtime creation must be inside the startup recovery boundary');
assert.match(startRuntime, /let runtime: ReaderCoreRuntime \| undefined = undefined/);
assert.match(startRuntime, /if \(runtime !== undefined\)[\s\S]*runtime\.close\(\)/,
  'only a successfully created candidate may be closed after startup failure');
assert.match(startRuntime, /if \(this\.state === 'starting'\) \{[\s\S]*this\.state = 'new'/,
  'all startup failures must return the owner to a retryable state');

assert.match(owner, /NATIVE_STORAGE_INCOMPATIBLE_ERROR_CODE = 'RC_CREATE_STORAGE_INCOMPATIBLE'/);
assert.match(owner, /typeof error === 'object' && error !== null/);
assert.match(owner, /\(error as Record<string, unknown>\)\['code'\]/,
  'classification must inspect the standard native Error structurally');
assert.match(owner, /return \{ kind: 'storageIncompatible' \}/);
assert.match(owner, /return \{ kind: 'unavailable' \}/);
assert.doesNotMatch(owner, /class ReaderStartup.*Error/,
  'Harmony must not invent a second SDK error hierarchy');

assert.match(page, /当前版本无法读取此数据/);
assert.match(page,
  /数据由更新版本的 Reader 创建。请升级或安装相同\/更高版本后重试。现有数据未被删除或降级。/);
assert.match(page, /return 'Reader Core 当前不可用。请稍后重试。'/);
assert.doesNotMatch(page, /Reader Core 当前不可用。请稍后重试。现有数据未被更改。/,
  'generic startup failure must not promise that no prior startup work changed data');
assert.match(page, /Text\('重试'\)/);
assert.match(page, /onClick\(\(\): void => this\.onRetry\(\)\)/);
assert.doesNotMatch(page, /AppStorage|EventBus|BookshelfEmptyPage|backup|delete|downgrade|fallback/i,
  'the startup page must remain a thin visible failure surface');

assert.match(index, /@State private startupFailure: ReaderStartupFailure \| undefined = undefined/);
assert.match(index, /aboutToAppear\(\): void \{[\s\S]*void this\.startApplication\(\)/);
assert.match(index, /if \(this\.startupFailure !== undefined\) \{[\s\S]*ReaderStartupFailurePage\(\{/,
  'startup failures must own a visible top-level surface');
assert.match(index, /onRetry: \(\): void => this\.retryApplicationStartup\(\)/);
assert.match(index, /await ReaderRuntimeOwner\.current\(\)\.start\(\);[\s\S]*this\.refreshBookshelf\(\)/,
  'shelf loading must wait for a successful runtime start');
assert.match(index, /this\.startupFailure = ReaderRuntimeOwner\.classifyStartupFailure\(error\)/);
assert.doesNotMatch(index, /startupFailure[\s\S]{0,240}(backup|delete|downgrade|inMemory)/i,
  'Index must not mutate storage while presenting a startup failure');

console.log('reader startup failure contract: PASS');
