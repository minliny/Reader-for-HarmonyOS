/** Reader's visual adaptation of Core-provided EPUB TOC depth. */
export interface ReaderDirectoryHierarchyEntry {
  level?: number;
  title: string;
  navigable?: boolean;
}

export function readerDirectoryLevel(entry: ReaderDirectoryHierarchyEntry): number {
  const level = entry.level;
  return level !== undefined && Number.isInteger(level) && level > 0 ? level : 1;
}

export function readerDirectoryIndentVp(entry: ReaderDirectoryHierarchyEntry): number {
  // Keep deeply nested EPUB titles readable in the compact Quick viewport.
  return Math.min(3, readerDirectoryLevel(entry) - 1) * 12;
}

export function readerDirectoryAccessibilityText(entry: ReaderDirectoryHierarchyEntry): string {
  const action = entry.navigable === false ? '卷标题' : '打开章节';
  const level = readerDirectoryLevel(entry);
  return level === 1 ? `${action}：${entry.title}` : `第${level}级，${action}：${entry.title}`;
}
