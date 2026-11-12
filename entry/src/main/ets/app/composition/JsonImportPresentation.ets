import type { RssJourneyPresentation } from '../../features/rss/presentation/RssJourneyPresentation';
import type { RulesManagementPresentation } from '../../features/settings/presentation/RulesManagementPresentation';
import type { SourceJourneyPresentation } from '../../features/source/presentation/SourceJourneyPresentation';

export type JsonImportContext = 'bookSource' | 'ruleBundle' | 'rssMerge' | 'rssReplace';

export interface JsonImportFocusTargets {
  readonly preferred: string;
  readonly fallback: string;
}

export interface JsonImportFocusReturn extends JsonImportFocusTargets {
  readonly isCurrent: () => boolean;
}

export interface JsonImportOpening {
  readonly id: number;
  readonly context: JsonImportContext;
  readonly title: string;
  readonly description: string;
  readonly focusTargets?: JsonImportFocusTargets;
}

@Observed
export class JsonImportPresentation {
  opening: JsonImportOpening | undefined;
  private sequence: number = 0;
  private current: (() => boolean) | undefined;
  private dispatch: ((url?: string) => void) | undefined;
  private dismissedFocusId: number = 0;

  isOpeningCurrent(id: number): boolean { return this.opening?.id === id && this.current?.() === true; }

  openBookSource(journey: SourceJourneyPresentation, identity: string, searchAction: () => (() => void) | undefined,
    focusTargets?: JsonImportFocusTargets): void {
    this.open('bookSource', (): boolean => journey.isManagementCurrent(identity),
      (url?: string): void => journey.importSources(identity, url, searchAction()), focusTargets);
  }

  openRuleBundle(presentation: RulesManagementPresentation, identity: string): void {
    this.open('ruleBundle', (): boolean => presentation.operations(identity) !== undefined,
      (url?: string): void => presentation.operations(identity)?.importBundle(url, identity));
  }

  openRss(journey: RssJourneyPresentation, context: 'rssMerge' | 'rssReplace', identity: string): void {
    this.open(context, (): boolean => journey.isImportCurrent(identity),
      (url?: string): void => journey.importRssSources(context === 'rssReplace', url, identity));
  }

  private open(context: JsonImportContext, current: () => boolean, dispatch: (url?: string) => void,
    focusTargets?: JsonImportFocusTargets): void {
    if (!current() || (this.opening?.context === context && this.current?.() === true)) return;
    this.current = current;
    this.dispatch = dispatch;
    this.dismissedFocusId = 0;
    const id = ++this.sequence;
    switch (context) {
      case 'bookSource':
        this.opening = { id, context, title: '导入书源', description: '支持 Legado 书源 JSON；本地文件和在线链接共用 Core 导入校验。',
          focusTargets: focusTargets === undefined ? undefined : { preferred: focusTargets.preferred, fallback: focusTargets.fallback } };
        break;
      case 'ruleBundle':
        this.opening = { id, context, title: '导入规则包', description: '本地和在线导入共用 Core 规则包校验；同主键以导入值为准。' };
        break;
      case 'rssMerge':
        this.opening = { id, context, title: '导入 RSS 源', description: '合并导入会保留现有 RSS 来源。' };
        break;
      case 'rssReplace':
        this.opening = { id, context, title: '导入 RSS 源', description: '覆盖导入会原子替换当前 RSS 来源与阅读状态。' };
        break;
    }
  }

  captureFocusReturn(id: number, canRestore: () => boolean): JsonImportFocusReturn | undefined {
    const opening = this.opening, current = this.current;
    if (opening?.id !== id || opening.focusTargets === undefined || current === undefined) return undefined;
    return { preferred: opening.focusTargets.preferred, fallback: opening.focusTargets.fallback,
      isCurrent: (): boolean => this.sequence === id && this.dismissedFocusId === id && this.opening === undefined &&
        current() && canRestore() };
  }

  dismiss(id?: number, restoreFocus: boolean = true): void {
    if (id !== undefined && this.opening?.id !== id) return;
    this.dismissedFocusId = restoreFocus ? this.opening?.id ?? 0 : 0;
    this.current = undefined;
    this.dispatch = undefined;
    this.opening = undefined;
  }

  submit(id: number, url?: string): void {
    if (this.opening?.id !== id) return;
    const current = this.current, dispatch = this.dispatch;
    this.dismiss(id, false);
    if (this.sequence === id && current?.() === true) dispatch?.(url);
  }
}
