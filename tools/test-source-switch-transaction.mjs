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

const commitSuccess = index.slice(
  index.indexOf("if (outcome.status === 'success')"),
  index.indexOf('private resolveSourceSwitchAnchor'),
);
assert.ok(commitSuccess.indexOf('new PendingSourceSwitchTransaction(') >= 0);
assert.ok(commitSuccess.indexOf('new PendingSourceSwitchTransaction(') <
  commitSuccess.indexOf('this.performSourceSwitchSeam(outcome.book, targetSession, outcome.matchedChapter.order)'),
  'the Core transaction id must be retained before the old reader seam is destroyed');
assert.match(commitSuccess, /outcome\.matchedChapter\.order/);
assert.match(commitSuccess, /outcome\.transactionId/);
assert.doesNotMatch(index, /rollbackToken|SourceSwitchRollbackToken/,
  'ArkUI must not retain the Core before-image journal');

const failureStart = index.indexOf('private onReadingFailure(');
const failure = index.slice(failureStart,index.indexOf('private onRemoteSessionReady(',failureStart));
assert.match(failure, /this\.detailLoadingMessage = message/);
assert.doesNotMatch(failure, /rollbackPendingSourceSwitch|showReadingFailure|returnToReadingOrigin/,
  'typed body errors retain the mounted reader and pending transaction for retry');
assert.match(index, /performSourceSwitchSeam\(outcome\.book, targetSession, outcome\.matchedChapter\.order\)/,
  'committed switching reuses the admitted target catalog and matched chapter directly');
assert.match(index, /gateway\.rollbackSwitch\([\s\S]*pending\.transactionId/);
assert.match(index, /pending\.targetBookId === commit\.bookId[\s\S]*this\.pendingSourceSwitch = undefined/,
  'the first durable target identity progress commit releases rollback, including another chapter selected during recovery');
assert.match(index, /clearBookIdentity\(pending\.fromSourceId, pending\.fromBookId\)/,
  'old per-book body/image cache is cleared only after target admission succeeds');
assert.match(index, /this\.sourceSwitchState\.kind === 'switching'[\s\S]*transactionId !== undefined[\s\S]*return;/,
  'the switch overlay cannot close while Core commit might be publishing its journal');

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
assert.match(detailOverlay, /SourceSwitchPanel\(\{/);
assert.match(detailOverlay, /state: this\.sourceSwitchState/);
assert.match(detailOverlay, /onSelectCandidate: \(candidate: SourceSwitchCandidate\): void => this\.onPickSource\(candidate\)/);

const detailOpenStart = index.indexOf('private openDetailSourceSwitch(): void');
const detailOpenEnd = index.indexOf('private retrySourceSwitch(): void', detailOpenStart);
assert.ok(detailOpenStart >= 0 && detailOpenEnd > detailOpenStart);
const detailOpen = index.slice(detailOpenStart, detailOpenEnd);
assert.match(detailOpen, /this\.route !== this\.readingOriginRoute/);
assert.match(detailOpen, /this\.startSourceDiscovery\(generation\)/);
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

const pickStart = index.indexOf('private onPickSource(candidate: SourceSwitchCandidate): void');
const pickEnd = index.indexOf('private resolveSourceSwitchAnchor', pickStart);
const pickSource = index.slice(pickStart, pickEnd);
assert.match(pickSource,
  /sourceSwitchCandidateKey\(candidate\.sourceId, candidate\.bookUrl\)[\s\S]*sourceSwitchCandidateKey\(book\.sourceId, book\.bookId\)/,
  'click admission must reject only the exact current (sourceId, bookUrl) tuple');
assert.match(pickSource, /new RemoteReadingFlowGateway\(ReaderRuntimeOwner\.current\(\)\)[\s\S]*loadProgress\(/,
  'source switch must read the Core canonical progress instead of a detail UI field');
assert.match(pickSource, /buildSourceSwitchCommitParams\([\s\S]*anchor\.chapterTitle,[\s\S]*anchor\.chapterIndex/);
assert.match(index, /private async reconcilePendingSourceSwitches\(\): Promise<void>/);
assert.match(index, /listPendingSwitches/);
const recoveryStart = index.indexOf('private async reconcilePendingSourceSwitches()');
const recovery = index.slice(recoveryStart, index.indexOf('\n  private ', recoveryStart + 10));
assert.match(recovery, /listPendingSwitches/);
assert.doesNotMatch(recovery, /rollbackSwitch|finalizeSwitch/,
  'startup records Core pending facts and does not silently change the selected source');
assert.match(index, /private async resolveReaderSourceSwitchTransaction/);
assert.match(index, /record\.targetSourceId === sourceId && record\.targetBookId === bookId/);
assert.match(index, /private async preparePendingSourceSwitchForNextChoice/);
assert.match(index, /error instanceof ReaderCoreRequestError/,
  'only the typed Core finalized reason can enter canonical reconciliation');
assert.doesNotMatch(index, /AppStorage.*transactionId|StorageLink.*sourceSwitch/,
  'source switch journal identity must not be copied into an ArkUI store');

console.log('source-switch post-commit transaction contract: PASS');
