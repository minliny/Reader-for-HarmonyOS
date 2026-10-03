import { readerAppColor } from '../common/ReaderThemeRegistry';
import { SheetSurfaceSpec, resolveSheetSpec } from '../common/ReaderSurfaceSpecs';

/**
 * Per-book action surface. The host presents this content as a centered
 * opaque floating panel so its outline remains visible on every device.
 *
 * The action contents retain the Figma typography and spacing; the host-level
 * presentation follows the same horizontal inset as the shelf covers.
 */
@Component
export struct BookshelfBookActionSheet {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  onMultiSelect: () => void = (): void => {};
  onEditGroup: () => void = (): void => {};
  onBookInfo: () => void = (): void => {};
  onRemoveFromBookshelf: () => void = (): void => {};

  private surfaceSpec(): SheetSurfaceSpec {
    return resolveSheetSpec('bookshelf-book-action');
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Row() {
        Blank()
          .width(this.surfaceSpec().handleWidth)
          .height(this.surfaceSpec().handleHeight)
          .backgroundColor(readerAppColor(this.surfaceSpec().handleRole, this.appThemeScheme))
          .borderRadius(999);
      }
      .width('100%')
      .height(this.surfaceSpec().handleHeight)
      .justifyContent(FlexAlign.Center)
      .position({ x: 0, y: this.surfaceSpec().handleTop });

      Text('书籍操作')
        .fontFamily(this.surfaceSpec().titleFontFamily)
        .fontWeight(FontWeight.Bold)
        .fontSize(this.surfaceSpec().titleFontSize)
        .lineHeight(this.surfaceSpec().titleLineHeight)
        .fontColor(readerAppColor(this.surfaceSpec().titleRole, this.appThemeScheme))
        .maxLines(1)
        .position({ x: this.surfaceSpec().titleInset, y: this.surfaceSpec().titleTop });

      this.actionSlot('多选', false, this.surfaceSpec().actionY(0), (): void => this.onMultiSelect());
      this.actionSlot('书籍信息', false, this.surfaceSpec().actionY(1), (): void => this.onBookInfo());
      this.actionSlot('编辑分组', false, this.surfaceSpec().actionY(2), (): void => this.onEditGroup());
      this.actionSlot('移除书架', true, this.surfaceSpec().actionY(3), (): void => this.onRemoveFromBookshelf());
    }
    .width('100%')
    .height(this.surfaceSpec().height)
    .backgroundColor(readerAppColor(this.surfaceSpec().backgroundRole, this.appThemeScheme))
    .border({ width: this.surfaceSpec().borderWidth, color: readerAppColor(this.surfaceSpec().borderRole, this.appThemeScheme) })
    .borderRadius({ topLeft: this.surfaceSpec().borderRadius, topRight: this.surfaceSpec().borderRadius, bottomLeft: 0, bottomRight: 0 })
    .shadow({ radius: this.surfaceSpec().shadowRadius, color: readerAppColor(this.surfaceSpec().shadowRole, this.appThemeScheme), offsetX: 0, offsetY: this.surfaceSpec().shadowOffsetY })
    .clip(true);
  }

  @Builder
  private actionSlot(label: string, danger: boolean, y: number, action: () => void) {
    Row() {
      Row() {
        Text(label)
          .fontFamily(this.surfaceSpec().actionLabelFontFamily)
          .fontWeight(FontWeight.Bold)
          .fontSize(this.surfaceSpec().actionLabelFontSize)
          .lineHeight(this.surfaceSpec().actionLabelLineHeight)
          .fontColor(danger ? readerAppColor(this.surfaceSpec().dangerTextRole, this.appThemeScheme) : readerAppColor(this.surfaceSpec().actionTextRole, this.appThemeScheme))
          .maxLines(1);
      }
      .layoutWeight(1)
      .height(this.surfaceSpec().actionHeight)
      .padding({ left: this.surfaceSpec().actionPaddingLeft })
      .alignItems(VerticalAlign.Center)
      .backgroundColor(danger ? readerAppColor(this.surfaceSpec().dangerBackgroundRole, this.appThemeScheme) : readerAppColor(this.surfaceSpec().actionBackgroundRole, this.appThemeScheme))
      .borderRadius(this.surfaceSpec().actionBorderRadius)
      .accessibilityText(label)
      .onClick(action);
    }
    .width('100%')
    .height(this.surfaceSpec().actionHeight)
    .padding({ left: this.surfaceSpec().horizontalInset, right: this.surfaceSpec().horizontalInset })
    .position({ x: 0, y });
  }
}
