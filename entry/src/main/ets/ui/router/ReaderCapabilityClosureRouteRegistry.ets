// Explicit native structure registry for the 24 Reader UI 3.0 capability routes.
//
// Route/shell/title membership remains generated. This table records the exact
// canonical page state and top-level component structure consumed by ArkUI. Its
// execution policy is deliberately fail-closed: generated bindings stay visible
// contract evidence until a concrete HarmonyOS Host/reducer owner is admitted.
import { RouteId, ShellId } from '../../contract/generated/RouteTable';
import { ComponentType } from '../../contract/reader_ui/ViewState';
import { Slice10CapabilityPolicy } from '../store/Slice10CapabilityPolicy';

export enum CapabilityClosureExecutionPolicy {
  CoreBacked = 'CoreBacked',
  NativeBacked = 'NativeBacked',
  PlannedFailClosed = 'PlannedFailClosed',
}

export interface CapabilityClosureRouteDefinition {
  id: RouteId;
  title: string;
  shell: ShellId;
  pageState: string;
  topLevelTypes: ComponentType[];
  executionPolicy: CapabilityClosureExecutionPolicy;
}

function plannedRouteDefinition(
  id: RouteId,
  title: string,
  shell: ShellId,
  pageState: string,
  topLevelTypes: ComponentType[],
): CapabilityClosureRouteDefinition {
  return {
    id,
    title,
    shell,
    pageState,
    topLevelTypes,
    executionPolicy: CapabilityClosureExecutionPolicy.PlannedFailClosed,
  };
}

function coreRouteDefinition(
  id: RouteId,
  title: string,
  shell: ShellId,
  pageState: string,
  topLevelTypes: ComponentType[],
): CapabilityClosureRouteDefinition {
  return {
    id,
    title,
    shell,
    pageState,
    topLevelTypes,
    executionPolicy: CapabilityClosureExecutionPolicy.CoreBacked,
  };
}

function nativeRouteDefinition(
  id: RouteId,
  title: string,
  shell: ShellId,
  pageState: string,
  topLevelTypes: ComponentType[],
): CapabilityClosureRouteDefinition {
  return {
    id,
    title,
    shell,
    pageState,
    topLevelTypes,
    executionPolicy: CapabilityClosureExecutionPolicy.NativeBacked,
  };
}

