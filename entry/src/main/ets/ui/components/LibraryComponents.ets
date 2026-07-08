// LibraryComponents — Library / Book / Search flow-page components (Batch 2).
// Ported from docs/ui-handoff/normalized-html (source-switch-results.html, ...)
// + reader-components.css. Route-driven: render as FlowShell body components
// via ViewStateRenderer(column). Colors via ColorTokens / DemoAliasTokens;
// sizes are bare vp (lint_tokens only forbids hex / px-unit strings).
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { SafeAreaAdapter } from '../adapters/SafeAreaAdapter';
import { ReaderUiStore } from '../store/ReaderUiStore';

interface SourceToolStep {
  title: string;
  detail: string;
  status: string;
}

interface SourceToolMetric {
  label: string;
  value: string;
  detail: string;
}

interface SourceToolLog {
  time: string;
  level: string;
  message: string;
  detail: string;
}

// ── Source item (.reader-source-item) ──────────────────────────────────────
//   list-title 15/600 + list-detail 12 (muted) + trailing status chip.
@Component
export struct SourceItem {
  @Prop title: string = '';
  @Prop detail: string = '';
  @Prop chip: string = '';

  build() {
    Row() {
      Column() {
        Text(this.title)
          .fontSize(15).fontWeight(600).fontColor(ColorTokens.ink)
        if (this.detail !== '') {
          Text(this.detail)
            .fontSize(12).fontColor(ColorTokens.muted)
            .margin({ top: 2 })
        }
      }
      .alignItems(HorizontalAlign.Start)
      .layoutWeight(1)

      if (this.chip !== '') {
        Text(this.chip)
          .fontSize(12).fontColor(ColorTokens.primary)
          .padding({ left: 10, right: 10, top: 4, bottom: 4 })
          .border({ width: 1, color: ColorTokens.primary })
          .borderRadius(DemoAliasTokens.radiusPill)
      }
    }
    .width('100%')
    .padding({ left: 16, right: 16, top: 14, bottom: 14 })
    .border({ width: { bottom: 1 }, color: ColorTokens.border })
    .alignItems(VerticalAlign.Center)
  }
}

// ── Source switch results panel (source-switch-results.html) ───────────────
//   FlowShell body: header (title "换源结果" + close → route-pop) + source list
//   (4 candidate sources with latency + "可切换" chip). Replaces the generic
//   Overlay/ListRow fallback — the book-detail 换源 action now route-pushes
//   here (Batch 2 first cut: source-switch from fake overlay → real route).
@Component
export struct SourceSwitchResultsPanel {
  @StorageProp(SafeAreaAdapter.K_TOP) safeAreaTop: number = SafeAreaAdapter.DEFAULT_TOP;
  @StorageProp(SafeAreaAdapter.K_BOTTOM) safeAreaBottom: number = SafeAreaAdapter.DEFAULT_BOTTOM;

  build() {
    Column() {
      // .reader-page-header: title + close (route-pop back to book-detail).
      Row() {
        Text('换源结果')
          .fontSize(18).fontWeight(700).fontColor(ColorTokens.ink)
          .layoutWeight(1)
        Text('关闭')
          .fontSize(13).fontColor(ColorTokens.primary)
          .padding({ left: 12, right: 12, top: 8, bottom: 8 })
          .onClick(() => ReaderUiStore.dispatch({ type: 'route-pop' }))
      }
      .width('100%')
      .height(52)
      .padding({ left: 16, right: 16 })
      .alignItems(VerticalAlign.Center)
      .border({ width: { bottom: 1 }, color: ColorTokens.border })

      // .reader-source-list: candidate sources by latency.
      Scroll() {
        Column() {
          SourceItem({ title: '书源 1', detail: '章节完整 · 延迟 120ms', chip: '可切换' })
          SourceItem({ title: '书源 2', detail: '章节完整 · 延迟 240ms', chip: '可切换' })
          SourceItem({ title: '书源 3', detail: '章节完整 · 延迟 360ms', chip: '可切换' })
          SourceItem({ title: '书源 4', detail: '章节完整 · 延迟 480ms', chip: '可切换' })
        }
      }
      .layoutWeight(1)
      .align(Alignment.Top)
    }
    .width('100%')
    .height('100%')
    .padding({ top: this.safeAreaTop, bottom: this.safeAreaBottom })
    .backgroundColor(ColorTokens.paper)
  }
}

