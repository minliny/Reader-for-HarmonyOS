// ReaderTtsComponents — TTS panel + full TTS page.
// 对应 B 的 02d-reader-tts-typography.css (TTS/排版).
// Split from ReaderOverlayComponents.ets; barrel re-exports kept for back-compat.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { ReaderModulePanelShell, ReaderLiveOptionRow } from './ReaderControlComponents';
import { ReaderQuickPillButton } from './ReaderAutoSearchComponents';
import { ReaderFullPanelShell, ReaderFullBlock, ReaderFullChoiceRow } from './ReaderFullpageComponents';
import { ReaderUiStore } from '../store/ReaderUiStore';
import { MotionAdapter } from '../adapters/MotionAdapter';

// ── TTS panel (.fd-reader-tts-panel) ──────────────────────────────────────
@Component
export struct ReaderTtsPanel {
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;
  @StorageProp('reader.ttsSession.playback') ttsPlayback: string = 'idle';
  @StorageProp('reader.ttsSession.rate') ttsRate: number = 1.0;
  @StorageProp('reader.ttsSession.voice') ttsVoice: string = '系统默认';
  @StorageProp('reader.ttsSession.scope') ttsScope: string = 'chapter';
  @StorageProp('reader.ttsSession.timer') ttsTimer: string = 'off';

  private rateLabel(): string {
    if (this.ttsRate <= 0.8) return '0.8x';
    if (this.ttsRate <= 1.0) return '1.0x';
    if (this.ttsRate <= 1.25) return '1.25x';
    return '1.5x';
  }

  private voiceLabel(): string {
    return this.ttsVoice;
  }

  private scopeLabel(): string {
    return this.ttsScope === 'full' ? '本书剩余' : '当前章节';
  }

  private timerLabel(): string {
    switch (this.ttsTimer) {
      case '5min': return '5 分钟';
      case '10min': return '10 分钟';
      case '15min': return '15 分钟';
      case '30min': return '30 分钟';
      case 'chapterEnd': return '本章节结束';
      default: return '不定时';
    }
  }

  private cycleRate(): void {
    if (this.ttsRate <= 0.8) {
      ReaderUiStore.dispatch({ type: 'tts-set-rate', ttsRate: 1.0 });
    } else if (this.ttsRate <= 1.0) {
      ReaderUiStore.dispatch({ type: 'tts-set-rate', ttsRate: 1.25 });
    } else if (this.ttsRate <= 1.25) {
      ReaderUiStore.dispatch({ type: 'tts-set-rate', ttsRate: 1.5 });
    } else {
      ReaderUiStore.dispatch({ type: 'tts-set-rate', ttsRate: 0.8 });
    }
  }

  private cycleVoice(): void {
    if (this.ttsVoice === '系统默认') {
      ReaderUiStore.dispatch({ type: 'tts-set-voice', ttsVoice: '清晰女声' });
    } else if (this.ttsVoice === '清晰女声') {
      ReaderUiStore.dispatch({ type: 'tts-set-voice', ttsVoice: '沉稳男声' });
    } else {
      ReaderUiStore.dispatch({ type: 'tts-set-voice', ttsVoice: '系统默认' });
    }
  }

  private cycleScope(): void {
    if (this.ttsScope === 'chapter') {
      ReaderUiStore.dispatch({ type: 'tts-set-scope', ttsScope: 'full' });
    } else {
      ReaderUiStore.dispatch({ type: 'tts-set-scope', ttsScope: 'chapter' });
    }
  }

  private cycleTimer(): void {
    if (this.ttsTimer === 'off') {
      ReaderUiStore.dispatch({ type: 'tts-set-timer', ttsTimer: '15min' });
    } else if (this.ttsTimer === '15min') {
      ReaderUiStore.dispatch({ type: 'tts-set-timer', ttsTimer: '30min' });
    } else {
      ReaderUiStore.dispatch({ type: 'tts-set-timer', ttsTimer: 'off' });
    }
  }

