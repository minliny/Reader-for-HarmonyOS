// Explicit native renderer registry for the 35 routes added by Reader UI 2.5.
//
// Route membership/order/shell/title still comes from the generated RouteTable.
// These routes are intentionally retained for contract compatibility, but their
// underlying workflows have not been connected to HarmonyOS. The registry makes
// that boundary explicit so a route cannot masquerade as a completed action.
import { RouteId, ShellId } from '../../contract/generated/RouteTable';

export enum Contract25RouteRendererKind {
  ReaderWorkspaceState = 'ReaderWorkspaceState',
  ReaderReplacementState = 'ReaderReplacementState',
  SourceSwitchState = 'SourceSwitchState',
  ReaderContentState = 'ReaderContentState',
  LocalImportState = 'LocalImportState',
}

export enum Contract25RouteAvailability {
  LegacyUnavailable = 'LegacyUnavailable',
}

export interface Contract25RouteDefinition {
  id: RouteId;
  title: string;
  shell: ShellId;
  renderer: Contract25RouteRendererKind;
  availability: Contract25RouteAvailability;
}

function unavailableRouteDefinition(
  id: RouteId,
  title: string,
  shell: ShellId,
  renderer: Contract25RouteRendererKind,
): Contract25RouteDefinition {
  return {
    id,
    title,
    shell,
    renderer,
    availability: Contract25RouteAvailability.LegacyUnavailable,
  };
}

export class ReaderContract25RouteRegistry {
  static readonly ALL: Contract25RouteDefinition[] = [
    unavailableRouteDefinition('reader-font-import-confirm', '字体导入确认', 'ReaderShell', Contract25RouteRendererKind.ReaderWorkspaceState),
    unavailableRouteDefinition('reader-font-delete-confirm', '字体删除确认', 'ReaderShell', Contract25RouteRendererKind.ReaderWorkspaceState),
    unavailableRouteDefinition('reader-font-fallback', '字体失效回退', 'ReaderShell', Contract25RouteRendererKind.ReaderWorkspaceState),
    unavailableRouteDefinition('reader-theme-new', '新建主题', 'ReaderShell', Contract25RouteRendererKind.ReaderWorkspaceState),
    unavailableRouteDefinition('reader-theme-delete-confirm', '主题删除确认', 'ReaderShell', Contract25RouteRendererKind.ReaderWorkspaceState),
    unavailableRouteDefinition('reader-typography-reset-confirm', '排版恢复默认确认', 'ReaderShell', Contract25RouteRendererKind.ReaderWorkspaceState),
    unavailableRouteDefinition('reader-replace-delete-confirm', '删除替换规则确认', 'ReaderShell', Contract25RouteRendererKind.ReaderReplacementState),
    unavailableRouteDefinition('reader-replace-apply-result', '替换规则应用结果', 'ReaderShell', Contract25RouteRendererKind.ReaderReplacementState),
    unavailableRouteDefinition('reader-replace-import-export', '替换规则导入导出', 'ReaderShell', Contract25RouteRendererKind.ReaderReplacementState),
    unavailableRouteDefinition('reader-replace-page', '内容替换规则管理', 'ReaderShell', Contract25RouteRendererKind.ReaderReplacementState),
    unavailableRouteDefinition('reader-replace-preview', '替换规则预览', 'ReaderShell', Contract25RouteRendererKind.ReaderReplacementState),
    unavailableRouteDefinition('source-switch-empty', '换源空结果', 'FlowShell', Contract25RouteRendererKind.SourceSwitchState),
    unavailableRouteDefinition('source-switch-error', '换源加载失败', 'FlowShell', Contract25RouteRendererKind.SourceSwitchState),
    unavailableRouteDefinition('source-switch-timeout', '换源超时', 'FlowShell', Contract25RouteRendererKind.SourceSwitchState),
    unavailableRouteDefinition('source-switch-loading', '换源切换中', 'FlowShell', Contract25RouteRendererKind.SourceSwitchState),
    unavailableRouteDefinition('source-switch-rollback', '换源失败回滚', 'FlowShell', Contract25RouteRendererKind.SourceSwitchState),
    unavailableRouteDefinition('source-switch-preview', '换源预览', 'FlowShell', Contract25RouteRendererKind.SourceSwitchState),
    unavailableRouteDefinition('reader-toc-loading', '目录加载中', 'ReaderShell', Contract25RouteRendererKind.ReaderContentState),
    unavailableRouteDefinition('reader-toc-offline', '目录离线', 'ReaderShell', Contract25RouteRendererKind.ReaderContentState),
    unavailableRouteDefinition('reader-toc-error', '目录解析错误', 'ReaderShell', Contract25RouteRendererKind.ReaderContentState),
    unavailableRouteDefinition('reader-content-loading', '正文加载中', 'ReaderShell', Contract25RouteRendererKind.ReaderContentState),
    unavailableRouteDefinition('reader-content-offline', '正文离线', 'ReaderShell', Contract25RouteRendererKind.ReaderContentState),
    unavailableRouteDefinition('reader-content-error', '正文解析错误', 'ReaderShell', Contract25RouteRendererKind.ReaderContentState),
    unavailableRouteDefinition('reader-page-boundary-first', '首章首页边界', 'ReaderShell', Contract25RouteRendererKind.ReaderContentState),
    unavailableRouteDefinition('reader-page-boundary-last', '末章末页边界', 'ReaderShell', Contract25RouteRendererKind.ReaderContentState),
    unavailableRouteDefinition('reader-progress-restore', '阅读进度恢复', 'ReaderShell', Contract25RouteRendererKind.ReaderContentState),
    unavailableRouteDefinition('reader-background-restore', '后台恢复', 'ReaderShell', Contract25RouteRendererKind.ReaderContentState),
    unavailableRouteDefinition('import-permission-denied', '导入权限拒绝', 'LibraryShell', Contract25RouteRendererKind.LocalImportState),
    unavailableRouteDefinition('import-format-unsupported', '导入格式不支持', 'LibraryShell', Contract25RouteRendererKind.LocalImportState),
    unavailableRouteDefinition('import-empty-file', '导入空文件', 'LibraryShell', Contract25RouteRendererKind.LocalImportState),
    unavailableRouteDefinition('import-parsing', '导入解析中', 'LibraryShell', Contract25RouteRendererKind.LocalImportState),
    unavailableRouteDefinition('import-duplicate', '导入重复项', 'LibraryShell', Contract25RouteRendererKind.LocalImportState),
    unavailableRouteDefinition('import-conflict-resolve', '导入冲突处理', 'LibraryShell', Contract25RouteRendererKind.LocalImportState),
    unavailableRouteDefinition('import-partial-success', '导入部分成功', 'LibraryShell', Contract25RouteRendererKind.LocalImportState),
    unavailableRouteDefinition('import-result-detail', '导入结果详情', 'LibraryShell', Contract25RouteRendererKind.LocalImportState),
  ];

  static byId(id: string): Contract25RouteDefinition | undefined {
    for (let index = 0; index < ReaderContract25RouteRegistry.ALL.length; index++) {
      const definition = ReaderContract25RouteRegistry.ALL[index];
      if (definition.id === id) return definition;
    }
    return undefined;
  }

  static has(id: string): boolean {
    return ReaderContract25RouteRegistry.byId(id) !== undefined;
  }

  static routeIds(): string[] {
    const ids: string[] = [];
    for (let index = 0; index < ReaderContract25RouteRegistry.ALL.length; index++) {
      ids.push(ReaderContract25RouteRegistry.ALL[index].id);
    }
    return ids;
  }
}
