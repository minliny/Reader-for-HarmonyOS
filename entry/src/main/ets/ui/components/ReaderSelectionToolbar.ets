// ReaderSelectionToolbar — ArkUI Text's native selection-menu content.
//
// This is not a free-floating reader overlay: ReadingTextFlow binds it with
// Text.bindSelectionMenu(), so ArkUI invokes it only after a user long-presses
// and selects real chapter text. The selected text comes from
// onTextSelectionChange; no fixture prose or synthetic selection is accepted.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { RadiusTokens } from '../../contract/generated/DimensionTokens';
import { ReaderUiStore } from '../store/ReaderUiStore';
import { MotionAdapter } from '../adapters/MotionAdapter';

@Component
export struct ReaderSelectionToolbar {
  @StorageProp('reader.selection.visible') visible: boolean = false;
  @StorageProp('reader.selection.selectedText') selectedText: string = '';
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;

  private hasNativeSelection(): boolean {
    return this.visible && this.selectedText.trim().length > 0;
  }

  build() {
    Row({ space: 2 }) {
      Text('复制')
        .fontSize(13).fontColor(this.hasNativeSelection() ? ColorTokens.controlInk : ColorTokens.muted)
        .padding({ left: 12, right: 12, top: 8, bottom: 8 })
        .constraintSize({ minHeight: 44 })
        .accessibilityText('复制所选正文')
        .enabled(this.hasNativeSelection())
        .onClick(() => this.dispatchAction('copy'))
      Text('搜索')
        .fontSize(13).fontColor(this.hasNativeSelection() ? ColorTokens.controlInk : ColorTokens.muted)
        .padding({ left: 12, right: 12, top: 8, bottom: 8 })
        .constraintSize({ minHeight: 44 })
        .accessibilityText('搜索所选正文')
        .enabled(this.hasNativeSelection())
        .onClick(() => this.dispatchAction('search'))
      // Core-Native currently has neither a highlight nor a note model. Keep
      // the contract affordances visible as explicitly disabled information,
      // not as reducer-only buttons that pretend the write succeeded.
      Text('高亮（未接入）')
        .fontSize(12).fontColor(ColorTokens.muted)
        .padding({ left: 8, right: 8, top: 8, bottom: 8 })
        .constraintSize({ minHeight: 44 })
        .accessibilityText('高亮，当前不可用')
        .enabled(false)
      Text('笔记（未接入）')
        .fontSize(12).fontColor(ColorTokens.muted)
        .padding({ left: 8, right: 8, top: 8, bottom: 8 })
        .constraintSize({ minHeight: 44 })
        .accessibilityText('笔记，当前不可用')
        .enabled(false)
    }
    .backgroundColor(DemoAliasTokens.surface)
    .borderRadius(RadiusTokens.control)
    .border({ width: 1, color: ColorTokens.border })
    .padding({ left: 4, right: 4, top: 4, bottom: 4 })
    .shadow({ radius: 12, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 4 })
  }

  private dispatchAction(action: string): void {
    if (!this.hasNativeSelection() || (action !== 'copy' && action !== 'search')) return;
    MotionAdapter.apply('selection.toolbar.action', this.reducedMotion, this.getUIContext(), () => {
      ReaderUiStore.dispatch({ type: 'selection-action', selectionAction: action });
    });
  }
}
