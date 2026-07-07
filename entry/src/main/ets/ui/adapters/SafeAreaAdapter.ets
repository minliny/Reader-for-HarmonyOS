// SafeAreaAdapter — runtime safe-area bridge (mirrors TokenAdapter's role, but
// for system-supplied insets rather than design tokens). EntryAbility writes
// real device insets (vp) into AppStorage after measuring the window avoid area.
// The top/bottom values are effective app safe areas: real system inset when it
// exists, otherwise the demo fallback band/gap so the first frame and status-bar
// background stay stable before the real window insets arrive.
//
// Why a separate adapter and not TokenAdapter: safe-area insets are runtime /
// per-device / orientation-dependent values, not design tokens. TokenAdapter stays
// the outlet for contract-derived static values; this adapter owns the dynamic
// system insets and the window-layer system-bar color constant (kept out of the
// generated/ token zone and out of inline '#hex' usage per CLAUDE.md rule 5).
import { SpacingTokens } from '../../contract/generated/DimensionTokens';

export class SafeAreaAdapter {
  // AppStorage keys — values are numbers in vp.
  static readonly K_TOP: string = 'reader.safeAreaTop';
  static readonly K_BOTTOM: string = 'reader.safeAreaBottom';
  static readonly K_START: string = 'reader.safeAreaStart';
  static readonly K_END: string = 'reader.safeAreaEnd';

  // Demo fallbacks (vp) — used before onWindowStageCreate reports real insets,
  // so the first frame still avoids the status / nav bar approximately.
  static readonly DEFAULT_TOP: number = SpacingTokens.safeAreaTop;
  static readonly DEFAULT_BOTTOM: number = SpacingTokens.safeAreaBottom;
  static readonly DEFAULT_START: number = SpacingTokens.safeAreaHorizontal;
  static readonly DEFAULT_END: number = SpacingTokens.safeAreaHorizontal;

  // Fully transparent system-bar background — a window-layer color, not a design
  // token. Centralized here so EntryAbility never carries a bare '#hex' literal.
  static readonly SYSTEM_BAR_TRANSPARENT: string = '#00000000'; // lint:allow — window-layer transparent system color, not a contract design token
}
