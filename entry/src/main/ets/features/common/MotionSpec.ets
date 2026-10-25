import curves from '@ohos.curves';
import { READER_CONTROL_OPEN_MS, READER_CONTROL_EXPAND_MS, READER_CONTROL_COLLAPSE_MS,
  READER_CONTROL_DISMISS_MS } from './ProductMotionTiming';
import { SOURCE_SWITCH_VISUAL } from '../source/SourceSwitchVisual';
import { MANGA_DIRECTORY_VISUAL } from '../manga/MangaDirectoryVisual';
import { readerPanelActorPose } from '../reading/ReaderPanelMotionContract';
// ----------------------------------------------------------------------------
// MotionSpec — 动效注册表
// 当前产品时序来自 ProductMotionTiming 与各动效族条目；空间轨迹仍由 Figma 派生几何负责。
// 旧 shell / appearance 分轨仅供历史验证，不是当前 ReaderControlPanel 的播放策略。
// 生产入口、历史注册项和旧组件测试必须区分，不以旧参数推断当前画面。
// ----------------------------------------------------------------------------
// 注意: reader.control.show 一个 contract id 对应两个位移 target (TopBar y-8,
// ControlDock y+18)。这两个端点由 ReaderControlMotionGeometry 的空间采样拥有，
// 不在注册表重复；注册表条目只保存时长/曲线，panel actor 的 fromY 与 delay 则
// 随条目登记，避免调用点再次抄写 Figma 数值。

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
  contentCurve: curves.ICurve;
  coverMoveCurve: curves.ICurve;
  coverScaleCurve: curves.ICurve;
  coverFadeCurve: curves.ICurve;
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
  contentCurve: curves.cubicBezierCurve(0.4, 0, 0.2, 1),
  coverMoveCurve: curves.cubicBezierCurve(0.2, 0, 0, 1),
  coverScaleCurve: curves.cubicBezierCurve(0.25, 0.1, 0, 1),
  coverFadeCurve: curves.cubicBezierCurve(0, 0, 0.58, 1),
};

