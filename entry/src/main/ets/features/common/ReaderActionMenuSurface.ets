import { PopupSurfaceSpec, resolvePopupSpec } from './ReaderSurfaceSpecs';
import { readerAppColor } from './ReaderThemeRegistry';

export type ReaderActionMenuSpecId = 'bookshelf-more-menu' | 'reader-more-menu';

/** Business identity, content and admission. Geometry and disabled treatment
 * belong to the finite menu specification, not individual callers. */
export class ReaderMenuActionView {
  readonly id: string;
  readonly label: string;
  readonly enabled: boolean;
  readonly icon: Resource | undefined;
  readonly accessibilityLabel: string;
  constructor(
    id: string, label: string, enabled: boolean = true,
    icon: Resource | undefined = undefined, accessibilityLabel: string = label,
  ) {
    this.id = id; this.label = label; this.enabled = enabled;
    this.icon = icon; this.accessibilityLabel = accessibilityLabel;
  }
}

/** Shared content of both current More menus. The platform popup and the
 * measured pointer host retain their anchor/close lifecycle; rows, dividers,
 * typography, scrolling and live action admission have one implementation. */
@Component
export struct ReaderActionMenuSurface {
  @Prop specId: ReaderActionMenuSpecId = 'reader-more-menu';
  @Prop scheme: string = 'day';
  @Prop actions: ReaderMenuActionView[] = [];
  @Prop availableWidth: string | number = '100%';
  @Prop viewportHeight: number = 0;
  onAction: (id: string) => void = (): void => {};

  build() {
    Scroll() {
      Column() {
        ForEach(this.actions, (action: ReaderMenuActionView, index: number): void => {
          this.actionRow(action.id, index < this.actions.length - 1);
        }, (action: ReaderMenuActionView): string => action.id);
      }.width('100%').height(this.spec().actionHeight * this.actions.length);
    }.width(this.availableWidth)
      .height(Math.max(0, Math.min(this.spec().actionHeight * this.actions.length, this.viewportHeight)))
      .clip(true).scrollBar(BarState.Auto).align(Alignment.TopStart);
  }

  @Builder
  private actionRow(id: string, showDivider: boolean) {
    Stack({ alignContent: Alignment.TopStart }) {
      Row({ space: this.spec().actionIconSize > 0 ? 16 : 0 }) {
        if (this.action(id).icon !== undefined) {
          Image(this.action(id).icon)
            .width(this.spec().actionIconSize).height(this.spec().actionIconSize)
            .opacity(this.action(id).enabled || !this.spec().actionMutesContent ? 1 : 0.45);
        }
        Text(this.action(id).label)
          .fontFamily(this.spec().actionFontFamily).fontWeight(FontWeight.Medium)
          .fontSize(this.spec().actionFontSize).lineHeight(this.spec().actionLineHeight)
          .fontColor(readerAppColor(!this.action(id).enabled && this.spec().actionMutesContent ?
            'TOK_MUTED' : this.spec().actionTextRole, this.scheme))
          .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis })
          .layoutWeight(this.spec().actionIconSize > 0 ? 1 : undefined);
      }.width('100%').height(this.spec().actionHeight)
        .padding({ left: this.spec().actionPaddingLeft, right: this.spec().actionPaddingRight });
      if (showDivider) {
        Row().width(this.dividerWidth()).height(this.spec().dividerHeight)
          .backgroundColor(readerAppColor(this.spec().dividerRole, this.scheme))
          .position({ x: this.spec().dividerInset, y: this.spec().actionHeight - this.spec().dividerHeight });
      }
    }.width('100%').height(this.spec().actionHeight)
      .backgroundColor(Color.Transparent)
      .opacity(this.action(id).enabled || this.spec().actionMutesContent ? 1 : 0.45)
      .enabled(this.action(id).enabled)
      .accessibilityText(this.action(id).accessibilityLabel)
      .onClick((): void => this.commitAction(id));
  }

  private spec(): PopupSurfaceSpec { return resolvePopupSpec(this.specId); }

  private action(id: string): ReaderMenuActionView {
    return this.actions.find((action: ReaderMenuActionView): boolean => action.id === id) ??
      new ReaderMenuActionView(id, '', false);
  }

  private dividerWidth(): string | number {
    return typeof this.availableWidth === 'number' ?
      Math.max(0, this.availableWidth - this.spec().dividerInset * 2) :
      `calc(100% - ${this.spec().dividerInset * 2}vp)`;
  }

  private commitAction(id: string): void {
    if (this.action(id).enabled) this.onAction(id);
  }
}
