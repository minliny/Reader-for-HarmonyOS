// ReaderSelectionToolbar — floating text-selection action bar.
// Batch 3: toolbar state machine only (visible / action / close). Real text
// selection requires a native text picker; this component renders the action
// row when reader.selection.visible is true and dispatches selection-action /
// selection-close back to the reducer.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { RadiusTokens } from '../../contract/generated/DimensionTokens';
import { SafeAreaAdapter } from '../adapters/SafeAreaAdapter';
import { ViewportAdapter } from '../adapters/ViewportAdapter';
import { ReaderUiStore } from '../store/ReaderUiStore';
import { MotionAdapter } from '../adapters/MotionAdapter';

@Component
export struct ReaderSelectionToolbar {
  @StorageProp('reader.selection.visible') visible: boolean = false;
  @StorageProp('reader.selection.selectedText') selectedText: string = '';
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;
  @StorageProp(SafeAreaAdapter.K_BOTTOM) safeAreaBottom: number = SafeAreaAdapter.DEFAULT_BOTTOM;
  @StorageProp(ViewportAdapter.K_HEIGHT) viewportHeight: number = ViewportAdapter.DEFAULT_HEIGHT;

  build() {
    if (this.visible) {
      Stack({ alignContent: Alignment.Bottom }) {
        Row() {
          Text('复制')
            .fontSize(13).fontColor(ColorTokens.controlInk)
            .padding({ left: 12, right: 12, top: 8, bottom: 8 })
            .onClick(() => this.dispatchAction('copy'))
          Text('高亮')
            .fontSize(13).fontColor(ColorTokens.controlInk)
            .padding({ left: 12, right: 12, top: 8, bottom: 8 })
            .onClick(() => this.dispatchAction('highlight'))
          Text('笔记')
            .fontSize(13).fontColor(ColorTokens.controlInk)
            .padding({ left: 12, right: 12, top: 8, bottom: 8 })
            .onClick(() => this.dispatchAction('note'))
          Text('搜索')
            .fontSize(13).fontColor(ColorTokens.controlInk)
            .padding({ left: 12, right: 12, top: 8, bottom: 8 })
            .onClick(() => this.dispatchAction('search'))
          Text('×')
            .fontSize(16).fontColor(ColorTokens.muted)
            .padding({ left: 12, right: 12, top: 8, bottom: 8 })
            .onClick(() => {
              MotionAdapter.apply('selection.toolbar.exit', this.reducedMotion, () => {
                ReaderUiStore.dispatch({ type: 'selection-close' });
              });
            })
        }
        .backgroundColor(DemoAliasTokens.surface)
        .borderRadius(RadiusTokens.control)
        .border({ width: 1, color: ColorTokens.border })
        .padding({ left: 4, right: 4, top: 4, bottom: 4 })
        .shadow({ radius: 12, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 4 })
      }
      .width('100%')
      .height('100%')
      .padding({ bottom: this.safeAreaBottom + 80 })
      .hitTestBehavior(HitTestMode.Transparent)
    }
  }

  private dispatchAction(action: string): void {
    MotionAdapter.apply('selection.toolbar.action', this.reducedMotion, () => {
      ReaderUiStore.dispatch({ type: 'selection-action', selectionAction: action });
    });
  }
}
