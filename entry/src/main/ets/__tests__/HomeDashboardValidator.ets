// HomeDashboardValidator - validates the local UI composition surface.
import { HomeBookRow, HomeBookshelfSnapshot, HomeDashboardService } from '../services/HomeDashboardService';

interface TestResult { name: string; passed: boolean; error?: string; }

class TestRunner {
  results: TestResult[] = [];
  passed: number = 0;
  failed: number = 0;

  assert(condition: boolean, name: string, error?: string): void {
    const ok = condition;
    this.results.push({ name, passed: ok, error: ok ? undefined : error });
    if (ok) { this.passed++; } else { this.failed++; }
  }

  summary(): string { return `${this.passed}P ${this.failed}F / ${this.results.length}`; }
}

export function runHomeDashboardTests(): TestRunner {
  const r = new TestRunner();
  const service = new HomeDashboardService();
  const snapshot = service.getBookshelfSnapshot();
  const reader = service.getReaderPreviewSnapshot();
  const sourceMgmt = service.getSourceManagementSnapshot();

  r.assert(snapshot.totalBooks >= 5, 'dashboard exposes local bookshelf rows');
  r.assert(snapshot.activeBooks > 0, 'dashboard reports active reading rows');
  r.assert(snapshot.unreadBooks > 0, 'dashboard reports unread rows');
  r.assert(snapshot.totalBooks === snapshot.rows.length, 'dashboard row count matches total books');
  r.assert(hasTitle(snapshot, '三体'), 'dashboard preserves local book title');
  r.assert(snapshot.rows.every((row: HomeBookRow) => row.format.length > 0), 'dashboard maps local book format labels');
  r.assert(snapshot.rows.every((row: HomeBookRow) => row.progressText.length > 0), 'dashboard maps progress labels');
  r.assert(snapshot.rows.some((row: HomeBookRow) => row.isReading && row.progressPercent > 0), 'dashboard includes in-progress percent');
  r.assert(snapshot.rows.some((row: HomeBookRow) => !row.isReading && row.progressPercent === 0), 'dashboard includes unread zero progress');
  r.assert(reader.mode === 'FIXTURE', 'reader preview is fixture-bound');
  r.assert(reader.bookTitle.length > 0, 'reader preview exposes book title');
  r.assert(reader.chapterTitle.indexOf('第一章') !== -1, 'reader preview exposes chapter title');
  r.assert(reader.contentPreview.length > 0, 'reader preview exposes content preview');
  r.assert(reader.tocCount > 0, 'reader preview exposes TOC count');
  r.assert(reader.progressPercent >= 0, 'reader preview exposes progress percent');
  r.assert(sourceMgmt.mode === 'FIXTURE', 'source management is fixture-bound');
  r.assert(sourceMgmt.sourceCount === 3, 'source management exposes source count');
  r.assert(sourceMgmt.enabledCount === 2, 'source management exposes enabled count');
  r.assert(sourceMgmt.disabledCount === 1, 'source management exposes disabled count');
  r.assert(sourceMgmt.ruleChain === 'search+detail+toc+content', 'source management exposes rule chain');
  r.assert(sourceMgmt.debugStatus === 'DEBUG fixture', 'source management exposes debug status');
  r.assert(sourceMgmt.redacted, 'source management keeps source URLs redacted');

  return r;
}

function hasTitle(snapshot: HomeBookshelfSnapshot, title: string): boolean {
  for (let i = 0; i < snapshot.rows.length; i++) {
    if (snapshot.rows[i].title === title) {
      return true;
    }
  }
  return false;
}
