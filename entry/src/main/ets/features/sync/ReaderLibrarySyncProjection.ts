import type { JsonObject } from '@reader/core-harmony';
import type { ReaderLibrarySyncConflict, ReaderLibrarySyncCandidate } from './ReaderLibrarySyncTypes';

export interface ReaderLibrarySyncRawRecord { key: string; operationId: string; writerId: string; deleted: boolean; value: JsonObject; }
export interface ReaderLibrarySyncRawConflict {
  key: string; kind: string;
  local?: ReaderLibrarySyncRawRecord; remote?: ReaderLibrarySyncRawRecord; candidates?: ReaderLibrarySyncRawRecord[];
}
function label(kind: string): string {
  return ['progress', 'mangaProgress', 'position', 'positionArchive'].includes(kind) ? '阅读位置' : kind === 'bookmark' ? '书签' :
    kind === 'highlight' || kind === 'note' ? '笔记' : kind === 'book' ? '书籍' : kind === 'group' ? '分组' :
    kind === 'retiredBook' ? '已移除书籍' : kind === 'source' ? '书源' : kind === 'settings' || kind === 'configuration' ? '配置' : '书库记录';
}
function summary(record?: ReaderLibrarySyncRawRecord): string {
  if (record === undefined || record.deleted) return '已删除';
  const value = record.value;
  if (value === undefined || value === null || typeof value !== 'object' || Array.isArray(value)) return '保留该版本';
  const parts: string[] = [], layers: JsonObject[] = [value];
  for (const key of ['book', 'row']) {
    const nested = value[key];
    if (nested !== null && typeof nested === 'object' && !Array.isArray(nested)) layers.push(nested as JsonObject);
  }
  for (const layer of layers) {
    for (const field of ['title', 'bookName', 'content', 'note', 'bookText', 'chapterTitle']) {
      const text = layer[field];
      if (typeof text === 'string' && text.trim().length > 0 && !parts.includes(text.slice(0, 160))) parts.push(text.slice(0, 160));
    }
    const chapter = layer['chapterIndex'], offset = layer['chapterOffset'];
    if (typeof chapter === 'number' && Number.isSafeInteger(chapter) && chapter >= 0) parts.push(`章节 ${chapter + 1}`);
    if (typeof offset === 'number' && Number.isSafeInteger(offset) && offset >= 0) parts.push(`文字位置 ${offset}`);
  }
  return parts.length === 0 ? '保留该版本' : parts.join(' · ').slice(0, 400);
}
/** One allowlisted UI projection for both transport protocols. It never
 * stringifies private causal documents, paths or platform credentials. */
export function readerLibrarySyncConflictViews(rows: ReaderLibrarySyncRawConflict[]): ReaderLibrarySyncConflict[] {
  if (!Array.isArray(rows) || rows.length > 100000) throw new Error('LIBRARY_SYNC_CONFLICT_INVALID');
  const keys: Set<string> = new Set();
  return rows.map((row: ReaderLibrarySyncRawConflict): ReaderLibrarySyncConflict => {
    if (typeof row.key !== 'string' || row.key.length < 1 || row.key.length > 4096 || keys.has(row.key) || typeof row.kind !== 'string' ||
      row.candidates !== undefined && (!Array.isArray(row.candidates) || row.candidates.length > 128))
      throw new Error('LIBRARY_SYNC_CONFLICT_INVALID');
    keys.add(row.key);
    const candidates = row.candidates ?? [row.local, row.remote].filter((value): boolean => value !== undefined) as ReaderLibrarySyncRawRecord[];
    const seen: Set<string> = new Set(), choices: ReaderLibrarySyncCandidate[] = [];
    for (const candidate of candidates) {
      if (typeof candidate.operationId !== 'string' || candidate.operationId.length < 1 || candidate.operationId.length > 256 ||
        seen.has(candidate.operationId) || typeof candidate.deleted !== 'boolean') throw new Error('LIBRARY_SYNC_CONFLICT_INVALID');
      seen.add(candidate.operationId);
      choices.push({ choice: `candidate:${candidate.operationId}`, label: candidate.operationId === row.local?.operationId ? '保留本机版本' :
        choices.length === 0 ? '采用另一端版本' : `采用其他版本 ${choices.length + 1}`,
        summary: summary(candidate), deleted: candidate.deleted });
    }
    if (choices.length === 0) throw new Error('LIBRARY_SYNC_CONFLICT_INVALID');
    choices.push({ choice: 'delete', label: '删除此记录', summary: '同步删除记录，避免旧副本将它恢复', deleted: true });
    const reason = row.kind === 'deleteVsUpdate' ? '（删除与修改冲突）' : row.kind === 'concurrentChange' ? '（多端修改）' : '';
    return { key: row.key, label: label(row.key.split(':')[0]) + reason, candidates: choices };
  });
}
