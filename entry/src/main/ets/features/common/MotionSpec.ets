import curves from '@ohos.curves';

// ----------------------------------------------------------------------------
// MotionSpec — 动效注册表
// 唯一权威源 = Figma "25 · Motion Reference" 画布 (1246:26829) 的 MR1 Production
// Motion Contract。全仓动效代码禁止写死 duration/easing, 一律经本注册表取值。
// 同步链: Figma 画布 -> MOTION_SPEC.md (Reader-Core-Native/docs) -> 本文件镜像。
// ----------------------------------------------------------------------------
// 注意: reader.control.show 一个 contract id 对应两个位移 target (TopBar y-8,
// ControlDock y+18), 故注册表条目只存 duration/curve 权威参数, fromY 由
// fadeSlideTransition/panelActorTransition 的调用方按元素传入 (值同样来自 Figma MR1)。

export interface MotionSpecEntry {
  id: string;
  durationMs: number;
  curve: Curve | curves.ICurve;
}

/**
 * Figma Review G/H (`1497:2` / `1497:811`) bookshelf projection switch.
 *
 * The live Figma motion context exposes one 1000ms loop for each direction.
 * Keep every percentage-derived boundary here so the page cannot silently
 * compress the authored timeline or drift back to one generic animation.
 */
export interface BookshelfViewMotionContract {
  totalMs: number;
  layoutCommitMs: number;
  outgoingDurationMs: number;
  headerIncomingStartMs: number;
  headerIncomingDurationMs: number;
  contentIncomingStartMs: number;
  contentIncomingDurationMs: number;
  morphCoverIncomingStartMs: number;
  morphCoverIncomingDurationMs: number;
  movingCoverFadeStartMs: number;
  movingCoverFadeDurationMs: number;
  coverMoveDurationMs: number;
  coverScaleDurationMs: number;
  coverStaggerMs: number;
  holdCurve: Curve | curves.ICurve;
  contentCurve: Curve | curves.ICurve;
  coverMoveCurve: Curve | curves.ICurve;
  coverScaleCurve: Curve | curves.ICurve;
  coverFadeCurve: Curve | curves.ICurve;
}

