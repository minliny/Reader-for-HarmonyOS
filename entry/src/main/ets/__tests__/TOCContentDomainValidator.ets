// TOCContentDomainValidator — fixture-based TOC + content + state machine validation
import { ReadingFlowStateMachine, ReadingState } from '../services/ReadingFlowStateMachine';

interface TestResult { name: string; passed: boolean; error?: string; }

class TestRunner {
  results: TestResult[] = []; passed: number = 0; failed: number = 0;
  assert(c: boolean, n: string, e?: string): void {
    const ok = c; this.results.push({ name: n, passed: ok, error: ok ? undefined : e });
    if (ok) { this.passed++; } else { this.failed++; }
  }
  summary(): string { return `${this.passed}P ${this.failed}F / ${this.results.length}`; }
}

export function runTOCContentDomainTests(): TestRunner {
  const r = new TestRunner();

  // State machine tests
  const sm = new ReadingFlowStateMachine();

  // 1. Initial state
  r.assert(sm.getState() === ReadingState.IDLE, 'initial state is IDLE');
  r.assert(sm.getContext() === null, 'initial context is null');

  // 2. Open book
  r.assert(sm.openBook('book-1', 'https://test.com/book/1'), 'openBook succeeds from IDLE');
  r.assert(sm.getState() === ReadingState.TOC_LOADING, 'state → TOC_LOADING');
  r.assert(sm.getContext()?.bookId === 'book-1', 'context has bookId');

  // 3. TOC loaded
  r.assert(sm.tocLoaded(10), 'tocLoaded succeeds from TOC_LOADING');
  r.assert(sm.getState() === ReadingState.TOC_READY, 'state → TOC_READY');
  r.assert(sm.getContext()?.totalChapters === 10, 'totalChapters set');

  // 4. Select chapter
  r.assert(sm.selectChapter(3), 'selectChapter succeeds from TOC_READY');
  r.assert(sm.getState() === ReadingState.CHAPTER_LOADING, 'state → CHAPTER_LOADING');
  r.assert(sm.getContext()?.currentChapterIndex === 3, 'chapter index set');

  // 5. Chapter loaded
  r.assert(sm.chapterLoaded(), 'chapterLoaded succeeds');
  r.assert(sm.getState() === ReadingState.CHAPTER_READY, 'state → CHAPTER_READY');

  // 6. Next chapter
  r.assert(sm.nextChapter(), 'nextChapter succeeds');
  r.assert(sm.getContext()?.currentChapterIndex === 4, 'chapter index incremented');

  // 7. Prev chapter
  r.assert(sm.chapterLoaded(), 'chapterLoaded after next');
  r.assert(sm.prevChapter(), 'prevChapter succeeds');
  r.assert(sm.getContext()?.currentChapterIndex === 3, 'chapter index decremented');

  // 8. Next at last chapter
  sm.closeBook(); sm.openBook('b2', 'url'); sm.tocLoaded(1);
  sm.selectChapter(0); sm.chapterLoaded();
  r.assert(!sm.nextChapter(), 'nextChapter fails at last chapter');

  // 9. Prev at first chapter
  sm.closeBook(); sm.openBook('b3', 'url'); sm.tocLoaded(3);
  sm.selectChapter(0); sm.chapterLoaded();
  r.assert(!sm.prevChapter(), 'prevChapter fails at first chapter');

  // 10. Invalid transition
  sm.closeBook();
  r.assert(!sm.selectChapter(0), 'selectChapter fails from IDLE');

  // 11. Error handling
  sm.openBook('b4', 'url');
  r.assert(sm.setError(), 'setError succeeds');
  r.assert(sm.getState() === ReadingState.ERROR, 'state → ERROR');
  r.assert(sm.retry(), 'retry from ERROR → IDLE');

  // 12. Close from CHAPTER_READY
  sm.openBook('b5', 'url'); sm.tocLoaded(5);
  sm.selectChapter(0); sm.chapterLoaded();
  r.assert(sm.closeBook(), 'closeBook succeeds');
  r.assert(sm.getState() === ReadingState.IDLE, 'state → IDLE after close');

  return r;
}
