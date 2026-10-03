import { ReaderActionMenuSurface, ReaderMenuActionView } from '../common/ReaderActionMenuSurface';
import { readerAppColor } from '../common/ReaderThemeRegistry';
import { motionAnimateParam } from '../common/MotionSpec';
import { registerReaderFonts } from '../common/ReaderFonts';
import { PopupSurfaceSpec, resolvePopupSpec } from '../common/ReaderSurfaceSpecs';

const SURFACE_ASSET_WIDTH = 232;
const SURFACE_ASSET_HEIGHT = 268;
const SURFACE_SHADOW_INSET_X = 28;
const SURFACE_SHADOW_INSET_TOP = 18;

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
  @State private panelHeight: number = resolvePopupSpec('bookshelf-more-menu').collapsedHeight;
  @State private closeInFlight: boolean = false;
  private mounted: boolean = false;
  private generation: number = 0;

  private surfaceSpec(): PopupSurfaceSpec {
    return resolvePopupSpec('bookshelf-more-menu');
  }

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
            .height(Math.max(0, this.visiblePanelHeight() - this.surfaceSpec().pointerHeight))
            .backgroundColor(readerAppColor(this.surfaceSpec().surfaceBackgroundRole, this.appThemeScheme))
            .border({ width: this.surfaceSpec().borderWidth, color: readerAppColor(this.surfaceSpec().surfaceBorderRole, this.appThemeScheme) })
            .borderRadius(this.surfaceSpec().borderRadius)
            .shadow({ radius: this.surfaceSpec().shadowRadius, color: readerAppColor(this.surfaceSpec().surfaceShadowRole, this.appThemeScheme), offsetX: 0, offsetY: this.surfaceSpec().shadowOffsetY })
            .position({ x: 0, y: this.surfaceSpec().pointerHeight });

          Polygon({ width: this.surfaceSpec().pointerWidth, height: this.surfaceSpec().pointerHeight + 1 })
            .points(this.surfaceSpec().pointerPoints)
            .fill(readerAppColor(this.surfaceSpec().pointerFillRole, this.appThemeScheme))
            .stroke(Color.Transparent)
            .position({ x: this.pointerX(), y: 0.5 });

          // Cover the rounded body's top border beneath the pointer so the
          // pointer and body keep the reference asset's continuous outline.
          Row()
            .width(this.surfaceSpec().pointerWidth)
            .height(2)
            .backgroundColor(readerAppColor(this.surfaceSpec().surfaceBackgroundRole, this.appThemeScheme))
            .position({ x: this.pointerX(), y: this.surfaceSpec().pointerHeight - 0.5 });

          Polyline({ width: this.surfaceSpec().pointerWidth, height: this.surfaceSpec().pointerHeight + 1 })
            .points(this.surfaceSpec().pointerPoints)
            .fill(Color.Transparent)
            .stroke(readerAppColor(this.surfaceSpec().pointerStrokeRole, this.appThemeScheme))
            .strokeWidth(1)
            .strokeLineJoin(LineJoinStyle.Round)
            .position({ x: this.pointerX(), y: 0.5 });

        this.menuContent();
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
  private menuContent() {
    ReaderActionMenuSurface({
      specId: 'bookshelf-more-menu', scheme: this.appThemeScheme,
      actions: this.menuActions(), availableWidth: this.menuWidth(),
      viewportHeight: Math.max(0, this.visiblePanelHeight() - this.surfaceSpec().pointerHeight),
      onAction: (id: string): void => this.performMenuAction(id),
    }).position({ x: 0, y: this.surfaceSpec().pointerHeight });
  }

  private menuActions(): ReaderMenuActionView[] {
    return ['batch', 'import', 'update', 'settings'].map((id: string): ReaderMenuActionView =>
      new ReaderMenuActionView(id, this.actionLabel(id), this.actionEnabled(id), this.actionIcon(id),
        id === 'update' && !this.canCheckUpdates ? '检查更新，没有在线书籍' : this.actionLabel(id)));
  }

  private performMenuAction(id: string): void {
    if (!this.actionEnabled(id)) return;
    if (id === 'batch') this.commitAction(this.onBatchManage);
    else if (id === 'import') this.commitAction(this.onLocalImport);
    else if (id === 'update') this.commitAction(this.onCheckUpdates);
    else if (id === 'settings') this.commitAction(this.onBookshelfSettings);
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
    return this.overlayWidth > 0 ? Math.min(this.surfaceSpec().width, Math.max(0, this.overlayWidth - 16)) : this.surfaceSpec().width;
  }

  private menuX(): number {
    const preferred = this.anchorRight + this.surfaceSpec().trailingExtension - this.menuWidth();
    return Math.max(8, Math.min(preferred, this.overlayWidth - this.menuWidth() - 8));
  }

  private menuTop(): number {
    return Math.max(0, Math.min(this.anchorBottom - this.surfaceSpec().anchorOverlap,
      this.overlayHeight - this.surfaceSpec().collapsedHeight - 8));
  }

  private visiblePanelHeight(): number {
    return Math.max(0, Math.min(this.panelHeight, this.overlayHeight - this.menuTop() - 8));
  }

  private pointerX(): number {
    return Math.max(0, Math.min(this.menuWidth() - this.surfaceSpec().pointerWidth,
      this.anchorRight - 22 - this.menuX() - this.surfaceSpec().pointerWidth / 2));
  }

  private expandMenu(): void {
    if (!this.mounted || this.closeInFlight) return;
    if (this.reduceMotion) {
      this.panelHeight = this.surfaceSpec().expandedHeight;
      return;
    }
    this.getUIContext().animateTo(motionAnimateParam('dropdown.menu.expand'), (): void => {
      this.panelHeight = this.surfaceSpec().expandedHeight;
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
      this.panelHeight = this.surfaceSpec().collapsedHeight;
      onFinish();
      return;
    }
    this.getUIContext().animateTo(
      motionAnimateParam('dropdown.menu.collapse', (): void => {
        if (!this.mounted || generation !== this.generation) return;
        onFinish();
      }),
      (): void => {
        this.panelHeight = this.surfaceSpec().collapsedHeight;
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
