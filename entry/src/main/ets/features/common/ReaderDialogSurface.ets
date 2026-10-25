import { MESSAGE_ACTION } from './ReaderMessageStyle';
import { TYPE_DIALOG_ACTION, TYPE_SELECT_OPTION } from './ReaderTypography';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import { readerInteractiveSafeLeft, readerInteractiveSafeRight } from './ReaderWindowMetrics';
import { SurfaceHorizontalFrame, SurfaceWidthSpec, resolveHorizontalFrame } from './SurfaceHorizontalGeometry';
import { readerAppColor } from './ReaderThemeRegistry';
import type { ReaderAppColorRole } from './ReaderThemeRegistry';
import { ReaderPressFeedback } from './ReaderPressFeedback';
import { DialogSpecId, DialogSurfaceSpec, resolveDialogSpec } from './ReaderSurfaceSpecs';
import { readerReadableFontScale, readerScaledControlHeight } from './ReaderSurfaceResolvers';

/** One action rendered in the standard actions area. The owning dialog routes
 * onAction by id; admission (enabled) reflects the owner's live gating. */
export class DialogActionView {
  readonly id: string;
  readonly label: string;
  readonly tone: 'default' | 'primary' | 'danger';
  readonly enabled: boolean;
  readonly defaultFocus: boolean;

  constructor(
    id: string,
    label: string,
    tone: 'default' | 'primary' | 'danger' = 'default',
    enabled: boolean = true,
    defaultFocus: boolean = false,
  ) {
    this.id = id;
    this.label = label;
    this.tone = tone;
    this.enabled = enabled;
    this.defaultFocus = defaultFocus;
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
  @Prop showCloseButton: boolean = false;
  @Prop actions: DialogActionView[] = [];
  @BuilderParam body: () => void = this.defaultBody;
  onAction: (id: string) => void = (): void => {};
  onClose: () => void = (): void => {};

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
    .width(this.frameWidth())
    .padding(this.framePadding())
    .alignItems(HorizontalAlign.Start)
    .backgroundColor(readerAppColor(this.spec().backgroundRole, this.appThemeScheme))
    .border(this.spec().hasBorder ?
      { width: 1, color: readerAppColor('TOK_MESSAGE_BORDER', this.appThemeScheme) } :
      { width: 0, color: Color.Transparent })
    .borderRadius(this.spec().borderRadius)
    .shadow(this.spec().hasShadow ? {
      radius: 46,
      offsetX: 0,
      offsetY: 18,
      color: readerAppColor('app.BookshelfBookActionSheet.build.color.29594632', this.appThemeScheme),
    } : {
      radius: 0,
      offsetX: 0,
      offsetY: 0,
      color: Color.Transparent,
    });
  }

  @Builder
  private header() {
    if (this.showCloseButton) {
      Row() {
        Text(this.title)
          .layoutWeight(1)
          .fontFamily(this.spec().headerFontFamily).fontWeight(this.spec().headerFontWeight)
          .fontSize(this.spec().headerFontSize).lineHeight(this.spec().headerLineHeight)
          .fontColor(readerAppColor('TOK_MESSAGE_INK', this.appThemeScheme))
          .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
          .textAlign(this.spec().headerTextAlign);
        Text('关闭')
          .width(52).height(readerScaledControlHeight(36, TYPE_SELECT_OPTION.lineHeightFp as number, this.fontScale()))
          .fontFamily(TYPE_SELECT_OPTION.fontFamily).fontWeight(TYPE_SELECT_OPTION.fontWeight).fontSize(TYPE_SELECT_OPTION.fontSizeFp)
          .fontColor(readerAppColor('TOK_MUTED', this.appThemeScheme))
          .textAlign(TextAlign.Center)
          .onClick((): void => this.onClose());
      }
      .width('100%')
      .alignItems(VerticalAlign.Center);
    } else {
      Text(this.title)
        .width('100%')
        .fontFamily(this.spec().headerFontFamily).fontWeight(this.spec().headerFontWeight)
        .fontSize(this.spec().headerFontSize).lineHeight(this.spec().headerLineHeight)
        .fontColor(readerAppColor('TOK_MESSAGE_INK', this.appThemeScheme))
        .textAlign(this.spec().headerTextAlign);
    }
  }

