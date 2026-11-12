import { readerAppColor } from '../../../ui/foundation/ReaderThemeRegistry';
import { type SheetSurfaceSpec, readerSurfaceElevation } from '../../../ui/surfaces/ReaderSurfaceSpecs';

interface SearchResultSheetLifecycle {
  isMountedOpening: () => boolean;
  isExpandedOpening: () => boolean;
  onOpening: (identity: string) => void;
  onClosing: (identity: string) => void;
  onDismiss: (identity: string) => void;
  onClosed: (identity: string) => void;
}

/** Native callbacks for one mounted search result trigger. SearchPage keeps
 * query admission, exclusive panel ownership, chrome and focus restoration. */
export class SearchResultSheetBinding {
  private openingIdentity: string = '';
  private appearedIdentity: string = '';

  retire(onClosing: (identity: string) => void): void {
    const identity = this.openingIdentity;
    this.openingIdentity = '';
    this.appearedIdentity = '';
    if (identity.length > 0) onClosing(identity);
  }

  options(spec: SheetSurfaceSpec, width: number, scheme: string, identity: string,
    lifecycle: SearchResultSheetLifecycle): SheetOptions {
    return { height: SheetSize.FIT_CONTENT, width, preferType: SheetType.BOTTOM,
      dragBar: false, showClose: false, backgroundColor: readerAppColor(spec.hostBackgroundRole, scheme),
      radius: { topLeft: spec.borderRadius, topRight: spec.borderRadius, bottomLeft: 0, bottomRight: 0 },
      maskColor: readerAppColor(spec.hostMaskRole, scheme),
      shadow: readerSurfaceElevation(spec.hostElevation, scheme),
      borderWidth: { top: spec.hostBorderWidth }, borderColor: readerAppColor(spec.hostBorderRole, scheme),
      enableOutsideInteractive: false,
      onWillAppear: (): void => {
        if (!lifecycle.isMountedOpening()) return;
        this.openingIdentity = identity;
        lifecycle.onOpening(identity);
      },
      onAppear: (): void => { if (lifecycle.isExpandedOpening()) this.appearedIdentity = identity; },
      onWillDismiss: (dismissal: DismissSheetAction): void => {
        if (!lifecycle.isExpandedOpening()) return;
        if (dismissal.reason !== DismissReason.PRESS_BACK && this.appearedIdentity !== identity) return;
        lifecycle.onClosing(identity);
        lifecycle.onDismiss(identity);
        dismissal.dismiss();
      },
      onDisappear: (): void => {
        lifecycle.onClosing(identity);
        if (this.openingIdentity === identity) this.openingIdentity = '';
        if (lifecycle.isMountedOpening()) {
          lifecycle.onDismiss(identity);
          lifecycle.onClosed(identity);
        }
        if (this.appearedIdentity === identity) this.appearedIdentity = '';
      } };
  }
}