  build() {
    ReaderModulePanelShell({ debugLabel: 'ReaderModulePanel' }) {
      Scroll() {
        Column() {
          Row() {
            Text('朗读')
              .fontSize(12)
              .fontWeight(800)
              .fontColor(ColorTokens.controlInk)
              .layoutWeight(1)
            ReaderQuickPillButton({ label: '停止朗读', disabled: true })
          }
          .width('100%')
          .height(28)
          .alignItems(VerticalAlign.Center)

          Row({ space: 9 }) {
            Image($r('app.media.reader_icon_reader_module_tts_primary'))
              .width(18)
              .height(18)
              .margin({ left: 1, right: 1 })
            Text('播放控制')
              .fontSize(11)
              .fontWeight(500)
              .fontColor(ColorTokens.controlInk)
              .layoutWeight(1)
            Row() {
              Stack({ alignContent: Alignment.Center }) {
                Image($r('app.media.reader_icon_chevron_left_chapter')).width(13).height(13)
              }
              .width(28)
              .height(25)
              .onClick(() => {
                MotionAdapter.apply('reader.session.capsule.update', this.reducedMotion, () => {
                  ReaderUiStore.dispatch({ type: 'tts-prev' });
                });
              })
              Stack({ alignContent: Alignment.Center }) {
                Image($r('app.media.reader_icon_play_white')).width(13).height(13)
              }
              .width(34)
              .height(25)
              .borderRadius(DemoAliasTokens.radiusMd)
              .backgroundColor(ColorTokens.primaryDark)
              .onClick(() => {
                MotionAdapter.apply('reader.session.capsule.control.press-toggle', this.reducedMotion, () => {
                  ReaderUiStore.dispatch({ type: 'tts-toggle' });
                });
              })
              Stack({ alignContent: Alignment.Center }) {
                Image($r('app.media.reader_icon_chevron_chapter')).width(13).height(13)
              }
              .width(28)
              .height(25)
              .onClick(() => {
                MotionAdapter.apply('reader.session.capsule.update', this.reducedMotion, () => {
                  ReaderUiStore.dispatch({ type: 'tts-next' });
                });
              })
            }
            .height(25)
            .borderRadius(DemoAliasTokens.radiusMd)
            .backgroundColor(ColorTokens.floatingControlBgAlt)
          }
          .width('100%')
          .height(32)
          .padding({ left: 9, right: 9 })
          .border({ width: { top: 1 }, color: ColorTokens.border })
          .alignItems(VerticalAlign.Center)

          Column() {
            ReaderLiveOptionRow({ icon: $r('app.media.ui_icon_motion_dark'), title: '语速', value: this.rateLabel() })
          }
          .width('100%')
          .onClick(() => {
            MotionAdapter.apply('dropdown.menu.expand', this.reducedMotion, () => {
              this.cycleRate();
            });
          })
          Column() {
            ReaderLiveOptionRow({ icon: $r('app.media.ui_icon_volume_dark'), title: '音色', value: this.voiceLabel() })
          }
          .width('100%')
          .onClick(() => {
            MotionAdapter.apply('dropdown.menu.expand', this.reducedMotion, () => {
              this.cycleVoice();
            });
          })
          Column() {
            ReaderLiveOptionRow({ icon: $r('app.media.ui_icon_current_location_dark'), title: '范围', value: this.scopeLabel() })
          }
          .width('100%')
          .onClick(() => {
            MotionAdapter.apply('dropdown.menu.expand', this.reducedMotion, () => {
              this.cycleScope();
            });
          })
          Column() {
            ReaderLiveOptionRow({ icon: $r('app.media.ui_icon_clock_dark'), title: '定时', value: this.timerLabel() })
          }
          .width('100%')
          .onClick(() => {
            MotionAdapter.apply('dropdown.menu.expand', this.reducedMotion, () => {
              this.cycleTimer();
            });
          })
        }
        .width('100%')
      }
      .width('100%')
      .height('100%')
      .clip(true)
      .scrollBar(BarState.Off)
      .borderRadius(DemoAliasTokens.radiusMd)
      .backgroundColor(DemoAliasTokens.surface)
    }
  }
}

@Component
export struct ReaderFullTtsPage {
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;
  @StorageProp('reader.ttsSession.playback') ttsPlayback: string = 'idle';
  @StorageProp('reader.ttsSession.rate') ttsRate: number = 1.0;
  @StorageProp('reader.ttsSession.voice') ttsVoice: string = '系统默认';
  @StorageProp('reader.ttsSession.scope') ttsScope: string = 'chapter';
  @StorageProp('reader.ttsSession.timer') ttsTimer: string = 'off';

  private rateLabel(): string {
    if (this.ttsRate <= 0.8) return '0.8x';
    if (this.ttsRate <= 1.0) return '1.0x';
    if (this.ttsRate <= 1.25) return '1.25x';
    return '1.5x';
  }

  private voiceLabel(): string {
    return this.ttsVoice;
  }

  private scopeLabel(): string {
    return this.ttsScope === 'full' ? '本书剩余' : '当前章节';
  }

  private timerLabel(): string {
    switch (this.ttsTimer) {
      case '5min': return '5 分钟';
      case '10min': return '10 分钟';
      case '15min': return '15 分钟';
      case '30min': return '30 分钟';
      case 'chapterEnd': return '本章节结束';
      default: return '不定时';
    }
  }

  private cycleRate(): void {
    if (this.ttsRate <= 0.8) {
      ReaderUiStore.dispatch({ type: 'tts-set-rate', ttsRate: 1.0 });
    } else if (this.ttsRate <= 1.0) {
      ReaderUiStore.dispatch({ type: 'tts-set-rate', ttsRate: 1.25 });
    } else if (this.ttsRate <= 1.25) {
      ReaderUiStore.dispatch({ type: 'tts-set-rate', ttsRate: 1.5 });
    } else {
      ReaderUiStore.dispatch({ type: 'tts-set-rate', ttsRate: 0.8 });
    }
  }

