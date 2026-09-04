import { registerReaderFonts } from '../common/ReaderFonts';
import {
  TOK_BORDER_W,
  TOK_LINE,
  TOK_PRIMARY_SOFT,
  TOK_READ_ACTIVE_SOFT,
  TOK_READ_DISABLED_BG,
  TOK_READ_INK,
  TOK_READ_MUTED,
  TOK_READ_PRIMARY,
} from '../common/ReaderTokens';
import { motionAnimateParam } from '../common/MotionSpec';
import {
  createDefaultReaderAppearanceSnapshot,
  isReaderAppearanceFont,
  moveReaderAppearanceFontSlot,
  type ReaderAppearanceFont,
  type ReaderAppearanceFontSlot,
  type ReaderAppearanceSnapshot,
  type ReaderAppearanceTheme,
} from './ReaderAppearanceState';
import {
  readerAppearanceFontSlotFamily,
  readerAppearanceFontSlotLabel,
} from './ReaderAppearanceRenderStyle';
import {
  READER_APPEARANCE_FULL_HEIGHT,
  sampleReaderAppearanceMasterProgress,
  type ReaderAppearanceMotionActorFrame,
  type ReaderAppearanceMotionFrame,
} from './ReaderAppearanceMotionGeometry';

const READER_APPEARANCE_FONT_REORDER_HOLD_MS = 160;
const READER_APPEARANCE_FONT_IMPORT_STAGE_X = 24;
const READER_APPEARANCE_FONT_IMPORT_STAGE_Y = 383.98;
const READER_APPEARANCE_FONT_FULL_WIDTH = 73;
const READER_APPEARANCE_FONT_FULL_HEIGHT = 30;
const READER_APPEARANCE_CONTENT_HEIGHT = 989;

interface ReaderAppearanceActorPosition {
  x: number;
  y: number;
}

/**
 * The persistent Quick -> Full shared-actor group for Phone Appearance.
 *
 * Every child owns a stable semantic key and reads its global bounding box
 * from the same sampled motion frame. ReaderAppearanceFullPanel owns the only
 * surface and Scroll; this component renders directly inside that Scroll and
 * subtracts the sampled surface origin solely to convert Stage-space bboxes to
 * local coordinates. No mirrored scroll offset or second Full copy exists.
 */
@Component
export struct ReaderAppearanceSharedActors {
  @Prop motionProgress: number = 0;
  @Prop fullHeight: number = READER_APPEARANCE_FULL_HEIGHT;
  @Prop @Watch('onInteractionEnabledChanged') interactionEnabled: boolean = true;
  @Prop reduceMotion: boolean = false;
  @Prop snapshot: ReaderAppearanceSnapshot = createDefaultReaderAppearanceSnapshot();
  onThemeChange: (theme: ReaderAppearanceTheme) => void = (_theme: ReaderAppearanceTheme): void => {};
  onFontChange: (font: ReaderAppearanceFont) => void = (_font: ReaderAppearanceFont): void => {};
  onFontOrderChange: (fontOrder: ReaderAppearanceFontSlot[]) => void =
    (_fontOrder: ReaderAppearanceFontSlot[]): void => {};
  onFontReorderActivityChange: (active: boolean) => void = (_active: boolean): void => {};
  onCustomFontImport: () => void = (): void => {};

  @State private draggedFontId: string = '';
  @State private draggedFontIndex: number = -1;
  @State private draggedFontHoverIndex: number = -1;
  @State private draggedFontOffsetX: number = 0;
  @State private draggedFontOffsetY: number = 0;
  @State private previewFontOrder: ReaderAppearanceFontSlot[] = [];
  @State private fontDragSettling: boolean = false;
  private fontDragGeneration: number = 0;
  private fontTouchStartX: number = 0;
  private fontTouchStartY: number = 0;
  private fontTouchCurrentX: number = 0;
  private fontTouchCurrentY: number = 0;
  private fontTouchId: number = -1;

  aboutToAppear(): void {
    registerReaderFonts(this.getUIContext().getFont());
  }

