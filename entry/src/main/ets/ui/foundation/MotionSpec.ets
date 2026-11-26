import curves from '@ohos.curves';
import { READER_CONTROL_OPEN_MS, READER_CONTROL_EXPAND_MS, READER_CONTROL_COLLAPSE_MS,
  READER_CONTROL_DISMISS_MS, READER_CONTROL_MODULE_SWITCH_MS, READER_CONTROL_LAYER_SWITCH_MS,
  READER_REDUCED_FADE_MS, READER_NAVIGATION_PUSH_MS, READER_NAVIGATION_POP_MS, READER_NAVIGATION_TAB_MS,
  READER_NAVIGATION_PILL_MS, READER_SHELF_REFLOW_MS, READER_SHELF_STAGGER_MS, READER_SHELF_STAGGER_CAP_MS,
  READER_SHELF_FILTER_OPEN_MS, READER_SHELF_FILTER_CLOSE_MS,
  READER_SEARCH_OPEN_MS, READER_SEARCH_SUBMIT_MS, READER_SEARCH_BACK_MS, READER_SHEET_OPEN_MS,
  READER_SHEET_CLOSE_MS, READER_SHEET_SCRIM_MS, READER_BOOKMARK_RIBBON_RETURN_MS } from './ProductMotionTiming';
import { DIRECTORY_CHROME_VISUAL as MANGA_DIRECTORY_VISUAL } from './ReaderDirectoryChromeVisual';
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

const STANDARD_CURVE: curves.ICurve = curves.cubicBezierCurve(0.2, 0, 0, 1);
export function readerMotionStandardCurve(): curves.ICurve { return STANDARD_CURVE; }

/** Bookshelf reflow uses the current product clock across both projections. */
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
  coverStaggerCapMs: number;
  contentCurve: curves.ICurve;
  coverMoveCurve: curves.ICurve;
  coverScaleCurve: curves.ICurve;
  coverFadeCurve: curves.ICurve;
}

const BOOKSHELF_VIEW_MOTION: BookshelfViewMotionContract = {
  totalMs: READER_SHELF_REFLOW_MS,
  layoutCommitMs: 0,
  outgoingDurationMs: 120,
  headerIncomingStartMs: 0,
  headerIncomingDurationMs: 120,
  contentIncomingStartMs: 0,
  contentIncomingDurationMs: 120,
  morphCoverIncomingStartMs: READER_SHELF_REFLOW_MS - 60,
  morphCoverIncomingDurationMs: 60,
  movingCoverFadeStartMs: READER_SHELF_REFLOW_MS - 60,
  movingCoverFadeDurationMs: 60,
  coverMoveDurationMs: READER_SHELF_REFLOW_MS - READER_SHELF_STAGGER_CAP_MS,
  coverScaleDurationMs: READER_SHELF_REFLOW_MS - READER_SHELF_STAGGER_CAP_MS,
  coverStaggerMs: READER_SHELF_STAGGER_MS,
  coverStaggerCapMs: READER_SHELF_STAGGER_CAP_MS,
  contentCurve: STANDARD_CURVE,
  coverMoveCurve: STANDARD_CURVE,
  coverScaleCurve: STANDARD_CURVE,
  coverFadeCurve: STANDARD_CURVE,
};

