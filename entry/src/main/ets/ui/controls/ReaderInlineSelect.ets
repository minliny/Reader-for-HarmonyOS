import { readerWindowMetrics } from '../foundation/ReaderWindowEnvironment';
import { readerInteractiveSafeTop, readerInteractiveSafeBottom } from '../foundation/ReaderWindowMetrics';
import { ReaderSelect, type ReaderSelectVariant } from './ReaderSelect';
import { ReaderSelectPanel } from './ReaderSelectPanel';
import type { ReaderSelectMenuKind } from '../foundation/ReaderSelectGeometry';

/**
 * Bounded select host for secondary pages. Native Select used to bypass the
 * Reader choice contract and could render a platform menu above/behind a
 * translucent page shell. This host keeps the trigger and its menu in the
 * same ReaderSelect/ReaderSelectPanel family while retaining a small,
 * self-contained API for pages that do not own a larger overlay stack.
 * The platform popup is only the window/anchor host; all menu content and
 * choice behavior remain ReaderSelectPanel. A menu never grows a list row.
 */
@Component
export struct ReaderInlineSelect {
  @StorageLink('readerWindowMetricsRevision') private metricsRevision: number = 0;
  @Prop value: string = '';
  @Prop options: string[] = [];
  @Prop selectedIndex: number = 0;
  @Prop controlWidth: number = 0;
  @Prop maxTriggerWidthVp: number = -1;
  @Prop menuKind: ReaderSelectMenuKind = 'standard';
  @Prop variant: ReaderSelectVariant = 'default';
  @Prop reduceMotion: boolean = false;
  @Prop @Watch('onEligibilityChanged') actionEnabled: boolean = true;
  onSelect: (index: number, value: string) => void = (_index: number, _value: string): void => {};
  @State private open: boolean = false;
  @State private selectionId: string = '';
  private mounted: boolean = false;
  private generation: number = 0;

  aboutToAppear(): void { this.mounted = true; }
  aboutToDisappear(): void { this.mounted = false; this.open = false; this.generation += 1; }

  private onEligibilityChanged(): void {
    if (this.actionEnabled) return;
    this.open = false;
    this.selectionId = '';
    this.generation += 1;
  }

  private toggle(): void {
    if (!this.mounted || !this.actionEnabled) return;
    this.selectionId = `inline-${++this.generation}`;
    this.open = !this.open;
  }

  private commit(value: string, identity: string): void {
    if (!this.mounted || !this.actionEnabled || !this.open || identity !== this.selectionId) return;
    const index = this.options.indexOf(value);
    if (index < 0) return;
    this.onSelect(index, value);
    this.open = false;
  }

  private dismiss(identity: string): void {
    if (identity !== this.selectionId) return;
    this.open = false;
  }

  private popupOptions(identity: string): CustomPopupOptions {
    return { builder: (): void => this.menu(identity), placement: Placement.Bottom,
      enableArrow: false, popupColor: Color.Transparent, autoCancel: true, focusable: true,
      onStateChange: (event: PopupStateChangeParam): void => { if (!event.isVisible) this.dismiss(identity); } };
  }

  @Builder
  private menu(identity: string) {
    if (this.variant === 'default' || this.variant === 'sourceGroup' || this.variant === 'appearanceLibrary') {
      this.selectPanel(identity);
    } else {
    Scroll() {
      this.selectPanel(identity);
    }.constraintSize({ maxHeight: 288 }).scrollBar(BarState.Auto);
    }
  }

  private popupViewportHeight(): number {
    const metrics = readerWindowMetrics();
    const height = this.metricsRevision < 0 ? 0 : metrics.windowRect.height;
    return Number.isFinite(height) ? Math.max(0, height - readerInteractiveSafeTop(metrics) -
      readerInteractiveSafeBottom(metrics, true) - 32) : 0;
  }

  @Builder
  private selectPanel(identity: string) {
      ReaderSelectPanel({ hosting: 'popup', hostBottomVp: this.popupViewportHeight(),
        value: this.value, options: this.options,
        variant: this.variant, controlWidth: this.controlWidth, reduceMotion: this.reduceMotion,
        menuKind: this.menuKind,
        selectionId: identity, x: 0, y: 0,
        onCommit: (value: string, actorIdentity: string): void => this.commit(value, actorIdentity),
        onDismiss: (actorIdentity: string): void => this.dismiss(actorIdentity) });
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      ReaderSelect({
        value: this.value,
        options: this.options,
        isOpen: this.open,
        actionEnabled: this.actionEnabled,
        variant: this.variant,
        controlWidth: this.controlWidth,
        maxTriggerWidthVp: this.maxTriggerWidthVp,
        reduceMotion: this.reduceMotion,
        // Disabled triggers remain visible and preserve the shared geometry.
        onToggle: (): void => this.toggle(),
      });
    }
    .width(this.variant === 'default' ? 'auto' : this.controlWidth > 0 ? this.controlWidth : 'auto')
    .constraintSize({ minHeight: 44 })
    .opacity(this.actionEnabled ? 1 : 0.4)
    .bindPopup(this.open, this.popupOptions(this.selectionId));
  }
}