  private cycleVoice(): void {
    if (this.ttsVoice === '系统默认') {
      ReaderUiStore.dispatch({ type: 'tts-set-voice', ttsVoice: '清晰女声' });
    } else if (this.ttsVoice === '清晰女声') {
      ReaderUiStore.dispatch({ type: 'tts-set-voice', ttsVoice: '沉稳男声' });
    } else {
      ReaderUiStore.dispatch({ type: 'tts-set-voice', ttsVoice: '系统默认' });
    }
  }

  private cycleScope(): void {
    if (this.ttsScope === 'chapter') {
      ReaderUiStore.dispatch({ type: 'tts-set-scope', ttsScope: 'full' });
    } else {
      ReaderUiStore.dispatch({ type: 'tts-set-scope', ttsScope: 'chapter' });
    }
  }

  private cycleTimer(): void {
    if (this.ttsTimer === 'off') {
      ReaderUiStore.dispatch({ type: 'tts-set-timer', ttsTimer: '15min' });
    } else if (this.ttsTimer === '15min') {
      ReaderUiStore.dispatch({ type: 'tts-set-timer', ttsTimer: '30min' });
    } else {
      ReaderUiStore.dispatch({ type: 'tts-set-timer', ttsTimer: 'off' });
    }
  }

  build() {
    ReaderFullPanelShell({ title: '朗读', quickRoute: 'tts', debugLabel: 'ReaderExpandedPanel' }) {
      Column({ space: 10 }) {
        Row({ space: 12 }) {
          Text('‹')
            .fontSize(24)
            .fontWeight(800)
            .fontColor(ColorTokens.controlInk)
            .width(44)
            .height(36)
            .borderRadius(DemoAliasTokens.radiusLg)
            .backgroundColor(ColorTokens.floatingControlBgAlt)
            .textAlign(TextAlign.Center)
            .onClick(() => {
              MotionAdapter.apply('reader.session.capsule.update', this.reducedMotion, () => {
                ReaderUiStore.dispatch({ type: 'tts-prev' });
              });
            })
          Text('▶')
            .fontSize(18)
            .fontWeight(800)
            .fontColor(DemoAliasTokens.onPrimary)
            .width(56)
            .height(44)
            .borderRadius(DemoAliasTokens.radiusPill)
            .backgroundColor(ColorTokens.primaryDark)
            .textAlign(TextAlign.Center)
            .onClick(() => {
              MotionAdapter.apply('reader.session.capsule.control.press-toggle', this.reducedMotion, () => {
                ReaderUiStore.dispatch({ type: 'tts-toggle' });
              });
            })
          Text('›')
            .fontSize(24)
            .fontWeight(800)
            .fontColor(ColorTokens.controlInk)
            .width(44)
            .height(36)
            .borderRadius(DemoAliasTokens.radiusLg)
            .backgroundColor(ColorTokens.floatingControlBgAlt)
            .textAlign(TextAlign.Center)
            .onClick(() => {
              MotionAdapter.apply('reader.session.capsule.update', this.reducedMotion, () => {
                ReaderUiStore.dispatch({ type: 'tts-next' });
              });
            })
        }
        .width('100%')
        .height(64)
        .justifyContent(FlexAlign.Center)
        .alignItems(VerticalAlign.Center)

        ReaderFullBlock({ title: '语速', meta: this.rateLabel() }) {
          Column() {
            ReaderFullChoiceRow({ values: ['0.8x', '1.0x', '1.25x', '1.5x'], active: this.rateLabel() })
          }
          .width('100%')
          .onClick(() => {
            MotionAdapter.apply('dropdown.menu.expand', this.reducedMotion, () => {
              this.cycleRate();
            });
          })
        }
        ReaderFullBlock({ title: '音色', meta: this.voiceLabel() }) {
          Column() {
            ReaderFullChoiceRow({ values: ['系统默认', '清晰女声', '沉稳男声'], active: this.voiceLabel() })
          }
          .width('100%')
          .onClick(() => {
            MotionAdapter.apply('dropdown.menu.expand', this.reducedMotion, () => {
              this.cycleVoice();
            });
          })
        }
        ReaderFullBlock({ title: '朗读范围', meta: this.scopeLabel() }) {
          Column() {
            ReaderFullChoiceRow({ values: ['当前章节', '本书剩余'], active: this.scopeLabel() })
          }
          .width('100%')
          .onClick(() => {
            MotionAdapter.apply('dropdown.menu.expand', this.reducedMotion, () => {
              this.cycleScope();
            });
          })
        }
        ReaderFullBlock({ title: '定时关闭', meta: this.timerLabel() }) {
          Column() {
            ReaderFullChoiceRow({ values: ['不定时', '15 分钟', '30 分钟'], active: this.timerLabel() })
          }
          .width('100%')
          .onClick(() => {
            MotionAdapter.apply('dropdown.menu.expand', this.reducedMotion, () => {
              this.cycleTimer();
            });
          })
        }
      }
      .width('100%')
      .height('100%')
      .padding(10)
    }
  }
}
