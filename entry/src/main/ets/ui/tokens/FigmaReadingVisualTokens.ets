// FigmaReadingVisualTokens — the narrowly scoped, revision-null Figma source
// boundary for current reading-chain masters.
//
// This is the ONE hand-authored token file allowed to contain literal Figma
// values (per scripts/lint_tokens.mjs EXCLUDE_FILES). Every other .ets file
// under entry/src/main/ets/ must consume token names — raw #hex literals are
// forbidden outside contract/generated/ and contract/reader_ui/.
//
// Component code imports the names below; it never reads Figma nodes directly
// (see Reader-UI/docs/design/FIGMA_FIRST_READING_CHAIN_LOCK.md).
//
// Values are aligned to frontend-demo-optimized/render-runtime.js
// readerThemeStyle() night branch and to the warm-paper capability-closure
// surfaces used by ViewStateRenderer. They are revision-null: when a current
// Figma revision is delivered, replace these literals through the registry,
// not by editing component code.

export class FigmaNightPaletteTokens {
  // night 调色板（对齐 demo readerThemeStyle night 分支）。
  // night 控件面统一暗色，纸张色按 variant 略不同。
  static readonly muted: string = '#FF8A8378';             // demo night muted
  static readonly surface: string = '#F226231F';           // rgba(38,35,31,0.96)
  static readonly surfaceSoft: string = '#B81C1916';       // rgba(28,25,22,0.72)
  static readonly floatingControlBg: string = '#F226231F'; // rgba(38,35,31,0.96)
  static readonly border: string = '#14FFFFFF';            // rgba(255,255,255,0.08)
  static readonly primary: string = '#FFD2BD96';           // demo night 暖金
  static readonly primaryDark: string = '#FFB8A072';
  static readonly accent: string = '#FFD2BD96';
  static readonly metaBg: string = '#991C1916';            // rgba(28,25,22,0.6)
  static readonly bottomBarBg: string = '#F226231F';
}

export class FigmaWarmSurfaceTokens {
  // 暖纸主题的能力闭合面（warm paper capability-closure surfaces）。
  // 对齐 ViewStateRenderer 中渲染 read-only canonical state / capability
  // closure 节点所使用的统一暖色面。
  static readonly secondaryText: string = '#725F50';       // 次要正文/标题
  static readonly strongText: string = '#2E2924';          // 强标题
  static readonly disabledText: string = '#8A7768';        // 只读/禁用文字
  static readonly surface: string = '#FFFDF8';             // 主卡片面
  static readonly surfaceAlt: string = '#FFF9EE';          // 次卡片面
  static readonly disabledSurface: string = '#EFE8DE';     // 只读/禁用面
  static readonly border: string = '#E7DED2';              // 暖分割线
  static readonly onAccentText: string = '#FFFDF8';        // accent 上的文字
  static readonly accent: string = '#725F50';              // 暖 accent（pill 底色）
}

export class FigmaErrorStateTokens {
  // 契约漂移 / fail-closed 错误态专用色。
  static readonly errorText: string = '#A03A32';
  static readonly errorTextStrong: string = '#9E3B32';
  static readonly errorSurface: string = '#FFF2F0';
  static readonly errorBorder: string = '#D98C83';
  static readonly errorContainer: string = '#FFF8F5';
}

export class FigmaOverlayTokens {
  // 专用叠加层底色（带 alpha），如 Contract25 路由页背景遮罩。
  static readonly flowOverlayGreen: string = '#24594632';  // rgba(36,89,70,0.20)
}

export class FigmaReadingVisualTokens {
  // 书架封面阴影（对齐 Figma Library/BookCard 493:196 / 493:192）。
  static readonly shelfCoverShadow: string = '#1A594632';      // rgba(89,70,50,0.10)
  static readonly shelfListCoverShadow: string = '#1F34261A';  // rgba(52,38,26,0.12)
}

export class FigmaLibraryVisualTokens {
  // Library/LocalImportDialog 阴影（对齐 Figma 2657:917）。
  static readonly dialogShadow: string = '#40000000';  // rgba(0,0,0,0.25)
}

export class FigmaSyncBackupVisualTokens {
  // Restore Backup Confirm 阴影（对齐 Figma 2834:32130）。
  static readonly confirmShadow: string = '#29594632';          // rgba(89,70,50,0.16)
  static readonly confirmShadowRadius: number = 46;
  static readonly confirmShadowOffsetY: number = 18;
}
