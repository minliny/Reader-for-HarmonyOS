import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const index = readFileSync(resolve(repo, 'entry/src/main/ets/pages/Index.ets'), 'utf8');
const reader = readFileSync(resolve(repo,
  'entry/src/main/ets/features/reading/LocalReadingExperience.ets'), 'utf8');
const shell = readFileSync(resolve(repo, 'entry/src/main/ets/features/shell/ReaderShell.ets'), 'utf8');

const commitSuccess = index.slice(
  index.indexOf("if (outcome.status === 'success')"),
  index.indexOf('private currentSourceSwitchChapterTitle'),
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
assert.match(index, /Remote Book Detail state failed to load:[\s\S]*this\.rollbackPendingSourceSwitch\(error\.message\)/);
assert.match(index, /private onReadingFailure\([\s\S]*this\.rollbackPendingSourceSwitch\(message\)/);
assert.match(index, /gateway\.rollbackSwitch\([\s\S]*pending\.transactionId/);
assert.match(index, /pending\.targetChapterIndex === commit\.chapterIndex[\s\S]*this\.pendingSourceSwitch = undefined/,
  'only the first durable target chapter progress commit may release rollback');
assert.match(index, /clearBookIdentity\(pending\.fromSourceId, pending\.fromBookId\)/,
  'old per-book body/image cache is cleared only after target admission succeeds');
assert.match(index, /this\.sourceSwitchState\.kind === 'switching'[\s\S]*transactionId !== undefined[\s\S]*return;/,
  'the switch overlay cannot close while Core commit might be publishing its journal');

assert.match(reader, /this\.onReadingFailure\(this\.sourceId, this\.bookId, this\.failureCode\)[\s\S]*this\.beginExit\(\)/,
  'reader failure must notify the transaction owner before its normal exit seam');
assert.match(shell, /onReadingFailure: \(sourceId: string, bookId: string, message: string\)/);
assert.match(shell, /this\.onReadingFailure\(sourceId, bookId, message\)/);
assert.match(shell, /sourceSwitchTransactionId: this\.sourceSwitchTransactionId/);
assert.match(reader, /new ReadingSessionFlowGateway\([\s\S]*this\.sourceSwitchTransactionId/);

console.log('source-switch post-commit transaction contract: PASS');
