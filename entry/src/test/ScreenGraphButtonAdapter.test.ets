import { describe, it, expect } from '@ohos/hypium';
import type { ReaderUIJSONPayload } from 'reader_ui_runtime';
import { RouteId } from '../main/ets/contract/generated/RouteTable';
import {
  ViewStateComponent,
  ViewStateEntry,
  ViewStateJSONValue,
  ViewStateTable,
} from '../main/ets/contract/generated/ViewStateTable';
import { ReaderUIScreenGraphButtonAdapter } from '../main/ets/ui/router/ReaderUIScreenGraphButtonAdapter';
import { ReaderUiStore } from '../main/ets/ui/store/ReaderUiStore';
import { ReaderUiState, UiEvent } from '../main/ets/ui/store/ReaderUiState';
import { DemoUiState } from '../main/ets/ui/fixtures/DemoUiState';

const ROUTES: RouteId[] = [
  'import-permission-denied',
  'import-format-unsupported',
  'import-empty-file',
  'import-result-detail',
];
const PAGE_STATES: string[] = ['permission', 'error', 'empty', 'default'];
const BUTTON_IDS: string[] = [
  'import_permission_denied-action',
  'import_format_unsupported-action',
  'import_empty_file-action',
  'import_result_detail-action',
];

function componentById(components: ViewStateComponent[], id: string): ViewStateComponent | null {
  for (let index: number = 0; index < components.length; index += 1) {
    const component: ViewStateComponent = components[index];
    if (component.id === id) return component;
    const nested: ViewStateComponent | null = componentById(component.children, id);
    if (nested !== null) return nested;
  }
  return null;
}

function canonicalButton(index: number): ViewStateComponent {
  const component: ViewStateComponent | null = componentById(
    ViewStateTable.componentsFor(ROUTES[index], PAGE_STATES[index]),
    BUTTON_IDS[index],
  );
  if (component === null) {
    return { type: '', id: '', props: {}, children: [], bindings: [] };
  }
  return component;
}

function routeButton(routeId: RouteId, pageState: string, componentId: string): ViewStateComponent {
  const component = componentById(ViewStateTable.componentsFor(routeId, pageState), componentId);
  if (component === null) return { type: '', id: '', props: {}, children: [], bindings: [] };
  return component;
}

function liveSlice10State(): ReaderUiState {
  const state = DemoUiState.initial();
  state.currentBook = {
    sourceId: 'source-live', bookId: 'book-live', title: 'Live', author: 'Reader',
    summary: '', sourceName: 'Live source', sourceUrl: 'https://source.test',
    latestChapter: '', chapterListUrl: 'https://source.test/toc',
  };
  state.activeReaderContentIdentity = {
    sourceId: 'source-live', bookId: 'book-live', chapterIndex: 1,
  };
  state.chapterToc = [
    { index: 0, title: '0', chapterId: 'c0' },
    { index: 1, title: '1', chapterId: 'c1' },
    { index: 2, title: '2', chapterId: 'c2' },
    { index: 3, title: '3', chapterId: 'c3' },
  ];
  state.lastUndoToken = JSON.parse(
    '{"schemaVersion":1,"transactionId":"live-undo-token"}',
  ) as Object as ReaderUIJSONPayload;
  return state;
}

function malformedButton(component: ViewStateComponent, uiEvent: string,
  trigger: string, payload: ViewStateJSONValue, label?: string): ViewStateComponent {
  return {
    type: component.type,
    id: component.id,
    props: {
      label: label ?? component.props.label,
      uiEvent: uiEvent,
      uiEventTrigger: trigger,
      uiEventPayload: payload,
    },
    children: [],
    bindings: [],
  };
}

function jsonValue(source: string): ViewStateJSONValue {
  return JSON.parse(source) as Object;
}

function countButtons(components: ViewStateComponent[], routeId: string, pageState: string,
  totals: number[]): void {
  for (let index: number = 0; index < components.length; index += 1) {
    const component: ViewStateComponent = components[index];
    if (component.type === 'Button') {
      totals[0] += 1;
      if (component.props.label !== undefined && component.props.label.length > 0) totals[3] += 1;
      if (component.props.enabled === undefined && component.props.selected === undefined) totals[4] += 1;
      if (component.props.uiEvent !== undefined && component.props.uiEventTrigger === 'tap') totals[5] += 1;
      if (ReaderUIScreenGraphButtonAdapter.event(routeId, pageState, component) === null) {
        totals[2] += 1;
      } else {
        totals[1] += 1;
      }
    }
    countButtons(component.children, routeId, pageState, totals);
  }
}

