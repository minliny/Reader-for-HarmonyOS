// ReaderThemeResolver — 运行时主题解析器，等价于 demo 的 readerThemeStyle()。
//
// demo 的主题模型：8 主题 = 4 颜色变体(paper/warm/green/blue) × 2 明暗(day/night)。
// HarmonyOS 拆成两个独立 state：readerTheme(4 值颜色变体) + appThemeMode(system/light/dark 明暗)。
// 本 resolver 把二者合并解析成一组 ArkUI 颜色，供 ReaderBase 各层消费。
//
// 颜色值对齐 frontend-demo-optimized/render-runtime.js readerThemeStyle() 的 day/night 分支。
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { ReaderAppearanceSpecRegistry, ReaderAppearanceTheme } from '../../contract/reader_ui/Appearance';
import { ReaderThemeState } from './ReaderThemeState';
import { FigmaNightPaletteTokens } from './FigmaReadingVisualTokens';

// 8 主题 fixture（对齐 demo fixture.js L211-229）。
export interface ReaderThemeOption {
  value: string;        // 'paper' | 'warm' | 'green' | 'blue'（颜色变体，day/night 共用）
  label: string;        // 显示名
  scheme: 'day' | 'night';
  pair: string;         // 对应的明暗伙伴 value
  texture: 'plain' | 'paper';
  swatch: string;       // 色块色（day: 纸张色, night: 暗色块）
  ink: string;          // 文字色
  paperStart: string;   // 纸张渐变起点
  paperEnd: string;     // 纸张渐变终点
}

// 解析后的调色板（ReaderBase 各层消费）。
export interface ReaderThemePalette {
  scheme: 'day' | 'night';
  paper: string;            // 纸张主色
  paperBright: string;      // 纸张亮色（顶部高光）
  ink: string;              // 正文文字色
  controlInk: string;       // 控件文字色
  muted: string;            // 次要文字色
  surface: string;          // 卡片面
  surfaceSoft: string;      // 柔和面
  floatingControlBg: string;// 浮动控件背景
  floatingControlBgAlt: string;
  border: string;           // 分割线
  primary: string;          // 主色
  primaryDark: string;
  accent: string;           // 强调色
  metaBg: string;
  bottomBarBg: string;
  textureOpacity: number;   // 纸纹透明度
  textureColor: string;     // 纸纹色
  auroraOpacity: number;    // 夜间极光透明度（day=0）
  vignetteOpacity: number;  // 暗角透明度
}

export class ReaderThemeResolver {
  // 8 主题全量（full appearance page 用）。
  static readonly ALL_OPTIONS: ReaderThemeOption[] = ReaderAppearanceSpecRegistry.themes
    .map((theme: ReaderAppearanceTheme): ReaderThemeOption => {
      const option: ReaderThemeOption = {
        value: theme.id,
        label: theme.label,
        scheme: theme.scheme === 'night' ? 'night' : 'day',
        pair: theme.pairId,
        texture: theme.texture === 'paper' ? 'paper' : 'plain',
        swatch: theme.swatchHex,
        ink: theme.inkHex,
        paperStart: theme.backgroundHex,
        paperEnd: theme.backgroundHex,
      };
      return option;
    });

  // 4 块 quick swatches（快速外观面板用，4 个 day 颜色变体）。
  static readonly QUICK_OPTIONS: ReaderThemeOption[] = [
    ReaderAppearanceSpecRegistry.defaults.dayThemeId,
    'warm',
    'green',
    'blue',
  ].map((id: string): ReaderThemeOption => ReaderThemeResolver.optionById(id));

  private static optionById(id: string): ReaderThemeOption {
    const option: ReaderThemeOption | undefined = ReaderThemeResolver.ALL_OPTIONS
      .find((item: ReaderThemeOption): boolean => item.value === id);
    if (option === undefined) {
      throw new Error(`Missing Reader Appearance theme: ${id}`);
    }
    return option;
  }

  // appThemeMode → 是否夜间。system 跟随 EntryAbility 同步的系统色彩模式。
  static isNight(appThemeMode: string): boolean {
    return appThemeMode === 'dark' || (appThemeMode === 'system' && ReaderThemeState.colorMode() === 'dark');
  }

