import { MainTabBar } from './MainTabBar';
import { MAIN_TABS, MAIN_TAB_RAIL_WIDTH, mainTabRailHeight, readerMainRailLeft, readerMainRailTop } from './MainNavigationSpec';
import { ReaderWindowCoordinator } from '../../app/ReaderWindowCoordinator';
import type { ReaderNavigationAppearance } from '../../app/HarmonyCapabilityPolicy';
import { ReaderNavigationAppearanceHost } from '../../app/navigation/ReaderNavigationAppearanceHost';
import { ReaderSystemNavigationBar } from '../../app/navigation/ReaderSystemNavigationBar';

/** The shared wide-screen navigation rail. The owning page decides whether
 * rail placement is active; this component only owns position and dispatch. */
@Component
export struct MainNavigationRail {
  @StorageProp('readerMainViewportRevision') private mainViewportRevision: number = 0;
  @StorageProp('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @Prop activeTab: string = 'bookshelf';
  @Prop navigationGeneration: number = 0;
  onSelect: (key: string, generation: number) => void = (_key: string, _generation: number): void => {};
  onCurrentTap: (key: string, generation: number) => void = (_key: string, _generation: number): void => {};

  build() {
    ForEach([this.navigationGeneration], (generation: number): void => {
      ReaderNavigationAppearanceHost({
        unifiedContent: (): void => { this.unifiedRail(generation); },
        nativeContent: (appearance: ReaderNavigationAppearance): void => {
          this.nativeRail(appearance, generation);
        },
      })
        .position({ x: readerMainRailLeft(this.readerWindowMetricsRevision),
          y: readerMainRailTop(this.mainViewportRevision, this.readerWindowMetricsRevision) });
    }, (generation: number): string => generation.toString());
  }

  @Builder
  private unifiedRail(generation: number) {
    MainTabBar({
      current: this.activeTab, vertical: true,
      onSelect: (key: string): void => this.select(key, generation),
      onCurrentTap: (key: string): void => this.selectCurrent(key, generation),
    });
  }

  @Builder
  private nativeRail(appearance: ReaderNavigationAppearance, generation: number) {
    ReaderSystemNavigationBar({
      current: this.activeTab, vertical: true, appearance,
      surfaceWidth: MAIN_TAB_RAIL_WIDTH,
      surfaceHeight: mainTabRailHeight(MAIN_TABS.length, this.railFontScale()),
      onSelect: (key: string): void => this.select(key, generation),
      onCurrentTap: (key: string): void => this.selectCurrent(key, generation),
    });
  }

  private select(key: string, generation: number): void {
    if (generation === this.navigationGeneration) this.onSelect(key, generation);
  }

  private selectCurrent(key: string, generation: number): void {
    if (generation === this.navigationGeneration) this.onCurrentTap(key, generation);
  }

  private railFontScale(): number {
    return this.readerWindowMetricsRevision < 0 ? 1 : ReaderWindowCoordinator.metrics().systemFontScale;
  }
}
