// List.test — hypium entry. Registers all Phase 1 ArkTS test suites.
import TokenCoverageTests from './TokenCoverage.test';
import RouteDispatchTests from './RouteDispatch.test';
import MotionResolverTests from './MotionResolver.test';
import ShellSlotTests from './ShellSlot.test';

export default function testsuit(): void {
  TokenCoverageTests();
  RouteDispatchTests();
  MotionResolverTests();
  ShellSlotTests();
}
