// Fail-closed adapter for the first audited ScreenGraph/ViewState Button batch.
//
// The canonical graph currently synthesizes Button bindings from the three
// uiEvent props, while generated ViewStateTable Button.bindings remains empty.
// Keep this adapter Store-free and admit only the four exact route-owned
// source.import.open leaves whose complete semantic is opening local import.
// Route, page-state, id, label, enabled/selected absence, trigger, event and
// payload are all part of the admission key. Every effectful/static-fixture
// payload remains outside this boundary.
import {
  ViewStateComponent,
  ViewStateJSONValue,
} from '../../contract/generated/ViewStateTable';
import { UiEvent } from '../store/ReaderUiState';

export class ReaderUIScreenGraphButtonAdapter {
  static event(routeId: string, pageState: string,
    component: ViewStateComponent): UiEvent | null {
    if (component.type !== 'Button' || component.children.length !== 0 ||
      component.bindings.length !== 0) {
      return null;
    }
    if (!ReaderUIScreenGraphButtonAdapter.isAllowedNode(
      routeId, pageState, component.id, component.props.label,
    )) return null;
    // The current canonical Button population does not declare either prop.
    // Treat future enabled/selected semantics as an audit boundary instead of
    // guessing a platform default or a selected visual state.
    if (component.props.enabled !== undefined || component.props.selected !== undefined ||
      component.props.action !== undefined || component.props.destructive !== undefined) {
      return null;
    }
    if (component.props.uiEvent !== 'source.import.open' ||
      component.props.uiEventTrigger !== 'tap' ||
      !ReaderUIScreenGraphButtonAdapter.emptyPayload(component.props.uiEventPayload)) {
      return null;
    }
    return { type: 'source-import-open' };
  }

  private static isAllowedNode(routeId: string, pageState: string,
    componentId: string, label: string | undefined): boolean {
    return (routeId === 'import-permission-denied' && pageState === 'permission' &&
      componentId === 'import_permission_denied-action' && label === '重新选择文件') ||
      (routeId === 'import-format-unsupported' && pageState === 'error' &&
        componentId === 'import_format_unsupported-action' && label === '重新选择文件') ||
      (routeId === 'import-empty-file' && pageState === 'empty' &&
        componentId === 'import_empty_file-action' && label === '重新选择文件') ||
      (routeId === 'import-result-detail' && pageState === 'default' &&
        componentId === 'import_result_detail-action' && label === '继续导入');
  }

  private static emptyPayload(value: ViewStateJSONValue | undefined): boolean {
    if (value === null || value === undefined || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }
    return Object.keys(value).length === 0;
  }
}
