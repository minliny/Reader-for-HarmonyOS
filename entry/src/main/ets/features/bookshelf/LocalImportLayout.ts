export class LocalImportResultLayout {
  height: number;
  listHeight: number;
  compact: boolean;
  constructor(height: number, listHeight: number, compact: boolean) {
    this.height = height;
    this.listHeight = listHeight;
    this.compact = compact;
  }
}

/** Native measured sizes; 61 is a row minimum, never a content estimate. */
export function localImportResultLayout(available: number, header: number, summary: number,
  footer: number, items: number): LocalImportResultLayout {
  const cap = Math.max(0, available);
  const chrome = Math.max(0, header) + Math.max(0, summary) + 12;
  const action = Math.max(0, footer);
  const compact = chrome + action > cap;
  const budget = Math.max(0, cap - action - (compact ? 0 : chrome));
  const listHeight = Math.min(Math.max(0, items), budget);
  return new LocalImportResultLayout(Math.min(cap, chrome + action + Math.max(0, items)), listHeight, compact);
}
