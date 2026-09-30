// Local UI demo, admitted by the DEBUG-only EntryAbility route. All displayed
// sources, timings and switching outcomes are fixtures, never Reader data.
import { FrameCallback } from '@kit.ArkUI';
import { ReaderWindowCoordinator } from '../app/ReaderWindowCoordinator';
import { registerReaderFonts } from '../features/common/ReaderFonts';
import { readerContentSafeTop, readerInteractiveSafeBottom, readerVisualSafeLeft,
  readerVisualSafeRight } from '../features/common/ReaderWindowMetrics';
import { SearchSpinner } from '../features/search/SearchSpinner';
import { compareSourceSwitchDemo, sourceSwitchDemoEvents, type SourceSwitchDemoEvent,
  type SourceSwitchDemoMedia, type SourceSwitchDemoProbe, type SourceSwitchDemoSortable }
  from '../features/sourceSwitchDemo/SourceSwitchDemoFixture';

const DEMO_PAPER: string = '#F8F4EC';
const DEMO_INK: string = '#1F1B17';
const DEMO_GREEN: string = '#2D4A3E';
const DEMO_MUTED: string = '#756F69';
const DEMO_LINE: string = '#E2DBD1';

class DemoListLayoutFrame extends FrameCallback {
  private action: () => void;
  constructor(action: () => void) { super(); this.action = action; }
  onFrame(_time: number): void {}
  onIdle(_remaining: number): void { this.action(); }
}

@Observed
class DemoSourceRow implements SourceSwitchDemoSortable {
  sourceId: string;
  name: string;
  latest: string;
  latencyMs: number;
  probe: SourceSwitchDemoProbe = 'ready';
  arrival: number;

  constructor(event: SourceSwitchDemoEvent, arrival: number) {
    this.sourceId = event.sourceId;
    this.name = event.name;
    this.latest = event.latest;
    this.latencyMs = event.latencyMs;
    this.arrival = arrival;
  }
}

@Component
struct DemoSourceListRow {
  @ObjectLink row: DemoSourceRow;
  @Prop selected: boolean = false;
  @Prop switching: boolean = false;
  @Prop disabled: boolean = false;
  onSelect: (sourceId: string) => void = (): void => {};
  onPress: (sourceId: string) => void = (): void => {};

  private timing(): string {
    if (this.selected) return this.switching ? '切换中…' : '已选择';
    if (this.row.probe === 'retesting') return '重测中';
    if (this.row.probe === 'stale') return '待重测';
    return `${this.row.latencyMs} ms`;
  }

  build() {
    Row({ space: 12 }) {
      Column({ space: 5 }) {
        Text(this.row.name).fontFamily('ReaderNotoSansSC').fontSize(15).fontWeight(FontWeight.Medium)
          .fontColor(DEMO_INK).maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
        Text(this.row.latest).fontFamily('ReaderNotoSansSC').fontSize(12).fontColor(DEMO_MUTED)
          .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis });
      }.alignItems(HorizontalAlign.Start).layoutWeight(1);
      Text(this.timing()).fontFamily('ReaderInter').fontSize(12)
        .fontColor(this.row.probe === 'ready' || this.selected ? DEMO_GREEN : DEMO_MUTED)
        .width(72).textAlign(TextAlign.End).maxLines(1);
    }
    // This demo deliberately holds row geometry at 70 vp. Variable-height,
    // enlarged-type presentation needs its own layout acceptance.
    .width('100%').height(70).padding({ left: 18, right: 18, top: 13, bottom: 13 })
    .backgroundColor(this.selected ? '#172D4A3E' : DEMO_PAPER)
    .border({ width: { bottom: 0.5 }, color: DEMO_LINE })
    .enabled(!this.disabled)
    .accessibilityGroup(true)
    .accessibilityText(`${this.row.name}，${this.row.latest}，${this.timing()}`)
    .onTouch((event: TouchEvent): void => {
      if (event.type === TouchType.Down) this.onPress(this.row.sourceId);
    })
    .onClick((): void => this.onSelect(this.row.sourceId));
  }
}

