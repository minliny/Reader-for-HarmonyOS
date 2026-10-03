import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const index = readFileSync(resolve(repo, 'entry/src/main/ets/pages/Index.ets'), 'utf8');
const reader = readFileSync(resolve(repo,
  'entry/src/main/ets/features/reading/LocalReadingExperience.ets'), 'utf8');
const shell = readFileSync(resolve(repo, 'entry/src/main/ets/features/shell/ReaderShell.ets'), 'utf8');
const detail = readFileSync(resolve(repo,
  'entry/src/main/ets/features/bookshelf/LocalBookDetail.ets'), 'utf8');
const window = readFileSync(resolve(repo,
  'entry/src/main/ets/features/source/SourceSwitchWindow.ets'), 'utf8');
const candidateRow = readFileSync(resolve(repo,
  'entry/src/main/ets/features/source/CandidateRow.ets'), 'utf8');

const sourceHost = readFileSync(resolve(repo, 'entry/src/main/ets/features/source/SourceSwitchHost.ts'), 'utf8');
const commitSuccess = sourceHost.slice(
  sourceHost.indexOf("if (outcome.status === 'success')"),
  sourceHost.indexOf('private async rollbackTransaction'),
);
assert.ok(commitSuccess.indexOf('pending: { fromSourceId: identity.sourceId') >= 0);
assert.ok(commitSuccess.indexOf('pending: { fromSourceId: identity.sourceId') < commitSuccess.indexOf("this.deliver({ kind: 'targetReady'"),
  'the real owner retains the Core transaction before delivering the reader seam');
assert.match(commitSuccess, /outcome\.matchedChapter\.order/);
assert.match(commitSuccess, /outcome\.transactionId/);
assert.match(index, /SourceSwitchHost\.forRuntime\(owner\)/);
assert.doesNotMatch(index, /new SourceSwitchGateway|preparePendingSourceSwitchForNextChoice|reconcileUnknownSourceSwitchCommit|resolveSourceSwitchAnchor/,
  'discovery, anchor election and compensation are owned by the actual feature Host');
assert.doesNotMatch(index, /rollbackToken|SourceSwitchRollbackToken/,
  'ArkUI must not retain the Core before-image journal');

const failureStart = index.indexOf('private onReadingFailure(');
const failure = index.slice(failureStart,index.indexOf('private onRemoteSessionReady(',failureStart));
assert.match(failure, /this\.detailLoadingMessage = message/);
assert.doesNotMatch(failure, /rollbackPendingSourceSwitch|showReadingFailure|returnToReadingOrigin/,
  'typed body errors retain the mounted reader and pending transaction for retry');
