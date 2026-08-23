/**
 * Pure persisted state for Reader Appearance.
 *
 * This snapshot owns typography and paper appearance only. User-imported
 * fonts carry a Host-validated app-private descriptor; navigation mode and
 * page transition live exclusively in ReaderSettingsSnapshot.
 */
export type ReaderAppearanceTheme =
  | 'day'
  | 'warm'
  | 'night'
  | 'warmNight'
  | 'paper'
  | 'green'
  | 'paperNight'
  | 'greenNight';

/**
 * All eight built-in slots in Figma are real selectable reader fonts. The
 * separate `SourceHanSerif / 思源宋体` product choice intentionally shares the
 * bundled Noto Serif SC physical face used by the Figma document.
 */
export type ReaderAppearanceFont =
  | 'system'
  | 'serif'
  | 'sans'
  | 'kai'
  | 'fangSong'
  | 'mono'
  | 'sourceHanSerif'
  | 'lxgwWenKai'
  | 'custom';

/** Host-validated identity of one app-private TTF/OTF asset. */
export class ReaderCustomFontDescriptor {
  displayName: string;
  familyName: string;
  filePath: string;
  fingerprint: string;

  constructor(displayName: string, familyName: string, filePath: string, fingerprint: string) {
    this.displayName = displayName;
    this.familyName = familyName;
    this.filePath = filePath;
    this.fingerprint = fingerprint;
  }
}

export type ReaderAppearanceIndent = 'none' | 'single' | 'firstLine';

export type ReaderAppearanceAlignment = 'start' | 'justify';

/** Migration-only field from the v1 snapshot, before page transition moved to Reader Settings. */
export type ReaderAppearancePageTurn = 'none';

export type ReaderAppearanceMetric =
  | 'fontSize'
  | 'lineHeightMultiplier'
  | 'paragraphSpacing'
  | 'letterSpacing';

export type ReaderAppearanceStepDirection = -1 | 1;

/** User-facing safety range for one persisted reader metric. */
export class ReaderAppearanceMetricRange {
  readonly minimum: number;
  readonly maximum: number;

  constructor(minimum: number, maximum: number) {
    this.minimum = minimum;
    this.maximum = maximum;
  }
}

// These are interaction bounds, not replacements for the current value. They
// keep corrupt preferences and repeated step presses inside a usable paging
// envelope while leaving the existing defaults and step sizes unchanged.
export const READER_APPEARANCE_FONT_SIZE_RANGE = new ReaderAppearanceMetricRange(12, 40);
export const READER_APPEARANCE_LINE_HEIGHT_RANGE = new ReaderAppearanceMetricRange(1.2, 2.8);
export const READER_APPEARANCE_PARAGRAPH_SPACING_RANGE = new ReaderAppearanceMetricRange(0, 32);
export const READER_APPEARANCE_LETTER_SPACING_RANGE = new ReaderAppearanceMetricRange(-2, 4);

export type ReaderAppearanceSnapshot = {
  version: 2;
  activeTheme: ReaderAppearanceTheme;
  dayTheme: ReaderAppearanceTheme;
  nightTheme: ReaderAppearanceTheme;
  font: ReaderAppearanceFont;
  customFont: ReaderCustomFontDescriptor | undefined;
  fontSize: number;
  lineHeightMultiplier: number;
  paragraphSpacing: number;
  letterSpacing: number;
  indent: ReaderAppearanceIndent;
  alignment: ReaderAppearanceAlignment;
};

/** Appearance shape persisted before app-private custom fonts were admitted. */
export type ReaderAppearanceSnapshotV1 = {
  version: 1;
  activeTheme: ReaderAppearanceTheme;
  dayTheme: ReaderAppearanceTheme;
  nightTheme: ReaderAppearanceTheme;
  font: Exclude<ReaderAppearanceFont, 'custom'>;
  fontSize: number;
  lineHeightMultiplier: number;
  paragraphSpacing: number;
  letterSpacing: number;
  indent: ReaderAppearanceIndent;
  alignment: ReaderAppearanceAlignment;
  pageTurn: ReaderAppearancePageTurn;
};

