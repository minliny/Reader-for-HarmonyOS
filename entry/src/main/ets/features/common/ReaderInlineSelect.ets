import { ReaderSelect, type ReaderSelectVariant } from './ReaderSelect';
import { ReaderSelectPanel } from './ReaderSelectPanel';
import type { ReaderSelectMenuKind } from './ReaderSelectGeometry';

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
  @Prop value: string = '';
  @Prop options: string[] = [];
  @Prop selectedIndex: number = 0;
  @Prop controlWidth: number = 0;
  @Prop menuKind: ReaderSelectMenuKind = 'standard';
  @Prop variant: ReaderSelectVariant = 'default';
  @Prop reduceMotion: boolean = false;
  @Prop actionEnabled: boolean = true;
  onSelect: (index: number, value: string) => void = (_index: number, _value: string): void => {};
  @State private open: boolean = false;
  @State private selectionId: string = '';
  @State private triggerHeight: number = 36;
  private mounted: boolean = false;
  private generation: number = 0;

  aboutToAppear(): void { this.mounted = true; }
  aboutToDisappear(): void { this.mounted = false; this.open = false; this.generation += 1; }

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

  @Builder
  private selectPanel(identity: string) {
      ReaderSelectPanel({ value: this.value, options: this.options,
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
        variant: this.variant,
        controlWidth: this.controlWidth,
        reduceMotion: this.reduceMotion,
        // Disabled triggers remain visible and preserve the shared geometry.
        onToggle: (): void => this.toggle(),
      }).onAreaChange((_old: Area, next: Area): void => {
        const height = typeof next.height === 'number' ? next.height : Number.parseFloat(next.height as string);
        if (Number.isFinite(height) && height > 0 && Math.abs(height - this.triggerHeight) > .1) this.triggerHeight = height;
      });
    }
    .width(this.variant === 'default' ? 'auto' : this.controlWidth > 0 ? this.controlWidth : 'auto')
    .height(this.triggerHeight)
    .opacity(this.actionEnabled ? 1 : 0.4)
    .bindPopup(this.open, this.popupOptions(this.selectionId));
  }
}
