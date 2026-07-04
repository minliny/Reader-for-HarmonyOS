// Reader for HarmonyOS - L1 Token 层 - ReaderRadius
// 圆角 token,对应 demo 的 --reader-ds-radius-* 变量

export class ReaderRadius {
  // ===== 基础圆角 =====
  static readonly none: number = 0;
  static readonly xs: number = 2;
  static readonly sm: number = 4;
  static readonly md: number = 8;
  static readonly lg: number = 12;
  static readonly xl: number = 16;
  static readonly xxl: number = 20;
  static readonly xxxl: number = 24;
  // 完全圆角(胶囊形)
  static readonly full: number = 999;

  // ===== 组件级圆角 =====
  // Card radius: 12px
  static readonly card: number = 12;
  // Book cover radius: 4px
  static readonly bookCover: number = 4;
  // ContinueReadingCard radius: 12px
  static readonly continueCard: number = 12;
  // Bookshelf list row radius: 12px
  static readonly bookshelfRow: number = 12;

  // Capsule radius: 999 (full pill)
  static readonly capsule: number = 999;
  // Button radius (default): 999 (pill button)
  static readonly button: number = 999;
  // Button radius (square variant): 8
  static readonly buttonSquare: number = 8;

  // Dropdown menu radius: 12
  static readonly dropdown: number = 12;
  // Dropdown option radius: 8 (内部圆角)
  static readonly dropdownOption: number = 8;

  // Reader control layer radius: 16 (top corners only,实际由 borderTopLeftRadius/borderTopRightRadius 单独设置)
  static readonly controlLayerTop: number = 16;

  // Reader control space radius: 16
  static readonly controlSpace: number = 16;
  // Reader control dock radius: 999 (pill)
  static readonly controlDock: number = 999;

  // TopBar radius: 0 (无圆角,平贴顶部)
  static readonly topBar: number = 0;
  // Bottom nav radius: 0 (无圆角,平贴底部)
  static readonly bottomNav: number = 0;
  // Nav rail radius: 0 (无圆角)
  static readonly navRail: number = 0;

  // Overlay sheet radius: 16 (top corners only)
  static readonly overlaySheet: number = 16;
  // Overlay dialog radius: 16
  static readonly overlayDialog: number = 16;
}
