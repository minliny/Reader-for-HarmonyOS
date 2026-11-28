import { MESSAGE_ACTION } from '../foundation/ReaderMessageStyle';
import { readerWindowMetrics } from '../foundation/ReaderWindowEnvironment';
import { READER_LAYOUT_CLOSE_CONTROL, READER_LAYOUT_DEBUG_BUILD, READER_LAYOUT_SURFACE_HINT } from '../foundation/ReaderLayoutInvariantSignals';
import type { LayoutInvariantSurfaceHint } from '../layout/LayoutInvariantNativeAudit';
import { readerInteractiveSafeLeft, readerInteractiveSafeRight } from '../foundation/ReaderWindowMetrics';
import { SurfaceHorizontalFrame, SurfaceWidthSpec, resolveHorizontalFrame } from '../layout/SurfaceHorizontalGeometry';
import { readerAppColor } from '../foundation/ReaderAppColors';
import type { ReaderAppColorRole } from '../foundation/ReaderAppColors';
import { readerPaperActionIcon } from '../foundation/ReaderActionIconResources';
import { ReaderPressFeedback } from '../foundation/ReaderPressFeedback';
import { readerMotionAnimateParam } from '../foundation/ReaderMotionPolicy';
import { DialogSpecId, DialogSurfaceSpec, readerSurfaceElevation, resolveDialogSpec } from './ReaderSurfaceSpecs';
import { readerReadableFontScale, readerScaledControlHeight } from '../foundation/ReaderSurfaceResolvers';

export function readerDialogScrimTransition(reduceMotion: boolean): TransitionEffect {
  return TransitionEffect.OPACITY.animation(readerMotionAnimateParam('app.sheet.scrim', reduceMotion));
}

const NATIVE_DIALOG_SURFACE: LayoutInvariantSurfaceHint = { placement: 'center', dialog: true };

export function readerDialogCardTransition(reduceMotion: boolean): TransitionEffect {
  if (reduceMotion) return TransitionEffect.IDENTITY;
  return TransitionEffect.asymmetric(
    TransitionEffect.scale({ x: 0.95, y: 0.95 }).combine(TransitionEffect.translate({ y: 8 }))
      .animation(readerMotionAnimateParam('app.sheet.open', false)),
    TransitionEffect.scale({ x: 0.95, y: 0.95 }).animation(readerMotionAnimateParam('app.sheet.close', false)));
}

/** One action rendered in the standard actions area. The owning dialog routes
 * onAction by id; admission (enabled) reflects the owner's live gating. */
export class DialogActionView {
  readonly id: string;
  readonly label: string;
  readonly tone: 'default' | 'primary' | 'danger';
  readonly enabled: boolean;
  readonly defaultFocus: boolean;
  readonly nativeId: string;

  constructor(
    id: string,
    label: string,
    tone: 'default' | 'primary' | 'danger' = 'default',
    enabled: boolean = true,
    defaultFocus: boolean = false,
    nativeId: string = '',
  ) {
    this.id = id;
    this.label = label;
    this.tone = tone;
    this.enabled = enabled;
    this.defaultFocus = defaultFocus;
    this.nativeId = nativeId;
  }
}

/**
 * Shared dialog surface: spec-driven frame (width cap/inset/card-inset,
 * padding, radius, background, border, shadow), standard header row and
 * data-driven actions area. The body slot is the caller's content; the host
 * (CustomDialogController or a self-drawn overlay) stays with the caller and
 * is not merged here.
 *
 * frameMode 'cap' clamps this column's width to the spec max (native modal).
 * frameMode 'inset' fills the host width and applies the resolved left/right
 * safe gaps as padding, so the visual card stays centered in a self-drawn
 * overlay while content may measure wider than the spec cap.
 * frameMode 'card-inset' sizes this column to the resolved card width
 * (min(maxWidth, container − 2·edgeGap)); the host overlay only centers it
 * and owns no gap padding.
 * A spec widthPercent > 0 bypasses all three modes with a plain percentage
 * of the host width (preserved legacy overlays).
 */
@Component
export struct ReaderDialogSurface {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @Prop specId: DialogSpecId = 'book-removal';
  @Prop title: string = '';
  /** Available width after the parent pane has applied its window insets. */
  @Prop containerWidthVp: number = 0;
  @Prop leadingActionWidthVp: number = 0;
  @Prop primarySurfaceColor: string | undefined = undefined;
  @Prop showCloseButton: boolean = false;
  @Prop closeEnabled: boolean = true;
  @Prop nativeId: string = '';
  @Prop closeNativeId: string = '';
  @Prop actions: DialogActionView[] = [];
  @BuilderParam body: () => void = this.defaultBody;
  onAction: (id: string) => void = (): void => {};
  onClose: () => void = (): void => {};
  private mounted: boolean = false;

  aboutToAppear(): void { this.mounted = true; }
  aboutToDisappear(): void { this.mounted = false; }

  @Builder
  private defaultBody() {
  }

