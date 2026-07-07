// SettingsComponents — P0 settings demo components.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { SpacingTokens, RadiusTokens } from '../../contract/generated/DimensionTokens';
import { ReaderTypography } from '../tokens/ReaderTypography';
import { ReaderUiStore } from '../store/ReaderUiStore';

@Component
export struct SettingsSection {
  private label: string = '通用';

  build() {
    Text(this.label)
      .fontSize(ReaderTypography.bookMeta().fontSize)
      .fontColor(ColorTokens.muted)
      .width('100%')
      .padding({ left: SpacingTokens.md, top: SpacingTokens.md, bottom: SpacingTokens.xs })
  }
}

@Component
export struct SettingsListItem {
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;
  private label: string = '减少动态效果';

  build() {
    Row() {
      Text(this.label)
        .fontSize(ReaderTypography.bookTitle().fontSize)
        .fontColor(ColorTokens.ink)
      Blank()
      Toggle({ type: ToggleType.Switch, isOn: this.reducedMotion })
        .selectedColor(ColorTokens.primary)
        .onChange((on: boolean) => ReaderUiStore.dispatch({ type: 'toggle-reduced-motion', enabled: on }))
    }
    .width('100%')
    .padding({ left: SpacingTokens.md, right: SpacingTokens.md, top: SpacingTokens.md, bottom: SpacingTokens.md })
    .backgroundColor(ColorTokens.surface)
    .borderRadius(RadiusTokens.card)
    .margin({ left: SpacingTokens.md, right: SpacingTokens.md, bottom: SpacingTokens.xs })
  }
}
