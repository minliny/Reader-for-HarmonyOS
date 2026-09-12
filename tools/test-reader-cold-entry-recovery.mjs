import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const readingDir = new URL('../entry/src/main/ets/features/reading/', import.meta.url);
const localReading = readFileSync(new URL('LocalReadingExperience.ets', readingDir), 'utf8');

const failures = [];

function contract(name, check) {
  try {
    check();
  } catch (error) {
    failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function methodSection(source, name) {
  const plainAnchor = `  private ${name}(`;
  const asyncAnchor = `  private async ${name}(`;
  let start = source.indexOf(plainAnchor);
  if (start < 0) {
    start = source.indexOf(asyncAnchor);
  }
  if (start < 0) {
    start = source.indexOf(`  ${name}(`);
  }
  assert.notEqual(start, -1, `missing ${name} method`);
  const nextPrivate = source.indexOf('\n  private ', start + 4);
  return nextPrivate < 0 ? source.slice(start) : source.slice(start, nextPrivate);
}

contract('a rejected preparation attempt never swaps the context away from the visible page', () => {
  const begin = methodSection(localReading, 'beginPageTurnPreparation');
  assert.match(begin, /: ReaderPageTurnPreparationOutcome \{/,
    'the outcome must distinguish begun / retry / abandon instead of a boolean');
  assert.match(begin, /visiblePage === undefined \|\| originChapter === undefined \|\| !this\.canTurnPage\(\)/,
    'the lane-busy case must be retry, not a silent drop');
  assert.match(begin, /this\.adjacentMeasurementContext = targetContext;\s*this\.beginMeasurement/);
  const tailRestore = begin.indexOf(
    'this.adjacentMeasurementContext = undefined;',
    begin.indexOf('this.adjacentMeasurementContext = targetContext;'),
  );
  assert.notEqual(tailRestore, -1,
    'a tail rejection after the target context was installed must discard only the speculative context');
  assert.match(begin, /this\.pageTurnPreparation = undefined;\s*return 'retry';/,
    'a tail rejection must also release the preparation slot it armed');
  assert.match(begin, /return 'abandon';/, 'a missing target must be abandon, not retry');
});

contract('a transiently rejected drain entry is re-queued with bounded backoff, never dropped', () => {
  const drain = methodSection(localReading, 'drainPageTurnPreparationQueue');
  assert.match(drain, /outcome === 'begun'/);
  assert.match(drain, /outcome === 'abandon'/);
  assert.match(drain, /this\.pageTurnPreparationQueue\.unshift\(direction\)/,
    'the rejected direction must return to the head of the queue');
  assert.match(drain, /PAGE_TURN_PREPARATION_RETRY_LIMIT/,
    'backoff retries must be capped');
  assert.match(drain, /this\.pageTurnGeneration !== generation \|\| this\.chapterSelectionToken !== token/,
    'stale backoff fires must not drain against a newer selection');
  assert.match(drain, /const delay = Math\.min\(/,
    'retry delay must be a bounded backoff, not an immediate busy loop');
  assert.match(localReading, /private cancelPageTurnPreparationRetry\(\): void/);
});

contract('the dynamic rapid target is re-drained at every completion hook', () => {
  const request = methodSection(localReading, 'requestPageTurn');
  assert.match(request,
    /enqueueReaderRapidPageTurn\(this\.rapidPageTurnState, direction\)[\s\S]*this\.drainRapidPageTurn\(\)/,
    'busy/preparing work must remain represented by the dynamic target');

  const preparedComplete = methodSection(localReading, 'completePreparedPageTurn');
  assert.match(preparedComplete,
    /this\.drainRapidPageTurn\(\);[\s\S]*this\.resumePagePreparationAfterTextureFrame\(\);/,
    'a finished preparation drains user intent now and resumes other preparation after textures');

  assert.match(methodSection(localReading, 'resumePagePreparationAfterTextureFrame'), /refreshBookTurnTextures[\s\S]*finally[\s\S]*drainPageTurnPreparationQueue/);
  const complete = methodSection(localReading, 'completeFirstPage');
  assert.match(complete,
    /this\.schedulePageTurnPreparation\(\);[\s\S]*this\.completeRapidPageTurnTransaction\(\);[\s\S]*this\.drainRapidPageTurn\(\);/,
    'first-page completion must consume one admitted turn and continue toward the target');
});

contract('the first-page completion lane has a watchdog with bounded re-measurement', () => {
  const commit = methodSection(localReading, 'beginFirstPageCommit');
  assert.match(commit,
    /this\.armFirstPageCompletionDeadline\(\);\s*void this\.completeFirstPage\(/,
    'arming must cover exactly the completeFirstPage branch whose deadline was cancelled');
  const preparedBranch = commit.indexOf('this.completePreparedPageTurn(page, generation, selectionToken, lifecycleToken);');
  const armBranch = commit.indexOf('this.armFirstPageCompletionDeadline();');
  assert.ok(preparedBranch >= 0 && preparedBranch < armBranch,
    'the prepared and previous-chapter branches must return before the watchdog lane arms');

  const watchdog = methodSection(localReading, 'armFirstPageCompletionDeadline');
  assert.match(watchdog, /FIRST_PAGE_COMPLETION_DEADLINE_MS/);
  assert.match(watchdog, /this\.phase !== 'measuring' \|\| !this\.measurementCompleting/,
    'the watchdog must only fire while a completion is genuinely stuck');
  assert.match(watchdog, /this\.firstPageCompletionRetryCount >= FIRST_PAGE_COMPLETION_MAX_RETRIES/,
    're-measurement must be capped before giving up');
  assert.match(watchdog, /this\.measurementGeneration \+= 1;[\s\S]*this\.measurementCompleting = false;[\s\S]*this\.beginMeasurement\(this\.lifecycleToken\)/,
    'a retry must break the suspended chain and re-measure');
  assert.match(watchdog, /READING_FIRST_PAGE_COMPLETION_TIMEOUT/,
    'exhausted retries must fail closed instead of staying wedged');

  assert.match(methodSection(localReading, 'resumePagePreparationAfterTextureFrame'), /refreshBookTurnTextures[\s\S]*finally[\s\S]*drainPageTurnPreparationQueue/);
  const complete = methodSection(localReading, 'completeFirstPage');
  assert.match(complete, /this\.cancelFirstPageCompletionDeadline\(\);/,
    'normal completion must disarm the watchdog');

  const cancel = methodSection(localReading, 'cancelFirstPageCompletionDeadline');
  assert.match(cancel, /this\.firstPageCompletionGeneration \+= 1;/,
    'a cancelled timer must not act on a later selection');
});

contract('lifecycle teardown and failure disarm both new watchdogs', () => {
  const fail = methodSection(localReading, 'fail');
  assert.match(fail, /cancelFirstPageCompletionDeadline\(\)/);
  assert.match(fail, /cancelPageTurnPreparationRetry\(\)/);
  // Inspect the full lifecycle method, not a character budget that changes
  // meaning when another legitimate cleanup is added before these timers.
  const teardown = methodSection(localReading, 'aboutToDisappear');
  assert.match(teardown, /cancelFirstPageCompletionDeadline\(\);[\s\S]*?cancelPageTurnPreparationRetry\(\);/,
    'aboutToDisappear must disarm the completion watchdog and the preparation retry timer');
  assert.match(localReading, /this\.phase = 'loading';\s*this\.cancelMeasurementDeadline\(\);\s*this\.cancelFirstPageReadyDeadline\(\);\s*this\.cancelFirstPageCompletionDeadline\(\);/,
    'the selection reset path must disarm the completion watchdog');
});

contract('watchdog constants keep generous normal-path margins', () => {
  assert.match(localReading, /const FIRST_PAGE_COMPLETION_DEADLINE_MS = 10000;/,
    'normal completion is well under 1s; 10s must not false-fire');
  assert.match(localReading, /const FIRST_PAGE_COMPLETION_MAX_RETRIES = 3;/);
  assert.match(localReading, /const PAGE_TURN_PREPARATION_RETRY_MAX_MS = 2000;/);
  assert.match(localReading, /const PAGE_TURN_PREPARATION_RETRY_BASE_MS = 250;/);
});

if (failures.length > 0) {
  console.error(`reader cold-entry recovery contract: ${failures.length} FAILURE(S)`);
  for (const line of failures) {
    console.error(`  - ${line}`);
  }
  process.exit(1);
}
console.log('reader cold-entry recovery contract: PASS');
