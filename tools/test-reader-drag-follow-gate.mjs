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
  assert.notEqual(start, -1, `missing ${name} method`);
  const nextPrivate = source.indexOf('\n  private ', start + 4);
  return nextPrivate < 0 ? source.slice(start) : source.slice(start, nextPrivate);
}

contract('both drag-follow gates enqueue the missing preparation instead of dropping it', () => {
  const slideGate = methodSection(localReading, 'onReaderPageGestureStateChanged');
  const draggingElse = slideGate.indexOf('} else {', slideGate.indexOf("state.phase === 'dragging'"));
  const draggingEnd = slideGate.indexOf('return;', draggingElse);
  const elseBody = slideGate.slice(draggingElse, draggingEnd);
  assert.match(elseBody, /this\.queuePageTurnPreparation\(state\.direction\);/,
    'the slide drag gate must queue the preparation when the page is not prepared');
  assert.match(elseBody, /DRAGFOLLOW gate-miss/,
    'the slide drag gate must log its gate-miss decision once per gesture');

  const bookTurnGate = methodSection(localReading, 'updateBookTurnGesturePresentation');
  const gateOpen = bookTurnGate.indexOf('preparedPageTurn(state.direction) === undefined) {');
  const gateQueue = bookTurnGate.indexOf('this.queuePageTurnPreparation(state.direction);', gateOpen);
  const gateReturn = bookTurnGate.indexOf('return;', gateQueue);
  assert.ok(gateOpen >= 0 && gateQueue > gateOpen && gateReturn > gateQueue,
    'the book-turn drag gate must queue the preparation before its silent return');
  assert.match(bookTurnGate, /DRAGFOLLOW gate-miss/,
    'the book-turn drag gate must log its gate-miss decision once per gesture');
});

contract('the gesture return-to-idle hook re-drains a queued preparation', () => {
  for (const name of ['onReaderPageGestureStateChanged', 'updateBookTurnGesturePresentation']) {
    const section = methodSection(localReading, name);
    assert.match(section,
      /state\.phase === 'idle' && this\.pageTurnPreparationQueue\.length > 0[\s\S]{0,80}this\.drainPageTurnPreparationQueue\(\);/,
      `${name} must re-drain the queue when the gesture settles back to idle`);
  }
  // The queue hook must stay below the drain's own gesture guard so the
  // measurement work still never runs inside an active gesture.
  const drain = methodSection(localReading, 'drainPageTurnPreparationQueue');
  assert.match(drain, /this\.pageTurnGestureState\.phase !== 'idle'/,
    'the drain gesture guard must remain intact');
});

contract('the tap path keeps its preparation queue fallback (asymmetry fixed from both sides)', () => {
  const drainPending = methodSection(localReading, 'drainPendingManualPageTurn');
  assert.match(drainPending, /preparedPageTurn\(direction\) === undefined[\s\S]{0,120}queuePageTurnPreparation\(direction\)/,
    'the retained tap intent must keep queueing a missing preparation');
});

if (failures.length > 0) {
  console.error(`reader drag-follow gate contract: ${failures.length} FAILURE(S)`);
  for (const line of failures) {
    console.error(`  - ${line}`);
  }
  process.exit(1);
}
console.log('reader drag-follow gate contract: PASS');
