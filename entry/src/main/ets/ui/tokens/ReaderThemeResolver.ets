// ReaderThemeResolver — 运行时主题解析器，等价于 demo 的 readerThemeStyle()。
//
// demo 的主题模型：8 主题 = 4 颜色变体(paper/warm/green/blue) × 2 明暗(day/night)。
// HarmonyOS 拆成两个独立 state：readerTheme(4 值颜色变体) + appThemeMode(system/light/dark 明暗)。
// 本 resolver 把二者合并解析成一组 ArkUI 颜色，供 ReaderBase 各层消费。
//
// 颜色值对齐 frontend-demo-optimized/render-runtime.js readerThemeStyle() 的 day/night 分支。
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { ReaderThemeState } from './ReaderThemeState';

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
  static readonly ALL_OPTIONS: ReaderThemeOption[] = [
    { value: 'paper', label: '纸纹', scheme: 'day', pair: 'paper', texture: 'paper',
      swatch: '#F5EAD8', ink: '#2B241D', paperStart: '#FFFFF8F1', paperEnd: '#FFFFF8F4' },
    { value: 'warm', label: '暖白', scheme: 'day', pair: 'warm', texture: 'plain',
      swatch: '#FBF0DF', ink: '#2C241D', paperStart: '#FFFFF8F1', paperEnd: '#FFFFF8F4' },
    { value: 'green', label: '青绿', scheme: 'day', pair: 'green', texture: 'plain',
      swatch: '#E7F0E2', ink: '#263423', paperStart: '#FFFFF8F1', paperEnd: '#FFFFF8F4' },
    { value: 'blue', label: '雾蓝', scheme: 'day', pair: 'blue', texture: 'plain',
      swatch: '#E9F1F4', ink: '#22313A', paperStart: '#FFFFF8F1', paperEnd: '#FFFFF8F4' },
    { value: 'paper', label: '夜纹', scheme: 'night', pair: 'paper', texture: 'paper',
      swatch: '#2D2924', ink: '#E9DECE', paperStart: '#FF1F1C19', paperEnd: '#FF181F22' },
    { value: 'warm', label: '暖夜', scheme: 'night', pair: 'warm', texture: 'plain',
      swatch: '#27231F', ink: '#E7D8C8', paperStart: '#FF1F1C19', paperEnd: '#FF181F22' },
    { value: 'green', label: '墨绿', scheme: 'night', pair: 'green', texture: 'plain',
      swatch: '#202B26', ink: '#D8E2D2', paperStart: '#FF1F1C19', paperEnd: '#FF181F22' },
    { value: 'blue', label: '蓝夜', scheme: 'night', pair: 'blue', texture: 'plain',
      swatch: '#232934', ink: '#DBE2EA', paperStart: '#FF1F1C19', paperEnd: '#FF181F22' },
  ];

  // 4 块 quick swatches（快速外观面板用，4 个 day 颜色变体）。
  static readonly QUICK_OPTIONS: ReaderThemeOption[] = [
    ReaderThemeResolver.ALL_OPTIONS[0], // 纸纹 day
    ReaderThemeResolver.ALL_OPTIONS[1], // 暖白 day
    ReaderThemeResolver.ALL_OPTIONS[2], // 青绿 day
    ReaderThemeResolver.ALL_OPTIONS[3], // 雾蓝 day
  ];

  // appThemeMode → 是否夜间。system 跟随 EntryAbility 同步的系统色彩模式。
  static isNight(appThemeMode: string): boolean {
    return appThemeMode === 'dark' || (appThemeMode === 'system' && ReaderThemeState.colorMode() === 'dark');
  }

  // 根据 readerTheme(4值) + appThemeMode 解析 effective scheme。
  static scheme(readerTheme: string, appThemeMode: string): 'day' | 'night' {
    return ReaderThemeResolver.isNight(appThemeMode) ? 'night' : 'day';
  }

  // 查找 option（按 value + scheme）。
  static optionFor(value: string, scheme: 'day' | 'night'): ReaderThemeOption {
    for (const opt of ReaderThemeResolver.ALL_OPTIONS) {
      if (opt.value === value && opt.scheme === scheme) {
        return opt;
      }
    }
    return ReaderThemeResolver.ALL_OPTIONS[0]; // fallback 纸纹 day
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
      paper: ColorTokens.paper,
      paperBright: ColorTokens.paperBright,
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
  private static nightPalette(opt: ReaderThemeOption): ReaderThemePalette {
    return {
      scheme: 'night',
      paper: opt.paperEnd,            // #181F22 基底
      paperBright: opt.paperStart,    // #1F1C19 顶部
      ink: opt.ink,                   // 按 variant: e9dece/e7d8c8/d8e2d2/dbe2ea
      controlInk: ColorTokens.controlInkNight,  // #D7E1E5
      muted: '#FF8A8378',             // demo night muted
      surface: '#F226231F',           // rgba(38,35,31,0.96)
      surfaceSoft: '#B81C1916',       // rgba(28,25,22,0.72)
      floatingControlBg: '#F226231F', // rgba(38,35,31,0.96)
      floatingControlBgAlt: ColorTokens.floatingControlBgAltNight, // #2B3B43
      border: '#14FFFFFF',            // rgba(255,255,255,0.08)
      primary: '#FFD2BD96',           // demo night 暖金
      primaryDark: '#FFB8A072',
      accent: '#FFD2BD96',
      metaBg: '#991C1916',            // rgba(28,25,22,0.6)
      bottomBarBg: '#F226231F',
      textureOpacity: opt.texture === 'paper' ? 0.026 : 0,
      textureColor: ColorTokens.controlInkNight,
      auroraOpacity: 0.18,
      vignetteOpacity: 0.45,
    };
  }
}
