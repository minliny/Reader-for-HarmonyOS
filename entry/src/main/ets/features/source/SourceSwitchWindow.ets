import { ColorMetrics, FrameCallback } from '@kit.ArkUI';
import curves from '@ohos.curves';
import { SOURCE_SWITCH_VISUAL } from './SourceSwitchVisual';
import { SourceSwitchSpinner } from './SourceSwitchSpinner';
import { readerAppColor } from '../common/ReaderThemeRegistry';
import { TYPE_SOURCE_SWITCH_NOVEL_NAME, TYPE_SOURCE_SWITCH_NOVEL_CHAPTER, TYPE_SOURCE_SWITCH_NOVEL_LATENCY,
  TYPE_SOURCE_SWITCH_NOVEL_HEADING, TYPE_SOURCE_SWITCH_NOVEL_BOOK_TITLE, TYPE_SOURCE_SWITCH_NOVEL_METADATA,
  TYPE_SOURCE_SWITCH_NOVEL_CAPTION, TYPE_SOURCE_SWITCH_NOVEL_ACTION, TYPE_SOURCE_SWITCH_NOVEL_COLUMN,
  TYPE_SOURCE_SWITCH_NOVEL_LATENCY_UNIT, TYPE_SOURCE_SWITCH_NOVEL_DISCOVERY_STATUS, TYPE_SOURCE_SWITCH_NOVEL_DISCOVERY_STATUS_NARROW,
  TYPE_SOURCE_SWITCH_NOVEL_CURRENT_SOURCE, TYPE_SOURCE_SWITCH_NOVEL_DISCOVERY_COUNT,
  TYPE_SOURCE_SWITCH_NOVEL_DISCOVERY_PHASE, TYPE_SOURCE_SWITCH_NOVEL_ACTION_COMPACT,
  TYPE_SOURCE_SWITCH_NOVEL_FOOTER, TYPE_SOURCE_SWITCH_NOVEL_EMPTY } from '../common/ReaderTypography';
import { registerReaderFonts, prepareSourceSwitchNovelFonts, sourceSwitchNovelFontsReady } from '../common/ReaderFonts';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import { readerInteractiveSafeBottom, readerInteractiveSafeLeft, readerInteractiveSafeRight,
  readerVisualSafeTop } from '../common/ReaderWindowMetrics';
import { NoCoverCover } from '../bookshelf/NoCoverCover';
import { sourceSwitchCandidateKey, sourceSwitchSourceCount } from './SourceSwitchGateway';
import type { SourceSwitchCandidate } from './SourceSwitchGateway';
import { SourceSwitchProgress } from './SourceSwitchProgress';
import { sourceSwitchNovelChapter, sourceSwitchNovelLatency, sourceSwitchNovelDrawerHeight,
  sourceSwitchNovelRowHeight, sourceSwitchNovelCompact, sourceSwitchNovelScale, sourceSwitchNovelBookHeight,
  sourceSwitchNovelHeadingHeight, sourceSwitchNovelDiscoveryHeight, sourceSwitchNovelDiscoveryToolbarHeight,
  sourceSwitchNovelDiscoveryCompact, sourceSwitchNovelDiscoveryPrefixVisible, sourceSwitchNovelDiscoveryActionWidth,
  sourceSwitchNovelDiscoveryActionVisibleHeight, sourceSwitchNovelDiscoveryActionHitHeight,
  sourceSwitchNovelColumnHeight, sourceSwitchNovelFooterHeight, sourceSwitchNovelTimingWidth } from './SourceSwitchNovelPresentation';
import {
  SourceSwitchPanelState,
  SourceSwitchDiscoveringState,
  SourceSwitchCandidatesState,
  SourceSwitchEmptyState,
  SourceSwitchDiscoveryErrorState,
  SourceSwitchSwitchingState,
  SourceSwitchSuccessState,
  SourceSwitchFailureState,
} from './SourceSwitchPresentationState';

export {
  SourceSwitchPanelState,
  SourceSwitchDiscoveringState,
  SourceSwitchCandidatesState,
  SourceSwitchEmptyState,
  SourceSwitchDiscoveryErrorState,
  SourceSwitchSwitchingState,
  SourceSwitchSuccessState,
  SourceSwitchFailureState,
};

class SourceSwitchLayoutFrame extends FrameCallback {
  private action: () => void;
  constructor(action: () => void) { super(); this.action = action; }
  onFrame(_time: number): void {}
  onIdle(_remaining: number): void { this.action(); }
}

/** A retained native row observes immutable gateway snapshots for its identity.
 * LazyForEach can reuse its child on CHANGE/reload without resetting @Prop. */
@Observed
class SourceSwitchCandidateRow {
  readonly key: string;
  candidate: SourceSwitchCandidate;

  constructor(candidate: SourceSwitchCandidate) {
    this.key = sourceSwitchCandidateKey(candidate.sourceId, candidate.bookUrl);
    this.candidate = candidate;
  }

  update(candidate: SourceSwitchCandidate): void {
    if (this.candidate !== candidate) this.candidate = candidate;
  }
}

/** V1-compatible native lazy admission. The owner supplies the full, already
 * ordered successful-result projection; ArkUI owns viewport virtualization. */
class SourceSwitchCandidateDataSource implements IDataSource {
  private rows: SourceSwitchCandidateRow[] = [];
  private keys: string[] = [];
  private listeners: DataChangeListener[] = [];
  private input: SourceSwitchCandidate[] | undefined = undefined;

  totalCount(): number { return this.rows.length; }
  getData(index: number): SourceSwitchCandidateRow { return this.rows[index]; }
  registerDataChangeListener(listener: DataChangeListener): void {
    if (this.listeners.indexOf(listener) < 0) this.listeners.push(listener);
  }
  unregisterDataChangeListener(listener: DataChangeListener): void {
    this.listeners = this.listeners.filter((value: DataChangeListener): boolean => value !== listener);
  }
  publish(rows: SourceSwitchCandidate[]): void {
    if (rows === this.input) return;
    const keys = rows.map((row: SourceSwitchCandidate): string => sourceSwitchCandidateKey(row.sourceId, row.bookUrl));
    const prefix = this.keys.length <= keys.length &&
      this.keys.every((key: string, index: number): boolean => key === keys[index]);
    const previous = this.rows;
    const retained = new Map<string, SourceSwitchCandidateRow>();
    for (const row of previous) retained.set(row.key, row);
    this.rows = rows.map((candidate: SourceSwitchCandidate, index: number): SourceSwitchCandidateRow => {
      const row = retained.get(keys[index]);
      if (row === undefined) return new SourceSwitchCandidateRow(candidate);
      row.update(candidate);
      return row;
    });
    this.keys = keys;
    this.input = rows;
    for (const listener of this.listeners) {
      if (!prefix) {
        listener.onDataReloaded();
      } else {
        // @ObjectLink delivers metadata to the mounted same-key child. Native
        // notifications only admit structural changes; CHANGE does not reset
        // the retained child's one-way @Prop initialization.
        // The empty prefix is admitted too: a picker can mount before its
        // first successful search arrives without retaining an empty range.
        for (let index = previous.length; index < rows.length; index += 1) listener.onDataAdd(index);
      }
    }
  }
}

/** Shared successful-result row using the selected drawer visual. */
@Component
struct SourceSwitchNovelRow {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @ObjectLink @Watch('rowChanged') row: SourceSwitchCandidateRow;
  @State private candidate: SourceSwitchCandidate = this.row.candidate;
  @Prop @Watch('pressAdmissionChanged') rowEnabled: boolean = true;
  @Prop selected: boolean = false;
  @State private pressed: boolean = false;
  @Prop rowHeight: number = SOURCE_SWITCH_VISUAL.rowHeight;
  @Prop timingColumnWidth: number = SOURCE_SWITCH_VISUAL.timingColumnWidth;
  @Prop reduceMotion: boolean = false;
  onSelect: () => void = (): void => {};
  onPress: () => void = (): void => {};

