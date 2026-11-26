import lazy { HdsTabs, hdsMaterial } from '@kit.UIDesignKit';
import type { HdsTabsFloatingStyle } from '@kit.UIDesignKit';
import { MAIN_TABS, readerMainTabIconResource, type MainTabDef } from './ReaderMainTabs';
import type { ReaderNavigationAppearance, ReaderNavigationPreferences, ReaderSurfaceMaterialDecision } from '../HarmonyCapabilityPolicy';
import { readerAppColor } from '../../ui/foundation/ReaderThemeRegistry';
import { defaultNavigationPreferences, ReaderImmersiveMaterialModifier, readerSurfaceMaterialDecision } from '../../ui/surfaces/ReaderSurfaceMaterial';

/** HDS renders the bounded navigation bar. The shell's routed page and its
 * scroller stay mounted as siblings of this navigation-only host. */
@Component
export struct ReaderSystemNavigationBar {
  @StorageLink('readerAppScheme') private scheme: string = 'day';
  @StorageLink('readerSystemScheme') private systemScheme: string = 'day';
  @StorageProp('readerNavigationAppearancePreferences')
  private navigationAppearance: ReaderNavigationPreferences = defaultNavigationPreferences();
  @Prop current: string = 'bookshelf';
  @Prop appearance: ReaderNavigationAppearance = 'adaptive';
  @Prop surfaceWidth: number = 0;
  @Prop surfaceHeight: number = 0;
  @Prop vertical: boolean = false;
  @Prop inputEnabled: boolean = true;
  onSelect: (key: string) => void = (_key: string): void => {};
  onCurrentTap: (key: string) => void = (_key: string): void => {};
  private mounted: boolean = false;

  aboutToAppear(): void { this.mounted = true; }
  aboutToDisappear(): void { this.mounted = false; }

  build() {
    if (this.surfaceWidth > 0 && this.surfaceHeight > 0) {
      if (this.vertical) this.rail();
      else this.bottomBar();
    }
  }

  @Builder
  private tabItems() {
    ForEach(MAIN_TABS, (tab: MainTabDef): void => {
      TabContent() {
        Stack() {}.width(0).height(0).accessibilityLevel('no');
      }.tabBar(BottomTabBarStyle.of($r(`app.media.${readerMainTabIconResource(tab.key, tab.key === this.current, this.scheme)}`),
        tab.label).labelStyle({ selectedColor: readerAppColor('TOK_GREEN', this.scheme),
        unselectedColor: readerAppColor('TOK_MUTED', this.scheme) }).id(`reader-main-tab-${tab.key}`));
    }, (tab: MainTabDef): string => tab.key);
  }

  @Builder
  private bottomBar() {
    HdsTabs({ index: this.selectedIndex() }) {
      this.tabItems();
    }.width(this.surfaceWidth).height(this.surfaceHeight)
    .vertical(false).barPosition(BarPosition.End).barOverlap(true)
    .barFloatingStyle(this.floatingStyle())
    .scrollable(false).animationDuration(0).enabled(this.inputEnabled)
    .onContentWillChange(this.selectionHandler(this.current))
    .onTabBarClick(this.currentTapHandler(this.current));
  }

  @Builder
  private rail() {
    HdsTabs({ index: this.selectedIndex() }) {
      this.tabItems();
    }.width(this.surfaceWidth).height(this.surfaceHeight)
    .vertical(true).barPosition(BarPosition.Start).barOverlap(false).barMode(BarMode.Fixed)
    .barWidth(this.surfaceWidth).barHeight(this.surfaceHeight)
    .barBackgroundColor(Color.Transparent)
    .barBackgroundBlurStyle(this.railMaterial()?.native ? BlurStyle.NONE : BlurStyle.COMPONENT_THICK)
    .backgroundEffect(undefined).backgroundColor(Color.Transparent)
    .border({ width: 0, color: Color.Transparent }).shadow(undefined)
    .attributeModifier(new ReaderImmersiveMaterialModifier(this.railMaterial()))
    .scrollable(false).animationDuration(0).enabled(this.inputEnabled)
    .onContentWillChange(this.selectionHandler(this.current))
    .onTabBarClick(this.currentTapHandler(this.current));
  }

  private railMaterial(): ReaderSurfaceMaterialDecision | undefined {
    return this.appearance === 'immersive' ?
      readerSurfaceMaterialDecision('chromeBar', this.navigationAppearance, this.scheme, this.systemScheme) : undefined;
  }

  private selectedIndex(): number {
    return Math.max(0, MAIN_TABS.findIndex((tab: MainTabDef): boolean => tab.key === this.current));
  }

  private floatingStyle(): HdsTabsFloatingStyle {
    return {
      barWidth: { smallWidth: this.surfaceWidth, mediumWidth: this.surfaceWidth, largeWidth: this.surfaceWidth },
      barBottomMargin: 0,
      gradientMask: { maskColor: Color.Transparent, maskHeight: this.surfaceHeight },
      adaptToHandedness: false,
      systemMaterialEffect: {
        materialType: this.appearance === 'immersive' ? hdsMaterial.MaterialType.IMMERSIVE : hdsMaterial.MaterialType.ADAPTIVE,
        materialLevel: hdsMaterial.MaterialLevel.ADAPTIVE,
      },
    };
  }

  private selectionHandler(presentedTab: string): (_from: number, to: number) => boolean {
    return (_from: number, index: number): boolean => {
      const tab = MAIN_TABS[index];
      if (!this.mounted || tab === undefined) return false;
      // The index Prop itself can trigger this callback. Admit owner-driven
      // paint even if the platform has not yet replaced the old closure.
      if (tab.key === this.current) return true;
      if (this.inputEnabled && presentedTab === this.current) this.onSelect(tab.key);
      // The routed page owns selected state. Veto HDS-local selection.
      return false;
    };
  }

  private currentTapHandler(presentedTab: string): (index: number) => void {
    return (index: number): void => {
      if (this.mounted && this.inputEnabled && presentedTab === this.current &&
        MAIN_TABS[index]?.key === presentedTab) this.onCurrentTap(presentedTab);
    };
  }
}
