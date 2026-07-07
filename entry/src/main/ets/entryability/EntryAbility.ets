// EntryAbility — Stage model entry. Initializes the UiStore (which seeds AppStorage)
// before the page loads, then loads the single @Entry page that hosts RouteRenderer.
import UIAbility from '@ohos.app.ability.UIAbility';
import window from '@ohos.window';
import { ReaderUiStore } from '../ui/store/ReaderUiStore';

export default class EntryAbility extends UIAbility {
  onCreate(): void {
    ReaderUiStore.init();
  }

  onWindowStageCreate(windowStage: window.WindowStage): void {
    windowStage.loadContent('pages/Index');
  }
}
