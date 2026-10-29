/** Semantics for custom visual actions. Native buttons/toggles retain their
 * platform behavior. Non-action rows must leave their child controls exposed. */
export class ReaderActionAccessibility implements AttributeModifier<CommonAttribute> {
  private label: string;
  private enabled: boolean;
  private selected: boolean;
  private action: boolean;
  private feedback: AttributeModifier<CommonAttribute> | undefined;
  constructor(label: string, enabled: boolean = true, selected: boolean = false, action: boolean = true, feedback: AttributeModifier<CommonAttribute> | undefined = undefined) {
    this.label = label; this.enabled = enabled; this.selected = selected; this.action = action; this.feedback = feedback;
  }

  applyPressedAttribute(instance: CommonAttribute): void { this.feedback?.applyPressedAttribute?.(instance); }
  applyFocusedAttribute(instance: CommonAttribute): void { this.feedback?.applyFocusedAttribute?.(instance); }
  applyDisabledAttribute(instance: CommonAttribute): void { this.feedback?.applyDisabledAttribute?.(instance); }
  applySelectedAttribute(instance: CommonAttribute): void { this.feedback?.applySelectedAttribute?.(instance); }

  applyNormalAttribute(instance: CommonAttribute): void {
    this.feedback?.applyNormalAttribute?.(instance);
    if (!this.action) return;
    instance.accessibilityRole(AccessibilityRoleType.BUTTON)
      .accessibilityText(this.label).accessibilitySelected(this.selected)
      .focusable(this.enabled).enabled(this.enabled);
  }
}

/** Parent lanes must reserve this target; visual glyphs may remain smaller. */
export const READER_ACTION_MIN_TARGET = 44;
export function readerActionTouchRegion(width: number | string, height: number | string): Rectangle {
  return {
    x: typeof width === 'number' ? Math.min(0, (width - READER_ACTION_MIN_TARGET) / 2) : 0,
    y: typeof height === 'number' ? Math.min(0, (height - READER_ACTION_MIN_TARGET) / 2) : 0,
    width: typeof width === 'number' ? Math.max(READER_ACTION_MIN_TARGET, width) : width,
    height: typeof height === 'number' ? Math.max(READER_ACTION_MIN_TARGET, height) : height,
  };
}
