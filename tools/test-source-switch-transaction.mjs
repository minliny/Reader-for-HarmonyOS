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
  commitSuccess.indexOf('this.performSourceSwitchSeam(outcome.book)'),
  'the Core transaction id must be retained before the old reader seam is destroyed');
assert.match(commitSuccess, /outcome\.matchedChapter\.order/);
assert.match(commitSuccess, /outcome\.transactionId/);
assert.doesNotMatch(index, /rollbackToken|SourceSwitchRollbackToken/,
  'ArkUI must not retain the Core before-image journal');

assert.match(index, /pending\.targetSourceId === session\.identity\.sourceId[\s\S]*this\.openReading\(pending\.targetChapterIndex\)/,
  'target admission must enter the normal physical reader at Core matched chapter');
assert.match(index, /Remote detail failure:[\s\S]*this\.rollbackPendingSourceSwitch\(error\.message\)/);
assert.match(index, /private onReadingFailure\([\s\S]*this\.rollbackPendingSourceSwitch\(message\)/);
assert.match(index, /private onReadingFailure\([\s\S]*isRemoteSourceFailureKind\(kind\)/,
  'reading failures must be classified before the visible failure surface');
assert.match(index, /private onReadingFailure\([\s\S]*this\.showReadingFailure\(kind === 'STORAGE_FAILED' \? '本地缓存不可用' : '阅读失败', message\)/,
  'ordinary reading failures must remain visible after source-switch handling is excluded');
assert.match(index, /gateway\.rollbackSwitch\([\s\S]*pending\.transactionId/);
assert.match(index, /pending\.targetChapterIndex === commit\.chapterIndex[\s\S]*this\.pendingSourceSwitch = undefined/,
  'only the first durable target chapter progress commit may release rollback');
assert.match(index, /clearBookIdentity\(pending\.fromSourceId, pending\.fromBookId\)/,
  'old per-book body/image cache is cleared only after target admission succeeds');
assert.match(index, /this\.sourceSwitchState\.kind === 'switching'[\s\S]*transactionId !== undefined[\s\S]*return;/,
  'the switch overlay cannot close while Core commit might be publishing its journal');

assert.match(reader, /this\.onReadingFailure\(this\.sourceId, this\.bookId, this\.failureCode, failureKind\)[\s\S]*this\.beginExit\(\)/,
  'reader failure must notify the transaction owner with the typed kind before its normal exit seam');
assert.match(shell, /onReadingFailure: \(sourceId: string, bookId: string, message: string,\s*failureKind\?: RemoteReadingFailureKind\)/);
assert.match(shell, /this\.onReadingFailure\(sourceId, bookId, message, failureKind\)/);
assert.match(shell, /sourceSwitchTransactionId: this\.sourceSwitchTransactionId/);
assert.match(reader, /new ReadingSessionFlowGateway\([\s\S]*this\.sourceSwitchTransactionId/);

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
assert.match(index, /fromBook !== undefined \|\| targetBook === undefined[\s\S]*continue;/,
  'page reconstruction may compensate only a Core-published migrated shelf state');
assert.doesNotMatch(index, /AppStorage.*transactionId|StorageLink.*sourceSwitch/,
  'source switch journal identity must not be copied into an ArkUI store');

console.log('source-switch post-commit transaction contract: PASS');