  // Keep the approved text carriers unchanged. Native ObjectLink delivers
  // every immutable gateway snapshot into this row's existing text actors.
  private rowChanged(): void { this.candidate = this.row.candidate; }
  private pressAdmissionChanged(): void { if (!this.rowEnabled) this.pressed = false; }
  private rowTouch(event: TouchEvent): void {
    this.pressed = this.rowEnabled && this.row.candidate.isCurrent !== true && event.type === TouchType.Down;
    if (this.pressed) this.onPress();
  }
  private dividerColor(): ResourceColor {
    const color = ColorMetrics.resourceColor(readerAppColor('TOK_ROW_DIVIDER', this.appThemeScheme));
    return ColorMetrics.rgba(color.red, color.green, color.blue, color.alpha / 255 * SOURCE_SWITCH_VISUAL.rowDividerOpacity).color;
  }

  build() {
    Row({ space: SOURCE_SWITCH_VISUAL.rowGap }) {
      Column({ space: SOURCE_SWITCH_VISUAL.rowTextGap }) {
        Text(this.candidate.sourceName || this.candidate.sourceId).fontFamily(TYPE_SOURCE_SWITCH_NOVEL_NAME.fontFamily)
          .fontWeight(TYPE_SOURCE_SWITCH_NOVEL_NAME.fontWeight).fontSize(TYPE_SOURCE_SWITCH_NOVEL_NAME.fontSizeFp).lineHeight(TYPE_SOURCE_SWITCH_NOVEL_NAME.lineHeightFp).halfLeading(true)
          .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
          .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
        Text(sourceSwitchNovelChapter(this.candidate)).fontFamily(TYPE_SOURCE_SWITCH_NOVEL_CHAPTER.fontFamily).fontWeight(TYPE_SOURCE_SWITCH_NOVEL_CHAPTER.fontWeight).fontSize(TYPE_SOURCE_SWITCH_NOVEL_CHAPTER.fontSizeFp).lineHeight(TYPE_SOURCE_SWITCH_NOVEL_CHAPTER.lineHeightFp).halfLeading(true)
          .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
          .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
      }.alignItems(HorizontalAlign.Start).layoutWeight(1);
      if (this.candidate.latencyKind === 'search' && this.candidate.latencyMs !== undefined &&
        Number.isFinite(this.candidate.latencyMs) && this.candidate.latencyMs >= 0) {
        Flex({ direction: FlexDirection.Row, justifyContent: FlexAlign.End, alignItems: ItemAlign.Baseline }) {
          Text(`${Math.round(this.candidate.latencyMs)}`).fontFamily(TYPE_SOURCE_SWITCH_NOVEL_LATENCY.fontFamily)
            .fontWeight(TYPE_SOURCE_SWITCH_NOVEL_LATENCY.fontWeight).fontSize(TYPE_SOURCE_SWITCH_NOVEL_LATENCY.fontSizeFp)
            .lineHeight(TYPE_SOURCE_SWITCH_NOVEL_LATENCY.lineHeightFp).halfLeading(true).fontFeature('"tnum" 1')
            .fontColor(readerAppColor('TOK_INK', this.appThemeScheme)).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
          Text(' ms').fontFamily(TYPE_SOURCE_SWITCH_NOVEL_LATENCY_UNIT.fontFamily)
            .fontWeight(TYPE_SOURCE_SWITCH_NOVEL_LATENCY_UNIT.fontWeight).fontSize(TYPE_SOURCE_SWITCH_NOVEL_LATENCY_UNIT.fontSizeFp)
            .lineHeight(TYPE_SOURCE_SWITCH_NOVEL_LATENCY_UNIT.lineHeightFp).halfLeading(true)
            .fontColor(readerAppColor(SOURCE_SWITCH_VISUAL.timingUnitInkRole, this.appThemeScheme)).margin({ left: SOURCE_SWITCH_VISUAL.timingUnitGap }).maxLines(1);
        }.width(this.timingColumnWidth);
      } else {
        Text('—').fontFamily(TYPE_SOURCE_SWITCH_NOVEL_LATENCY.fontFamily).fontWeight(TYPE_SOURCE_SWITCH_NOVEL_LATENCY.fontWeight)
          .fontSize(TYPE_SOURCE_SWITCH_NOVEL_LATENCY.fontSizeFp).lineHeight(TYPE_SOURCE_SWITCH_NOVEL_LATENCY.lineHeightFp).halfLeading(true)
          .fontColor(readerAppColor('TOK_INK', this.appThemeScheme)).width(this.timingColumnWidth).textAlign(TextAlign.End).maxLines(1);
      }
    // ArkUI overlays its thumb; reserve the shared bar plus its platform inset
    // and rounding inside the full-width row, keeping the divider unchanged.
    }.width('100%').height(this.rowHeight).padding({ top: SOURCE_SWITCH_VISUAL.rowPaddingY, bottom: SOURCE_SWITCH_VISUAL.rowPaddingY,
      right: SOURCE_SWITCH_VISUAL.scrollbarWidth + 5 })
      .backgroundColor(this.selected || this.pressed ? readerAppColor('TOK_PRIMARY_SOFT', this.appThemeScheme) : Color.Transparent)
      .border({ width: { bottom: SOURCE_SWITCH_VISUAL.rowDividerWidth }, color: this.dividerColor() })
      .transition(this.reduceMotion ? TransitionEffect.IDENTITY : TransitionEffect.OPACITY.animation({ duration: SOURCE_SWITCH_VISUAL.rowEnterDurationMs, curve: curves.cubicBezierCurve(SOURCE_SWITCH_VISUAL.easingX1, SOURCE_SWITCH_VISUAL.easingY1, SOURCE_SWITCH_VISUAL.easingX2, SOURCE_SWITCH_VISUAL.easingY2) }))
      .enabled(this.rowEnabled && this.candidate.isCurrent !== true).accessibilityGroup(true)
      .accessibilityText(`${this.candidate.sourceName || this.candidate.sourceId}，${sourceSwitchNovelChapter(this.candidate)}，搜索用时 ${sourceSwitchNovelLatency(this.candidate)}`)
      .onTouch((event: TouchEvent): void => this.rowTouch(event))
      .onClick((): void => this.onSelect());
  }
}

/** Real reading/detail source picker: one drawer visual for both content kinds.
 * Gateway state owns candidates and ordering. Presentation defers movement
 * during input and retains the list through the real switch transaction. */
