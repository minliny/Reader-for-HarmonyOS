// Shadow-only consumer of Reader UI's generated ScreenGraph registry.
//
// The native reducer, RouteTable and ViewStateTable remain rendering authority.
// This observer performs the generated registry lookup at the real route/body
// entry points and records parity without projecting ScreenGraph nodes into
// ArkUI. Promotion to Authoritative requires a separate rollout decision.
import { RouteId } from '../../contract/reader_ui/Route';
import {
  ScreenGraphComponentNode,
  ScreenGraphRegistry,
  ScreenGraphRouteNode,
  ScreenGraphVariant,
} from '../../contract/reader_ui/ScreenGraph';
import { ViewStateComponent } from '../../contract/generated/ViewStateTable';

export enum ReaderUIScreenGraphAuthority {
  Shadow = 'Shadow',
}

export class ReaderUIScreenGraphShadowRegistry {
  static readonly AUTHORITY: ReaderUIScreenGraphAuthority = ReaderUIScreenGraphAuthority.Shadow;
  private static readonly REGISTRY: ScreenGraphRegistry = ScreenGraphRegistry.loadCanonical();
  private static lastRouteMatch: boolean = true;
  private static lastViewStateMatch: boolean = true;

  static observeRoute(routeId: string, nativeShell: string | null): boolean {
    const route: ScreenGraphRouteNode | undefined =
      ReaderUIScreenGraphShadowRegistry.REGISTRY.route(routeId as RouteId);
    const matches: boolean = route !== undefined && nativeShell !== null && route.shell === nativeShell;
    ReaderUIScreenGraphShadowRegistry.lastRouteMatch = matches;
    return matches;
  }

  static observeViewState(routeId: string, pageState: string,
    components: ViewStateComponent[]): boolean {
    const route: ScreenGraphRouteNode | undefined =
      ReaderUIScreenGraphShadowRegistry.REGISTRY.route(routeId as RouteId);
    if (route === undefined) {
      ReaderUIScreenGraphShadowRegistry.lastViewStateMatch = false;
      return false;
    }
    const variants: ScreenGraphVariant[] =
      ReaderUIScreenGraphShadowRegistry.REGISTRY.variants(routeId as RouteId, true);
    const variant: ScreenGraphVariant | undefined =
      ReaderUIScreenGraphShadowRegistry.selectVariant(variants, pageState);
    const matches: boolean = variant !== undefined &&
      ReaderUIScreenGraphShadowRegistry.sameComponents(variant.components, components);
    ReaderUIScreenGraphShadowRegistry.lastViewStateMatch = matches;
    return matches;
  }

  static routeMatched(): boolean {
    return ReaderUIScreenGraphShadowRegistry.lastRouteMatch;
  }

  static viewStateMatched(): boolean {
    return ReaderUIScreenGraphShadowRegistry.lastViewStateMatch;
  }

  private static selectVariant(variants: ScreenGraphVariant[], pageState: string): ScreenGraphVariant | undefined {
    let fallback: ScreenGraphVariant | undefined = undefined;
    for (let index: number = 0; index < variants.length; index += 1) {
      const candidate: ScreenGraphVariant = variants[index];
      if (candidate.pageState === pageState || candidate.variantId === pageState) return candidate;
      if (candidate.pageState === 'default' || candidate.variantId === 'default' || fallback === undefined) {
        fallback = candidate;
      }
    }
    return fallback;
  }

  private static sameComponents(canonical: ScreenGraphComponentNode[],
    nativeComponents: ViewStateComponent[]): boolean {
    if (canonical.length !== nativeComponents.length) return false;
    for (let index: number = 0; index < canonical.length; index += 1) {
      const expected: ScreenGraphComponentNode = canonical[index];
      const actual: ViewStateComponent = nativeComponents[index];
      if (expected.type !== actual.type || expected.id !== actual.id) return false;
      if (!ReaderUIScreenGraphShadowRegistry.sameComponents(expected.children, actual.children)) return false;
    }
    return true;
  }
}
