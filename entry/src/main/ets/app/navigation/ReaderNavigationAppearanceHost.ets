import { readerHarmonyCapabilities } from '../HarmonyCapabilityProbe';
import { defaultNavigationPreferences } from '../../ui/surfaces/ReaderSurfaceMaterial';
import {
  adoptReaderNavigationAppearance, resolveReaderNavigationAppearance, type ReaderNavigationAppearance,
  type ReaderNavigationPreferences,
} from '../HarmonyCapabilityPolicy';

@Component
export struct ReaderNavigationAppearanceHost {
  @StorageLink('readerNavigationAppearancePreferences') @Watch('refreshAppearance')
  private preferences: ReaderNavigationPreferences = defaultNavigationPreferences();
  @StorageLink('readerAppScheme') @Watch('refreshAppearance') private appScheme: string = 'day';
  @StorageLink('readerSystemScheme') @Watch('refreshAppearance') private systemScheme: string = 'day';
  @StorageLink('readerAppForeground') @Watch('refreshAppearance') private foreground: boolean = true;
  @Prop @Watch('refreshAppearance') inputEnabled: boolean = true;
  @Prop bottomInset: number = 0;
  @Prop translateX: number = 0;
  @BuilderParam unifiedContent: () => void = this.emptyUnified;
  @BuilderParam nativeContent: (appearance: ReaderNavigationAppearance) => void = this.emptyNative;
  @State private shown: ReaderNavigationAppearance = 'unified';
  private mounted: boolean = false;
  private readonly touchIds: Set<number> = new Set<number>();
  private keyPressed: boolean = false;
  private navigationFocused: boolean = false;
  private releaseTimer: number = -1;

  @Builder private emptyUnified() {}
  @Builder private emptyNative(_appearance: ReaderNavigationAppearance) {}

  aboutToAppear(): void {
    this.mounted = true;
    this.refreshAppearance();
  }

  aboutToDisappear(): void {
    this.mounted = false;
    this.releaseInteraction();
  }

  build() {
    Stack() {
      if (this.shown === 'unified') this.unifiedContent();
      else this.nativeContent(this.shown);
    }
    // The placement belongs to this touch observer so the safe-area margin
    // and the space beside the translated capsule stay outside its hit region.
    .margin({ bottom: this.bottomInset })
    .translate({ x: this.translateX })
    .hitTestBehavior(HitTestMode.Default)
    .onTouch((event: TouchEvent): void => this.onTouchActivity(event))
    .onFocus((): void => {
      if (this.mounted && this.inputEnabled && this.foreground) this.navigationFocused = true;
    })
    .onKeyEvent((event: KeyEvent): void => {
      if (!this.inputEnabled || !this.foreground) return;
      if (event.type === KeyType.Down) this.keyPressed = true;
      else if (event.type === KeyType.Up) {
        this.keyPressed = false;
        this.deferRefresh();
      }
    })
    .onBlur((): void => {
      if (!this.navigationFocused && !this.keyPressed) return;
      this.navigationFocused = false;
      this.keyPressed = false;
      this.deferRefresh();
    });
  }

  private onTouchActivity(event: TouchEvent): void {
    if (!this.inputEnabled || !this.foreground) return;
    if (event.type === TouchType.Down) {
      event.changedTouches.forEach((touch: TouchObject): void => { this.touchIds.add(touch.id); });
    } else if (event.type === TouchType.Up) {
      event.changedTouches.forEach((touch: TouchObject): void => { this.touchIds.delete(touch.id); });
      if (this.touchIds.size === 0) this.deferRefresh();
    } else if (event.type === TouchType.Cancel) {
      this.touchIds.clear();
      this.deferRefresh();
    }
  }

  private releaseInteraction(): void {
    if (this.releaseTimer >= 0) clearTimeout(this.releaseTimer);
    this.releaseTimer = -1;
    this.touchIds.clear();
    this.keyPressed = false;
    this.navigationFocused = false;
  }

  private deferRefresh(): void {
    if (this.releaseTimer >= 0) clearTimeout(this.releaseTimer);
    // Let the original Up/click pair finish inside its submitting view before
    // replacing the tab renderer. The content host is outside this Stack.
    this.releaseTimer = setTimeout((): void => {
      this.releaseTimer = -1;
      this.refreshAppearance();
    }, 0);
  }

  private refreshAppearance(): void {
    if (!this.mounted) return;
    const requested = resolveReaderNavigationAppearance(this.preferences, readerHarmonyCapabilities(),
      this.appScheme, this.systemScheme);
    if (!this.inputEnabled || !this.foreground || (requested === 'unified' && this.shown !== 'unified')) {
      // A disabled or retired renderer may never deliver the matching Up or Cancel.
      this.releaseInteraction();
    }
    this.shown = adoptReaderNavigationAppearance(this.shown, requested,
      !this.inputEnabled || !this.foreground || this.touchIds.size > 0 || this.keyPressed ||
      this.navigationFocused || this.releaseTimer >= 0);
  }
}
