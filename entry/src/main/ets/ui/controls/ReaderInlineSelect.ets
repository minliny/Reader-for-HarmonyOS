import { readerWindowMetrics } from '../foundation/ReaderWindowEnvironment';
import { ReaderInsetsVp, ReaderRectVp } from '../foundation/ReaderWindowMetrics';
import { readerOverlayChoiceRowHeight, readerOverlayListHeight, readerOverlayPanel, readerOverlayViewport }
  from '../layout/ReaderOverlayGeometry';
import { readerMotionReducedFadeParam } from '../foundation/ReaderMotionPolicy';
import { readerSurfaceElevation } from '../surfaces/ReaderSurfaceSpecs';
import { ReaderSelect, type ReaderSelectVariant } from './ReaderSelect';
import { ReaderSelectPanel } from './ReaderSelectPanel';
import type { ReaderSelectMenuKind } from '../foundation/ReaderSelectGeometry';

const POPUP_GAP = 4;

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
  @StorageProp('readerWindowMetricsRevision') private metricsRevision: number = 0;
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
  @State private anchor: ReaderRectVp = new ReaderRectVp();
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
    if (!this.mounted || !this.actionEnabled || (!this.open && this.anchor.height <= 0)) return;
    this.selectionId = `inline-${++this.generation}`;
    this.open = !this.open;
  }

  private commit(value: string, identity: string, index: number): void {
    if (!this.mounted || !this.actionEnabled || !this.open || identity !== this.selectionId) return;
    if (index < 0 || this.options[index] !== value) return;
    this.onSelect(index, value);
    this.open = false;
  }

  private dismiss(identity: string): void {
    if (identity !== this.selectionId) return;
    this.open = false;
  }

  private popupOptions(identity: string): CustomPopupOptions {
    return { builder: (): void => this.selectPanel(identity),
      placement: this.popupAbove() ? Placement.Top : Placement.Bottom, targetSpace: POPUP_GAP,
      enableArrow: false, popupColor: Color.Transparent, backgroundBlurStyle: BlurStyle.NONE,
      radius: 0, shadow: readerSurfaceElevation('embedded', 'day'), autoCancel: true, focusable: true,
      transition: this.reduceMotion ? TransitionEffect.OPACITY.animation(readerMotionReducedFadeParam()) : undefined,
      onStateChange: (event: PopupStateChangeParam): void => { if (!event.isVisible) this.dismiss(identity); } };
  }

  private popupViewport(): ReaderRectVp {
    this.metricsRevision;
    return readerOverlayViewport(readerWindowMetrics(), undefined, new ReaderInsetsVp(8, 8, 8, 8));
  }

  private popupAbove(): boolean {
    const viewport = this.popupViewport();
    const rowCount = this.options[this.selectedIndex] === this.value || this.options.includes(this.value) ?
      this.options.length : this.options.length + 1;
    const natural = readerOverlayListHeight(0, readerOverlayChoiceRowHeight(44, 18, readerWindowMetrics().systemFontScale),
      rowCount, 0, 0, 0, 1, 0);
    const frame = readerOverlayPanel(viewport, viewport.width, Math.min(330, natural), 'anchor-start', this.anchor, POPUP_GAP);
    return frame.top + frame.height <= this.anchor.top;
  }

  private popupViewportHeight(): number {
    const viewport = this.popupViewport();
    return Math.max(0, this.popupAbove() ? this.anchor.top - viewport.top - POPUP_GAP :
      viewport.top + viewport.height - this.anchor.top - this.anchor.height - POPUP_GAP);
  }

  @Builder
  private selectPanel(identity: string) {
      ReaderSelectPanel({ hosting: 'popup', hostBottomVp: this.popupViewportHeight(),
        value: this.value, options: this.options, selectedIndex: this.selectedIndex,
        variant: this.variant, controlWidth: this.controlWidth, reduceMotion: this.reduceMotion,
        menuKind: this.menuKind, auditPopupAnchor: this.anchor,
        selectionId: identity, x: 0, y: 0,
        onCommit: (value: string, actorIdentity: string, index: number = -1): void => this.commit(value, actorIdentity, index),
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
    .onAreaChange((_old: Area, area: Area): void => {
      const rect = new ReaderRectVp(Number.parseFloat(`${area.globalPosition.x}`), Number.parseFloat(`${area.globalPosition.y}`),
        Number.parseFloat(`${area.width}`), Number.parseFloat(`${area.height}`));
      if (rect.width <= 0 || rect.height <= 0 || !Number.isFinite(rect.left) || !Number.isFinite(rect.top)) return;
      if (rect.left !== this.anchor.left || rect.top !== this.anchor.top || rect.width !== this.anchor.width ||
        rect.height !== this.anchor.height) this.anchor = rect;
    })
    .bindPopup(this.open, this.popupOptions(this.selectionId));
  }
}