@Entry
@Preview
@Component
struct SourceSwitchDemo {
  @StorageLink('readerWindowMetricsRevision') private windowRevision: number = 0;
  @StorageLink('readerAppForeground') @Watch('foregroundChanged') private foreground: boolean = true;
  @State private media: SourceSwitchDemoMedia = 'novel';
  @State private emptyScenario: boolean = false;
  @State private rows: DemoSourceRow[] = [];
  @State private searching: boolean = false;
  @State private status: string = '正在查找';
  @State private selectedId: string = '';
  @State private switching: boolean = false;
  @State private notice: string = '仅模拟来源与延迟，不改动真实书架和阅读进度';
  @State private reduceMotion: boolean = false;
  private sourceRows: Map<string, DemoSourceRow> = new Map();
  private timers: number[] = [];
  private reorderTimer: number = -1;
  private generation: number = 0;
  private round: number = 0;
  private mounted: boolean = false;
  private visible: boolean = false;
  private touching: boolean = false;
  private scrolling: boolean = false;
  private listReady: boolean = false;
  private firstVisibleIndex: number = 0;
  private anchorEpoch: number = 0;
  private restoringAnchor: boolean = false;
  private heldSourceId: string = '';
  private reorderPending: boolean = false;
  private readonly listScroller: Scroller = new Scroller();

  aboutToAppear(): void {
    this.mounted = true;
    this.visible = true;
    registerReaderFonts(this.getUIContext().getFont());
    ReaderWindowCoordinator.requestAppChrome();
    this.startSearch(true);
  }

  onPageShow(): void { this.visible = true; }

  onPageHide(): void {
    this.visible = false;
    this.stopWork('查找已暂停');
  }

  aboutToDisappear(): void {
    this.mounted = false;
    this.visible = false;
    this.stopWork('查找已停止');
  }

  onBackPress(): boolean {
    this.visible = false;
    this.stopWork('查找已停止');
    return false;
  }

  private foregroundChanged(): void {
    if (!this.foreground) this.stopWork('查找已暂停');
  }

  private cancelTimers(): void {
    this.generation += 1;
    this.anchorEpoch += 1;
    this.restoringAnchor = false;
    for (const timer of this.timers) clearTimeout(timer);
    this.timers = [];
    if (this.reorderTimer >= 0) clearTimeout(this.reorderTimer);
    this.reorderTimer = -1;
  }

  private stopWork(label: string): void {
    if (this.switching) {
      this.selectedId = '';
      this.notice = '模拟切换已取消，真实书源和进度未变更';
    }
    this.cancelTimers();
    this.searching = false;
    this.status = label;
    this.switching = false;
    this.touching = false;
    this.scrolling = false;
    this.heldSourceId = '';
    for (const row of this.sourceRows.values()) {
      if (row.probe === 'retesting') row.probe = 'stale';
    }
  }

  private schedule(delay: number, action: () => void): void {
    const generation = this.generation;
    this.timers.push(setTimeout((): void => {
      if (!this.mounted || !this.visible || !this.foreground || generation !== this.generation) return;
      action();
    }, delay));
  }

  private startSearch(fromZero: boolean): void {
    this.cancelTimers();
    this.selectedId = '';
    this.switching = false;
    this.touching = false;
    this.scrolling = false;
    this.heldSourceId = '';
    this.reorderPending = false;
    this.notice = '仅模拟来源与延迟，不改动真实书架和阅读进度';
    if (fromZero) {
      this.sourceRows.clear();
      this.rows = [];
      if (this.listReady) this.listScroller.scrollTo({ xOffset: 0, yOffset: 0 });
    } else {
      for (const row of this.sourceRows.values()) row.probe = 'retesting';
    }
    this.searching = true;
    this.status = '正在查找';
    if (!this.foreground || !this.visible) {
      this.stopWork('查找已暂停');
      return;
    }
    this.round += 1;
    if (this.emptyScenario) {
      this.schedule(4200, (): void => this.finishSearch());
      return;
    }
    for (const event of sourceSwitchDemoEvents(this.media, this.round)) {
      this.schedule(event.atMs, (): void => this.acceptSource(event));
    }
    this.schedule(12800, (): void => this.finishSearch());
  }

  private finishSearch(): void {
    this.searching = false;
    this.status = this.rows.length === 0 ? '未找到可用来源' : '查找完成';
    this.queueReorder();
  }

