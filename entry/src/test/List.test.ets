// List.test — hypium entry. Registers all Phase 1 ArkTS test suites.
import TokenCoverageTests from './TokenCoverage.test';
import RouteDispatchTests from './RouteDispatch.test';
import MotionResolverTests from './MotionResolver.test';
import ShellSlotTests from './ShellSlot.test';
import BookshelfViewStateTests from './BookshelfViewState.test';
import SourceSwitchViewStateTests from './SourceSwitchViewState.test';
import SettingsViewStateTests from './SettingsViewState.test';
import BookDetailViewStateTests from './BookDetailViewState.test';
import ReaderOverlayViewStateTests from './ReaderOverlayViewState.test';
import ReaderOverlayDispatchTests from './ReaderOverlayDispatch.test';
import ReaderEffectsTests from './ReaderEffects.test';
import HostSmokeTest from '../main/ets/host/tests/HostSmoke.test.ets';

export default function testsuit(): void {
  TokenCoverageTests();
  RouteDispatchTests();
  MotionResolverTests();
  ShellSlotTests();
  BookshelfViewStateTests();
  SourceSwitchViewStateTests();
  SettingsViewStateTests();
  BookDetailViewStateTests();
  ReaderOverlayViewStateTests();
  ReaderOverlayDispatchTests();
  ReaderEffectsTests();
  HostSmokeTest();
}