@Component
struct SourceToolChip {
  @Prop label: string = '';
  @Prop tone: string = 'soft';

  build() {
    Text(this.label)
      .fontSize(11)
      .fontWeight(800)
      .fontColor(this.tone === 'filled' ? DemoAliasTokens.onPrimary :
        (this.tone === 'warn' ? ColorTokens.accent : ColorTokens.primaryDark))
      .height(26)
      .padding({ left: 10, right: 10 })
      .borderRadius(DemoAliasTokens.radiusPill)
      .backgroundColor(this.tone === 'filled' ? ColorTokens.primary : ColorTokens.metaBg)
      .border({ width: this.tone === 'filled' ? 0 : 1, color: this.tone === 'warn' ? ColorTokens.accent : ColorTokens.border })
  }
}

@Component
struct SourceToolCard {
  @Prop title: string = '';
  @Prop subtitle: string = '';
  @Prop chip: string = '';
  @Prop tone: string = 'soft';

  build() {
    Column() {
      Row() {
        Column() {
          Text(this.title)
            .fontSize(16)
            .fontWeight(850)
            .fontColor(ColorTokens.ink)
            .maxLines(2)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
          if (this.subtitle.length > 0) {
            Text(this.subtitle)
              .fontSize(12)
              .lineHeight(18)
              .fontColor(ColorTokens.muted)
              .margin({ top: 5 })
              .maxLines(2)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
          }
        }
        .alignItems(HorizontalAlign.Start)
        .layoutWeight(1)
        if (this.chip.length > 0) {
          SourceToolChip({ label: this.chip, tone: this.tone })
            .margin({ left: 10 })
        }
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)
    }
    .width('100%')
    .padding({ left: 14, right: 14, top: 14, bottom: 14 })
    .borderRadius(DemoAliasTokens.radiusLg)
    .backgroundColor(DemoAliasTokens.surface)
    .border({ width: 1, color: ColorTokens.border })
    .shadow({ radius: 18, color: DemoAliasTokens.shadowSoftColor, offsetX: 0, offsetY: 6 })
  }
}

@Component
struct SourceToolSectionTitle {
  @Prop title: string = '';

  build() {
    Text(this.title)
      .fontSize(13)
      .fontWeight(900)
      .fontColor(ColorTokens.ink)
      .width('100%')
  }
}

@Component
struct SourceToolRow {
  @Prop title: string = '';
  @Prop detail: string = '';
  @Prop chip: string = '';
  @Prop tone: string = 'soft';

  build() {
    Row() {
      Column() {
        Text(this.title)
          .fontSize(13)
          .fontWeight(800)
          .fontColor(ColorTokens.ink)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        if (this.detail.length > 0) {
          Text(this.detail)
            .fontSize(11)
            .lineHeight(16)
            .fontColor(ColorTokens.muted)
            .margin({ top: 4 })
            .maxLines(2)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
      }
      .alignItems(HorizontalAlign.Start)
      .layoutWeight(1)
      if (this.chip.length > 0) {
        SourceToolChip({ label: this.chip, tone: this.tone })
          .margin({ left: 10 })
      }
    }
    .width('100%')
    .constraintSize({ minHeight: 56 })
    .padding({ left: 12, right: 12, top: 10, bottom: 10 })
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(ColorTokens.floatingControlBg)
    .border({ width: 1, color: ColorTokens.border })
    .alignItems(VerticalAlign.Center)
  }
}

@Component
struct SourceToolActionButton {
  @Prop label: string = '';
  @Prop primary: boolean = false;
  @Prop warning: boolean = false;