  @Builder
  private actionsRow() {
    if (this.spec().actionsLayout === 'stack') {
      Column({ space: 16 }) {
        ForEach(this.actions, (action: DialogActionView): void => {
          this.actionCell(action);
        }, (action: DialogActionView): string => action.id);
      }
      .width('100%');
    } else {
      Row({ space: 10 }) {
        ForEach(this.actions, (action: DialogActionView): void => {
          this.actionCell(action);
        }, (action: DialogActionView): string => action.id);
      }
      .width('100%');
    }
  }

  @Builder
  private actionCell(action: DialogActionView) {
    Button({ type: ButtonType.Normal, stateEffect: false }) {
      Text(action.label)
        .fontFamily(MESSAGE_ACTION.fontFamily).fontWeight(MESSAGE_ACTION.fontWeight).fontSize(MESSAGE_ACTION.fontSizeFp).lineHeight(MESSAGE_ACTION.lineHeightFp as number)
        .fontColor(this.actionLabelColor(action));
    }
    .width(this.spec().actionsLayout === 'stack' ? '100%' : undefined)
    .layoutWeight(this.spec().actionsLayout === 'stack' ? undefined : 1)
    .height(this.actionHeight()).padding(0)
    .opacity(action.enabled ? 1 : 0.62)
    .enabled(action.enabled)
    .attributeModifier(this.actionModifier(action))
    .defaultFocus(action.defaultFocus)
    .responseRegion(this.actionTouchRegion())
    .onClick((): void => {
      if (action.enabled) {
        this.onAction(action.id);
      }
    });
  }

  // Specs that preserve the legacy extended touch contract return an expanded
  // region; others fall back to the component's own bounds (44vp min height).
  private actionTouchRegion(): Rectangle {
    const spec = this.spec();
    const height = this.actionHeight();
    if (spec.actionExtendsTouchRegion) {
      return { x: 0, y: -3, width: '100%', height: height + 6 };
    }
    return { x: 0, y: 0, width: '100%', height };
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
    return readerReadableFontScale(ReaderWindowCoordinator.metrics().systemFontScale);
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
    const metrics = ReaderWindowCoordinator.metrics();
    return resolveHorizontalFrame(metrics.windowRect.width,
      readerInteractiveSafeLeft(metrics, spec.usesKeyboardSafeArea),
      readerInteractiveSafeRight(metrics, spec.usesKeyboardSafeArea),
      new SurfaceWidthSpec(spec.maxWidth, spec.edgeGap, spec.edgeGap));
  }

  private actionLabelColor(action: DialogActionView): ResourceColor {
    if (action.tone === 'primary') {
      return readerAppColor(this.spec().actionPrimaryLabelRole, this.appThemeScheme);
    }
    if (action.tone === 'danger') {
      return readerAppColor('TOK_MESSAGE_DANGER', this.appThemeScheme);
    }
    return readerAppColor('TOK_MESSAGE_SOFT_INK', this.appThemeScheme);
  }

  private actionSurfaceRole(action: DialogActionView): ReaderAppColorRole {
    if (action.tone === 'primary') {
      return this.spec().actionPrimarySurfaceRole;
    }
    if (action.tone === 'danger') {
      return 'TOK_MESSAGE_SOFT';
    }
    return 'TOK_MESSAGE_SOFT';
  }

  private actionModifier(action: DialogActionView): AttributeModifier<CommonAttribute> {
    const spec = this.spec();
    const surface = readerAppColor(this.actionSurfaceRole(action), this.appThemeScheme);
    if (spec.actionUsesPressFeedback) {
      return new ReaderPressFeedback(surface, this.appThemeScheme, spec.actionBorderRadius);
    }
    return new ReaderPressFeedback(surface, this.appThemeScheme, spec.actionBorderRadius,
      spec.actionBorderRadius, false);
  }
}