const ENTRIES: MotionSpecEntry[] = [
  { id: 'app.control.press', durationMs: 140, curve: STANDARD_CURVE },
  { id: 'app.motion.reduced.fade', durationMs: READER_REDUCED_FADE_MS, curve: Curve.EaseOut },
  { id: 'app.navigation.push', durationMs: READER_NAVIGATION_PUSH_MS, curve: STANDARD_CURVE },
  { id: 'app.navigation.pop', durationMs: READER_NAVIGATION_POP_MS, curve: STANDARD_CURVE },
  { id: 'app.navigation.tab', durationMs: READER_NAVIGATION_TAB_MS, curve: STANDARD_CURVE },
  { id: 'app.navigation.pill', durationMs: READER_NAVIGATION_PILL_MS, curve: curves.cubicBezierCurve(0.22, 1.05, 0.36, 1) },
  { id: 'app.sheet.open', durationMs: READER_SHEET_OPEN_MS, curve: STANDARD_CURVE },
  { id: 'app.sheet.close', durationMs: READER_SHEET_CLOSE_MS, curve: STANDARD_CURVE },
  { id: 'app.sheet.scrim', durationMs: READER_SHEET_SCRIM_MS, curve: STANDARD_CURVE },
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
  { id: 'reader.module.switch', durationMs: READER_CONTROL_MODULE_SWITCH_MS, curve: STANDARD_CURVE },
  { id: 'reader.module.layer', durationMs: READER_CONTROL_LAYER_SWITCH_MS, curve: STANDARD_CURVE },
  { id: 'reader.autoPage.pulse.half', durationMs: 650, curve: Curve.EaseInOut },
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
  // The independent capsule exit uses this clock. The physical launch
  // sequence is authored by ReaderSessionLaunchTimeline.
  { id: 'reader.session.capsule.exit', durationMs: 200, curve: Curve.EaseOut },
  // Page turns use ReaderPageSettlementTimeline / Native motion directly.
  // Their distance/velocity clock must not acquire an implicit second animation.
  // The paper, ribbon and hint return in the same transaction.
  { id: 'reader.bookmark.rollback', durationMs: READER_BOOKMARK_RIBBON_RETURN_MS, curve: STANDARD_CURVE },
  { id: 'reader.bookmark.pill.add', durationMs: 240, curve: STANDARD_CURVE },
  { id: 'reader.bookmark.pill.remove', durationMs: 160, curve: STANDARD_CURVE },
  // Figma: Review · J1 `1506:8807`, production dropdown expansion.
  // Same panel grows 36→full height with a fixed top anchor; no fade/translate.
  { id: 'dropdown.menu.expand', durationMs: 160, curve: curves.cubicBezierCurve(0.16, 1, 0.3, 1) },
  // Figma: Review · J2 `1506:9291`, production dropdown collapse.
  // The same fixed-top panel contracts back to its 36vp selected row.
  { id: 'dropdown.menu.collapse', durationMs: 120, curve: curves.cubicBezierCurve(0.5, 0, 1, 1) },
  { id: 'bookshelf.view.switch', durationMs: READER_SHELF_REFLOW_MS, curve: STANDARD_CURVE },
  // Reviewed bookshelf demo: the filter keeps its mounted host through both
  // directions, while navigation covers are visual actors over the live route.
  { id: 'bookshelf.filter.expand', durationMs: READER_SHELF_FILTER_OPEN_MS, curve: STANDARD_CURVE },
  { id: 'bookshelf.filter.collapse', durationMs: READER_SHELF_FILTER_CLOSE_MS, curve: STANDARD_CURVE },
  { id: 'bookshelf.filter.content.in', durationMs: 160, curve: curves.cubicBezierCurve(0.2, 0, 0, 1) },
  { id: 'bookshelf.filter.content.out', durationMs: 100, curve: curves.cubicBezierCurve(0.4, 0, 0.2, 1) },
  { id: 'search.surface.open', durationMs: READER_SEARCH_OPEN_MS, curve: STANDARD_CURVE },
  { id: 'search.surface.submit', durationMs: READER_SEARCH_SUBMIT_MS, curve: STANDARD_CURVE },
  { id: 'search.surface.back', durationMs: READER_SEARCH_BACK_MS, curve: STANDARD_CURVE },
  // Search filter disclosure: the header panel and its result clearance change
  // in one native layout pass, so both directions share this timing.
  { id: 'search.filters.toggle', durationMs: 180, curve: STANDARD_CURVE },
  // Keyboard/window insets change the measured history viewport. The panel
  // follows the new limit instead of collapsing and re-measuring from zero.
  { id: 'search.history.resize', durationMs: 180, curve: STANDARD_CURVE },
  // Candidate list publish when no scroll anchor survived the update.
  { id: 'source.switch.list.update', durationMs: 220, curve: Curve.EaseInOut },
  // Generated MangaDirectoryVisual fold cadence (chevron + nested rows).
  { id: 'manga.directory.fold', durationMs: MANGA_DIRECTORY_VISUAL.foldDuration, curve: Curve.Ease },
  // Vendor pull-to-refresh reset settle.
  { id: 'manga.pullRefresh.reset', durationMs: 180, curve: Curve.EaseOut },
  { id: 'manga.boundary.arrow', durationMs: 160, curve: STANDARD_CURVE },
  // Local import sheet handoff: spinner fade, shell resize, result reveal.
  { id: 'bookshelf.import.handoff.fade', durationMs: 120, curve: curves.cubicBezierCurve(0.2, 0, 0, 1) },
  { id: 'bookshelf.import.handoff.resize', durationMs: 220, curve: curves.cubicBezierCurve(0.2, 0, 0, 1) },
  { id: 'bookshelf.import.handoff.reveal', durationMs: 140, curve: curves.cubicBezierCurve(0.2, 0, 0, 1) },
  // Transient feedback enter/exit pair.
  { id: 'message.feedback.enter', durationMs: 220, curve: Curve.EaseOut },
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

/** The index is a rank within the admitted visible covers. */
export function bookshelfViewCoverDelayMs(index: number): number {
  const safeIndex = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0;
  return Math.min(safeIndex * BOOKSHELF_VIEW_MOTION.coverStaggerMs, BOOKSHELF_VIEW_MOTION.coverStaggerCapMs);
}
