// TokenAdapter — the unified outlet for token-derived ArkUI values.
// Components should prefer:
//   - $r('app.color.fd_ds_color_*')  for colors (auto light/dark)
//   - generated classes (ColorTokens, SpacingTokens, …) for typed static access
// TokenAdapter is used for dynamic lookups, derived typography roles, and shadow parsing.
import { TokenRegistry, TokenEntry } from '../../contract/generated/TokenRegistry';
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { ReaderTypography, Typography } from '../tokens/ReaderTypography';

export class TokenAdapter {
  // ── Color (dynamic; static use $r('app.color.fd_ds_color_<name>')) ──
  static color(shortName: string): string {
    const e = TokenRegistry.byName(`--fd-ds-color-${shortName}`);
    return e ? TokenAdapter.parseArgb(e.value) : '';
  }

  // 从 hex 颜色和透明度构造 ARGB hex 字符串（用于 linearGradient 等需要 alpha 通道的场景）。
  // 接受 #RRGGBB 或 #AARRGGBB；输出 #AARRGGBB。
  static colorWithAlpha(hex: string, alpha: number): string {
    const v = hex.trim();
    let rgb: string;
    if (v.startsWith('#')) {
      if (v.length === 9) {
        rgb = v.substring(3);
      } else if (v.length === 7) {
        rgb = v.substring(1);
      } else {
        return ColorTokens.ink;
      }
    } else {
      return ColorTokens.ink;
    }
    const a = Math.round(alpha * 255).toString(16).padStart(2, '0').toUpperCase();
    return '#' + a + rgb.toUpperCase();
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
    const e = TokenRegistry.byName(`--fd-ds-${prefix}-${shortName}`);
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
    const e = TokenRegistry.byName(`--fd-ds-shadow-${name}`);
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

  // ── Font (font token family stack; prefers platforms.arkts) ──
  static font(shortName: string): string {
    const e = TokenRegistry.byName(`--fd-ds-font-${shortName}`);
    if (!e) return '';
    return e.arkts ? e.arkts : e.value;
  }

  // ── Text constraint (line counts / measure strings) ──
  static textConstraint(shortName: string): string {
    const e = TokenRegistry.byName(`--fd-ds-text-${shortName}`);
    return e ? e.value : '';
  }

  // ── Icon ($r() must be a compile-time macro; explicit switch-case mapping) ──
  // shortName is the contract icon value (e.g. 'add', 'eyeOff', 'auto-page').
  // Returns the matching $r('app.media.reader_icon_<name>') Resource.
  static icon(shortName: string): Resource {
    switch (shortName) {
      case 'add': return $r('app.media.reader_icon_add');
      case 'activity': return $r('app.media.reader_icon_activity');
      case 'appearance': return $r('app.media.reader_icon_appearance');
      case 'assist': return $r('app.media.reader_icon_assist');
      case 'auto-page': return $r('app.media.reader_icon_auto_page');
      case 'back': return $r('app.media.reader_icon_back');
      case 'badge': return $r('app.media.reader_icon_badge');
      case 'battery': return $r('app.media.reader_icon_battery');
      case 'bell': return $r('app.media.reader_icon_bell');
      case 'book': return $r('app.media.reader_icon_book');
      case 'book-open': return $r('app.media.reader_icon_book_open');
      case 'bookmark': return $r('app.media.reader_icon_bookmark');
      case 'bookshelf': return $r('app.media.reader_icon_bookshelf');
      case 'bug': return $r('app.media.reader_icon_bug');
      case 'check': return $r('app.media.reader_icon_check');
      case 'checkmark': return $r('app.media.reader_icon_checkmark');
      case 'chevron': return $r('app.media.reader_icon_chevron');
      case 'chevron-left': return $r('app.media.reader_icon_chevron_left');
      case 'clear': return $r('app.media.reader_icon_clear');
      case 'clock': return $r('app.media.reader_icon_clock');
      case 'close': return $r('app.media.reader_icon_close');
      case 'cloud': return $r('app.media.reader_icon_cloud');
      case 'code': return $r('app.media.reader_icon_code');
      case 'columns': return $r('app.media.reader_icon_columns');
      case 'copy': return $r('app.media.reader_icon_copy');
      case 'current-location': return $r('app.media.reader_icon_current_location');
      case 'database': return $r('app.media.reader_icon_database');
      case 'directory': return $r('app.media.reader_icon_directory');
      case 'discover': return $r('app.media.reader_icon_discover');
      case 'download': return $r('app.media.reader_icon_download');
      case 'edit': return $r('app.media.reader_icon_edit');
      case 'eyeOff': return $r('app.media.reader_icon_eye_off');
      case 'file': return $r('app.media.reader_icon_file');
      case 'filter': return $r('app.media.reader_icon_filter');
      case 'folder': return $r('app.media.reader_icon_folder');
      case 'folder-off': return $r('app.media.reader_icon_folder_off');
      case 'gear': return $r('app.media.reader_icon_gear');
      case 'gesture': return $r('app.media.reader_icon_gesture');
      case 'globe': return $r('app.media.reader_icon_globe');
      case 'grid': return $r('app.media.reader_icon_grid');
      case 'help': return $r('app.media.reader_icon_help');
      case 'home': return $r('app.media.reader_icon_home');
      case 'image': return $r('app.media.reader_icon_image');
      case 'info': return $r('app.media.reader_icon_info');
      case 'link': return $r('app.media.reader_icon_link');
      case 'list': return $r('app.media.reader_icon_list');
      case 'log': return $r('app.media.reader_icon_log');
      case 'mail': return $r('app.media.reader_icon_mail');
      case 'message': return $r('app.media.reader_icon_message');
      case 'monitor': return $r('app.media.reader_icon_monitor');
      case 'more': return $r('app.media.reader_icon_more');
      case 'motion': return $r('app.media.reader_icon_motion');
      case 'nav-list': return $r('app.media.reader_icon_nav_list');
      case 'night-mode': return $r('app.media.reader_icon_night_mode');
      case 'offline': return $r('app.media.reader_icon_offline');
      case 'palette': return $r('app.media.reader_icon_palette');
      case 'pause': return $r('app.media.reader_icon_pause');
      case 'people': return $r('app.media.reader_icon_people');
      case 'permission': return $r('app.media.reader_icon_permission');
      case 'phone': return $r('app.media.reader_icon_phone');
      case 'play': return $r('app.media.reader_icon_play');
      case 'progress': return $r('app.media.reader_icon_progress');
      case 'reader-auto-page': return $r('app.media.reader_icon_reader_auto_page');
      case 'reader-content-replace': return $r('app.media.reader_icon_reader_content_replace');
      case 'reader-content-search': return $r('app.media.reader_icon_reader_content_search');
      case 'reader-module-directory': return $r('app.media.reader_icon_reader_module_directory');
      case 'reader-module-tts': return $r('app.media.reader_icon_reader_module_tts');
      case 'reader-module-appearance': return $r('app.media.reader_icon_reader_module_appearance');
      case 'reader-module-settings': return $r('app.media.reader_icon_reader_module_settings');
      case 'refresh': return $r('app.media.reader_icon_refresh');
      case 'replace': return $r('app.media.reader_icon_replace');
      case 'rss': return $r('app.media.reader_icon_rss');
      case 'search': return $r('app.media.reader_icon_search');
      case 'settings': return $r('app.media.reader_icon_settings');
      case 'shield': return $r('app.media.reader_icon_shield');
      case 'signal': return $r('app.media.reader_icon_signal');
      case 'sort': return $r('app.media.reader_icon_sort');
      case 'source': return $r('app.media.reader_icon_source');
      case 'source-stack': return $r('app.media.reader_icon_source_stack');
      case 'source-switch': return $r('app.media.reader_icon_source_switch');
      case 'sparkle': return $r('app.media.reader_icon_sparkle');
      case 'stop': return $r('app.media.reader_icon_stop');
      case 'storage': return $r('app.media.reader_icon_storage');
      case 'sun': return $r('app.media.reader_icon_sun');
      case 'sync': return $r('app.media.reader_icon_sync');
      case 'text': return $r('app.media.reader_icon_text');
      case 'top': return $r('app.media.reader_icon_top');
      case 'trash': return $r('app.media.reader_icon_trash');
      case 'tts': return $r('app.media.reader_icon_tts');
      case 'typo': return $r('app.media.reader_icon_typo');
      case 'upload': return $r('app.media.reader_icon_upload');
      case 'volume': return $r('app.media.reader_icon_volume');
      case 'warning': return $r('app.media.reader_icon_warning');
      case 'wifi': return $r('app.media.reader_icon_wifi');
      default: return $r('app.media.reader_icon_add');
    }
  }
}