@Component
export struct SourceSwitchWindow {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @StorageLink('readerAppForeground') @Watch('foregroundChanged') private foreground: boolean = true;
  @Prop @Watch('acceptState') state: SourceSwitchPanelState;
  @Prop currentSourceId: string = '';
  @Prop bookTitle: string = '';
  @Prop author: string = '';
  @Prop @Watch('coverChanged') coverUrl: string = '';
  @Prop currentSourceName: string = '';
  @Prop currentChapterTitle: string = '';
  @Prop latestChapterTitle: string = '';
  // Both content kinds follow the selected 2026-10-06 reading drawer.
  // Both formats keep the same real gateway/transaction ownership.
  @Prop contentKind: string = 'text';
  @Prop reduceMotion: boolean = false;
  @Prop consumeTopInset: boolean = true;
  @Prop allowCancelWhileSwitching: boolean = false;
  onClose: () => void = (): void => {};
  onRetry: () => void = (): void => {};
  onRefresh: () => void = (): void => {};
  onStop: () => void = (): void => {};
  onSelectCandidate: (candidate: SourceSwitchCandidate) => void = (_candidate: SourceSwitchCandidate): void => {};
  onRollback: () => void = (): void => {};
  @State private displayedCandidates: SourceSwitchCandidate[] = [];
  @State private retestingKeys: string[] = [];
  @State private selectedKey: string = '';
  @State private selectionPending: boolean = false;
  @State private coverFailed: boolean = false;
  @State private containerHeight: number = 0;
  @State private containerWidth: number = 0;
  @State private novelFontsReady: boolean = sourceSwitchNovelFontsReady();
  @State private discoveryActionPressed: boolean = false;
  private discoveryActionPressRunning: boolean = false;
  private latestCandidates: SourceSwitchCandidate[] = [];
  private pendingSearchKeys: Set<string> = new Set();
  private wasRefreshing: boolean = false;
  private mounted: boolean = false;
  private touching: boolean = false;
  private scrolling: boolean = false;
  private heldKey: string = '';
  private firstVisibleIndex: number = 0;
  private firstVisibleListIndex: number = 0;
  @State private contextHeight: number = 0;
  private listMounted: boolean = false;
  private reorderTimer: number = -1;
  private presentationEpoch: number = 0;
  private anchorEpoch: number = 0;
  private restoringAnchor: boolean = false;
  private readonly candidateScroller: Scroller = new Scroller();
  private readonly candidateDataSource: SourceSwitchCandidateDataSource = new SourceSwitchCandidateDataSource();