  private acceptSource(event: SourceSwitchDemoEvent): void {
    if (!Number.isFinite(event.latencyMs) || event.latencyMs <= 0) return;
    const retained = this.sourceRows.get(event.sourceId);
    if (retained === undefined) {
      const row = new DemoSourceRow(event, this.sourceRows.size);
      this.sourceRows.set(event.sourceId, row);
      // Arrivals remain visible while sorting is briefly deferred for touch.
      this.rows = this.rows.concat([row]);
    } else {
      retained.latest = event.latest;
      retained.latencyMs = event.latencyMs;
      retained.probe = 'ready';
    }
    this.queueReorder();
  }

  private queueReorder(): void {
    this.reorderPending = true;
    if (this.reorderTimer >= 0) clearTimeout(this.reorderTimer);
    this.reorderTimer = -1;
    if (this.touching || this.scrolling || this.switching || this.restoringAnchor) return;
    const generation = this.generation;
    this.reorderTimer = setTimeout((): void => {
      this.reorderTimer = -1;
      if (!this.mounted || !this.visible || !this.foreground || generation !== this.generation ||
        this.touching || this.scrolling || this.switching) return;
      this.heldSourceId = '';
      this.publishOrder();
    }, 240);
  }

  private publishOrder(): void {
    if (!this.reorderPending) return;
    this.reorderPending = false;
    const next = this.rows.slice().sort(compareSourceSwitchDemo);
    if (next.every((row: DemoSourceRow, index: number): boolean => row.sourceId === this.rows[index].sourceId)) return;
    let anchorId: string = '';
    let anchorY: number = 0;
    if (this.listReady && this.listScroller.currentOffset().yOffset > 0) {
      const first = this.rows[this.firstVisibleIndex];
      if (first !== undefined) {
        anchorId = first.sourceId;
        try { anchorY = this.listScroller.getItemRect(this.firstVisibleIndex).y; }
        catch (_error) { anchorY = this.firstVisibleIndex * 70 - this.listScroller.currentOffset().yOffset; }
      }
    }
    if (anchorId.length > 0) {
      // Follow SearchPage's native two-layout restore. Identity survives the
      // reorder; numeric indices are resolved anew after each layout pass.
      this.rows = next;
      this.restoreAnchor(anchorId, Math.max(-69, Math.min(0, anchorY)));
      return;
    }
    this.getUIContext().animateTo({ duration: this.reduceMotion ? 0 : 220, curve: Curve.EaseInOut }, (): void => {
      this.rows = next;
    });
  }

