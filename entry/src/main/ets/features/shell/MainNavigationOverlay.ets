import { MainNavigationRail } from './MainNavigationRail';

/** Shared owner for the wide-screen rail overlay. Shells provide only the
 * placement decision and their business overlay content. */
@Component
export struct MainNavigationOverlay {
  @Prop railActive: boolean = false;
  @Prop activeTab: string = 'bookshelf';
  @Prop navigationGeneration: number = 0;
  onSelect: (key: string, generation: number) => void = (_key: string, _generation: number): void => {};
  onCurrentTap: (key: string, generation: number) => void = (_key: string, _generation: number): void => {};
  @BuilderParam overlayContent: () => void = this.emptySlot;

  @Builder
  private emptySlot() {}

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      if (this.railActive) {
        MainNavigationRail({
          activeTab: this.activeTab,
          navigationGeneration: this.navigationGeneration,
          onSelect: (key: string, generation: number): void => this.onSelect(key, generation),
          onCurrentTap: (key: string, generation: number): void => this.onCurrentTap(key, generation),
        });
      }
      this.overlayContent();
    }.width('100%').height('100%').hitTestBehavior(HitTestMode.Transparent);
  }
}
