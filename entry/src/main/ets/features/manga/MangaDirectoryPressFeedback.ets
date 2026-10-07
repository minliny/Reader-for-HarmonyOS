import { ColorMetrics, LengthMetrics } from '@kit.ArkUI';
import { MANGA_DIRECTORY_VISUAL, mangaDirectoryColor } from './MangaDirectoryVisual';

/** Demo button opacity and keyboard focus box. ArkUI owns press, release,
 * cancel, disabled and focus states; this adapter preserves selected surfaces.
 * Shared controls pass applies=false outside their manga presentation. */
export class MangaDirectoryPressFeedback implements AttributeModifier<CommonAttribute> {
  private readonly enabled: boolean;
  private readonly applies: boolean;
  private readonly scheme: string;

  constructor(enabled: boolean = true, applies: boolean = true, scheme: string = 'day') {
    this.enabled = enabled;
    this.applies = applies;
    this.scheme = scheme;
  }

  private applyFocusBox(instance: CommonAttribute, enabled: boolean = this.enabled): void {
    instance.focusable(enabled);
    instance.focusBox({ strokeWidth: LengthMetrics.vp(MANGA_DIRECTORY_VISUAL.focusWidth),
      strokeColor: ColorMetrics.resourceColor(mangaDirectoryColor('accent', this.scheme)),
      margin: LengthMetrics.vp(MANGA_DIRECTORY_VISUAL.focusMargin) });
  }

  applyNormalAttribute(instance: CommonAttribute): void {
    if (!this.applies) return;
    instance.opacity(this.enabled ? 1 : MANGA_DIRECTORY_VISUAL.disabledOpacity);
    this.applyFocusBox(instance);
  }

  applyPressedAttribute(instance: CommonAttribute): void {
    if (!this.applies) return;
    instance.opacity(this.enabled ? MANGA_DIRECTORY_VISUAL.pressOpacity : MANGA_DIRECTORY_VISUAL.disabledOpacity);
    this.applyFocusBox(instance);
  }

  applyDisabledAttribute(instance: CommonAttribute): void {
    if (!this.applies) return;
    instance.opacity(MANGA_DIRECTORY_VISUAL.disabledOpacity);
    this.applyFocusBox(instance, false);
  }
}