  aboutToAppear(): void {
    this.mounted = true;
    registerReaderFonts(this.getUIContext().getFont());
    this.acceptState();
    if (!this.novelFontsReady) {
      void prepareSourceSwitchNovelFonts().then((ready: boolean): void => {
        if (this.mounted) this.novelFontsReady = ready;
      });
    }
  }
  aboutToDisappear(): void { this.mounted = false; this.cancelPresentation(); }
  private coverChanged(): void { this.coverFailed = false; }
  private foregroundChanged(): void {
    if (!this.foreground) this.cancelPresentation();
    else if (this.mounted) this.acceptState();
  }
  private cancelPresentation(): void {
    this.discoveryActionPressed = false;
    this.presentationEpoch += 1;
    this.anchorEpoch += 1;
    if (this.reorderTimer >= 0) clearTimeout(this.reorderTimer);
    this.reorderTimer = -1;
    this.restoringAnchor = false;
    this.touching = false;
    this.scrolling = false;
    this.heldKey = '';
  }
  private candidateKey(candidate: SourceSwitchCandidate): string {
    return sourceSwitchCandidateKey(candidate.sourceId, candidate.bookUrl);
  }
  /**
   * Keep every discovered rule as a selectable row.
   *
   * Provider-family metadata is useful for diagnostics and labels, but it is
   * never a selection identity. Collapsing a family to its first candidate
   * made alternate 七猫 rules unreachable and could silently select a rule
   * that was not the fastest or most complete one. Shared hosts are also not
   * sufficient evidence that two source rules are interchangeable.
   */
  private presentationCandidates(candidates: SourceSwitchCandidate[]): SourceSwitchCandidate[] {
    // Preserve discovery order here. Gateway owns latency ordering and this
    // layer must not manufacture a representative row for a family. Keeping
    // the exact object also means candidateKey() and selectCandidate() refer
    // to the same sourceId + bookUrl tuple.
    // ArkTS forbids object spread for this production path. The gateway's
    // candidate is already immutable for the current projection, so preserve
    // the exact instances and identities here.
    return candidates;
  }
  private publishCandidates(candidates: SourceSwitchCandidate[]): void {
    this.displayedCandidates = candidates;
    this.candidateDataSource.publish(candidates);
  }
  private acceptState(): void {
    if (this.state.kind !== 'switching') this.selectionPending = false;
    if (this.discoveryActionPressed && (this.busy() || this.rollbackRequired() ||
      this.discoveryActionPressRunning !== this.isSweeping())) this.discoveryActionPressed = false;
    if (this.state.kind !== 'candidates') {
      this.wasRefreshing = false;
      if (this.state.kind === 'empty') {
        this.cancelPresentation();
        this.publishCandidates([]);
        this.latestCandidates = [];
        this.pendingSearchKeys.clear();
        this.retestingKeys = [];
        this.selectedKey = '';
      }
      if (this.state.kind === 'switching' || this.state.kind === 'success') this.cancelPresentation();
      return;
    }
    this.selectedKey = '';
    const refreshing = this.state.refreshing === true && this.state.stopped !== true;
    if (refreshing && !this.wasRefreshing) {
      this.pendingSearchKeys.clear();
      for (const candidate of this.displayedCandidates) this.pendingSearchKeys.add(this.candidateKey(candidate));
    }
    this.wasRefreshing = refreshing;
    this.latestCandidates = this.state.candidates.filter((candidate: SourceSwitchCandidate): boolean => candidate.isCurrent !== true);
    for (const candidate of this.latestCandidates) {
      const key = this.candidateKey(candidate);
      const latency = candidate.latencyMs;
      if (candidate.latencyKind === 'search' && latency !== undefined && Number.isFinite(latency) && latency >= 0) {
        this.pendingSearchKeys.delete(key);
      }
    }
    this.retestingKeys = Array.from(this.pendingSearchKeys);
    // Metadata and discoveries update immediately. Every candidate remains a
    // real row so alternate rules retain their exact selectable identity.
    const incoming = new Map<string, SourceSwitchCandidate>();
    for (const candidate of this.presentationCandidates(this.latestCandidates)) incoming.set(this.candidateKey(candidate), candidate);
    const retained: SourceSwitchCandidate[] = [];
    for (const previous of this.displayedCandidates) {
      const current = incoming.get(this.candidateKey(previous));
      if (current !== undefined) { retained.push(current); incoming.delete(this.candidateKey(previous)); }
      else if (this.touching || this.scrolling) retained.push(previous);
    }
    for (const candidate of incoming.values()) retained.push(candidate);
    this.publishCandidates(retained);
    this.queueReorder();
  }
  private queueReorder(): void {
    if (this.reorderTimer >= 0) clearTimeout(this.reorderTimer);
    this.reorderTimer = -1;
    if (!this.mounted || !this.foreground || this.touching || this.scrolling || this.restoringAnchor || this.busy()) return;
    const epoch = this.presentationEpoch;
    this.reorderTimer = setTimeout((): void => {
      this.reorderTimer = -1;
      if (!this.mounted || !this.foreground || epoch !== this.presentationEpoch || this.touching || this.scrolling || this.busy()) return;
      this.heldKey = '';
      this.publishOrder();
    }, this.isSweeping() ? 0 : 80);
  }
  private publishOrder(): void {
    if (this.state.kind !== 'candidates') return;
    // The gateway publishes latency-sorted candidates after every source;
    // apply that order while searching instead of waiting for the final sweep.
    const latestKeys = new Set(this.latestCandidates.map((candidate: SourceSwitchCandidate): string => this.candidateKey(candidate)));
    const next = this.presentationCandidates(this.latestCandidates).filter((candidate: SourceSwitchCandidate): boolean =>
      latestKeys.has(this.candidateKey(candidate)));
    if (next.length === this.displayedCandidates.length && next.every((candidate: SourceSwitchCandidate, index: number): boolean =>
      this.candidateKey(candidate) === this.candidateKey(this.displayedCandidates[index]))) return;
    let anchorKey: string = '';
    let itemY: number = 0;
    if (this.listMounted) {
      const offset = this.candidateScroller.currentOffset();
      if (offset !== undefined && Number.isFinite(offset.yOffset) && offset.yOffset > 0 && this.firstVisibleListIndex >= this.listHeaderCount()) {
        const first = this.displayedCandidates[this.firstVisibleIndex];
        if (first !== undefined) {
          anchorKey = this.candidateKey(first);
          try { itemY = this.candidateScroller.getItemRect(this.firstVisibleIndex + this.listHeaderCount()).y; }
          catch (_error) { itemY = this.firstVisibleIndex * this.rowHeight() + this.listHeaderHeight() - offset.yOffset; }
        }
      }
    }
    if (anchorKey.length > 0) {
      this.publishCandidates(next);
      this.restoreAnchor(anchorKey, Math.max(1 - this.rowHeight(), Math.min(0, Number.isFinite(itemY) ? itemY : 0)));
    } else {
      this.getUIContext().animateTo({ duration: this.reduceMotion ? 0 : 220, curve: Curve.EaseInOut }, (): void => { this.publishCandidates(next); });
    }
  }
  private restoreAnchor(key: string, itemY: number, attempt: number = 0): void {
    const epoch = this.presentationEpoch;
    const anchorEpoch = ++this.anchorEpoch;
    this.restoringAnchor = true;
    const current = (): boolean => this.mounted && this.listMounted && this.foreground && !this.touching &&
      epoch === this.presentationEpoch && anchorEpoch === this.anchorEpoch;
    this.getUIContext().postFrameCallback(new SourceSwitchLayoutFrame((): void => {
      if (!current()) return;
      const index = this.displayedCandidates.findIndex((candidate: SourceSwitchCandidate): boolean => this.candidateKey(candidate) === key);
      if (index < 0) { this.restoringAnchor = false; this.queueReorder(); return; }
      this.candidateScroller.scrollToIndex(index + this.listHeaderCount(), false, ScrollAlign.START);
      this.getUIContext().postFrameCallback(new SourceSwitchLayoutFrame((): void => {
        if (!current()) return;
        const actual = this.displayedCandidates.findIndex((candidate: SourceSwitchCandidate): boolean => this.candidateKey(candidate) === key);
        if (actual >= 0) {
          try {
            const rect = this.candidateScroller.getItemRect(actual + this.listHeaderCount());
            if (!Number.isFinite(rect.y) || rect.height <= 0) throw new Error('anchor not laid out');
            this.candidateScroller.scrollBy(0, rect.y - itemY);
          } catch (_error) {
            if (attempt < 2) { this.restoreAnchor(key, itemY, attempt + 1); return; }
            this.candidateScroller.scrollTo({ xOffset: 0, yOffset: actual * this.rowHeight() + this.listHeaderHeight() - itemY });
          }
          const offset = this.candidateScroller.currentOffset();
          if (offset !== undefined && Number.isFinite(offset.yOffset)) {
            this.firstVisibleIndex = Math.max(0, Math.floor((offset.yOffset - this.listHeaderHeight()) / this.rowHeight()));
          }
        }
        this.restoringAnchor = false;
        this.queueReorder();
      }));
    }));
  }
  private listTouch(event: TouchEvent): void {
    if (event.type === TouchType.Down) {
      this.anchorEpoch += 1;
      this.restoringAnchor = false;
      this.touching = true;
      if (this.reorderTimer >= 0) clearTimeout(this.reorderTimer);
      this.reorderTimer = -1;
    } else if (event.type === TouchType.Up || event.type === TouchType.Cancel) {
      this.touching = false;
      if (event.type === TouchType.Cancel) this.heldKey = '';
      this.queueReorder();
    }
  }
  private selectCandidate(key: string): void {
    if (this.state.kind !== 'candidates' || this.busy() || this.scrolling || (this.heldKey.length > 0 && this.heldKey !== key)) return;
    const candidate = this.latestCandidates.find((value: SourceSwitchCandidate): boolean => this.candidateKey(value) === key);
    if (candidate === undefined || candidate.isCurrent === true) return;
    this.cancelPresentation();
    this.selectedKey = key;
    this.selectionPending = true;
    this.onSelectCandidate(candidate);
  }
  private busy(): boolean { return this.selectionPending || this.state.kind === 'switching'; }
  private isSweeping(): boolean {
    return this.state.kind === 'discovering' || (this.state.kind === 'candidates' &&
      this.state.refreshing === true && this.state.stopped !== true);
  }
  private requiresReconciliation(): boolean {
    return this.state.kind === 'failure' && (this.state.confirmation === 'unknown' || this.state.reconcile === true);
  }
  private rollbackRequired(): boolean {
    return this.state.kind === 'failure' && this.state.transactionId !== undefined && !this.requiresReconciliation();
  }
  private requestRefresh(): void {
    if (this.busy() || this.rollbackRequired()) return;
    if (this.isSweeping()) this.onStop();
    else if (this.state.kind === 'candidates') this.onRefresh();
    else this.onRetry();
  }
  private statusText(): string {
    const count = sourceSwitchSourceCount(this.displayedCandidates);
    if (this.isSweeping()) return this.contentKind === 'manga' ? `正在查找 · 已发现 ${count} 个` : `正在查找 · 已找到 ${count} 个书源`;
    if (this.busy()) return '正在切换书源…';
    if (this.state.kind === 'success') return '已切换书源';
    if (this.state.kind === 'failure') return this.requiresReconciliation() ? '换源结果未确认' : '换源失败';
    if (this.state.kind === 'discoveryError') return '查找失败';
    if ((this.state.kind === 'candidates' || this.state.kind === 'empty') && this.state.stopped === true) {
      return this.contentKind === 'manga' ? `已停止 · 已发现 ${count} 个` : `已停止 · 已找到 ${count} 个书源`;
    }
    return this.contentKind === 'manga' ? `查找完成 · 已发现 ${count} 个` : `查找结束 · 已找到 ${count} 个书源`;
  }
  private errorText(): string {
    if (this.state.kind === 'discoveryError' || this.state.kind === 'failure') return this.state.message;
    return this.state.kind === 'candidates' ? this.state.refreshError ?? '' : '';
  }
  private safeTop(): number {
    return !this.consumeTopInset || this.readerWindowMetricsRevision < 0 ? 0 : readerVisualSafeTop(ReaderWindowCoordinator.metrics());
  }
  private safeBottom(): number {
    return this.readerWindowMetricsRevision < 0 ? 0 : readerInteractiveSafeBottom(ReaderWindowCoordinator.metrics(), true);
  }
  private safeLeft(): number {
    const metrics = ReaderWindowCoordinator.metrics();
    return this.readerWindowMetricsRevision < 0 ? 0 : readerInteractiveSafeLeft(metrics);
  }
  private safeRight(): number {
    return this.readerWindowMetricsRevision < 0 ? 0 : readerInteractiveSafeRight(ReaderWindowCoordinator.metrics());
  }