export default function ScreenGraphButtonAdapterTests(): void {
  describe('ScreenGraphButtonAdapter', () => {
    it('mapsOnlyFourAuditedSourceImportOpenButtons', 0, () => {
      for (let index: number = 0; index < ROUTES.length; index += 1) {
        const event: UiEvent | null = ReaderUIScreenGraphButtonAdapter.event(
          ROUTES[index], PAGE_STATES[index], canonicalButton(index),
        );
        expect(event !== null).assertTrue();
        expect(event!.type).assertEqual('source-import-open');
      }
    });

    it('projectsExactDataAndKeepsTheOtherFiftyFiveCanonicalButtonsFailClosed', 0, () => {
      const totals: number[] = [0, 0, 0, 0, 0, 0];
      for (let index: number = 0; index < ViewStateTable.ENTRIES.length; index += 1) {
        const entry: ViewStateEntry = ViewStateTable.ENTRIES[index];
        countButtons(entry.components, entry.routeId, entry.pageState, totals);
      }
      expect(totals[0]).assertEqual(59);
      expect(totals[1]).assertEqual(4);
      expect(totals[2]).assertEqual(55);
      expect(totals[3]).assertEqual(59);
      expect(totals[4]).assertEqual(59);
      expect(totals[5]).assertEqual(31);
    });

    it('admitsOnlyTheExactLockedSlice10ButtonAndKeepsDriftedNodesFailClosed', 0, () => {
      const state = liveSlice10State();
      const retry = ReaderUIScreenGraphButtonAdapter.event(
        'download-task-detail', 'default',
        routeButton('download-task-detail', 'default', 'download-task-detail-retry'), state,
      );
      // The locked 2.5.1 node still carries taskId/bookId plus a
      // planned-fail-closed prop, not the typed live prefetch tuple.
      expect(retry === null).assertTrue();

      const clear = ReaderUIScreenGraphButtonAdapter.event(
        'settings-storage', 'default',
        routeButton('settings-storage', 'default', 'settings-storage-clear-cache'), state,
      )!;
      expect(clear.type).assertEqual('settings-cache-clear');
      expect(clear.readerUIJSONPayload!['scope'] as string).assertEqual('cache');

      const undo = ReaderUIScreenGraphButtonAdapter.event(
        'reader-replace-apply-result', 'default',
        routeButton('reader-replace-apply-result', 'default', 'reader_replace_apply_result-action-1'), state,
      );
      // The locked node carries only a sample transactionId and no binding;
      // the native replace panel owns the real Core-issued undo token.
      expect(undo === null).assertTrue();
    });

    it('rejectsRouteTriggerPayloadBindingAndEffectfulDrift', 0, () => {
      const canonical: ViewStateComponent = canonicalButton(0);
      expect(ReaderUIScreenGraphButtonAdapter.event(
        'import-empty-file', PAGE_STATES[0], canonical,
      ) === null).assertTrue();
      expect(ReaderUIScreenGraphButtonAdapter.event(
        ROUTES[0], 'default', canonical,
      ) === null).assertTrue();
      expect(ReaderUIScreenGraphButtonAdapter.event(
        ROUTES[0], PAGE_STATES[0],
        malformedButton(canonical, 'source.import.open', 'state-evidence', jsonValue('{}')),
      ) === null).assertTrue();
      expect(ReaderUIScreenGraphButtonAdapter.event(
        ROUTES[0], PAGE_STATES[0],
        malformedButton(canonical, 'source.import.open', 'tap', jsonValue('{"bookId":"bk-001"}')),
      ) === null).assertTrue();
      expect(ReaderUIScreenGraphButtonAdapter.event(
        ROUTES[0], PAGE_STATES[0],
        malformedButton(canonical, 'reader.content.load', 'tap', jsonValue('{}')),
      ) === null).assertTrue();
      expect(ReaderUIScreenGraphButtonAdapter.event(
        ROUTES[0], PAGE_STATES[0],
        malformedButton(canonical, 'source.import.open', 'tap', jsonValue('{}'), '继续'),
      ) === null).assertTrue();

      const withEnabled: ViewStateComponent = malformedButton(
        canonical, 'source.import.open', 'tap', jsonValue('{}'),
      );
      withEnabled.props.enabled = true;
      expect(ReaderUIScreenGraphButtonAdapter.event(
        ROUTES[0], PAGE_STATES[0], withEnabled,
      ) === null).assertTrue();

      const withSelected: ViewStateComponent = malformedButton(
        canonical, 'source.import.open', 'tap', jsonValue('{}'),
      );
      withSelected.props.selected = 'selected';
      expect(ReaderUIScreenGraphButtonAdapter.event(
        ROUTES[0], PAGE_STATES[0], withSelected,
      ) === null).assertTrue();

      const withBinding: ViewStateComponent = malformedButton(
        canonical, 'source.import.open', 'tap', jsonValue('{}'),
      );
      withBinding.bindings = [{
        target: 'self', event: 'source.import.open', payload: {}, trigger: 'tap',
      }];
      expect(ReaderUIScreenGraphButtonAdapter.event(
        ROUTES[0], PAGE_STATES[0], withBinding,
      ) === null).assertTrue();

      const cancelParsing: ViewStateComponent | null = componentById(
        ViewStateTable.componentsFor('import-parsing', 'loading'),
        'import_parsing-action',
      );
      expect(cancelParsing !== null).assertTrue();
      expect(ReaderUIScreenGraphButtonAdapter.event(
        'import-parsing', 'loading', cancelParsing!,
      ) === null).assertTrue();
    });

    it('dispatchesEachAllowedRouteTransitionExactlyOnceThroughStore', 0, () => {
      for (let index: number = 0; index < ROUTES.length; index += 1) {
        ReaderUiStore.init();
        ReaderUiStore.dispatch({ type: 'route-replace', id: ROUTES[index] });
        const beforeLength: number = ReaderUiStore.snapshot().stack.length;
        const event: UiEvent | null = ReaderUIScreenGraphButtonAdapter.event(
          ROUTES[index], PAGE_STATES[index], canonicalButton(index),
        );
        expect(event !== null).assertTrue();
        ReaderUiStore.dispatch(event!);
        // ROUTES members are retired local-import routes: route-replace
        // redirects them to 'bookshelf', and source-import-open keeps the
        // invoking page in place. The assertion verifies no side effect
        // (stack length preserved, dialog stays idle) rather than route id.
        expect(ReaderUiStore.snapshot().routeId).assertEqual('bookshelf');
        expect(ReaderUiStore.snapshot().stack.length).assertEqual(beforeLength);
        expect(ReaderUiStore.snapshot().localImportDialogPhase).assertEqual('idle');
      }
    });
  });
}
