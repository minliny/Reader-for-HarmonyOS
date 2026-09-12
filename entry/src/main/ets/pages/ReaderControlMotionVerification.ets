// Diagnostic page, admitted only by EntryAbility's explicit DEBUG cold-start
// gate. Packaged through the normal pipeline; this is local component evidence,
// not a replacement for the production reader or business/visual acceptance.
import curves from '@ohos.curves';
import {
  backReaderControlSession, collapseReaderControlSession, copyReaderControlSessionState,
  createReaderControlSessionState,
  dismissReaderControlSession, enterReaderControlModule, openReaderControlSession,
  readerControlContentLocation, sampleReaderControlSession, setReaderControlDirectoryTab,
  type ReaderControlSessionState,
} from '../features/reading/ReaderControlSessionState';
import { ReaderControlMotionStage } from '../features/reading/ReaderControlMotionStage';
import { createReaderControlBackdropTouchState, reduceReaderControlBackdropTouch,
  type ReaderControlBackdropTouchState, type ReaderControlBackdropTouchEvent,
  type ReaderControlBackdropRect } from '../features/reading/ReaderControlBackdropTouch';
import { readerControlMotionBounds, sampleReaderControlMotionComposition, sampleReaderControlWholeVisibility, type ReaderControlMotionFrame,
  type ReaderControlVisibilityActor } from '../features/reading/ReaderControlMotionGeometry';
import { FullDirectoryPanel } from '../features/reading/FullDirectoryPanel';
import { ReaderControlAppearanceContent } from '../features/reading/ReaderControlAppearanceContent';
import type { LocalReadingTocEntry } from '../features/reading/LocalReadingFlowGateway';

function probeEntries(): LocalReadingTocEntry[] {
  const entries: LocalReadingTocEntry[] = [];
  for (let i = 0; i < 60; i += 1) {
    entries.push({ index: i, title: `第 ${i + 1} 章 · 控制栏验证`, downloadState: 'completed',
      bookmarks: i === 19 || i === 21 ? [{ time: i, chapterIndex: i, chapterOffset: 0,
        chapterTitle: `第 ${i + 1} 章`, content: '仅用于列表定位验证的数据' }] : [] });
  }
  return entries;
}

@Entry
@Component
struct ReaderControlMotionVerification {
  @State private session: ReaderControlSessionState = createReaderControlSessionState();
  // Stage presentation samples are kept separate from the semantic reducer
  // input. This page is a diagnostic surface, so the mirror may be reactive
  // without affecting the production reading tree.
  @State private visualSession: ReaderControlSessionState = createReaderControlSessionState();
  @State private stageWidth: number = 364;
  @State private stageHeight: number = 736;
  @State private temporaryLayer: boolean = false;
  @State private dismissTemporaryRevision: number = 0;
  private stageScreenX: number = 0;
  private stageScreenY: number = 0;
  private stageMeasured: boolean = false;
  private topBarRect: ReaderControlBackdropRect = { x: 0, y: 0, width: 0, height: 0 };
  private dockRect: ReaderControlBackdropRect = { x: 0, y: 0, width: 0, height: 0 };
  private backdropState: ReaderControlBackdropTouchState = createReaderControlBackdropTouchState();
  private inputRevision: number = 0;
  private entries: LocalReadingTocEntry[] = probeEntries();
  private readonly expandCurve = curves.cubicBezierCurve(0, 0, 0.58, 1);
  private readonly collapseCurve = curves.cubicBezierCurve(0.42, 0, 1, 1);

  aboutToAppear(): void {
    this.visualSession = copyReaderControlSessionState(this.session);
  }

  onBackPress(): boolean {
    this.inputRevision += 1;
    if (this.temporaryLayer) {
      this.dismissTemporaryRevision += 1;
      this.temporaryLayer = false;
      return true;
    }
    let result = backReaderControlSession(this.session, 1150);
    if (result.state.transition?.kind === 'dismiss') {
      result = backReaderControlSession(this.session, 360);
    } else if (result.state.transition?.kind === 'navigate') {
      // Module navigation is deliberately immediate in this component probe;
      // its real content-routing transition belongs to the Host migration.
      result = backReaderControlSession(this.session, 0);
    }
    this.session = result.state;
    return result.consumed;
  }

  private topBarFrame(): ReaderControlVisibilityActor {
    return sampleReaderControlWholeVisibility(sampleReaderControlSession(this.visualSession).visibilityProgress).topBar;
  }

  private contentFrame(): ReaderControlMotionFrame {
    return sampleReaderControlMotionComposition(sampleReaderControlSession(this.visualSession),
      readerControlMotionBounds(this.stageWidth, this.stageHeight, 19, this.quickHeight()));
  }