  @Builder
  private candidateList() {
    Stack({ alignContent: Alignment.Top }) {
      List({ scroller: this.candidateScroller }) {
        if (this.flowChrome()) {
          ListItem() { this.novelHeading(); }.height(this.headingHeight());
        }
        if (this.scrollBook()) {
          ListItem() { this.novelBookContext(); }
            .onAreaChange((_old: Area, area: Area): void => { const height = Number(area.height); if (Number.isFinite(height) && height > 0) this.contextHeight = height; })
        }
        if (this.flowChrome()) {
          ListItem() { this.novelDiscovery(); }.height(this.discoveryHeight());
          ListItem() { this.novelColumns(); }.height(this.columnsHeight());
        }
        LazyForEach(this.candidateDataSource, (row: SourceSwitchCandidateRow) => {
          ListItem() {
            SourceSwitchNovelRow({ row: row, rowHeight: this.rowHeight(), timingColumnWidth: this.timingWidth(), reduceMotion: this.reduceMotion,
              rowEnabled: this.state.kind === 'candidates' && !this.busy(),
              selected: this.selectedKey === row.key,
              onPress: (): void => { this.heldKey = row.key; },
              onSelect: (): void => this.selectCandidate(row.key) });
          }.width('100%').height(this.rowHeight());
        }, (row: SourceSwitchCandidateRow): string => row.key);
        if (this.scrollBook() && this.displayedCandidates.length === 0) {
          ListItem() { this.novelEmptyMessage(); }.height(this.emptyHeight());
        }
        if (this.flowChrome()) {
          ListItem() { this.novelFooter(); }.height(this.footerHeight());
        }
      }.width('100%').height('100%').scrollBar(BarState.Auto)
        .scrollBarWidth(SOURCE_SWITCH_VISUAL.scrollbarWidth).scrollBarColor(readerAppColor('TOK_SS_SCROLLBAR', this.appThemeScheme))
        .contentStartOffset(this.listStartInset()).contentEndOffset(0)
        .onTouch((event: TouchEvent): void => this.listTouch(event))
        .onScrollStart((): void => { if (!this.restoringAnchor) this.scrolling = true; })
        .onScrollStop((): void => { if (!this.restoringAnchor) { this.scrolling = false; this.queueReorder(); } })
        .onScrollIndex((start: number): void => { this.firstVisibleListIndex = start; this.firstVisibleIndex = Math.max(0, start - this.listHeaderCount()); })
        .onAppear((): void => { this.listMounted = true; })
        .onDisAppear((): void => { this.listMounted = false; this.anchorEpoch += 1; });
      if (this.displayedCandidates.length === 0 && !this.scrollBook()) {
        this.novelEmptyMessage();
      }
    }.layoutWeight(1).width('100%');
  }
  @Builder
  private novelEmptyMessage() {
    Column() {
      Text(this.isSweeping() ? '正在查找其他书源…' : '未找到其他书源')
        .fontFamily(TYPE_SOURCE_SWITCH_NOVEL_EMPTY.fontFamily).fontWeight(TYPE_SOURCE_SWITCH_NOVEL_EMPTY.fontWeight)
        .fontSize(TYPE_SOURCE_SWITCH_NOVEL_EMPTY.fontSizeFp).lineHeight(TYPE_SOURCE_SWITCH_NOVEL_EMPTY.lineHeightFp).halfLeading(true)
        .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme)).textAlign(TextAlign.Center);
    }.width('100%').height('100%').justifyContent(FlexAlign.Center)
      .padding({ left: SOURCE_SWITCH_VISUAL.emptyPaddingX, right: SOURCE_SWITCH_VISUAL.emptyPaddingX,
        top: SOURCE_SWITCH_VISUAL.emptyPaddingY, bottom: SOURCE_SWITCH_VISUAL.emptyPaddingY }).hitTestBehavior(HitTestMode.None);
  }
  private emptyHeight(): number {
    const grip = this.compactWindow() || this.flowChrome() ? 0 :
      SOURCE_SWITCH_VISUAL.gripHeight + SOURCE_SWITCH_VISUAL.gripMarginTop + SOURCE_SWITCH_VISUAL.gripMarginBottom;
    const fixed = this.flowChrome() ? 0 : this.headingHeight() + this.discoveryHeight() + this.columnsHeight() + this.footerHeight() + grip;
    return Math.max(this.rowHeight(), this.drawerHeight() - this.safeBottom() - fixed - this.listHeaderHeight());
  }
  @Builder
  private recoveryNotice() {
    if (this.errorText().length > 0 || this.rollbackRequired()) {
      Column({ space: 8 }) {
        Text(this.errorText()).fontFamily('ReaderNotoSansSC').fontSize(12)
          .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme)).width('100%')
          .maxLines(3).textOverflow({ overflow: TextOverflow.Ellipsis });
        Button(this.rollbackRequired() ? '撤销切换' : this.requiresReconciliation() ? '重试核对' : '重试', { type: ButtonType.Normal })
          .height(40).fontSize(13).fontColor(readerAppColor('TOK_GREEN', this.appThemeScheme))
          .backgroundColor(readerAppColor('TOK_PRIMARY_SOFT', this.appThemeScheme)).borderRadius(8)
          .onClick((): void => { if (this.rollbackRequired()) this.onRollback(); else this.requestRefresh(); });
      }.width('100%').padding({ left: 18, right: 18, top: 10, bottom: 12 })
        .border({ width: { top: 0.5 }, color: readerAppColor('TOK_ROW_DIVIDER', this.appThemeScheme) });
    }
  }
  private listStartInset(): number { return 0; }
  private listHeaderCount(): number { return this.flowChrome() ? 4 : this.scrollBook() ? 1 : 0; }
  private listHeaderHeight(): number {
    return this.flowChrome() ? this.headingHeight() + this.bookHeight() + this.discoveryHeight() + this.columnsHeight() : this.scrollBook() ? this.bookHeight() : 0;
  }
  private frameHeight(): number { return this.containerHeight > 0 ? this.containerHeight : ReaderWindowCoordinator.metrics().windowRect.height; }
  private frameWidth(): number { return this.containerWidth > 0 ? this.containerWidth : ReaderWindowCoordinator.metrics().windowRect.width; }
  private drawerWidth(): number { return Math.min(SOURCE_SWITCH_VISUAL.drawerMaxWidth, this.frameWidth()); }
  private novelSafeLeft(): number { return Math.max(0, this.safeLeft() - Math.max(0, this.frameWidth() - this.drawerWidth()) / 2); }
  private novelSafeRight(): number { return Math.max(0, this.safeRight() - Math.max(0, this.frameWidth() - this.drawerWidth()) / 2); }
  private narrowWindow(): boolean { return this.drawerWidth() - this.novelSafeLeft() - this.novelSafeRight() < SOURCE_SWITCH_VISUAL.narrowWidthThreshold; }
  private sideInset(): number { return this.narrowWindow() ? SOURCE_SWITCH_VISUAL.narrowSideInset : SOURCE_SWITCH_VISUAL.normalSideInset; }
  private novelFontScale(): number { return sourceSwitchNovelScale(ReaderWindowCoordinator.metrics().systemFontScale); }
  private compactWindow(): boolean { return sourceSwitchNovelCompact(this.frameHeight()); }
  private scrollBook(): boolean { return this.flowChrome() || this.compactWindow() || this.novelFontScale() !== 1; }
  private flowChrome(): boolean {
    const grip = this.compactWindow() ? 0 : SOURCE_SWITCH_VISUAL.gripHeight + SOURCE_SWITCH_VISUAL.gripMarginTop + SOURCE_SWITCH_VISUAL.gripMarginBottom;
    return this.drawerHeight() - this.safeBottom() < this.headingHeight() + this.discoveryHeight() + this.columnsHeight() + this.footerHeight() + grip + this.rowHeight();
  }
  private headingHeight(): number { return sourceSwitchNovelHeadingHeight(this.novelFontScale()); }
  private discoveryHeight(): number { return sourceSwitchNovelDiscoveryHeight(this.novelFontScale(), this.narrowWindow()); }
  private discoverySafeWidth(): number { return this.drawerWidth() - this.novelSafeLeft() - this.novelSafeRight(); }
  private compactDiscoveryAction(): boolean { return sourceSwitchNovelDiscoveryCompact(this.discoverySafeWidth(), this.novelFontScale()); }
  private discoveryPrefixVisible(): boolean { return sourceSwitchNovelDiscoveryPrefixVisible(this.discoverySafeWidth(), this.novelFontScale()); }
  private discoveryActionWidth(): number { return sourceSwitchNovelDiscoveryActionWidth(this.discoverySafeWidth(), this.novelFontScale()); }
  private discoveryActionVisibleHeight(): number { return sourceSwitchNovelDiscoveryActionVisibleHeight(this.novelFontScale()); }
  private discoveryActionHitHeight(): number { return sourceSwitchNovelDiscoveryActionHitHeight(this.novelFontScale()); }
  private discoveryToolbarHeight(): number { return sourceSwitchNovelDiscoveryToolbarHeight(this.novelFontScale(), this.narrowWindow()); }
  private discoveryActionTouch(event: TouchEvent): void {
    this.discoveryActionPressed = event.type === TouchType.Down && this.foreground && !this.busy() && !this.rollbackRequired();
    if (this.discoveryActionPressed) this.discoveryActionPressRunning = this.isSweeping();
  }
  private discoveryActionBackgroundColor(): ResourceColor {
    if (!this.discoveryActionPressed || !this.foreground || this.busy() || this.rollbackRequired() ||
      this.discoveryActionPressRunning !== this.isSweeping()) {
      return readerAppColor(SOURCE_SWITCH_VISUAL.discoveryActionBackgroundRole, this.appThemeScheme);
    }
    const color = ColorMetrics.resourceColor(readerAppColor('TOK_GREEN', this.appThemeScheme));
    return ColorMetrics.rgba(color.red, color.green, color.blue, SOURCE_SWITCH_VISUAL.discoveryActionPressedOpacity).color;
  }
  private novelDiscoveryPhase(): string {
    if (this.isSweeping()) return '正在查找';
    if (this.busy()) return '正在切换书源…';
    if (this.state.kind === 'success') return '已切换书源';
    if (this.state.kind === 'failure') return this.requiresReconciliation() ? '换源结果未确认' : '换源失败';
    if (this.state.kind === 'discoveryError') return '查找失败';
    if ((this.state.kind === 'candidates' || this.state.kind === 'empty') && this.state.stopped === true) return '已停止';
    return '查找结束';
  }
  private columnsHeight(): number { return sourceSwitchNovelColumnHeight(this.novelFontScale(), this.compactWindow()); }
  private footerHeight(): number { return sourceSwitchNovelFooterHeight(this.novelFontScale(), this.compactWindow()); }
  private bookHeight(): number { return sourceSwitchNovelBookHeight(this.novelFontScale()); }
  private timingWidth(): number { return sourceSwitchNovelTimingWidth(this.novelFontScale(), this.narrowWindow()); }
  private rowHeight(): number { return sourceSwitchNovelRowHeight(this.novelFontScale()); }
  private drawerHeight(): number { return sourceSwitchNovelDrawerHeight(this.frameHeight(), this.safeTop()); }
  private switchingSourceName(): string {
    const target = this.state.kind === 'switching' ? this.state.targetSourceId : '';
    const candidate = this.displayedCandidates.find((value: SourceSwitchCandidate): boolean =>
      this.selectedKey.length > 0 ? this.candidateKey(value) === this.selectedKey : value.sourceId === target);
    return candidate?.sourceName || target;
  }

  @Builder
  private novelHeading() {
    Row({ space: SOURCE_SWITCH_VISUAL.headingGap }) {
      Text('更换书源').fontFamily(TYPE_SOURCE_SWITCH_NOVEL_HEADING.fontFamily).fontWeight(TYPE_SOURCE_SWITCH_NOVEL_HEADING.fontWeight)
        .fontSize(TYPE_SOURCE_SWITCH_NOVEL_HEADING.fontSizeFp).lineHeight(TYPE_SOURCE_SWITCH_NOVEL_HEADING.lineHeightFp).halfLeading(true)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme)).layoutWeight(1).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
      Button({ type: ButtonType.Normal }) {
        Image(this.appThemeScheme === 'night' ? $r('app.media.source_switch_close_theme_night') : $r('app.media.source_switch_close'))
          .width(SOURCE_SWITCH_VISUAL.closeIconSize).height(SOURCE_SWITCH_VISUAL.closeIconSize);
      }.width(44).height(44).margin({ right: SOURCE_SWITCH_VISUAL.closeMarginRight - (44 - SOURCE_SWITCH_VISUAL.closeWidth) / 2 })
        .padding(0).backgroundColor(Color.Transparent).borderRadius(SOURCE_SWITCH_VISUAL.closeRadius)
        .accessibilityText('关闭更换书源').enabled((!this.busy() || this.allowCancelWhileSwitching) && !this.rollbackRequired()).onClick((): void => this.onClose());
    }.width('100%').height(this.headingHeight());
  }
  @Builder
  private novelBookContext() {
    Row({ space: this.narrowWindow() ? SOURCE_SWITCH_VISUAL.narrowBookGap : SOURCE_SWITCH_VISUAL.bookGap }) {
      if (this.coverUrl.trim().length > 0 && !this.coverFailed) {
        Image(this.coverUrl).width(this.compactWindow() ? SOURCE_SWITCH_VISUAL.compactCoverWidth : SOURCE_SWITCH_VISUAL.coverWidth)
          .height(this.compactWindow() ? SOURCE_SWITCH_VISUAL.compactCoverHeight : SOURCE_SWITCH_VISUAL.coverHeight)
          .objectFit(ImageFit.Cover).borderRadius(SOURCE_SWITCH_VISUAL.coverRadius).onError((): void => { this.coverFailed = true; });
      } else {
        NoCoverCover({ coverWidth: this.compactWindow() ? SOURCE_SWITCH_VISUAL.compactCoverWidth : SOURCE_SWITCH_VISUAL.coverWidth,
          coverHeight: this.compactWindow() ? SOURCE_SWITCH_VISUAL.compactCoverHeight : SOURCE_SWITCH_VISUAL.coverHeight });
      }
      Column() {
        Text(this.bookTitle || '当前书籍').fontFamily(TYPE_SOURCE_SWITCH_NOVEL_BOOK_TITLE.fontFamily).fontWeight(TYPE_SOURCE_SWITCH_NOVEL_BOOK_TITLE.fontWeight)
          .fontSize(TYPE_SOURCE_SWITCH_NOVEL_BOOK_TITLE.fontSizeFp).lineHeight(TYPE_SOURCE_SWITCH_NOVEL_BOOK_TITLE.lineHeightFp).halfLeading(true)
          .fontColor(readerAppColor('TOK_INK', this.appThemeScheme)).margin({ bottom: SOURCE_SWITCH_VISUAL.bookTitleGap })
          .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
        Text(this.author || '未知作者').fontFamily(TYPE_SOURCE_SWITCH_NOVEL_METADATA.fontFamily).fontWeight(TYPE_SOURCE_SWITCH_NOVEL_METADATA.fontWeight)
          .fontSize(TYPE_SOURCE_SWITCH_NOVEL_METADATA.fontSizeFp).lineHeight(TYPE_SOURCE_SWITCH_NOVEL_METADATA.lineHeightFp).halfLeading(true)
          .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme)).margin({ bottom: SOURCE_SWITCH_VISUAL.bookAuthorGap })
          .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
        Text(this.latestChapterTitle.trim().length > 0 ? `最新章节：${this.latestChapterTitle}` : '最新章节暂无信息')
          .fontFamily(TYPE_SOURCE_SWITCH_NOVEL_CAPTION.fontFamily).fontWeight(TYPE_SOURCE_SWITCH_NOVEL_CAPTION.fontWeight)
          .fontSize(TYPE_SOURCE_SWITCH_NOVEL_CAPTION.fontSizeFp).lineHeight(TYPE_SOURCE_SWITCH_NOVEL_CAPTION.lineHeightFp).halfLeading(true)
          .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme)).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
        Text(`当前书源：${this.currentSourceName || this.currentSourceId}`).fontFamily(TYPE_SOURCE_SWITCH_NOVEL_CURRENT_SOURCE.fontFamily)
          .fontWeight(TYPE_SOURCE_SWITCH_NOVEL_CURRENT_SOURCE.fontWeight).fontSize(TYPE_SOURCE_SWITCH_NOVEL_CURRENT_SOURCE.fontSizeFp)
          .lineHeight(TYPE_SOURCE_SWITCH_NOVEL_CURRENT_SOURCE.lineHeightFp).halfLeading(true)
          .fontColor(readerAppColor('TOK_GREEN', this.appThemeScheme)).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
      }.alignItems(HorizontalAlign.Start).layoutWeight(1);
    // Center the intrinsic 88.1vp line stack in the fixed100vp context.
    // CSS's 8vp inner padding allows its 4.1vp line overflow. Native Row
    // padding would constrain those line boxes to84vp and change measurement;
    // centering in the outer height gives exactly the same visible positions.
    }.width('100%').height(this.bookHeight());
  }
  @Builder
  private novelDiscovery() {
    Row({ space: this.narrowWindow() ? SOURCE_SWITCH_VISUAL.narrowDiscoveryGap : SOURCE_SWITCH_VISUAL.discoveryGap }) {
      if (this.isSweeping()) {
        SourceSwitchSpinner({ active: this.foreground, diameter: SOURCE_SWITCH_VISUAL.discoverySpinnerSize,
          strokeWidth: SOURCE_SWITCH_VISUAL.discoverySpinnerStrokeWidth, durationMs: SOURCE_SWITCH_VISUAL.discoverySpinnerDurationMs, reduceMotion: this.reduceMotion });
      } else {
        Image(this.appThemeScheme === 'night' ? $r('app.media.search_mag_theme_night') : $r('app.media.search_mag'))
          .width(SOURCE_SWITCH_VISUAL.discoverySpinnerSize).height(SOURCE_SWITCH_VISUAL.discoverySpinnerSize).accessibilityLevel('no');
      }
      Column() {
        Flex({ direction: FlexDirection.Row, alignItems: ItemAlign.Baseline }) {
          if (this.discoveryPrefixVisible()) {
            Text('已找到').fontFamily(TYPE_SOURCE_SWITCH_NOVEL_DISCOVERY_STATUS.fontFamily)
              .fontWeight(TYPE_SOURCE_SWITCH_NOVEL_DISCOVERY_STATUS.fontWeight)
              .fontSize(this.narrowWindow() ? TYPE_SOURCE_SWITCH_NOVEL_DISCOVERY_STATUS_NARROW.fontSizeFp : TYPE_SOURCE_SWITCH_NOVEL_DISCOVERY_STATUS.fontSizeFp)
              .lineHeight(this.narrowWindow() ? TYPE_SOURCE_SWITCH_NOVEL_DISCOVERY_STATUS_NARROW.lineHeightFp : TYPE_SOURCE_SWITCH_NOVEL_DISCOVERY_STATUS.lineHeightFp).halfLeading(true)
              .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme)).flexShrink(0).maxLines(1);
          }
          Text(`${sourceSwitchSourceCount(this.displayedCandidates)}`).fontFamily(TYPE_SOURCE_SWITCH_NOVEL_DISCOVERY_COUNT.fontFamily)
            .fontWeight(TYPE_SOURCE_SWITCH_NOVEL_DISCOVERY_COUNT.fontWeight, { enableVariableFontWeight: true }).fontSize(TYPE_SOURCE_SWITCH_NOVEL_DISCOVERY_COUNT.fontSizeFp)
            .lineHeight(TYPE_SOURCE_SWITCH_NOVEL_DISCOVERY_COUNT.lineHeightFp).halfLeading(true).fontFeature('"tnum" 1')
            .fontColor(readerAppColor('TOK_GREEN', this.appThemeScheme)).flexShrink(0)
            .margin({ left: this.discoveryPrefixVisible() ? SOURCE_SWITCH_VISUAL.discoveryCountGap : 0 }).maxLines(1);
          Text('个书源').fontFamily(TYPE_SOURCE_SWITCH_NOVEL_DISCOVERY_STATUS.fontFamily)
            .fontWeight(TYPE_SOURCE_SWITCH_NOVEL_DISCOVERY_STATUS.fontWeight)
            .fontSize(this.narrowWindow() ? TYPE_SOURCE_SWITCH_NOVEL_DISCOVERY_STATUS_NARROW.fontSizeFp : TYPE_SOURCE_SWITCH_NOVEL_DISCOVERY_STATUS.fontSizeFp)
            .lineHeight(this.narrowWindow() ? TYPE_SOURCE_SWITCH_NOVEL_DISCOVERY_STATUS_NARROW.lineHeightFp : TYPE_SOURCE_SWITCH_NOVEL_DISCOVERY_STATUS.lineHeightFp).halfLeading(true)
            .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme)).flexShrink(1)
            .margin({ left: SOURCE_SWITCH_VISUAL.discoveryCountGap }).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
        }.width('100%');
        Text(this.novelDiscoveryPhase()).fontFamily(TYPE_SOURCE_SWITCH_NOVEL_DISCOVERY_PHASE.fontFamily)
          .fontWeight(TYPE_SOURCE_SWITCH_NOVEL_DISCOVERY_PHASE.fontWeight).fontSize(TYPE_SOURCE_SWITCH_NOVEL_DISCOVERY_PHASE.fontSizeFp)
          .lineHeight(TYPE_SOURCE_SWITCH_NOVEL_DISCOVERY_PHASE.lineHeightFp).halfLeading(true)
          .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme)).width('100%').maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
      }.alignItems(HorizontalAlign.Start).layoutWeight(1).accessibilityGroup(true).accessibilityText(this.statusText());
      Button({ type: ButtonType.Normal }) {
        Row({ space: SOURCE_SWITCH_VISUAL.discoveryActionGap }) {
          if (!this.isSweeping()) {
            Image(this.appThemeScheme === 'night' ? $r('app.media.settings_gen_refresh_theme_night') : $r('app.media.settings_gen_refresh'))
              .width(SOURCE_SWITCH_VISUAL.discoveryActionIconSize).height(SOURCE_SWITCH_VISUAL.discoveryActionIconSize).accessibilityLevel('no');
          }
          Text(this.isSweeping() ? '停止' : '重新查找').fontFamily(this.compactDiscoveryAction() ? TYPE_SOURCE_SWITCH_NOVEL_ACTION_COMPACT.fontFamily : TYPE_SOURCE_SWITCH_NOVEL_ACTION.fontFamily)
            .fontWeight(this.compactDiscoveryAction() ? TYPE_SOURCE_SWITCH_NOVEL_ACTION_COMPACT.fontWeight : TYPE_SOURCE_SWITCH_NOVEL_ACTION.fontWeight)
            .fontSize(this.compactDiscoveryAction() ? TYPE_SOURCE_SWITCH_NOVEL_ACTION_COMPACT.fontSizeFp : TYPE_SOURCE_SWITCH_NOVEL_ACTION.fontSizeFp)
            .lineHeight(this.compactDiscoveryAction() ? TYPE_SOURCE_SWITCH_NOVEL_ACTION_COMPACT.lineHeightFp : TYPE_SOURCE_SWITCH_NOVEL_ACTION.lineHeightFp).halfLeading(true)
            .fontColor(readerAppColor('TOK_GREEN', this.appThemeScheme)).maxLines(1);
        }.width('100%').height(this.discoveryActionVisibleHeight()).justifyContent(FlexAlign.Center)
          .padding({ left: this.compactDiscoveryAction() ? SOURCE_SWITCH_VISUAL.compactDiscoveryActionPaddingX : SOURCE_SWITCH_VISUAL.discoveryActionPaddingX,
            right: this.compactDiscoveryAction() ? SOURCE_SWITCH_VISUAL.compactDiscoveryActionPaddingX : SOURCE_SWITCH_VISUAL.discoveryActionPaddingX })
          .backgroundColor(this.discoveryActionBackgroundColor()).borderRadius(SOURCE_SWITCH_VISUAL.discoveryActionRadius);
      }.width(this.discoveryActionWidth()).height(this.discoveryActionHitHeight()).padding(0)
        .backgroundColor(Color.Transparent).borderRadius(SOURCE_SWITCH_VISUAL.discoveryActionRadius).stateEffect(false)
        .accessibilityText(this.isSweeping() ? '停止查找书源' : '重新查找书源')
        .enabled(!this.busy() && !this.rollbackRequired()).onTouch((event: TouchEvent): void => this.discoveryActionTouch(event))
        .onClick((): void => this.requestRefresh());
    }.width('100%').height(this.discoveryToolbarHeight()).margin({ bottom: SOURCE_SWITCH_VISUAL.discoveryBottomGap });
  }
  @Builder
  private novelColumns() {
    Row({ space: SOURCE_SWITCH_VISUAL.columnGap }) {
      Text('书源 / 最新章节').fontFamily(TYPE_SOURCE_SWITCH_NOVEL_COLUMN.fontFamily).fontWeight(TYPE_SOURCE_SWITCH_NOVEL_COLUMN.fontWeight)
        .fontSize(TYPE_SOURCE_SWITCH_NOVEL_COLUMN.fontSizeFp).lineHeight(TYPE_SOURCE_SWITCH_NOVEL_COLUMN.lineHeightFp).halfLeading(true)
        .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme)).layoutWeight(1).maxLines(1);
      Text('搜索耗时').fontFamily(TYPE_SOURCE_SWITCH_NOVEL_COLUMN.fontFamily).fontWeight(TYPE_SOURCE_SWITCH_NOVEL_COLUMN.fontWeight)
        .fontSize(TYPE_SOURCE_SWITCH_NOVEL_COLUMN.fontSizeFp).lineHeight(TYPE_SOURCE_SWITCH_NOVEL_COLUMN.lineHeightFp).halfLeading(true)
        .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme)).width(this.timingWidth()).textAlign(TextAlign.End).maxLines(1);
    // Match the result text edge without narrowing the full-width divider.
    }.width('100%').height(this.columnsHeight()).padding({ right: SOURCE_SWITCH_VISUAL.scrollbarWidth + 5 })
      .border({ width: { bottom: SOURCE_SWITCH_VISUAL.rowDividerWidth }, color: readerAppColor('TOK_ROW_DIVIDER', this.appThemeScheme) });
  }
  @Builder
  private novelFooter() {
    Text('点击书源切换').fontFamily(TYPE_SOURCE_SWITCH_NOVEL_FOOTER.fontFamily).fontWeight(TYPE_SOURCE_SWITCH_NOVEL_FOOTER.fontWeight)
      .fontSize(TYPE_SOURCE_SWITCH_NOVEL_FOOTER.fontSizeFp).lineHeight(TYPE_SOURCE_SWITCH_NOVEL_FOOTER.lineHeightFp).halfLeading(true)
      .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme)).textAlign(TextAlign.Center).width('100%').height(this.footerHeight());
  }
  @Builder
  private novelDrawer() {
    Column() {
      if (!this.compactWindow() && !this.flowChrome()) {
        Row().width(SOURCE_SWITCH_VISUAL.gripWidth).height(SOURCE_SWITCH_VISUAL.gripHeight).borderRadius(SOURCE_SWITCH_VISUAL.gripRadius)
          .backgroundColor(readerAppColor('TOK_SS_DRAWER_HANDLE', this.appThemeScheme))
          .margin({ top: SOURCE_SWITCH_VISUAL.gripMarginTop, bottom: SOURCE_SWITCH_VISUAL.gripMarginBottom }).hitTestBehavior(HitTestMode.None);
      }
      Column() {
        if (!this.flowChrome()) {
          this.novelHeading();
          if (!this.scrollBook()) { this.novelBookContext(); }
          this.novelDiscovery();
          this.novelColumns();
        }
        this.candidateList();
        this.recoveryNotice();
        if (!this.flowChrome()) { this.novelFooter(); }
      }.width('100%').layoutWeight(1).padding({ left: this.novelSafeLeft() + this.sideInset(), right: this.novelSafeRight() + this.sideInset(), bottom: this.safeBottom() });
    }.width('100%').constraintSize({ maxWidth: SOURCE_SWITCH_VISUAL.drawerMaxWidth }).height(this.drawerHeight())
      .backgroundColor(readerAppColor('TOK_SS_WINDOW_BG', this.appThemeScheme)).borderRadius({ topLeft: SOURCE_SWITCH_VISUAL.drawerCornerRadius, topRight: SOURCE_SWITCH_VISUAL.drawerCornerRadius }).clip(true)
      .transition(this.reduceMotion ? TransitionEffect.IDENTITY : TransitionEffect.asymmetric(
        TransitionEffect.move(TransitionEdge.BOTTOM).animation({ duration: SOURCE_SWITCH_VISUAL.openDurationMs, curve: curves.cubicBezierCurve(SOURCE_SWITCH_VISUAL.easingX1, SOURCE_SWITCH_VISUAL.easingY1, SOURCE_SWITCH_VISUAL.easingX2, SOURCE_SWITCH_VISUAL.easingY2) }),
        TransitionEffect.move(TransitionEdge.BOTTOM).animation({ duration: SOURCE_SWITCH_VISUAL.closeDurationMs, curve: curves.cubicBezierCurve(SOURCE_SWITCH_VISUAL.easingX1, SOURCE_SWITCH_VISUAL.easingY1, SOURCE_SWITCH_VISUAL.easingX2, SOURCE_SWITCH_VISUAL.easingY2) })));
  }
  @Builder
  private novelSwitching() {
    SourceSwitchProgress({ sourceName: this.switchingSourceName(), chapterTitle: this.currentChapterTitle,
      reduceMotion: this.reduceMotion, topInset: this.safeTop(), bottomInset: this.safeBottom(),
      allowCancel: this.allowCancelWhileSwitching, onCancel: (): void => this.onClose() })
      .transition(this.reduceMotion ? TransitionEffect.IDENTITY : TransitionEffect.OPACITY.animation({ duration: SOURCE_SWITCH_VISUAL.closeDurationMs,
        curve: curves.cubicBezierCurve(SOURCE_SWITCH_VISUAL.easingX1, SOURCE_SWITCH_VISUAL.easingY1, SOURCE_SWITCH_VISUAL.easingX2, SOURCE_SWITCH_VISUAL.easingY2) }));
  }
  build() {
    Stack({ alignContent: Alignment.Bottom }) {
      if (this.novelFontsReady) {
        if (this.state.kind === 'switching') {
          this.novelSwitching();
        } else {
          this.novelDrawer();
        }
      }
    }.width('100%').height('100%').hitTestBehavior(HitTestMode.Transparent)
      .onAreaChange((_old: Area, area: Area): void => {
        const height = Number(area.height);
        const width = Number(area.width);
        if (Number.isFinite(height) && height > 0) this.containerHeight = height;
        if (Number.isFinite(width) && width > 0) this.containerWidth = width;
      });
  }
}
