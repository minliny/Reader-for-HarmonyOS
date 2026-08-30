import curves from '@ohos.curves';

// ----------------------------------------------------------------------------
// MotionSpec — 动效注册表
// 唯一权威源 = Figma "25 · Motion Reference" 画布 (1246:26829) 的 MR1 Production
// Motion Contract。全仓动效代码禁止写死 duration/easing, 一律经本注册表取值。
// 同步链: Figma 画布 -> MOTION_SPEC.md (Reader-Core-Native/docs) -> 本文件镜像。
// ----------------------------------------------------------------------------
// 注意: reader.control.show 一个 contract id 对应两个位移 target (TopBar y-8,
// ControlDock y+18), 故注册表条目只存 duration/curve 权威参数, fromY 由
// translateYTransition(id, fromY) 的调用方按元素传入 (值同样来自 Figma MR1)。

export interface MotionSpecEntry {
  id: string;
  durationMs: number;
  curve: Curve | curves.ICurve;
}

const ENTRIES: MotionSpecEntry[] = [
  // Figma: 25 · Motion Reference MR1 · reader.control.show (TopBar y-8→0, Dock y+18→0)
  { id: 'reader.control.show', durationMs: 420, curve: Curve.EaseOut },
  // Figma: 25 · Motion Reference MR1 · reader.control.hide (反向回到原位)
  { id: 'reader.control.hide', durationMs: 360, curve: Curve.EaseIn },
  // Reader-UI handleSnap token: the grabber release settle is a snap, not a
  // panel collapse. Figma MR1 authors no curve for it; EaseOut keeps the
  // rollback/settle family consistent.
  { id: 'reader.control.handle.snap', durationMs: 120, curve: Curve.EaseOut },
  // Figma: 25 · Motion Reference MR1 · reader.quick.promote (y+12→0)
  { id: 'reader.quick.promote', durationMs: 320, curve: Curve.EaseOut },
  // Figma: 25 · Motion Reference MR1 · reader.module.switch (交叉淡化)
  { id: 'reader.module.switch', durationMs: 360, curve: curves.cubicBezierCurve(0.25, 0.1, 0.25, 1) },
  // Product interaction supplement: the Figma font library defines a static
  // reorderable grid but has no authored keyframes. Keep the finger direct;
  // only neighbouring slots and the final settle use implicit animation.
  { id: 'reader.font.reorder.shift', durationMs: 120, curve: Curve.EaseOut },
  { id: 'reader.font.reorder.settle', durationMs: 160, curve: Curve.EaseOut },
  // Figma: 25 · Motion Reference · Quick -> Full, Phone production contract.
  { id: 'reader.panel.expand', durationMs: 420, curve: Curve.EaseOut },
  // Figma: 25 · Motion Reference · Full -> Quick, Phone production contract.
  { id: 'reader.panel.collapse', durationMs: 360, curve: Curve.EaseIn },
  // Reader-UI tokens (MOTION_SPEC.md §2.5): Figma Review C/D/E/F are
  // review-only with no authored product timing, so this pair carries the
  // token source, not the canvas. Fade only — no invented translation.
  { id: 'reader.session.capsule.enter', durationMs: 160, curve: Curve.EaseOut },
  { id: 'reader.session.capsule.exit', durationMs: 200, curve: Curve.EaseOut },
  // Reader runtime page slide approved for the native Host implementation.
  // The owner scales this base duration by the remaining live-width distance.
  { id: 'reader.page.slide.commit', durationMs: 240, curve: Curve.EaseOut },
  { id: 'reader.page.slide.rollback', durationMs: 180, curve: Curve.EaseOut },
  // Frozen simulated-page contract: a released bookmark pull returns the
  // translated page to its origin in one 160 ms compositor animation.
  { id: 'reader.bookmark.rollback', durationMs: 160, curve: Curve.EaseOut },
  // Figma: Review · J1 `1506:8807`, production dropdown expansion.
  // Same panel grows 36→full height with a fixed top anchor; no fade/translate.
  { id: 'dropdown.menu.expand', durationMs: 160, curve: curves.cubicBezierCurve(0.16, 1, 0.3, 1) },
  // Figma: Review · J2 `1506:9291`, production dropdown collapse.
  // The same fixed-top panel contracts back to its 36vp selected row.
  { id: 'dropdown.menu.collapse', durationMs: 120, curve: curves.cubicBezierCurve(0.5, 0, 1, 1) },
  // Figma Review G/H `1497:2`/`1497:811`: product 320ms (the review plays it
  // at x5). MOTION_SPEC.md's older 160ms token is superseded by the canvas,
  // this registry's declared sole authority. Shared-element reflow must keep
  // covers as entities and must not fade the whole page.
  { id: 'bookshelf.view.switch', durationMs: 320, curve: Curve.EaseOut },
];

export function motionSpecGet(id: string): MotionSpecEntry | undefined {
  return ENTRIES.find((entry: MotionSpecEntry): boolean => entry.id === id);
}

function requireEntry(id: string): MotionSpecEntry {
  const entry = motionSpecGet(id);
  if (entry === undefined) {
    throw new Error(`MotionSpec: unknown motion id "${id}"`);
  }
  return entry;
}

/** 单方向 y 位移过渡 (fromY 为进入前偏移, 退出自动反向), 时长/曲线取自注册表。 */
export function translateYTransition(id: string, fromY: number): TransitionEffect {
  const entry = requireEntry(id);
  return TransitionEffect.translate({ y: fromY })
    .animation({ duration: entry.durationMs, curve: entry.curve });
}

/** 非对称 show/hide 过渡: 进入用 show 项, 退出用 hide 项, 同一位移偏移。 */
export function showHideTransition(showId: string, hideId: string, fromY: number): TransitionEffect {
  return TransitionEffect.asymmetric(
    translateYTransition(showId, fromY),
    translateYTransition(hideId, fromY),
  );
}

/** animateTo/AnimateParam 参数, 供属性动画 (如 module.switch 交叉淡化) 复用注册表值。 */
export function motionAnimateParam(id: string, onFinish?: () => void): AnimateParam {
  const entry = requireEntry(id);
  if (onFinish === undefined) {
    return { duration: entry.durationMs, curve: entry.curve };
  }
  return { duration: entry.durationMs, curve: entry.curve, onFinish };
}

/**
 * Page drags consume part of a motion before release. Scale the registered
 * full-width duration by only the distance still left to travel, while keeping
 * a one-third floor so a nearly complete gesture retains a visible settle.
 */
export function motionRemainingDistanceAnimateParam(
  id: string,
  remainingDistanceRatio: number,
  onFinish?: () => void,
): AnimateParam {
  const entry = requireEntry(id);
  const finiteRatio = Number.isFinite(remainingDistanceRatio) ? remainingDistanceRatio : 1;
  const durationScale = Math.max(1 / 3, Math.min(1, finiteRatio));
  const duration = Math.round(entry.durationMs * durationScale);
  if (onFinish === undefined) {
    return { duration, curve: entry.curve };
  }
  return { duration, curve: entry.curve, onFinish };
}