  build() {
    Column() {
      if (this.title.length > 0 || this.showCloseButton) {
        this.header();
        if (this.spec().headerGap > 0) {
          Blank().height(this.spec().headerGap);
        }
      }
      Column() {
        this.body();
      }
      .width('100%')
      .margin(this.bodyActionsInnerMargin());
      if (this.actions.length > 0) {
        if (this.spec().bodyActionsGap > 0) {
          Blank().height(this.spec().bodyActionsGap);
        }
        this.actionsRow();
      }
    }
    .id(this.nativeId.length > 0 ? this.nativeId : undefined)
    .width(this.frameWidth())
    .customProperty(READER_LAYOUT_SURFACE_HINT, READER_LAYOUT_DEBUG_BUILD ? NATIVE_DIALOG_SURFACE : undefined)
    .padding(this.framePadding())
    .alignItems(HorizontalAlign.Start)
    .backgroundColor(readerAppColor(this.spec().backgroundRole, this.appThemeScheme))
    .border(this.spec().hasBorder ?
      { width: 1, color: readerAppColor('TOK_LINE', this.appThemeScheme) } :
      { width: 0, color: Color.Transparent })
    .borderRadius(this.spec().borderRadius)
    .shadow(readerSurfaceElevation(this.spec().hasShadow ? 'dialog' : 'embedded', this.appThemeScheme));
  }

  @Builder
  private header() {
    if (this.showCloseButton) {
      Row() {
        Text(this.title)
          .layoutWeight(1)
          .fontFamily(this.spec().headerFontFamily).fontWeight(this.spec().headerFontWeight)
          .fontSize(this.spec().headerFontSize).lineHeight(this.spec().headerLineHeight)
          .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
          .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
          .textAlign(this.spec().headerTextAlign);
        Button({ type: ButtonType.Normal, stateEffect: false }) {
          Image(readerPaperActionIcon('close', this.appThemeScheme)).width(15).height(15)
            .accessibilityLevel('no').hitTestBehavior(HitTestMode.None);
        }.id(this.closeNativeId.length > 0 ? this.closeNativeId : undefined)
          .width(32).height(32).padding(0)
          .customProperty(READER_LAYOUT_CLOSE_CONTROL, READER_LAYOUT_DEBUG_BUILD ? true : undefined)
          .responseRegion({ x: -12, y: -6, width: 44, height: 44 })
          .enabled(this.closeEnabled).opacity(this.closeEnabled ? 1 : 0.45)
          .attributeModifier(new ReaderPressFeedback(readerAppColor('TOK_SURFACE_FIELD', this.appThemeScheme),
            this.appThemeScheme, 16, 16, this.closeEnabled))
          .accessibilityText('关闭')
          .onClick((): void => { if (this.mounted && this.closeEnabled) this.onClose(); });
      }
      .width('100%')
      .constraintSize({ minHeight: 44 })
      .alignItems(VerticalAlign.Center);
    } else {
      Text(this.title)
        .width('100%')
        .fontFamily(this.spec().headerFontFamily).fontWeight(this.spec().headerFontWeight)
        .fontSize(this.spec().headerFontSize).lineHeight(this.spec().headerLineHeight)
        .fontColor(readerAppColor('TOK_INK', this.appThemeScheme))
        .textAlign(this.spec().headerTextAlign);
    }
  }

  @Builder
  private actionsRow() {
    if (this.spec().actionsLayout === 'stack') {
      Column({ space: 16 }) {
        ForEach(this.actions, (action: DialogActionView): void => {
          this.actionCell(action.id);
        }, (action: DialogActionView): string => action.id);
      }
      .width('100%');
    } else {
      Row({ space: 10 }) {
        ForEach(this.actions, (action: DialogActionView): void => {
          this.actionCell(action.id);
        }, (action: DialogActionView): string => action.id);
      }
      .width('100%');
    }
  }

