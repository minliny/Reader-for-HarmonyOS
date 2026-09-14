import { readerAppColor } from '../common/ReaderThemeRegistry';
import { motionAnimateParam } from '../common/MotionSpec';
import { registerReaderFonts } from '../common/ReaderFonts';

const MENU_WIDTH = 176;
const POINTER_HEIGHT = 12;
const ACTION_HEIGHT = 50;
const ACTION_COUNT = 4;
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
  onCheckUpdates: () => void = (): void => {};
  @Prop canCheckUpdates: boolean = false;
  @Prop updateRunning: boolean = false;
  @Prop backgroundUpdateRunning: boolean = false;
  @Prop updateProgressDone: number = 0;
  @Prop updateProgressTotal: number = 0;
  @State private overlayWidth: number = 0;
  @State private overlayHeight: number = 0;
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
            .width(this.menuWidth())
            .height(Math.max(0, this.visiblePanelHeight() - POINTER_HEIGHT))
            .backgroundColor(readerAppColor('app.BookshelfMoreMenu.build.backgroundColor.FFFFFCF8', this.appThemeScheme))
            .border({ width: 1, color: readerAppColor('app.BookshelfMoreMenu.build.color.FFE3DED6', this.appThemeScheme) })
            .borderRadius(16)
            .shadow({ radius: 28, color: readerAppColor('app.BookshelfMoreMenu.build.color.292E261F', this.appThemeScheme), offsetX: 0, offsetY: 10 })
            .position({ x: 0, y: POINTER_HEIGHT });

          Polygon({ width: 24, height: POINTER_HEIGHT + 1 })
            .points(POINTER_POINTS)
            .fill(readerAppColor('app.BookshelfMoreMenu.build.fill.FFFFFCF8', this.appThemeScheme))
            .stroke(Color.Transparent)
            .position({ x: this.pointerX(), y: 0.5 });

          // Cover the rounded body's top border beneath the pointer so the
          // pointer and body keep the reference asset's continuous outline.
          Row()
            .width(24)
            .height(2)
            .backgroundColor(readerAppColor('app.BookshelfMoreMenu.build.backgroundColor.FFFFFCF8', this.appThemeScheme))
            .position({ x: this.pointerX(), y: 11.5 });

          Polyline({ width: 24, height: POINTER_HEIGHT + 1 })
            .points(POINTER_POINTS)
            .fill(Color.Transparent)
            .stroke(readerAppColor('app.BookshelfMoreMenu.build.stroke.FFE3DED6', this.appThemeScheme))
            .strokeWidth(1)
            .strokeLineJoin(LineJoinStyle.Round)
            .position({ x: this.pointerX(), y: 0.5 });

        Scroll() {
          Column() {
            this.action('batch', true, (): void => this.onBatchManage());
            this.action('import', true, (): void => this.onLocalImport());
            this.action('update', true, (): void => this.onCheckUpdates());
            this.action('settings', false, (): void => this.onBookshelfSettings());
          }
          .width(this.menuWidth())
          .height(ACTIONS_HEIGHT);
        }
        .width(this.menuWidth())
        .height(Math.max(0, this.visiblePanelHeight() - POINTER_HEIGHT))
        .clip(true)
        .scrollBar(BarState.Auto)
        .position({ x: 0, y: POINTER_HEIGHT });
      }
      .width(this.menuWidth())
      .height(this.visiblePanelHeight())
      .visibility(this.overlayWidth > 0 && this.overlayHeight > 0 ? Visibility.Visible : Visibility.Hidden)
      .clip(false)
      .position({
        x: this.menuX(),
        y: this.menuTop(),
      })
      .onAppear((): void => this.expandMenu());
    }
    .width('100%')
    .height('100%')
    .onAreaChange((_oldValue: Area, area: Area): void => {
      this.overlayWidth = Math.max(0, Number(area.width));
      this.overlayHeight = Math.max(0, Number(area.height));
    })
    .zIndex(20);
  }

  @Builder
  private action(key: string, showDivider: boolean, action: () => void) {
    Stack({ alignContent: Alignment.TopStart }) {
      Row({ space: 16 }) {
        Image(this.actionIcon(key))
          .width(24)
          .height(24).opacity(this.actionEnabled(key) ? 1 : 0.45);

        Text(this.actionLabel(key))
          .fontFamily('ReaderNotoSansSC')
          .fontWeight(FontWeight.Medium)
          .fontSize(15)
          .lineHeight(22)
          .fontColor(this.actionEnabled(key) ? readerAppColor('app.BookshelfMoreMenu.action.fontColor.FF1F1B17', this.appThemeScheme) : readerAppColor('TOK_MUTED', this.appThemeScheme))
          .maxLines(1).textOverflow({ overflow: TextOverflow.Ellipsis }).layoutWeight(1);
      }
      .width(this.menuWidth())
      .height(ACTION_HEIGHT)
      .padding({ left: 18, right: 16 });

      if (showDivider) {
        Divider()
          .width(Math.max(0, this.menuWidth() - 32))
          .height(1)
          .color(readerAppColor('app.BookshelfMoreMenu.action.color.FFE8E2DA', this.appThemeScheme))
          .position({ x: 16, y: ACTION_HEIGHT - 1 });
      }
    }
    .width(this.menuWidth())
    .height(ACTION_HEIGHT)
    .backgroundColor(Color.Transparent)
    .enabled(this.actionEnabled(key))
    .accessibilityText(key === 'update' && !this.canCheckUpdates ? '检查更新，没有在线书籍' : this.actionLabel(key))
    .onClick((): void => { if (this.actionEnabled(key)) this.commitAction(action); });
  }

  private actionEnabled(key: string): boolean {
    return !this.closeInFlight && (key !== 'update' || (this.canCheckUpdates && !this.updateRunning && !this.backgroundUpdateRunning));
  }

  private actionLabel(key: string): string {
    if (key === 'batch') return '批量管理';
    if (key === 'import') return '本地导入';
    if (key === 'settings') return '书架设置';
    if (this.updateRunning) return `检查中 ${this.updateProgressDone}/${this.updateProgressTotal}`;
    return this.backgroundUpdateRunning ? '正在自动检查' : '检查更新';
  }

  private actionIcon(key: string): Resource {
    if (key === 'batch') return this.appThemeScheme === 'night' ? $r('app.media.bookshelf_more_batch_theme_night') : $r('app.media.bookshelf_more_batch');
    if (key === 'import') return this.appThemeScheme === 'night' ? $r('app.media.bookshelf_more_import_theme_night') : $r('app.media.bookshelf_more_import');
    if (key === 'update') return this.appThemeScheme === 'night' ? $r('app.media.settings_gen_refresh_theme_night') : $r('app.media.settings_gen_refresh');
    return this.appThemeScheme === 'night' ? $r('app.media.bookshelf_more_settings_theme_night') : $r('app.media.bookshelf_more_settings');
  }

  // The parent is already inside Index's safe area and MainTabShell's nav.
  // Clamp in its measured local frame; never add the system insets twice.
  private menuWidth(): number {
    return this.overlayWidth > 0 ? Math.min(MENU_WIDTH, Math.max(0, this.overlayWidth - 16)) : MENU_WIDTH;
  }

  private menuX(): number {
    const preferred = this.anchorRight + MENU_TRAILING_EXTENSION - this.menuWidth();
    return Math.max(8, Math.min(preferred, this.overlayWidth - this.menuWidth() - 8));
  }

  private menuTop(): number {
    return Math.max(0, Math.min(this.anchorBottom - MENU_ANCHOR_OVERLAP,
      this.overlayHeight - MENU_COLLAPSED_HEIGHT - 8));
  }

  private visiblePanelHeight(): number {
    return Math.max(0, Math.min(this.panelHeight, this.overlayHeight - this.menuTop() - 8));
  }

  private pointerX(): number {
    return Math.max(0, Math.min(this.menuWidth() - 24, this.anchorRight - 22 - this.menuX() - 12));
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
