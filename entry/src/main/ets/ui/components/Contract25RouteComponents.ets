// Native ArkUI renderers for the 35 Reader UI 2.5 route-state additions.
// Each route is explicitly classified by ReaderContract25RouteRegistry; this
// component is only emitted by generated ViewStateTable entries for that exact
// set, so an unknown route is treated as contract drift instead of a generic
// placeholder page.
import { ColorTokens } from '../../contract/generated/ColorTokens';
import { DemoAliasTokens } from '../../contract/generated/DemoAliasTokens';
import { ReaderTypography } from '../tokens/ReaderTypography';
import { ReaderBase } from './ReaderComponents';
import {
  Contract25RouteDefinition,
  Contract25RouteRendererKind,
  ReaderContract25RouteRegistry,
} from '../router/ReaderContract25RouteRegistry';
import {
  ImportPermissionDeniedPage,
  ImportFormatUnsupportedPage,
  ImportEmptyFilePage,
  ImportParsingPage,
  ImportDuplicatePage,
  ImportConflictResolvePage,
  ImportPartialSuccessPage,
  ImportResultDetailPage,
} from './W1ImportFlowComponents';
import {
  ReaderContentLoadingPage,
  ReaderContentOfflinePage,
  ReaderContentErrorPage,
  ReaderTocLoadingPage,
  ReaderTocOfflinePage,
  ReaderTocErrorPage,
} from './W2ReaderStateComponents';
import {
  ReplaceRuleManagePage,
  ReplaceDeleteConfirmPage,
  ReplaceApplyResultPage,
  ReplaceImportExportPage,
  ReplacePreviewPage,
} from './W5ReplaceRuleComponents';

@Component
struct Contract25StateCard {
  @Prop definition: Contract25RouteDefinition;
  @Prop compact: boolean = false;

  private unavailableMessage(): string {
    return '该兼容路由尚未接入可执行的 HarmonyOS 业务流程。为避免展示未发生的确认、成功、重试或导入结果，当前不会执行任何操作。';
  }

  build() {
    Column() {
      Row({ space: 10 }) {
        Stack({ alignContent: Alignment.Center }) {
          Text('—')
            .fontSize(18)
            .fontWeight(900)
            .fontColor(ColorTokens.accent)
        }
        .width(34)
        .height(34)
        .borderRadius(DemoAliasTokens.radiusPill)
        .backgroundColor(ColorTokens.surfaceSoft)
        Text('兼容路由')
          .fontSize(11)
          .fontWeight(800)
          .fontColor(ColorTokens.muted)
          .layoutWeight(1)
        Text('未接入')
          .fontSize(9)
          .fontWeight(800)
          .fontColor(ColorTokens.accent)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .width('100%')
      .alignItems(VerticalAlign.Center)

      Text('功能暂不可用')
        .fontSize(this.compact ? 22 : 25)
        .fontWeight(800)
        .fontFamily(ReaderTypography.serifFamily())
        .fontColor(ColorTokens.ink)
        .width('100%')
        .margin({ top: 14 })
        .maxLines(2)
        .textOverflow({ overflow: TextOverflow.Ellipsis })

      Text(this.unavailableMessage())
        .fontSize(14)
        .fontWeight(500)
        .fontColor(ColorTokens.controlInk)
        .lineHeight(23)
        .width('100%')
        .margin({ top: 10 })

      Text(`保留路由：${this.definition.title}`)
        .fontSize(12)
        .fontWeight(650)
        .fontColor(ColorTokens.muted)
        .width('100%')
        .margin({ top: 18 })

      Text(this.definition.id)
        .fontSize(9)
        .fontWeight(650)
        .fontColor(ColorTokens.muted)
        .width('100%')
        .margin({ top: 6 })
        .maxLines(1)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
    }
    .width('100%')
    .padding({ left: 18, right: 18, top: 16, bottom: 18 })
    .alignItems(HorizontalAlign.Start)
    .borderRadius(DemoAliasTokens.radiusLg)
    .backgroundColor(ColorTokens.paper)
    .border({ width: 1, color: ColorTokens.border })
  }
}

@Component
struct Contract25ReaderPlane {
  @Prop definition: Contract25RouteDefinition;

  private isFlow(): boolean {
    return this.definition.renderer === Contract25RouteRendererKind.SourceSwitchState;
  }

  // W2/W5 routes have dedicated ArkUI pages that read real Core state.
  // The historical W3 source-switch result matrix is retired by the
  // Reader-UI visual-admission contract and intentionally has no renderer.
  // Returns true if this routeId has a dedicated page (not the generic card).
  private hasDedicatedPage(): boolean {
    const id = this.definition.id;
    // W2 reader content/TOC states
    if (id === 'reader-content-loading' || id === 'reader-content-offline' ||
        id === 'reader-content-error' || id === 'reader-toc-loading' ||
        id === 'reader-toc-offline' || id === 'reader-toc-error') {
      return true;
    }
    // W5 replace rule routes
    if (id === 'reader-replace-page' || id === 'reader-replace-delete-confirm' ||
        id === 'reader-replace-apply-result' || id === 'reader-replace-import-export' ||
        id === 'reader-replace-preview') {
      return true;
    }
    return false;
  }

