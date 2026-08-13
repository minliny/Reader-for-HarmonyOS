// InteractionDebugComponents — development-only visual frames for invisible or
// hard-to-hit interaction modules. The switch is seeded by EntryAbility and can
// be disabled with `--ps interactionDebug false`.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { InteractionDebugAdapter } from '../adapters/InteractionDebugAdapter';

@Component
export struct InteractionDebugFrame {
  @StorageProp(InteractionDebugAdapter.K_VISIBLE) visible: boolean = InteractionDebugAdapter.DEFAULT_VISIBLE;
  @Prop label: string = '';
  @Prop tone: string = 'module';

  private toneColor(): string {
    if (this.tone === 'action') return ColorTokens.accent;
    if (this.tone === 'sheet') return ColorTokens.primaryDark;
    if (this.tone === 'route') return ColorTokens.primary;
    return ColorTokens.controlInk;
  }

  build() {
    if (this.visible) {
      Stack({ alignContent: Alignment.TopStart }) {
        Column()
          .width('100%')
          .height('100%')
          .backgroundColor(this.toneColor())
          .opacity(0.07)
        Column()
          .width('100%')
          .height('100%')
          .border({ width: 1, color: this.toneColor() })
        if (this.label !== '') {
          Text(this.label)
            .fontSize(9)
            .fontWeight(800)
            .fontColor(DemoAliasTokens.onPrimary)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
            .padding({ left: 6, right: 6, top: 2, bottom: 2 })
            .backgroundColor(this.toneColor())
            .borderRadius(DemoAliasTokens.radiusXs)
            .margin({ left: 4, top: 4 })
        }
      }
      .width('100%')
      .height('100%')
      .enabled(false)
      .hitTestBehavior(HitTestMode.None)
    }
  }
}

@Component
export struct InteractionDebugBadge {
  @StorageProp(InteractionDebugAdapter.K_VISIBLE) visible: boolean = InteractionDebugAdapter.DEFAULT_VISIBLE;
  @Prop label: string = '';
  @Prop tone: string = 'module';
  @Prop offsetTop: number = 4;
  @Prop offsetLeft: number = 4;

  private toneColor(): string {
    if (this.tone === 'action') return ColorTokens.accent;
    if (this.tone === 'sheet') return ColorTokens.primaryDark;
    if (this.tone === 'route') return ColorTokens.primary;
    return ColorTokens.controlInk;
  }

  build() {
    if (this.visible && this.label !== '') {
      Text(this.label)
        .fontSize(9)
        .fontWeight(800)
        .fontColor(DemoAliasTokens.onPrimary)
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .height(18)
        .padding({ left: 6, right: 6 })
        .backgroundColor(this.toneColor())
        .borderRadius(DemoAliasTokens.radiusXs)
        .margin({ left: this.offsetLeft, top: this.offsetTop })
        .enabled(false)
        .hitTestBehavior(HitTestMode.None)
    }
  }
}