  private onInteractionEnabledChanged(): void {
    if (this.interactionEnabled) {
      return;
    }
    this.fontDragGeneration += 1;
    this.clearFontDragState();
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      this.sharedThemeHeader();
      ForEach(this.themeIds(), (theme: ReaderAppearanceTheme, index: number) => {
        this.sharedThemeCard(theme, index);
      }, (theme: ReaderAppearanceTheme): string => `reader-appearance-shared-theme-${theme}`);
      this.sharedDivider();
      this.sharedFontHeader();
      if (this.draggedFontId !== '') {
        this.fontDragPlaceholder();
      }
      ForEach(this.sharedFontIds(), (fontId: ReaderAppearanceFontSlot) => {
        this.sharedFontCell(fontId);
      }, (fontId: ReaderAppearanceFontSlot): string => `reader-appearance-shared-font-${fontId}`);
      this.fullOnlyFontImport();
    }
    .width(this.currentFrame().quickMorph.width)
    .height(READER_APPEARANCE_CONTENT_HEIGHT)
    .enabled(this.interactionEnabled)
    .hitTestBehavior(HitTestMode.Transparent);
  }

  @Builder
  private sharedThemeHeader() {
    Row() {
      Text('主题库')
        .layoutWeight(1)
        .height(this.currentFrame().themeHeader.height)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(this.lerp(9, 12, this.actorProgress(this.currentFrame().themeHeader.trackProgress)))
        .lineHeight(this.lerp(9.9, 17, this.actorProgress(this.currentFrame().themeHeader.trackProgress)))
        .fontColor(TOK_READ_INK);
      Text(this.themeSummary())
        .width(this.lerp(88, 122, this.actorProgress(this.currentFrame().themeHeader.trackProgress)))
        .height(this.currentFrame().themeHeader.height)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Medium)
        .fontSize(this.lerp(7.5, 10, this.actorProgress(this.currentFrame().themeHeader.trackProgress)))
        .lineHeight(this.lerp(8, 13, this.actorProgress(this.currentFrame().themeHeader.trackProgress)))
        .fontColor(TOK_READ_MUTED)
        .textAlign(TextAlign.End)
        .maxLines(1);
    }
    .width(this.currentFrame().themeHeader.width)
    .height(this.currentFrame().themeHeader.height)
    .alignItems(VerticalAlign.Top)
    .position(this.localPosition(this.currentFrame().themeHeader))
    .translate({
      x: this.currentFrame().themeHeader.translateX,
      y: this.currentFrame().themeHeader.translateY,
    })
    .opacity(this.currentFrame().themeHeader.opacity)
    .blur(this.currentFrame().themeHeader.blurVp);
  }

  @Builder
  private sharedThemeCard(theme: ReaderAppearanceTheme, index: number) {
    Stack({ alignContent: Alignment.TopStart }) {
      if (this.snapshot.activeTheme !== theme && !this.isNightTheme(theme)) {
        // The Quick day cards are transparent while the Full component uses
        // its disabled surface. Interpolate those known endpoint styles with
        // this card's own track; this is an endpoint bridge, not an N2 claim.
        Row()
          .width('100%')
          .height('100%')
          .backgroundColor(TOK_READ_DISABLED_BG)
          .opacity(this.themeActorProgress(index))
          .hitTestBehavior(HitTestMode.None);
      }
      Row()
        .width(this.lerp(46, 63.5, this.themeActorProgress(index)))
        .height(this.lerp(18, 24, this.themeActorProgress(index)))
        .backgroundColor(this.themeColor(theme))
        .border({ width: TOK_BORDER_W, color: '#1F5B5046' })
        .borderRadius(6)
        .position({
          x: (this.currentFrame().themeItems[index].width -
            this.lerp(46, 63.5, this.themeActorProgress(index))) / 2,
          y: this.lerp(3, 10, this.themeActorProgress(index)),
        });
      Text(this.themeLabel(theme))
        .width(Math.max(0, this.currentFrame().themeItems[index].width - 10))
        .height(11)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Regular)
        .fontSize(9)
        .lineHeight(11)
        .fontColor(TOK_READ_MUTED)
        .textAlign(TextAlign.Center)
        .maxLines(1)
        .position({ x: 5, y: 42.9 });
    }
    .width(this.currentFrame().themeItems[index].width)
    .height(this.currentFrame().themeItems[index].height)
    .backgroundColor(this.snapshot.activeTheme === theme ? TOK_READ_ACTIVE_SOFT :
      (this.isNightTheme(theme) ? TOK_READ_DISABLED_BG : Color.Transparent))
    .border({
      width: {
        top: this.snapshot.activeTheme === theme ?
          TOK_BORDER_W * (1 - this.themeActorProgress(index)) : 0,
      },
      color: TOK_READ_PRIMARY,
    })
    .borderRadius(this.lerp(0, 8, this.themeActorProgress(index)))
    .clip(true)
    // 0.8 is the stable inactive style; multiply it by this actor's own track.
    .opacity((this.snapshot.activeTheme === theme ? 1 : 0.8) *
      this.currentFrame().themeItems[index].opacity)
    .position(this.localPosition(this.currentFrame().themeItems[index]))
    .translate({
      x: this.currentFrame().themeItems[index].translateX,
      y: this.currentFrame().themeItems[index].translateY,
    })
    .blur(this.currentFrame().themeItems[index].blurVp)
    .enabled(this.interactionEnabled)
    .accessibilityText(`切换到${this.themeLabel(theme)}主题`)
    .onClick((): void => this.onThemeChange(theme));
  }

  @Builder
  private sharedDivider() {
    Row()
      .width(this.currentFrame().quickDivider.width)
      .height(this.currentFrame().quickDivider.height)
      .backgroundColor(TOK_LINE)
      .position(this.localPosition(this.currentFrame().quickDivider))
      .translate({
        x: this.currentFrame().quickDivider.translateX,
        y: this.currentFrame().quickDivider.translateY,
      })
      .opacity(this.currentFrame().quickDivider.opacity)
      .blur(this.currentFrame().quickDivider.blurVp);
  }

  @Builder
  private sharedFontHeader() {
    Text('字体库')
      .width(this.currentFrame().fontHeader.width)
      .height(this.currentFrame().fontHeader.height)
      .fontFamily('ReaderNotoSansSC')
      .fontWeight(FontWeight.Bold)
      .fontSize(this.lerp(9, 12, this.actorProgress(this.currentFrame().fontHeader.trackProgress)))
      .lineHeight(this.lerp(9.9, 14.4,
        this.actorProgress(this.currentFrame().fontHeader.trackProgress)))
      .fontColor(TOK_READ_INK)
      .position(this.localPosition(this.currentFrame().fontHeader))
      .translate({
        x: this.currentFrame().fontHeader.translateX,
        y: this.currentFrame().fontHeader.translateY,
      })
      .opacity(this.currentFrame().fontHeader.opacity)
      .blur(this.currentFrame().fontHeader.blurVp);
  }

  @Builder
  private sharedFontCell(fontId: ReaderAppearanceFontSlot) {
    Text(readerAppearanceFontSlotLabel(this.snapshot, fontId))
      .width(this.fontActorFrame(fontId).width)
      .height(this.fontActorFrame(fontId).height)
      .padding({ left: 4, right: 4 })
      .backgroundColor(this.isActiveFont(fontId) ? TOK_PRIMARY_SOFT : Color.Transparent)
      .border({
        width: {
          top: TOK_BORDER_W,
          right: this.lerp(0, TOK_BORDER_W, this.fontActorProgress(fontId)),
          bottom: this.lerp(0, TOK_BORDER_W, this.fontActorProgress(fontId)),
          left: this.lerp(0, TOK_BORDER_W, this.fontActorProgress(fontId)),
        },
        color: this.isActiveFont(fontId) ? TOK_READ_PRIMARY : TOK_LINE,
      })
      .borderRadius(this.lerp(0, 6, this.fontActorProgress(fontId)))
      .fontFamily(readerAppearanceFontSlotFamily(this.snapshot, fontId))
      .fontWeight(FontWeight.Regular)
      .fontSize(this.lerp(8, 10, this.fontActorProgress(fontId)))
      .lineHeight(this.lerp(10, 14, this.fontActorProgress(fontId)))
      .fontColor(TOK_READ_INK)
      .textAlign(TextAlign.Center)
      .maxLines(1)
      .textOverflow({ overflow: TextOverflow.Ellipsis })
      .position(this.localPosition(this.fontActorFrame(fontId)))
      .translate({
        x: this.fontActorFrame(fontId).translateX + this.fontDragTranslateX(fontId),
        y: this.fontActorFrame(fontId).translateY + this.fontDragTranslateY(fontId),
      })
      .scale({
        x: this.draggedFontId === fontId ? 1.035 : 1,
        y: this.draggedFontId === fontId ? 1.035 : 1,
      })
      .shadow(this.draggedFontId === fontId ?
        { radius: 12, color: '#2B332C25', offsetX: 0, offsetY: 5 } :
        { radius: 0, color: Color.Transparent, offsetX: 0, offsetY: 0 })
      .opacity((this.draggedFontId === fontId ? 0.96 : 1) * this.fontActorFrame(fontId).opacity)
      .blur(this.fontActorFrame(fontId).blurVp)
      .zIndex(this.draggedFontId === fontId ? 3 : 1)
      .enabled(this.interactionEnabled && this.isSelectableFont(fontId))
      .accessibilityText(this.isSelectableFont(fontId) ?
        `切换到${readerAppearanceFontSlotLabel(this.snapshot, fontId)}` :
        `${readerAppearanceFontSlotLabel(this.snapshot, fontId)}，暂不可用`)
      .onClick((): void => {
        if (this.draggedFontId !== '' || this.fontDragSettling) {
          return;
        }
        if (isReaderAppearanceFont(fontId)) {
          this.onFontChange(fontId);
        }
      })
      .onTouch((event: TouchEvent): void => this.handleFontTouch(fontId, event))
      .gesture(
        LongPressGesture({ fingers: 1, repeat: false, duration: READER_APPEARANCE_FONT_REORDER_HOLD_MS })
          .onAction((): void => this.beginFontDrag(fontId))
          .onActionCancel((): void => {
            if (this.draggedFontId === fontId) {
              this.cancelFontDrag();
            }
          }),
      );
  }

  @Builder
  private fontDragPlaceholder() {
    Row()
      .width(this.fontSlotWidth())
      .height(this.fontSlotHeight())
      .backgroundColor(TOK_READ_ACTIVE_SOFT)
      .border({ width: TOK_BORDER_W, color: TOK_READ_PRIMARY, style: BorderStyle.Dashed })
      .borderRadius(6)
      .opacity(0.58)
      .position({
        x: this.fontSlotX(this.draggedFontHoverIndex) - this.currentFrame().quickMorph.x,
        y: this.fontSlotY(this.draggedFontHoverIndex) - this.currentFrame().quickMorph.y,
      })
      .zIndex(0);
  }

  @Builder
  private fullOnlyFontImport() {
    Text(readerAppearanceFontSlotLabel(this.snapshot, 'import'))
      .width(READER_APPEARANCE_FONT_FULL_WIDTH)
      .height(READER_APPEARANCE_FONT_FULL_HEIGHT)
      .padding({ left: 4, right: 4 })
      .backgroundColor(this.snapshot.font === 'custom' ? TOK_PRIMARY_SOFT : Color.Transparent)
      .border({
        width: TOK_BORDER_W,
        color: this.snapshot.font === 'custom' ? TOK_READ_PRIMARY : TOK_LINE,
        style: BorderStyle.Dashed,
      })
      .borderRadius(6)
      .fontFamily(readerAppearanceFontSlotFamily(this.snapshot, 'import'))
      .fontWeight(FontWeight.Regular)
      .fontSize(10)
      .lineHeight(14)
      .fontColor(TOK_READ_INK)
      .textAlign(TextAlign.Center)
      .maxLines(1)
      .textOverflow({ overflow: TextOverflow.Ellipsis })
      .position({
        x: READER_APPEARANCE_FONT_IMPORT_STAGE_X - this.currentFrame().quickMorph.x,
        y: READER_APPEARANCE_FONT_IMPORT_STAGE_Y - this.currentFrame().quickMorph.y,
      })
      .opacity(this.currentFrame().fontImport.opacity)
      .translate({
        x: this.currentFrame().fontImport.translateX,
        y: this.currentFrame().fontImport.translateY,
      })
      .blur(this.currentFrame().fontImport.blurVp)
      .enabled(this.interactionEnabled && this.atFullEndpoint())
      .accessibilityText('导入自定义字体')
      .onClick((): void => this.onCustomFontImport());
  }

  private currentFrame(): ReaderAppearanceMotionFrame {
    return sampleReaderAppearanceMasterProgress(this.motionProgress, this.fullHeight);
  }

  private masterProgress(): number {
    return Math.max(0, Math.min(1, this.motionProgress));
  }

  private actorProgress(trackProgress: number): number {
    return Math.max(0, Math.min(1, trackProgress));
  }

  private themeActorProgress(index: number): number {
    const frame = this.currentFrame();
    const safeIndex = Math.max(0, Math.min(frame.themeItems.length - 1, index));
    return this.actorProgress(frame.themeItems[safeIndex].trackProgress);
  }

  private fontActorProgress(fontId: ReaderAppearanceFontSlot): number {
    return this.actorProgress(this.fontActorFrame(fontId).trackProgress);
  }

  private atFullEndpoint(): boolean {
    return this.masterProgress() >= 0.999;
  }

  private localPosition(actor: ReaderAppearanceMotionActorFrame): ReaderAppearanceActorPosition {
    return {
      x: actor.x - this.currentFrame().quickMorph.x,
      y: actor.y - this.currentFrame().quickMorph.y,
    };
  }

  private fontActorFrame(fontId: ReaderAppearanceFontSlot): ReaderAppearanceMotionActorFrame {
    const index = this.fontDisplayIndex(fontId);
    const frame = this.currentFrame();
    return frame.fontItems[Math.max(0, Math.min(frame.fontItems.length - 1, index))];
  }

  private sharedFontIds(): ReaderAppearanceFontSlot[] {
    if (this.draggedFontId !== '' && this.previewFontOrder.length === this.baseSharedFontIds().length) {
      return this.previewFontOrder.slice();
    }
    return this.baseSharedFontIds();
  }

  private baseSharedFontIds(): ReaderAppearanceFontSlot[] {
    return this.snapshot.fontOrder.filter((fontId: ReaderAppearanceFontSlot): boolean => fontId !== 'import');
  }

  private fontDisplayIndex(fontId: ReaderAppearanceFontSlot): number {
    const index = this.sharedFontIds().indexOf(fontId);
    return index >= 0 ? index : 0;
  }

  private beginFontDrag(fontId: ReaderAppearanceFontSlot): void {
    if (!this.atFullEndpoint() || !this.interactionEnabled || this.fontDragSettling) {
      return;
    }
    const index = this.baseSharedFontIds().indexOf(fontId);
    if (index < 0) {
      return;
    }
    this.fontDragGeneration += 1;
    const applyLift = (): void => {
      this.draggedFontId = fontId;
      this.draggedFontIndex = index;
      this.draggedFontHoverIndex = index;
      this.draggedFontOffsetX = 0;
      this.draggedFontOffsetY = 0;
      this.previewFontOrder = this.baseSharedFontIds();
      this.fontDragSettling = false;
      this.onFontReorderActivityChange(true);
    };
    if (this.reduceMotion) {
      applyLift();
      return;
    }
    this.getUIContext().animateTo(motionAnimateParam('reader.font.reorder.shift'), applyLift);
  }

  private handleFontTouch(fontId: ReaderAppearanceFontSlot, event: TouchEvent): void {
    if (!this.atFullEndpoint()) {
      return;
    }
    const touch = event.touches.length > 0 ? event.touches[0] : event.changedTouches[0];
    if (touch === undefined) {
      return;
    }
    if (event.type === TouchType.Down) {
      this.fontTouchId = touch.id;
      this.fontTouchStartX = touch.windowX;
      this.fontTouchStartY = touch.windowY;
      this.fontTouchCurrentX = touch.windowX;
      this.fontTouchCurrentY = touch.windowY;
      return;
    }
    if (this.fontTouchId >= 0 && touch.id !== this.fontTouchId) {
      return;
    }
    this.fontTouchCurrentX = touch.windowX;
    this.fontTouchCurrentY = touch.windowY;
    if (event.type === TouchType.Move) {
      if (this.draggedFontId === fontId && !this.fontDragSettling) {
        event.stopPropagation();
        this.updateFontDrag(
          this.fontTouchCurrentX - this.fontTouchStartX,
          this.fontTouchCurrentY - this.fontTouchStartY,
        );
      }
      return;
    }
    if (event.type === TouchType.Up) {
      if (this.draggedFontId === fontId && !this.fontDragSettling) {
        event.stopPropagation();
        this.finishFontDrag(
          this.fontTouchCurrentX - this.fontTouchStartX,
          this.fontTouchCurrentY - this.fontTouchStartY,
        );
      }
      this.clearFontTouchState();
      return;
    }
    if (event.type === TouchType.Cancel) {
      if (this.draggedFontId === fontId && !this.fontDragSettling) {
        this.cancelFontDrag();
      }
      this.clearFontTouchState();
    }
  }

  private updateFontDrag(offsetX: number, offsetY: number): void {
    if (this.draggedFontIndex < 0 || this.fontDragSettling) {
      return;
    }
    this.draggedFontOffsetX = offsetX;
    this.draggedFontOffsetY = offsetY;
    const targetIndex = this.fontDragTargetIndex(offsetX, offsetY);
    if (targetIndex === this.draggedFontHoverIndex) {
      return;
    }
    const nextOrder = moveReaderAppearanceFontSlot(
      this.baseSharedFontIds(),
      this.draggedFontIndex,
      targetIndex,
    ).filter((fontId: ReaderAppearanceFontSlot): boolean => fontId !== 'import');
    const applyPreview = (): void => {
      this.draggedFontHoverIndex = targetIndex;
      this.previewFontOrder = nextOrder;
    };
    if (this.reduceMotion) {
      applyPreview();
      return;
    }
    this.getUIContext().animateTo(motionAnimateParam('reader.font.reorder.shift'), applyPreview);
  }

  private finishFontDrag(offsetX: number, offsetY: number): void {
    if (this.draggedFontIndex < 0 || this.fontDragSettling) {
      this.cancelFontDrag();
      return;
    }
    this.updateFontDrag(offsetX, offsetY);
    const targetIndex = this.draggedFontHoverIndex;
    const nextSharedOrder = this.previewFontOrder.slice();
    const currentSharedOrder = this.baseSharedFontIds();
    const changed = nextSharedOrder.some((fontId: ReaderAppearanceFontSlot, index: number): boolean =>
      fontId !== currentSharedOrder[index]);
    const generation = this.fontDragGeneration;
    const targetOffsetX = this.fontSlotX(targetIndex) - this.fontSlotX(this.draggedFontIndex);
    const targetOffsetY = this.fontSlotY(targetIndex) - this.fontSlotY(this.draggedFontIndex);
    this.fontDragSettling = true;
    const finish = (): void => {
      if (generation !== this.fontDragGeneration) {
        return;
      }
      if (changed) {
        // Import is a fixed ninth, Full-only actor; shared reordering cannot
        // silently move it into the eight-node Figma shared inventory.
        nextSharedOrder.push('import');
        this.onFontOrderChange(nextSharedOrder);
      }
      this.clearFontDragState();
    };
    const settle = (): void => {
      this.draggedFontOffsetX = targetOffsetX;
      this.draggedFontOffsetY = targetOffsetY;
    };
    if (this.reduceMotion) {
      settle();
      finish();
      return;
    }
    this.getUIContext().animateTo(motionAnimateParam('reader.font.reorder.settle', finish), settle);
  }

  private cancelFontDrag(): void {
    if (this.draggedFontIndex < 0 || this.fontDragSettling) {
      return;
    }
    this.fontDragGeneration += 1;
    const generation = this.fontDragGeneration;
    this.fontDragSettling = true;
    const rollback = (): void => {
      this.draggedFontHoverIndex = this.draggedFontIndex;
      this.previewFontOrder = this.baseSharedFontIds();
      this.draggedFontOffsetX = 0;
      this.draggedFontOffsetY = 0;
    };
    const finish = (): void => {
      if (generation === this.fontDragGeneration) {
        this.clearFontDragState();
      }
    };
    if (this.reduceMotion) {
      rollback();
      finish();
      return;
    }
    this.getUIContext().animateTo(motionAnimateParam('reader.font.reorder.settle', finish), rollback);
  }

  private clearFontDragState(): void {
    const wasActive = this.draggedFontId !== '' || this.fontDragSettling;
    this.draggedFontId = '';
    this.draggedFontIndex = -1;
    this.draggedFontHoverIndex = -1;
    this.draggedFontOffsetX = 0;
    this.draggedFontOffsetY = 0;
    this.previewFontOrder = [];
    this.fontDragSettling = false;
    this.clearFontTouchState();
    if (wasActive) {
      this.onFontReorderActivityChange(false);
    }
  }

  private clearFontTouchState(): void {
    this.fontTouchId = -1;
    this.fontTouchStartX = 0;
    this.fontTouchStartY = 0;
    this.fontTouchCurrentX = 0;
    this.fontTouchCurrentY = 0;
  }

  private fontDragTranslateX(fontId: ReaderAppearanceFontSlot): number {
    if (this.draggedFontId !== fontId) {
      return 0;
    }
    return this.draggedFontOffsetX + this.fontSlotX(this.draggedFontIndex) -
      this.fontSlotX(this.fontDisplayIndex(fontId));
  }

  private fontDragTranslateY(fontId: ReaderAppearanceFontSlot): number {
    if (this.draggedFontId !== fontId) {
      return 0;
    }
    return this.draggedFontOffsetY + this.fontSlotY(this.draggedFontIndex) -
      this.fontSlotY(this.fontDisplayIndex(fontId));
  }

  private fontDragTargetIndex(offsetX: number, offsetY: number): number {
    const originCenterX = this.fontSlotX(this.draggedFontIndex) + this.fontSlotWidth() / 2;
    const originCenterY = this.fontSlotY(this.draggedFontIndex) + this.fontSlotHeight() / 2;
    let bestIndex = 0;
    let bestDistance = Number.MAX_VALUE;
    const frame = this.currentFrame();
    for (let index = 0; index < frame.fontItems.length; index += 1) {
      const deltaX = this.fontSlotX(index) + this.fontSlotWidth() / 2 - (originCenterX + offsetX);
      const deltaY = this.fontSlotY(index) + this.fontSlotHeight() / 2 - (originCenterY + offsetY);
      const distance = deltaX * deltaX + deltaY * deltaY;
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }
    return bestIndex;
  }

  private fontSlotX(index: number): number {
    const frame = this.currentFrame();
    const safeIndex = Math.max(0, Math.min(frame.fontItems.length - 1, index));
    return frame.fontItems[safeIndex].x;
  }

  private fontSlotY(index: number): number {
    const frame = this.currentFrame();
    const safeIndex = Math.max(0, Math.min(frame.fontItems.length - 1, index));
    return frame.fontItems[safeIndex].y;
  }

  private fontSlotWidth(): number {
    const frame = this.currentFrame();
    return frame.fontItems.length > 0 ? frame.fontItems[0].width : 0;
  }

  private fontSlotHeight(): number {
    const frame = this.currentFrame();
    return frame.fontItems.length > 0 ? frame.fontItems[0].height : 0;
  }

  private lerp(start: number, end: number, progress: number): number {
    const safeProgress = Math.max(0, Math.min(1, progress));
    return start + (end - start) * safeProgress;
  }

  private themeIds(): ReaderAppearanceTheme[] {
    return ['day', 'warm', 'night', 'warmNight', 'paper', 'green', 'paperNight', 'greenNight'];
  }

  private isActiveFont(fontId: string): boolean {
    return fontId === this.snapshot.font;
  }

  private isSelectableFont(fontId: string): boolean {
    return isReaderAppearanceFont(fontId);
  }

  private isNightTheme(theme: ReaderAppearanceTheme): boolean {
    return theme === 'night' || theme === 'warmNight' || theme === 'paperNight' || theme === 'greenNight';
  }

  private themeSummary(): string {
    return `日间：${this.themeLabel(this.snapshot.dayTheme)} · 夜间：${this.themeLabel(this.snapshot.nightTheme)}`;
  }

  private themeLabel(theme: ReaderAppearanceTheme): string {
    if (theme === 'day') {
      return '日间';
    }
    if (theme === 'warm') {
      return '暖白';
    }
    if (theme === 'night') {
      return '夜间';
    }
    if (theme === 'warmNight') {
      return '暖夜';
    }
    if (theme === 'paper') {
      return '纸纹';
    }
    if (theme === 'green') {
      return '青叶纹';
    }
    if (theme === 'paperNight') {
      return '夜纹';
    }
    return '林夜纹';
  }

  private themeColor(theme: ReaderAppearanceTheme): string {
    if (theme === 'day') {
      return '#FFFFFF';
    }
    if (theme === 'warm') {
      return '#FBF0DF';
    }
    if (theme === 'night') {
      return '#26231F';
    }
    if (theme === 'warmNight') {
      return '#302922';
    }
    if (theme === 'paper') {
      return '#F5EAD8';
    }
    if (theme === 'green') {
      return '#E7F0E2';
    }
    if (theme === 'paperNight') {
      return '#34302B';
    }
    return '#263129';
  }
}
