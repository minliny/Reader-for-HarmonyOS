// StateHost — shell slot for page-state overlays (loading / empty / error / offline).
// Reads pageState + readerMode from AppStorage. When the page is in a non-default state,
// the StateHost overlays the shell content with the matching state component.
import { Loading, Empty, ErrorState, Offline } from '../components/SharedComponents';
import { ColorTokens } from '../../contract/generated/ColorTokens';

@Component
export struct StateHost {
  @StorageProp('reader.pageState') pageState: string = '';
  @StorageProp('reader.readerMode') readerMode: string = 'default';
  @StorageProp('reader.loading') loading: boolean = false;

  build() {
    if (this.loading || this.pageState === 'loading' || this.readerMode === 'loading') {
      Column() { Loading() }.width('100%').height('100%').backgroundColor(ColorTokens.paper)
    } else if (this.pageState === 'empty') {
      Column() { Empty() }.width('100%').height('100%').backgroundColor(ColorTokens.paper)
    } else if (this.pageState === 'error' || this.readerMode === 'error') {
      Column() { ErrorState() }.width('100%').height('100%').backgroundColor(ColorTokens.paper)
    } else if (this.pageState === 'offline' || this.readerMode === 'offline') {
      Column() { Offline() }.width('100%').height('100%').backgroundColor(ColorTokens.paper)
    }
  }
}