assert.match(index, /this\.performSourceSwitchSeam\(effect\.book, effect\.session, effect\.chapterIndex\)/);
assert.match(sourceHost, /this\.gateway\.rollbackSwitch\(transactionId/);
assert.match(index, /commit\.sourceSwitchTransactionId !== undefined[\s\S]*host\.targetCommitted\([\s\S]*commit\.sourceSwitchTransactionId\)/,
  'only the actual finalized ID from the canonical ACK releases the barrier');
assert.match(sourceHost, /pending\.transactionId !== transactionId[\s\S]*this\.currentTransactionId\(identity\)/);
assert.match(index, /if \(finalized !== undefined\) this\.cleanupRetiredSourceCache\(finalized\)/);
assert.match(sourceHost, /close\(scopeId: number\)[\s\S]*this\.busyOrUnknown\(\)/);
const failStart = reader.indexOf('private fail(');
const failureOwner = reader.slice(failStart, reader.indexOf('\n  private ', failStart + 10));
assert.match(failureOwner, /this\.onReadingFailure\(this\.sourceId, this\.bookId, this\.failureCode, failureKind\)/);
assert.doesNotMatch(failureOwner, /beginExit\(/,
  'reader error presentation must not begin an exit');
assert.match(shell, /onReadingFailure: \(sourceId: string, bookId: string, message: string,\s*failureKind\?: RemoteReadingFailureKind\)/);
assert.match(shell, /this\.onReadingFailure\(sourceId, bookId, message, failureKind\)/);
assert.match(shell, /sourceSwitchTransactionId: this\.sourceSwitchTransactionId/);
assert.match(reader, /ReadingSessionFlowGateway\.open\([\s\S]*sourceSwitchTransactionId: this\.sourceSwitchTransactionId/);

assert.match(detail, /@Prop sourceSwitchEnabled: boolean = false/);
assert.match(detail, /onSwitchSource: \(\) => void/);
assert.match(detail, /\.enabled\(this\.sourceSwitchEnabled\)/,
  'local detail keeps the source-switch pill visible but disables interaction');
assert.match(index, /sourceSwitchEnabled: this\.detailBook\.sourceId !== LOCAL_SOURCE_ID/);
assert.match(index, /onSwitchSource: \(\): void => this\.openDetailSourceSwitch\(\)/);

const detailOverlayStart = index.indexOf("if ((this.route === 'detail' || this.route === 'bookshelf') &&");
const detailOverlayEnd = index.indexOf("if (this.route === 'bookshelf'", detailOverlayStart);
assert.ok(detailOverlayStart >= 0 && detailOverlayEnd > detailOverlayStart,
  'Index must host the existing source-switch panel on remote detail');
const detailOverlay = index.slice(detailOverlayStart, detailOverlayEnd);
assert.match(detailOverlay, /!this\.readingSessionActive && this\.sourceSwitchVisible/);
assert.match(detailOverlay, /this\.sourceSwitchOverlayContent\(\)/);
const overlayStart=index.indexOf("private sourceSwitchOverlayContent()");
const overlay=index.slice(overlayStart,index.indexOf("private getSourceSwitchHost()",overlayStart));
assert.match(overlay, /SourceSwitchPanel\(\{/);
assert.match(overlay, /state: this\.sourceSwitchState/);
assert.match(overlay, /onSelectCandidate: \(candidate: SourceSwitchCandidate\): void => this\.onPickSource\(candidate, scopeId\)/);
assert.match(overlay, /ForEach\(\[this\.sourceSwitchScopeId\]/);

const detailOpenStart = index.indexOf('private openDetailSourceSwitch(): void');
const detailOpenEnd = index.indexOf('private retrySourceSwitch(', detailOpenStart);
assert.ok(detailOpenStart >= 0 && detailOpenEnd > detailOpenStart);
const detailOpen = index.slice(detailOpenStart, detailOpenEnd);
assert.match(detailOpen, /this\.route !== this\.readingOriginRoute/);
assert.match(detailOpen, /host\.open\(this\.sourceSwitchContext\(\), this\.sourceSwitchLease\(host\)\)/);
assert.doesNotMatch(detailOpen, /this\.route\s*=\s*'reading'/,
  'detail source switch must remain a detail-only overlay');

assert.match(window,
  /sourceSwitchCandidateKey\(candidate\.sourceId, candidate\.bookUrl\)/,
  'Repeat must key candidates by exact composite identity');
assert.match(window, /isCurrent: repeatItem\.item\.isCurrent === true/);
assert.match(window, /Repeat\(this\.candidates\(\)\)[\s\S]*\.virtualScroll\(\{ reusable: true \}\)/);
assert.match(candidateRow, /@Prop isCurrent: boolean = false/);
assert.match(candidateRow, /if \(this\.isCurrent\)/);
assert.doesNotMatch(candidateRow, /currentSourceId/,
  'candidate current state must not collapse all rows from the active source');

const pickStart=sourceHost.indexOf('async pick(candidate: SourceSwitchCandidate');
const pickSource=sourceHost.slice(pickStart,sourceHost.indexOf('async rollback(',pickStart));
assert.match(pickSource,/sourceSwitchCandidateKey\(candidate\.sourceId, candidate\.bookUrl\)[\s\S]*sourceSwitchCandidateKey\(context\.query\.sourceId, context\.query\.bookId\)/);
assert.match(sourceHost,/new RemoteReadingFlowGateway\(this\.runtime\)\.loadProgress/);
assert.match(pickSource,/buildSourceSwitchCommitParams\([\s\S]*anchor\.chapterTitle, anchor\.chapterIndex/);
assert.match(index,/private async reconcilePendingSourceSwitches\(\): Promise<void>/);
const recoveryStart=index.indexOf('private async reconcilePendingSourceSwitches()');
const recovery=index.slice(recoveryStart,index.indexOf('\n  private ',recoveryStart+10));
assert.match(recovery,/host\.inspectPending\(current\)/);assert.doesNotMatch(recovery,/rollbackSwitch|finalizeSwitch/);
assert.match(index,/host\.resolveTransaction\(\{ sourceId, bookId \}, current\)/);
assert.match(index,/this\.bindSourceSwitchReader\(host\)/);
assert.match(sourceHost,/record\.targetSourceId === identity\.sourceId && record\.targetBookId === identity\.bookId/);
assert.match(sourceHost,/error instanceof ReaderCoreRequestError/);
assert.doesNotMatch(index, /AppStorage.*transactionId|StorageLink.*sourceSwitch/,
  'source switch journal identity must not be copied into an ArkUI store');

console.log('source-switch post-commit transaction contract: PASS');
