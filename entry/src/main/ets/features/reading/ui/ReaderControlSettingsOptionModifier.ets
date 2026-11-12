import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { type ReaderControlActorFrame } from './ReaderControlActorGeometry';
import { type ReaderControlMotionPresentation } from './ReaderControlMotionPresentation';

/** Keep one native option frame and its original action closure. ArkUI diffs
 * the actor geometry/paint here; its child Text consumes only label color.
 * This object belongs to one mounted Settings option, not to a global cache. */
export class ReaderControlSettingsOptionModifier implements AttributeModifier<CommonAttribute> {
  private actor: ReaderControlActorFrame = { x: 0, y: 0, width: 0, height: 0, opacity: 1 };
  private opacity: number = 1;
  private blur: number = 0;
  private appScheme: string = 'day';
  private active: boolean = false;
  private enabled: boolean = false;
  private accessibility: string = '';
  private action: () => void;

  constructor(action: () => void) { this.action = action; }

  update(actor: ReaderControlActorFrame, paint: ReaderControlMotionPresentation,
    active: boolean, enabled: boolean, accessibility: string, appScheme: string = 'day'): ReaderControlSettingsOptionModifier {
    this.actor = actor;
    this.appScheme = appScheme;
    this.opacity = paint.contentOpacity;
    this.blur = paint.contentBlur;
    this.active = active;
    this.enabled = enabled;
    this.accessibility = accessibility;
    return this;
  }

  labelColor(): ResourceColor {
    return readerAppColor(this.active ? 'TOK_READ_PRIMARY' : 'TOK_READ_INK', this.appScheme);
  }

  applyNormalAttribute(instance: CommonAttribute): void {
    instance.opacity(this.opacity).blur(this.blur)
      .width(this.actor.width).height(this.actor.height)
      .position({ x: this.actor.x, y: this.actor.y })
      .backgroundColor(this.active ? readerAppColor('TOK_READ_ELEVATED', this.appScheme) : Color.Transparent)
      .borderRadius(6)
      .border({ width: 0.5, color: readerAppColor('TOK_LINE', this.appScheme) })
      .enabled(this.enabled).accessibilityText(this.accessibility).onClick(this.action);
  }
}
