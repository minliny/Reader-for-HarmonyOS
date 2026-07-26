// StateHost — shell slot for page-state overlays (loading / empty / error / offline).
// Current Figma has no admitted generic state-overlay master. Dedicated Figma stateful
// flows own their own body (for example Search and Local Import), so this legacy generic
// overlay must remain inert until an exact Figma state binding and renderer are added.
import { ReaderUiVisualAdmission } from '../../contract/reader_ui/VisualAdmission';

@Component
export struct StateHost {
  @StorageProp('reader.displayedRouteId') routeId: string = 'bookshelf';
  @StorageProp('reader.pageState') pageState: string = '';
  @StorageProp('reader.readerMode') readerMode: string = 'default';
  @StorageProp('reader.loading') loading: boolean = false;

  private activeStateId(): string {
    if (this.loading || this.pageState === 'loading' || this.readerMode === 'loading') return 'loading';
    if (this.pageState === 'empty') return 'empty';
    if (this.pageState === 'error' || this.readerMode === 'error') return 'error';
    if (this.pageState === 'offline' || this.readerMode === 'offline') return 'offline';
    return '';
  }

  build() {
    if (this.activeStateId().length === 0 ||
      !ReaderUiVisualAdmission.isStateAdmitted(this.routeId, this.activeStateId())) {
      // Loading/empty/error/offline can be visible only when the Figma record
      // declares that exact route-state.  Crucially, an inert state host must
      // have no full-screen hit region: the former transparent Stack sat above
      // every page and swallowed all normal Reader taps.
      Column().width(0).height(0)
    } else {
      // Admission alone is not enough: a future state binding also needs an
      // explicit source-led renderer. Do not fall through to the retired
      // generic ColorTokens state cards in the meantime.
      Column().width(0).height(0)
    }
  }
}
