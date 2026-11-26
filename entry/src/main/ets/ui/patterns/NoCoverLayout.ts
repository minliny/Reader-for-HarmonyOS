export type NoCoverVariant = 'novel' | 'comic';
export type NoCoverDensity = 'micro' | 'compact' | 'regular' | 'large';
export type NoCoverTextAlign = 'center' | 'start';
export type NoCoverWordBreak = 'break-all' | 'break-word';
export type NoCoverVerticalAlign = 'center' | 'top';

export interface NoCoverRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface NoCoverTitleMeasure {
  readonly visualUnits: number;
  readonly preferWordBreak: boolean;
}

export interface NoCoverTitleLayout {
  readonly text: string;
  readonly box: NoCoverRect;
  readonly fontSizeVp: number;
  readonly lineHeightVp: number;
  readonly letterSpacingVp: number;
  readonly maxLines: number;
  readonly textAlign: NoCoverTextAlign;
  readonly verticalAlign: NoCoverVerticalAlign;
  readonly wordBreak: NoCoverWordBreak;
}

export interface NoCoverNovelLayout {
  readonly spineWidth: number;
  readonly spineLineX: number;
  readonly showFooter: boolean;
  readonly showFooterRule: boolean;
  readonly footerRule: NoCoverRect;
  readonly footerBox: NoCoverRect;
  readonly footerFontSizeVp: number;
  readonly footerLineHeightVp: number;
  readonly footerLetterSpacingVp: number;
}

export interface NoCoverComicLayout {
  readonly bottomBand: NoCoverRect;
  readonly badgeBox: NoCoverRect;
  readonly badgeFontSizeVp: number;
  readonly badgeLineHeightVp: number;
  readonly showAccentMark: boolean;
  readonly accentMark: NoCoverRect;
}

export interface NoCoverLayoutMetrics {
  readonly width: number;
  readonly height: number;
  readonly cornerRadius: number;
  readonly variant: NoCoverVariant;
  readonly density: NoCoverDensity;
  readonly kindText: string;
  readonly title: NoCoverTitleLayout;
  readonly novel: NoCoverNovelLayout;
  readonly comic: NoCoverComicLayout;
}

