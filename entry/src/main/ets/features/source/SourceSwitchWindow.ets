import { FrameCallback } from '@kit.ArkUI';
import { readerAppColor } from '../common/ReaderThemeRegistry';
import { registerReaderFonts } from '../common/ReaderFonts';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import { readerInteractiveSafeBottom, readerInteractiveSafeLeft, readerInteractiveSafeRight,
  readerVisualSafeTop } from '../common/ReaderWindowMetrics';
import { SearchSpinner } from '../search/SearchSpinner';
import { NoCoverCover } from '../bookshelf/NoCoverCover';
import { sourceSwitchCandidateKey, sourceSwitchSourceCount } from './SourceSwitchGateway';
import type { SourceSwitchCandidate } from './SourceSwitchGateway';

export interface SourceSwitchDiscoveringState { kind: 'discovering'; }
export interface SourceSwitchCandidatesState {
  kind: 'candidates';
  candidates: SourceSwitchCandidate[];
  refreshing?: boolean;
  refreshError?: string;
  stopped?: boolean;
}
export interface SourceSwitchEmptyState { kind: 'empty'; stopped?: boolean; }
export interface SourceSwitchDiscoveryErrorState { kind: 'discoveryError'; message: string; }
export interface SourceSwitchSwitchingState { kind: 'switching'; targetSourceId: string; }
export interface SourceSwitchSuccessState { kind: 'success'; }
export interface SourceSwitchFailureState { kind: 'failure'; message: string; transactionId?: string; }
export type SourceSwitchPanelState = SourceSwitchDiscoveringState | SourceSwitchCandidatesState |
  SourceSwitchEmptyState | SourceSwitchDiscoveryErrorState | SourceSwitchSwitchingState |
  SourceSwitchSuccessState | SourceSwitchFailureState;

class SourceSwitchLayoutFrame extends FrameCallback {
  private action: () => void;
  constructor(action: () => void) { super(); this.action = action; }
  onFrame(_time: number): void {}
  onIdle(_remaining: number): void { this.action(); }
}

/** Retained child props update as discovery enriches the same composite key. */
@Component
struct SourceSwitchLiveRow {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @Prop candidate: SourceSwitchCandidate;
  @Prop rowEnabled: boolean = true;
  @Prop switching: boolean = false;
  @Prop pendingProbe: boolean = false;
  @Prop searching: boolean = false;
  onSelect: () => void = (): void => {};
  onPress: () => void = (): void => {};

  private latencyText(): string {
    if (this.switching) return '切换中…';
    if (this.candidate.isCurrent === true) return '当前';
    if (this.pendingProbe) return this.searching ? '重测中' : '待重测';
    if (this.candidate.timeout === true) return '超时';
    if (this.candidate.offline === true) return '离线';
    const latency = this.candidate.latencyMs;
    // Search success/latency never claims catalog or body readability.
    if (this.candidate.latencyKind === 'search' && latency !== undefined && Number.isFinite(latency) && latency >= 0) {
      return `${Math.round(latency)} ms`;
    }
    return '待检测';
  }

  private chapterText(): string {
    const latest = this.candidate.latestChapterTitle?.trim() ?? '';
    if (latest.length > 0) return `最新 ${latest}`;
    if (this.candidate.acquisitionState === 'failed' || this.candidate.acquisitionState === 'attemptFailed') {
      return this.candidate.acquisitionMessage?.trim() || '上次读取失败，可重新尝试';
    }
    const chapter = this.candidate.currentChapterTitle?.trim() ?? '';
    if (chapter.length > 0) return chapter;
    if (this.candidate.acquisitionState === 'catalogReady') return '目录已就绪';
    if (this.candidate.acquisitionState === 'readable') return '已验证章节可读';
    if (this.candidate.acquisitionState === 'stale') return '已保留来源，等待更新';
    return '已发现，等待解析';
  }

