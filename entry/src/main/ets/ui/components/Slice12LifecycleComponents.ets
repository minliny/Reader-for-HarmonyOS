// Slice 12 native lifecycle/accessibility surfaces. These pages execute only
// locally admitted actions; missing system-settings return, notification,
// background scheduling and fold posture remain visibly fail-closed.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { ReaderUiStore } from '../store/ReaderUiStore';
import { MotionAdapter } from '../adapters/MotionAdapter';
import { ViewportAdapter } from '../adapters/ViewportAdapter';

@Component
struct Slice12StatusCard {
  @Prop title: string = '';
  @Prop message: string = '';
  @Prop status: string = '';
  @Prop warning: boolean = false;

  build() {
    Column({ space: 6 }) {
      Row({ space: 8 }) {
        Text(this.title)
          .fontSize(14)
          .fontWeight(800)
          .fontColor(ColorTokens.ink)
          .layoutWeight(1)
        if (this.status.length > 0) {
          Text(this.status)
            .fontSize(10)
            .fontWeight(800)
            .fontColor(this.warning ? ColorTokens.accent : ColorTokens.primaryDark)
            .padding({ left: 8, right: 8, top: 4, bottom: 4 })
            .borderRadius(DemoAliasTokens.radiusPill)
            .backgroundColor(ColorTokens.metaBg)
        }
      }
      .width('100%')
      Text(this.message)
        .fontSize(12)
        .lineHeight(18)
        .fontColor(ColorTokens.muted)
        .width('100%')
    }
    .width('100%')
    .padding(12)
    .border({ width: 1, color: this.warning ? ColorTokens.accent : ColorTokens.border })
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(DemoAliasTokens.surface)
    .accessibilityText(`${this.title}，${this.status}。${this.message}`)
  }
}

@Component
struct Slice12ActionButton {
  @Prop label: string = '';
  @Prop secondary: boolean = false;
  @Prop disabled: boolean = false;
  @Prop actionId: string = '';
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;

  private invoke(): void {
    if (this.disabled) return;
    if (this.actionId === 'welcome-continue') {
      MotionAdapter.apply('app.route.push.forward', this.reducedMotion, this.getUIContext(), () => {
        ReaderUiStore.dispatch({ type: 'route-push', id: 'onboarding-capability-setup' });
      });
    } else if (this.actionId === 'capability-recovery') {
      MotionAdapter.apply('app.route.push.forward', this.reducedMotion, this.getUIContext(), () => {
        ReaderUiStore.dispatch({ type: 'route-push', id: 'permission-recovery' });
      });
    } else if (this.actionId === 'capability-finish') {
      ReaderUiStore.dispatch({ type: 'first-open-done' });
      MotionAdapter.apply('app.route.replace', this.reducedMotion, this.getUIContext(), () => {
        ReaderUiStore.dispatch({ type: 'route-replace', id: 'bookshelf' });
      });
    } else if (this.actionId === 'file-picker-recovery') {
      MotionAdapter.apply('app.route.replace', this.reducedMotion, this.getUIContext(), () => {
        ReaderUiStore.dispatch({ type: 'route-replace', id: 'local-import' });
      });
    } else if (this.actionId === 'back') {
      MotionAdapter.apply('app.route.pop.backward', this.reducedMotion, this.getUIContext(), () => {
        ReaderUiStore.dispatch({ type: 'route-pop' });
      });
    } else if (this.actionId === 'reset-reduced-motion') {
      ReaderUiStore.dispatch({ type: 'toggle-reduced-motion', enabled: false });
    }
  }

  build() {
    Text(this.label)
      .fontSize(13)
      .fontWeight(800)
      .fontColor(this.disabled ? ColorTokens.muted :
        (this.secondary ? ColorTokens.primaryDark : DemoAliasTokens.onPrimary))
      .width('100%')
      .constraintSize({ minHeight: 48 })
      .textAlign(TextAlign.Center)
      .borderRadius(DemoAliasTokens.radiusPill)
      .backgroundColor(this.disabled ? ColorTokens.metaBg :
        (this.secondary ? DemoAliasTokens.surface : ColorTokens.primary))
      .border({ width: this.secondary || this.disabled ? 1 : 0, color: ColorTokens.border })
      .enabled(!this.disabled)
      .accessibilityText(this.label)
      .accessibilityDescription(this.disabled ? '当前不可用' : '按钮')
      .onClick(() => this.invoke())
  }
}

@Component
export struct Slice12OnboardingWelcomePage {
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;

