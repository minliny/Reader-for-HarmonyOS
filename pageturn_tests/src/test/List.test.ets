// List.test - hypium entry for the pageturn HAR module. Registers all
// page-turn pure-logic test suites. The dedicated `pageturn_tests@ohosTest`
// host isolates this HAR + its suites from entry's NAPI/HAR/main compile graph.
import PageTurnContractTests from './PageTurnContract.test';
import PageTurnProviderRegistryTests from './PageTurnProviderRegistry.test';
import PageTurnCoordinatorTests from './PageTurnCoordinator.test';
import PageTurnSurfaceTransformerTests from './PageTurnSurfaceTransformer.test';
import ScrollAnchorCommitProviderTests from './ScrollAnchorCommitProvider.test';
import Real3dPageTurnProviderTests from './Real3dPageTurnProvider.test';

export default function testsuit(): void {
  PageTurnContractTests();
  PageTurnProviderRegistryTests();
  PageTurnCoordinatorTests();
  PageTurnSurfaceTransformerTests();
  ScrollAnchorCommitProviderTests();
  Real3dPageTurnProviderTests();
}
