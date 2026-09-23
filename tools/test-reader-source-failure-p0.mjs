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
  'the reader exit callback must retain the normal serialized exit route');
const exitStart = index.indexOf('private onReaderExited(): void');
const exitEnd = index.indexOf('private closeDirectory(): void', exitStart);
const exitBlock = index.slice(exitStart, exitEnd);
assert.doesNotMatch(exitBlock, /pendingReadingFailureAction|openDetailSourceSwitch\(/,
  'PH116: source-error recovery belongs to the mounted reader, not an exit-then-detail detour');
assert.match(exitBlock, /this\.returnToReadingOrigin\(\);\s*\}/,
  'ordinary reader exit must still return to its original route');

const failureStart = index.indexOf('private onReadingFailure(');
const failureEnd = index.indexOf('private onRemoteSessionReady(', failureStart);
const failureBlock = index.slice(failureStart, failureEnd);
assert.doesNotMatch(failureBlock, /showAlertDialog|requestExit\(|readingSessionActive = false|rollbackPendingSourceSwitch/,
  'PH116 failure remains inside the owned reader instead of exiting or rolling back');
assert.match(failureBlock, /this\.detailBook\?\.sourceId !== sourceId[\s\S]*this\.detailBook\?\.bookId !== bookId/,
  'a late error from another identity cannot affect this reader');
const errorSurface = reader.slice(reader.indexOf('private readingFailureContent()'), reader.indexOf('private errorMessage('));
for (const label of ['重试', '阅读设置', '切换书源']) assert.ok(errorSurface.includes(`Button('${label}')`));
assert.match(errorSurface, /this\.retryReading\(\)/);
assert.match(errorSurface, /this\.openReaderControl\(\)/);
assert.match(errorSurface, /this\.onSwitchSource\(\)/);

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
  'explicit detail probes must honor their requested chapter');
assert.match(probeBlock,
  /await gateway\.loadChapter[\s\S]*this\.remoteContentVerdict = 'readable'[\s\S]*return readableEntries\[attempt\]\.index/,
  'only an admitted chapter body may mark a detail probe readable');
const terminalFailure = reader.slice(reader.indexOf('private fail('), reader.indexOf('private retryReading('));
assert.match(terminalFailure, /this\.onReadingFailure\(this\.sourceId, this\.bookId, this\.failureCode, failureKind\)/);
assert.match(terminalFailure, /this\.chapterSelectionToken \+= 1/,
  'keeping the reader mounted must still revoke obsolete asynchronous work');
assert.doesNotMatch(terminalFailure, /this\.beginExit\(\)/,
  'PH116: failure must not dispose the only settings/retry owner');

console.log('reader source-failure P0 route contract: PASS');