  private quickHeight(): number { return Math.min(Math.max(0, this.stageHeight), 330); }

  private clockSample(fraction: number): number {
    const transition = this.visualSession.transition;
    if (transition === undefined) return fraction;
    const direction = transition.targetProgress - transition.startProgress;
    const visibilityDelta = (transition.to.visibilityProgress - transition.from.visibilityProgress) * direction;
    const expansionDelta = (transition.to.expansionProgress - transition.from.expansionProgress) * direction;
    return (visibilityDelta < 0 || (visibilityDelta === 0 && expansionDelta < 0)) ?
      this.collapseCurve.interpolate(fraction) : this.expandCurve.interpolate(fraction);
  }

  private backdropTouch(event: TouchEvent): void {
    if (event.type === TouchType.Cancel) {
      this.backdropState = createReaderControlBackdropTouchState();
      return;
    }
    const pointers = event.changedTouches.length > 0 ? event.changedTouches : event.touches;
    for (let i = 0; i < pointers.length; i += 1) {
      const pointer = pointers[i];
      const touch: ReaderControlBackdropTouchEvent = {
        kind: event.type === TouchType.Down ? 'down' : event.type === TouchType.Up ? 'up' : 'move',
        pointerId: pointer.id, windowX: pointer.windowX, windowY: pointer.windowY, timeMs: Date.now(),
      };
      const result = reduceReaderControlBackdropTouch(this.backdropState, touch, {
        visible: readerControlContentLocation(this.visualSession).level !== 'hidden',
        geometryReady: this.stageMeasured && this.topBarRect.width > 0,
        heldPointerId: this.visualSession.heldPointerId, closeRevision: this.visualSession.closeRevision,
        invalidationRevision: this.inputRevision,
        excludedRects: [this.dockRect,
          { x: this.topBarRect.x, y: this.topBarRect.y + this.topBarFrame().translateY,
            width: this.topBarRect.width, height: this.topBarRect.height }],
      }, { tapMaxDurationMs: 500, touchSlopVp: 8 });
      this.backdropState = result.state;
      if (result.shouldDismiss) {
        this.inputRevision += 1;
        this.dismissTemporaryRevision += 1;
        this.session = dismissReaderControlSession(this.session, 360);
        return;
      }
    }
  }

  @Builder
  private content() {
    if (readerControlContentLocation(this.session).level === 'home') {
      Column({ space: 12 }) {
        Text('开发验证入口 · 非阅读器业务验收').fontSize(12);
        Button('目录 / 书签').onClick((): void => {
          this.inputRevision += 1;
          this.session = enterReaderControlModule(this.session, 'directory', 0);
        });
        Button('外观').onClick((): void => {
          this.inputRevision += 1;
          this.session = enterReaderControlModule(this.session, 'appearance', 0);
        });
      }.width(this.contentFrame().content.width).height(this.contentFrame().content.height);
    } else if (readerControlContentLocation(this.session).module === 'directory') {
      FullDirectoryPanel({
        embeddedInControl: true, motionProgress: this.contentFrame().progress,
        panelWidthOverride: this.contentFrame().content.width, panelHeightOverride: this.contentFrame().content.height,
        entries: this.entries, currentChapterIndex: 20,
        initialTab: readerControlContentLocation(this.session).directoryTab,
        listSessionKey: `probe-${this.session.closeRevision}`,
        onGeometryProbe: (event: string): void => console.info(`ReaderControlListProbe ${event}`),
        geometryProbeEnabled: true,
        onTabChange: (tab: string): void => {
          this.inputRevision += 1;
          this.session = setReaderControlDirectoryTab(this.session,
            tab === 'bookmarks' ? 'bookmarks' : 'directory');
        },
      });
    } else {
      ReaderControlAppearanceContent({
        motionProgress: this.contentFrame().progress, availableWidth: this.contentFrame().content.width,
        availableHeight: this.contentFrame().content.height, fullContentHeight: this.stageHeight - 70,
        dismissTemporaryRevision: this.dismissTemporaryRevision,
        onTemporaryLayerChange: (active: boolean): void => { this.temporaryLayer = active; },
      });
    }
  }

  @Builder
  private header() {
    Row() {
      Text(readerControlContentLocation(this.session).module === 'directory' ? '目录' : '界面')
        .fontSize(14).fontWeight(FontWeight.Bold).layoutWeight(1);
      Button('收起').width(40).height(26).fontSize(10).borderRadius(8)
        .onClick((): void => {
          this.inputRevision += 1;
          this.session = collapseReaderControlSession(this.session, 1150);
        });
    }.width(this.contentFrame().header.width).height(30);
  }