export function createDefaultReaderAppearanceSnapshot(): ReaderAppearanceSnapshot {
  return {
    version: 2,
    activeTheme: 'paper',
    dayTheme: 'paper',
    nightTheme: 'paperNight',
    font: 'serif',
    customFont: undefined,
    fontSize: 18,
    lineHeightMultiplier: 1.96,
    paragraphSpacing: 16,
    letterSpacing: 0,
    indent: 'none',
    alignment: 'justify',
  };
}

/**
 * Sanitizes a value decoded from preferences. Missing/corrupt fields fall
 * back independently, while an unavailable font fails closed to the bundled
 * Serif slot. A legacy v1 pageTurn value is intentionally discarded.
 */
export function normalizeReaderAppearanceSnapshot(
  candidate: ReaderAppearanceSnapshot | ReaderAppearanceSnapshotV1,
): ReaderAppearanceSnapshot {
  const fallback = createDefaultReaderAppearanceSnapshot();
  const customFont = candidate.version === 2 ? normalizeReaderCustomFontDescriptor(candidate.customFont) : undefined;
  const font = isReaderAppearanceFont(candidate.font) && (candidate.font !== 'custom' || customFont !== undefined) ?
    candidate.font : fallback.font;
  return {
    version: 2,
    activeTheme: isReaderAppearanceTheme(candidate.activeTheme) ? candidate.activeTheme : fallback.activeTheme,
    dayTheme: isReaderAppearanceTheme(candidate.dayTheme) ? candidate.dayTheme : fallback.dayTheme,
    nightTheme: isReaderAppearanceTheme(candidate.nightTheme) ? candidate.nightTheme : fallback.nightTheme,
    font,
    customFont,
    fontSize: isPositiveFinite(candidate.fontSize) ?
      clampReaderAppearanceMetric('fontSize', candidate.fontSize) : fallback.fontSize,
    lineHeightMultiplier: isPositiveFinite(candidate.lineHeightMultiplier) ?
      clampReaderAppearanceMetric('lineHeightMultiplier', candidate.lineHeightMultiplier) :
      fallback.lineHeightMultiplier,
    paragraphSpacing: isNonNegativeFinite(candidate.paragraphSpacing) ?
      clampReaderAppearanceMetric('paragraphSpacing', candidate.paragraphSpacing) : fallback.paragraphSpacing,
    letterSpacing: Number.isFinite(candidate.letterSpacing) ?
      clampReaderAppearanceMetric('letterSpacing', candidate.letterSpacing) : fallback.letterSpacing,
    indent: isReaderAppearanceIndent(candidate.indent) ? candidate.indent : fallback.indent,
    alignment: isReaderAppearanceAlignment(candidate.alignment) ? candidate.alignment : fallback.alignment,
  };
}

export function copyReaderAppearanceSnapshot(snapshot: ReaderAppearanceSnapshot): ReaderAppearanceSnapshot {
  return normalizeReaderAppearanceSnapshot(snapshot);
}

export function setReaderAppearanceTheme(
  snapshot: ReaderAppearanceSnapshot,
  theme: ReaderAppearanceTheme,
): ReaderAppearanceSnapshot {
  return copyWith(snapshot, theme, snapshot.dayTheme, snapshot.nightTheme, snapshot.font, snapshot.indent,
    snapshot.alignment, undefined, undefined);
}

export function setReaderAppearanceDayTheme(
  snapshot: ReaderAppearanceSnapshot,
  theme: ReaderAppearanceTheme,
): ReaderAppearanceSnapshot {
  return copyWith(snapshot, snapshot.activeTheme, theme, snapshot.nightTheme, snapshot.font, snapshot.indent,
    snapshot.alignment, undefined, undefined);
}

export function setReaderAppearanceNightTheme(
  snapshot: ReaderAppearanceSnapshot,
  theme: ReaderAppearanceTheme,
): ReaderAppearanceSnapshot {
  return copyWith(snapshot, snapshot.activeTheme, snapshot.dayTheme, theme, snapshot.font, snapshot.indent,
    snapshot.alignment, undefined, undefined);
}