  build() {
    Column({ space: 14 }) {
      Text('欢迎使用 Reader')
        .fontSize(28)
        .fontWeight(800)
        .fontColor(ColorTokens.ink)
        .width('100%')
        .accessibilityText('欢迎使用 Reader')
      Text('Reader 的书架、书源、阅读、朗读和同步分别由 Core 与系统能力协作完成。权限只在你触发对应功能时申请。')
        .fontSize(14)
        .lineHeight(22)
        .fontColor(ColorTokens.muted)
        .width('100%')
      Slice12StatusCard({
        title: '本地阅读', status: '无需预授权',
        message: '导入时打开系统文档选择器；取消或选取失败不会授予宽泛存储权限。',
      })
      Slice12StatusCard({
        title: '剪贴板与分享', status: '按需触发',
        message: '粘贴书源时才请求剪贴板权限；分享只使用 Core 实际导出的书源内容。',
      })
      Slice12StatusCard({
        title: '首次使用状态', status: '合同缺失', warning: true,
        message: '首次完成标记的持久化、版本与迁移协议尚未冻结，因此本页不声称跨重启已完成。',
      })
      Slice12ActionButton({ label: '继续', actionId: 'welcome-continue' })
    }
    .width('100%')
    .height('100%')
    .padding({ left: 20, right: 20, top: 48, bottom: 24 })
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct Slice12OnboardingCapabilityPage {
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;

  build() {
    Column({ space: 12 }) {
      Text('按需启用平台能力')
        .fontSize(24)
        .fontWeight(800)
        .fontColor(ColorTokens.ink)
        .width('100%')
      Slice12StatusCard({
        title: '文件访问', status: '系统选择器',
        message: '选择“导入本地书”后由系统文档选择器返回一次性 URI；拒绝后可重新选择。',
      })
      Slice12StatusCard({
        title: '读取剪贴板', status: '使用时询问',
        message: '只在书源导入页点击“从剪贴板导入”后检查并请求 READ_PASTEBOARD。',
      })
      Slice12StatusCard({
        title: '通知与后台刷新', status: '业务合同未闭合', warning: true,
        message: '现有 Host 适配器和自检不是产品入口；不会在引导中提前申请或假装已启用。',
      })
      Slice12ActionButton({ label: '查看权限恢复方式', secondary: true, actionId: 'capability-recovery' })
      Slice12ActionButton({ label: '稍后设置，进入书架', actionId: 'capability-finish' })
    }
    .width('100%')
    .height('100%')
    .padding({ left: 20, right: 20, top: 36, bottom: 24 })
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct Slice12PermissionRecoveryPage {
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;

  build() {
    Column({ space: 12 }) {
      Text('权限与能力恢复')
        .fontSize(24)
        .fontWeight(800)
        .fontColor(ColorTokens.ink)
        .width('100%')
      Slice12StatusCard({
        title: '本地文件', status: '可恢复',
        message: 'HarmonyOS 通过系统文档选择器授权单个文件。重新打开选择器即可恢复，不要求永久存储权限。',
      })
      Slice12ActionButton({ label: '重新选择本地书', actionId: 'file-picker-recovery' })
      Slice12StatusCard({
        title: '剪贴板', status: '原业务入口重试',
        message: '若拒绝读取剪贴板，请返回书源导入页再次点击剪贴板导入；系统只会在该业务动作中请求权限。',
      })
      Slice12StatusCard({
        title: '前往系统设置并回流', status: 'Host 合同缺失', warning: true,
        message: '当前没有冻结的 app-settings 打开请求、返回关联 id 与自动复检协议，因此不会提供无效按钮。',
      })
      Slice12ActionButton({ label: '返回', secondary: true, actionId: 'back' })
    }
    .width('100%')
    .height('100%')
    .padding({ left: 20, right: 20, top: 36, bottom: 24 })
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct Slice12AccessibilitySettingsPage {
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;
  @StorageProp(ViewportAdapter.K_CLASS) viewportClass: string = 'phone';
  @StorageProp(ViewportAdapter.K_FOLD_POSTURE) foldPosture: string = 'unverified';

  private viewportLabel(): string {
    if (this.viewportClass === 'compact-landscape') return 'Compact Landscape';
    if (this.viewportClass === 'tablet') return 'Tablet';
    return 'Phone';
  }

  build() {
    Column({ space: 12 }) {
      Slice12StatusCard({
        title: '当前布局状态', status: this.viewportLabel(),
        message: `窗口尺寸实时分类；Fold posture：${this.foldPosture}。未收到 hinge Host 事件时不会按宽度猜测折叠状态。`,
      })
      Row({ space: 12 }) {
        Column({ space: 3 }) {
          Text('减少动态效果')
            .fontSize(14)
            .fontWeight(800)
            .fontColor(ColorTokens.ink)
          Text('关闭转场时长，并用静态加载提示替代旋转动画；设置持久化到 Harmony preferences。')
            .fontSize(11)
            .fontColor(ColorTokens.muted)
            .maxLines(3)
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)
        Toggle({ type: ToggleType.Switch, isOn: this.reducedMotion })
          .selectedColor(ColorTokens.primary)
          .accessibilityText('减少动态效果')
          .accessibilityDescription(this.reducedMotion ? '已开启' : '已关闭')
          .onChange((enabled: boolean) => {
            ReaderUiStore.dispatch({ type: 'toggle-reduced-motion', enabled: enabled });
          })
      }
      .width('100%')
      .constraintSize({ minHeight: 64 })
      .padding(12)
      .border({ width: 1, color: ColorTokens.border })
      .borderRadius(DemoAliasTokens.radiusMd)
      .backgroundColor(DemoAliasTokens.surface)
      Slice12ActionButton({
        label: '恢复动效默认值（关闭减少动态）', secondary: true, actionId: 'reset-reduced-motion',
      })
      Slice12StatusCard({
        title: '屏幕阅读器与焦点', status: '需真机验收', warning: true,
        message: '共享导航与主要操作已补语义标签；逐页阅读顺序、焦点回还和错误播报仍须屏幕阅读器录屏。',
      })
      Slice12StatusCard({
        title: '系统文字大小与对比度', status: '需真机验收', warning: true,
        message: '应用不覆盖系统文字缩放。大字号裁切、颜色对比和键盘导航必须在设备矩阵中验证。',
      })
      Slice12StatusCard({
        title: '重置全部设置', status: '合同缺失', warning: true,
        message: 'Core 业务数据、阅读外观与平台偏好的全量重置 owner/范围/迁移尚未冻结；本页只重置 reducedMotion。',
      })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}
