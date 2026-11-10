import { ReaderWindowCoordinator } from '../ReaderWindowCoordinator';
import { MAIN_TABS, type MainTabDef, readerMainTabIconResource } from './ReaderMainTabs';
import { mainTabBottomWidth, readerMainViewport } from '../../features/shell/MainNavigationSpec';
import { ReaderBottomTabBar, type ReaderBottomTabItem } from '../../ui/patterns/ReaderBottomTabBar';
import { registerReaderShelfFonts } from '../../ui/foundation/ReaderFonts';
import { readerInteractiveSafeLeft, readerInteractiveSafeRight } from '../../ui/foundation/ReaderWindowMetrics';
import { readerFloatingTabBottomInset } from '../../ui/layout/ReaderFloatingBarMetrics';
import { SurfaceHorizontalFrame, SurfaceWidthSpec, resolveHorizontalFrame } from '../../ui/layout/SurfaceHorizontalGeometry';

/** Admits product tabs and supplies the existing phone navigation geometry. */
@Component
export struct ReaderBottomNavigation {
  @StorageLink('readerAppScheme') private appThemeScheme: string = 'day';
  @StorageLink('readerAppForeground') private foreground: boolean = true;
  @StorageLink('readerMainViewportRevision') private mainViewportRevision: number = 0;
  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @Prop current: string = 'bookshelf';
  @Prop inputEnabled: boolean = true;
  onSelect: (key: string) => void = (_key: string): void => {};
  onCurrentTap: (key: string) => void = (_key: string): void => {};
  private mounted: boolean = false;

  aboutToAppear(): void {
    this.mounted = true;
    registerReaderShelfFonts(this.getUIContext().getFont());
  }

  aboutToDisappear(): void { this.mounted = false; }

  build() {
    ReaderBottomTabBar({
      items: this.items(), current: this.current, scheme: this.appThemeScheme,
      surfaceWidth: this.bottomBarFrame().width, translateX: this.bottomBarTranslateX(),
      bottomInset: this.bottomInset(), fontScale: this.navigationFontScale(), inputEnabled: this.inputIsEnabled(),
      onSelect: (key: string): void => { if (this.acceptsInput(key)) this.onSelect(key); },
      onCurrentTap: (key: string): void => { if (this.acceptsInput(key)) this.onCurrentTap(key); },
    });
  }

  private items(): ReaderBottomTabItem[] {
    return MAIN_TABS.map((tab: MainTabDef): ReaderBottomTabItem => ({ key: tab.key, label: tab.label,
      icon: $r(`app.media.${readerMainTabIconResource(tab.key, this.current === tab.key, this.appThemeScheme)}`) }));
  }

  private inputIsEnabled(): boolean { return this.mounted && this.foreground && this.inputEnabled; }

  private acceptsInput(key: string): boolean {
    return this.inputIsEnabled() && MAIN_TABS.some((tab: MainTabDef): boolean => tab.key === key);
  }

  private navigationFontScale(): number {
    return this.readerWindowMetricsRevision < 0 ? 1 : ReaderWindowCoordinator.metrics().systemFontScale;
  }

  private bottomBarFrame(): SurfaceHorizontalFrame {
    const metrics = ReaderWindowCoordinator.metrics();
    const width = this.liveWindowWidth();
    return resolveHorizontalFrame(
      width,
      readerInteractiveSafeLeft(metrics),
      readerInteractiveSafeRight(metrics),
      new SurfaceWidthSpec(mainTabBottomWidth(MAIN_TABS.length), 32, 32, 'center'),
    );
  }

  private bottomBarTranslateX(): number {
    const frame = this.bottomBarFrame();
    return (frame.left - frame.right) / 2;
  }

  private bottomInset(): number {
    if (this.readerWindowMetricsRevision < 0) return 15;
    return readerFloatingTabBottomInset(ReaderWindowCoordinator.metrics());
  }

  private liveWindowWidth(): number {
    if (this.readerWindowMetricsRevision < 0) return 0;
    const width = readerMainViewport(this.mainViewportRevision).width;
    return Number.isFinite(width) && width > 0 ? width : 0;
  }
}
