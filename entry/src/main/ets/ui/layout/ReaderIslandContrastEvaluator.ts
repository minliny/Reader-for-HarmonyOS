import { readerIslandControlPaint } from '../foundation/ReaderIslandControlPaint';
import type { ReaderIslandControlTone } from '../foundation/ReaderIslandControlPaint';
import { READER_THEME_DEFINITIONS, readerAppColor } from '../foundation/ReaderThemeRegistry';
import { readerIslandCardPaint, readerReadingPanelPaint } from '../surfaces/ReaderReadingPanelPaint';

interface ReaderColorChannels {
  r: number;
  g: number;
  b: number;
  alpha: number;
}

interface ReaderIslandControlColors {
  surface: string;
  border: string;
  ink: string;
}

export interface ReaderIslandContrastPalette {
  shell: string;
  outline: string;
  fallbackOutlineWidth: number;
  nativeOutlineWidth: number;
  nativeShadow: boolean;
  card: string;
  cardBorder: string;
  emphasisCard: string;
  emphasisBorder: string;
  enabled: ReaderIslandControlColors;
  disabled: ReaderIslandControlColors;
  selected: ReaderIslandControlColors;
  stop: ReaderIslandControlColors;
  marked: ReaderIslandControlColors;
}

export interface ReaderIslandContrastCheck {
  id: string;
  actual: number;
  minimum: number;
}

function colorChannels(argb: string): ReaderColorChannels {
  const value = Number.parseInt(argb.slice(1), 16);
  return { r: (value >>> 16) & 255, g: (value >>> 8) & 255, b: value & 255, alpha: (value >>> 24) / 255 };
}

function linearChannel(channel: number): number {
  const srgb = channel / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
}

function luminance(color: ReaderColorChannels): number {
  return 0.2126 * linearChannel(color.r) + 0.7152 * linearChannel(color.g) + 0.0722 * linearChannel(color.b);
}

function composite(foreground: ReaderColorChannels, background: ReaderColorChannels): ReaderColorChannels {
  const alpha = foreground.alpha;
  return {
    r: foreground.r * alpha + background.r * (1 - alpha),
    g: foreground.g * alpha + background.g * (1 - alpha),
    b: foreground.b * alpha + background.b * (1 - alpha),
    alpha: 1,
  };
}

/** WCAG relative luminance and contrast after painting the foreground over the backing color. */
export function readerIslandContrastRatio(foreground: string, background: string): number {
  const backing = colorChannels(background);
  const frontLuminance = luminance(composite(colorChannels(foreground), backing));
  const backLuminance = luminance(backing);
  return (Math.max(frontLuminance, backLuminance) + 0.05) / (Math.min(frontLuminance, backLuminance) + 0.05);
}

function controlColors(scheme: string, enabled: boolean, tone: ReaderIslandControlTone = 'normal'):
  ReaderIslandControlColors {
  const paint = readerIslandControlPaint(enabled, tone);
  return {
    surface: readerAppColor(paint.surface, scheme), border: readerAppColor(paint.border, scheme),
    ink: readerAppColor(paint.ink, scheme),
  };
}

export function readerIslandContrastPalette(scheme: string): ReaderIslandContrastPalette {
  const fallback = readerReadingPanelPaint(scheme, false);
  const native = readerReadingPanelPaint(scheme, true);
  const card = readerIslandCardPaint(scheme, false);
  const emphasisCard = readerIslandCardPaint(scheme, true);
  return {
    shell: fallback.surface ?? '#00000000', outline: native.outline,
    fallbackOutlineWidth: fallback.outlineWidth, nativeOutlineWidth: native.outlineWidth, nativeShadow: native.nativeShadow,
    card: card.surface, cardBorder: card.border, emphasisCard: emphasisCard.surface, emphasisBorder: emphasisCard.border,
    enabled: controlColors(scheme, true), disabled: controlColors(scheme, false),
    selected: controlColors(scheme, true, 'selected'), stop: controlColors(scheme, true, 'stop'),
    marked: controlColors(scheme, true, 'marked'),
  };
}