  @Builder
  private rail() {
    Column() {
      Text('亮度').fontSize(10);
      Slider({ value: 70, min: 0, max: 100, direction: Axis.Vertical }).height(120);
    }.width(38).height(190).backgroundColor('#F7F1E6').borderRadius(12);
  }

  @Builder
  private navigation() {
    Text('导航占位 · 只验证共同运动轨迹').fontSize(12)
      .width('100%').height(80).backgroundColor('#F7F1E6').borderRadius(12);
  }

  @Builder
  private topBar() {
    Row() {
      Text('顶部栏 · 与底栏共用可见进度').fontSize(12).layoutWeight(1);
      Button('关闭').height(30).onClick((): void => {
        this.inputRevision += 1;
        this.dismissTemporaryRevision += 1;
        this.session = dismissReaderControlSession(this.session, 360);
      });
    }.width(this.stageWidth).height(54).padding(12)
      .backgroundColor('#FFFBF2').borderRadius(16);
  }

  build() {
    Stack({ alignContent: Alignment.Bottom }) {
      Column() {
        Text('控制栏开发验证：业务回调、亮度/导航皮肤未接入').fontSize(12);
        Text('用户确认覆盖：导入字体独立格位、默认末尾，保留自定义排序').fontSize(10);
        Text('恢复稿：整栏显示 420ms／关闭 360ms；展开收起 1150ms').fontSize(10);
        Button('打开初始快捷页').onClick((): void => {
          this.inputRevision += 1;
          this.session = openReaderControlSession(this.session, 420);
        });
        Button('返回一级').onClick((): void => { this.onBackPress(); });
        Text(`epoch=${this.session.epoch} close=${this.session.closeRevision}`).fontSize(10);
        Text(`p=${sampleReaderControlSession(this.session).expansionProgress.toFixed(3)} ` +
          `v=${sampleReaderControlSession(this.session).visibilityProgress.toFixed(3)} ` +
          `size=${this.stageWidth.toFixed(1)}×${this.stageHeight.toFixed(1)}`).fontSize(10);
      }.width('100%').height('100%').padding({ top: 90 });
      if (readerControlContentLocation(this.session).level !== 'hidden') {
        // A generated onClick can arrive after the handle's raw UP. Only a
        // matching tap that actually STARTED on the backdrop may dismiss it.
        Row().width('100%').height('100%')
          .onTouch((event: TouchEvent): void => this.backdropTouch(event));
      }
      ReaderControlMotionStage({
        semanticSession: this.session, availableWidth: this.stageWidth, fullHeight: this.stageHeight,
        viewportWidth: this.stageWidth, viewportHeight: this.stageHeight,
        dockLeft: 0, dockTop: 0, topBarWidth: this.stageWidth, topBarTop: 19,
        settleDurationMs: 1150, showDurationMs: 420, dismissDurationMs: 360,
        tapMaxDurationMs: 500, directionSlopVp: 8,
        clockCurve: (fraction: number): number => this.clockSample(fraction),
        onVisualSessionChange: (state: ReaderControlSessionState): void => {
          this.visualSession = copyReaderControlSessionState(state);
        },
        onSessionCommit: (state: ReaderControlSessionState): void => {
          this.session = copyReaderControlSessionState(state);
        },
        onDismiss: (): void => {
          this.session = dismissReaderControlSession(this.session, 360);
        },
        onDockGeometryChange: (rect: ReaderControlBackdropRect, ready: boolean): void => {
          this.dockRect = rect;
          this.stageMeasured = ready;
          this.stageScreenX = rect.x;
          this.stageScreenY = rect.y;
        },
        onTopBarGeometryChange: (rect: ReaderControlBackdropRect, _ready: boolean): void => {
          this.topBarRect = rect;
        },
        moduleContent: (): void => this.content(),
        topBarContent: (): void => this.topBar(),
        fullHeaderContent: (): void => this.header(),
        brightnessContent: (): void => this.rail(), navigationContent: (): void => this.navigation(),
      }).hitTestBehavior(HitTestMode.Transparent);
    }.width('100%').height('100%').backgroundColor('#F1E7D1')
      .onAreaChange((_previous: Area, current: Area): void => {
        const width = Number(current.width);
        const height = Number(current.height);
        if (Number.isFinite(width) && width > 26) this.stageWidth = width - 26;
        if (Number.isFinite(height) && height > 108) this.stageHeight = height - 108;
      });
  }
}