const ZERO_RECT: NoCoverRect = { x: 0, y: 0, width: 0, height: 0 };

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function finitePositive(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function isWhitespaceCodePoint(cp: number): boolean {
  return cp === 0x20 || cp === 0x09 || cp === 0x0A || cp === 0x0D || cp === 0x3000;
}

function isNarrowAsciiPunctuation(cp: number): boolean {
  return cp === 0x2E || cp === 0x2C || cp === 0x3A || cp === 0x3B || cp === 0x27 ||
    cp === 0x21 || cp === 0x7C || cp === 0x2D || cp === 0x2F || cp === 0x28 ||
    cp === 0x29 || cp === 0x5B || cp === 0x5D;
}

export function noCoverDisplayTitle(title: string | undefined): string {
  const trimmed = title?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : '未命名';
}

export function noCoverVariant(kindLabel: string | undefined): NoCoverVariant {
  return kindLabel?.trim() === '漫画' ? 'comic' : 'novel';
}

export function noCoverResolvedKindLabel(kindLabel: string | undefined, variant: NoCoverVariant): string {
  const trimmed = kindLabel?.trim() ?? '';
  if (variant === 'comic') return trimmed.length > 0 ? trimmed : '漫画';
  return trimmed;
}

export function estimateNoCoverTitleUnits(title: string): NoCoverTitleMeasure {
  const normalized = noCoverDisplayTitle(title);
  let visualUnits = 0;
  let cjkCount = 0;
  let latinCount = 0;
  let hasWordBreakPunct = false;
  let previousSpace = false;

  let index = 0;
  while (index < normalized.length) {
    const cp = normalized.codePointAt(index);
    if (cp === undefined) break;
    index += cp > 0xFFFF ? 2 : 1;

    if (isWhitespaceCodePoint(cp)) {
      if (!previousSpace) {
        visualUnits += 0.36;
        previousSpace = true;
      }
      hasWordBreakPunct = true;
      continue;
    }
    previousSpace = false;

    if (cp >= 0x2E80) {
      visualUnits += 1.0;
      cjkCount += 1;
    } else if ((cp >= 0x41 && cp <= 0x5A) || (cp >= 0x30 && cp <= 0x39)) {
      visualUnits += 0.64;
      latinCount += 1;
    } else if (cp >= 0x61 && cp <= 0x7A) {
      visualUnits += 0.54;
      latinCount += 1;
    } else if (isNarrowAsciiPunctuation(cp)) {
      visualUnits += 0.36;
      if (cp === 0x2D || cp === 0x2F) hasWordBreakPunct = true;
    } else {
      visualUnits += 0.72;
    }
  }

  const preferWordBreak = hasWordBreakPunct && latinCount >= 4 && latinCount > cjkCount;
  return {
    visualUnits: Math.max(1, visualUnits),
    preferWordBreak,
  };
}

function resolveDensity(width: number): NoCoverDensity {
  if (width < 52) return 'micro';
  if (width < 76) return 'compact';
  if (width < 120) return 'regular';
  return 'large';
}

function buildNovelLayout(width: number, height: number, u: number, density: NoCoverDensity,
  kindText: string): { layout: NoCoverNovelLayout; titleBox: NoCoverRect } {
  const spineWidth = clamp(width * 0.17, 7, 22);
  const spineLineX = Math.max(0, spineWidth - 2.5);
  const padX = clamp(u * 7.0, 3.8, 12);
  const padBottom = clamp(u * 6.5, 4.5, 11);

  const showFooter = kindText.length > 0 && density !== 'micro';
  const footerFontSizeVp = clamp(u * 7.0, 6.5, 11.0);
  const footerLineHeightVp = footerFontSizeVp * 1.25;
  const footerLetterSpacingVp = clamp(u * 0.8, 0.4, 1.4);
  const footerY = Math.max(0, height - padBottom - footerLineHeightVp);

  const showFooterRule = showFooter;
  const ruleW = clamp(u * 8.5, 4.5, 13);
  const ruleGap = clamp(u * 3.2, 2.0, 5.5);
  const footerRule: NoCoverRect = showFooterRule
    ? {
        x: spineWidth + padX,
        y: footerY + Math.max(0, (footerLineHeightVp - 1.2) / 2),
        width: ruleW,
        height: 1.2,
      }
    : ZERO_RECT;

  const footerTextX = showFooterRule ? footerRule.x + footerRule.width + ruleGap : spineWidth + padX;
  const footerMaxRight = Math.min(width - padX, width * 0.65);
  const footerBox: NoCoverRect = showFooter
    ? {
        x: footerTextX,
        y: footerY,
        width: Math.max(0, footerMaxRight - footerTextX),
        height: footerLineHeightVp,
      }
    : ZERO_RECT;

  const naturalTopY = clamp(u * 10, 5, 11);
  const topY = width >= 76 ? Math.max(33, clamp(u * 12, 8, 18)) : naturalTopY;
  const bottomY = showFooter
    ? Math.max(topY, footerY - clamp(u * 4, 3, 7))
    : Math.max(topY, height - padBottom);

  const titleBox: NoCoverRect = {
    x: spineWidth + padX,
    y: topY,
    width: Math.max(0, width - spineWidth - padX * 1.8),
    height: Math.max(0, bottomY - topY),
  };

  return {
    layout: {
      spineWidth,
      spineLineX,
      showFooter,
      showFooterRule,
      footerRule,
      footerBox,
      footerFontSizeVp,
      footerLineHeightVp,
      footerLetterSpacingVp,
    },
    titleBox,
  };
}

function buildComicLayout(width: number, height: number, u: number,
  density: NoCoverDensity): { layout: NoCoverComicLayout; titleBox: NoCoverRect } {
  const bottomBandHeight = clamp(height * 0.27, 15, 48);
  const bottomBand: NoCoverRect = {
    x: 0,
    y: Math.max(0, height - bottomBandHeight),
    width,
    height: Math.min(height, bottomBandHeight),
  };

  const padX = clamp(u * 8.5, 5, 14);
  const badgeFontSizeVp = clamp(u * 7.5, 6.5, 11.5);
  const badgeLineHeightVp = badgeFontSizeVp * 1.2;
  const badgeMaxRight = Math.min(width - padX, width * 0.56);
  const badgeBox: NoCoverRect = {
    x: padX,
    y: bottomBand.y + Math.max(0, (bottomBand.height - badgeLineHeightVp) / 2),
    width: Math.max(0, badgeMaxRight - padX),
    height: Math.min(bottomBand.height, badgeLineHeightVp),
  };

  const showAccentMark = density !== 'micro';
  const markSize = clamp(u * 6, 4, 9);
  const accentMark: NoCoverRect = showAccentMark
    ? {
        x: Math.max(0, width - padX - markSize),
        y: bottomBand.y + Math.max(0, (bottomBand.height - markSize) / 2),
        width: markSize,
        height: markSize,
      }
    : ZERO_RECT;

  const naturalTopY = clamp(u * 9, 5, 10);
  const topY = width >= 76 ? Math.max(33, clamp(u * 11, 7, 17)) : naturalTopY;
  const bottomY = Math.max(topY, bottomBand.y - clamp(u * 5, 3, 8));
  const titleBox: NoCoverRect = {
    x: padX,
    y: topY,
    width: Math.max(0, width - padX * 2),
    height: Math.max(0, bottomY - topY),
  };

  return {
    layout: {
      bottomBand,
      badgeBox,
      badgeFontSizeVp,
      badgeLineHeightVp,
      showAccentMark,
      accentMark,
    },
    titleBox,
  };
}

function solveTitleLayout(
  titleBox: NoCoverRect,
  text: string,
  measure: NoCoverTitleMeasure,
  variant: NoCoverVariant,
  density: NoCoverDensity,
  u: number,
): NoCoverTitleLayout {
  if (titleBox.width <= 0 || titleBox.height <= 0 || u <= 0) {
    return {
      text,
      box: titleBox,
      fontSizeVp: 8,
      lineHeightVp: 10,
      letterSpacingVp: 0,
      maxLines: 1,
      textAlign: variant === 'comic' ? 'start' : 'center',
      verticalAlign: 'center',
      wordBreak: measure.preferWordBreak ? 'break-word' : 'break-all',
    };
  }

  let baseUnits = 8.8;
  if (measure.visualUnits <= 4) {
    baseUnits = variant === 'comic' ? 14.5 : 15.2;
  } else if (measure.visualUnits <= 8) {
    baseUnits = variant === 'comic' ? 12.6 : 13.0;
  } else if (measure.visualUnits <= 14) {
    baseUnits = variant === 'comic' ? 11.0 : 11.2;
  } else if (measure.visualUnits <= 24) {
    baseUnits = variant === 'comic' ? 9.8 : 10.0;
  }

  const floorForDensity = density === 'micro' ? 7.2 : density === 'compact' ? 8.0 : density === 'regular' ? 9.0 : 11.5;
  const minFontVp = Math.min(floorForDensity, Math.max(1, titleBox.height * 0.65));
  let fontSizeVp = Math.max(minFontVp, baseUnits * u);

  let estimatedLines = 1;
  let lineRatio = 1.28;

  for (let step = 0; step < 8; step++) {
    const charsPerLine = Math.max(1.5, titleBox.width / (fontSizeVp * 1.04));
    estimatedLines = Math.max(1, Math.ceil(measure.visualUnits / charsPerLine));
    lineRatio = estimatedLines <= 2 ? 1.28 : estimatedLines <= 4 ? 1.23 : 1.19;
    if (estimatedLines * fontSizeVp * lineRatio <= titleBox.height + 0.5 || fontSizeVp <= minFontVp) {
      break;
    }
    fontSizeVp = Math.max(minFontVp, fontSizeVp * 0.92);
  }

  const finalCharsPerLine = Math.max(1.5, titleBox.width / (fontSizeVp * 1.04));
  estimatedLines = Math.max(1, Math.ceil(measure.visualUnits / finalCharsPerLine));
  lineRatio = estimatedLines <= 2 ? 1.28 : estimatedLines <= 4 ? 1.23 : 1.19;

  let lineHeightVp = fontSizeVp * lineRatio;
  if (lineHeightVp > titleBox.height + 0.5) {
    lineHeightVp = titleBox.height;
    fontSizeVp = Math.min(fontSizeVp, titleBox.height * 0.85);
  }

  const densityLineCap = density === 'micro' ? 3 : density === 'compact' ? 4 : 5;
  const fitLines = Math.floor((titleBox.height + 0.5) / Math.max(0.5, lineHeightVp));
  const maxLines = Math.max(1, Math.min(densityLineCap, fitLines));

  let textAlign: NoCoverTextAlign = 'start';
  let verticalAlign: NoCoverVerticalAlign = 'center';
  let letterSpacingVp = 0;

  if (variant === 'novel') {
    if (estimatedLines <= 2) {
      textAlign = 'center';
      verticalAlign = 'center';
      if (measure.visualUnits <= 4) {
        letterSpacingVp = clamp(u * 0.8, 0.3, 1.5);
      } else if (measure.visualUnits <= 8) {
        letterSpacingVp = clamp(u * 0.35, 0.1, 0.8);
      }
    } else {
      textAlign = 'start';
      verticalAlign = 'center';
    }
  } else {
    textAlign = 'start';
    verticalAlign = estimatedLines >= 3 ? 'top' : 'center';
  }

  return {
    text,
    box: titleBox,
    fontSizeVp,
    lineHeightVp,
    letterSpacingVp,
    maxLines,
    textAlign,
    verticalAlign,
    wordBreak: measure.preferWordBreak ? 'break-word' : 'break-all',
  };
}

export function computeNoCoverLayout(
  coverWidth: number,
  coverHeight: number,
  title: string | undefined,
  kindLabel: string | undefined,
  requestedRadius: number = 8,
): NoCoverLayoutMetrics {
  const width = finitePositive(coverWidth);
  const height = finitePositive(coverHeight);
  const variant = noCoverVariant(kindLabel);
  const kindText = noCoverResolvedKindLabel(kindLabel, variant);
  const displayTitle = noCoverDisplayTitle(title);
  const density = resolveDensity(width);
  const defaultRadius = width < 56 ? 5 : width < 72 ? 6 : 8;
  const safeRequested = Number.isFinite(requestedRadius) && requestedRadius >= 0 ? requestedRadius : 8;
  const cornerRadius = width > 0 && height > 0 ? Math.min(safeRequested, defaultRadius) : 0;

  if (width <= 0 || height <= 0) {
    const emptyNovel: NoCoverNovelLayout = {
      spineWidth: 0,
      spineLineX: 0,
      showFooter: false,
      showFooterRule: false,
      footerRule: ZERO_RECT,
      footerBox: ZERO_RECT,
      footerFontSizeVp: 7,
      footerLineHeightVp: 8.75,
      footerLetterSpacingVp: 0,
    };
    const emptyComic: NoCoverComicLayout = {
      bottomBand: ZERO_RECT,
      badgeBox: ZERO_RECT,
      badgeFontSizeVp: 7,
      badgeLineHeightVp: 8.4,
      showAccentMark: false,
      accentMark: ZERO_RECT,
    };
    const measure = estimateNoCoverTitleUnits(displayTitle);
    return {
      width: 0,
      height: 0,
      cornerRadius: 0,
      variant,
      density,
      kindText,
      title: solveTitleLayout(ZERO_RECT, displayTitle, measure, variant, density, 0),
      novel: emptyNovel,
      comic: emptyComic,
    };
  }

  const u = Math.min(width / 90, height / 124);
  const novelBuilt = buildNovelLayout(width, height, u, density, kindText);
  const comicBuilt = buildComicLayout(width, height, u, density);
  const titleBox = variant === 'comic' ? comicBuilt.titleBox : novelBuilt.titleBox;
  const measure = estimateNoCoverTitleUnits(displayTitle);

  return {
    width,
    height,
    cornerRadius,
    variant,
    density,
    kindText,
    title: solveTitleLayout(titleBox, displayTitle, measure, variant, density, u),
    novel: novelBuilt.layout,
    comic: comicBuilt.layout,
  };
}