  @Builder DedicatedPage() {
    if (this.definition.id === 'reader-content-loading') {
      ReaderContentLoadingPage()
    } else if (this.definition.id === 'reader-content-offline') {
      ReaderContentOfflinePage()
    } else if (this.definition.id === 'reader-content-error') {
      ReaderContentErrorPage()
    } else if (this.definition.id === 'reader-toc-loading') {
      ReaderTocLoadingPage()
    } else if (this.definition.id === 'reader-toc-offline') {
      ReaderTocOfflinePage()
    } else if (this.definition.id === 'reader-toc-error') {
      ReaderTocErrorPage()
    } else if (this.definition.id === 'reader-replace-page') {
      ReplaceRuleManagePage()
    } else if (this.definition.id === 'reader-replace-delete-confirm') {
      ReplaceDeleteConfirmPage()
    } else if (this.definition.id === 'reader-replace-apply-result') {
      ReplaceApplyResultPage()
    } else if (this.definition.id === 'reader-replace-import-export') {
      ReplaceImportExportPage()
    } else if (this.definition.id === 'reader-replace-preview') {
      ReplacePreviewPage()
    }
  }

  build() {
    Stack({ alignContent: this.isFlow() ? Alignment.Center : Alignment.Bottom }) {
      ReaderBase()
        .width('100%')
        .height('100%')
      Column()
        .width('100%')
        .height('100%')
        .backgroundColor(ColorTokens.surfaceSoft)
      if (this.hasDedicatedPage()) {
        Column() {
          this.DedicatedPage()
        }
        .width(this.isFlow() ? '90%' : '100%')
        .margin({
          left: this.isFlow() ? 18 : 12,
          right: this.isFlow() ? 18 : 12,
          bottom: this.isFlow() ? 0 : 28,
        })
      } else {
        Contract25StateCard({ definition: this.definition, compact: this.isFlow() })
          .width(this.isFlow() ? '90%' : '100%')
          .margin({
            left: this.isFlow() ? 18 : 12,
            right: this.isFlow() ? 18 : 12,
            bottom: this.isFlow() ? 0 : 28,
          })
      }
    }
    .width('100%')
    .height('100%')
  }
}

@Component
struct Contract25LocalImportPage {
  @Prop definition: Contract25RouteDefinition;

  build() {
    // Dispatch each W1 import route to its own dedicated ArkUI page instead
    // of the generic Contract25StateCard.  Each page has a route-specific
    // phase breadcrumb, content section, and action row — mirroring the
    // Demo's w1-import-renderers.js.  The generic card is only kept as a
    // defensive fallback for unknown import routeIds (which the registry
    // never produces).
    Column() {
      if (this.definition.id === 'import-permission-denied') {
        ImportPermissionDeniedPage()
      } else if (this.definition.id === 'import-format-unsupported') {
        ImportFormatUnsupportedPage()
      } else if (this.definition.id === 'import-empty-file') {
        ImportEmptyFilePage()
      } else if (this.definition.id === 'import-parsing') {
        ImportParsingPage()
      } else if (this.definition.id === 'import-duplicate') {
        ImportDuplicatePage()
      } else if (this.definition.id === 'import-conflict-resolve') {
        ImportConflictResolvePage()
      } else if (this.definition.id === 'import-partial-success') {
        ImportPartialSuccessPage()
      } else if (this.definition.id === 'import-result-detail') {
        ImportResultDetailPage()
      } else {
        Contract25StateCard({ definition: this.definition })
      }
    }
    .width('100%')
    .padding({ top: 8, bottom: 24 })
  }
}

@Component
export struct Contract25RoutePage {
  @Prop routeId: string = '';

  private requiredDefinition(): Contract25RouteDefinition {
    const definition = ReaderContract25RouteRegistry.byId(this.routeId);
    if (definition === undefined) {
      throw new Error(`Reader UI 2.5 route has no explicit ArkUI renderer: ${this.routeId}`);
    }
    return definition;
  }

  private isReaderPlane(): boolean {
    const definition = this.requiredDefinition();
    return definition.renderer !== Contract25RouteRendererKind.LocalImportState;
  }

  build() {
    if (this.isReaderPlane()) {
      Contract25ReaderPlane({ definition: this.requiredDefinition() })
    } else {
      Contract25LocalImportPage({ definition: this.requiredDefinition() })
    }
  }
}
