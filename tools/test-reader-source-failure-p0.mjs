import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (relative) => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const index = read('entry/src/main/ets/pages/Index.ets');
const reader = read('entry/src/main/ets/features/reading/LocalReadingExperience.ets');

const buildStart = index.indexOf('build() {');
const readerShellStart = index.indexOf('// Batch 2: the reading session UI', buildStart);
const buildRouteBlock = index.slice(buildStart, readerShellStart);
assert.match(buildRouteBlock,
  /this\.detailBook !== undefined && \(this\.route === 'detail' \|\|[\s\S]*!this\.readingSessionActive && \(this\.route === 'reading' \|\| this\.route === 'directory'\)/,
  'P0: a stale reading/directory route without a live ReaderShell must still render controllable book detail');

assert.match(index, /onExit: \(\): void => this\.onReaderExited\(\)/,
  'the reader exit callback must serialize any failure-dialog action');
const exitStart = index.indexOf('private onReaderExited(): void');
const exitEnd = index.indexOf('private closeDirectory(): void', exitStart);
const exitBlock = index.slice(exitStart, exitEnd);
assert.match(exitBlock,
  /const failureAction = this\.pendingReadingFailureAction[\s\S]*this\.returnToReadingOrigin\(\)[\s\S]*this\.openDetailSourceSwitch\(\)/,
  'P0: source switching requested before reader exit must resume from the detail-owned overlay');

const failureStart = index.indexOf('private onReadingFailure(');
const failureEnd = index.indexOf('private probeRemoteContentVerdict(', failureStart);
const failureBlock = index.slice(failureStart, failureEnd);
assert.match(failureBlock,
  /value: '重试当前源'[\s\S]*this\.retryCurrentReadingSource\(\)/,
  'source failure must keep an explicit retry action');
assert.match(failureBlock,
  /value: '选择其他书源'[\s\S]*this\.runReadingFailureActionAfterExit\('switch'\)/,
  'source failure must not jump directly into a reader-owned source-switch route');
assert.match(failureBlock,
  /if \(this\.readingSessionActive\) \{[\s\S]*this\.pendingReadingFailureAction = action[\s\S]*requestExit\(\)/,
  'an action selected before exit completes must wait for the serialized reader exit');
assert.match(failureBlock,
  /else if \(this\.route !== this\.readingOriginRoute\) \{\s*this\.returnToReadingOrigin\(\)/,
  'a late failure-dialog action must normalize any stale route back to detail');

const openSwitchStart = index.indexOf('private openSourceSwitch(): void');
const openSwitchEnd = index.indexOf('private openDetailSourceSwitch(): void', openSwitchStart);
const openSwitchBlock = index.slice(openSwitchStart, openSwitchEnd);
assert.match(openSwitchBlock,
  /if \(!this\.readingSessionActive\) \{[\s\S]*this\.returnToReadingOrigin\(\)[\s\S]*this\.openDetailSourceSwitch\(\)/,
  'the reader-owned source switch entry must fail safe to detail when no ReaderShell owns the route');

const probeStart = index.indexOf('private async probeRemoteContentVerdict(');
const probeEnd = index.indexOf('private remoteContentVerdictLabel(', probeStart);
const probeBlock = index.slice(probeStart, probeEnd);
assert.match(probeBlock,
  /preferredChapterIndex\?: number[\s\S]*entry\.index === preferredChapterIndex/,
  'shelf resume admission must probe the exact persisted chapter when available');
assert.match(probeBlock,
  /await gateway\.loadChapter[\s\S]*this\.remoteContentVerdict = 'readable'[\s\S]*return readableEntries\[attempt\]\.index/,
  'only an admitted chapter body may release the reader route');
assert.match(reader,
  /this\.onReadingFailure\(this\.sourceId, this\.bookId, this\.failureCode, failureKind\)[\s\S]*this\.beginExit\(\)/,
  'the failed reader still reports its typed source error before serialized exit');

console.log('reader source-failure P0 route contract: PASS');