  private restoreAnchor(sourceId: string, itemY: number): void {
    const anchorEpoch = ++this.anchorEpoch;
    const generation = this.generation;
    this.restoringAnchor = true;
    const current = (): boolean => this.mounted && this.visible && this.foreground && this.listReady &&
      generation === this.generation && anchorEpoch === this.anchorEpoch && !this.touching;
    this.getUIContext().postFrameCallback(new DemoListLayoutFrame((): void => {
      if (!current()) return;
      const index = this.rows.findIndex((row: DemoSourceRow): boolean => row.sourceId === sourceId);
      if (index < 0) { this.restoringAnchor = false; return; }
      this.listScroller.scrollToIndex(index, false, ScrollAlign.START);
      this.getUIContext().postFrameCallback(new DemoListLayoutFrame((): void => {
        if (!current()) return;
        const actual = this.rows.findIndex((row: DemoSourceRow): boolean => row.sourceId === sourceId);
        if (actual >= 0) {
          // List may clamp at its content edge; otherwise restore the exact
          // visible portion. This fixed-height ForEach needs no lazy retry.
          try {
            const rect = this.listScroller.getItemRect(actual);
            if (Number.isFinite(rect.y) && rect.height > 0) this.listScroller.scrollBy(0, rect.y - itemY);
            else this.listScroller.scrollTo({ xOffset: 0, yOffset: actual * 70 - itemY });
          } catch (_error) {
            this.listScroller.scrollTo({ xOffset: 0, yOffset: actual * 70 - itemY });
          }
          this.firstVisibleIndex = Math.max(0, Math.floor(this.listScroller.currentOffset().yOffset / 70));
        }
        this.restoringAnchor = false;
        if (this.reorderPending) this.queueReorder();
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
      if (event.type === TouchType.Cancel) this.heldSourceId = '';
      this.queueReorder();
    }
  }

  private selectSource(sourceId: string): void {
    if (this.switching || this.scrolling || (this.heldSourceId.length > 0 && this.heldSourceId !== sourceId)) return;
    const row = this.sourceRows.get(sourceId);
    if (row === undefined) return;
    this.stopWork('查找已停止');
    this.selectedId = sourceId;
    this.switching = true;
    this.notice = `正在模拟切换到「${row.name}」…`;
    this.schedule(650, (): void => {
      this.switching = false;
      this.status = '模拟切换完成';
      this.notice = `已模拟选择「${row.name}」，真实书源和进度未变更`;
    });
  }

  private changeMedia(media: SourceSwitchDemoMedia): void {
    this.media = media;
    this.startSearch(true);
  }

  private safeTop(): number {
    return this.windowRevision < 0 ? 0 : readerContentSafeTop(ReaderWindowCoordinator.metrics());
  }

  private safeBottom(): number {
    return this.windowRevision < 0 ? 0 : readerInteractiveSafeBottom(ReaderWindowCoordinator.metrics());
  }

  @Builder
  private header() {
    Row() {
      Button('‹', { type: ButtonType.Normal }).width(40).height(44).fontSize(30).fontColor(DEMO_INK)
        .backgroundColor(Color.Transparent).accessibilityText('返回')
        .onClick((): void => {
          this.visible = false;
          this.stopWork('查找已停止');
          this.getUIContext().getRouter().back();
        });
      Text('更换书源').fontFamily('ReaderNotoSerifSCBold').fontSize(20).fontColor(DEMO_INK).layoutWeight(1);
      Button(this.searching ? '停止' : '重新查找', { type: ButtonType.Normal })
        .height(40).fontSize(13).fontColor(DEMO_GREEN).backgroundColor(Color.Transparent)
        .padding({ left: 8, right: 8 }).enabled(!this.switching)
        .onClick((): void => {
          if (this.searching) this.stopWork('查找已停止');
          else this.startSearch(false);
        });
    }.width('100%').height(56).padding({ left: 4, right: 10 });
  }

  @Builder
  private bookContext() {
    Row({ space: 12 }) {
      Column({ space: 3 }) {
        Text(this.media === 'novel' ? '山河' : '风起').fontFamily('ReaderNotoSerifSCBold').fontSize(15).fontColor('#F8F4EC');
        Text(this.media === 'novel' ? '入梦' : '之时').fontFamily('ReaderNotoSerifSCBold').fontSize(15).fontColor('#F8F4EC');
      }.width(43).height(60).justifyContent(FlexAlign.Center).backgroundColor(DEMO_GREEN).borderRadius(3);
      Column({ space: 5 }) {
        Text(this.media === 'novel' ? '山河入梦' : '风起之时').fontFamily('ReaderNotoSerifSCBold')
          .fontSize(17).fontColor(DEMO_INK);
        Text(this.media === 'novel' ? '林间 · 当前来源：青禾书屋' : '山川 · 当前来源：青禾漫画')
          .fontSize(12).fontColor(DEMO_MUTED);
        Text(this.media === 'novel' ? '正在读 第128章 · 故人来' : '正在读 第76话 · 新的旅程')
          .fontSize(12).fontColor(DEMO_MUTED);
      }.alignItems(HorizontalAlign.Start).layoutWeight(1);
    }.width('100%').padding({ left: 18, right: 18, top: 6, bottom: 18 });
  }

  @Builder
  private discoveryStatus() {
    Row({ space: 7 }) {
      // The spinner remains mounted for every phase and every result count.
      SearchSpinner({ active: this.searching && this.visible, diameter: 13, reduceMotion: this.reduceMotion });
      Text(`${this.status} · ${this.rows.length} 个`).fontSize(12).fontColor(DEMO_MUTED).layoutWeight(1);
      Text('延迟优先').fontSize(12).fontColor(DEMO_MUTED);
    }.height(38).width('100%').padding({ left: 18, right: 18 })
      .border({ width: { top: 0.5, bottom: 0.5 }, color: DEMO_LINE });
  }

  @Builder
  private sourceList() {
    Stack({ alignContent: Alignment.Top }) {
      List({ scroller: this.listScroller }) {
        ForEach(this.rows, (row: DemoSourceRow) => {
          ListItem() {
            DemoSourceListRow({ row, selected: this.selectedId === row.sourceId, switching: this.switching,
              disabled: this.switching, onSelect: (sourceId: string): void => this.selectSource(sourceId),
              onPress: (sourceId: string): void => { this.heldSourceId = sourceId; } });
          }
        }, (row: DemoSourceRow): string => row.sourceId);
      }.width('100%').height('100%').scrollBar(BarState.Off)
        .onTouch((event: TouchEvent): void => this.listTouch(event))
        .onScrollStart((): void => { if (!this.restoringAnchor) this.scrolling = true; })
        .onScrollStop((): void => {
          if (!this.restoringAnchor) { this.scrolling = false; this.queueReorder(); }
        })
        .onScrollIndex((start: number): void => { this.firstVisibleIndex = Math.max(0, start); })
        .onAppear((): void => { this.listReady = true; })
        .onDisAppear((): void => { this.listReady = false; });
      if (this.rows.length === 0) {
        Column({ space: 8 }) {
          Text(this.searching ? '正在查找其他来源…' : this.status)
            .fontSize(15).fontColor(DEMO_INK);
          Text(this.searching ? '找到后会陆续显示，可直接点选' : '可重新查找，或在下方切换演示场景')
            .fontSize(12).fontColor(DEMO_MUTED);
        }.width('100%').padding({ top: 48, left: 18, right: 18 }).hitTestBehavior(HitTestMode.None);
      }
    }.layoutWeight(1).width('100%');
  }

  @Builder
  private demoControls() {
    Column({ space: 8 }) {
      Text(this.notice).fontSize(11).fontColor(DEMO_MUTED).width('100%').maxLines(2);
      Row({ space: 6 }) {
        Text('DEMO').fontFamily('ReaderInter').fontSize(10).fontColor(DEMO_MUTED).margin({ right: 4 });
        Button('小说', { type: ButtonType.Normal }).fontSize(12).height(30).borderRadius(5)
          .backgroundColor(this.media === 'novel' ? '#172D4A3E' : Color.Transparent).fontColor(DEMO_GREEN)
          .padding({ left: 10, right: 10 }).onClick((): void => this.changeMedia('novel'));
        Button('漫画', { type: ButtonType.Normal }).fontSize(12).height(30).borderRadius(5)
          .backgroundColor(this.media === 'manga' ? '#172D4A3E' : Color.Transparent).fontColor(DEMO_GREEN)
          .padding({ left: 10, right: 10 }).onClick((): void => this.changeMedia('manga'));
        Blank();
        Button('从零重播', { type: ButtonType.Normal }).fontSize(12).height(30).fontColor(DEMO_GREEN)
          .backgroundColor(Color.Transparent).padding({ left: 4, right: 4 })
          .onClick((): void => this.startSearch(true));
      }.width('100%');
      Row({ space: 8 }) {
        Checkbox({ name: 'empty' }).select(this.emptyScenario).width(16).height(16).selectedColor(DEMO_GREEN)
          .onChange((selected: boolean): void => { this.emptyScenario = selected; this.startSearch(true); });
        Text('无结果场景').fontSize(11).fontColor(DEMO_MUTED);
        Blank();
        Checkbox({ name: 'motion' }).select(this.reduceMotion).width(16).height(16).selectedColor(DEMO_GREEN)
          .onChange((selected: boolean): void => { this.reduceMotion = selected; });
        Text('减少动态效果').fontSize(11).fontColor(DEMO_MUTED);
      }.width('100%').height(28);
    }.width('100%').padding({ left: 18, right: 18, top: 12, bottom: 8 })
      .border({ width: { top: 0.5 }, color: DEMO_LINE }).backgroundColor(DEMO_PAPER);
  }

  build() {
    Column() {
      this.header();
      this.bookContext();
      this.discoveryStatus();
      this.sourceList();
      this.demoControls();
    }.width('100%').height('100%').backgroundColor(DEMO_PAPER)
      .padding({ top: this.safeTop(), bottom: this.safeBottom(),
        left: readerVisualSafeLeft(ReaderWindowCoordinator.metrics()),
        right: readerVisualSafeRight(ReaderWindowCoordinator.metrics()) });
  }
}
