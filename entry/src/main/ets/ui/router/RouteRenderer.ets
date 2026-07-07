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

function operationFor(lastOp: string): MotionRequest | null {
  switch (lastOp) {
    case 'route-push': return { operation: 'push', containerRole: 'appShell' };
    case 'route-pop': return { operation: 'pop', containerRole: 'appShell' };
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
    const motionId = ReaderMotionResolver.resolveOr(op, 'app.route.replace');
    MotionAdapter.apply(motionId, this.reducedMotion, () => {
      this.displayedRouteId = this.routeId;
    });
  }

  build() {
    Stack() {
      if (RouteTable.shellOf(this.displayedRouteId) === 'MainTabShell') {
        MainTabShell()
      } else if (RouteTable.shellOf(this.displayedRouteId) === 'ReaderShell') {
        ReaderShell()
      } else if (RouteTable.shellOf(this.displayedRouteId) === 'LibraryShell') {
        LibraryShell()
      } else if (RouteTable.shellOf(this.displayedRouteId) === 'SettingsShell') {
        SettingsShell()
      } else {
        FlowShell()
      }
    }
    .width('100%')
    .height('100%')
  }
}