  build() {
    Text(this.label)
      .fontSize(13)
      .fontWeight(850)
      .fontColor(this.primary || this.warning ? DemoAliasTokens.onPrimary : ColorTokens.primaryDark)
      .height(40)
      .layoutWeight(1)
      .textAlign(TextAlign.Center)
      .borderRadius(DemoAliasTokens.radiusPill)
      .backgroundColor(this.warning ? ColorTokens.accent : (this.primary ? ColorTokens.primary : ColorTokens.metaBg))
      .border({ width: this.primary || this.warning ? 0 : 1, color: ColorTokens.border })
  }
}

@Component
struct SourceToolProgressLine {
  @Prop progress: number = 0.64;

  build() {
    Stack({ alignContent: Alignment.Start }) {
      Row()
        .width('100%')
        .height(5)
        .borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(ColorTokens.metaBg)
      Row()
        .width(`${Math.round(this.progress * 100)}%`)
        .height(5)
        .borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(ColorTokens.primary)
    }
    .width('100%')
    .height(5)
  }
}

@Component
struct SourceToolCodeLine {
  @Prop number: string = '';
  @Prop text: string = '';

  build() {
    Row() {
      Text(this.number)
        .fontSize(10)
        .fontColor(ColorTokens.muted)
        .width(26)
        .textAlign(TextAlign.End)
      Text(this.text)
        .fontSize(11)
        .lineHeight(18)
        .fontColor(ColorTokens.controlInk)
        .layoutWeight(1)
        .margin({ left: 10 })
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
    }
    .width('100%')
    .padding({ top: 3, bottom: 3 })
    .alignItems(VerticalAlign.Center)
  }
}

@Component
struct SourceToolStepRow {
  @Prop title: string = '';
  @Prop detail: string = '';
  @Prop status: string = '';

  build() {
    Row() {
      Circle()
        .width(9)
        .height(9)
        .fill(this.status === '失败' ? ColorTokens.accent : ColorTokens.primary)
      Column() {
        Text(this.title)
          .fontSize(13)
          .fontWeight(800)
          .fontColor(ColorTokens.ink)
        Text(this.detail)
          .fontSize(11)
          .lineHeight(16)
          .fontColor(ColorTokens.muted)
          .margin({ top: 3 })
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .alignItems(HorizontalAlign.Start)
      .layoutWeight(1)
      .margin({ left: 10 })
      SourceToolChip({ label: this.status, tone: this.status === '失败' ? 'warn' : 'soft' })
    }
    .width('100%')
    .padding({ left: 12, right: 12, top: 12, bottom: 12 })
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(ColorTokens.floatingControlBg)
    .border({ width: 1, color: ColorTokens.border })
    .alignItems(VerticalAlign.Center)
  }
}

@Component
struct SourceToolLogRow {
  @Prop time: string = '';
  @Prop level: string = '';
  @Prop message: string = '';
  @Prop detail: string = '';

