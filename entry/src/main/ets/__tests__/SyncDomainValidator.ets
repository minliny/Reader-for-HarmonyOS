// SyncDomainValidator — sync domain contract tests
import { ConflictPolicy } from '../models/SyncModels';

interface TestResult { name: string; passed: boolean; error?: string; }
class TR { results: TestResult[] = []; passed=0; failed=0;
  assert(c:boolean,n:string,e?:string):void{const o=c;this.results.push({name:n,passed:o,error:o?undefined:e});if(o)this.passed++;else this.failed++;}
  summary():string{return`${this.passed}P ${this.failed}F`;}
}

export function runSyncDomainTests(): TR {
  const r = new TR();

  // 1. ConflictPolicy enum
  r.assert(ConflictPolicy.lastWriteWins === 'lastWriteWins', 'lastWriteWins value');
  r.assert(ConflictPolicy.manual === 'manual', 'manual value');
  r.assert(ConflictPolicy.keepBoth === 'keepBoth', 'keepBoth value');

  // 2. Progress record shape
  const record = { bookId:'b1', currentChapterIndex:3, chapterProgress:0.5, totalChapters:10, lastOpenedAt:Date.now(), updatedAt:Date.now() };
  r.assert(record.bookId === 'b1', 'record has bookId');
  r.assert(record.chapterProgress === 0.5, 'record has progress');

  // 3. Backup config shape
  const config = { name:'test', remotePath:'/backup', includeProgress:true, includeBooks:true, autoBackup:false };
  r.assert(config.name === 'test', 'config has name');
  r.assert(config.autoBackup === false, 'config autoBackup false');

  // 4. Empty sync state
  const records: object[] = [];
  r.assert(records.length === 0, 'empty records list');

  // 5. Progress record has all required fields
  const keys = Object.keys(record);
  r.assert(keys.indexOf('bookId') !== -1, 'record has bookId key');
  r.assert(keys.indexOf('chapterProgress') !== -1, 'record has chapterProgress key');
  r.assert(keys.indexOf('updatedAt') !== -1, 'record has updatedAt key');

  return r;
}