  @Builder
  private actionCell(id: string) {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      Text(this.action(id).label)
        .fontFamily(MESSAGE_ACTION.fontFamily).fontWeight(MESSAGE_ACTION.fontWeight).fontSize(MESSAGE_ACTION.fontSizeFp).lineHeight(MESSAGE_ACTION.lineHeightFp as number)
        .fontColor(this.actionLabelColor(this.action(id)));
    }
    .width(this.spec().actionsLayout === 'stack' ? '100%' : this.fixedActionWidth(id))
    .layoutWeight(this.spec().actionsLayout === 'stack' || this.fixedActionWidth(id) !== undefined ? undefined : 1)
    .constraintSize({ minHeight: this.actionHeight() }).padding({ top: 6, bottom: 6 })
    .opacity(this.action(id).enabled ? 1 : 0.45)
    .enabled(this.action(id).enabled)
    .attributeModifier(this.actionModifier(this.action(id)))
    .id(this.action(id).nativeId)
    .customProperty(READER_LAYOUT_CLOSE_CONTROL, READER_LAYOUT_DEBUG_BUILD ?
      id === 'close' || id === 'cancel' || id === 'back' || id === 'dismiss' : undefined)
    .defaultFocus(this.action(id).defaultFocus)
    .responseRegion(this.actionTouchRegion())
    .onClick((): void => {
      if (this.mounted && this.action(id).enabled) {
        this.onAction(id);
      }
    });
  }

  private fixedActionWidth(id: string): number | undefined {
    return this.leadingActionWidthVp > 0 && this.actions[0]?.id === id
      ? Math.min(this.leadingActionWidthVp, this.resolvedFrame().width / 3) : undefined;
  }

  private action(id: string): DialogActionView {
    return this.actions.find((action: DialogActionView): boolean => action.id === id) ??
      new DialogActionView(id, '', 'default', false);
  }

  // Specs that preserve the legacy extended touch contract return an expanded
  // region; others fall back to the component's own bounds (44vp min height).
  private actionTouchRegion(): Rectangle {
    const spec = this.spec();
    const height = this.actionHeight();
    if (spec.actionExtendsTouchRegion) {
      return { x: 0, y: -3, width: '100%', height: height + 6 };
    }
    return { x: 0, y: 0, width: '100%', height: '100%' };
  }

  // A spec may keep its body→actions spacing on the body content itself
  // (e.g. a measured scroll region). The margin lives on an inner wrapper so
  // it separates content from the actions while the outer frame keeps its
  // authored bounds; border, radius and shadow never use a negative margin.
  private bodyActionsInnerMargin(): Margin {
    const spec = this.spec();
    if (spec.bodyActionsOwnMargin > 0 && this.actions.length > 0) {
      return { bottom: spec.bodyActionsOwnMargin };
    }
    return {};
  }

  private spec(): DialogSurfaceSpec {
    return resolveDialogSpec(this.specId);
  }

  private actionHeight(): number {
    return readerScaledControlHeight(this.spec().actionHeight,
      MESSAGE_ACTION.lineHeightFp as number, this.fontScale());
  }

  private fontScale(): number {
    if (this.readerWindowMetricsRevision < 0) return 1;
    return readerReadableFontScale(readerWindowMetrics().systemFontScale);
  }

  private frameWidth(): string | number {
    const spec = this.spec();
    if (spec.widthPercent > 0) {
      return `${spec.widthPercent}%`;
    }
    if (spec.frameMode === 'inset') {
      return '100%';
    }
    return this.resolvedFrame().width;
  }

  // ArkUI includes the 1vp border in the content inset: padding + 1 = Figma inset.
  // In inset mode the resolved side gaps become horizontal padding so the card
  // centers within a full-bleed overlay; in cap/card-inset/percent modes padding
  // is uniform.
  private framePadding(): number | Padding {
    const spec = this.spec();
    if (spec.widthPercent <= 0 && spec.frameMode === 'inset') {
      const frame = this.resolvedFrame();
      return { left: frame.left, right: frame.right, top: spec.padding, bottom: spec.padding };
    }
    return spec.padding;
  }

  private resolvedFrame(): SurfaceHorizontalFrame {
    if (this.readerWindowMetricsRevision < 0) {
      return new SurfaceHorizontalFrame(0, 0, 0);
    }
    const spec = this.spec();
    if (this.containerWidthVp > 0) {
      return resolveHorizontalFrame(this.containerWidthVp, 0, 0,
        new SurfaceWidthSpec(spec.maxWidth, spec.edgeGap, spec.edgeGap));
    }
    const metrics = readerWindowMetrics();
    return resolveHorizontalFrame(metrics.windowRect.width,
      readerInteractiveSafeLeft(metrics, spec.usesKeyboardSafeArea),
      readerInteractiveSafeRight(metrics, spec.usesKeyboardSafeArea),
      new SurfaceWidthSpec(spec.maxWidth, spec.edgeGap, spec.edgeGap));
  }

  private actionLabelColor(action: DialogActionView): ResourceColor {
    if (!action.enabled) return readerAppColor('TOK_MUTED', this.appThemeScheme);
    if (action.tone === 'primary') {
      return readerAppColor(this.spec().actionPrimaryLabelRole, this.appThemeScheme);
    }
    if (action.tone === 'danger') {
      return readerAppColor('app.action.onDanger', this.appThemeScheme);
    }
    return readerAppColor('TOK_INK', this.appThemeScheme);
  }

  private actionSurfaceRole(action: DialogActionView): ReaderAppColorRole {
    if (!action.enabled) return 'TOK_SURFACE_FIELD';
    if (action.tone === 'primary') {
      return this.spec().actionPrimarySurfaceRole;
    }
    if (action.tone === 'danger') {
      return 'app.action.destructive';
    }
    return 'TOK_SURFACE_FIELD';
  }

  private actionModifier(action: DialogActionView): AttributeModifier<CommonAttribute> {
    const spec = this.spec();
    const surface = (action.tone === 'primary' ? this.primarySurfaceColor : undefined) ??
      readerAppColor(this.actionSurfaceRole(action), this.appThemeScheme);
    return new ReaderPressFeedback(surface, this.appThemeScheme, spec.actionBorderRadius,
      spec.actionBorderRadius, spec.actionUsesPressFeedback && action.enabled);
  }
}