  // 根据 readerTheme + appThemeMode 解析 effective scheme。
  // readerTheme 值本身编码了 scheme 信息（带 `-night` 后缀即为夜间），
  // 它优先于 appThemeMode：用户显式选择了夜间变体时就按夜间渲染。
  static scheme(readerTheme: string, appThemeMode: string): 'day' | 'night' {
    return readerTheme.endsWith('-night') ? 'night' : 'day';
  }

  // 查找 option（按 value；value 本身已编码 scheme）。
  static optionFor(value: string, scheme: 'day' | 'night'): ReaderThemeOption {
    for (const opt of ReaderThemeResolver.ALL_OPTIONS) {
      if (opt.value === value) {
        return opt;
      }
    }
    return ReaderThemeResolver.optionById(ReaderAppearanceSpecRegistry.defaults.dayThemeId);
  }

  // 解析调色板（ReaderBase 各层调用）。
  static palette(readerTheme: string, appThemeMode: string): ReaderThemePalette {
    const scheme = ReaderThemeResolver.scheme(readerTheme, appThemeMode);
    const opt = ReaderThemeResolver.optionFor(readerTheme, scheme);
    if (scheme === 'night') {
      return ReaderThemeResolver.nightPalette(opt);
    }
    return ReaderThemeResolver.dayPalette(opt);
  }

  // swatch 色（给色块组件用）。
  static swatchFor(value: string, scheme: 'day' | 'night'): string {
    return ReaderThemeResolver.optionFor(value, scheme).swatch;
  }

  // day 调色板（对齐 demo readerThemeStyle day 分支）。
  private static dayPalette(opt: ReaderThemeOption): ReaderThemePalette {
    return {
      scheme: 'day',
      paper: opt.swatch,
      paperBright: opt.paperStart,
      ink: ColorTokens.ink,
      controlInk: ColorTokens.controlInk,
      muted: ColorTokens.muted,
      surface: ColorTokens.surface,
      surfaceSoft: ColorTokens.surfaceSoft,
      floatingControlBg: ColorTokens.floatingControlBg,
      floatingControlBgAlt: ColorTokens.floatingControlBgAlt,
      border: ColorTokens.border,
      primary: ColorTokens.primary,
      primaryDark: ColorTokens.primaryDark,
      accent: ColorTokens.accent,
      metaBg: ColorTokens.metaBg,
      bottomBarBg: ColorTokens.bottomBarBg,
      textureOpacity: opt.texture === 'paper' ? 0.034 : 0,
      textureColor: ColorTokens.muted,
      auroraOpacity: 0,
      vignetteOpacity: 0.14,
    };
  }

  // night 调色板（对齐 demo readerThemeStyle night 分支）。
  // night 控件面统一暗色，纸张色按 variant 略不同。
  // 字面量集中在 FigmaNightPaletteTokens（Figma 字面量边界文件）。
  private static nightPalette(opt: ReaderThemeOption): ReaderThemePalette {
    return {
      scheme: 'night',
      paper: opt.swatch,
      paperBright: opt.paperStart,    // 顶部高光
      ink: opt.ink,                   // 按 variant: e9dece/e7d8c8/d8e2d2/dbe2ea
      controlInk: ColorTokens.controlInkNight,
      muted: FigmaNightPaletteTokens.muted,
      surface: FigmaNightPaletteTokens.surface,
      surfaceSoft: FigmaNightPaletteTokens.surfaceSoft,
      floatingControlBg: FigmaNightPaletteTokens.floatingControlBg,
      floatingControlBgAlt: ColorTokens.floatingControlBgAltNight,
      border: FigmaNightPaletteTokens.border,
      primary: FigmaNightPaletteTokens.primary,
      primaryDark: FigmaNightPaletteTokens.primaryDark,
      accent: FigmaNightPaletteTokens.accent,
      metaBg: FigmaNightPaletteTokens.metaBg,
      bottomBarBg: FigmaNightPaletteTokens.bottomBarBg,
      textureOpacity: opt.texture === 'paper' ? 0.026 : 0,
      textureColor: ColorTokens.controlInkNight,
      auroraOpacity: 0.18,
      vignetteOpacity: 0.45,
    };
  }
}
