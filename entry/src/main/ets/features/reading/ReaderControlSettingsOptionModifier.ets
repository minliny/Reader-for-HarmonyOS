import { TOK_READ_ELEVATED, TOK_READ_INK, TOK_READ_PRIMARY } from '../common/ReaderTokens';
import { type ReaderControlActorFrame } from './ReaderControlActorGeometry';
import { type ReaderControlMotionPresentation } from './ReaderControlMotionPresentation';

/** Keep the same Text actor. ArkUI's AttributeModifier diffs its native
 * attributes, so a pose change avoids redundant typography/event updates.
 * This object belongs to one mounted Settings option, not to a global cache. */
export class ReaderControlSettingsOptionModifier implements AttributeModifier<TextAttribute> {
  private actor: ReaderControlActorFrame = { x: 0, y: 0, width: 0, height: 0, opacity: 1 };
  private opacity: number = 1;
  private blur: number = 0;
  private active: boolean = false;
  private enabled: boolean = false;
  private accessibility: string = '';
  private action: () => void;

  constructor(action: () => void) { this.action = action; }

  update(actor: ReaderControlActorFrame, paint: ReaderControlMotionPresentation,
    active: boolean, enabled: boolean, accessibility: string): ReaderControlSettingsOptionModifier {
    this.actor = actor;
    this.opacity = paint.contentOpacity;
    this.blur = paint.contentBlur;
    this.active = active;
    this.enabled = enabled;
    this.accessibility = accessibility;
    return this;
  }

  applyNormalAttribute(instance: TextAttribute): void {
    instance.opacity(this.opacity).blur(this.blur)
      .width(this.actor.width).height(this.actor.height)
      .position({ x: this.actor.x, y: this.actor.y })
      .backgroundColor(this.active ? TOK_READ_ELEVATED : Color.Transparent)
      .fontColor(this.active ? TOK_READ_PRIMARY : TOK_READ_INK)
      .enabled(this.enabled).accessibilityText(this.accessibility).onClick(this.action);
  }
}
