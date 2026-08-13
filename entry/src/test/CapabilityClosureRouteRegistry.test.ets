import { describe, it, expect } from '@ohos/hypium';
import { RouteTable } from '../main/ets/contract/generated/RouteTable';
import {
  ViewStateComponent,
  ViewStateTable,
} from '../main/ets/contract/generated/ViewStateTable';
import { ReaderUIScreenGraphButtonAdapter } from '../main/ets/ui/router/ReaderUIScreenGraphButtonAdapter';
import {
  CapabilityClosureExecutionPolicy,
  ReaderCapabilityClosureRouteRegistry,
} from '../main/ets/ui/router/ReaderCapabilityClosureRouteRegistry';

function countBindings(components: ViewStateComponent[]): number {
  let total: number = 0;
  for (let index: number = 0; index < components.length; index += 1) {
    total += components[index].bindings.length;
    total += countBindings(components[index].children);
  }
  return total;
}

function buttonCountAndAdmission(routeId: string, pageState: string,
  components: ViewStateComponent[]): number {
  let count: number = 0;
  for (let index: number = 0; index < components.length; index += 1) {
    const component: ViewStateComponent = components[index];
    if (component.type === 'Button') {
      count += 1;
      expect(ReaderUIScreenGraphButtonAdapter.event(routeId, pageState, component) === null).assertTrue();
    }
    count += buttonCountAndAdmission(routeId, pageState, component.children);
  }
  return count;
}

export default function CapabilityClosureRouteRegistryTests(): void {
  describe('CapabilityClosureRouteRegistry', () => {
    it('matchesExact24CanonicalStructures', 0, () => {
      expect(RouteTable.ALL.length).assertEqual(260);
      expect(ReaderCapabilityClosureRouteRegistry.ALL.length).assertEqual(24);
      const seen: string[] = [];
      let coreBackedCount: number = 0;
      let nativeBackedCount: number = 0;
      let failClosedCount: number = 0;
      for (let index: number = 0;
        index < ReaderCapabilityClosureRouteRegistry.ALL.length; index += 1) {
        const definition = ReaderCapabilityClosureRouteRegistry.ALL[index];
        expect(seen.indexOf(definition.id)).assertEqual(-1);
        seen.push(definition.id);
        expect(RouteTable.has(definition.id)).assertTrue();
        expect(RouteTable.shellOf(definition.id)).assertEqual(definition.shell);
        expect(RouteTable.titleOf(definition.id)).assertEqual(definition.title);
        const components: ViewStateComponent[] =
          ViewStateTable.componentsFor(definition.id, definition.pageState);
        expect(components.map((component: ViewStateComponent) => component.type).join('|'))
          .assertEqual(definition.topLevelTypes.join('|'));
        if (definition.executionPolicy === CapabilityClosureExecutionPolicy.CoreBacked) {
          coreBackedCount += 1;
          expect(definition.id === 'bookmarks-manager').assertTrue();
          expect(ReaderCapabilityClosureRouteRegistry.isCoreBacked(definition.id)).assertTrue();
          expect(ReaderCapabilityClosureRouteRegistry.isFailClosed(definition.id)).assertFalse();
        } else if (definition.executionPolicy === CapabilityClosureExecutionPolicy.NativeBacked) {
          nativeBackedCount += 1;
          expect(ReaderCapabilityClosureRouteRegistry.isNativeBacked(definition.id)).assertTrue();
          expect(ReaderCapabilityClosureRouteRegistry.isFailClosed(definition.id)).assertFalse();
        } else {
          failClosedCount += 1;
          expect(definition.executionPolicy)
            .assertEqual(CapabilityClosureExecutionPolicy.PlannedFailClosed);
          expect(ReaderCapabilityClosureRouteRegistry.isFailClosed(definition.id)).assertTrue();
          expect(ReaderCapabilityClosureRouteRegistry.isCoreBacked(definition.id)).assertFalse();
        }
      }
      expect(coreBackedCount).assertEqual(1);
      expect(nativeBackedCount).assertEqual(4);
      expect(failClosedCount).assertEqual(19);
    });

    it('keepsAll51BindingsAnd26ButtonsFailClosed', 0, () => {
      let bindingCount: number = 0;
      let buttonCount: number = 0;
      for (let index: number = 0;
        index < ReaderCapabilityClosureRouteRegistry.ALL.length; index += 1) {
        const definition = ReaderCapabilityClosureRouteRegistry.ALL[index];
        const components: ViewStateComponent[] =
          ViewStateTable.componentsFor(definition.id, definition.pageState);
        bindingCount += countBindings(components);
        buttonCount += buttonCountAndAdmission(definition.id, definition.pageState, components);
      }
      expect(bindingCount).assertEqual(51);
      expect(buttonCount).assertEqual(26);
    });

    it('rejectsUnknownRoutes', 0, () => {
      expect(ReaderCapabilityClosureRouteRegistry.byId('not-a-route') === undefined).assertTrue();
    });
  });
}