  build() {
    Row({ space: 10 }) {
      Column({ space: 6 }) {
        Text(this.candidate.sourceName || this.candidate.sourceId).fontFamily('ReaderNotoSansSC')
          .fontWeight(FontWeight.Medium).fontSize(15).fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
          .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
        Text(this.chapterText()).fontFamily('ReaderNotoSansSC').fontWeight(FontWeight.Regular).fontSize(10)
          .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
          .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
      }.alignItems(HorizontalAlign.Start).layoutWeight(1);
      Text() {
        if (!this.switching && !this.pendingProbe && this.candidate.latencyKind === 'search' &&
          this.candidate.latencyMs !== undefined && Number.isFinite(this.candidate.latencyMs) && this.candidate.latencyMs >= 0) {
          Span(`${Math.round(this.candidate.latencyMs)}`).fontSize(17).fontColor(readerAppColor('TOK_GREEN', this.appThemeScheme));
          Span(' ms').fontSize(9).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
        } else {
          Span(this.latencyText()).fontSize(11).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
        }
      }.fontFamily('ReaderInter').fontWeight(FontWeight.Regular).width(64).textAlign(TextAlign.End).maxLines(1);
      Image(this.appThemeScheme === 'night' ? $r('app.media.reader_chevron_right_theme_night') : $r('app.media.reader_chevron_right'))
        .width(14).height(14);
    }.width('100%').height(80).padding({ left: 18, right: 18, top: 12, bottom: 12 })
      .backgroundColor(readerAppColor(this.candidate.isCurrent === true || this.switching ? 'TOK_PRIMARY_SOFT' : 'TOK_PAPER', this.appThemeScheme))
      .border({ width: { bottom: 0.5 }, color: readerAppColor('TOK_ROW_DIVIDER', this.appThemeScheme) })
      .enabled(this.rowEnabled && this.candidate.isCurrent !== true).accessibilityGroup(true)
      .accessibilityText(`${this.candidate.sourceName || this.candidate.sourceId}，${this.chapterText()}，${this.latencyText()}`)
      .onTouch((event: TouchEvent): void => { if (event.type === TouchType.Down) this.onPress(); })
      .onClick((): void => this.onSelect());
  }
}

