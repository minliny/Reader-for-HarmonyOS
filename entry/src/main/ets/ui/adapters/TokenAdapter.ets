// TokenAdapter — the unified outlet for token-derived ArkUI values.
// Components should prefer:
//   - $r('app.color.reader_ds_color_*')  for colors (auto light/dark)
//   - generated classes (ColorTokens, SpacingTokens, …) for typed static access
// TokenAdapter is used for dynamic lookups, derived typography roles, and shadow parsing.
import { TokenRegistry, TokenEntry } from '../../contract/generated/TokenRegistry';
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { ReaderTypography, Typography } from '../tokens/ReaderTypography';

export class TokenAdapter {
  // ── Color (dynamic; static use $r('app.color.reader_ds_color_<name>')) ──
  static color(shortName: string): string {
    const e = TokenRegistry.byName(`--reader-ds-color-${shortName}`);
    return e ? TokenAdapter.parseArgb(e.value) : '';
  }

  // ── Numeric tokens (spacing / size / radius / elevation / z-index) ──
  static spacing(shortName: string): number {
    return TokenAdapter.numberToken('space', shortName);
  }
  static size(shortName: string): number {
    return TokenAdapter.numberToken('size', shortName);
  }
  static radius(shortName: string): number {
    return TokenAdapter.numberToken('radius', shortName);
  }
  static elevation(shortName: string): number {
    return TokenAdapter.numberToken('elevation', shortName);
  }
  static zIndex(shortName: string): number {
    return TokenAdapter.numberToken('z', shortName);
  }

  private static numberToken(prefix: string, shortName: string): number {
    const e = TokenRegistry.byName(`--reader-ds-${prefix}-${shortName}`);
    if (!e) return 0;
    return TokenAdapter.parseNumber(e.value);
  }

  // ── Typography role (delegates to ReaderTypography) ──
  static typography(role: string): Typography {
    switch (role) {
      case 'app-title': return ReaderTypography.appTitle();
      case 'page-title': return ReaderTypography.pageTitle();
      case 'section-title': return ReaderTypography.sectionTitle();
      case 'book-title': return ReaderTypography.bookTitle();
      case 'book-meta': return ReaderTypography.bookMeta();
      case 'reader-body': return ReaderTypography.readerBody();
      case 'reader-control-label': return ReaderTypography.readerControlLabel();
      case 'top-bar-title': return ReaderTypography.topBarTitle();
      case 'top-bar-subtitle': return ReaderTypography.topBarSubtitle();
      case 'action-label': return ReaderTypography.actionLabel();
      case 'chapter-title': return ReaderTypography.chapterTitle();
      case 'immersive-info': return ReaderTypography.immersiveInfo();
      default: return ReaderTypography.bookMeta();
    }
  }

  // ── Shadow (CSS box-shadow token → ArkUI ShadowOptions) ──
  static shadow(name: string): ShadowOptions {
    const e = TokenRegistry.byName(`--reader-ds-shadow-${name}`);
    if (!e) return { radius: 0, color: ColorTokens.ink };
    return TokenAdapter.parseBoxShadow(e.value);
  }

  // ── Registry (for tests / coverage) ──
  static coverageCount(): number {
    return TokenRegistry.ALL.length;
  }
  static allTokenNames(): string[] {
    return TokenRegistry.ALL.map((t: TokenEntry) => t.name);
  }

  // ── Value parsers (mirrors scripts/gen_contracts.mjs resolution) ──
  static parseArgb(value: string): string {
    const v = value.trim();
    const hex6 = v.match(/^#([0-9a-fA-F]{6})$/);
    if (hex6) return '#FF' + hex6[1].toUpperCase();
    const hex8 = v.match(/^#([0-9a-fA-F]{8})$/);
    if (hex8) return '#' + hex8[1].toUpperCase();
    const rgba = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([0-9.]+)\s*)?\)$/);
    if (rgba) {
      const r = parseInt(rgba[1], 10);
      const g = parseInt(rgba[2], 10);
      const b = parseInt(rgba[3], 10);
      const a = rgba[4] !== undefined ? parseFloat(rgba[4]) : 1;
      const h = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
      return '#' + h(Math.round(a * 255)) + h(r) + h(g) + h(b);
    }
    return ColorTokens.ink;
  }

  static parseNumber(value: string): number {
    const m = value.match(/^(-?[0-9.]+)\s*(?:px|ms)?$/);
    if (m) return Number(m[1]);
    const n = Number(value);
    return Number.isNaN(n) ? 0 : n;
  }

  // box-shadow "offsetX offsetY blur color" → ShadowOptions
  private static parseBoxShadow(value: string): ShadowOptions {
    const m = value.match(/^(-?\d+)(?:px)?\s+(-?\d+)px\s+(\d+)px\s+(.+)$/);
    if (!m) return { radius: 0, color: ColorTokens.ink };
    const offsetX = parseInt(m[1], 10);
    const offsetY = parseInt(m[2], 10);
    const blur = parseInt(m[3], 10);
    const color = TokenAdapter.parseArgb(m[4].trim());
    return { radius: blur, color: color, offsetX: offsetX, offsetY: offsetY };
  }
}
