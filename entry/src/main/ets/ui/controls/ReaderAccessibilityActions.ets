import { deviceInfo } from '@kit.BasicServicesKit';

export interface ReaderAccessibleAction {
  label: string;
  run: () => void;
}

/** Supplemental actions for an existing focusable control. */
export class ReaderAccessibilityActions implements AttributeModifier<CommonAttribute> {
  private readonly actions: ReaderAccessibleAction[];
  private readonly nextId: string;
  private readonly current: () => boolean;

  constructor(actions: ReaderAccessibleAction[], nextId: string, current: () => boolean) {
    this.actions = actions;
    this.nextId = nextId;
    this.current = current;
  }

  applyNormalAttribute(attribute: CommonAttribute): void {
    if (deviceInfo.distributionOSApiVersion >= 260000) {
      if (deviceInfo.apiAvailable('26.0.0')) {
        const actions = this.current() && this.actions.length > 0 ? this.actions.map(
          (action: ReaderAccessibleAction): AccessibilityCustomAction => ({
            name: action.label,
            onAction: (): void => { if (this.current()) action.run(); },
          })) : undefined;
        attribute.accessibilityCustomActions(actions);
        attribute.accessibilityNextFocusId(this.current() ? this.nextId : '', { isConsiderDescendants: true });
      }
    }
  }
}
