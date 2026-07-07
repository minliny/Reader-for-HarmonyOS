// Index — the single @Entry page. Hosts RouteRenderer, which dispatches RouteId → Shell.
import { RouteRenderer } from '../ui/router/RouteRenderer';

@Entry
@Component
struct Index {
  build() {
    Column() {
      RouteRenderer()
    }
    .width('100%')
    .height('100%')
  }
}
