// SearchDomainValidator — fixture-based search domain validation
import { BookSourceRepository } from '../repository/BookSourceRepository';
import { BookSource } from '../models/BookSource';
import { SearchError, SearchErrorCode } from '../models/SearchError';

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

// In-memory storage for testing
class MemoryStorage {
  private data: Map<string, string> = new Map();
  read(key: string): string | null { return this.data.get(key) ?? null; }
  write(key: string, value: string): void { this.data.set(key, value); }
  remove(key: string): void { this.data.delete(key); }
}

export function runSearchDomainTests(): TestRunner {
  const r = new TestRunner();

  // Setup
  const storage = new MemoryStorage();
  const repo = new BookSourceRepository(storage);
  repo.initialize();

  const sampleSource: BookSource = {
    bookSourceName: 'Test Source',
    bookSourceUrl: 'https://test.example.com',
    searchUrl: 'https://test.example.com/search?key={{key}}',
    enabled: true,
    weight: 100,
    unknownFields: {}
  };

  // 1. Add source
  r.assert(repo.addSource(sampleSource), 'addSource succeeds');
  r.assert(repo.count() === 1, 'count is 1 after add');

  // 2. Duplicate add fails
  r.assert(!repo.addSource(sampleSource), 'addSource fails for duplicate URL');

  // 3. Get source
  const got = repo.getSource('https://test.example.com');
  r.assert(got !== undefined, 'getSource returns added source');
  r.assert(got?.bookSourceName === 'Test Source', 'Source name matches');

  // 4. Get enabled
  const enabled = repo.getEnabledSources();
  r.assert(enabled.length === 1, 'getEnabledSources returns 1');

  // 5. Toggle disabled
  repo.setEnabled('https://test.example.com', false);
  r.assert(repo.getEnabledSources().length === 0, 'getEnabledSources empty after disable');

  // 6. Remove source
  r.assert(repo.removeSource('https://test.example.com'), 'removeSource succeeds');
  r.assert(repo.count() === 0, 'count is 0 after remove');

  // 7. SearchError factory methods
  const e1 = SearchError.configMissing('searchUrl', 'TestSrc');
  r.assert(e1.code === SearchErrorCode.CONFIG_MISSING, 'configMissing error code');
  r.assert(e1.message.includes('searchUrl'), 'configMissing message includes field');

  const e2 = SearchError.emptyResult('Src');
  r.assert(e2.code === SearchErrorCode.EMPTY_RESULT, 'emptyResult error code');

  const e3 = SearchError.bridgeUnavailable();
  r.assert(e3.code === SearchErrorCode.BRIDGE_UNAVAILABLE, 'bridgeUnavailable error code');

  const e4 = SearchError.sourceDisabled('Src');
  r.assert(e4.code === SearchErrorCode.SOURCE_DISABLED, 'sourceDisabled error code');
  r.assert(e4.sourceName === 'Src', 'sourceDisabled preserves source name');

  // 8. Error toRecord
  const rec = e1.toRecord();
  r.assert(rec['code'] === 'CONFIG_MISSING', 'toRecord has code');
  r.assert(rec['message'].length > 0, 'toRecord has message');

  return r;
}