const BOOKSHELF_VIEW_MOTION: BookshelfViewMotionContract = {
  totalMs: 1000,
  layoutCommitMs: 150, // 15%
  outgoingDurationMs: 120, // 15% -> 27%
  headerIncomingStartMs: 500, // 50%
  headerIncomingDurationMs: 200, // 50% -> 70%
  contentIncomingStartMs: 600, // 60%
  contentIncomingDurationMs: 220, // 60% -> 82%
  morphCoverIncomingStartMs: 150, // 15%
  morphCoverIncomingDurationMs: 30, // 15% -> 18%
  movingCoverFadeStartMs: 690, // 69%
  movingCoverFadeDurationMs: 30, // 69% -> 72%
  coverMoveDurationMs: 420, // 42%
  coverScaleDurationMs: 250, // 25%
  coverStaggerMs: 30, // 3%
  holdCurve: Curve.Linear,
  contentCurve: curves.cubicBezierCurve(0.4, 0, 0.2, 1),
  coverMoveCurve: curves.cubicBezierCurve(0.2, 0, 0, 1),
  coverScaleCurve: curves.cubicBezierCurve(0.25, 0.1, 0, 1),
  coverFadeCurve: Curve.EaseOut,
};

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
  // Figma Review J~Q (1505:16662..18899) quick<->full shell morph, measured
  // from the live frames (expand loop J/L 0.7s, collapse loop K/M/O/Q 4s).
  // Three actors on one timeline, percentages rescaled to product ms:
  //   expand 420: shell scaleY .448->1 cubic(0.2,0,0,1) 0->420;
  //               quick dock out (y+18 fade) ease-in 0->~230;
  //               full panel in (y-18 fade) ease-out ~140->~470 (delay 140).
  //   collapse 360: shell scaleY 1->.448 ease-in-out 0->360;
  //               full panel out (y+18 fade) ease-in-out ~10->~160 (delay 10);
  //               quick dock in (y-18 fade) ease-out ~150->~300 (delay 150).
  { id: 'reader.panel.shell.expand', durationMs: 420, curve: curves.cubicBezierCurve(0.2, 0, 0, 1) },
  { id: 'reader.panel.shell.collapse', durationMs: 360, curve: curves.cubicBezierCurve(0.45, 0, 0.55, 1) },
  { id: 'reader.panel.dock.outgoing', durationMs: 230, curve: Curve.EaseIn },
  { id: 'reader.panel.dock.incoming', durationMs: 150, curve: Curve.EaseOut },
  { id: 'reader.panel.full.incoming', durationMs: 330, curve: Curve.EaseOut },
  { id: 'reader.panel.full.outgoing', durationMs: 150, curve: curves.cubicBezierCurve(0.45, 0, 0.55, 1) },
  // N 帧 (1505:18040) 外观面板 element-level：有效段 11.111%->75% 归一到产品
  // 420ms 后的逐元素入场（delay 由调用点经 panelActorTransition 传入）。
  { id: 'reader.panel.appearance.surface.in', durationMs: 128, curve: Curve.EaseOut },
  { id: 'reader.panel.appearance.content.in', durationMs: 110, curve: Curve.EaseOut },
  { id: 'reader.panel.appearance.header.in', durationMs: 164, curve: Curve.EaseOut },
  { id: 'reader.panel.appearance.theme.in', durationMs: 128, curve: Curve.EaseOut },
  { id: 'reader.panel.appearance.font.in', durationMs: 135, curve: Curve.EaseOut },
  { id: 'reader.panel.appearance.typography.in', durationMs: 164, curve: Curve.EaseOut },
  // N 帧 QuickMorph/Rail/Nav/Header-blur 的有效段同为 11.111%->75%，归一方式
  // 与上面入场 stagger 一致（t_product = (t% - 11.111%) / 63.889% * 420ms）。
  //   morph.reflow:     0 -> 183ms ease-out（QuickMorph 容器+19 子元素几何）
  //   morph.dissolve: delay 146 + 183ms ease-out（QuickMorph 整层 opacity 1->0）
  //   chrome.dissolve: delay 183 + 237ms ease-out（Rail y+15 / Nav y+20 +
  //                     opacity 1->0 + blur 0->12，TransitionEffect 无 blur 分量，
  //                     走属性动画 ghost 层）
  //   header.deblur:  delay 146 + 164ms ease-out（Header blur 8->0，与既有
  //                     header.in 转场的 y-12 落下并行）
  { id: 'reader.panel.appearance.morph.reflow', durationMs: 183, curve: Curve.EaseOut },
  { id: 'reader.panel.appearance.morph.dissolve', durationMs: 183, curve: Curve.EaseOut },
  { id: 'reader.panel.appearance.chrome.dissolve', durationMs: 237, curve: Curve.EaseOut },
  { id: 'reader.panel.appearance.header.deblur', durationMs: 164, curve: Curve.EaseOut },
  // Reader-UI tokens (MOTION_SPEC.md §2.5): Figma Review C/D/E/F are
  // review-only with no authored product timing, so this pair carries the
  // token source, not the canvas. Fade only — no invented translation.
  { id: 'reader.session.capsule.enter', durationMs: 160, curve: Curve.EaseOut },
  { id: 'reader.session.capsule.exit', durationMs: 200, curve: Curve.EaseOut },
  // Figma Review C/D/E/F capsule morph: the authored loop is review-only
  // (3.5s, no product timing), so these three values are the 2026-09-02
  // product supplement. Flight shrinks the captured source actor toward the
  // bottom-right capsule anchor with the Figma flight bezier; expand reopens
  // the shell width 24 -> capsule width right-edge anchored; reveal slides
  // the content out of the dot. Source fade, blur ghost, canonical-shell
  // handoff and dot hold reproduce the authored intermediate beats; the exit
  // keeps the existing 200ms fade because the loop authors no reverse frames.
  { id: 'reader.session.capsule.morph.flight',
    durationMs: 480, curve: curves.cubicBezierCurve(0.4, 0, 0.2, 1) },
  { id: 'reader.session.capsule.morph.ghost.in', durationMs: 120, curve: Curve.EaseOut },
  { id: 'reader.session.capsule.morph.source.fade', durationMs: 120, curve: Curve.EaseOut },
  { id: 'reader.session.capsule.morph.shell.handoff', durationMs: 120, curve: Curve.EaseOut },
  { id: 'reader.session.capsule.morph.dot.hold', durationMs: 120, curve: Curve.Linear },
  { id: 'reader.session.capsule.morph.expand',
    durationMs: 240, curve: curves.cubicBezierCurve(0.2, 0, 0, 1) },
  { id: 'reader.session.capsule.morph.reveal', durationMs: 160, curve: Curve.EaseOut },
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
  // Live Figma motion context for Review G/H `1497:2`/`1497:811`: one 1000ms
  // coordinated timeline. Shared-element reflow keeps covers as entities and
  // fades only the authored local layers, never the whole page.
  { id: 'bookshelf.view.switch', durationMs: 1000, curve: Curve.EaseOut },
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

