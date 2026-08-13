// Read-only adapter for ScreenGraph/ViewState 1.2 TapZones target bindings.
//
// The contract may describe which target is actionable, but it never owns
// live pagination, theme, content identity, or anchors. This adapter therefore
// translates only the three already-supported semantic actions into existing
// native UiEvents. It does not read or write ReaderUiStore.
import {
  ViewStateExplicitBinding,
  ViewStateJSONValue,
} from '../../contract/generated/ViewStateTable';
import { UiEvent } from '../store/ReaderUiState';

export type ReaderUIScreenGraphTapZoneTarget = 'previous' | 'control' | 'next';

export class ReaderUIScreenGraphTapZoneAdapter {
  static explicitEvent(bindings: ViewStateExplicitBinding[],
    target: ReaderUIScreenGraphTapZoneTarget): UiEvent | null {
    let selected: ViewStateExplicitBinding | null = null;
    for (let index: number = 0; index < bindings.length; index += 1) {
      const binding: ViewStateExplicitBinding = bindings[index];
      if (binding.target !== target) continue;
      // Duplicate target bindings are ambiguous. Fail closed instead of
      // guessing which action the host should execute.
      if (selected !== null) return null;
      selected = binding;
    }
    if (selected === null || selected.trigger !== 'tap') return null;

    if (target === 'previous' && selected.event === 'reader.page.prev' &&
      ReaderUIScreenGraphTapZoneAdapter.emptyPayload(selected.payload)) {
      return { type: 'reader-page-prev' };
    }
    if (target === 'next' && selected.event === 'reader.page.next' &&
      ReaderUIScreenGraphTapZoneAdapter.emptyPayload(selected.payload)) {
      return { type: 'reader-page-next' };
    }
    if (target === 'control' && selected.event === 'reader.control.toggle' &&
      ReaderUIScreenGraphTapZoneAdapter.controlPayload(selected.payload)) {
      return { type: 'route-push', id: 'reader' };
    }
    return null;
  }

  // Existing immersive-reading production routes predate explicit ViewState
  // bindings. Keep their native actions stable when no TapZones contract node
  // exists; once a node exists, explicitEvent() becomes fail-closed per target.
  static productionEvent(target: ReaderUIScreenGraphTapZoneTarget): UiEvent {
    if (target === 'previous') return { type: 'reader-page-prev' };
    if (target === 'next') return { type: 'reader-page-next' };
    return { type: 'route-push', id: 'reader' };
  }

  private static emptyPayload(payload: Record<string, ViewStateJSONValue>): boolean {
    return Object.keys(payload).length === 0;
  }

  private static controlPayload(payload: Record<string, ViewStateJSONValue>): boolean {
    const keys: string[] = Object.keys(payload);
    return keys.length === 1 && keys[0] === 'overlay' && payload['overlay'] === 'reader-control';
  }
}
