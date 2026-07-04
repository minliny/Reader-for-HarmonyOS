// Reader for HarmonyOS - L1 Token 层 - ReaderSize
// 尺寸 token,对应 demo 的 --reader-ds-size-* 变量

export class ReaderSize {
  // ===== TopBar =====
  // demo --reader-ds-size-topbar-height: 56px
  static readonly topBarHeight: number = 56;
  // demo --reader-ds-size-topbar-icon: 24px
  static readonly topBarIcon: number = 24;
  // demo --reader-ds-size-topbar-title: 18px (font size)
  static readonly topBarTitle: number = 18;

  // ===== Bottom Nav =====
  // demo --reader-ds-size-bottomnav-height: 64px
  static readonly bottomNavHeight: number = 64;
  // demo --reader-ds-size-bottomnav-icon: 24px
  static readonly bottomNavIcon: number = 24;
  // demo --reader-ds-size-bottomnav-label: 11px
  static readonly bottomNavLabel: number = 11;

  // ===== Nav Rail =====
  // demo --reader-ds-size-navrail-width: 80px
  static readonly navRailWidth: number = 80;
  // demo --reader-ds-size-navrail-icon: 24px
  static readonly navRailIcon: number = 24;
  // demo --reader-ds-size-navrail-item-height: 56px
  static readonly navRailItemHeight: number = 56;

  // ===== Bookshelf =====
  // Bookshelf list row height: 66px (来自项目记忆)
  static readonly bookshelfRowHeight: number = 66;
  // Bookshelf cover width (cover view): 64px
  static readonly bookshelfCoverWidth: number = 64;
  // Bookshelf cover height (cover view): 88px
  static readonly bookshelfCoverHeight: number = 88;
  // Bookshelf cover width (list view): 48px
  static readonly bookshelfListCoverWidth: number = 48;
  // Bookshelf cover height (list view): 64px
  static readonly bookshelfListCoverHeight: number = 64;
  // Bookshelf grid gap: 16px
  static readonly bookshelfGridGap: number = 16;
  // Bookshelf grid columns (compact): 3
  static readonly bookshelfGridColumnsCompact: number = 3;
  // Bookshelf grid columns (expanded): 5
  static readonly bookshelfGridColumnsExpanded: number = 5;
  // Bookshelf grid columns (tablet): 7
  static readonly bookshelfGridColumnsTablet: number = 7;

  // ===== Reader Session Capsule =====
  // Capsule height: 36px
  static readonly capsuleHeight: number = 36;
  // Capsule icon: 16px
  static readonly capsuleIcon: number = 16;
  // Capsule label font: 13px
  static readonly capsuleLabel: number = 13;
  // Capsule status font: 11px
  static readonly capsuleStatus: number = 11;

  // ===== Reader Control Handle =====
  // Handle height: 4px (small bar)
  static readonly controlHandleHeight: number = 4;
  // Handle width: 36px
  static readonly controlHandleWidth: number = 36;

  // ===== Reader Control Dock =====
  // Dock height: 56px
  static readonly controlDockHeight: number = 56;
  // Dock icon: 22px
  static readonly controlDockIcon: number = 22;

  // ===== Dropdown =====
  // Dropdown menu width: 200px
  static readonly dropdownMenuWidth: number = 200;
  // Dropdown menu min-height: 80px
  static readonly dropdownMenuMinHeight: number = 80;
  // Dropdown option height: 44px
  static readonly dropdownOptionHeight: number = 44;

  // ===== ContinueReadingCard =====
  // Cover width: 56px
  static readonly continueCardCover: number = 56;
  // Card padding: 16px
  static readonly continueCardPadding: number = 16;

  // ===== Avatar / Icon =====
  static readonly avatarSm: number = 24;
  static readonly avatarMd: number = 32;
  static readonly avatarLg: number = 40;
  static readonly iconSm: number = 16;
  static readonly iconMd: number = 20;
  static readonly iconLg: number = 24;
  static readonly iconXl: number = 32;
}