export function evaluateReaderIslandContrast(palette: ReaderIslandContrastPalette): ReaderIslandContrastCheck[] {
  const checks: ReaderIslandContrastCheck[] = [];
  const ratio = (id: string, foreground: string, background: string, minimum: number): void => {
    checks.push({ id, actual: readerIslandContrastRatio(foreground, background), minimum });
  };
  const opaque = (id: string, color: string): void => {
    checks.push({ id, actual: colorChannels(color).alpha, minimum: 1 });
  };
  const checkCard = (id: string, card: string): void => {
    const cardLuminance = luminance(colorChannels(card));
    checks.push({ id: `shell-to-card-luminance:${id}`,
      actual: cardLuminance - luminance(colorChannels(palette.shell)), minimum: 0.02 });
    checks.push({ id: `card-to-enabled-luminance:${id}`,
      actual: Math.abs(cardLuminance - luminance(colorChannels(palette.enabled.surface))), minimum: 0.03 });
    ratio(`shell-to-card:${id}`, card, palette.shell, 1.15);
    ratio(`card-to-enabled-fill:${id}`, palette.enabled.surface, card, 1.3);
    ratio(`card-to-enabled-border:${id}`, palette.enabled.border, card, 3);
  };
  const checkAction = (id: string, action: ReaderIslandControlColors): void => {
    opaque(`${id}-surface-opacity`, action.surface);
    ratio(`${id}-ink`, action.ink, action.surface, 4.5);
    ratio(`${id}-edge-on-card`, action.border, palette.card, 3);
    ratio(`${id}-edge-on-emphasis`, action.border, palette.emphasisCard, 3);
  };
  opaque('shell-opacity', palette.shell);
  opaque('card-opacity', palette.card);
  opaque('emphasis-card-opacity', palette.emphasisCard);
  opaque('enabled-surface-opacity', palette.enabled.surface);
  opaque('disabled-surface-opacity', palette.disabled.surface);
  checks.push({ id: 'fallback-outline-width', actual: palette.fallbackOutlineWidth, minimum: 1 });
  checks.push({ id: 'native-outline-width', actual: palette.nativeOutlineWidth, minimum: 1 });
  checks.push({ id: 'native-edge-paint', actual: palette.nativeOutlineWidth > 0 || palette.nativeShadow ? 1 : 0, minimum: 1 });
  ratio('shell-outline', palette.outline, palette.shell, 3);
  ratio('card-border', palette.cardBorder, palette.card, 1.7);
  ratio('emphasis-card-border', palette.emphasisBorder, palette.emphasisCard, 2.2);
  for (const paper of READER_THEME_DEFINITIONS) {
    ratio(`paper-outline:${paper.id}:start`, palette.outline, paper.paperStart, 3);
    ratio(`paper-outline:${paper.id}:end`, palette.outline, paper.paperEnd, 3);
  }
  checkCard('regular', palette.card);
  checkCard('emphasis', palette.emphasisCard);
  checkAction('selected', palette.selected);
  checkAction('stop', palette.stop);
  checkAction('marked', palette.marked);
  ratio('enabled-border', palette.enabled.border, palette.enabled.surface, 3);
  ratio('enabled-ink', palette.enabled.ink, palette.enabled.surface, 4.5);
  ratio('disabled-border', palette.disabled.border, palette.disabled.surface, 1.5);
  ratio('disabled-ink', palette.disabled.ink, palette.disabled.surface, 4.5);
  ratio('enabled-vs-disabled-fill', palette.enabled.surface, palette.disabled.surface, 1.25);
  ratio('enabled-vs-disabled-border', palette.enabled.border, palette.disabled.border, 2);
  ratio('enabled-vs-disabled-ink', palette.enabled.ink, palette.disabled.ink, 2);
  return checks;
}
