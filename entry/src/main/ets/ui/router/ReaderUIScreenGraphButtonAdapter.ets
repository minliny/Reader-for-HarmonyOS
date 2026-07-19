// Fail-closed adapter for the first audited ScreenGraph/ViewState Button batch.
//
// The canonical graph currently synthesizes Button bindings from the three
// uiEvent props, while generated ViewStateTable Button.bindings remains empty.
// Keep admission exact. Four route-owned source.import.open leaves remain
// static-safe. Of the current locked 2.5.1 Slice 10 nodes, only the storage
// clear button has the exact current event/binding shape. Download retry and
// replace undo stay fail-closed until a formally consumed Screen Graph carries
// their typed payloads; the native cache and replace panels own live actions.
import {
  ViewStateComponent,
  ViewStateJSONValue,
} from '../../contract/generated/ViewStateTable';
import { ReaderUiState, UiEvent } from '../store/ReaderUiState';
import { ReaderSlice10LivePayloadResolver } from '../store/ReaderSlice10LivePayloadResolver';

export class ReaderUIScreenGraphButtonAdapter {
  static event(routeId: string, pageState: string,
    component: ViewStateComponent, state?: ReaderUiState): UiEvent | null {
    if (component.type !== 'Button' || component.children.length !== 0) return null;
    // The current canonical Button population does not declare either prop.
    // Treat future enabled/selected semantics as an audit boundary instead of
    // guessing a platform default or a selected visual state.
    if (component.props.enabled !== undefined || component.props.selected !== undefined ||
      component.props.action !== undefined || component.props.destructive !== undefined) {
      return null;
    }
    if (ReaderUIScreenGraphButtonAdapter.isAllowedSourceImportNode(
      routeId, pageState, component.id, component.props.label,
    )) {
      if (component.bindings.length !== 0 ||
        !ReaderUIScreenGraphButtonAdapter.exactProps(component, ['label', 'uiEvent', 'uiEventPayload', 'uiEventTrigger']) ||
        component.props.uiEvent !== 'source.import.open' ||
        component.props.uiEventTrigger !== 'tap' ||
        !ReaderUIScreenGraphButtonAdapter.emptyPayload(component.props.uiEventPayload)) {
        return null;
      }
      return { type: 'source-import-open' };
    }

    if (state === undefined) return null;
    if (routeId === 'settings-storage' && pageState === 'default' &&
      component.id === 'settings-storage-clear-cache' && component.props.label === '清理缓存' &&
      ReaderUIScreenGraphButtonAdapter.exactProps(component, ['label']) &&
      ReaderUIScreenGraphButtonAdapter.exactBinding(
        component, 'clear', 'settings.cache.clear', 'tap', ['scope'],
      )) {
      return ReaderSlice10LivePayloadResolver.cacheClearEvent(state, 'cache');
    }
    return null;
  }

  private static isAllowedSourceImportNode(routeId: string, pageState: string,
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

  private static exactBinding(component: ViewStateComponent, target: string,
    event: string, trigger: string, payloadKeys: string[]): boolean {
    if (component.bindings.length !== 1) return false;
    const binding = component.bindings[0];
    const bindingKeys = Object.keys(binding).sort();
    const expectedKeys = ['event', 'payload', 'target', 'trigger'];
    if (bindingKeys.length !== expectedKeys.length) return false;
    for (let index = 0; index < bindingKeys.length; index += 1) {
      if (bindingKeys[index] !== expectedKeys[index]) return false;
    }
    return binding.target === target && binding.event === event && binding.trigger === trigger &&
      ReaderUIScreenGraphButtonAdapter.exactPayloadKeys(binding.payload, payloadKeys);
  }

  private static exactPayloadKeys(value: ViewStateJSONValue | undefined, expected: string[]): boolean {
    if (value === null || value === undefined || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }
    const actual = Object.keys(value).sort();
    const sortedExpected = expected.slice().sort();
    if (actual.length !== sortedExpected.length) return false;
    for (let index = 0; index < actual.length; index += 1) {
      if (actual[index] !== sortedExpected[index]) return false;
    }
    return true;
  }

  private static exactProps(component: ViewStateComponent, expected: string[]): boolean {
    const actual = Object.keys(component.props).sort();
    const sortedExpected = expected.slice().sort();
    if (actual.length !== sortedExpected.length) return false;
    for (let index = 0; index < actual.length; index += 1) {
      if (actual[index] !== sortedExpected[index]) return false;
    }
    return true;
  }
}
