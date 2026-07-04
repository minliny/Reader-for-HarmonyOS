// Reader for HarmonyOS - L1 Token 层 - ReaderSpacing
// 间距 token,对应 demo 的 --reader-ds-space-* 变量

export class ReaderSpacing {
  // ===== 基础间距 =====
  static readonly none: number = 0;
  static readonly xxs: number = 2;
  static readonly xs: number = 4;
  static readonly sm: number = 8;
  static readonly md: number = 12;
  static readonly lg: number = 16;
  static readonly xl: number = 24;
  static readonly xxl: number = 32;
  static readonly xxxl: number = 48;

  // ===== Reader 屏幕级间距 =====
  // demo --reader-ds-space-screen-padding: 16px
  static readonly screenPadding: number = 16;
  // demo --reader-ds-space-screen-padding-lg: 24px (expanded/tablet)
  static readonly screenPaddingLg: number = 24;

  // ===== Reader 控制层间距 =====
  // demo --reader-ds-space-control-layer-padding: 19px (旧值,已废弃,改用 16px)
  static readonly controlLayerPadding: number = 16;
  // demo --reader-ds-space-control-layer-gap: 10px
  static readonly controlLayerGap: number = 10;
  // demo --reader-ds-space-running: 10px (running space y 偏移)
  static readonly running: number = 10;

  // ===== 组件内间距 =====
  // Bookshelf list row gap: 10px
  static readonly bookshelfRowGap: number = 10;
  // Bookshelf card padding: 12px
  static readonly bookshelfCardPadding: number = 12;
  // Bookshelf section gap: 16px
  static readonly bookshelfSectionGap: number = 16;

  // Tab bar padding: 8px vertical, 12px horizontal
  static readonly tabBarVertical: number = 8;
  static readonly tabBarHorizontal: number = 12;

  // Nav rail item padding: 12px vertical, 8px horizontal
  static readonly navRailItemVertical: number = 12;
  static readonly navRailItemHorizontal: number = 8;

  // Reader body paragraph gap: 16px (line-height ratio 1.96 × font-size + paragraph gap)
  static readonly readerParagraphGap: number = 16;
  // Reader body chapter gap: 32px
  static readonly readerChapterGap: number = 32;

  // Control capsule padding: 12px horizontal, 8px vertical
  static readonly capsuleHorizontal: number = 12;
  static readonly capsuleVertical: number = 8;

  // Dropdown menu padding: 8px
  static readonly dropdownPadding: number = 8;
  // Dropdown option padding: 12px vertical, 16px horizontal
  static readonly dropdownOptionVertical: number = 12;
  static readonly dropdownOptionHorizontal: number = 16;
}
