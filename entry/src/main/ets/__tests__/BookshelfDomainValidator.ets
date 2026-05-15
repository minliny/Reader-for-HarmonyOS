// BookshelfDomainValidator — fixture-based domain validation
// Validates BookshelfService + MockBookshelfRepository + ProgressService
// without UI or network dependencies
import { MockBookshelfRepository } from '../repository/BookshelfRepository';
import { BookshelfService } from '../services/BookshelfService';
import { ProgressService } from '../services/ProgressService';
import { LocalBookFormat } from '../models/LocalBook';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

class TestRunner {
  results: TestResult[] = [];
  passed: number = 0;
  failed: number = 0;

  assert(condition: boolean, name: string, error?: string): void {
    const passed = condition;
    this.results.push({ name, passed, error: passed ? undefined : error });
    if (passed) { this.passed++; } else { this.failed++; }
  }

  assertEqual<T>(actual: T, expected: T, name: string): void {
    const passed = actual === expected;
    this.results.push({
      name,
      passed,
      error: passed ? undefined : `expected ${expected}, got ${actual}`
    });
    if (passed) { this.passed++; } else { this.failed++; }
  }

  summary(): string {
    return `${this.passed} passed, ${this.failed} failed, ${this.results.length} total`;
  }
}

export function runBookshelfDomainTests(): TestRunner {
  const runner = new TestRunner();

  // Setup: mock repository
  const repo = new MockBookshelfRepository(true);
  const service = new BookshelfService(repo);
  const progress = new ProgressService(repo);

  // Test 1: Repository has mock data
  const all = repo.getAll();
  runner.assert(all.length >= 5, 'Repository has >=5 mock books',
    `Expected >=5, got ${all.length}`);

  // Test 2: Get by ID
  const book = repo.getById('mock-001');
  runner.assert(book !== undefined, 'getById returns book for valid ID');
  runner.assert(book?.title === '三体', 'Mock book title is 三体');

  // Test 3: Add valid book
  const newBook = service.addBook('测试书籍', '/test/test.txt', LocalBookFormat.txt, '测试作者', 1024, 'utf-8');
  runner.assert(newBook !== null, 'addBook succeeds with valid data');
  runner.assert(newBook?.id !== undefined, 'addBook generates ID');
  runner.assert(repo.exists(newBook?.id ?? ''), 'Added book exists in repository');

  // Test 4: Add book with empty title (should fail)
  const badBook = service.addBook('', '/test/bad.txt', LocalBookFormat.txt);
  runner.assert(badBook === null, 'addBook rejects empty title');

  // Test 5: Add book with empty path (should fail)
  const noPath = service.addBook('Title', '', LocalBookFormat.txt);
  runner.assert(noPath === null, 'addBook rejects empty filePath');

  // Test 6: Remove book
  const removed = service.removeBook('mock-002');
  runner.assert(removed, 'removeBook succeeds for existing book');
  runner.assert(!repo.exists('mock-002'), 'Removed book no longer exists');

  // Test 7: Remove non-existent book
  const badRemove = service.removeBook('nonexistent');
  runner.assert(!badRemove, 'removeBook fails for non-existent book');

  // Test 8: Update book metadata
  const updated = service.updateBook('mock-001', { title: '三体 (修改版)', author: '大刘' });
  runner.assert(updated !== null, 'updateBook succeeds');
  runner.assert(updated?.title === '三体 (修改版)', 'Title updated');
  runner.assert(updated?.author === '大刘', 'Author updated');

  // Test 9: Update non-existent book
  const badUpdate = service.updateBook('no-id', { title: 'x' });
  runner.assert(badUpdate === null, 'updateBook fails for non-existent book');

  // Test 10: List all sorted
  const list = service.listAll();
  runner.assert(list.length > 0, 'listAll returns books');

  // Test 11: Progress update
  const progOk = progress.updateProgress('mock-001', 5, 0.5, 20);
  runner.assert(progOk, 'updateProgress succeeds');
  runner.assert(progress.hasProgress('mock-001'), 'hasProgress returns true');

  // Test 12: Progress validation (negative chapter)
  const badProg = progress.updateProgress('mock-001', -1, 0.5, 20);
  runner.assert(!badProg, 'updateProgress rejects negative chapter index');

  // Test 13: Mark finished
  progress.markFinished('mock-003', 15);
  const fp = progress.getProgress('mock-003');
  runner.assert(fp !== null, 'markFinished sets progress');
  runner.assert(fp?.chapterProgress === 1.0, 'Finished book has 100% progress');

  // Test 14: Get recent books
  const recent = progress.getRecentBooks(3);
  runner.assert(recent.length <= 3, 'getRecentBooks respects limit');

  // Test 15: Summary statistics
  const summary = progress.getSummary();
  runner.assert(summary.totalBooksTracked >= 0, 'Summary has totalBooksTracked');

  // Test 16: Delete progress
  progress.deleteProgress('mock-001');
  runner.assert(!progress.hasProgress('mock-001'), 'deleteProgress removes progress');

  return runner;
}
