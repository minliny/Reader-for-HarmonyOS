import { readerAppColor } from '../common/ReaderThemeRegistry';
import {
  READER_CONTROL_APPEARANCE_THEMES,
  readerControlAppearanceThemeLabel,
  readerControlAppearanceThemeSwatch,
} from './ReaderControlAppearanceStyle';
import { registerReaderFonts, readerRegisteredFontFamily } from '../common/ReaderFonts';
import {
  TOK_BORDER_W,
  TOK_LINE,
  TOK_READ_ACTIVE_SOFT,
  TOK_READ_INK,
  TOK_READ_MUTED,
  TOK_READ_PRIMARY,
  TOK_SURFACE_PANEL,
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

interface ReaderAppearanceActorPosition {
  x: number;
  y: number;
}

/**
 * Figma N's QuickMorph subtree for Phone Appearance.
 *
 * Every child owns a stable semantic key and reads its local bounding box
 * from the same sampled motion frame. The compact component internals remain
 * static while their instance roots resize/translate; a separate Full tree is
 * revealed underneath by the authored opacity tracks.
 */
@Component
export struct ReaderAppearanceSharedActors {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  /** Same primitive progress coordinate as the surface and gesture owner. */
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
    }
    .width(this.currentFrame().quickMorph.width)
    .height(this.currentFrame().quickMorph.height)
    .hitTestBehavior(HitTestMode.Transparent);
  }

  @Builder
  private sharedThemeHeader() {
    Stack({ alignContent: Alignment.TopStart }) {
      Text('主题库')
        .width(168.492)
        .height(9.9)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Bold)
        .fontSize(9)
        .lineHeight(9.9)
        .fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme))
        .position({ x: 0, y: 0 });
      Text(this.themeSummary())
        .width(88)
        .height(8)
        .fontFamily('ReaderNotoSansSC')
        .fontWeight(FontWeight.Medium)
        .fontSize(7.5)
        .lineHeight(8)
        .fontColor(readerAppColor('TOK_READ_MUTED', this.appThemeScheme))
        .textAlign(TextAlign.End)
        .maxLines(1)
        .position({ x: 174, y: 3.95 });
    }
    .width(this.currentFrame().themeHeader.width)
    .height(this.currentFrame().themeHeader.height)
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
      Row()
        .width(46)
        .height(18)
        .backgroundColor(this.themeColor(theme))
        .border({
          width: this.snapshot.activeTheme === theme ? 2 : TOK_BORDER_W,
          color: this.snapshot.activeTheme === theme ? readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme) : readerAppColor('app.ReaderAppearanceSharedActors.sharedThemeCard.color.1F5B5046', this.appThemeScheme),
        })
        .borderRadius(6)
        .position({ x: 8.25, y: 2 });
    }
    .width(this.currentFrame().themeItems[index].width)
    .height(this.currentFrame().themeItems[index].height)
    .borderRadius(8)
    .clip(true)
    .opacity(this.currentFrame().themeItems[index].opacity)
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
      .backgroundColor(readerAppColor('TOK_LINE', this.appThemeScheme))
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
      .width(256)
      .height(9.9)
      .fontFamily('ReaderNotoSansSC')
      .fontWeight(FontWeight.Bold)
      .fontSize(9)
      .lineHeight(9.9)
      .fontColor(readerAppColor('TOK_READ_INK', this.appThemeScheme))
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
    Stack({ alignContent: Alignment.TopStart }) {
      Row()
        .width(55)
        .height(22)
        .backgroundColor(this.isActiveFont(fontId) ? readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme) : readerAppColor('TOK_SURFACE_PANEL', this.appThemeScheme))
        .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_LINE', this.appThemeScheme) })
        .borderRadius(11)
        .position({ x: 4, y: 3 });
      Text(readerAppearanceFontSlotLabel(this.snapshot, fontId))
        .width(54.5)
        .height(10)
        .fontFamily(readerRegisteredFontFamily(this.getUIContext().getFont(), readerAppearanceFontSlotFamily(this.snapshot, fontId)))
        .fontWeight(FontWeight.Regular)
        .fontSize(8)
        .lineHeight(10)
        .fontColor(this.isActiveFont(fontId) ? readerAppColor('app.ReaderAppearanceSharedActors.sharedFontCell.fontColor.FFFFFAF4', this.appThemeScheme) : readerAppColor('TOK_READ_INK', this.appThemeScheme))
        .textAlign(TextAlign.Center)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .position({ x: 4, y: 8.5 });
    }
      .width(this.fontActorFrame(fontId).width)
      .height(this.fontActorFrame(fontId).height)
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
        { radius: 12, color: readerAppColor('app.ReaderAppearanceSharedActors.sharedFontCell.color.2B332C25', this.appThemeScheme), offsetX: 0, offsetY: 5 } :
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
      .backgroundColor(readerAppColor('TOK_READ_ACTIVE_SOFT', this.appThemeScheme))
      .border({ width: TOK_BORDER_W, color: readerAppColor('TOK_READ_PRIMARY', this.appThemeScheme), style: BorderStyle.Dashed })
      .borderRadius(6)
      .opacity(0.58)
      .position({
        x: this.fontSlotX(this.draggedFontHoverIndex) - this.currentFrame().quickMorph.x,
        y: this.fontSlotY(this.draggedFontHoverIndex) - this.currentFrame().quickMorph.y,
      })
      .zIndex(0);
  }

  private currentFrame(): ReaderAppearanceMotionFrame {
    return sampleReaderAppearanceMasterProgress(this.motionProgress, this.fullHeight);
  }

  private masterProgress(): number {
    return Math.max(0, Math.min(1, this.motionProgress));
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

  private themeIds(): ReaderAppearanceTheme[] {
    return READER_CONTROL_APPEARANCE_THEMES;
  }

  private isActiveFont(fontId: string): boolean {
    return fontId === this.snapshot.font;
  }

  private isSelectableFont(fontId: string): boolean {
    return isReaderAppearanceFont(fontId);
  }

  private themeSummary(): string {
    return `日间：${this.themeLabel(this.snapshot.dayTheme)} · 夜间：${this.themeLabel(this.snapshot.nightTheme)}`;
  }

  private themeLabel(theme: ReaderAppearanceTheme): string {
    return readerControlAppearanceThemeLabel(theme);
  }

  private themeColor(theme: ReaderAppearanceTheme): string {
    return readerControlAppearanceThemeSwatch(theme);
  }
}
