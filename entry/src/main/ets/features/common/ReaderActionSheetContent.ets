import { ReaderActionMenuSurface, ReaderMenuActionView, type ReaderActionTone } from './ReaderActionMenuSurface';
import { type ActionSheetSpecId } from './ReaderSurfaceSpecs';

export type ReaderActionSheetVariant = ActionSheetSpecId;
export type ReaderActionSheetTone = ReaderActionTone;

/** Compatibility DTO for existing action-sheet callers. All fields and action
 * admission belong to the existing shared action-menu family. */
export class ReaderActionSheetAction extends ReaderMenuActionView {
  constructor(
    id: string,
    label: string,
    section: string = '',
    secondary: string = '',
    trailing: string = '',
    enabled: boolean = true,
    icon: Resource | undefined = undefined,
    tone: ReaderActionSheetTone = 'default',
    showChevron: boolean = false,
  ) {
    super(id, label, enabled, icon, label, section, secondary, trailing, tone, showChevron);
  }
}

/** Content-only compatibility facade. The sheet host owns its frame and
 * lifecycle; the established action-menu renderer owns every row and click. */
@Component
export struct ReaderActionSheetContent {
  @Prop variant: ReaderActionSheetVariant = 'grouped';
  @Prop actions: ReaderActionSheetAction[] = [];
  @Prop scheme: 'auto' | 'day' | 'night' = 'auto';
  onAction: (id: string) => void = (_id: string): void => {};

  build() {
    ReaderActionMenuSurface({ variant: this.variant, actions: this.actions,
      scheme: this.scheme, onAction: (id: string): void => this.onAction(id) });
  }
}
