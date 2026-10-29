import { MainTabBar } from './MainTabBar';
import { readerMainRailLeft, readerMainRailTop } from './MainNavigationSpec';

/** The shared wide-screen navigation rail. The owning page decides whether
 * rail placement is active; this component only owns position and dispatch. */
@Component
export struct MainNavigationRail {
  @StorageLink('readerMainViewportRevision') private mainViewportRevision: number = 0;
  @StorageLink('readerWindowMetricsRevision') private readerWindowMetricsRevision: number = 0;
  @Prop activeTab: string = 'bookshelf';
  @Prop navigationGeneration: number = 0;
  onSelect: (key: string, generation: number) => void = (_key: string, _generation: number): void => {};
  onCurrentTap: (key: string, generation: number) => void = (_key: string, _generation: number): void => {};

  build() {
    ForEach([this.navigationGeneration], (generation: number): void => {
      MainTabBar({
        current: this.activeTab,
        vertical: true,
        onSelect: (key: string): void => {
          if (generation === this.navigationGeneration) this.onSelect(key, generation);
        },
        onCurrentTap: (key: string): void => {
          if (generation === this.navigationGeneration) this.onCurrentTap(key, generation);
        },
      })
        .position({ x: readerMainRailLeft(this.readerWindowMetricsRevision),
          y: readerMainRailTop(this.mainViewportRevision, this.readerWindowMetricsRevision) });
    }, (generation: number): string => generation.toString());
  }
}