/** Full-screen source picker shared by the real reading/detail entrances.
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
  // Manga uses the visual source-switch copy from the isolated UI demo. Text
  // reading keeps the existing generic wording and state semantics.
  @Prop contentKind: string = 'text';
  @Prop reduceMotion: boolean = false;
  @Prop consumeTopInset: boolean = true;
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
  @State private statusHeight: number = 0;
  private listMounted: boolean = false;
  private reorderTimer: number = -1;
  private presentationEpoch: number = 0;
  private anchorEpoch: number = 0;
  private restoringAnchor: boolean = false;
  private readonly candidateScroller: Scroller = new Scroller();

  aboutToAppear(): void {
    this.mounted = true;
    registerReaderFonts(this.getUIContext().getFont());
    this.acceptState();
  }
  aboutToDisappear(): void { this.mounted = false; this.cancelPresentation(); }
  private coverChanged(): void { this.coverFailed = false; }
  private foregroundChanged(): void {
    if (!this.foreground) this.cancelPresentation();
    else if (this.mounted) this.acceptState();
  }
  private cancelPresentation(): void {
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
  private acceptState(): void {
    if (this.state.kind !== 'switching') this.selectionPending = false;
    if (this.state.kind !== 'candidates') {
      this.wasRefreshing = false;
      if (this.state.kind === 'empty') {
        this.cancelPresentation();
        this.displayedCandidates = [];
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
    // Metadata and discoveries update immediately. Existing row positions stay
    // stable until idle; the gateway's incoming order is then applied verbatim.
    const incoming = new Map<string, SourceSwitchCandidate>();
    for (const candidate of this.latestCandidates) incoming.set(this.candidateKey(candidate), candidate);
    const retained: SourceSwitchCandidate[] = [];
    for (const previous of this.displayedCandidates) {
      const current = incoming.get(this.candidateKey(previous));
      if (current !== undefined) { retained.push(current); incoming.delete(this.candidateKey(previous)); }
      else if (this.touching || this.scrolling) retained.push(previous);
    }
    for (const candidate of incoming.values()) retained.push(candidate);
    this.displayedCandidates = retained;
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
    }, 220);
  }
  private publishOrder(): void {
    if (this.state.kind !== 'candidates') return;
    const next = this.latestCandidates.slice();
    if (next.length === this.displayedCandidates.length && next.every((candidate: SourceSwitchCandidate, index: number): boolean =>
      this.candidateKey(candidate) === this.candidateKey(this.displayedCandidates[index]))) return;
    let anchorKey: string = '';
    let itemY: number = 0;
    if (this.listMounted && this.candidateScroller.currentOffset().yOffset > 0 && this.firstVisibleListIndex >= 2) {
      const first = this.displayedCandidates[this.firstVisibleIndex];
      if (first !== undefined) {
        anchorKey = this.candidateKey(first);
        try { itemY = this.candidateScroller.getItemRect(this.firstVisibleIndex + 2).y; }
        catch (_error) { itemY = this.firstVisibleIndex * 80 + this.listStartInset() + this.contextHeight + this.statusHeight - this.candidateScroller.currentOffset().yOffset; }
      }
    }
    if (anchorKey.length > 0) {
      this.displayedCandidates = next;
      this.restoreAnchor(anchorKey, Math.max(-79, Math.min(0, Number.isFinite(itemY) ? itemY : 0)));
    } else {
      this.getUIContext().animateTo({ duration: this.reduceMotion ? 0 : 220, curve: Curve.EaseInOut }, (): void => { this.displayedCandidates = next; });
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
      this.candidateScroller.scrollToIndex(index + 2, false, ScrollAlign.START);
      this.getUIContext().postFrameCallback(new SourceSwitchLayoutFrame((): void => {
        if (!current()) return;
        const actual = this.displayedCandidates.findIndex((candidate: SourceSwitchCandidate): boolean => this.candidateKey(candidate) === key);
        if (actual >= 0) {
          try {
            const rect = this.candidateScroller.getItemRect(actual + 2);
            if (!Number.isFinite(rect.y) || rect.height <= 0) throw new Error('anchor not laid out');
            this.candidateScroller.scrollBy(0, rect.y - itemY);
          } catch (_error) {
            if (attempt < 2) { this.restoreAnchor(key, itemY, attempt + 1); return; }
            this.candidateScroller.scrollTo({ xOffset: 0, yOffset: actual * 80 + this.listStartInset() + this.contextHeight + this.statusHeight - itemY });
          }
          this.firstVisibleIndex = Math.max(0, Math.floor((this.candidateScroller.currentOffset().yOffset - this.listStartInset() - this.contextHeight - this.statusHeight) / 80));
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
  private rollbackRequired(): boolean { return this.state.kind === 'failure' && this.state.transactionId !== undefined; }
  private requestRefresh(): void {
    if (this.busy() || this.rollbackRequired()) return;
    if (this.isSweeping()) this.onStop();
    else if (this.state.kind === 'candidates') this.onRefresh();
    else this.onRetry();
  }
  private statusText(): string {
    const count = sourceSwitchSourceCount(this.displayedCandidates);
    if (this.isSweeping()) return this.contentKind === 'manga' ? `正在查找 · 已发现 ${count} 个` : `正在查找 · ${count} 个来源`;
    if (this.busy()) return '正在切换书源…';
    if (this.state.kind === 'success') return '已切换书源';
    if (this.state.kind === 'failure') return '换源失败';
    if (this.state.kind === 'discoveryError') return '查找失败';
    if ((this.state.kind === 'candidates' || this.state.kind === 'empty') && this.state.stopped === true) {
      return this.contentKind === 'manga' ? `已停止 · 已发现 ${count} 个` : `已停止 · ${count} 个来源`;
    }
    return this.contentKind === 'manga' ? `查找完成 · 已发现 ${count} 个` : `查找完成 · ${count} 个来源`;
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
  private header() {
    Stack({ alignContent: Alignment.Center }) {
      Text('更换书源').fontFamily('ReaderNotoSerifSCBold').fontWeight(FontWeight.Bold).fontSize(18)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme)).maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis }).width('66%').textAlign(TextAlign.Center);
      Row() {
        Button({ type: ButtonType.Normal }) {
          Image(this.appThemeScheme === 'night' ? $r('app.media.source_switch_close_theme_night') : $r('app.media.source_switch_close'))
            .width(20).height(20);
        }.width(44).height(44).backgroundColor(Color.Transparent)
          .accessibilityText('返回').enabled(!this.busy() && !this.rollbackRequired()).onClick((): void => this.onClose());
        Blank().layoutWeight(1);
        Button(this.isSweeping() ? '停止' : '重查', { type: ButtonType.Normal })
          .width(44).height(44).fontSize(11).fontColor(readerAppColor('TOK_GREEN', this.appThemeScheme))
          .backgroundColor(Color.Transparent).padding(0)
          .enabled(!this.busy() && !this.rollbackRequired()).onClick((): void => this.requestRefresh());
      }.width('100%').height(44);
    }.width('100%').height(52).padding(3)
      .backgroundColor(readerAppColor('TOK_CARD_BG', this.appThemeScheme))
      .border({ width: 1, color: readerAppColor('TOK_BORDER', this.appThemeScheme) }).borderRadius(18)
      .hitTestBehavior(HitTestMode.Transparent);
  }
  @Builder
  private bookContext() {
    Row({ space: 12 }) {
      if (this.coverUrl.trim().length > 0 && !this.coverFailed) {
        Image(this.coverUrl).width(48).height(72).objectFit(ImageFit.Cover).borderRadius(3)
          .onError((): void => { this.coverFailed = true; });
      } else {
        NoCoverCover({ coverWidth: 48, coverHeight: 72 });
      }
      Column({ space: 5 }) {
        Text(this.bookTitle || '当前书籍').fontFamily('ReaderNotoSerifSCBold').fontWeight(FontWeight.Bold).fontSize(21)
          .fontColor(readerAppColor('TOK_INK', this.appThemeScheme)).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
        Text([this.author, this.currentSourceName.length > 0 ? `当前来源：${this.currentSourceName}` : ''].filter((text: string): boolean => text.length > 0).join(' · '))
          .fontFamily('ReaderNotoSansSC').fontSize(12).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
          .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
        if (this.currentChapterTitle.length > 0) {
          Text(`正在读 ${this.currentChapterTitle}`).fontFamily('ReaderNotoSansSC').fontSize(12)
            .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme)).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
        }
      }.alignItems(HorizontalAlign.Start).layoutWeight(1);
    }.width('100%').padding({ left: 18, right: 18, top: 2, bottom: 22 })
      .border({ width: { bottom: 0.5 }, color: readerAppColor('TOK_ROW_DIVIDER', this.appThemeScheme) });
  }
  @Builder
  private discoveryStatus() {
    Column({ space: 12 }) {
      Row({ space: 7 }) {
        // Discovery updates preserve the mounted spinner and its real owner state.
        SearchSpinner({ active: this.isSweeping() && this.foreground, diameter: 13, reduceMotion: this.reduceMotion });
        Text(this.statusText()).fontFamily('ReaderNotoSansSC').fontSize(11)
          .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme)).layoutWeight(1);
        if (this.contentKind === 'manga') {
          Text('延迟优先').fontFamily('ReaderNotoSansSC').fontSize(10)
            .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
        } else {
          Text('搜索延迟').fontFamily('ReaderNotoSansSC').fontSize(10)
            .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
        }
      }.width('100%').height(28);
      Text('其他来源').fontFamily('ReaderNotoSansSC').fontSize(11)
        .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme)).width('100%');
    }.width('100%').padding({ left: 18, right: 18, top: 12, bottom: 4 });
  }
  @Builder
  private candidateList() {
    Stack({ alignContent: Alignment.Top }) {
      List({ scroller: this.candidateScroller }) {
        ListItem() { this.bookContext(); }
          .onAreaChange((_old: Area, area: Area): void => { const height = Number(area.height); if (Number.isFinite(height) && height > 0) this.contextHeight = height; })
        ListItem() { this.discoveryStatus(); }
          .onAreaChange((_old: Area, area: Area): void => { const height = Number(area.height); if (Number.isFinite(height) && height > 0) this.statusHeight = height; })
        Repeat(this.displayedCandidates)
          .each((repeatItem: RepeatItem<SourceSwitchCandidate>) => {
            ListItem() {
              SourceSwitchLiveRow({ candidate: repeatItem.item,
                rowEnabled: this.state.kind === 'candidates' && !this.busy(),
                switching: this.busy() && this.selectedKey === this.candidateKey(repeatItem.item),
                pendingProbe: this.retestingKeys.indexOf(this.candidateKey(repeatItem.item)) >= 0,
                searching: this.isSweeping(),
                onPress: (): void => { this.heldKey = this.candidateKey(repeatItem.item); },
                onSelect: (): void => this.selectCandidate(this.candidateKey(repeatItem.item)) });
            }
          })
          .key((candidate: SourceSwitchCandidate): string => sourceSwitchCandidateKey(candidate.sourceId, candidate.bookUrl))
          .virtualScroll({ reusable: true });
      }.width('100%').height('100%').scrollBar(BarState.Off)
        .contentStartOffset(this.listStartInset()).contentEndOffset(this.safeBottom() + 20)
        .onTouch((event: TouchEvent): void => this.listTouch(event))
        .onScrollStart((): void => { if (!this.restoringAnchor) this.scrolling = true; })
        .onScrollStop((): void => { if (!this.restoringAnchor) { this.scrolling = false; this.queueReorder(); } })
        .onScrollIndex((start: number): void => { this.firstVisibleListIndex = start; this.firstVisibleIndex = Math.max(0, start - 2); })
        .onAppear((): void => { this.listMounted = true; })
        .onDisAppear((): void => { this.listMounted = false; this.anchorEpoch += 1; });
      if (this.displayedCandidates.length === 0) {
        Column({ space: 8 }) {
          Text(this.isSweeping() ? '正在查找其他来源…' : this.state.kind === 'empty' && this.state.stopped !== true ? '未找到其他来源' : this.statusText())
            .fontFamily('ReaderNotoSansSC').fontSize(15).fontColor(readerAppColor('TOK_INK', this.appThemeScheme));
          Text(this.isSweeping() ? '找到后会陆续显示，可直接点选' : '可重新查找，或返回继续阅读')
            .fontFamily('ReaderNotoSansSC').fontSize(12).fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme));
        }.width('100%').padding({ left: 18, right: 18, top: this.listStartInset() + this.contextHeight + this.statusHeight + 24 }).hitTestBehavior(HitTestMode.None);
      }
    }.layoutWeight(1).width('100%');
  }
  @Builder
  private recoveryNotice() {
    if (this.errorText().length > 0 || this.rollbackRequired()) {
      Column({ space: 8 }) {
        Text(this.errorText()).fontFamily('ReaderNotoSansSC').fontSize(12)
          .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme)).width('100%')
          .maxLines(3).textOverflow({ overflow: TextOverflow.Ellipsis });
        Button(this.rollbackRequired() ? '撤销切换' : '重试', { type: ButtonType.Normal })
          .height(40).fontSize(13).fontColor(readerAppColor('TOK_GREEN', this.appThemeScheme))
          .backgroundColor(readerAppColor('TOK_PRIMARY_SOFT', this.appThemeScheme)).borderRadius(8)
          .onClick((): void => { if (this.rollbackRequired()) this.onRollback(); else this.requestRefresh(); });
      }.width('100%').padding({ left: 18, right: 18, top: 10, bottom: 12 })
        .border({ width: { top: 0.5 }, color: readerAppColor('TOK_ROW_DIVIDER', this.appThemeScheme) });
    }
  }
  private listStartInset(): number { return this.safeTop() + 76; }
  build() {
    Stack({ alignContent: Alignment.Top }) {
      Column() {
        this.candidateList();
        this.recoveryNotice();
      }.width('100%').height('100%');
      Row() { this.header(); }
        .width('100%').padding({ left: this.safeLeft() + 16, right: this.safeRight() + 16 })
        .margin({ top: this.safeTop() + 8 }).hitTestBehavior(HitTestMode.Transparent);
    }.width('100%').height('100%').backgroundColor(readerAppColor('TOK_PAPER', this.appThemeScheme));
  }
}
