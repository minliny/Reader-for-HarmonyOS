// Reader for HarmonyOS - L1 Token 层 - ReaderShadow
// 阴影 token,对应 demo 的 --reader-shadow-* / --fd-soft-shadow 变量
// 注意:ArkUI 用 ShadowStyle 枚举或 ShadowOptions 自定义

export class ReaderShadow {
  // ===== 基础阴影(使用 ArkUI ShadowStyle 枚举)=====
  // demo 使用 rgba(89,70,50,0.10) ~ rgba(89,70,50,0.22) 的暖棕阴影
  // 但项目记忆规定:Control layer shadow must use primary blue halo (rgba(54,97,121,0.22))

  // Control layer 主阴影(蓝色 halo)
  // demo --reader-control-shadow: 0 18px 46px rgba(89,70,50,0.16)
  // 项目修正:改为 rgba(54,97,121,0.22) 蓝色 halo
  static controlHaloColor(): string {
    return '#38366179';  // ARGB: A=0x38(0.22), R=36, G=61, B=79
  }
  static controlHaloRadius(): number { return 46; }
  static controlHaloOffsetY(): number { return 18; }

  // Soft shadow(列表/卡片)
  // demo --fd-soft-shadow: 0 8px 26px rgba(89,70,50,0.10)
  static softShadowColor(): string {
    return '#1A594632';  // ARGB: A=0x1A(0.10), R=89, G=70, B=50
  }
  static softShadowRadius(): number { return 26; }
  static softShadowOffsetY(): number { return 8; }

  // Nav rail / bottom nav surface shadow
  static navSurfaceColor(): string {
    return '#14594632';  // ARGB: A=0x14(0.08)
  }
  static navSurfaceRadius(): number { return 18; }
  static navSurfaceOffsetY(): number { return 4; }

  // Dropdown shadow
  static dropdownColor(): string {
    return '#22594632';  // ARGB: A=0x22(0.13)
  }
  static dropdownRadius(): number { return 32; }
  static dropdownOffsetY(): number { return 12; }

  // Overlay shadow(sheet / dialog)
  static overlayColor(): string {
    return '#38594632';  // ARGB: A=0x38(0.22)
  }
  static overlayRadius(): number { return 56; }
  static overlayOffsetY(): number { return 24; }

  // Capsule soft shadow
  static capsuleColor(): string {
    return '#14594632';
  }
  static capsuleRadius(): number { return 12; }
  static capsuleOffsetY(): number { return 4; }

  // ===== ArkUI ShadowOptions 工厂方法 =====
  // 用法:.shadow(ReaderShadow.controlHalo())
  static controlHalo(): ShadowOptions {
    return {
      radius: ReaderShadow.controlHaloRadius(),
      color: ReaderShadow.controlHaloColor(),
      offsetX: 0,
      offsetY: ReaderShadow.controlHaloOffsetY()
    };
  }

  static softShadow(): ShadowOptions {
    return {
      radius: ReaderShadow.softShadowRadius(),
      color: ReaderShadow.softShadowColor(),
      offsetX: 0,
      offsetY: ReaderShadow.softShadowOffsetY()
    };
  }

  static navSurface(): ShadowOptions {
    return {
      radius: ReaderShadow.navSurfaceRadius(),
      color: ReaderShadow.navSurfaceColor(),
      offsetX: 0,
      offsetY: ReaderShadow.navSurfaceOffsetY()
    };
  }

  static dropdown(): ShadowOptions {
    return {
      radius: ReaderShadow.dropdownRadius(),
      color: ReaderShadow.dropdownColor(),
      offsetX: 0,
      offsetY: ReaderShadow.dropdownOffsetY()
    };
  }

  static overlay(): ShadowOptions {
    return {
      radius: ReaderShadow.overlayRadius(),
      color: ReaderShadow.overlayColor(),
      offsetX: 0,
      offsetY: ReaderShadow.overlayOffsetY()
    };
  }

  static capsule(): ShadowOptions {
    return {
      radius: ReaderShadow.capsuleRadius(),
      color: ReaderShadow.capsuleColor(),
      offsetX: 0,
      offsetY: ReaderShadow.capsuleOffsetY()
    };
  }
}