export function setReaderAppearanceFont(
  snapshot: ReaderAppearanceSnapshot,
  font: ReaderAppearanceFont,
): ReaderAppearanceSnapshot {
  return copyWith(snapshot, snapshot.activeTheme, snapshot.dayTheme, snapshot.nightTheme, font,
    snapshot.indent, snapshot.alignment, undefined, undefined);
}

export function setReaderAppearanceCustomFont(
  snapshot: ReaderAppearanceSnapshot,
  descriptor: ReaderCustomFontDescriptor,
): ReaderAppearanceSnapshot {
  const customFont = normalizeReaderCustomFontDescriptor(descriptor);
  if (customFont === undefined) {
    throw new RangeError('custom font descriptor is invalid');
  }
  return normalizeReaderAppearanceSnapshot({
    ...copyReaderAppearanceSnapshot(snapshot),
    font: 'custom',
    customFont,
  });
}

export function setReaderAppearanceIndent(
  snapshot: ReaderAppearanceSnapshot,
  indent: ReaderAppearanceIndent,
): ReaderAppearanceSnapshot {
  return copyWith(snapshot, snapshot.activeTheme, snapshot.dayTheme, snapshot.nightTheme, snapshot.font, indent,
    snapshot.alignment, undefined, undefined);
}

export function setReaderAppearanceAlignment(
  snapshot: ReaderAppearanceSnapshot,
  alignment: ReaderAppearanceAlignment,
): ReaderAppearanceSnapshot {
  return copyWith(snapshot, snapshot.activeTheme, snapshot.dayTheme, snapshot.nightTheme, snapshot.font,
    snapshot.indent,
    alignment, undefined, undefined);
}

/**
 * Applies an absolute metric supplied by the owner. Step sizes are not encoded
 * in the inspected Figma frames, so the component reports only direction and
 * the owner chooses the production step before calling this function.
 */
export function setReaderAppearanceMetric(
  snapshot: ReaderAppearanceSnapshot,
  metric: ReaderAppearanceMetric,
  value: number,
): ReaderAppearanceSnapshot {
  if (metric === 'fontSize' || metric === 'lineHeightMultiplier') {
    if (!isPositiveFinite(value)) {
      throw new RangeError(`${metric} must be a positive finite number`);
    }
  } else if (metric === 'paragraphSpacing') {
    if (!isNonNegativeFinite(value)) {
      throw new RangeError('paragraphSpacing must be a non-negative finite number');
    }
  } else if (!Number.isFinite(value)) {
    throw new RangeError('letterSpacing must be a finite number');
  }
  const boundedValue = clampReaderAppearanceMetric(metric, value);
  return copyWith(snapshot, snapshot.activeTheme, snapshot.dayTheme, snapshot.nightTheme, snapshot.font,
    snapshot.indent,
    snapshot.alignment, metric, boundedValue);
}

export function readerAppearanceMetricRange(metric: ReaderAppearanceMetric): ReaderAppearanceMetricRange {
  if (metric === 'fontSize') {
    return READER_APPEARANCE_FONT_SIZE_RANGE;
  }
  if (metric === 'lineHeightMultiplier') {
    return READER_APPEARANCE_LINE_HEIGHT_RANGE;
  }
  if (metric === 'paragraphSpacing') {
    return READER_APPEARANCE_PARAGRAPH_SPACING_RANGE;
  }
  return READER_APPEARANCE_LETTER_SPACING_RANGE;
}

export function readerAppearanceCanStep(
  snapshot: ReaderAppearanceSnapshot,
  metric: ReaderAppearanceMetric,
  direction: ReaderAppearanceStepDirection,
): boolean {
  const range = readerAppearanceMetricRange(metric);
  const value = readerAppearanceMetricValue(snapshot, metric);
  return direction < 0 ? value > range.minimum : value < range.maximum;
}

