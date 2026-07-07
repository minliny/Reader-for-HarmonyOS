// List.test — hypium entry. Registers all Phase 1 ArkTS test suites.
import TokenCoverageTests from './TokenCoverage.test';
import RouteDispatchTests from './RouteDispatch.test';
import MotionResolverTests from './MotionResolver.test';
import ShellSlotTests from './ShellSlot.test';
import HostSmokeTest from '../main/ets/host/tests/HostSmoke.test.ets';

export default function testsuit(): void {
  TokenCoverageTests();
  RouteDispatchTests();
  MotionResolverTests();
  ShellSlotTests();
  HostSmokeTest();
}
