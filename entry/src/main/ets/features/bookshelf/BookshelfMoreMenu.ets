import { readerAppColor } from '../common/ReaderThemeRegistry';
import { motionAnimateParam } from '../common/MotionSpec';
import { registerReaderFonts } from '../common/ReaderFonts';

const MENU_WIDTH = 176;
const POINTER_HEIGHT = 12;
const ACTION_HEIGHT = 50;
const ACTION_COUNT = 3;
const ACTIONS_HEIGHT = ACTION_HEIGHT * ACTION_COUNT;
const MENU_HEIGHT = POINTER_HEIGHT + ACTIONS_HEIGHT;
const MENU_COLLAPSED_HEIGHT = POINTER_HEIGHT + ACTION_HEIGHT;
const MENU_TRAILING_EXTENSION = 11;
const MENU_ANCHOR_OVERLAP = 5;
const SURFACE_ASSET_WIDTH = 232;
const SURFACE_ASSET_HEIGHT = 268;
const SURFACE_SHADOW_INSET_X = 28;
const SURFACE_SHADOW_INSET_TOP = 18;
const POINTER_POINTS: Array<Array<number>> = [[0, 12], [12, 0], [24, 12]];

/**
 * Bookshelf top-bar More overlay.
 *
 * Figma interaction registry `1982:313` declares nav.more -> Menu overlay ->
 * dropdown.expand. The approved phone style reference `4572:1796` supplies
 * the integrated-pointer surface and row geometry. Existing product actions
 * remain wired here; `2236:547` stays an outside-dismiss semantic.
 */
@Component
export struct BookshelfMoreMenu {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';

  @Prop anchorRight: number = 0;
  @Prop anchorBottom: number = 0;
  @Prop reduceMotion: boolean = false;
  onBatchManage: () => void = (): void => {};
  onLocalImport: () => void = (): void => {};
  onBookshelfSettings: () => void = (): void => {};
  onDismiss: () => void = (): void => {};
  @State private panelHeight: number = MENU_COLLAPSED_HEIGHT;
  @State private closeInFlight: boolean = false;
  private mounted: boolean = false;
  private generation: number = 0;

  aboutToAppear(): void {
    this.mounted = true;
    this.generation += 1;
    registerReaderFonts(this.getUIContext().getFont());
  }

  aboutToDisappear(): void { this.mounted = false; this.generation += 1; }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Row()
        .width('100%')
        .height('100%')
        .backgroundColor(Color.Transparent)
        .accessibilityText('关闭更多')
        .onClick((): void => this.collapseMenu((): void => this.onDismiss()));

