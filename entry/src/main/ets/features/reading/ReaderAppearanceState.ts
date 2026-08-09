/**
 * Pure persisted state for Reader Appearance.
 *
 * The state deliberately contains only options that the current HarmonyOS
 * bundle can render without a Host/Core capability. Imported fonts and every
 * page-turn mode except `none` are therefore excluded from the writable type
 * and are normalized back to the safe built-in values on load.
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
 * Figma's selected `Serif / 宋体` slot is rendered by the bundled
 * Noto Serif SC files. `SourceHanSerif / 思源宋体` remains a separate visual
 * slot and must not be marked active merely because it shares that face.
 */
export type ReaderAppearanceFont = 'serif';

export type ReaderAppearanceIndent = 'none' | 'firstLine';

export type ReaderAppearanceAlignment = 'start' | 'justify';

export type ReaderAppearancePageTurn = 'none';

export type ReaderAppearanceMetric =
  | 'fontSize'
  | 'lineHeightMultiplier'
  | 'paragraphSpacing'
  | 'letterSpacing';

export type ReaderAppearanceStepDirection = -1 | 1;

export type ReaderAppearanceSnapshot = {
  version: 1;
  activeTheme: ReaderAppearanceTheme;
  dayTheme: ReaderAppearanceTheme;
  nightTheme: ReaderAppearanceTheme;
  font: ReaderAppearanceFont;
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
    version: 1,
    activeTheme: 'paper',
    dayTheme: 'paper',
    nightTheme: 'paperNight',
    font: 'serif',
    fontSize: 18,
    lineHeightMultiplier: 1.96,
    paragraphSpacing: 16,
    letterSpacing: 0,
    indent: 'none',
    alignment: 'justify',
    pageTurn: 'none',
  };
}

/**
 * Sanitizes a value decoded from preferences. Missing/corrupt fields fall
 * back independently, while unavailable font/page-turn values always fail
 * closed to the Figma Serif slot (backed by Noto Serif SC) and the
 * instantaneous `none` mode.
 */
export function normalizeReaderAppearanceSnapshot(
  candidate: ReaderAppearanceSnapshot,
): ReaderAppearanceSnapshot {
  const fallback = createDefaultReaderAppearanceSnapshot();
  return {
    version: 1,
    activeTheme: isReaderAppearanceTheme(candidate.activeTheme) ? candidate.activeTheme : fallback.activeTheme,
    dayTheme: isReaderAppearanceTheme(candidate.dayTheme) ? candidate.dayTheme : fallback.dayTheme,
    nightTheme: isReaderAppearanceTheme(candidate.nightTheme) ? candidate.nightTheme : fallback.nightTheme,
    font: 'serif',
    fontSize: isPositiveFinite(candidate.fontSize) ? candidate.fontSize : fallback.fontSize,
    lineHeightMultiplier: isPositiveFinite(candidate.lineHeightMultiplier) ?
      candidate.lineHeightMultiplier : fallback.lineHeightMultiplier,
    paragraphSpacing: isNonNegativeFinite(candidate.paragraphSpacing) ?
      candidate.paragraphSpacing : fallback.paragraphSpacing,
    letterSpacing: Number.isFinite(candidate.letterSpacing) ? candidate.letterSpacing : fallback.letterSpacing,
    indent: isReaderAppearanceIndent(candidate.indent) ? candidate.indent : fallback.indent,
    alignment: isReaderAppearanceAlignment(candidate.alignment) ? candidate.alignment : fallback.alignment,
    pageTurn: 'none',
  };
}

export function copyReaderAppearanceSnapshot(snapshot: ReaderAppearanceSnapshot): ReaderAppearanceSnapshot {
  return normalizeReaderAppearanceSnapshot(snapshot);
}

export function setReaderAppearanceTheme(
  snapshot: ReaderAppearanceSnapshot,
  theme: ReaderAppearanceTheme,
): ReaderAppearanceSnapshot {
  return copyWith(snapshot, theme, snapshot.dayTheme, snapshot.nightTheme, snapshot.indent,
    snapshot.alignment, undefined, undefined);
}

export function setReaderAppearanceDayTheme(
  snapshot: ReaderAppearanceSnapshot,
  theme: ReaderAppearanceTheme,
): ReaderAppearanceSnapshot {
  return copyWith(snapshot, snapshot.activeTheme, theme, snapshot.nightTheme, snapshot.indent,
    snapshot.alignment, undefined, undefined);
}

export function setReaderAppearanceNightTheme(
  snapshot: ReaderAppearanceSnapshot,
  theme: ReaderAppearanceTheme,
): ReaderAppearanceSnapshot {
  return copyWith(snapshot, snapshot.activeTheme, snapshot.dayTheme, theme, snapshot.indent,
    snapshot.alignment, undefined, undefined);
}

export function setReaderAppearanceFont(
  snapshot: ReaderAppearanceSnapshot,
  _font: ReaderAppearanceFont,
): ReaderAppearanceSnapshot {
  // There is one admitted bundled font today. Keeping this transition explicit
  // gives the owner a stable API without pretending unsupported slots work.
  return copyReaderAppearanceSnapshot(snapshot);
}

export function setReaderAppearanceIndent(
  snapshot: ReaderAppearanceSnapshot,
  indent: ReaderAppearanceIndent,
): ReaderAppearanceSnapshot {
  return copyWith(snapshot, snapshot.activeTheme, snapshot.dayTheme, snapshot.nightTheme, indent,
    snapshot.alignment, undefined, undefined);
}

export function setReaderAppearanceAlignment(
  snapshot: ReaderAppearanceSnapshot,
  alignment: ReaderAppearanceAlignment,
): ReaderAppearanceSnapshot {
  return copyWith(snapshot, snapshot.activeTheme, snapshot.dayTheme, snapshot.nightTheme, snapshot.indent,
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
  return copyWith(snapshot, snapshot.activeTheme, snapshot.dayTheme, snapshot.nightTheme, snapshot.indent,
    snapshot.alignment, metric, value);
}

export function isReaderAppearanceTheme(value: string): value is ReaderAppearanceTheme {
  return value === 'day' || value === 'warm' || value === 'night' || value === 'warmNight' ||
    value === 'paper' || value === 'green' || value === 'paperNight' || value === 'greenNight';
}

function isReaderAppearanceIndent(value: string): value is ReaderAppearanceIndent {
  return value === 'none' || value === 'firstLine';
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

function copyWith(
  snapshot: ReaderAppearanceSnapshot,
  activeTheme: ReaderAppearanceTheme,
  dayTheme: ReaderAppearanceTheme,
  nightTheme: ReaderAppearanceTheme,
  indent: ReaderAppearanceIndent,
  alignment: ReaderAppearanceAlignment,
  metric: ReaderAppearanceMetric | undefined,
  metricValue: number | undefined,
): ReaderAppearanceSnapshot {
  const next: ReaderAppearanceSnapshot = {
    version: 1,
    activeTheme,
    dayTheme,
    nightTheme,
    font: 'serif',
    fontSize: snapshot.fontSize,
    lineHeightMultiplier: snapshot.lineHeightMultiplier,
    paragraphSpacing: snapshot.paragraphSpacing,
    letterSpacing: snapshot.letterSpacing,
    indent,
    alignment,
    pageTurn: 'none',
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