  build() {
    Column() {
      Row() {
        Text(this.time)
          .fontSize(10)
          .fontColor(ColorTokens.muted)
          .layoutWeight(1)
        SourceToolChip({ label: this.level, tone: this.level === 'ERROR' ? 'warn' : 'soft' })
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)
      Text(this.message)
        .fontSize(13)
        .fontWeight(800)
        .fontColor(ColorTokens.ink)
        .margin({ top: 6 })
      Text(this.detail)
        .fontSize(11)
        .lineHeight(16)
        .fontColor(ColorTokens.muted)
        .margin({ top: 4 })
        .maxLines(2)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
    }
    .width('100%')
    .padding(12)
    .borderRadius(DemoAliasTokens.radiusMd)
    .backgroundColor(ColorTokens.floatingControlBg)
    .border({ width: 1, color: ColorTokens.border })
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
struct SourceToolMetricGrid {
  @Prop variant: string = 'search';
  private search: SourceToolMetric[] = [
    { label: '命中数量', value: '12', detail: '列表规则返回 12 条' },
    { label: '书名字段', value: '斗破苍穹', detail: '.book-name text' },
    { label: '作者字段', value: '天蚕土豆', detail: '.author text' },
    { label: '详情 URL', value: '有效', detail: '/book/123/' },
  ];
  private detail: SourceToolMetric[] = [
    { label: '书名', value: '斗破苍穹', detail: 'meta.title' },
    { label: '作者', value: '天蚕土豆', detail: 'meta.author' },
    { label: '封面', value: '已解析', detail: '.cover img@src' },
    { label: '简介', value: '312 字', detail: '.intro text' },
  ];
  private catalog: SourceToolMetric[] = [
    { label: '章节数量', value: '1280', detail: 'catalog list' },
    { label: '首章', value: '第一章', detail: 'URL 有效' },
    { label: '末章', value: '风雨夜', detail: 'URL 有效' },
    { label: '去重', value: '通过', detail: '未发现重复章节' },
  ];

  private metrics(): SourceToolMetric[] {
    if (this.variant === 'detail') return this.detail;
    if (this.variant === 'catalog') return this.catalog;
    return this.search;
  }

  build() {
    Flex({ wrap: FlexWrap.Wrap, justifyContent: FlexAlign.SpaceBetween }) {
      ForEach(this.metrics(), (item: SourceToolMetric, idx: number) => {
        Column() {
          Text(item.label)
            .fontSize(10)
            .fontColor(ColorTokens.muted)
          Text(item.value)
            .fontSize(15)
            .fontWeight(900)
            .fontColor(ColorTokens.primaryDark)
            .margin({ top: 4 })
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
          Text(item.detail)
            .fontSize(10)
            .fontColor(ColorTokens.muted)
            .margin({ top: 4 })
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
        .width('48%')
        .padding(12)
        .borderRadius(DemoAliasTokens.radiusMd)
        .backgroundColor(ColorTokens.floatingControlBg)
        .border({ width: 1, color: ColorTokens.border })
        .margin({ bottom: 8 })
        .alignItems(HorizontalAlign.Start)
      }, (item: SourceToolMetric, idx: number) => `${item.label}-${idx}`)
    }
    .width('100%')
  }
}

@Component
export struct SourceImportPreviewPage {
  private sources: Array<[string, string, string, string]> = [
    ['起点中文网', 'https://qidian.example/source.json', '新增', 'soft'],
    ['晋江文学城', 'https://jjwxc.example/source.json', '覆盖', 'filled'],
    ['失效示例源', '规则版本过旧，正文规则缺失', '跳过', 'warn'],
  ];

  build() {
    Column() {
      SourceToolCard({ title: '网络导入', subtitle: 'https://example.com/booksource.json', chip: '共 24 个书源', tone: 'filled' })
      SourceToolSectionTitle({ title: '冲突处理' })
        .margin({ top: 14, bottom: 8 })
      Row() {
        SourceToolChip({ label: '同名覆盖', tone: 'filled' })
        SourceToolChip({ label: '保留本地', tone: 'soft' })
          .margin({ left: 8 })
        SourceToolChip({ label: '仅新增', tone: 'soft' })
          .margin({ left: 8 })
      }
      .width('100%')
      .margin({ bottom: 10 })
      ForEach(this.sources, (item: [string, string, string, string], idx: number) => {
        SourceToolRow({ title: item[0], detail: item[1], chip: item[2], tone: item[3] })
          .margin({ bottom: 8 })
      }, (item: [string, string, string, string], idx: number) => `${item[0]}-${idx}`)
      Row() {
        SourceToolActionButton({ label: '取消' })
        SourceToolActionButton({ label: '确认导入', primary: true })
          .margin({ left: 10 })
      }
      .width('100%')
      .margin({ top: 4 })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct SourceGroupsPage {
  private groups: Array<[string, string, string, string]> = [
    ['全部分组', '24 个书源 · 默认入口', '系统', 'filled'],
    ['玄幻书源', '8 个书源 · 2 个停用', '常用', 'soft'],
    ['起点导入', '6 个书源 · 由网络导入创建', '导入', 'soft'],
    ['测试书源', '3 个书源 · 仅用于规则调测', '测试', 'warn'],
  ];

  build() {
    Column() {
      SourceToolCard({ title: '分组管理', subtitle: '分组用于筛选和批量整理书源', chip: '4 组' })
      SourceToolSectionTitle({ title: '分组' })
        .margin({ top: 14, bottom: 8 })
      ForEach(this.groups, (item: [string, string, string, string], idx: number) => {
        SourceToolRow({ title: item[0], detail: item[1], chip: item[2], tone: item[3] })
          .margin({ bottom: 8 })
      }, (item: [string, string, string, string], idx: number) => `${item[0]}-${idx}`)
      Row() {
        SourceToolActionButton({ label: '批量移动' })
        SourceToolActionButton({ label: '新增分组', primary: true })
          .margin({ left: 10 })
      }
      .width('100%')
      .margin({ top: 4 })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct SourceDetectPage {
  private steps: SourceToolStep[] = [
    { title: '站点访问', detail: 'GET https://biquge.example · 200 OK · 108ms', status: '通过' },
    { title: '搜索规则', detail: '关键词「斗破苍穹」返回 12 条结果', status: '通过' },
    { title: '详情规则', detail: '书名、作者、封面与简介均可解析', status: '通过' },
    { title: '目录规则', detail: '解析 1280 章，章节 URL 有效', status: '通过' },
    { title: '正文规则', detail: '.content 节点为空，疑似广告包装层变化', status: '失败' },
  ];

  build() {
    Column() {
      SourceToolCard({ title: '笔趣阁', subtitle: '5 项检测 · 4 项通过 · 1 项失败', chip: '正文异常', tone: 'warn' })
      SourceToolSectionTitle({ title: '检测项' })
        .margin({ top: 14, bottom: 8 })
      ForEach(this.steps, (step: SourceToolStep, idx: number) => {
        SourceToolStepRow({ title: step.title, detail: step.detail, status: step.status })
          .margin({ bottom: 8 })
      }, (step: SourceToolStep, idx: number) => `${step.title}-${idx}`)
      Row() {
        SourceToolActionButton({ label: '失败定位' })
        SourceToolActionButton({ label: '编辑正文规则', primary: true })
          .margin({ left: 10 })
      }
      .width('100%')
      .margin({ top: 4 })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct SourceDebugPage {
  private modules: Array<[string, string]> = [
    ['搜索', 'soft'],
    ['详情', 'soft'],
    ['目录', 'soft'],
    ['正文', 'filled'],
  ];
  private rows: SourceToolMetric[] = [
    { label: '章节标题', value: '第 128 章 风雨夜', detail: 'h1.chapter-title' },
    { label: '正文长度', value: '0 字', detail: '.content 节点为空' },
    { label: '匹配节点', value: '0', detail: '规则未命中' },
    { label: '错误原因', value: '包装层变化', detail: '建议改为 .chapter-content' },
  ];

  build() {
    Column() {
      SourceToolCard({ title: '正文模块调测', subtitle: '笔趣阁 · 第 128 章 风雨夜', chip: '待修复', tone: 'warn' })
      Row() {
        ForEach(this.modules, (item: [string, string], idx: number) => {
          SourceToolChip({ label: item[0], tone: item[1] })
            .margin({ right: 8, top: 12 })
        }, (item: [string, string], idx: number) => `${item[0]}-${idx}`)
      }
      .width('100%')
      .margin({ bottom: 10 })
      SourceToolRow({ title: '章节 URL', detail: 'https://biquge.example/book/123/128.html', chip: 'GET' })
        .margin({ bottom: 8 })
      SourceToolRow({ title: '正文规则', detail: '.content > p', chip: '当前' })
        .margin({ bottom: 8 })
      SourceToolRow({ title: '网络请求', detail: 'GET https://biquge.example/book/123/128.html · 200 OK · 412ms', chip: '200' })
        .margin({ bottom: 12 })
      ForEach(this.rows, (row: SourceToolMetric, idx: number) => {
        SourceToolRow({ title: row.label, detail: `${row.value} · ${row.detail}`, chip: idx === 3 ? '建议' : '' })
          .margin({ bottom: 8 })
      }, (row: SourceToolMetric, idx: number) => `${row.label}-${idx}`)
      SourceToolCard({ title: '修复建议', subtitle: '将正文规则改为 .chapter-content，并过滤 .ad 节点。', chip: '可应用' })
        .margin({ top: 4 })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct SourceDebugRunningPage {
  private steps: SourceToolStep[] = [
    { title: '请求章节 HTML', detail: '正在下载目标章节源码', status: '完成' },
    { title: '执行正文规则', detail: '运行 .chapter-content > p 选择器', status: '进行中' },
    { title: '生成解析结果', detail: '等待正文节点与日志归档', status: '等待' },
  ];

  build() {
    Column() {
      SourceToolCard({ title: '正在调测正文模块', subtitle: '笔趣阁 · 第 128 章 风雨夜', chip: '运行中', tone: 'filled' })
      SourceToolProgressLine({ progress: 0.68 })
        .margin({ top: 12, bottom: 14 })
      ForEach(this.steps, (step: SourceToolStep, idx: number) => {
        SourceToolStepRow({ title: step.title, detail: step.detail, status: step.status })
          .margin({ bottom: 8 })
      }, (step: SourceToolStep, idx: number) => `${step.title}-${idx}`)
      Row() {
        SourceToolActionButton({ label: '取消' })
        SourceToolActionButton({ label: '查看日志', primary: true })
          .margin({ left: 10 })
      }
      .width('100%')
      .margin({ top: 4 })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct SourceDebugResultPage {
  @Prop variant: string = 'search';

  private title(): string {
    if (this.variant === 'detail') return '详情模块调测';
    if (this.variant === 'catalog') return '目录模块调测';
    return '搜索模块调测';
  }

  private subtitle(): string {
    if (this.variant === 'detail') return '/book/123/ · 基础信息解析完成';
    if (this.variant === 'catalog') return '/book/123/catalog · 章节列表解析完成';
    return '关键词 斗破苍穹 · 搜索结果解析完成';
  }

  build() {
    Column() {
      SourceToolCard({ title: this.title(), subtitle: this.subtitle(), chip: '通过', tone: 'filled' })
      SourceToolSectionTitle({ title: '解析字段' })
        .margin({ top: 14, bottom: 8 })
      SourceToolMetricGrid({ variant: this.variant })
      Row() {
        SourceToolActionButton({ label: '查看源码' })
        SourceToolActionButton({ label: '保存规则', primary: true })
          .margin({ left: 10 })
      }
      .width('100%')
      .margin({ top: 2 })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct SourceDebugContentLogPage {
  private logs: SourceToolLog[] = [
    { time: '10:30:18.120', level: 'INFO', message: '请求章节 HTML', detail: 'GET /book/123/128.html · 200 OK · 412ms' },
    { time: '10:30:18.538', level: 'INFO', message: '执行正文规则', detail: '.content > p · 匹配节点 0' },
    { time: '10:30:18.541', level: 'ERROR', message: '返回错误', detail: '正文为空，当前规则未命中章节正文节点。' },
    { time: '10:30:18.560', level: 'WARN', message: '定位结果', detail: '发现 .chapter-content 节点，建议替换规则。' },
  ];

  build() {
    Column() {
      SourceToolCard({ title: '正文模块日志', subtitle: '本次调测 4 条关键日志', chip: '1 错误', tone: 'warn' })
      SourceToolSectionTitle({ title: '日志' })
        .margin({ top: 14, bottom: 8 })
      ForEach(this.logs, (log: SourceToolLog, idx: number) => {
        SourceToolLogRow({ time: log.time, level: log.level, message: log.message, detail: log.detail })
          .margin({ bottom: 8 })
      }, (log: SourceToolLog, idx: number) => `${log.time}-${idx}`)
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct SourceCodeViewPage {
  private lines: Array<[string, string]> = [
    ['001', '<html>'],
    ['012', '<body class="reader">'],
    ['048', '<div class="chapter-content">'],
    ['049', '<p>雨声撞在旧窗上，像一串迟到的脚步。</p>'],
    ['050', '<p>他合上书源调测面板，重新看向正文。</p>'],
    ['086', '</div>'],
  ];

  build() {
    Column() {
      SourceToolCard({ title: '源码查看', subtitle: '正文模块 · 当前请求返回', chip: 'HTML' })
      Column() {
        ForEach(this.lines, (line: [string, string], idx: number) => {
          SourceToolCodeLine({ number: line[0], text: line[1] })
        }, (line: [string, string], idx: number) => `${line[0]}-${idx}`)
      }
      .width('100%')
      .padding(12)
      .borderRadius(DemoAliasTokens.radiusLg)
      .backgroundColor(ColorTokens.floatingControlBg)
      .border({ width: 1, color: ColorTokens.border })
      .margin({ top: 12 })
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct SourceLogsPage {
  private filters: string[] = ['全部', '异常', '警告', '今日'];
  private logs: SourceToolLog[] = [
    { time: '今天 10:30', level: 'ERROR', message: '笔趣阁', detail: '正文为空，.content > p 未匹配任何节点。' },
    { time: '昨天 22:14', level: 'ERROR', message: '旧规则源', detail: '搜索接口返回 403，需要更新 User-Agent。' },
    { time: '周一 08:12', level: 'WARN', message: '本地导入源', detail: '目录存在重复章节，已自动去重。' },
  ];

  build() {
    Column() {
      SourceToolCard({ title: '错误日志', subtitle: '最近 7 天 · 2 个异常 · 1 个警告', chip: '今日' })
      Row() {
        ForEach(this.filters, (filter: string, idx: number) => {
          SourceToolChip({ label: filter, tone: idx === 0 ? 'filled' : 'soft' })
            .margin({ right: 8, top: 12 })
        }, (filter: string, idx: number) => `${filter}-${idx}`)
      }
      .width('100%')
      .margin({ bottom: 10 })
      ForEach(this.logs, (log: SourceToolLog, idx: number) => {
        SourceToolLogRow({ time: log.time, level: log.level, message: log.message, detail: log.detail })
          .margin({ bottom: 8 })
      }, (log: SourceToolLog, idx: number) => `${log.message}-${idx}`)
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}

@Component
export struct SourceDeleteConfirmPage {
  build() {
    Column() {
      SourceToolCard({ title: '删除书源？', subtitle: '将删除已选 3 个书源。不会删除书架书籍，但后续搜索将不再使用这些源。', chip: '谨慎操作', tone: 'warn' })
      SourceToolRow({ title: '同时清除相关检测日志', detail: '删除后可减少无效错误日志，但无法恢复历史调测记录。', chip: '可选' })
        .margin({ top: 12, bottom: 12 })
      Row() {
        SourceToolActionButton({ label: '取消' })
        SourceToolActionButton({ label: '删除', warning: true })
          .margin({ left: 10 })
      }
      .width('100%')
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
  }
}