      Stack({ alignContent: Alignment.TopStart }) {
          Row()
            .width(MENU_WIDTH)
            .height(this.panelHeight - POINTER_HEIGHT)
            .backgroundColor(readerAppColor('app.BookshelfMoreMenu.build.backgroundColor.FFFFFCF8', this.appThemeScheme))
            .border({ width: 1, color: readerAppColor('app.BookshelfMoreMenu.build.color.FFE3DED6', this.appThemeScheme) })
            .borderRadius(16)
            .shadow({ radius: 28, color: readerAppColor('app.BookshelfMoreMenu.build.color.292E261F', this.appThemeScheme), offsetX: 0, offsetY: 10 })
            .position({ x: 0, y: POINTER_HEIGHT });

          Polygon({ width: 24, height: POINTER_HEIGHT + 1 })
            .points(POINTER_POINTS)
            .fill(readerAppColor('app.BookshelfMoreMenu.build.fill.FFFFFCF8', this.appThemeScheme))
            .stroke(Color.Transparent)
            .position({ x: 131, y: 0.5 });

          // Cover the rounded body's top border beneath the pointer so the
          // pointer and body keep the reference asset's continuous outline.
          Row()
            .width(24)
            .height(2)
            .backgroundColor(readerAppColor('app.BookshelfMoreMenu.build.backgroundColor.FFFFFCF8', this.appThemeScheme))
            .position({ x: 131, y: 11.5 });

          Polyline({ width: 24, height: POINTER_HEIGHT + 1 })
            .points(POINTER_POINTS)
            .fill(Color.Transparent)
            .stroke(readerAppColor('app.BookshelfMoreMenu.build.stroke.FFE3DED6', this.appThemeScheme))
            .strokeWidth(1)
            .strokeLineJoin(LineJoinStyle.Round)
            .position({ x: 131, y: 0.5 });

        Stack({ alignContent: Alignment.TopStart }) {
          Column() {
            this.action((this.appThemeScheme === 'night' ? $r('app.media.bookshelf_more_batch_theme_night') : $r('app.media.bookshelf_more_batch')), '批量管理', true,
              (): void => this.onBatchManage());
            this.action((this.appThemeScheme === 'night' ? $r('app.media.bookshelf_more_import_theme_night') : $r('app.media.bookshelf_more_import')), '本地导入', true,
              (): void => this.onLocalImport());
            this.action((this.appThemeScheme === 'night' ? $r('app.media.bookshelf_more_settings_theme_night') : $r('app.media.bookshelf_more_settings')), '书架设置', false,
              (): void => this.onBookshelfSettings());
          }
          .width(MENU_WIDTH)
          .height(ACTIONS_HEIGHT);
        }
        .width(MENU_WIDTH)
        .height(Math.max(0, this.panelHeight - POINTER_HEIGHT))
        .clip(true)
        .position({ x: 0, y: POINTER_HEIGHT });
      }
      .width(MENU_WIDTH)
      .height(MENU_HEIGHT)
      .clip(false)
      .position({
        x: this.anchorRight + MENU_TRAILING_EXTENSION - MENU_WIDTH,
        y: this.anchorBottom - MENU_ANCHOR_OVERLAP,
      })
      .onAppear((): void => this.expandMenu());
    }
    .width('100%')
    .height('100%')
    .zIndex(20);
  }

  @Builder
  private action(icon: Resource, label: string, showDivider: boolean, action: () => void) {
    Stack({ alignContent: Alignment.TopStart }) {
      Row({ space: 16 }) {
        Image(icon)
          .width(24)
          .height(24);

        Text(label)
          .fontFamily('ReaderNotoSansSC')
          .fontWeight(FontWeight.Medium)
          .fontSize(15)
          .lineHeight(22)
          .fontColor(readerAppColor('app.BookshelfMoreMenu.action.fontColor.FF1F1B17', this.appThemeScheme))
          .maxLines(1);
      }
      .width(MENU_WIDTH)
      .height(ACTION_HEIGHT)
      .padding({ left: 18, right: 16 });

      if (showDivider) {
        Divider()
          .width(144)
          .height(1)
          .color(readerAppColor('app.BookshelfMoreMenu.action.color.FFE8E2DA', this.appThemeScheme))
          .position({ x: 16, y: ACTION_HEIGHT - 1 });
      }
    }
    .width(MENU_WIDTH)
    .height(ACTION_HEIGHT)
    .backgroundColor(Color.Transparent)
    .onClick((): void => this.commitAction(action));
  }

  private expandMenu(): void {
    if (!this.mounted || this.closeInFlight) return;
    if (this.reduceMotion) {
      this.panelHeight = MENU_HEIGHT;
      return;
    }
    this.getUIContext().animateTo(motionAnimateParam('dropdown.menu.expand'), (): void => {
      this.panelHeight = MENU_HEIGHT;
    });
  }

  private collapseMenu(onFinish: () => void, onCommit?: () => void): void {
    if (!this.mounted || this.closeInFlight) {
      return;
    }
    this.closeInFlight = true;
    const generation = ++this.generation;
    if (onCommit !== undefined) onCommit();
    if (!this.mounted || generation !== this.generation) return;
    if (this.reduceMotion) {
      this.panelHeight = MENU_COLLAPSED_HEIGHT;
      onFinish();
      return;
    }
    this.getUIContext().animateTo(
      motionAnimateParam('dropdown.menu.collapse', (): void => {
        if (!this.mounted || generation !== this.generation) return;
        onFinish();
      }),
      (): void => {
        this.panelHeight = MENU_COLLAPSED_HEIGHT;
      },
    );
  }

  private commitAction(action: () => void): void {
    if (!this.mounted || this.closeInFlight) return;
    // Capture and dispatch once while this menu owns the click. Host navigation
    // may destroy us immediately; no business action depends on animation finish.
    this.collapseMenu(this.onDismiss, action);
  }
}