export function isReaderAppearanceTheme(value: string): value is ReaderAppearanceTheme {
  return value === 'day' || value === 'warm' || value === 'night' || value === 'warmNight' ||
    value === 'paper' || value === 'green' || value === 'paperNight' || value === 'greenNight';
}

export function isReaderAppearanceFont(value: string): value is ReaderAppearanceFont {
  return value === 'system' || value === 'serif' || value === 'sans' || value === 'kai' ||
    value === 'fangSong' || value === 'mono' || value === 'sourceHanSerif' || value === 'lxgwWenKai' ||
    value === 'custom';
}

export function normalizeReaderCustomFontDescriptor(
  candidate: ReaderCustomFontDescriptor | undefined,
): ReaderCustomFontDescriptor | undefined {
  if (candidate === undefined) {
    return undefined;
  }
  const displayName = candidate.displayName.trim();
  if (displayName.length === 0 || displayName.length > 64 ||
    !/^ReaderCustom_[0-9a-f]{16}$/.test(candidate.familyName) ||
    !/^[0-9a-f]{64}$/.test(candidate.fingerprint) ||
    candidate.filePath.length === 0 || candidate.filePath.length > 1024 ||
    !candidate.filePath.startsWith('/') || candidate.filePath.includes('/../')) {
    return undefined;
  }
  return new ReaderCustomFontDescriptor(
    displayName,
    candidate.familyName,
    candidate.filePath,
    candidate.fingerprint,
  );
}

function isReaderAppearanceIndent(value: string): value is ReaderAppearanceIndent {
  return value === 'none' || value === 'single' || value === 'firstLine';
}

function isReaderAppearanceAlignment(value: string): value is ReaderAppearanceAlignment {
  return value === 'start' || value === 'justify';
}

function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function isNonNegativeFinite(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function clampReaderAppearanceMetric(metric: ReaderAppearanceMetric, value: number): number {
  const range = readerAppearanceMetricRange(metric);
  return Math.min(range.maximum, Math.max(range.minimum, value));
}

function readerAppearanceMetricValue(
  snapshot: ReaderAppearanceSnapshot,
  metric: ReaderAppearanceMetric,
): number {
  if (metric === 'fontSize') {
    return snapshot.fontSize;
  }
  if (metric === 'lineHeightMultiplier') {
    return snapshot.lineHeightMultiplier;
  }
  if (metric === 'paragraphSpacing') {
    return snapshot.paragraphSpacing;
  }
  return snapshot.letterSpacing;
}

function copyWith(
  snapshot: ReaderAppearanceSnapshot,
  activeTheme: ReaderAppearanceTheme,
  dayTheme: ReaderAppearanceTheme,
  nightTheme: ReaderAppearanceTheme,
  font: ReaderAppearanceFont,
  indent: ReaderAppearanceIndent,
  alignment: ReaderAppearanceAlignment,
  metric: ReaderAppearanceMetric | undefined,
  metricValue: number | undefined,
): ReaderAppearanceSnapshot {
  const next: ReaderAppearanceSnapshot = {
    version: 2,
    activeTheme,
    dayTheme,
    nightTheme,
    font,
    customFont: normalizeReaderCustomFontDescriptor(snapshot.customFont),
    fontSize: snapshot.fontSize,
    lineHeightMultiplier: snapshot.lineHeightMultiplier,
    paragraphSpacing: snapshot.paragraphSpacing,
    letterSpacing: snapshot.letterSpacing,
    indent,
    alignment,
  };
  if (metric === 'fontSize' && metricValue !== undefined) {
    next.fontSize = metricValue;
  } else if (metric === 'lineHeightMultiplier' && metricValue !== undefined) {
    next.lineHeightMultiplier = metricValue;
  } else if (metric === 'paragraphSpacing' && metricValue !== undefined) {
    next.paragraphSpacing = metricValue;
  } else if (metric === 'letterSpacing' && metricValue !== undefined) {
    next.letterSpacing = metricValue;
  }
  return normalizeReaderAppearanceSnapshot(next);
}
