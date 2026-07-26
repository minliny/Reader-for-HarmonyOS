// RouteRenderer — RouteId → Shell → PageState dispatch.
// Reads routeId from AppStorage, resolves the shell via RouteTable, and renders it.
// Route switches flow through the motion pipeline: on routeId change, ReaderMotionResolver
// resolves the motionId from the last operation, and MotionAdapter.apply runs the swap inside
// animateTo. Pages never call animateTo themselves.
import { RouteTable } from '../../contract/generated/RouteTable';
import { MotionRequest, ReaderMotionResolver } from '../motion/ReaderMotionResolver';
import { MotionAdapter } from '../adapters/MotionAdapter';
import { MainTabShell } from '../shells/MainTabShell';
import { ReaderShell } from '../shells/ReaderShell';
import { LibraryShell } from '../shells/LibraryShell';
import { SettingsShell } from '../shells/SettingsShell';
import { FlowShell } from '../shells/FlowShell';
import { ViewportAdapter } from '../adapters/ViewportAdapter';
import { ReaderUIScreenGraphShadowRegistry } from './ReaderUIScreenGraphShadowRegistry';
import { ReaderUiVisualAdmission } from '../../contract/reader_ui/VisualAdmission';

function operationFor(lastOp: string): MotionRequest | null {
  switch (lastOp) {
    case 'route-push': return { operation: 'push', containerRole: 'appShell' };
    case 'reader.directory.open': return { operation: 'push', containerRole: 'appShell' };
    case 'route-pop': return { operation: 'pop', containerRole: 'appShell' };
    case 'reader.directory.close': return { operation: 'pop', containerRole: 'appShell' };
    case 'route-replace': return { operation: 'replace', containerRole: 'appShell' };
    case 'switch-tab': return { operation: 'tabSwitch', containerRole: 'mainTabShell' };
    default: return null;
  }
}

@Component
export struct RouteRenderer {
  @StorageProp('reader.routeId') @Watch('onRouteChange') routeId: string = 'bookshelf';
  @StorageProp('reader.lastOp') lastOp: string = '';
  @StorageProp('reader.reducedMotion') reducedMotion: boolean = false;
  @StorageProp(ViewportAdapter.K_CLASS) viewportClass: string = 'phone';
  // displayedRouteId is the motion-delayed route used to pick the shell. It is
  // shared via AppStorage (reader.displayedRouteId) so ViewStateRenderer (and any
  // other body component) reads the SAME value the shell is rendered for — no
  // "old shell renders new route body" mis-frame during the transition.
  @StorageLink('reader.displayedRouteId') private displayedRouteId: string = 'bookshelf';

  onRouteChange(): void {
    const op = operationFor(this.lastOp);
    if (op === null) {
      this.displayedRouteId = this.routeId;
      return;
    }
    const motionSpec = ReaderMotionResolver.resolveSpec(op);
    if (motionSpec === undefined) {
      this.displayedRouteId = this.routeId;
      return;
    }
    MotionAdapter.applySpec(motionSpec, this.reducedMotion, this.getUIContext(), () => {
      this.displayedRouteId = this.routeId;
    });
  }

  private shellOfDisplayedRoute(): string | null {
    const shell: string | null = RouteTable.shellOf(this.displayedRouteId);
    // Executed for every rendered route, but deliberately does not select the
    // shell. RouteTable/native reducer ownership remains unchanged in Shadow.
    ReaderUIScreenGraphShadowRegistry.observeRoute(this.displayedRouteId, shell);
    return shell;
  }

  private isDisplayedRouteVisuallyAdmitted(): boolean {
    return ReaderUiVisualAdmission.isRouteAdmittedForViewport(this.displayedRouteId, this.viewportClass);
  }

  build() {
    Stack() {
      if (!this.isDisplayedRouteVisuallyAdmitted() || this.shellOfDisplayedRoute() === null) {
        // A visible diagnostic would itself be a locally invented page. Keep
        // the unadmitted route inert until Figma provides and registers a
        // canonical surface.
        Column().width(0).height(0)
      } else if (this.shellOfDisplayedRoute() === 'MainTabShell') {
        MainTabShell()
      } else if (this.shellOfDisplayedRoute() === 'ReaderShell') {
        ReaderShell()
      } else if (this.shellOfDisplayedRoute() === 'LibraryShell') {
        LibraryShell()
      } else if (this.shellOfDisplayedRoute() === 'SettingsShell') {
        SettingsShell()
      } else {
        FlowShell()
      }
    }
    .width('100%')
    .height('100%')
  }
}