export class ReaderCapabilityClosureRouteRegistry {
  static readonly ALL: CapabilityClosureRouteDefinition[] = [
    nativeRouteDefinition('onboarding-welcome', '首次使用（Onboarding Welcome）', 'FlowShell', 'default',
      ['AppShellStructure']),
    nativeRouteDefinition('onboarding-capability-setup', '能力与权限设置（Onboarding Capability Setup）',
      'FlowShell', 'permission', ['PermissionRequiredPage']),
    nativeRouteDefinition('permission-recovery', '权限恢复（Permission Recovery）', 'FlowShell', 'permission',
      ['PermissionRequiredPage']),
    plannedRouteDefinition('local-format-support', '本地格式支持（Local Format Support）', 'LibraryShell', 'default',
      ['BackTopBar', 'LocalBookImportPage']),
    plannedRouteDefinition('pdf-reader', 'PDF 阅读（PDF Reader）', 'ReaderShell', 'default',
      ['ReaderBase', 'ReaderTopArea']),
    plannedRouteDefinition('manga-reader', '漫画阅读（Manga Reader）', 'ReaderShell', 'default',
      ['ReaderBase', 'ReaderTopArea']),
    plannedRouteDefinition('http-tts-management', 'HTTP TTS 管理（HTTP TTS Management）', 'SettingsShell', 'default',
      ['BackTopBar', 'SettingsGeneralPage']),
    plannedRouteDefinition('http-tts-editor', 'HTTP TTS 编辑（HTTP TTS Editor）', 'SettingsShell', 'default',
      ['BackTopBar', 'SourceFormPage']),
    plannedRouteDefinition('http-tts-test', 'HTTP TTS 测试（HTTP TTS Test）', 'SettingsShell', 'loading',
      ['BackTopBar', 'GlobalStatePage']),
    plannedRouteDefinition('content-edit', '正文编辑（Content Edit）', 'ReaderShell', 'default',
      ['ReaderTopArea', 'ReaderReplacePanel']),
    plannedRouteDefinition('book-cover-change', '更换封面（Change Book Cover）', 'LibraryShell', 'default',
      ['BackTopBar', 'SourceFormPage']),
    plannedRouteDefinition('book-cover-search', '搜索封面（Search Book Cover）', 'LibraryShell', 'default',
      ['BackTopBar', 'SearchResultsPage']),
    plannedRouteDefinition('chapter-reviews', '章节评论（Chapter Reviews）', 'LibraryShell', 'default',
      ['BackTopBar', 'List']),
    coreRouteDefinition('bookmarks-manager', '书签管理（Bookmarks Manager）', 'LibraryShell', 'default',
      ['BackTopBar', 'ReaderDirectoryPanel']),
    plannedRouteDefinition('download-queue', '下载队列（Download Queue）', 'LibraryShell', 'default',
      ['BackTopBar', 'ReaderBookCachePage']),
    plannedRouteDefinition('download-task-detail', '下载任务（Download Task Detail）', 'LibraryShell', 'default',
      ['BackTopBar', 'ReaderBookCachePage']),
    plannedRouteDefinition('storage-management', '存储管理（Storage Management）', 'SettingsShell', 'default',
      ['BackTopBar', 'GlobalSettingsPage']),
    plannedRouteDefinition('webview-login', '网页登录（WebView Login）', 'FlowShell', 'default',
      ['BackTopBar', 'WebView', 'Button']),
    plannedRouteDefinition('webview-captcha', '人机验证（WebView Captcha）', 'FlowShell', 'default',
      ['BackTopBar', 'WebView']),
    plannedRouteDefinition('webview-challenge', '验证恢复（WebView Challenge Recovery）', 'FlowShell', 'error',
      ['GlobalStatePage']),
    plannedRouteDefinition('webview-cookie-return', 'Cookie 回传（WebView Cookie Return）', 'FlowShell', 'loading',
      ['GlobalStatePage']),
    plannedRouteDefinition('settings-tts', '朗读设置（TTS Settings）', 'SettingsShell', 'default',
      ['BackTopBar', 'SettingsGeneralPage']),
    plannedRouteDefinition('settings-storage', '存储设置（Storage Settings）', 'SettingsShell', 'default',
      ['BackTopBar', 'SettingsGeneralPage']),
    nativeRouteDefinition('settings-accessibility', '无障碍设置（Accessibility Settings）', 'SettingsShell', 'default',
      ['BackTopBar', 'SettingsGeneralPage']),
  ];

  static byId(id: string): CapabilityClosureRouteDefinition | undefined {
    for (let index: number = 0; index < ReaderCapabilityClosureRouteRegistry.ALL.length; index += 1) {
      const definition: CapabilityClosureRouteDefinition =
        ReaderCapabilityClosureRouteRegistry.ALL[index];
      if (definition.id === id) return definition;
    }
    return undefined;
  }

  static has(id: string): boolean {
    return ReaderCapabilityClosureRouteRegistry.byId(id) !== undefined;
  }

  static isFailClosed(id: string): boolean {
    const definition: CapabilityClosureRouteDefinition | undefined =
      ReaderCapabilityClosureRouteRegistry.byId(id);
    return definition !== undefined &&
      definition.executionPolicy === CapabilityClosureExecutionPolicy.PlannedFailClosed;
  }

  static isNativeBacked(id: string): boolean {
    const definition: CapabilityClosureRouteDefinition | undefined =
      ReaderCapabilityClosureRouteRegistry.byId(id);
    return definition !== undefined &&
      definition.executionPolicy === CapabilityClosureExecutionPolicy.NativeBacked;
  }

  static isCoreBacked(id: string): boolean {
    const definition: CapabilityClosureRouteDefinition | undefined =
      ReaderCapabilityClosureRouteRegistry.byId(id);
    if (definition === undefined ||
      definition.executionPolicy !== CapabilityClosureExecutionPolicy.CoreBacked) return false;
    if (id === 'bookmarks-manager') {
      return Slice10CapabilityPolicy.isProduction('reading.bookmarks');
    }
    return false;
  }
}