/**
 * Figma MR1 authors the control show/hide actors as opacity + translate dual
 * components (TopBar/Dock fade while sliding). .animation() on the combined
 * effect drives both components with the registered duration/curve.
 * MR1/C (1247:627) confirms quick.promote is the same dual-component pair:
 * SearchQuick incoming = opacity 0->1 + y 12->0.
 */
export function fadeSlideTransition(id: string, fromY: number): TransitionEffect {
  const entry = requireEntry(id);
  return TransitionEffect.OPACITY
    .combine(TransitionEffect.translate({ y: fromY }))
    .animation({ duration: entry.durationMs, curve: entry.curve });
}

/** 非对称 show/hide 过渡: 进入用 show 项, 退出用 hide 项, 同一位移偏移。 */
export function showHideTransition(showId: string, hideId: string, fromY: number): TransitionEffect {
  return TransitionEffect.asymmetric(
    fadeSlideTransition(showId, fromY),
    fadeSlideTransition(hideId, fromY),
  );
}

/**
 * One J~Q shell-morph actor: 18px slide plus a 0->1/1->0 fade, with the
 * optional authored entry delay (full.incoming 140ms / full.outgoing 10ms /
 * dock.incoming 150ms). fromY is the entering offset; the exit plays it
 * reversed (0 -> +fromY), matching the Figma outgoing 0px->18px keyframes.
 */
export function panelActorTransition(id: string, fromY: number, delayMs: number = 0): TransitionEffect {
  const entry = requireEntry(id);
  const anim: AnimateParam = delayMs > 0 ?
    { duration: entry.durationMs, curve: entry.curve, delay: delayMs } :
    { duration: entry.durationMs, curve: entry.curve };
  return TransitionEffect.OPACITY
    .combine(TransitionEffect.translate({ y: fromY }))
    .animation(anim);
}

/** animateTo/AnimateParam 参数, 供属性动画 (如 module.switch 交叉淡化) 复用注册表值。 */
export function motionAnimateParam(id: string, onFinish?: () => void): AnimateParam {
  const entry = requireEntry(id);
  if (onFinish === undefined) {
    return { duration: entry.durationMs, curve: entry.curve };
  }
  return { duration: entry.durationMs, curve: entry.curve, onFinish };
}

export function bookshelfViewMotionContract(): BookshelfViewMotionContract {
  return BOOKSHELF_VIEW_MOTION;
}

/**
 * G/H staggers columns by 3% and adds one 9% row offset. The third review row
 * deliberately reuses the second-row cadence, so later rows stay capped too.
 */
export function bookshelfViewCoverDelayMs(index: number): number {
  const safeIndex = Math.max(0, Math.floor(index));
  const column = safeIndex % 3;
  const rowBand = Math.min(1, Math.floor(safeIndex / 3));
  return ((rowBand * 3) + column) * BOOKSHELF_VIEW_MOTION.coverStaggerMs;
}

export function bookshelfViewCoverMoveAnimation(index: number): AnimateParam {
  return {
    duration: BOOKSHELF_VIEW_MOTION.coverMoveDurationMs,
    delay: bookshelfViewCoverDelayMs(index),
    curve: BOOKSHELF_VIEW_MOTION.coverMoveCurve,
  };
}

export function bookshelfViewCoverScaleAnimation(index: number): AnimateParam {
  return {
    duration: BOOKSHELF_VIEW_MOTION.coverScaleDurationMs,
    delay: bookshelfViewCoverDelayMs(index),
    curve: BOOKSHELF_VIEW_MOTION.coverScaleCurve,
  };
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
