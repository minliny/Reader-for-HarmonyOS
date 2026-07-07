// OverlayHost — shell slot for overlays (dropdown / sheet / toast / reader-control panel).
// Reads `overlay` from AppStorage. Appear/disappear uses the motion-duration overlay token
// (centralized here, never animateTo in pages). Backdrop derived from ColorTokens.ink + opacity
// (no raw hex).
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { SpacingTokens, RadiusTokens } from '../../contract/generated/DimensionTokens';
import { MotionDurationTokens } from '../../contract/generated/MotionTokens';
import { ReaderTypography } from '../tokens/ReaderTypography';
import { ReaderUiStore } from '../store/ReaderUiStore';

@Component
export struct OverlayHost {
  @StorageProp('reader.overlay') overlayKind: string = '';

  build() {
    if (this.overlayKind !== '') {
      Stack() {
        Column()
          .width('100%').height('100%')
          .backgroundColor(ColorTokens.ink)
          .opacity(0.4)
          .onClick(() => ReaderUiStore.dispatch({ type: 'set-overlay', overlay: '' }))

        Column() {
          Text(this.overlayLabel())
            .fontSize(ReaderTypography.sectionTitle().fontSize)
            .fontColor(ColorTokens.ink)
            .fontWeight(ReaderTypography.sectionTitle().fontWeight)
          Text('关闭')
            .fontSize(ReaderTypography.bookMeta().fontSize)
            .fontColor(ColorTokens.primary)
            .margin({ top: SpacingTokens.md })
            .padding({ left: SpacingTokens.lg, right: SpacingTokens.lg, top: SpacingTokens.xs, bottom: SpacingTokens.xs })
            .backgroundColor(ColorTokens.metaBg)
            .borderRadius(RadiusTokens.control)
            .onClick(() => ReaderUiStore.dispatch({ type: 'set-overlay', overlay: '' }))
        }
        .padding(SpacingTokens.lg)
        .backgroundColor(ColorTokens.floatingControlBg)
        .borderRadius(RadiusTokens.large)
        .margin({ left: SpacingTokens.lg, right: SpacingTokens.lg })
      }
      .width('100%').height('100%')
      .transition(TransitionEffect.OPACITY.animation({ duration: MotionDurationTokens.overlay, curve: Curve.EaseInOut }))
    }
  }

  private overlayLabel(): string {
    switch (this.overlayKind) {
      case 'reader-control': return '阅读控制层';
      case 'directory': return '目录';
      case 'appearance': return '外观';
      case 'tts': return '朗读';
      case 'settings': return '设置';
      case 'content-search': return '内容搜索';
      case 'content-replacement': return '内容替换';
      case 'source-switch': return '换源';
      default: return '浮层';
    }
  }
}