const ENTRIES: MotionSpecEntry[] = [
  // Figma: 25 · Motion Reference MR1 · reader.control.show (TopBar y-8→0, Dock y+18→0)
  { id: 'reader.control.show', durationMs: READER_CONTROL_OPEN_MS, curve: curves.cubicBezierCurve(0.2, 0, 0, 1) },
  // Figma: 25 · Motion Reference MR1 · reader.control.hide (反向回到原位)
  { id: 'reader.control.hide', durationMs: READER_CONTROL_DISMISS_MS, curve: curves.cubicBezierCurve(0.2, 0, 0, 1) },
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
  { id: 'reader.panel.expand', durationMs: READER_CONTROL_EXPAND_MS, curve: curves.cubicBezierCurve(0.2, 0, 0, 1) },
  // Figma: 25 · Motion Reference · Full -> Quick, Phone production contract.
  { id: 'reader.panel.collapse', durationMs: READER_CONTROL_COLLAPSE_MS, curve: curves.cubicBezierCurve(0.2, 0, 0, 1) },
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
  // Existing non-launch entrance/exit tokens; launch uses the complete Figma
  // 3500ms C/D/E/F timeline in ReaderSessionLaunchPresentation.
  { id: 'reader.session.capsule.enter', durationMs: 160, curve: Curve.EaseOut },
  { id: 'reader.session.capsule.exit', durationMs: 200, curve: Curve.EaseOut },
  // Registry mirrors authored interval durations, not a sequential sum:
  // flight 200–1400, ghost-in 600–900, sharp-fade 700–1100, handoff
  // 1100–1400, hold 1400–1700, expand + reveal 1700–2300. Only the
  // single launch sampler owns start times and per-actor keyframe overlap.
  { id: 'reader.session.capsule.morph.flight',
    durationMs: 1200, curve: curves.cubicBezierCurve(0.4, 0, 0.2, 1) },
  { id: 'reader.session.capsule.morph.ghost.in', durationMs: 300, curve: Curve.EaseInOut },
  { id: 'reader.session.capsule.morph.source.fade', durationMs: 400, curve: Curve.EaseIn },
  { id: 'reader.session.capsule.morph.shell.handoff', durationMs: 300, curve: Curve.EaseOut },
  { id: 'reader.session.capsule.morph.dot.hold', durationMs: 300, curve: Curve.Linear },
  { id: 'reader.session.capsule.morph.expand',
    durationMs: 600, curve: curves.cubicBezierCurve(0.2, 0, 0, 1) },
  { id: 'reader.session.capsule.morph.reveal', durationMs: 600, curve: curves.cubicBezierCurve(0.2, 0, 0, 1) },
  // Page turns use ReaderPageSettlementTimeline / Native motion directly.
  // Their distance/velocity clock must not acquire an implicit second animation.
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
  // Reviewed bookshelf demo: the filter keeps its mounted host through both
  // directions, while navigation covers are visual actors over the live route.
  { id: 'bookshelf.filter.expand', durationMs: 240, curve: curves.cubicBezierCurve(0.2, 0, 0, 1) },
  { id: 'bookshelf.filter.collapse', durationMs: 180, curve: curves.cubicBezierCurve(0.4, 0, 0.2, 1) },
  { id: 'bookshelf.filter.content.in', durationMs: 160, curve: curves.cubicBezierCurve(0.2, 0, 0, 1) },
  { id: 'bookshelf.filter.content.out', durationMs: 100, curve: curves.cubicBezierCurve(0.4, 0, 0.2, 1) },
  { id: 'bookshelf.open.flight', durationMs: 360, curve: curves.cubicBezierCurve(0.2, 0, 0, 1) },
  { id: 'bookshelf.open.reveal', durationMs: 140, curve: curves.cubicBezierCurve(0.2, 0, 0, 1) },
  { id: 'bookshelf.close.flight', durationMs: 280, curve: curves.cubicBezierCurve(0.4, 0, 0.2, 1) },
  { id: 'bookshelf.close.reveal', durationMs: 60, curve: curves.cubicBezierCurve(0.2, 0, 0, 1) },
  // Search filter disclosure: the header panel and its result clearance change
  // in one native layout pass, so both directions share this timing.
  { id: 'search.filters.toggle', durationMs: 180, curve: Curve.EaseInOut },
  // Generated SourceSwitchVisual drawer: the scrim, drawer and row entrance
  // share one authored curve, so the registry is the only rebuild site.
  { id: 'source.switch.open', durationMs: SOURCE_SWITCH_VISUAL.openDurationMs,
    curve: curves.cubicBezierCurve(SOURCE_SWITCH_VISUAL.easingX1, SOURCE_SWITCH_VISUAL.easingY1,
      SOURCE_SWITCH_VISUAL.easingX2, SOURCE_SWITCH_VISUAL.easingY2) },
  { id: 'source.switch.close', durationMs: SOURCE_SWITCH_VISUAL.closeDurationMs,
    curve: curves.cubicBezierCurve(SOURCE_SWITCH_VISUAL.easingX1, SOURCE_SWITCH_VISUAL.easingY1,
      SOURCE_SWITCH_VISUAL.easingX2, SOURCE_SWITCH_VISUAL.easingY2) },
  { id: 'source.switch.row.enter', durationMs: SOURCE_SWITCH_VISUAL.rowEnterDurationMs,
    curve: curves.cubicBezierCurve(SOURCE_SWITCH_VISUAL.easingX1, SOURCE_SWITCH_VISUAL.easingY1,
      SOURCE_SWITCH_VISUAL.easingX2, SOURCE_SWITCH_VISUAL.easingY2) },
  // Candidate list publish when no scroll anchor survived the update.
  { id: 'source.switch.list.update', durationMs: 220, curve: Curve.EaseInOut },
  // Generated MangaDirectoryVisual fold cadence (chevron + nested rows).
  { id: 'manga.directory.fold', durationMs: MANGA_DIRECTORY_VISUAL.foldDuration, curve: Curve.Ease },
  // Manga sheet scrim is opacity-only; the sheet body keeps its spring clock.
  { id: 'manga.panel.scrim', durationMs: 160, curve: Curve.EaseInOut },
  // Vendor pull-to-refresh reset settle.
  { id: 'manga.pullRefresh.reset', durationMs: 180, curve: Curve.EaseOut },
  // Local import sheet handoff: spinner fade, shell resize, result reveal.
  { id: 'bookshelf.import.handoff.fade', durationMs: 120, curve: curves.cubicBezierCurve(0.2, 0, 0, 1) },
  { id: 'bookshelf.import.handoff.resize', durationMs: 220, curve: curves.cubicBezierCurve(0.2, 0, 0, 1) },
  { id: 'bookshelf.import.handoff.reveal', durationMs: 140, curve: curves.cubicBezierCurve(0.2, 0, 0, 1) },
  // Transient feedback enter/exit pair.
  { id: 'message.feedback.enter', durationMs: 220, curve: Curve.EaseOut },
];

/** Product layer beats, relative to the single capsule flight clock. */

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
 * One J~Q shell-morph actor: authored slide plus a 0->1/1->0 fade. The
 * endpoint and entry delay are part of the registry entry, so callers do not
 * re-state Figma geometry. The exit plays fromY reversed (0 -> +fromY),
 * matching the Figma outgoing keyframes.
 */
export function panelActorTransition(id: string): TransitionEffect {
  const entry = requireEntry(id);
  const pose = readerPanelActorPose(id);
  const delayMs = pose?.delayMs ?? 0;
  const anim: AnimateParam = delayMs > 0 ?
    { duration: entry.durationMs, curve: entry.curve, delay: delayMs } :
    { duration: entry.durationMs, curve: entry.curve };
  return TransitionEffect.OPACITY
    .combine(TransitionEffect.translate({ y: pose?.fromY ?? 0 }))
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

/** Sequenced feature motion: the caller owns the delay, the registry owns the
 * duration and curve. */
export function motionAnimateParamDelayed(id: string, delayMs: number,
  onFinish?: () => void): AnimateParam {
  const entry = requireEntry(id);
  const delay = Math.max(0, Number.isFinite(delayMs) ? delayMs : 0);
  if (onFinish === undefined) {
    return { duration: entry.durationMs, curve: entry.curve, delay };
  }
  return { duration: entry.durationMs, curve: entry.curve, delay, onFinish };
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
