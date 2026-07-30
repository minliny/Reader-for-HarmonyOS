import { describe, it, expect } from '@ohos/hypium';
import {
  ViewStateComponent,
  ViewStateTable,
} from '../main/ets/contract/generated/ViewStateTable';
import {
  ReaderUIScreenGraphStatePrimitiveAdapter,
  ReaderUIScreenGraphStatePrimitiveProjection,
} from '../main/ets/ui/router/ReaderUIScreenGraphStatePrimitiveAdapter';

function collectByType(components: ViewStateComponent[], type: string, sink: ViewStateComponent[]): void {
  for (let index: number = 0; index < components.length; index += 1) {
    const component: ViewStateComponent = components[index];
    if (component.type === type) sink.push(component);
    collectByType(component.children, type, sink);
  }
}

function canonicalComponents(type: string): ViewStateComponent[] {
  const result: ViewStateComponent[] = [];
  for (let index: number = 0; index < ViewStateTable.ENTRIES.length; index += 1) {
    collectByType(ViewStateTable.ENTRIES[index].components, type, result);
  }
  return result;
}

function text(value: Object | string | number | boolean | null | undefined): string {
  return typeof value === 'string' ? value : '';
}

export default function ScreenGraphStatePrimitiveAdapterTests(): void {
  describe('ScreenGraphStatePrimitiveAdapter', () => {
    it('projectsAllSixteenCanonicalStateLeavesWithoutActions', 0, () => {
      const types: string[] = ['Loading', 'ErrorState', 'Offline'];
      const counts: number[] = [8, 5, 3];
      let total: number = 0;
      for (let typeIndex: number = 0; typeIndex < types.length; typeIndex += 1) {
        const components: ViewStateComponent[] = canonicalComponents(types[typeIndex]);
        expect(components.length).assertEqual(counts[typeIndex]);
        total += components.length;
        for (let index: number = 0; index < components.length; index += 1) {
          const projection: ReaderUIScreenGraphStatePrimitiveProjection | null =
            ReaderUIScreenGraphStatePrimitiveAdapter.project(components[index]);
          expect(projection !== null).assertTrue();
          const title: string = text(components[index].props.title);
          const label: string = text(components[index].props.label);
          expect(projection!.title).assertEqual(title.length > 0 ? title : label);
          expect(projection!.message).assertEqual(text(components[index].props.message));
          expect(projection!.retryEnabled).assertFalse();
        }
      }
      expect(total).assertEqual(16);
    });

    it('rejectsChildrenBindingsAndActionTriggers', 0, () => {
      const child: ViewStateComponent = {
        type: 'Loading',
        id: 'nested-loading',
        props: {},
        children: [],
        bindings: [],
      };
      const withChild: ViewStateComponent = {
        type: 'Loading',
        id: 'loading-with-child',
        props: {},
        children: [child],
        bindings: [],
      };
      const withAction: ViewStateComponent = {
        type: 'Offline',
        id: 'offline-action',
        props: { uiEventTrigger: 'tap' },
        children: [],
        bindings: [],
      };
      expect(ReaderUIScreenGraphStatePrimitiveAdapter.project(withChild) === null).assertTrue();
      expect(ReaderUIScreenGraphStatePrimitiveAdapter.project(withAction) === null).assertTrue();
    });
  });
}
