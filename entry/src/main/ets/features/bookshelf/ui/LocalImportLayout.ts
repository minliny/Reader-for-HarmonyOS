/** The document measures header, result rows and actions together at their actual width. */
export function localImportPanelHeight(available: number, contentHeight: number): number {
  if (!Number.isFinite(available) || !Number.isFinite(contentHeight) || contentHeight <= 0) return 0;
  return Math.max(0, Math.min(available, contentHeight + 2));
}
